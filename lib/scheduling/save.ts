import 'server-only';

import type { ScheduleDoc, StoreDoc, UserDoc } from '@/types';
import type { WorkplaceCaller } from '@/lib/workplace/access';
import { WorkplaceAccessError } from '@/lib/workplace/access';
import { scheduleId } from '@/lib/workplace/keys';
import { exceedsDailyShiftLimit } from '@/lib/scheduling/policy';
import { assignedShiftKeys, monthlyShiftLimit, nextMonthStart } from '@/lib/scheduling/monthly-quota';
import { allocationFromSnapshot, allocationRef, assertCanManageStore, assertEmployeeStoreMembership, assertNoOverlappingShifts, shiftTouchesDates, writeAllocation } from './server';

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

function slotLabel(date: string, shiftId: string) {
    const [year, month, day] = date.split('-');
    return `ngày ${day}/${month}/${year}, ca ${shiftId}`;
}

function employeeName(users: Map<string, UserDoc>, uid: string) {
    return users.get(uid)?.name || uid;
}

function slotError(message: string, date: string, shiftId: string, status = 409) {
    return new WorkplaceAccessError(`${message} tại ${slotLabel(date, shiftId)}.`, status);
}

export async function saveScheduleDays(caller: WorkplaceCaller, storeId: string, days: ScheduleDayInput[]) {
    await assertCanManageStore(caller, storeId);
    if (!days.length) throw new WorkplaceAccessError('Không có ngày xếp lịch để lưu.', 400);
    const storeSnapshot = await caller.db.collection('stores').doc(storeId).get();
    if (!storeSnapshot.exists || storeSnapshot.data()?.isActive === false) throw new WorkplaceAccessError('Cửa hàng không tồn tại hoặc đã ngừng hoạt động.', 404);
    // Counter.isActive controls inventory/WMS access, not whether the physical
    // counter can be used for scheduling. Every configured counter is schedulable.
    const counters = new Set<string>((storeSnapshot.data()?.settings?.counters || []).map((item: { id: string }) => item.id));

    const allEmployeeIds = new Set<string>();
    const firstSlotByUid = new Map<string, { date: string; shiftId: string }>();
    let duplicateAssignment: { uid: string; counterId: string; date: string; shiftId: string } | undefined;
    let writeCount = 0;
    for (const day of days) {
        if (!/^\d{4}-\d{2}-\d{2}$/.test(day.date) || !day.shiftId || !day.assignments) throw new WorkplaceAccessError('Dữ liệu lịch không hợp lệ.', 400);
        for (const [counterId, assignment] of Object.entries(day.assignments)) {
            if (!counters.has(counterId)) throw slotError(`Quầy ${counterId} không thuộc cửa hàng`, day.date, day.shiftId, 400);
            if (!Array.isArray(assignment.employeeIds) || !Array.isArray(assignment.assignedByManagerUids)) throw slotError('Danh sách phân công không hợp lệ', day.date, day.shiftId, 400);
            if (new Set(assignment.employeeIds).size !== assignment.employeeIds.length && !duplicateAssignment) {
                const uid = assignment.employeeIds.find((value, index) => assignment.employeeIds.indexOf(value) !== index)!;
                duplicateAssignment = { uid, counterId, date: day.date, shiftId: day.shiftId };
            }
            if (assignment.assignedByManagerUids.some(uid => !assignment.employeeIds.includes(uid))) throw slotError('Danh sách quản lý gán không hợp lệ', day.date, day.shiftId, 400);
            assignment.employeeIds.forEach(uid => {
                allEmployeeIds.add(uid);
                if (!firstSlotByUid.has(uid)) firstSlotByUid.set(uid, { date: day.date, shiftId: day.shiftId });
            });
            writeCount += 1;
        }
    }
    if (writeCount > 180 || allEmployeeIds.size > 250) throw new WorkplaceAccessError('Lịch quá lớn cho một lần lưu. Vui lòng chia nhỏ theo ngày.', 413);
    const users = new Map<string, UserDoc>();
    for (const uid of allEmployeeIds) {
        const snapshot = await caller.db.collection('users').doc(uid).get();
        const slot = firstSlotByUid.get(uid)!;
        if (!snapshot.exists) throw slotError(`Không tìm thấy nhân viên ${uid}`, slot.date, slot.shiftId, 404);
        const target = { uid, ...snapshot.data() } as UserDoc;
        users.set(uid, target);
        if (target.isActive === false) throw slotError(`Nhân viên ${employeeName(users, uid)} đã nghỉ việc hoặc tài khoản bị vô hiệu hóa, không thể xếp lịch`, slot.date, slot.shiftId);
    }
    if (duplicateAssignment) {
        const { uid, counterId, date, shiftId } = duplicateAssignment;
        throw slotError(`Nhân viên ${employeeName(users, uid)} bị lặp trong quầy ${counterId}`, date, shiftId, 400);
    }
    const shiftsByUserDay = new Map<string, Set<string>>();
    for (const day of days) for (const assignment of Object.values(day.assignments)) for (const uid of assignment.employeeIds) {
        const key = `${uid}\u0000${day.date}`; const shifts = shiftsByUserDay.get(key) || new Set<string>();
        shifts.add(day.shiftId); shiftsByUserDay.set(key, shifts);
    }
    for (const [key, shifts] of shiftsByUserDay) {
        const [uid, date] = key.split('\u0000');
        try {
            assertNoOverlappingShifts(
                { id: storeSnapshot.id, ...storeSnapshot.data() } as StoreDoc,
                date,
                [...shifts],
            );
        } catch (error) {
            if (!(error instanceof WorkplaceAccessError)) throw error;
            throw new WorkplaceAccessError(`Nhân viên ${employeeName(users, uid)}: ${error.message} (${slotLabel(date, [...shifts][0])}).`, error.status);
        }
        if (exceedsDailyShiftLimit(shifts)) {
            throw new WorkplaceAccessError(`Nhân viên ${employeeName(users, uid)} bị xếp ${shifts.size} ca (${[...shifts].join(', ')}) ngày ${date.split('-').reverse().join('/')}. Mỗi ngày chỉ được xếp một ca.`, 409);
        }
    }
    for (const day of days) {
        for (const assignment of Object.values(day.assignments)) {
            for (const uid of assignment.employeeIds) {
                try {
                    await assertEmployeeStoreMembership(caller.db, users.get(uid)!, storeId, day.date);
                } catch (error) {
                    if (!(error instanceof WorkplaceAccessError)) throw error;
                    throw slotError(`Nhân viên ${employeeName(users, uid)} không còn quan hệ làm việc tại cửa hàng`, day.date, day.shiftId, error.status);
                }
            }
        }
    }
    const affectedDates = [...new Set(days.map(day => day.date))];
    const oldQueries = affectedDates.map(date => caller.db.collection('schedules')
        .where('storeId', '==', storeId).where('date', '==', date));
    const months = [...new Set(days.map(day => day.date.slice(0, 7)))];
    const monthlyChecks = [...allEmployeeIds].flatMap(uid => months.filter(month => days.some(day => day.date.startsWith(month)
        && Object.values(day.assignments).some(assignment => assignment.employeeIds.includes(uid)))).map(month => ({
        uid, month,
        query: caller.db.collection('schedules').where('employeeIds', 'array-contains', uid)
            .where('date', '>=', `${month}-01`).where('date', '<', nextMonthStart(month)),
    })));

    return caller.db.runTransaction(async transaction => {
        const [oldQuerySnapshots, monthlySnapshots] = await Promise.all([
            Promise.all(oldQueries.map(query => transaction.get(query))),
            Promise.all(monthlyChecks.map(check => transaction.get(check.query))),
        ]);
        const oldBySlot = new Map<string, FirebaseFirestore.QueryDocumentSnapshot>();
        oldQuerySnapshots.forEach(snapshot => snapshot.docs.forEach(doc => {
            const data = doc.data(); oldBySlot.set(`${data.date}\u0000${data.shiftId}\u0000${data.counterId}`, doc);
        }));

        // Validate the complete resulting day, including slots omitted from this request.
        const submittedSlots = new Set(days.flatMap(day => Object.keys(day.assignments)
            .map(counterId => `${day.date}\u0000${day.shiftId}\u0000${counterId}`)));
        monthlyChecks.forEach((check, index) => {
            const retained = monthlySnapshots[index].docs.map(doc => doc.data() as ScheduleDoc)
                .filter(schedule => schedule.storeId !== storeId
                    || !submittedSlots.has(`${schedule.date}\u0000${schedule.shiftId}\u0000${schedule.counterId}`));
            const added = days.filter(day => day.date.startsWith(check.month)
                && Object.values(day.assignments).some(assignment => assignment.employeeIds.includes(check.uid)))
                .map(day => ({ storeId, date: day.date, shiftId: day.shiftId }));
            const total = assignedShiftKeys([...retained, ...added]).size;
            const user = users.get(check.uid)!;
            const max = monthlyShiftLimit(user.type, check.month, (storeSnapshot.data() as StoreDoc).settings?.monthlyQuotas);
            if (total > max) {
                const slot = days.find(day => day.date.startsWith(check.month)
                    && Object.values(day.assignments).some(assignment => assignment.employeeIds.includes(check.uid)));
                throw new WorkplaceAccessError(`Nhân viên ${user.name || check.uid} vượt định mức ca tháng ${check.month} (${total}/${max})${slot ? `; kiểm tra ${slotLabel(slot.date, slot.shiftId)}` : ''}.`, 409);
            }
        });
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
            const [uid, date] = key.split('\u0000');
            const uniqueShifts = new Set(values.map(value => value.shiftId));
            try {
                assertNoOverlappingShifts(
                    { id: storeSnapshot.id, ...storeSnapshot.data() } as StoreDoc,
                    date,
                    [...uniqueShifts],
                );
            } catch (error) {
                if (!(error instanceof WorkplaceAccessError)) throw error;
                throw new WorkplaceAccessError(`Nhân viên ${employeeName(users, uid)}: ${error.message}`, error.status);
            }
            if (exceedsDailyShiftLimit(uniqueShifts)) {
                throw new WorkplaceAccessError(`Nhân viên ${employeeName(users, uid)} bị xếp ${uniqueShifts.size} ca (${[...uniqueShifts].join(', ')}) ngày ${date.split('-').reverse().join('/')}. Mỗi ngày chỉ được xếp một ca.`, 409);
            }
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
            let allocation;
            try {
                allocation = allocationFromSnapshot(allocationSnapshots[index], item.uid, item.date, storeId);
            } catch (error) {
                if (!(error instanceof WorkplaceAccessError)) throw error;
                const slot = days.find(day => Object.values(day.assignments)
                    .some(assignment => assignment.employeeIds.includes(item.uid))
                    && shiftTouchesDates({ id: storeSnapshot.id, ...storeSnapshot.data() } as StoreDoc, day.date, day.shiftId).includes(item.date));
                throw new WorkplaceAccessError(`Nhân viên ${employeeName(users, item.uid)}: ${error.message}${slot ? ` Kiểm tra ${slotLabel(slot.date, slot.shiftId)}.` : ''}`, error.status);
            }
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
