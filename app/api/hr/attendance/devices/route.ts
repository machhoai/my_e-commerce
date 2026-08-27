import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { attendanceAccessErrorResponse, requireAttendanceAccess } from '@/lib/attendance/access';
import { attendanceDeviceInputSchema } from '@/lib/attendance/device-schema';
import { getAdminDb } from '@/lib/firebase-admin';
import type { AttendanceDeviceDoc, AuditLogDoc } from '@/types';

function errorResponse(error: unknown): Response {
    const accessResponse = attendanceAccessErrorResponse(error);
    if (accessResponse) return accessResponse;
    if (error instanceof z.ZodError) {
        return NextResponse.json({ error: 'Cấu hình thiết bị không hợp lệ.', details: error.flatten() }, { status: 400 });
    }
    console.error('[attendance-devices] error:', error);
    return NextResponse.json({ error: 'Không thể xử lý thiết bị chấm công.' }, { status: 500 });
}

export async function GET(req: NextRequest) {
    try {
        const storeId = new URL(req.url).searchParams.get('storeId')?.trim() ?? '';
        await requireAttendanceAccess(req, { permission: 'hr.attendance.configure', storeId });
        const snapshot = await getAdminDb().collection('attendance_devices').get();
        const devices = snapshot.docs
            .map((document) => ({ id: document.id, ...document.data() } as AttendanceDeviceDoc))
            .filter((device) => device.storeId === storeId)
            .sort((a, b) => a.name.localeCompare(b.name, 'vi'));
        return NextResponse.json(devices, { headers: { 'Cache-Control': 'no-store' } });
    } catch (error) {
        return errorResponse(error);
    }
}

export async function POST(req: NextRequest) {
    try {
        const input = attendanceDeviceInputSchema.parse(await req.json());
        const caller = await requireAttendanceAccess(req, {
            permission: 'hr.attendance.configure',
            storeId: input.storeId,
        });
        const db = getAdminDb();
        const deviceRef = db.collection('attendance_devices').doc(input.deviceId);
        const [deviceSnapshot, storeSnapshot] = await Promise.all([
            deviceRef.get(),
            db.collection('stores').doc(input.storeId).get(),
        ]);
        if (deviceSnapshot.exists) {
            return NextResponse.json({ error: 'Mã thiết bị đã tồn tại.' }, { status: 409 });
        }
        if (!storeSnapshot.exists) {
            return NextResponse.json({ error: 'Không tìm thấy cửa hàng.' }, { status: 404 });
        }
        const now = new Date().toISOString();
        const device: AttendanceDeviceDoc = {
            id: input.deviceId,
            ...input,
            bridgeEndpoint: input.bridgeEndpoint.replace(/\/$/, ''),
            timezone: 'Asia/Ho_Chi_Minh',
            lastSyncAt: null,
            lastSyncStatus: 'IDLE',
            lastSyncError: null,
            createdAt: now,
            createdBy: caller.uid,
            updatedAt: now,
            updatedBy: caller.uid,
        };
        const auditRef = db.collection('audit_logs').doc();
        const audit: AuditLogDoc = {
            id: auditRef.id,
            action: 'CREATE_ATTENDANCE_DEVICE',
            actor: caller.uid,
            actorName: caller.user.name,
            timestamp: now,
            targetId: input.deviceId,
            targetType: 'attendance_device',
            storeId: input.storeId,
            details: `Tạo máy chấm công ${input.name}`,
            before: null,
            after: device as unknown as Record<string, unknown>,
        };
        const batch = db.batch();
        batch.create(deviceRef, device);
        batch.set(auditRef, audit);
        await batch.commit();
        return NextResponse.json({ device }, { status: 201 });
    } catch (error) {
        return errorResponse(error);
    }
}
