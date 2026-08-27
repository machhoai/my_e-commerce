import 'server-only';

import { getAdminDb } from '@/lib/firebase-admin';
import { fetchZkLogs, fetchZkUsers } from '@/lib/zkteco-worker';
import {
    attendanceDeviceEventId,
    attendanceDeviceIdempotencyKey,
    attendanceDeviceLogId,
    attendanceMappingId,
    normalizeDeviceTimestamp,
} from '@/lib/attendance/device-model';
import type {
    AttendanceDeviceDoc,
    AttendanceEvent,
    AttendanceLogDoc,
    StoreAttendancePolicy,
    ZkUserDoc,
} from '@/types';

export interface DeviceSyncResult {
    deviceId: string;
    storeId: string;
    total: number;
    inserted: number;
    updated: number;
    skippedInvalid: number;
    normalized: number;
    unmapped: number;
}

async function assertMachinePolicy(storeId: string): Promise<void> {
    const snapshot = await getAdminDb().collection('store_attendance_policies').doc(storeId).get();
    const policy = snapshot.exists ? snapshot.data() as StoreAttendancePolicy : null;
    if (!policy?.enabled || policy.sourceMode !== 'MACHINE') {
        throw new Error(`Cửa hàng ${storeId} chưa bật chính sách chấm công bằng máy.`);
    }
}

async function markDeviceSync(
    device: AttendanceDeviceDoc,
    status: 'SUCCESS' | 'ERROR',
    error: string | null,
): Promise<void> {
    await getAdminDb().collection('attendance_devices').doc(device.deviceId).set({
        lastSyncAt: new Date().toISOString(),
        lastSyncStatus: status,
        lastSyncError: error,
    }, { merge: true });
}

export async function syncAttendanceDeviceUsers(device: AttendanceDeviceDoc) {
    const db = getAdminDb();
    await assertMachinePolicy(device.storeId);
    const rawUsers = await fetchZkUsers(device.bridgeEndpoint, device.deviceId);
    const collection = db.collection('zkteco_users');
    const now = new Date().toISOString();
    let inserted = 0;
    let updated = 0;

    for (let offset = 0; offset < rawUsers.length; offset += 400) {
        const chunk = rawUsers.slice(offset, offset + 400);
        const refs = chunk.map((user) => collection.doc(attendanceMappingId(
            device.deviceId,
            user.user_id || String(user.uid),
        )));
        const snapshots = await db.getAll(...refs);
        const batch = db.batch();

        chunk.forEach((user, index) => {
            const zkUserId = user.user_id || String(user.uid);
            const ref = refs[index];
            if (snapshots[index].exists) {
                batch.set(ref, {
                    deviceId: device.deviceId,
                    storeId: device.storeId,
                    zk_uid: user.uid,
                    zk_name: user.name,
                    zk_user_id: zkUserId,
                    lastSyncedAt: now,
                }, { merge: true });
                updated += 1;
                return;
            }
            const document: Omit<ZkUserDoc, 'id'> = {
                deviceId: device.deviceId,
                storeId: device.storeId,
                zk_uid: user.uid,
                zk_name: user.name,
                zk_user_id: zkUserId,
                status: 'unmapped',
                mapped_system_uid: null,
                mapped_system_name: null,
                lastSyncedAt: now,
            };
            batch.set(ref, document);
            inserted += 1;
        });
        await batch.commit();
    }

    return { deviceId: device.deviceId, storeId: device.storeId, inserted, updated, total: rawUsers.length };
}

