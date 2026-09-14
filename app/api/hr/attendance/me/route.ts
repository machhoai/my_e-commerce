import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import {
    attendanceServiceErrorResponse,
    getPersonalAttendanceEvents,
} from '@/lib/attendance/software-service';

const dateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

export async function GET(req: NextRequest) {
    try {
        const date = req.nextUrl.searchParams.get('date');
        const parsedDate = date ? dateSchema.parse(date) : undefined;
        const result = await getPersonalAttendanceEvents(req, parsedDate, req.nextUrl.searchParams.get('storeId') || undefined);
        return NextResponse.json(result, { headers: { 'Cache-Control': 'no-store' } });
    } catch (error) {
        if (error instanceof z.ZodError) {
            return NextResponse.json({ error: 'Ngày chấm công không hợp lệ.' }, { status: 400 });
        }
        const response = attendanceServiceErrorResponse(error);
        if (response) return response;
        console.error('[attendance-me] error:', error);
        return NextResponse.json({ error: 'Không thể tải dữ liệu chấm công cá nhân.' }, { status: 500 });
    }
}
