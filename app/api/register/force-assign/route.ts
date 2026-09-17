import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import type { ShiftEntry, StoreDoc, WeeklyRegistration } from '@/types';
import { requireWorkplaceCaller, workplaceAccessResponse, WorkplaceAccessError } from '@/lib/workplace/access';
import { legacyWeeklyRegistrationId, weeklyRegistrationId } from '@/lib/workplace/keys';
import { allocationFromSnapshot, allocationRef, assertCanManageStore, assertEmployeeStoreMembership, getTargetUser, shiftTouchesDates, writeAllocation } from '@/lib/scheduling/server';

function storeQuota(store: StoreDoc, date: string, shiftId: string) {
    const quotas = store.settings?.quotas;
    if (quotas?.specialDates?.[date]?.[shiftId] !== undefined) return quotas.specialDates[date][shiftId];
    return [0, 6].includes(new Date(`${date}T00:00:00`).getDay())
        ? quotas?.defaultWeekend?.[shiftId] ?? 5
        : quotas?.defaultWeekday?.[shiftId] ?? 5;
}

const assignSchema = z.object({
    targetUserId: z.string().min(1), storeId: z.string().min(1),
    weekStartDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/), date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    shiftId: z.string().min(1),
}).strict();

const removeSchema = z.object({
    targetUserId: z.string().min(1), storeId: z.string().min(1).optional(),
    weekStartDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/), date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    shiftId: z.string().min(1),
}).strict();

export async function POST(req: NextRequest) {
    try {
        const caller = await requireWorkplaceCaller(req); const input = assignSchema.parse(await req.json());
        await assertCanManageStore(caller, input.storeId);
        const target = await getTargetUser(caller.db, input.targetUserId);
        await assertEmployeeStoreMembership(caller.db, target, input.storeId, input.date);
        const storeSnapshot = await caller.db.collection('stores').doc(input.storeId).get();
        if (!storeSnapshot.exists || storeSnapshot.data()?.isActive === false) throw new WorkplaceAccessError('Cửa hàng không tồn tại hoặc đã ngừng hoạt động.', 404);
        const store = { id: storeSnapshot.id, ...storeSnapshot.data() } as StoreDoc;
        const id = weeklyRegistrationId(input.targetUserId, input.storeId, input.weekStartDate);
        const regRef = caller.db.collection('weekly_registrations').doc(id);
        const legacyId = legacyWeeklyRegistrationId(input.targetUserId, input.weekStartDate);
        const legacyRef = caller.db.collection('weekly_registrations').doc(legacyId);
        const [outside, outsideLegacy] = await Promise.all([regRef.get(), legacyRef.get()]);
        const outsideCurrent = outside.exists ? outside.data() as WeeklyRegistration : outsideLegacy.exists ? outsideLegacy.data() as WeeklyRegistration : null;
        const heldDates = [...new Set([
            ...(outsideCurrent?.shifts || []).flatMap(shift => shiftTouchesDates(store, shift.date, shift.shiftId)),
            ...shiftTouchesDates(store, input.date, input.shiftId),
        ])];
        const dayRefs = heldDates.map(date => allocationRef(caller.db, input.targetUserId, date));
        const userRegsQuery = caller.db.collection('weekly_registrations').where('userId', '==', input.targetUserId);
        const storeRegsQuery = caller.db.collection('weekly_registrations').where('storeId', '==', input.storeId).where('weekStartDate', '==', input.weekStartDate);
        const policyRef = caller.db.collection('workforce_policies').doc('global');
        await caller.db.runTransaction(async transaction => {
            const [regSnapshot, legacySnapshot, userRegs, storeRegs, policySnapshot, ...daySnapshots] = await Promise.all([
                transaction.get(regRef), transaction.get(legacyRef), transaction.get(userRegsQuery),
                transaction.get(storeRegsQuery), transaction.get(policyRef), ...dayRefs.map(ref => transaction.get(ref)),
            ]);
            const current = regSnapshot.exists ? regSnapshot.data() as WeeklyRegistration : legacySnapshot.exists ? legacySnapshot.data() as WeeklyRegistration : null;
            if (current?.shifts.some(shift => shift.date === input.date && shift.shiftId === input.shiftId)) {
                throw new WorkplaceAccessError('Nhân viên đã đăng ký ca này.', 409);
            }
            const shift: ShiftEntry = { date: input.date, shiftId: input.shiftId, isAssignedByManager: true };
            const resultingShifts = [...(current?.shifts || []), shift];
            // Registrations are availability/candidate entries, not actual work
            // assignments. A manager may add another shift here; the one-shift-
            // per-day and overlap rules are enforced atomically when counters are
            // published by saveScheduleDays().
            if (store.settings?.strictShiftLimit ?? true) {
                const employees = new Set(storeRegs.docs
                    .filter(doc => doc.id !== id && doc.id !== legacyId && (doc.data() as WeeklyRegistration).shifts?.some(item => item.date === input.date && item.shiftId === input.shiftId))
                    .map(doc => (doc.data() as WeeklyRegistration).userId));
                if (!employees.has(input.targetUserId) && employees.size >= storeQuota(store, input.date, input.shiftId)) {
                    throw new WorkplaceAccessError(`Ca ${input.shiftId} ngày ${input.date} đã đầy.`, 409);
                }
            }
            const monthly = new Map<string, Set<string>>();
            userRegs.docs.forEach(doc => {
                if (doc.id === id || doc.id === legacyId) return;
                const registration = doc.data() as WeeklyRegistration;
                registration.shifts?.forEach(item => {
                    const values = monthly.get(item.date.slice(0, 7)) || new Set<string>();
                    values.add(`${registration.storeId}\u0000${item.date}\u0000${item.shiftId}`);
                    monthly.set(item.date.slice(0, 7), values);
                });
            });
            resultingShifts.forEach(item => {
                const values = monthly.get(item.date.slice(0, 7)) || new Set<string>();
                values.add(`${input.storeId}\u0000${item.date}\u0000${item.shiftId}`);
                monthly.set(item.date.slice(0, 7), values);
            });
            const policy = policySnapshot.data() || {};
            monthly.forEach((values, month) => {
                const [year, monthNumber] = month.split('-').map(Number);
                const days = new Date(year, monthNumber, 0).getDate();
                const max = target.type === 'FT' ? Math.max(0, days - Number(policy.ftDaysOff ?? 4)) : Number(policy.ptMaxShifts ?? 25);
                if (values.size > max) throw new WorkplaceAccessError(`Tổng số ca tháng ${month} vượt định mức tài khoản (${values.size}/${max}).`, 409);
            });
            transaction.set(regRef, {
                id, userId: input.targetUserId, storeId: input.storeId, weekStartDate: input.weekStartDate,
                shifts: resultingShifts, submittedAt: current?.submittedAt || new Date().toISOString(),
                schemaVersion: 2, revision: (current?.revision || 0) + 1,
            } satisfies WeeklyRegistration);
            daySnapshots.forEach((snapshot, index) => {
                const allocation = allocationFromSnapshot(snapshot, input.targetUserId, heldDates[index], input.storeId);
                writeAllocation(transaction, dayRefs[index], {
                    ...allocation, registrationIds: [...new Set([...(allocation.registrationIds || []).filter(value => value !== legacyId), id])],
                });
            });
            if (legacySnapshot.exists && legacyRef.id !== regRef.id) transaction.delete(legacyRef);
        });
        return NextResponse.json({ message: 'Đã thêm nhân viên vào danh sách làm việc', id });
    } catch (error) {
        if (error instanceof z.ZodError) return NextResponse.json({ error: 'Dữ liệu không hợp lệ.' }, { status: 400 });
        return workplaceAccessResponse(error) ?? NextResponse.json({ error: error instanceof Error ? error.message : 'Không thể gán ca.' }, { status: 500 });
    }
}

