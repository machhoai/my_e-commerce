import { NextRequest, NextResponse } from 'next/server';
import { getAdminAuth, getAdminDb } from '@/lib/firebase-admin';
import { SettingsDoc } from '@/types';

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

        return NextResponse.json({ id: snap.id, ...snap.data() });
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
