import 'server-only';

import { FieldPath } from 'firebase-admin/firestore';
import { getAdminDb } from '@/lib/firebase-admin';
import {
    attendanceDeviceEventId,
    attendanceDeviceIdempotencyKey,
    attendanceDeviceLogId,
    attendanceMappingId,
    normalizeDeviceTimestamp,
} from '@/lib/attendance/device-model';
import type { AttendanceDeviceDoc, AttendanceEvent, AttendanceLogDoc, ZkUserDoc } from '@/types';

interface BackfillOptions {
    device: AttendanceDeviceDoc;
    dryRun: boolean;
    limit: number;
    cursor?: string;
}

export async function backfillLegacyAttendance(options: BackfillOptions) {
    const { device, dryRun, limit, cursor } = options;
    const db = getAdminDb();
    const mappingsSnapshot = await db.collection('zkteco_users').get();
    const mappings = mappingsSnapshot.docs.map((snapshot) => ({
        snapshot,
        data: { id: snapshot.id, ...snapshot.data() } as Partial<ZkUserDoc> & Pick<ZkUserDoc, 'id' | 'zk_user_id'>,
    }));
    const compositeMappings = new Map<string, ZkUserDoc>();
    for (const mapping of mappings) {
        if (mapping.data.deviceId === device.deviceId) {
            compositeMappings.set(mapping.data.zk_user_id, mapping.data as ZkUserDoc);
        }
    }

    let copiedMappings = 0;
    const legacyMappings = mappings.filter(({ data }) => !data.deviceId && Boolean(data.zk_user_id));
    if (!dryRun) {
        for (let offset = 0; offset < legacyMappings.length; offset += 400) {
            const batch = db.batch();
            legacyMappings.slice(offset, offset + 400).forEach(({ data }) => {
                const id = attendanceMappingId(device.deviceId, data.zk_user_id);
                const mapping: Omit<ZkUserDoc, 'id'> = {
                    deviceId: device.deviceId,
                    storeId: device.storeId,
                    zk_uid: data.zk_uid ?? 0,
                    zk_name: data.zk_name ?? data.zk_user_id,
                    zk_user_id: data.zk_user_id,
                    status: data.status ?? 'unmapped',
                    mapped_system_uid: data.mapped_system_uid ?? null,
                    mapped_system_name: data.mapped_system_name ?? null,
                    lastSyncedAt: data.lastSyncedAt ?? new Date().toISOString(),
                };
                batch.set(db.collection('zkteco_users').doc(id), mapping, { merge: true });
                compositeMappings.set(data.zk_user_id, { id, ...mapping });
                copiedMappings += 1;
            });
            await batch.commit();
        }
    } else {
        copiedMappings = legacyMappings.length;
        legacyMappings.forEach(({ data }) => {
            const legacy = data as ZkUserDoc;
            compositeMappings.set(data.zk_user_id, {
                ...legacy,
                id: attendanceMappingId(device.deviceId, data.zk_user_id),
                deviceId: device.deviceId,
                storeId: device.storeId,
            });
        });
    }

    let query = db.collection('attendance_logs')
        .orderBy(FieldPath.documentId())
        .limit(limit);
    if (cursor) query = query.startAfter(cursor);
    const logsSnapshot = await query.get();
    const now = new Date().toISOString();
    let migratedLogs = 0;
    let normalizedEvents = 0;
    let skipped = 0;

    for (let offset = 0; offset < logsSnapshot.docs.length; offset += 120) {
        const batch = db.batch();
        for (const snapshot of logsSnapshot.docs.slice(offset, offset + 120)) {
            const old = { id: snapshot.id, ...snapshot.data() } as Partial<AttendanceLogDoc> & {
                id: string;
                zk_user_id?: string;
                timestamp?: string;
            };
            if (old.migrationVersion === 2 || old.deviceId && old.deviceId !== device.deviceId) {
                skipped += 1;
                continue;
            }
            if (!old.zk_user_id || !old.timestamp) {
                skipped += 1;
                continue;
            }
            const normalized = normalizeDeviceTimestamp(old.timestamp);
            if (!normalized) {
                skipped += 1;
                continue;
            }
            const idempotencyKey = attendanceDeviceIdempotencyKey(
                device.deviceId,
                old.zk_user_id,
                normalized.occurredAt,
            );
            const targetLogId = attendanceDeviceLogId(
                device.deviceId,
                old.zk_user_id,
                normalized.occurredAt,
            );
            const mapping = compositeMappings.get(old.zk_user_id);
            const employeeUid = mapping?.status === 'mapped' ? mapping.mapped_system_uid ?? null : null;
            const eventId = employeeUid
                ? attendanceDeviceEventId(device.deviceId, old.zk_user_id, normalized.occurredAt)
                : null;
            const migrated: Omit<AttendanceLogDoc, 'id'> = {
                deviceId: device.deviceId,
                storeId: device.storeId,
                zk_user_id: old.zk_user_id,
                zk_uid: old.zk_uid ?? 0,
                timestamp: old.timestamp,
                status: old.status ?? 0,
                punch: old.punch ?? 0,
                mapped_system_uid: employeeUid,
                idempotencyKey,
                normalizedEventId: eventId,
                migrationVersion: 2,
                migratedToLogId: null,
                syncedAt: old.syncedAt ?? now,
            };
            if (!dryRun) {
                batch.set(db.collection('attendance_logs').doc(targetLogId), migrated, { merge: true });
                if (snapshot.id !== targetLogId) {
                    batch.set(snapshot.ref, {
                        deviceId: device.deviceId,
                        storeId: device.storeId,
                        idempotencyKey,
                        normalizedEventId: eventId,
                        migratedToLogId: targetLogId,
                        migrationVersion: 2,
                    }, { merge: true });
                }
                if (employeeUid && eventId) {
                    const event: AttendanceEvent = {
                        id: eventId,
                        storeId: device.storeId,
                        employeeUid,
                        // CHECK_IN keeps FILO fallback correct until the next live sync recalculates types.
                        eventType: 'CHECK_IN',
                        source: 'MACHINE',
                        method: 'BIOMETRIC',
                        occurredAt: normalized.occurredAt,
                        attendanceDate: normalized.attendanceDate,
                        status: 'ACCEPTED',
                        device: { deviceId: device.deviceId, zkUserId: old.zk_user_id, zkUid: old.zk_uid },
                        idempotencyKey,
                        createdAt: now,
                    };
                    batch.set(db.collection('attendance_events').doc(eventId), event, { merge: true });
                }
            }
            migratedLogs += 1;
            if (employeeUid) normalizedEvents += 1;
        }
        if (!dryRun) await batch.commit();
    }

    const lastDocument = logsSnapshot.docs.at(-1);
    return {
        dryRun,
        deviceId: device.deviceId,
        storeId: device.storeId,
        copiedMappings,
        scanned: logsSnapshot.size,
        migratedLogs,
        normalizedEvents,
        skipped,
        nextCursor: logsSnapshot.size === limit ? lastDocument?.id ?? null : null,
        done: logsSnapshot.size < limit,
    };
}
