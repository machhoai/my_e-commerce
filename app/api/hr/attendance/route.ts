import { NextRequest, NextResponse } from 'next/server';
import { attendanceAccessErrorResponse } from '@/lib/attendance/access';
import {
    AttendanceManagerError,
    getManagerAttendance,
} from '@/lib/attendance/manager-service';

export async function GET(req: NextRequest) {
    try {
        const { searchParams } = new URL(req.url);
        const storeId = searchParams.get('storeId')?.trim() ?? '';
        if (!storeId) {
            return NextResponse.json({ error: 'Thiếu storeId.' }, { status: 400 });
        }
        const result = await getManagerAttendance(
            req,
            storeId,
            searchParams.get('date'),
            searchParams.get('month'),
        );
        return NextResponse.json(result, { headers: { 'Cache-Control': 'no-store' } });
    } catch (error) {
        const accessResponse = attendanceAccessErrorResponse(error);
        if (accessResponse) return accessResponse;
        if (error instanceof AttendanceManagerError) {
            return NextResponse.json({ error: error.message }, { status: error.status });
        }
        console.error('[manager-attendance] error:', error);
        return NextResponse.json({ error: 'Không thể tải bảng chấm công.' }, { status: 500 });
    }
}
