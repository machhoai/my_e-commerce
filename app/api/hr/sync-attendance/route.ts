import { NextRequest, NextResponse } from 'next/server';
import {
    attendanceAccessErrorResponse,
    requireAttendanceAccess,
} from '@/lib/attendance/access';
import { getActiveAttendanceDevices, syncAttendanceDevice } from '@/lib/attendance/device-sync';

/** Manual fallback. Normal operation is handled by /api/cron/attendance-sync. */
export async function POST(req: NextRequest) {
    const storeId = new URL(req.url).searchParams.get('storeId')?.trim() ?? '';
    try {
        await requireAttendanceAccess(req, { permission: 'page.hr.attendance', storeId });
        const devices = await getActiveAttendanceDevices(storeId);
        if (devices.length === 0) {
            return NextResponse.json(
                { error: 'Cửa hàng chưa có máy chấm công đang hoạt động.' },
                { status: 409 },
            );
        }
        const settled = await Promise.allSettled(devices.map(syncAttendanceDevice));
        const results = settled.flatMap((result) => result.status === 'fulfilled' ? [result.value] : []);
        const errors = settled.flatMap((result, index) => result.status === 'rejected'
            ? [{ deviceId: devices[index].deviceId, error: result.reason instanceof Error ? result.reason.message : String(result.reason) }]
            : []);
        const totals = results.reduce((sum, result) => ({
            inserted: sum.inserted + result.inserted,
            updated: sum.updated + result.updated,
            normalized: sum.normalized + result.normalized,
            unmapped: sum.unmapped + result.unmapped,
            total: sum.total + result.total,
        }), { inserted: 0, updated: 0, normalized: 0, unmapped: 0, total: 0 });
        return NextResponse.json({
            message: errors.length > 0 ? 'Đồng bộ hoàn tất một phần.' : 'Đồng bộ chấm công hoàn tất.',
            ...totals,
            devices: results,
            errors,
        }, { status: results.length > 0 ? 200 : 502 });
    } catch (error) {
        return attendanceAccessErrorResponse(error)
            ?? NextResponse.json({ error: error instanceof Error ? error.message : 'Không thể đồng bộ chấm công.' }, { status: 500 });
    }
}
