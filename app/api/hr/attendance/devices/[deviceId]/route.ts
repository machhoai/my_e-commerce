import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { attendanceAccessErrorResponse, requireAttendanceAccess } from '@/lib/attendance/access';
import { attendanceDeviceUpdateSchema } from '@/lib/attendance/device-schema';
import { getAdminDb } from '@/lib/firebase-admin';
import type { AttendanceDeviceDoc, AuditLogDoc } from '@/types';

type RouteContext = { params: Promise<{ deviceId: string }> };

export async function PATCH(req: NextRequest, { params }: RouteContext) {
    try {
        const { deviceId } = await params;
        const input = attendanceDeviceUpdateSchema.parse(await req.json());
        const db = getAdminDb();
        const ref = db.collection('attendance_devices').doc(deviceId);
        const snapshot = await ref.get();
        if (!snapshot.exists) {
            return NextResponse.json({ error: 'Không tìm thấy thiết bị.' }, { status: 404 });
        }
        const previous = { id: snapshot.id, ...snapshot.data() } as AttendanceDeviceDoc;
        const targetStoreId = input.storeId ?? previous.storeId;
        const caller = await requireAttendanceAccess(req, {
            permission: 'hr.attendance.configure',
            storeId: previous.storeId,
        });
        if (targetStoreId !== previous.storeId) {
            await requireAttendanceAccess(req, {
                permission: 'hr.attendance.configure',
                storeId: targetStoreId,
            });
            const storeSnapshot = await db.collection('stores').doc(targetStoreId).get();
            if (!storeSnapshot.exists) {
                return NextResponse.json({ error: 'Không tìm thấy cửa hàng mới.' }, { status: 404 });
            }
        }
        const now = new Date().toISOString();
        const updates = {
            ...input,
            ...(input.bridgeEndpoint ? { bridgeEndpoint: input.bridgeEndpoint.replace(/\/$/, '') } : {}),
            updatedAt: now,
            updatedBy: caller.uid,
        };
        const next = { ...previous, ...updates };
        const auditRef = db.collection('audit_logs').doc();
        const audit: AuditLogDoc = {
            id: auditRef.id,
            action: 'UPDATE_ATTENDANCE_DEVICE',
            actor: caller.uid,
            actorName: caller.user.name,
            timestamp: now,
            targetId: deviceId,
            targetType: 'attendance_device',
            storeId: targetStoreId,
            details: `Cập nhật máy chấm công ${next.name}`,
            before: previous as unknown as Record<string, unknown>,
            after: next as unknown as Record<string, unknown>,
        };
        const batch = db.batch();
        batch.update(ref, updates);
        batch.set(auditRef, audit);
        await batch.commit();
        return NextResponse.json({ device: next });
    } catch (error) {
        const accessResponse = attendanceAccessErrorResponse(error);
        if (accessResponse) return accessResponse;
        if (error instanceof z.ZodError) {
            return NextResponse.json({ error: 'Cấu hình thiết bị không hợp lệ.', details: error.flatten() }, { status: 400 });
        }
        console.error('[attendance-device] error:', error);
        return NextResponse.json({ error: 'Không thể cập nhật thiết bị chấm công.' }, { status: 500 });
    }
}
