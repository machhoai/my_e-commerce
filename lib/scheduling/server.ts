import 'server-only';

import type { Firestore, Transaction } from 'firebase-admin/firestore';
import type { EmployeeDayAllocation, StoreDoc, UserDoc } from '@/types';
import type { WorkplaceCaller } from '@/lib/workplace/access';
import { assertPermission, WorkplaceAccessError } from '@/lib/workplace/access';
import { employeeDayAllocationId } from '@/lib/workplace/keys';
import { getManagedStoreIds, userHasWorkplace } from '@/lib/workplace/server';

export function businessDateInstant(date: string): Date {
    return new Date(`${date}T12:00:00+07:00`);
}

function shiftInterval(store: StoreDoc, date: string, shiftId: string): [number, number] | null {
    const ruleSet = store.settings?.attendanceRules?.byShift?.[shiftId];
    if (!ruleSet) return null;
    const special = ruleSet.specialDates?.[date];
    const weekend = [0, 6].includes(new Date(`${date}T00:00:00`).getDay());
    const rule = special || (weekend ? ruleSet.defaultWeekend : ruleSet.defaultWeekday);
    const parse = (value: string) => { const [hour, minute] = value.split(':').map(Number); return hour * 60 + minute; };
    const start = parse(rule.startTime); let end = parse(rule.endTime); if (end <= start) end += 24 * 60;
    return [start, end];
}

export function shiftTouchesDates(store: StoreDoc, date: string, shiftId: string): string[] {
    const interval = shiftInterval(store, date, shiftId);
    if (!interval || interval[1] <= 24 * 60) return [date];
    const next = new Date(`${date}T12:00:00+07:00`);
    next.setDate(next.getDate() + 1);
    return [date, next.toLocaleDateString('sv-SE', { timeZone: 'Asia/Ho_Chi_Minh' })];
}

export function assertNoOverlappingShifts(store: StoreDoc, date: string, shiftIds: string[]) {
    if (shiftIds.length <= 1) return;
    const intervals = shiftIds.map(shiftId => ({ shiftId, interval: shiftInterval(store, date, shiftId) }));
    if (intervals.some(item => !item.interval)) {
        throw new WorkplaceAccessError('Cửa hàng phải cấu hình đầy đủ giờ bắt đầu/kết thúc trước khi xếp nhiều ca trong một ngày.', 409);
    }
    for (let left = 0; left < intervals.length; left += 1) {
        for (let right = left + 1; right < intervals.length; right += 1) {
            const a = intervals[left].interval!; const b = intervals[right].interval!;
            if (Math.max(a[0], b[0]) < Math.min(a[1], b[1])) {
                throw new WorkplaceAccessError(`Ca ${intervals[left].shiftId} và ${intervals[right].shiftId} bị trùng giờ ngày ${date}.`, 409);
            }
        }
    }
}

export async function assertEmployeeStoreMembership(
    db: Firestore,
    user: UserDoc,
    storeId: string,
    date: string,
) {
    if (!(await userHasWorkplace(db, user, 'STORE', storeId, businessDateInstant(date)))) {
        throw new WorkplaceAccessError('Nhân viên không có quan hệ làm việc tại cửa hàng vào ngày này.', 403);
    }
}

export async function assertCanManageStore(caller: WorkplaceCaller, storeId: string) {
    assertPermission(caller, 'action.schedule.edit');
    if (!caller.isAdmin && !(await getManagedStoreIds(caller.db, caller.user)).has(storeId)) {
        throw new WorkplaceAccessError('Bạn không có quyền xếp lịch tại cửa hàng này.', 403);
    }
}

export async function getTargetUser(db: Firestore, uid: string): Promise<UserDoc> {
    const snapshot = await db.collection('users').doc(uid).get();
    if (!snapshot.exists) throw new WorkplaceAccessError('Không tìm thấy nhân viên.', 404);
    const user = { uid, ...snapshot.data() } as UserDoc;
    if (user.isActive === false) throw new WorkplaceAccessError('Tài khoản nhân viên đã bị vô hiệu hóa.', 409);
    return user;
}

export function allocationRef(db: Firestore, userId: string, date: string) {
    return db.collection('employee_day_allocations').doc(employeeDayAllocationId(userId, date));
}

export function allocationFromSnapshot(
    snapshot: FirebaseFirestore.DocumentSnapshot,
    userId: string,
    date: string,
    storeId: string,
): EmployeeDayAllocation {
    if (!snapshot.exists) {
        return {
            id: employeeDayAllocationId(userId, date), userId, date, storeId,
            registrationIds: [], scheduleIds: [], attendanceStateIds: [], updatedAt: new Date().toISOString(),
        };
    }
    const value = { id: snapshot.id, ...snapshot.data() } as EmployeeDayAllocation;
    if (value.storeId !== storeId) {
        throw new WorkplaceAccessError(
            `Nhân viên đã đăng ký hoặc được phân công tại cửa hàng khác vào ngày ${date}.`,
            409,
        );
    }
    return value;
}

export function writeAllocation(
    transaction: Transaction,
    ref: FirebaseFirestore.DocumentReference,
    allocation: EmployeeDayAllocation,
) {
    const hasReferences = allocation.registrationIds.length > 0
        || allocation.scheduleIds.length > 0
        || (allocation.attendanceStateIds?.length || 0) > 0;
    if (hasReferences) transaction.set(ref, { ...allocation, updatedAt: new Date().toISOString() });
    else transaction.delete(ref);
}