export async function DELETE(req: NextRequest) {
    try {
        const caller = await requireWorkplaceCaller(req); const input = removeSchema.parse(await req.json());
        let storeId = input.storeId || '';
        let id = storeId ? weeklyRegistrationId(input.targetUserId, storeId, input.weekStartDate) : '';
        if (!storeId) {
            const query = await caller.db.collection('weekly_registrations')
                .where('userId', '==', input.targetUserId).where('weekStartDate', '==', input.weekStartDate).get();
            const match = query.docs.find(doc => (doc.data() as WeeklyRegistration).shifts?.some(shift => shift.date === input.date && shift.shiftId === input.shiftId));
            if (!match) throw new WorkplaceAccessError('Không tìm thấy đăng ký.', 404);
            storeId = (match.data() as WeeklyRegistration).storeId; id = match.id;
        }
        await assertCanManageStore(caller, storeId);
        const storeSnapshot = await caller.db.collection('stores').doc(storeId).get();
        if (!storeSnapshot.exists) throw new WorkplaceAccessError('Không tìm thấy cửa hàng.', 404);
        const store = { id: storeSnapshot.id, ...storeSnapshot.data() } as StoreDoc;
        const regRef = caller.db.collection('weekly_registrations').doc(id);
        const heldDates = shiftTouchesDates(store, input.date, input.shiftId);
        const dayRefs = heldDates.map(date => allocationRef(caller.db, input.targetUserId, date));
        await caller.db.runTransaction(async transaction => {
            const [regSnapshot, ...daySnapshots] = await Promise.all([transaction.get(regRef), ...dayRefs.map(ref => transaction.get(ref))]);
            if (!regSnapshot.exists) throw new WorkplaceAccessError('Không tìm thấy đăng ký.', 404);
            const current = regSnapshot.data() as WeeklyRegistration;
            const target = current.shifts.find(shift => shift.date === input.date && shift.shiftId === input.shiftId);
            if (!target?.isAssignedByManager) throw new WorkplaceAccessError('Chỉ có thể hủy ca do quản lý gán.', 409);
            const shifts = current.shifts.filter(shift => shift !== target);
            if (shifts.length) transaction.update(regRef, { shifts, revision: (current.revision || 0) + 1 });
            else transaction.delete(regRef);
            const remainingHeldDates = new Set(shifts.flatMap(shift => shiftTouchesDates(store, shift.date, shift.shiftId)));
            daySnapshots.forEach((snapshot, index) => {
                const allocation = allocationFromSnapshot(snapshot, input.targetUserId, heldDates[index], storeId);
                writeAllocation(transaction, dayRefs[index], {
                    ...allocation,
                    registrationIds: remainingHeldDates.has(heldDates[index]) ? allocation.registrationIds : (allocation.registrationIds || []).filter(value => value !== id),
                });
            });
        });
        return NextResponse.json({ message: 'Đã hủy gán ca thành công' });
    } catch (error) {
        if (error instanceof z.ZodError) return NextResponse.json({ error: 'Dữ liệu không hợp lệ.' }, { status: 400 });
        return workplaceAccessResponse(error) ?? NextResponse.json({ error: error instanceof Error ? error.message : 'Không thể hủy gán ca.' }, { status: 500 });
    }
}
