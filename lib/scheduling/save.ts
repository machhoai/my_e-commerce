import 'server-only';

import type { ScheduleDoc, StoreDoc } from '@/types';
import type { WorkplaceCaller } from '@/lib/workplace/access';
import { WorkplaceAccessError } from '@/lib/workplace/access';
import { scheduleId } from '@/lib/workplace/keys';
import { allocationFromSnapshot, allocationRef, assertCanManageStore, assertEmployeeStoreMembership, assertNoOverlappingShifts, getTargetUser, shiftTouchesDates, writeAllocation } from './server';

export interface ScheduleDayInput {
    date: string;
    shiftId: string;
    assignments: Record<string, { employeeIds: string[]; assignedByManagerUids: string[] }>;
}

function quotaFor(store: StoreDoc, date: string, shiftId: string) {
    const quotas = store.settings?.quotas;
    if (quotas?.specialDates?.[date]?.[shiftId] !== undefined) return quotas.specialDates[date][shiftId];
    return [0, 6].includes(new Date(`${date}T00:00:00`).getDay())
        ? quotas?.defaultWeekend?.[shiftId] ?? 5
        : quotas?.defaultWeekday?.[shiftId] ?? 5;
}

export async function saveScheduleDays(caller: WorkplaceCaller, storeId: string, days: ScheduleDayInput[]) {
    await assertCanManageStore(caller, storeId);
    if (!days.length) throw new WorkplaceAccessError('Không có ngày xếp lịch để lưu.', 400);
    const storeSnapshot = await caller.db.collection('stores').doc(storeId).get();
    if (!storeSnapshot.exists || storeSnapshot.data()?.isActive === false) throw new WorkplaceAccessError('Cửa hàng không tồn tại hoặc đã ngừng hoạt động.', 404);
    const counters = new Set<string>((storeSnapshot.data()?.settings?.counters || []).filter((item: { isActive?: boolean }) => item.isActive !== false).map((item: { id: string }) => item.id));

    const allEmployeeIds = new Set<string>();
    let writeCount = 0;
    for (const day of days) {
        if (!/^\d{4}-\d{2}-\d{2}$/.test(day.date) || !day.shiftId || !day.assignments) throw new WorkplaceAccessError('Dữ liệu lịch không hợp lệ.', 400);
        for (const [counterId, assignment] of Object.entries(day.assignments)) {
            if (!counters.has(counterId)) throw new WorkplaceAccessError('Quầy không thuộc cửa hàng hoặc đã ngừng hoạt động.', 400);
            if (!Array.isArray(assignment.employeeIds) || !Array.isArray(assignment.assignedByManagerUids)) throw new WorkplaceAccessError('Danh sách phân công không hợp lệ.', 400);
            if (new Set(assignment.employeeIds).size !== assignment.employeeIds.length) throw new WorkplaceAccessError('Một nhân viên bị lặp trong cùng quầy.', 400);
            if (assignment.assignedByManagerUids.some(uid => !assignment.employeeIds.includes(uid))) throw new WorkplaceAccessError('Danh sách quản lý gán không hợp lệ.', 400);
            assignment.employeeIds.forEach(uid => allEmployeeIds.add(uid)); writeCount += 1;
        }
    }
    const shiftsByUserDay = new Map<string, Set<string>>();
    for (const day of days) for (const assignment of Object.values(day.assignments)) for (const uid of assignment.employeeIds) {
        const key = `${uid}\u0000${day.date}`; const shifts = shiftsByUserDay.get(key) || new Set<string>();
        if (shifts.has(day.shiftId)) throw new WorkplaceAccessError('Một nhân viên không thể được xếp vào nhiều quầy trong cùng ca.', 409);
        shifts.add(day.shiftId); shiftsByUserDay.set(key, shifts);
    }
    for (const [key, shifts] of shiftsByUserDay) assertNoOverlappingShifts({ id: storeSnapshot.id, ...storeSnapshot.data() } as StoreDoc, key.split('\u0000')[1], [...shifts]);
    if (writeCount > 180 || allEmployeeIds.size > 250) throw new WorkplaceAccessError('Lịch quá lớn cho một lần lưu. Vui lòng chia nhỏ theo ngày.', 413);

    const users = new Map<string, Awaited<ReturnType<typeof getTargetUser>>>();
    for (const uid of allEmployeeIds) users.set(uid, await getTargetUser(caller.db, uid));
    for (const day of days) {
        for (const assignment of Object.values(day.assignments)) {
            for (const uid of assignment.employeeIds) await assertEmployeeStoreMembership(caller.db, users.get(uid)!, storeId, day.date);
        }
    }
    const [policySnapshot, ...registrationSnapshots] = await Promise.all([
        caller.db.collection('workforce_policies').doc('global').get(),
        ...[...allEmployeeIds].map(uid => caller.db.collection('weekly_registrations').where('userId', '==', uid).get()),
    ]);
    const policy = policySnapshot.data() || {};
    [...allEmployeeIds].forEach((uid, index) => {
        const totals = new Map<string, Set<string>>();
        registrationSnapshots[index].docs.forEach(doc => {
            const registration = doc.data() as { storeId: string; shifts?: Array<{ date: string; shiftId: string }> };
            registration.shifts?.forEach(shift => {
                const month = shift.date.slice(0, 7); const values = totals.get(month) || new Set<string>();
                values.add(`${registration.storeId}\u0000${shift.date}\u0000${shift.shiftId}`); totals.set(month, values);
            });
        });
        days.forEach(day => {
            if (!Object.values(day.assignments).some(item => item.employeeIds.includes(uid))) return;
            const month = day.date.slice(0, 7); const values = totals.get(month) || new Set<string>();
            values.add(`${storeId}\u0000${day.date}\u0000${day.shiftId}`); totals.set(month, values);
        });
        totals.forEach((values, month) => {
            const [year, monthNumber] = month.split('-').map(Number);
            const daysInMonth = new Date(year, monthNumber, 0).getDate();
            const user = users.get(uid)!;
            const max = user.type === 'FT' ? Math.max(0, daysInMonth - Number(policy.ftDaysOff ?? 4)) : Number(policy.ptMaxShifts ?? 25);
            if (values.size > max) throw new WorkplaceAccessError(`Nhân viên ${user.name || uid} vượt định mức tài khoản tháng ${month} (${values.size}/${max}).`, 409);
        });
    });

    const affectedDates = [...new Set(days.map(day => day.date))];
    const oldQueries = affectedDates.map(date => caller.db.collection('schedules')
        .where('storeId', '==', storeId).where('date', '==', date));

    return caller.db.runTransaction(async transaction => {
        const oldQuerySnapshots = await Promise.all(oldQueries.map(query => transaction.get(query)));
        const oldBySlot = new Map<string, FirebaseFirestore.QueryDocumentSnapshot>();
        oldQuerySnapshots.forEach(snapshot => snapshot.docs.forEach(doc => {
            const data = doc.data(); oldBySlot.set(`${data.date}\u0000${data.shiftId}\u0000${data.counterId}`, doc);
        }));

        // Validate the complete resulting day, including slots omitted from this request.
        const submittedSlots = new Set(days.flatMap(day => Object.keys(day.assignments)
            .map(counterId => `${day.date}\u0000${day.shiftId}\u0000${counterId}`)));
        const shiftsAfterSave = new Map<string, Array<{ shiftId: string; counterId: string }>>();
        const employeesByShift = new Map<string, Set<string>>();
        const add = (uid: string, date: string, shiftId: string, counterId: string) => {
            const key = `${uid}\u0000${date}`;
            const values = shiftsAfterSave.get(key) || [];
            values.push({ shiftId, counterId });
            shiftsAfterSave.set(key, values);
            const shiftKey = `${date}\u0000${shiftId}`;
            const employees = employeesByShift.get(shiftKey) || new Set<string>();
            employees.add(uid); employeesByShift.set(shiftKey, employees);
        };
        oldBySlot.forEach((doc, slot) => {
            if (submittedSlots.has(slot)) return;
            const value = doc.data() as ScheduleDoc;
            (value.employeeIds || []).forEach(uid => add(uid, value.date, value.shiftId, value.counterId));
        });
        days.forEach(day => Object.entries(day.assignments).forEach(([counterId, assignment]) =>
            assignment.employeeIds.forEach(uid => add(uid, day.date, day.shiftId, counterId))));
        shiftsAfterSave.forEach((values, key) => {
            const uniqueShifts = new Set(values.map(value => value.shiftId));
            if (uniqueShifts.size !== values.length) {
                throw new WorkplaceAccessError('Một nhân viên không thể được xếp vào nhiều quầy trong cùng ca.', 409);
            }
            const maxPerDay = storeSnapshot.data()?.settings?.maxShiftsPerDay ?? 1;
            if (uniqueShifts.size > maxPerDay) {
                throw new WorkplaceAccessError(`Chỉ được xếp tối đa ${maxPerDay} ca trong một ngày.`, 409);
            }
            assertNoOverlappingShifts(
                { id: storeSnapshot.id, ...storeSnapshot.data() } as StoreDoc,
                key.split('\u0000')[1],
                [...uniqueShifts],
            );
        });
        if (storeSnapshot.data()?.settings?.strictShiftLimit ?? true) {
            employeesByShift.forEach((employees, key) => {
                const [date, shiftId] = key.split('\u0000');
                const quota = quotaFor({ id: storeSnapshot.id, ...storeSnapshot.data() } as StoreDoc, date, shiftId);
                if (employees.size > quota) throw new WorkplaceAccessError(`Ca ${shiftId} ngày ${date} vượt định mức cửa hàng (${employees.size}/${quota}).`, 409);
            });
        }

        const affected = new Map<string, { uid: string; date: string; refs: Set<string>; oldRefs: Set<string> }>();
        days.forEach(day => Object.entries(day.assignments).forEach(([counterId, assignment]) => {
            const id = scheduleId(storeId, day.date, day.shiftId, counterId);
            const old = oldBySlot.get(`${day.date}\u0000${day.shiftId}\u0000${counterId}`)?.data() as ScheduleDoc | undefined;
            const uids = new Set([...(old?.employeeIds || []), ...assignment.employeeIds]);
            uids.forEach(uid => {
                shiftTouchesDates({ id: storeSnapshot.id, ...storeSnapshot.data() } as StoreDoc, day.date, day.shiftId).forEach(heldDate => {
                    const key = `${uid}\u0000${heldDate}`;
                    const entry = affected.get(key) || { uid, date: heldDate, refs: new Set<string>(), oldRefs: new Set<string>() };
                    if (assignment.employeeIds.includes(uid)) entry.refs.add(id);
                    if (old?.employeeIds?.includes(uid)) entry.oldRefs.add(oldBySlot.get(`${day.date}\u0000${day.shiftId}\u0000${counterId}`)?.id || id);
                    affected.set(key, entry);
                });
            });
        }));
        const affectedList = [...affected.values()];
        const allocationRefs = affectedList.map(item => allocationRef(caller.db, item.uid, item.date));
        const allocationSnapshots = await Promise.all(allocationRefs.map(ref => transaction.get(ref)));

        affectedList.forEach((item, index) => {
            const allocation = allocationFromSnapshot(allocationSnapshots[index], item.uid, item.date, storeId);
            const ids = new Set(allocation.scheduleIds || []);
            item.oldRefs.forEach(id => ids.delete(id)); item.refs.forEach(id => ids.add(id));
            writeAllocation(transaction, allocationRefs[index], { ...allocation, scheduleIds: [...ids] });
        });

        const changedUsers = new Set<string>();
        days.forEach(day => Object.entries(day.assignments).forEach(([counterId, assignment]) => {
            const id = scheduleId(storeId, day.date, day.shiftId, counterId);
            const slot = `${day.date}\u0000${day.shiftId}\u0000${counterId}`;
            const oldDoc = oldBySlot.get(slot); const old = oldDoc?.data() as ScheduleDoc | undefined;
            [...(old?.employeeIds || []), ...assignment.employeeIds].forEach(uid => changedUsers.add(uid));
            transaction.set(caller.db.collection('schedules').doc(id), {
                id, date: day.date, shiftId: day.shiftId, counterId, storeId,
                employeeIds: assignment.employeeIds,
                assignedByManagerUids: assignment.assignedByManagerUids,
                publishedAt: new Date().toISOString(), publishedBy: caller.uid, schemaVersion: 2,
            });
            if (oldDoc && oldDoc.id !== id) transaction.delete(oldDoc.ref);
        }));
        return { changedUserIds: [...changedUsers], savedDays: days.length };
    });
}
