import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import type { ShiftEntry, StoreDoc, WeeklyRegistration } from '@/types';
import { isInOpenWindow } from '@/lib/utils/schedule';
import { requireWorkplaceCaller, workplaceAccessResponse, WorkplaceAccessError } from '@/lib/workplace/access';
import { legacyWeeklyRegistrationId, weeklyRegistrationId } from '@/lib/workplace/keys';
import { allocationFromSnapshot, allocationRef, assertEmployeeStoreMembership, assertNoOverlappingShifts, shiftTouchesDates, writeAllocation } from '@/lib/scheduling/server';

const schema = z.object({
    id: z.string().optional(), userId: z.string().min(1), storeId: z.string().trim().min(1),
    weekStartDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    shifts: z.array(z.object({ date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/), shiftId: z.string().trim().min(1), isAssignedByManager: z.boolean().optional() }).strict()).min(1),
}).strict();

function assertEditableWeek(value: string) {
    const monday = new Date(); const day = monday.getDay();
    monday.setDate(monday.getDate() - day + (day === 0 ? -6 : 1) + 7); monday.setHours(0, 0, 0, 0);
    if (new Date(`${value}T00:00:00`).getTime() !== monday.getTime()) throw new WorkplaceAccessError('Chỉ được thay đổi lịch cho đúng tuần đang mở đăng ký.', 403);
}

function assertShiftDates(week: string, shifts: ShiftEntry[]) {
    const start = new Date(`${week}T00:00:00`); const end = new Date(start); end.setDate(end.getDate() + 7);
    const unique = new Set<string>();
    for (const shift of shifts) {
        const date = new Date(`${shift.date}T00:00:00`); const key = `${shift.date}\u0000${shift.shiftId}`;
        if (date < start || date >= end) throw new WorkplaceAccessError('Ca đăng ký nằm ngoài tuần đã chọn.', 400);
        if (unique.has(key)) throw new WorkplaceAccessError('Dữ liệu có ca đăng ký trùng lặp.', 400);
        unique.add(key);
    }
}

function quotaFor(store: StoreDoc, date: string, shiftId: string): number {
    const quotas = store.settings?.quotas;
    if (quotas?.specialDates?.[date]?.[shiftId] !== undefined) return quotas.specialDates[date][shiftId];
    return [0, 6].includes(new Date(`${date}T00:00:00`).getDay())
        ? quotas?.defaultWeekend?.[shiftId] ?? 5 : quotas?.defaultWeekday?.[shiftId] ?? 5;
}

async function loadOpenStore(caller: Awaited<ReturnType<typeof requireWorkplaceCaller>>, storeId: string) {
    const snapshot = await caller.db.collection('stores').doc(storeId).get();
    if (!snapshot.exists || snapshot.data()?.isActive === false) throw new WorkplaceAccessError('Cửa hàng không tồn tại hoặc đã ngừng hoạt động.', 404);
    const store = { id: snapshot.id, ...snapshot.data() } as StoreDoc;
    let open = store.settings?.registrationOpen ?? false;
    if (store.settings?.registrationSchedule?.enabled) open = isInOpenWindow(store.settings.registrationSchedule);
    if (!open) throw new WorkplaceAccessError('Cổng đăng ký ca đang đóng.', 403);
    return store;
}

