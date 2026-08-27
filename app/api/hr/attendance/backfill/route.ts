import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { attendanceAccessErrorResponse, requireAttendanceAccess } from '@/lib/attendance/access';
import { backfillLegacyAttendance } from '@/lib/attendance/device-backfill';
import { getAdminDb } from '@/lib/firebase-admin';
import type { AttendanceDeviceDoc } from '@/types';

const inputSchema = z.object({
    deviceId: z.string().trim().min(1),
    dryRun: z.boolean().default(true),
    limit: z.number().int().min(1).max(400).default(100),
    cursor: z.string().trim().min(1).optional(),
}).strict();

export async function POST(req: NextRequest) {
    try {
        const input = inputSchema.parse(await req.json());
        const snapshot = await getAdminDb().collection('attendance_devices').doc(input.deviceId).get();
        if (!snapshot.exists) {
            return NextResponse.json({ error: 'Không tìm thấy thiết bị dùng cho backfill.' }, { status: 404 });
        }
        const device = { id: snapshot.id, ...snapshot.data() } as AttendanceDeviceDoc;
        await requireAttendanceAccess(req, {
            permission: 'hr.attendance.configure',
            storeId: device.storeId,
        });
        return NextResponse.json(await backfillLegacyAttendance({
            device,
            dryRun: input.dryRun,
            limit: input.limit,
            cursor: input.cursor,
        }));
    } catch (error) {
        const accessResponse = attendanceAccessErrorResponse(error);
        if (accessResponse) return accessResponse;
        if (error instanceof z.ZodError) {
            return NextResponse.json({ error: 'Yêu cầu backfill không hợp lệ.', details: error.flatten() }, { status: 400 });
        }
        console.error('[attendance-backfill] error:', error);
        return NextResponse.json({ error: error instanceof Error ? error.message : 'Không thể backfill dữ liệu.' }, { status: 500 });
    }
}
