import { NextRequest, NextResponse } from 'next/server';
import { getActiveAttendanceDevices, syncAttendanceDevice } from '@/lib/attendance/device-sync';

export const runtime = 'nodejs';
export const maxDuration = 300;

export async function GET(req: NextRequest) {
    const secret = process.env.CRON_SECRET;
    if (!secret) {
        return NextResponse.json({ error: 'CRON_SECRET chưa được cấu hình.' }, { status: 503 });
    }
    if (req.headers.get('authorization') !== `Bearer ${secret}`) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const devices = await getActiveAttendanceDevices();
    const results = [];
    const errors = [];
    for (const device of devices) {
        try {
            results.push(await syncAttendanceDevice(device));
        } catch (error) {
            errors.push({
                deviceId: device.deviceId,
                storeId: device.storeId,
                error: error instanceof Error ? error.message : String(error),
            });
        }
    }
    return NextResponse.json({
        ok: errors.length === 0,
        syncedAt: new Date().toISOString(),
        devices: results,
        errors,
    }, { status: results.length > 0 || devices.length === 0 ? 200 : 502 });
}
