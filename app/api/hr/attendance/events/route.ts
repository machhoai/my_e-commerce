import { NextRequest, NextResponse } from 'next/server';
import { attendanceAccessErrorResponse } from '@/lib/attendance/access';
import {
    AttendanceManagerError,
    getManagerAttendanceHistory,
} from '@/lib/attendance/manager-service';

export async function GET(req: NextRequest) {
    try {
        const { searchParams } = new URL(req.url);
        const storeId = searchParams.get('storeId')?.trim() ?? '';
        const date = searchParams.get('date')?.trim() ?? '';
        if (!storeId || !date) {
            return NextResponse.json({ error: 'Thiếu storeId hoặc date.' }, { status: 400 });
        }
        const events = await getManagerAttendanceHistory(req, storeId, date);
        return NextResponse.json(events, { headers: { 'Cache-Control': 'no-store' } });
    } catch (error) {
        const accessResponse = attendanceAccessErrorResponse(error);
        if (accessResponse) return accessResponse;
        if (error instanceof AttendanceManagerError) {
            return NextResponse.json({ error: error.message }, { status: error.status });
        }
        console.error('[manager-attendance-events] error:', error);
        return NextResponse.json({ error: 'Không thể tải lịch sử sự kiện.' }, { status: 500 });
    }
}
