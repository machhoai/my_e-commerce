import 'server-only';

import type { NextRequest } from 'next/server';
import {
    assertAttendancePermission,
    assertAttendanceStoreAccess,
    requireAttendanceCaller,
} from '@/lib/attendance/access';
import { getAdminDb } from '@/lib/firebase-admin';
import {
    parseAttendanceRange,
    resolveAcceptedAttendanceTimes,
    selectAttendanceRosterUids,
} from '@/lib/attendance/manager-model';
import type {
    AttendanceEvent,
    AttendanceEventMethod,
    AttendanceEventSource,
    AttendanceHistoryEvent,
    AttendanceHistoryGroup,
    AttendanceLogDoc,
    AttendanceManagerEmployee,
    AttendanceManagerResponse,
    DailyAttendance,
    ScheduleDoc,
    SettingsDoc,
    StoreAttendancePolicy,
    StoreDoc,
    UserDoc,
    ZkUserDoc,
} from '@/types';

export class AttendanceManagerError extends Error {
    constructor(message: string, public readonly status: number) {
        super(message);
        this.name = 'AttendanceManagerError';
    }
}

export function resolveAttendanceRange(date: string | null, month: string | null) {
    const range = parseAttendanceRange(date, month);
    if (range) return range;
    throw new AttendanceManagerError('Cần truyền date=YYYY-MM-DD hoặc month=YYYY-MM.', 400);
}

function datesInRange(startDate: string, endDate: string): string[] {
    const dates: string[] = [];
    const cursor = new Date(`${startDate}T00:00:00Z`);
    const end = new Date(`${endDate}T00:00:00Z`);
    while (cursor <= end) {
        dates.push(cursor.toISOString().slice(0, 10));
        cursor.setUTCDate(cursor.getUTCDate() + 1);
    }
    return dates;
}

function toEmployee(user: UserDoc, storeId: string): AttendanceManagerEmployee {
    return {
        uid: user.uid,
        name: user.name,
        phone: user.phone,
        role: user.role,
        type: user.type,
        isActive: user.isActive,
        storeId,
        ...(user.avatar ? { avatar: user.avatar } : {}),
        ...(user.jobTitle ? { jobTitle: user.jobTitle } : {}),
    };
}

function emptySettings(storeId: string, store: StoreDoc): SettingsDoc {
    return {
        id: storeId,
        registrationOpen: store.settings?.registrationOpen ?? false,
        strictShiftLimit: store.settings?.strictShiftLimit,
        maxShiftsPerDay: store.settings?.maxShiftsPerDay,
        referralEnabled: store.settings?.referralEnabled,
        shiftTimes: store.settings?.shiftTimes?.length ? store.settings.shiftTimes : ['Ca 1'],
        quotas: store.settings?.quotas,
        monthlyQuotas: store.settings?.monthlyQuotas,
        registrationSchedule: store.settings?.registrationSchedule,
        attendanceRules: store.settings?.attendanceRules,
    };
}

function uniqueSorted<T extends string>(values: T[]): T[] {
    return Array.from(new Set(values)).sort() as T[];
}

interface NormalizedPunch {
    id: string;
    employeeUid: string;
    occurredAt: string;
    date: string;
    source: AttendanceEventSource;
    method: AttendanceEventMethod;
    eventType: 'CHECK_IN' | 'CHECK_OUT' | 'PUNCH';
    status: 'ACCEPTED' | 'REJECTED';
    rejectedReason?: string;
    zkUserId?: string;
}

function aggregateDaily(
    employee: AttendanceManagerEmployee,
    date: string,
    punches: NormalizedPunch[],
    shiftIds: string[],
    zkUserId: string,
): DailyAttendance {
    const { checkIn, checkOut, acceptedCount } = resolveAcceptedAttendanceTimes(punches);
    const accepted = punches.filter((event) => event.status === 'ACCEPTED');

    return {
        zk_user_id: zkUserId,
        storeId: employee.storeId,
        employeeUid: employee.uid,
        mapped_system_uid: employee.uid,
        mapped_system_name: employee.name,
        zk_name: employee.name,
        date,
        checkIn,
        checkOut,
        punchCount: acceptedCount,
        scheduled: shiftIds.length > 0,
        scheduledShiftId: shiftIds[0] ?? null,
        scheduledShiftIds: shiftIds,
        absence: shiftIds.length > 0 && !checkIn,
        sources: uniqueSorted(accepted.map((event) => event.source)),
        methods: uniqueSorted(accepted.map((event) => event.method)),
    };
}

