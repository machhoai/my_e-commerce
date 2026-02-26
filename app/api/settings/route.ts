import { NextRequest, NextResponse } from 'next/server';
import { getAdminAuth, getAdminDb } from '@/lib/firebase-admin';
import { SettingsDoc, RegistrationSchedule } from '@/types';

// --- Auto-Schedule Logic (replaces cron job) ---
// Converts current UTC time to Vietnam time (UTC+7) and checks if now
// falls within the configured open window. Called on every GET request.
function isInOpenWindow(schedule: RegistrationSchedule): boolean {
    const nowUtc = new Date();
    const vnMs = nowUtc.getTime() + 7 * 60 * 60 * 1000;
    const vnNow = new Date(vnMs);

    const currentDay = vnNow.getUTCDay(); // 0=Sun .. 6=Sat
    const currentMinutes = vnNow.getUTCHours() * 60 + vnNow.getUTCMinutes();

    const openTotal = schedule.openDay * 24 * 60 + schedule.openHour * 60 + schedule.openMinute;
    const closeTotal = schedule.closeDay * 24 * 60 + schedule.closeHour * 60 + schedule.closeMinute;
    const nowTotal = currentDay * 24 * 60 + currentMinutes;

    if (openTotal <= closeTotal) {
        return nowTotal >= openTotal && nowTotal < closeTotal;
    } else {
        // Wraps around the week (e.g. Fri 22:00 → Mon 08:00)
        return nowTotal >= openTotal || nowTotal < closeTotal;
    }
}

// GET /api/settings
export async function GET(req: NextRequest) {
    try {
        const token = req.headers.get('Authorization')?.split('Bearer ')[1];
        if (!token) return NextResponse.json({ error: 'Không được phép' }, { status: 401 });

        const adminAuth = getAdminAuth();
        await adminAuth.verifyIdToken(token);

        const adminDb = getAdminDb();
        const snap = await adminDb.collection('settings').doc('global').get();

        if (!snap.exists) {
            const defaultShifts = ['07:00-11:00', '11:00-15:00', '15:00-19:00'];
            const defaultWeekdayQuota: Record<string, number> = {};
            const defaultWeekendQuota: Record<string, number> = {};
            defaultShifts.forEach(shift => {
                defaultWeekdayQuota[shift] = 5;
                defaultWeekendQuota[shift] = 8;
            });

            const defaults: SettingsDoc = {
                id: 'global',
                registrationOpen: false,
                shiftTimes: defaultShifts,
                quotas: {
                    defaultWeekday: defaultWeekdayQuota,
                    defaultWeekend: defaultWeekendQuota,
                    specialDates: {}
                },
                monthlyQuotas: {
                    ftDaysOff: 4,
                    ptMinShifts: 10,
                    ptMaxShifts: 25
                }
            };
            return NextResponse.json(defaults);
        }

        const data = snap.data() as SettingsDoc;

        // On-demand auto-schedule check — replaces cron job
        const schedule = data.registrationSchedule;
        if (schedule?.enabled) {
            const shouldBeOpen = isInOpenWindow(schedule);
            if (shouldBeOpen !== (data.registrationOpen ?? false)) {
                // Silent background update — don't await to avoid slowing response
                adminDb.collection('settings').doc('global').update({
                    registrationOpen: shouldBeOpen,
                }).catch(console.error);
                data.registrationOpen = shouldBeOpen;
            }
        }

        return NextResponse.json({ ...data, id: snap.id });
    } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Internal server error';
        return NextResponse.json({ error: message }, { status: 500 });
    }
}


// PUT /api/settings
export async function PUT(req: NextRequest) {
    try {
        const token = req.headers.get('Authorization')?.split('Bearer ')[1];
        if (!token) return NextResponse.json({ error: 'Không được phép' }, { status: 401 });

        const adminAuth = getAdminAuth();
        const decoded = await adminAuth.verifyIdToken(token);
        const adminDb = getAdminDb();

        const callerDoc = await adminDb.collection('users').doc(decoded.uid).get();
        if (!callerDoc.exists || callerDoc.data()?.role !== 'admin') {
            return NextResponse.json({ error: 'Bị từ chối truy cập' }, { status: 403 });
        }

        const body = await req.json() as Partial<SettingsDoc>;
        await adminDb.collection('settings').doc('global').set(body, { merge: true });

        return NextResponse.json({ message: 'Cài đặt đã được cập nhật' });
    } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Lỗi hệ thống';
        return NextResponse.json({ error: message }, { status: 500 });
    }
}
