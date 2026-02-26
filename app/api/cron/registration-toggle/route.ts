import { NextRequest, NextResponse } from 'next/server';
import { getAdminDb } from '@/lib/firebase-admin';
import { SettingsDoc, RegistrationSchedule } from '@/types';

/**
 * Vercel Cron Job: runs every 30 minutes.
 * Checks registrationSchedule and sets registrationOpen accordingly.
 *
 * Schedule in vercel.json: "* /30 * * * *"
 * Protect with CRON_SECRET env var.
 */

function isInOpenWindow(schedule: RegistrationSchedule): boolean {
    // Convert current UTC to Vietnam time (UTC+7)
    const nowUtc = new Date();
    const vnOffset = 7 * 60; // minutes
    const vnMs = nowUtc.getTime() + vnOffset * 60 * 1000;
    const vnNow = new Date(vnMs);

    const currentDay = vnNow.getUTCDay(); // 0=Sun .. 6=Sat
    const currentMinutes = vnNow.getUTCHours() * 60 + vnNow.getUTCMinutes();

    const openTotalMinutes = schedule.openDay * 24 * 60 + schedule.openHour * 60 + schedule.openMinute;
    const closeTotalMinutes = schedule.closeDay * 24 * 60 + schedule.closeHour * 60 + schedule.closeMinute;
    const nowTotalMinutes = currentDay * 24 * 60 + currentMinutes;

    if (openTotalMinutes <= closeTotalMinutes) {
        // Normal range: e.g. Mon 08:00 -> Fri 22:00
        return nowTotalMinutes >= openTotalMinutes && nowTotalMinutes < closeTotalMinutes;
    } else {
        // Wraps around midnight: e.g. Fri 22:00 -> Mon 08:00
        return nowTotalMinutes >= openTotalMinutes || nowTotalMinutes < closeTotalMinutes;
    }
}

export async function GET(req: NextRequest) {
    // Protect with CRON_SECRET header
    const secret = req.headers.get('x-cron-secret') ?? req.nextUrl.searchParams.get('secret');
    if (process.env.CRON_SECRET && secret !== process.env.CRON_SECRET) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    try {
        const adminDb = getAdminDb();
        const snap = await adminDb.collection('settings').doc('global').get();

        if (!snap.exists) {
            return NextResponse.json({ message: 'No settings found', changed: false });
        }

        const data = snap.data() as SettingsDoc;
        const schedule = data.registrationSchedule;

        if (!schedule?.enabled) {
            return NextResponse.json({ message: 'Auto-schedule disabled', changed: false });
        }

        const shouldBeOpen = isInOpenWindow(schedule);
        const currentlyOpen = data.registrationOpen ?? false;

        if (shouldBeOpen === currentlyOpen) {
            return NextResponse.json({
                message: `No change needed (registrationOpen=${currentlyOpen})`,
                changed: false,
            });
        }

        await adminDb.collection('settings').doc('global').update({
            registrationOpen: shouldBeOpen,
        });

        return NextResponse.json({
            message: `registrationOpen updated to ${shouldBeOpen}`,
            changed: true,
            newValue: shouldBeOpen,
        });
    } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Internal error';
        return NextResponse.json({ error: message }, { status: 500 });
    }
}
