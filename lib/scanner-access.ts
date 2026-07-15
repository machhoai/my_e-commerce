import 'server-only';

import { cookies } from 'next/headers';
import { getAdminAuth, getAdminDb } from '@/lib/firebase-admin';
import type { CounterDoc } from '@/types';

const SCANNER_PAGE_PERMISSION = 'page.product_scanner';

export class ScannerAccessError extends Error {
    constructor(message: string, public readonly status = 403) {
        super(message);
        this.name = 'ScannerAccessError';
    }
}

export type ScannerSessionUser = {
    uid: string;
    role: string;
    name: string;
    email: string;
    storeId?: string;
    customRoleId?: string;
    isActive: boolean;
};

export type ScannerPlacement = {
    counterId: string;
    counterName: string;
    storeId: string;
    storeName: string;
    shiftIds: string[];
    wmsWarehouseId: string;
    wmsLocationId: string;
    wmsLocationCode: string;
    wmsLocationName: string;
};

export async function requireSessionUser(): Promise<ScannerSessionUser> {
    const cookieStore = await cookies();
    const sessionCookie = cookieStore.get('session')?.value;
    if (!sessionCookie) throw new ScannerAccessError('Phiên đăng nhập không tồn tại.', 401);

    let uid = '';
    try {
        const decoded = await getAdminAuth().verifySessionCookie(sessionCookie, true);
        uid = decoded.uid;
    } catch {
        throw new ScannerAccessError('Phiên đăng nhập đã hết hạn hoặc không hợp lệ.', 401);
    }

    const userSnap = await getAdminDb().collection('users').doc(uid).get();
    if (!userSnap.exists) throw new ScannerAccessError('Không tìm thấy tài khoản.', 403);

    const data = userSnap.data()!;
    if (data.isActive === false) throw new ScannerAccessError('Tài khoản đã bị vô hiệu hóa.', 403);

    return {
        uid,
        role: data.role || '',
        name: data.name || '',
        email: data.email || '',
        storeId: data.storeId || undefined,
        customRoleId: data.customRoleId || undefined,
        isActive: data.isActive !== false,
    };
}

export async function userHasPermission(user: ScannerSessionUser, permission: string) {
    if (user.role === 'admin' || user.role === 'super_admin') return true;

    const roleId = user.customRoleId || user.role;
    if (!roleId) return false;
    const roleSnap = await getAdminDb().collection('custom_roles').doc(roleId).get();
    const permissions: string[] = roleSnap.exists ? roleSnap.data()?.permissions || [] : [];
    return permissions.includes(permission);
}

export async function requireScannerUser() {
    const user = await requireSessionUser();
    if (!(await userHasPermission(user, SCANNER_PAGE_PERMISSION))) {
        throw new ScannerAccessError('Bạn không có quyền sử dụng chức năng quét sản phẩm.', 403);
    }
    return user;
}

export async function requireStoreSettingsManager(storeId: string) {
    const user = await requireSessionUser();
    const isAdmin = user.role === 'admin' || user.role === 'super_admin';
    const isOwnStoreManager = user.role === 'store_manager' && user.storeId === storeId;
    if (!isAdmin && !isOwnStoreManager) {
        throw new ScannerAccessError('Bạn không có quyền cấu hình mapping quầy của cửa hàng này.', 403);
    }
    return user;
}

function mappedActiveCounters(storeData: FirebaseFirestore.DocumentData): CounterDoc[] {
    const counters = Array.isArray(storeData.settings?.counters)
        ? storeData.settings.counters as CounterDoc[]
        : [];
    return counters.filter(counter => counter.isActive !== false && Boolean(counter.wmsLocationId));
}

export async function getScannerPlacementsForUser(user: ScannerSessionUser): Promise<ScannerPlacement[]> {
    const db = getAdminDb();
    const isAdmin = user.role === 'admin' || user.role === 'super_admin';
    const today = new Date().toLocaleDateString('sv-SE', { timeZone: 'Asia/Ho_Chi_Minh' });

    const assignments = new Map<string, { storeId: string; counterId: string; shiftIds: Set<string> }>();

    if (isAdmin) {
        const storesSnap = await db.collection('stores').get();
        for (const storeDoc of storesSnap.docs) {
            const storeData = storeDoc.data();
            for (const counter of mappedActiveCounters(storeData)) {
                assignments.set(`${storeDoc.id}:${counter.id}`, {
                    storeId: storeDoc.id,
                    counterId: counter.id,
                    shiftIds: new Set<string>(['Quản trị']),
                });
            }
        }
    } else {
        const schedulesSnap = await db.collection('schedules').where('date', '==', today).get();
        for (const scheduleDoc of schedulesSnap.docs) {
            const schedule = scheduleDoc.data();
            const employeeIds: string[] = Array.isArray(schedule.employeeIds) ? schedule.employeeIds : [];
            if (!employeeIds.includes(user.uid)) continue;
            if (!schedule.storeId || !schedule.counterId) continue;
            if (user.storeId && schedule.storeId !== user.storeId) continue;

            const key = `${schedule.storeId}:${schedule.counterId}`;
            const current = assignments.get(key) || {
                storeId: schedule.storeId,
                counterId: schedule.counterId,
                shiftIds: new Set<string>(),
            };
            if (schedule.shiftId) current.shiftIds.add(schedule.shiftId);
            assignments.set(key, current);
        }
    }

    const storeIds = [...new Set([...assignments.values()].map(item => item.storeId))];
    const storeDocs = await Promise.all(storeIds.map(storeId => db.collection('stores').doc(storeId).get()));
    const storeMap = new Map(storeDocs.filter(doc => doc.exists).map(doc => [doc.id, doc.data()!]));

    const placements: ScannerPlacement[] = [];
    for (const assignment of assignments.values()) {
        const storeData = storeMap.get(assignment.storeId);
        if (!storeData || storeData.isActive === false || !storeData.wmsWarehouseId) continue;

        const counters: CounterDoc[] = Array.isArray(storeData.settings?.counters)
            ? storeData.settings.counters
            : [];
        const counter = counters.find(item => item.id === assignment.counterId);
        if (!counter || counter.isActive === false || !counter.wmsLocationId) continue;

        placements.push({
            counterId: counter.id,
            counterName: counter.name,
            storeId: assignment.storeId,
            storeName: storeData.name || assignment.storeId,
            shiftIds: [...assignment.shiftIds].sort(),
            wmsWarehouseId: storeData.wmsWarehouseId,
            wmsLocationId: counter.wmsLocationId,
            wmsLocationCode: counter.wmsLocationCode || '',
            wmsLocationName: counter.wmsLocationName || counter.name,
        });
    }

    return placements.sort((a, b) =>
        a.storeName.localeCompare(b.storeName, 'vi') || a.counterName.localeCompare(b.counterName, 'vi')
    );
}

export async function requireScannerPlacementByWms(warehouseId: string, locationId: string) {
    const user = await requireScannerUser();
    const placements = await getScannerPlacementsForUser(user);
    const placement = placements.find(item =>
        item.wmsWarehouseId === warehouseId && item.wmsLocationId === locationId
    );
    if (!placement) {
        throw new ScannerAccessError('Bạn không được phân công tại quầy/vị trí WMS này.', 403);
    }
    return { user, placement };
}