export async function syncAttendanceDevice(device: AttendanceDeviceDoc): Promise<DeviceSyncResult> {
    const db = getAdminDb();
    try {
        await assertMachinePolicy(device.storeId);
        const [rawLogs, mappingSnapshot] = await Promise.all([
            fetchZkLogs(device.bridgeEndpoint, device.deviceId),
            db.collection('zkteco_users').where('deviceId', '==', device.deviceId).get(),
        ]);
        const mappingByUserId = new Map<string, ZkUserDoc>();
        mappingSnapshot.docs.forEach((snapshot) => {
            const mapping = { id: snapshot.id, ...snapshot.data() } as ZkUserDoc;
            if (mapping.storeId === device.storeId) mappingByUserId.set(mapping.zk_user_id, mapping);
        });

        const candidates = rawLogs.flatMap((log) => {
            const zkUserId = log.user_id || String(log.uid);
            const normalized = normalizeDeviceTimestamp(log.timestamp);
            if (!normalized) return [];
            return [{ log, zkUserId, ...normalized }];
        }).sort((a, b) => a.occurredAt.localeCompare(b.occurredAt));
        const firstPunchByDay = new Set<string>();
        const eventTypeById = new Map<string, AttendanceEvent['eventType']>();
        for (const candidate of candidates) {
            const dayKey = `${candidate.zkUserId}|${candidate.attendanceDate}`;
            const eventId = attendanceDeviceEventId(device.deviceId, candidate.zkUserId, candidate.occurredAt);
            eventTypeById.set(eventId, firstPunchByDay.has(dayKey) ? 'CHECK_OUT' : 'CHECK_IN');
            firstPunchByDay.add(dayKey);
        }

        let inserted = 0;
        let updated = 0;
        let normalizedCount = 0;
        let unmapped = 0;
        const now = new Date().toISOString();
        const logsCollection = db.collection('attendance_logs');
        const eventsCollection = db.collection('attendance_events');

        for (let offset = 0; offset < candidates.length; offset += 200) {
            const chunk = candidates.slice(offset, offset + 200);
            const logRefs = chunk.map((candidate) => logsCollection.doc(attendanceDeviceLogId(
                device.deviceId,
                candidate.zkUserId,
                candidate.occurredAt,
            )));
            const existingLogs = await db.getAll(...logRefs);
            const batch = db.batch();

            chunk.forEach((candidate, index) => {
                const mapping = mappingByUserId.get(candidate.zkUserId);
                const employeeUid = mapping?.status === 'mapped' ? mapping.mapped_system_uid ?? null : null;
                const eventId = employeeUid
                    ? attendanceDeviceEventId(device.deviceId, candidate.zkUserId, candidate.occurredAt)
                    : null;
                const idempotencyKey = attendanceDeviceIdempotencyKey(
                    device.deviceId,
                    candidate.zkUserId,
                    candidate.occurredAt,
                );
                const rawTimestamp = candidate.log.timestamp.trim().replace(' ', 'T');
                const logDocument: Omit<AttendanceLogDoc, 'id'> = {
                    deviceId: device.deviceId,
                    storeId: device.storeId,
                    zk_user_id: candidate.zkUserId,
                    zk_uid: candidate.log.uid,
                    timestamp: rawTimestamp,
                    status: candidate.log.status,
                    punch: candidate.log.punch as AttendanceLogDoc['punch'],
                    mapped_system_uid: employeeUid,
                    idempotencyKey,
                    normalizedEventId: eventId,
                    syncedAt: now,
                };
                batch.set(logRefs[index], logDocument, { merge: true });
                if (existingLogs[index].exists) updated += 1;
                else inserted += 1;

                if (!employeeUid || !eventId) {
                    unmapped += 1;
                    return;
                }
                const event: AttendanceEvent = {
                    id: eventId,
                    storeId: device.storeId,
                    employeeUid,
                    eventType: eventTypeById.get(eventId) ?? 'CHECK_OUT',
                    source: 'MACHINE',
                    method: 'BIOMETRIC',
                    occurredAt: candidate.occurredAt,
                    attendanceDate: candidate.attendanceDate,
                    status: 'ACCEPTED',
                    device: {
                        deviceId: device.deviceId,
                        zkUserId: candidate.zkUserId,
                        zkUid: candidate.log.uid,
                    },
                    idempotencyKey,
                    createdAt: now,
                };
                batch.set(eventsCollection.doc(eventId), event, { merge: true });
                normalizedCount += 1;
            });
            await batch.commit();
        }

        const result = {
            deviceId: device.deviceId,
            storeId: device.storeId,
            total: rawLogs.length,
            inserted,
            updated,
            skippedInvalid: rawLogs.length - candidates.length,
            normalized: normalizedCount,
            unmapped,
        };
        await markDeviceSync(device, 'SUCCESS', null);
        return result;
    } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        await markDeviceSync(device, 'ERROR', message.slice(0, 1_000)).catch(() => undefined);
        throw error;
    }
}

export async function getActiveAttendanceDevices(storeId?: string): Promise<AttendanceDeviceDoc[]> {
    const snapshot = await getAdminDb().collection('attendance_devices').get();
    return snapshot.docs
        .map((document) => ({ id: document.id, ...document.data() } as AttendanceDeviceDoc))
        .filter((device) => device.isActive && (!storeId || device.storeId === storeId));
}
