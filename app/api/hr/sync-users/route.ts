import { NextRequest, NextResponse } from 'next/server';
import { attendanceAccessErrorResponse, requireAttendanceAccess } from '@/lib/attendance/access';
import { syncAttendanceDeviceUsers } from '@/lib/attendance/device-sync';
import { getAdminDb } from '@/lib/firebase-admin';
import type { AttendanceDeviceDoc } from '@/types';

export async function POST(req: NextRequest) {
    try {
        const body = await req.json().catch(() => ({})) as { deviceId?: string };
        const deviceId = body.deviceId?.trim() ?? '';
        if (!deviceId) {
            return NextResponse.json({ error: 'Thiếu deviceId.' }, { status: 400 });
        }
        const snapshot = await getAdminDb().collection('attendance_devices').doc(deviceId).get();
        if (!snapshot.exists) {
            return NextResponse.json({ error: 'Không tìm thấy thiết bị.' }, { status: 404 });
        }
        const device = { id: snapshot.id, ...snapshot.data() } as AttendanceDeviceDoc;
        await requireAttendanceAccess(req, {
            permission: 'hr.attendance.configure',
            storeId: device.storeId,
        });
        if (!device.isActive) {
            return NextResponse.json({ error: 'Thiết bị đang bị vô hiệu hóa.' }, { status: 409 });
        }
        return NextResponse.json(await syncAttendanceDeviceUsers(device));
    } catch (error) {
        return attendanceAccessErrorResponse(error)
            ?? NextResponse.json({ error: error instanceof Error ? error.message : 'Không thể đồng bộ người dùng máy.' }, { status: 500 });
    }
}
