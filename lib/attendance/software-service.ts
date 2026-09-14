import 'server-only';

import { createHash } from 'node:crypto';
import type { NextRequest } from 'next/server';
import {
    assertAttendancePermission,
    AttendanceAccessError,
    requireAttendanceCaller,
} from '@/lib/attendance/access';
import {
    evaluateGpsVerification,
    evaluateIpVerification,
    type AttendanceLocationCapture,
    type AttendanceVerificationDecision,
} from '@/lib/attendance/policy';
import { getTrustedAttendanceRequestIp } from '@/lib/attendance/request-ip';
import { getNextAttendanceEventType, isAttendanceEventExpected, vietnamAttendanceDate } from '@/lib/attendance/state';
import { getAdminDb } from '@/lib/firebase-admin';
import type {
    AttendanceDailyState,
    AttendanceEvent,
    AttendanceEventType,
    SoftwareAttendanceContext,
    StoreAttendancePolicy,
    StoreDoc,
} from '@/types';
import { getUserStoreIds, userHasWorkplace } from '@/lib/workplace/server';
import { allocationFromSnapshot, allocationRef, writeAllocation } from '@/lib/scheduling/server';

export class AttendanceServiceError extends Error {
    constructor(
        message: string,
        public readonly status: number,
        public readonly reason?: string,
    ) {
        super(message);
        this.name = 'AttendanceServiceError';
    }
}

export interface AttendancePunchInput {
    storeId?: string;
    eventType: AttendanceEventType;
    idempotencyKey: string;
    location?: AttendanceLocationCapture;
}

async function resolveAttendanceStoreId(
    caller: Awaited<ReturnType<typeof requireAttendanceCaller>>,
    requested: string | undefined,
    attendanceDate: string,
) {
    const allocationSnapshot = await allocationRef(getAdminDb(), caller.uid, attendanceDate).get();
    const allocatedStoreId = allocationSnapshot.exists
        ? allocationSnapshot.data()?.storeId as string | undefined
        : undefined;
    if (allocatedStoreId) return allocatedStoreId;
    if (requested) {
        if (!caller.isAdmin && !(await userHasWorkplace(getAdminDb(), caller.user, 'STORE', requested))) {
            throw new AttendanceServiceError('Bạn không có quan hệ làm việc tại cửa hàng này.', 403, 'STORE_ACCESS_DENIED');
        }
        return requested;
    }
    const ids = await getUserStoreIds(getAdminDb(), caller.user);
    if (ids.length === 1) return ids[0];
    if (ids.length > 1) throw new AttendanceServiceError('Vui lòng chọn cửa hàng trước khi chấm công.', 400, 'STORE_REQUIRED');
    throw new AttendanceServiceError('Tài khoản chưa được gán vào cửa hàng.', 400, 'NO_STORE');
}

const hashId = (value: string) => createHash('sha256').update(value).digest('hex');
const dailyStateId = (storeId: string, employeeUid: string, date: string) =>
    hashId(`${storeId}\u0000${employeeUid}\u0000${date}`);
const requestId = (employeeUid: string, idempotencyKey: string) =>
    hashId(`${employeeUid}\u0000${idempotencyKey}`);

async function previousOpenAttendanceDate(userId: string, nominalDate: string): Promise<string | null> {
    const previous = new Date(`${nominalDate}T00:00:00+07:00`);
    previous.setDate(previous.getDate() - 1);
    const date = previous.toLocaleDateString('sv-SE', { timeZone: 'Asia/Ho_Chi_Minh' });
    const db = getAdminDb();
    const allocation = await allocationRef(db, userId, date).get();
    const storeId = allocation.data()?.storeId as string | undefined;
    if (!storeId) return null;
    const state = await db.collection('attendance_daily_states').doc(dailyStateId(storeId, userId, date)).get();
    return state.exists && state.data()?.checkInEventId && !state.data()?.checkOutEventId ? date : null;
}

async function loadStateEvents(state: AttendanceDailyState | null): Promise<AttendanceEvent[]> {
    const eventIds = [state?.checkInEventId, state?.checkOutEventId].filter(
        (value): value is string => Boolean(value),
    );
    if (eventIds.length === 0) return [];

    const db = getAdminDb();
    const snapshots = await db.getAll(
        ...eventIds.map((eventId) => db.collection('attendance_events').doc(eventId)),
    );
    return snapshots
        .filter((snapshot) => snapshot.exists)
        .map((snapshot) => snapshot.data() as AttendanceEvent)
        .sort((a, b) => a.occurredAt.localeCompare(b.occurredAt));
}