async function loadManagerData(storeId: string, startDate: string, endDate: string) {
    const db = getAdminDb();
    const startTimestamp = `${startDate}T00:00:00`;
    const endTimestamp = `${endDate}T23:59:59.999`;
    const [storeSnapshot, policySnapshot, usersSnapshot, schedulesSnapshot, eventsSnapshot, logsSnapshot, zkSnapshot] =
        await Promise.all([
            db.collection('stores').doc(storeId).get(),
            db.collection('store_attendance_policies').doc(storeId).get(),
            db.collection('users').where('storeId', '==', storeId).get(),
            db.collection('schedules').where('date', '>=', startDate).where('date', '<=', endDate).get(),
            db.collection('attendance_events').where('attendanceDate', '>=', startDate).where('attendanceDate', '<=', endDate).get(),
            db.collection('attendance_logs').where('timestamp', '>=', startTimestamp).where('timestamp', '<=', endTimestamp).get(),
            db.collection('zkteco_users').get(),
        ]);

    if (!storeSnapshot.exists) throw new AttendanceManagerError('Không tìm thấy cửa hàng.', 404);
    const store = { id: storeSnapshot.id, ...storeSnapshot.data() } as StoreDoc;
    const policy = policySnapshot.exists ? policySnapshot.data() as StoreAttendancePolicy : null;
    const employees = usersSnapshot.docs
        .map((snapshot) => ({ ...snapshot.data(), uid: snapshot.id } as UserDoc))
        .filter((user) => user.isActive !== false && user.role !== 'admin' && user.role !== 'super_admin')
        .map((user) => toEmployee(user, storeId))
        .sort((a, b) => a.name.localeCompare(b.name, 'vi'));
    const employeeByUid = new Map(employees.map((employee) => [employee.uid, employee]));
    const schedules = schedulesSnapshot.docs
        .map((snapshot) => snapshot.data() as ScheduleDoc)
        .filter((schedule) => schedule.storeId === storeId);
    const attendanceEvents = eventsSnapshot.docs
        .map((snapshot) => ({ id: snapshot.id, ...snapshot.data() } as AttendanceEvent))
        .filter((event) => event.storeId === storeId && employeeByUid.has(event.employeeUid));
    const zkUsers = zkSnapshot.docs.map((snapshot) => ({ id: snapshot.id, ...snapshot.data() } as ZkUserDoc));
    const zkById = new Map(zkUsers.map((zkUser) => [
        `${zkUser.deviceId ?? ''}|${zkUser.zk_user_id}`,
        zkUser,
    ]));
    const zkByEmployee = new Map<string, ZkUserDoc>();
    for (const zkUser of zkUsers) {
        if (
            (!zkUser.storeId || zkUser.storeId === storeId)
            && zkUser.status === 'mapped'
            && zkUser.mapped_system_uid
            && employeeByUid.has(zkUser.mapped_system_uid)
        ) {
            zkByEmployee.set(zkUser.mapped_system_uid, zkUser);
        }
    }
    const machineLogs = logsSnapshot.docs
        .map((snapshot) => ({ id: snapshot.id, ...snapshot.data() } as AttendanceLogDoc))
        .flatMap((log) => {
            if (log.normalizedEventId || log.migratedToLogId) return [];
            if (log.storeId && log.storeId !== storeId) return [];
            const compositeMapping = zkById.get(`${log.deviceId ?? ''}|${log.zk_user_id}`);
            const legacyMapping = zkUsers.find((mapping) =>
                !mapping.deviceId && mapping.zk_user_id === log.zk_user_id,
            );
            const employeeUid = log.mapped_system_uid
                ?? compositeMapping?.mapped_system_uid
                ?? legacyMapping?.mapped_system_uid;
            if (!employeeUid || !employeeByUid.has(employeeUid)) return [];
            return [{ ...log, employeeUid }];
        });

    return { store, policy, employees, employeeByUid, schedules, attendanceEvents, machineLogs, zkByEmployee };
}

