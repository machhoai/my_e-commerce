import { NextRequest, NextResponse } from 'next/server';
import {
    attendanceServiceErrorResponse,
    getSoftwareAttendanceContext,
} from '@/lib/attendance/software-service';

export async function GET(req: NextRequest) {
    try {
        const context = await getSoftwareAttendanceContext(req);
        return NextResponse.json(context, { headers: { 'Cache-Control': 'no-store' } });
    } catch (error) {
        const response = attendanceServiceErrorResponse(error);
        if (response) return response;
        console.error('[attendance-context] error:', error);
        return NextResponse.json({ error: 'Không thể tải trạng thái chấm công.' }, { status: 500 });
    }
}