function contextMessage(reason: SoftwareAttendanceContext['reason'], next: AttendanceEventType | null) {
    switch (reason) {
        case 'NO_STORE':
            return 'Tài khoản chưa được gán vào cửa hàng.';
        case 'POLICY_NOT_CONFIGURED':
            return 'Cửa hàng chưa cấu hình chấm công.';
        case 'POLICY_DISABLED':
            return 'Cửa hàng đang tắt chức năng chấm công.';
        case 'MACHINE_ONLY':
            return 'Cửa hàng này sử dụng máy chấm công.';
        case 'IP_NOT_ALLOWED':
            return 'Thiết bị chưa kết nối đúng mạng Internet của cửa hàng.';
        case 'COMPLETED':
            return 'Bạn đã hoàn tất chấm công hôm nay.';
        case 'READY':
            return next === 'CHECK_OUT' ? 'Sẵn sàng chấm công ra.' : 'Sẵn sàng chấm công vào.';
    }
}

export async function getSoftwareAttendanceContext(
    req: NextRequest,
): Promise<SoftwareAttendanceContext> {
    const caller = await requireAttendanceCaller(req);
    assertAttendancePermission(caller, 'action.attendance.punch');

    const now = new Date();
    const serverTime = now.toISOString();
    let attendanceDate = vietnamAttendanceDate(now);
    attendanceDate = await previousOpenAttendanceDate(caller.uid, attendanceDate) || attendanceDate;
    const currentIpAddress = getTrustedAttendanceRequestIp(req);
    let storeId = '';
    try {
        storeId = await resolveAttendanceStoreId(caller, req.nextUrl.searchParams.get('storeId') || undefined, attendanceDate);
    } catch (error) {
        if (!(error instanceof AttendanceServiceError) || error.reason !== 'NO_STORE') throw error;
        return {
            canPunch: false,
            reason: 'NO_STORE',
            message: contextMessage('NO_STORE', null),
            attendanceDate,
            serverTime,
            nextEventType: null,
            locationRequired: false,
            currentIpAddress,
            isIpAllowed: null,
            store: null,
            policy: null,
            todayEvents: [],
        };
    }
    const db = getAdminDb();
    const [storeSnapshot, policySnapshot, stateSnapshot] = await Promise.all([
        db.collection('stores').doc(storeId).get(),
        db.collection('store_attendance_policies').doc(storeId).get(),
        db.collection('attendance_daily_states').doc(dailyStateId(storeId, caller.uid, attendanceDate)).get(),
    ]);
    const store = storeSnapshot.exists
        ? ({ id: storeSnapshot.id, ...storeSnapshot.data() } as StoreDoc)
        : null;
    const policy = policySnapshot.exists
        ? (policySnapshot.data() as StoreAttendancePolicy)
        : null;
    const state = stateSnapshot.exists
        ? (stateSnapshot.data() as AttendanceDailyState)
        : null;
    const todayEvents = await loadStateEvents(state);
    const nextEventType = policy
        ? getNextAttendanceEventType(state, policy.requireCheckOut)
        : null;
    const contextPolicy = policy
        ? {
            enabled: policy.enabled,
            sourceMode: policy.sourceMode,
            verificationMethod: policy.verificationMethod,
            requireCheckOut: policy.requireCheckOut,
            gps: policy.gps,
        }
        : null;
    const contextStore = store
        ? { id: store.id, name: store.name, coordinate: store.coordinate }
        : null;

    let reason: SoftwareAttendanceContext['reason'] = 'READY';
    let isIpAllowed: boolean | null = null;
    if (!store) reason = 'NO_STORE';
    else if (!policy) reason = 'POLICY_NOT_CONFIGURED';
    else if (!policy.enabled) reason = 'POLICY_DISABLED';
    else if (policy.sourceMode === 'MACHINE') reason = 'MACHINE_ONLY';
    else if (!policy.verificationMethod || (policy.verificationMethod === 'GPS' && !policy.gps)) {
        reason = 'POLICY_NOT_CONFIGURED';
    }
    else if (!nextEventType) reason = 'COMPLETED';
    else if (policy.verificationMethod === 'IP') {
        isIpAllowed = evaluateIpVerification(currentIpAddress, policy.allowedIpAddresses).accepted;
        if (!isIpAllowed) reason = 'IP_NOT_ALLOWED';
    }

    return {
        canPunch: reason === 'READY',
        reason,
        message: contextMessage(reason, nextEventType),
        attendanceDate,
        serverTime,
        nextEventType,
        locationRequired: reason === 'READY' && policy?.verificationMethod === 'GPS',
        currentIpAddress,
        isIpAllowed,
        store: contextStore,
        policy: contextPolicy,
        todayEvents,
    };
}

