import { NextRequest, NextResponse } from 'next/server';
import { getAdminAuth, getAdminDb } from '@/lib/firebase-admin';
import { StoreSettings, RegistrationSchedule } from '@/types';

// --- Auto-Schedule Logic (same as global settings, but applied per-store) ---
function isInOpenWindow(schedule: RegistrationSchedule): boolean {
    const nowUtc = new Date();
    const vnMs = nowUtc.getTime() + 7 * 60 * 60 * 1000;
    const vnNow = new Date(vnMs);

    const currentDay = vnNow.getUTCDay();
    const currentMinutes = vnNow.getUTCHours() * 60 + vnNow.getUTCMinutes();

    const openTotal = schedule.openDay * 24 * 60 + schedule.openHour * 60 + schedule.openMinute;
    const closeTotal = schedule.closeDay * 24 * 60 + schedule.closeHour * 60 + schedule.closeMinute;
    const nowTotal = currentDay * 24 * 60 + currentMinutes;

    if (openTotal <= closeTotal) {
        return nowTotal >= openTotal && nowTotal < closeTotal;
    } else {
        return nowTotal >= openTotal || nowTotal < closeTotal;
    }
}

// GET /api/stores/[storeId]/settings — any authenticated user can read (needed for real-time checks)
export async function GET(
    req: NextRequest,
    { params }: { params: Promise<{ storeId: string }> }
) {
    try {
        const { storeId } = await params;
        const token = req.headers.get('Authorization')?.split('Bearer ')[1];
        if (!token) return NextResponse.json({ error: 'Không được phép' }, { status: 401 });

        const adminAuth = getAdminAuth();
        await adminAuth.verifyIdToken(token);

        const adminDb = getAdminDb();
        const storeSnap = await adminDb.collection('stores').doc(storeId).get();

        if (!storeSnap.exists) {
            return NextResponse.json({ error: 'Không tìm thấy cửa hàng' }, { status: 404 });
        }

        const storeData = storeSnap.data();
        const settings: StoreSettings = storeData?.settings ?? {
            registrationOpen: false,
            shiftTimes: ['07:00-11:00', '11:00-15:00', '15:00-19:00'],
            quotas: {
                defaultWeekday: {},
                defaultWeekend: {},
                specialDates: {},
            },
            monthlyQuotas: {
                ftDaysOff: 4,
                ptMinShifts: 10,
                ptMaxShifts: 25,
            },
        };

        // On-demand auto-schedule check
        const schedule = settings.registrationSchedule;
        if (schedule?.enabled) {
            const shouldBeOpen = isInOpenWindow(schedule);
            if (shouldBeOpen !== (settings.registrationOpen ?? false)) {
                // Background update — don't await to keep response fast
                adminDb.collection('stores').doc(storeId).set(
                    { settings: { ...settings, registrationOpen: shouldBeOpen } },
                    { merge: true }
                ).catch(console.error);
                settings.registrationOpen = shouldBeOpen;
            }
        }

        return NextResponse.json(settings);
    } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Lỗi hệ thống';
        return NextResponse.json({ error: message }, { status: 500 });
    }
}

// PUT /api/stores/[storeId]/settings — admin or store_manager of that store only
export async function PUT(
    req: NextRequest,
    { params }: { params: Promise<{ storeId: string }> }
) {
    try {
        const { storeId } = await params;
        const token = req.headers.get('Authorization')?.split('Bearer ')[1];
        if (!token) return NextResponse.json({ error: 'Không được phép' }, { status: 401 });

        const adminAuth = getAdminAuth();
        const decoded = await adminAuth.verifyIdToken(token);
        const adminDb = getAdminDb();

        // Verify caller is admin OR store_manager belonging to this store
        const callerDoc = await adminDb.collection('users').doc(decoded.uid).get();
        if (!callerDoc.exists) {
            return NextResponse.json({ error: 'Không tìm thấy người dùng' }, { status: 403 });
        }
        const callerData = callerDoc.data()!;
        const isAdmin = callerData.role === 'admin';
        const isStoreManager = callerData.role === 'store_manager' && callerData.storeId === storeId;

        if (!isAdmin && !isStoreManager) {
            return NextResponse.json({ error: 'Bị từ chối truy cập — chỉ Admin hoặc Cửa hàng trưởng mới có quyền' }, { status: 403 });
        }

        const body = await req.json() as Partial<StoreSettings>;

        // Validate store exists
        const storeSnap = await adminDb.collection('stores').doc(storeId).get();
        if (!storeSnap.exists) {
            return NextResponse.json({ error: 'Không tìm thấy cửa hàng' }, { status: 404 });
        }

        await adminDb.collection('stores').doc(storeId).set(
            { settings: body },
            { merge: true }
        );

        return NextResponse.json({ message: 'Cài đặt cửa hàng đã được cập nhật' });
    } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Lỗi hệ thống';
        return NextResponse.json({ error: message }, { status: 500 });
    }
}
