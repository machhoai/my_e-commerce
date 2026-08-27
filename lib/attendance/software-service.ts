import 'server-only';

import { createHash } from 'node:crypto';
import type { NextRequest } from 'next/server';
import {
    assertAttendancePermission,
    assertAttendanceStoreAccess,
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
    eventType: AttendanceEventType;
    idempotencyKey: string;
    location?: AttendanceLocationCapture;
}

const hashId = (value: string) => createHash('sha256').update(value).digest('hex');
const dailyStateId = (storeId: string, employeeUid: string, date: string) =>
    hashId(`${storeId}\u0000${employeeUid}\u0000${date}`);
const requestId = (employeeUid: string, idempotencyKey: string) =>
    hashId(`${employeeUid}\u0000${idempotencyKey}`);

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
    const attendanceDate = vietnamAttendanceDate(now);
    const currentIpAddress = getTrustedAttendanceRequestIp(req);
    const storeId = caller.user.storeId ?? '';

    if (!storeId) {
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
    assertAttendanceStoreAccess(caller, storeId);

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
): Promise<{ attendanceDate: string; events: AttendanceEvent[] }> {
    const caller = await requireAttendanceCaller(req);
    assertAttendancePermission(caller, 'action.attendance.punch');
    const storeId = caller.user.storeId ?? '';
    if (!storeId) throw new AttendanceServiceError('Tài khoản chưa được gán vào cửa hàng.', 400, 'NO_STORE');
    assertAttendanceStoreAccess(caller, storeId);

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
    const storeId = caller.user.storeId ?? '';
    if (!storeId) throw new AttendanceServiceError('Tài khoản chưa được gán vào cửa hàng.', 400, 'NO_STORE');
    assertAttendanceStoreAccess(caller, storeId);

    const db = getAdminDb();
    const now = new Date();
    const occurredAt = now.toISOString();
    const attendanceDate = vietnamAttendanceDate(now);
    const currentIpAddress = getTrustedAttendanceRequestIp(req);
    const eventRef = db.collection('attendance_events').doc();
    const stateRef = db.collection('attendance_daily_states').doc(
        dailyStateId(storeId, caller.uid, attendanceDate),
    );
    const policyRef = db.collection('store_attendance_policies').doc(storeId);
    const storeRef = db.collection('stores').doc(storeId);
    const requestRef = db.collection('attendance_event_requests').doc(
        requestId(caller.uid, input.idempotencyKey),
    );

    return db.runTransaction(async (transaction) => {
        const [requestSnapshot, policySnapshot, stateSnapshot, storeSnapshot] =
            await transaction.getAll(requestRef, policyRef, stateRef, storeRef);

        if (requestSnapshot.exists) {
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
            createdAt: occurredAt,
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