export async function getPersonalAttendanceEvents(
    req: NextRequest,
    attendanceDate = vietnamAttendanceDate(),
    requestedStoreId?: string,
): Promise<{ attendanceDate: string; events: AttendanceEvent[] }> {
    const caller = await requireAttendanceCaller(req);
    assertAttendancePermission(caller, 'action.attendance.punch');
    const storeId = await resolveAttendanceStoreId(caller, requestedStoreId, attendanceDate);

    const stateSnapshot = await getAdminDb()
        .collection('attendance_daily_states')
        .doc(dailyStateId(storeId, caller.uid, attendanceDate))
        .get();
    const state = stateSnapshot.exists
        ? (stateSnapshot.data() as AttendanceDailyState)
        : null;
    return { attendanceDate, events: await loadStateEvents(state) };
}

function assertSoftwarePolicy(
    policy: StoreAttendancePolicy | null,
): asserts policy is StoreAttendancePolicy & {
    sourceMode: 'SOFTWARE';
    verificationMethod: 'GPS' | 'IP';
} {
    if (!policy) throw new AttendanceServiceError('Cửa hàng chưa cấu hình chấm công.', 403, 'POLICY_NOT_CONFIGURED');
    if (!policy.enabled) throw new AttendanceServiceError('Cửa hàng đang tắt chức năng chấm công.', 403, 'POLICY_DISABLED');
    if (policy.sourceMode !== 'SOFTWARE') {
        throw new AttendanceServiceError('Cửa hàng này sử dụng máy chấm công.', 403, 'MACHINE_ONLY');
    }
    if (!policy.verificationMethod || (policy.verificationMethod === 'GPS' && !policy.gps)) {
        throw new AttendanceServiceError('Cấu hình chấm công chưa đầy đủ.', 403, 'POLICY_NOT_CONFIGURED');
    }
}

function assertVerificationAccepted(decision: AttendanceVerificationDecision): void {
    if (!decision.accepted) {
        const messages: Record<string, string> = {
            LOCATION_REQUIRED: 'Không lấy được vị trí để chấm công.',
            GPS_ACCURACY_LOW: 'Độ chính xác GPS chưa đạt yêu cầu.',
            GPS_STALE: 'Vị trí GPS đã quá cũ, vui lòng lấy lại vị trí.',
            OUTSIDE_GEOFENCE: 'Bạn đang ở ngoài phạm vi chấm công của cửa hàng.',
            IP_REQUIRED: 'Không xác định được địa chỉ mạng của thiết bị.',
            INVALID_IP: 'Thiết bị chưa kết nối đúng mạng Internet của cửa hàng.',
        };
        throw new AttendanceServiceError(
            messages[decision.reason ?? ''] ?? 'Không thể xác minh điều kiện chấm công.',
            403,
            decision.reason ?? undefined,
        );
    }
}

