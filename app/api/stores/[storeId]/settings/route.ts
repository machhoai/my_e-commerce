import { NextRequest, NextResponse } from 'next/server';
import { getAdminAuth, getAdminDb } from '@/lib/firebase-admin';
import { StoreSettings, CounterDoc } from '@/types';

import { isInOpenWindow } from '@/lib/utils/schedule';

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

        if (body.counters) {
            const mappedIds = body.counters.map(counter => counter.wmsLocationId).filter(Boolean) as string[];
            if (new Set(mappedIds).size !== mappedIds.length) {
                return NextResponse.json({ error: 'Mỗi vị trí WMS chỉ được mapping với một quầy.' }, { status: 400 });
            }

            const existingCounters: CounterDoc[] = Array.isArray(storeSnap.data()?.settings?.counters)
                ? storeSnap.data()!.settings.counters
                : [];
            const previousMappings = new Map(existingCounters.map(counter => [counter.id, counter.wmsLocationId || '']));
            const mappingChanged = body.counters.some(counter =>
                (previousMappings.get(counter.id) || '') !== (counter.wmsLocationId || '')
            );

            if (mappingChanged && mappedIds.length > 0) {
                const wmsWarehouseId = storeSnap.data()?.wmsWarehouseId || '';
                if (!wmsWarehouseId) {
                    return NextResponse.json({ error: 'Cửa hàng chưa mapping với kho WMS.' }, { status: 400 });
                }

                try {
                    const apiUrl = (process.env.WMS_API_URL || '').replace('localhost', '127.0.0.1');
                    const response = await fetch(`${apiUrl}/api/external/v1/locations?warehouse_id=${encodeURIComponent(wmsWarehouseId)}`, {
                        headers: { 'x-api-key': process.env.WMS_API_KEY || '' },
                        cache: 'no-store',
                    });
                    const result = await response.json();
                    const locations: Array<{ id: string; code?: string; name?: string }> = Array.isArray(result.data) ? result.data : [];
                    const locationMap = new Map(locations.map(location => [location.id, location]));
                    const invalidId = mappedIds.find(id => !locationMap.has(id));
                    if (invalidId) {
                        return NextResponse.json({ error: `Vị trí WMS ${invalidId} không thuộc kho đã mapping của cửa hàng.` }, { status: 400 });
                    }

                    body.counters = body.counters.map(counter => {
                        const location = counter.wmsLocationId ? locationMap.get(counter.wmsLocationId) : undefined;
                        return {
                            ...counter,
                            storeId,
                            wmsLocationCode: location?.code || '',
                            wmsLocationName: location?.name || '',
                            mappingUpdatedAt: new Date().toISOString(),
                            mappingUpdatedBy: decoded.uid,
                        };
                    });
                } catch (err) {
                    console.error('[StoreSettings] WMS mapping validation failed:', err);
                    return NextResponse.json({ error: 'Không thể xác thực mapping với WMS lúc này.' }, { status: 502 });
                }
            } else {
                body.counters = body.counters.map(counter => ({ ...counter, storeId }));
            }
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
