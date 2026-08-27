import { NextRequest, NextResponse } from 'next/server';
import { attendanceAccessErrorResponse } from '@/lib/attendance/access';
import { getAttendanceStores } from '@/lib/attendance/manager-service';

export async function GET(req: NextRequest) {
    try {
        const stores = await getAttendanceStores(req);
        return NextResponse.json(stores, { headers: { 'Cache-Control': 'no-store' } });
    } catch (error) {
        const accessResponse = attendanceAccessErrorResponse(error);
        if (accessResponse) return accessResponse;
        console.error('[attendance-stores] error:', error);
        return NextResponse.json({ error: 'Không thể tải danh sách cửa hàng.' }, { status: 500 });
    }
}