export async function punchSoftwareAttendance(
    req: NextRequest,
    input: AttendancePunchInput,
): Promise<{ event: AttendanceEvent; created: boolean }> {
    const caller = await requireAttendanceCaller(req);
    assertAttendancePermission(caller, 'action.attendance.punch');
    const db = getAdminDb();
    const preflightRequestRef = db.collection('attendance_event_requests').doc(requestId(caller.uid, input.idempotencyKey));
    const preflightRequest = await preflightRequestRef.get();
    if (preflightRequest.exists) {
        const data = preflightRequest.data()!;
        if (data.eventType !== input.eventType || (input.storeId && data.storeId !== input.storeId)) {
            throw new AttendanceServiceError('Mã yêu cầu đã được dùng cho một thao tác khác.', 409, 'IDEMPOTENCY_CONFLICT');
        }
        const event = data.eventId ? await db.collection('attendance_events').doc(data.eventId).get() : null;
        if (!event?.exists) throw new AttendanceServiceError('Không tìm thấy sự kiện chấm công đã tạo.', 409, 'EVENT_NOT_FOUND');
        return { event: event.data() as AttendanceEvent, created: false };
    }
    const now = new Date();
    const occurredAt = now.toISOString();
    let attendanceDate = vietnamAttendanceDate(now);
    if (input.eventType === 'CHECK_OUT') {
        attendanceDate = await previousOpenAttendanceDate(caller.uid, attendanceDate) || attendanceDate;
    }
    const storeId = await resolveAttendanceStoreId(caller, input.storeId, attendanceDate);
    const currentIpAddress = getTrustedAttendanceRequestIp(req);
    const eventRef = db.collection('attendance_events').doc();
    const stateRef = db.collection('attendance_daily_states').doc(
        dailyStateId(storeId, caller.uid, attendanceDate),
    );
    const policyRef = db.collection('store_attendance_policies').doc(storeId);
    const storeRef = db.collection('stores').doc(storeId);
    const requestRef = preflightRequestRef;
    const dayRef = allocationRef(db, caller.uid, attendanceDate);

    return db.runTransaction(async (transaction) => {
        const [requestSnapshot, policySnapshot, stateSnapshot, storeSnapshot, daySnapshot] =
            await transaction.getAll(requestRef, policyRef, stateRef, storeRef, dayRef);

        if (requestSnapshot.exists) {
            if (requestSnapshot.data()?.storeId !== storeId || requestSnapshot.data()?.eventType !== input.eventType) {
                throw new AttendanceServiceError('Mã yêu cầu đã được dùng cho một thao tác khác.', 409, 'IDEMPOTENCY_CONFLICT');
            }
            const existingEventId = requestSnapshot.data()?.eventId as string | undefined;
            if (!existingEventId) {
                throw new AttendanceServiceError('Yêu cầu chấm công cũ không hợp lệ.', 409, 'INVALID_REQUEST_STATE');
            }
            const existingEventSnapshot = await transaction.get(
                db.collection('attendance_events').doc(existingEventId),
            );
            if (!existingEventSnapshot.exists) {
                throw new AttendanceServiceError('Không tìm thấy sự kiện chấm công đã tạo.', 409, 'EVENT_NOT_FOUND');
            }
            return { event: existingEventSnapshot.data() as AttendanceEvent, created: false };
        }

        if (!storeSnapshot.exists) {
            throw new AttendanceServiceError('Không tìm thấy cửa hàng.', 404, 'STORE_NOT_FOUND');
        }
        const policy = policySnapshot.exists
            ? (policySnapshot.data() as StoreAttendancePolicy)
            : null;
        assertSoftwarePolicy(policy);

        const state = stateSnapshot.exists
            ? (stateSnapshot.data() as AttendanceDailyState)
            : null;
        const allocation = allocationFromSnapshot(daySnapshot, caller.uid, attendanceDate, storeId);
        if (!isAttendanceEventExpected(input.eventType, state, policy.requireCheckOut)) {
            const nextEventType = getNextAttendanceEventType(state, policy.requireCheckOut);
            throw new AttendanceServiceError(
                nextEventType
                    ? `Thao tác hiện tại phải là ${nextEventType === 'CHECK_IN' ? 'chấm công vào' : 'chấm công ra'}.`
                    : 'Bạn đã hoàn tất chấm công hôm nay.',
                409,
                'EVENT_SEQUENCE_CONFLICT',
            );
        }

        const verification = policy.verificationMethod === 'GPS'
            ? evaluateGpsVerification(input.location, policy.gps!, now)
            : evaluateIpVerification(currentIpAddress, policy.allowedIpAddresses);
        assertVerificationAccepted(verification);

        const event: AttendanceEvent = {
            id: eventRef.id,
            storeId,
            employeeUid: caller.uid,
            eventType: input.eventType,
            source: 'SOFTWARE',
            method: policy.verificationMethod,
            occurredAt,
            attendanceDate,
            status: 'ACCEPTED',
            idempotencyKey: input.idempotencyKey,
            createdAt: occurredAt,
            ...(input.location ? { clientCapturedAt: input.location.capturedAt } : {}),
            verification: policy.verificationMethod === 'GPS'
                ? {
                    latitude: input.location!.latitude,
                    longitude: input.location!.longitude,
                    accuracyM: input.location!.accuracyM,
                    distanceM: verification.distanceM!,
                }
                : { ipAddress: verification.matchedIpAddress! },
        };
        const nextState: AttendanceDailyState = {
            id: stateRef.id,
            storeId,
            employeeUid: caller.uid,
            attendanceDate,
            checkInEventId: input.eventType === 'CHECK_IN' ? event.id : state?.checkInEventId ?? null,
            checkOutEventId: input.eventType === 'CHECK_OUT' ? event.id : state?.checkOutEventId ?? null,
            updatedAt: occurredAt,
        };

        transaction.create(eventRef, event);
        transaction.set(stateRef, nextState);
        transaction.create(requestRef, {
            employeeUid: caller.uid,
            storeId,
            eventId: event.id,
            idempotencyKey: input.idempotencyKey,
            eventType: input.eventType,
            createdAt: occurredAt,
        });
        writeAllocation(transaction, dayRef, {
            ...allocation,
            attendanceStateIds: [...new Set([...(allocation.attendanceStateIds || []), stateRef.id])],
        });

        return { event, created: true };
    });
}

export function attendanceServiceErrorResponse(error: unknown): Response | null {
    if (error instanceof AttendanceAccessError) {
        return Response.json({ error: error.message }, { status: error.status });
    }
    if (!(error instanceof AttendanceServiceError)) return null;
    return Response.json(
        { error: error.message, reason: error.reason ?? null },
        { status: error.status },
    );
}