export async function getManagerAttendance(
    req: NextRequest,
    storeId: string,
    date: string | null,
    month: string | null,
): Promise<AttendanceManagerResponse> {
    const caller = await requireAttendanceCaller(req);
    assertAttendancePermission(caller, 'page.hr.attendance');
    assertAttendanceStoreAccess(caller, storeId);
    const range = resolveAttendanceRange(date, month);
    const data = await loadManagerData(storeId, range.startDate, range.endDate);
    const schedulesByDateUid = new Map<string, Set<string>>();
    for (const schedule of data.schedules) {
        for (const employeeUid of schedule.employeeIds ?? []) {
            if (!data.employeeByUid.has(employeeUid)) continue;
            const key = `${schedule.date}|${employeeUid}`;
            if (!schedulesByDateUid.has(key)) schedulesByDateUid.set(key, new Set());
            schedulesByDateUid.get(key)!.add(schedule.shiftId);
        }
    }

    const punchesByDateUid = new Map<string, NormalizedPunch[]>();
    const addPunch = (punch: NormalizedPunch) => {
        const key = `${punch.date}|${punch.employeeUid}`;
        if (!punchesByDateUid.has(key)) punchesByDateUid.set(key, []);
        punchesByDateUid.get(key)!.push(punch);
    };
    for (const event of data.attendanceEvents) {
        addPunch({
            id: event.id,
            employeeUid: event.employeeUid,
            occurredAt: event.occurredAt,
            date: event.attendanceDate,
            source: event.source,
            method: event.method,
            eventType: event.eventType,
            status: event.status,
            rejectedReason: event.rejectedReason,
        });
    }
    for (const log of data.machineLogs) {
        addPunch({
            id: log.id,
            employeeUid: log.employeeUid,
            occurredAt: log.timestamp,
            date: log.timestamp.slice(0, 10),
            source: 'MACHINE',
            method: 'BIOMETRIC',
            eventType: 'PUNCH',
            status: 'ACCEPTED',
            zkUserId: log.zk_user_id,
        });
    }

    const attendance: DailyAttendance[] = [];
    for (const currentDate of datesInRange(range.startDate, range.endDate)) {
        const scheduledUids = new Set(
            [...schedulesByDateUid.keys()]
                .filter((key) => key.startsWith(`${currentDate}|`))
                .map((key) => key.slice(currentDate.length + 1)),
        );
        const punchedUids = new Set(
            [...punchesByDateUid.keys()]
                .filter((key) => key.startsWith(`${currentDate}|`))
                .map((key) => key.slice(currentDate.length + 1)),
        );
        const rosterUids = selectAttendanceRosterUids(
            data.employeeByUid.keys(),
            scheduledUids,
            punchedUids,
        );

        for (const employeeUid of rosterUids) {
            const employee = data.employeeByUid.get(employeeUid);
            if (!employee) continue;
            const key = `${currentDate}|${employeeUid}`;
            const shiftIds = uniqueSorted([...(schedulesByDateUid.get(key) ?? [])]);
            const zkUserId = data.zkByEmployee.get(employeeUid)?.zk_user_id ?? '';
            attendance.push(aggregateDaily(
                employee,
                currentDate,
                punchesByDateUid.get(key) ?? [],
                shiftIds,
                zkUserId,
            ));
        }
    }
    attendance.sort((a, b) => a.date.localeCompare(b.date) || a.zk_name.localeCompare(b.zk_name, 'vi'));

    return {
        store: { id: data.store.id, name: data.store.name, coordinate: data.store.coordinate },
        policy: data.policy,
        settings: emptySettings(storeId, data.store),
        employees: data.employees,
        attendance,
        range,
    };
}

export async function getManagerAttendanceHistory(
    req: NextRequest,
    storeId: string,
    date: string,
): Promise<AttendanceHistoryGroup[]> {
    const caller = await requireAttendanceCaller(req);
    assertAttendancePermission(caller, 'page.hr.attendance');
    assertAttendanceStoreAccess(caller, storeId);
    const range = resolveAttendanceRange(date, null);
    const data = await loadManagerData(storeId, range.startDate, range.endDate);
    const eventsByUid = new Map<string, AttendanceHistoryEvent[]>();
    const addEvent = (event: AttendanceHistoryEvent) => {
        if (!eventsByUid.has(event.employeeUid)) eventsByUid.set(event.employeeUid, []);
        eventsByUid.get(event.employeeUid)!.push(event);
    };
    for (const event of data.attendanceEvents) {
        const employee = data.employeeByUid.get(event.employeeUid)!;
        addEvent({
            id: event.id,
            employeeUid: event.employeeUid,
            employeeName: employee.name,
            occurredAt: event.occurredAt,
            eventType: event.eventType,
            source: event.source,
            method: event.method,
            status: event.status,
            rejectedReason: event.rejectedReason,
            zkUserId: event.device?.zkUserId,
        });
    }
    for (const log of data.machineLogs) {
        const employee = data.employeeByUid.get(log.employeeUid)!;
        addEvent({
            id: log.id,
            employeeUid: log.employeeUid,
            employeeName: employee.name,
            occurredAt: log.timestamp,
            eventType: 'PUNCH',
            source: 'MACHINE',
            method: 'BIOMETRIC',
            status: 'ACCEPTED',
            zkUserId: log.zk_user_id,
        });
    }

    return [...eventsByUid.entries()]
        .map(([employeeUid, events]) => ({
            employeeUid,
            employeeName: data.employeeByUid.get(employeeUid)?.name ?? employeeUid,
            zkUserId: data.zkByEmployee.get(employeeUid)?.zk_user_id,
            events: events.sort((a, b) => a.occurredAt.localeCompare(b.occurredAt)),
        }))
        .sort((a, b) => a.employeeName.localeCompare(b.employeeName, 'vi'));
}

export async function getAttendanceStores(req: NextRequest) {
    const caller = await requireAttendanceCaller(req);
    assertAttendancePermission(caller, 'page.hr.attendance');
    const db = getAdminDb();
    const managedStoreIds = [...caller.managedStoreIds];
    const documents = caller.isAdmin
        ? (await db.collection('stores').get()).docs
        : managedStoreIds.length > 0
            ? await db.getAll(...managedStoreIds.map((storeId) => db.collection('stores').doc(storeId)))
            : [];
    return documents
        .filter((document) => document.exists && document.data()?.isActive !== false)
        .map((document) => ({ id: document.id, name: document.data()!.name as string }))
        .sort((a, b) => a.name.localeCompare(b.name, 'vi'));
}