export async function POST(req: NextRequest) {
    try {
        const caller = await requireWorkplaceCaller(req); const input = schema.parse(await req.json());
        if (input.userId !== caller.uid) throw new WorkplaceAccessError('Không được thay đổi đăng ký của người khác.', 403);
        assertEditableWeek(input.weekStartDate); assertShiftDates(input.weekStartDate, input.shifts);
        const store = await loadOpenStore(caller, input.storeId);
        const byDate = new Map<string, ShiftEntry[]>();
        for (const shift of input.shifts) { const group = byDate.get(shift.date) || []; group.push(shift); byDate.set(shift.date, group); }
        for (const date of byDate.keys()) await assertEmployeeStoreMembership(caller.db, caller.user, input.storeId, date);
        const maxPerDay = store.settings?.maxShiftsPerDay ?? 1;
        if ([...byDate.values()].some(group => group.length > maxPerDay)) throw new WorkplaceAccessError(`Chỉ được đăng ký tối đa ${maxPerDay} ca trong một ngày.`, 400);
        for (const [date, shifts] of byDate) assertNoOverlappingShifts(store, date, shifts.map(shift => shift.shiftId));

        const id = weeklyRegistrationId(caller.uid, input.storeId, input.weekStartDate);
        const regRef = caller.db.collection('weekly_registrations').doc(id);
        const legacyId = legacyWeeklyRegistrationId(caller.uid, input.weekStartDate);
        const legacyRef = caller.db.collection('weekly_registrations').doc(legacyId);
        const [outside, outsideLegacy] = await Promise.all([regRef.get(), legacyRef.get()]);
        const outsideCurrent = outside.exists ? outside : outsideLegacy;
        const newHeldDates = new Set(input.shifts.flatMap(shift => shiftTouchesDates(store, shift.date, shift.shiftId)));
        const oldHeldDates = new Set(outsideCurrent.exists
            ? ((outsideCurrent.data() as WeeklyRegistration).shifts || []).flatMap(shift => shiftTouchesDates(store, shift.date, shift.shiftId))
            : []);
        const dates = new Set([...newHeldDates, ...oldHeldDates]);
        const dateList = [...dates]; const dayRefs = dateList.map(date => allocationRef(caller.db, caller.uid, date));
        const regsQuery = caller.db.collection('weekly_registrations').where('storeId', '==', input.storeId).where('weekStartDate', '==', input.weekStartDate);
        const userRegsQuery = caller.db.collection('weekly_registrations').where('userId', '==', caller.uid);
        const policyRef = caller.db.collection('workforce_policies').doc('global');

        await caller.db.runTransaction(async transaction => {
            const [existing, legacyExisting, registrations, userRegistrations, policySnapshot, ...daySnapshots] = await Promise.all([transaction.get(regRef), transaction.get(legacyRef), transaction.get(regsQuery), transaction.get(userRegsQuery), transaction.get(policyRef), ...dayRefs.map(ref => transaction.get(ref))]);
            const old = existing.exists ? existing.data() as WeeklyRegistration : legacyExisting.exists ? legacyExisting.data() as WeeklyRegistration : null;
            if (store.settings?.strictShiftLimit ?? true) {
                for (const shift of input.shifts) {
                    const count = registrations.docs.filter(doc => doc.id !== id && doc.id !== legacyId && (doc.data() as WeeklyRegistration).shifts?.some(item => item.date === shift.date && item.shiftId === shift.shiftId)).length;
                    if (count >= quotaFor(store, shift.date, shift.shiftId)) throw new WorkplaceAccessError(`Ca ${shift.shiftId} ngày ${shift.date} đã đầy.`, 409);
                }
            }
            const policy = policySnapshot.data() || {};
            const totals = new Map<string, Set<string>>();
            userRegistrations.docs.forEach(doc => {
                if (doc.id === id || doc.id === legacyId) return;
                const registration = doc.data() as WeeklyRegistration;
                registration.shifts?.forEach(shift => {
                    const month = shift.date.slice(0, 7); const values = totals.get(month) || new Set<string>();
                    values.add(`${registration.storeId}\u0000${shift.date}\u0000${shift.shiftId}`); totals.set(month, values);
                });
            });
            input.shifts.forEach(shift => {
                const month = shift.date.slice(0, 7); const values = totals.get(month) || new Set<string>();
                values.add(`${input.storeId}\u0000${shift.date}\u0000${shift.shiftId}`); totals.set(month, values);
            });
            for (const [month, values] of totals) {
                const [year, monthNumber] = month.split('-').map(Number);
                const days = new Date(year, monthNumber, 0).getDate();
                const max = caller.user.type === 'FT'
                    ? Math.max(0, days - Number(policy.ftDaysOff ?? 4))
                    : Number(policy.ptMaxShifts ?? 25);
                if (values.size > max) throw new WorkplaceAccessError(`Tổng số ca tháng ${month} vượt định mức tài khoản (${values.size}/${max}).`, 409);
            }
            daySnapshots.forEach((snapshot, index) => {
                const date = dateList[index]; const allocation = allocationFromSnapshot(snapshot, caller.uid, date, input.storeId);
                const ids = new Set((allocation.registrationIds || []).filter(value => value !== legacyId));
                if (newHeldDates.has(date)) ids.add(id); else if (oldHeldDates.has(date)) ids.delete(id);
                writeAllocation(transaction, dayRefs[index], { ...allocation, registrationIds: [...ids] });
            });
            transaction.set(regRef, {
                id, userId: caller.uid, storeId: input.storeId, weekStartDate: input.weekStartDate,
                shifts: input.shifts.map(shift => ({ ...shift, isAssignedByManager: false })),
                submittedAt: new Date().toISOString(), schemaVersion: 2, revision: (old?.revision || 0) + 1,
            } satisfies WeeklyRegistration);
            if (legacyExisting.exists && legacyRef.id !== regRef.id) transaction.delete(legacyRef);
        });
        return NextResponse.json({ message: 'Đăng ký ca làm thành công', id });
    } catch (error) {
        if (error instanceof z.ZodError) return NextResponse.json({ error: 'Dữ liệu đăng ký không hợp lệ.' }, { status: 400 });
        return workplaceAccessResponse(error) ?? NextResponse.json({ error: error instanceof Error ? error.message : 'Không thể đăng ký ca.' }, { status: 500 });
    }
}

export async function DELETE(req: NextRequest) {
    try {
        const caller = await requireWorkplaceCaller(req);
        const { registrationId } = z.object({ registrationId: z.string().min(1) }).strict().parse(await req.json());
        const ref = caller.db.collection('weekly_registrations').doc(registrationId); const snapshot = await ref.get();
        if (!snapshot.exists) throw new WorkplaceAccessError('Không tìm thấy đăng ký.', 404);
        const registration = snapshot.data() as WeeklyRegistration;
        if (registration.userId !== caller.uid) throw new WorkplaceAccessError('Không được xóa đăng ký của người khác.', 403);
        assertEditableWeek(registration.weekStartDate); const store = await loadOpenStore(caller, registration.storeId);
        const dates = [...new Set(registration.shifts.flatMap(shift => shiftTouchesDates(store, shift.date, shift.shiftId)))]; const refs = dates.map(date => allocationRef(caller.db, caller.uid, date));
        await caller.db.runTransaction(async transaction => {
            const [fresh, ...snapshots] = await Promise.all([transaction.get(ref), ...refs.map(item => transaction.get(item))]);
            if (!fresh.exists) return;
            snapshots.forEach((item, index) => { const allocation = allocationFromSnapshot(item, caller.uid, dates[index], registration.storeId); writeAllocation(transaction, refs[index], { ...allocation, registrationIds: (allocation.registrationIds || []).filter(id => id !== registrationId) }); });
            transaction.delete(ref);
        });
        return NextResponse.json({ message: 'Đã xóa đăng ký thành công' });
    } catch (error) {
        if (error instanceof z.ZodError) return NextResponse.json({ error: 'Thiếu registrationId.' }, { status: 400 });
        return workplaceAccessResponse(error) ?? NextResponse.json({ error: error instanceof Error ? error.message : 'Không thể xóa đăng ký.' }, { status: 500 });
    }
}
