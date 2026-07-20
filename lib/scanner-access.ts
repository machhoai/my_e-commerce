import 'server-only';

import { cookies } from 'next/headers';
import { getAdminAuth, getAdminDb } from '@/lib/firebase-admin';
import { fetchWmsApi, getWmsResponseError, type WmsApiResponse } from '@/lib/wms-api';
import type { CounterDoc } from '@/types';

const SCANNER_PAGE_PERMISSION = 'page.product_scanner';
const SCANNER_ANY_COUNTER_PERMISSION = 'action.product_scanner.scan_any_counter';

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

type WmsWarehouse = { id: string; name?: string; code?: string };
type WmsLocation = { id: string; name?: string; code?: string };

async function getActiveWmsLocations(warehouseId: string, warehouseName?: string) {
    const params = new URLSearchParams({ warehouse_id: warehouseId });
    const path = `/api/external/v1/locations?${params.toString()}`;
    const response = await fetchWmsApi(path, { cache: 'no-store' });
    const result = await response.json() as WmsApiResponse<WmsLocation[]>;
    if (!response.ok || !result.success) {
        throw new ScannerAccessError(
            getWmsResponseError(result, `Không thể tải vị trí ERP của kho ${warehouseName || warehouseId}.`),
            response.status || 502,
        );
    }
    return Array.isArray(result.data) ? result.data : [];
}

async function getUnrestrictedScannerPlacements(isAdmin: boolean): Promise<ScannerPlacement[]> {
    const warehousesPath = '/api/external/v1/warehouses';
    const warehousesResponse = await fetchWmsApi(warehousesPath, { cache: 'no-store' });
    const warehousesResult = await warehousesResponse.json() as WmsApiResponse<WmsWarehouse[]>;
    if (!warehousesResponse.ok || !warehousesResult.success) {
        throw new ScannerAccessError(
            getWmsResponseError(warehousesResult, 'Không thể tải danh sách kho từ hệ thống ERP.'),
            warehousesResponse.status || 502,
        );
    }

    const warehouses = Array.isArray(warehousesResult.data) ? warehousesResult.data : [];
    const locationGroups = await Promise.all(warehouses.map(async warehouse => ({
        warehouse,
        locations: await getActiveWmsLocations(warehouse.id, warehouse.name),
    })));

    const placements = locationGroups.flatMap(({ warehouse, locations }) => locations.map(location => ({
        counterId: location.id,
        counterName: location.name || location.code || location.id,
        storeId: warehouse.id,
        storeName: warehouse.name || warehouse.code || warehouse.id,
        shiftIds: [isAdmin ? 'Quản trị' : 'Mọi lúc'],
        wmsWarehouseId: warehouse.id,
        wmsLocationId: location.id,
        wmsLocationCode: location.code || '',
        wmsLocationName: location.name || location.code || location.id,
    }))).sort((a, b) =>
        a.storeName.localeCompare(b.storeName, 'vi') || a.counterName.localeCompare(b.counterName, 'vi')
    );

    if (placements.length === 0) {
        throw new ScannerAccessError('Hệ thống ERP chưa có vị trí xuất kho nào đang hoạt động.', 403);
    }

    return placements;
}

export async function getScannerPlacementsForUser(user: ScannerSessionUser): Promise<ScannerPlacement[]> {
    const db = getAdminDb();
    const isAdmin = user.role === 'admin' || user.role === 'super_admin';
    const canScanAnyCounter = isAdmin || await userHasPermission(user, SCANNER_ANY_COUNTER_PERMISSION);

    if (canScanAnyCounter) {
        return getUnrestrictedScannerPlacements(isAdmin);
    }

    const assignments = new Map<string, { storeId: string; counterId: string; shiftIds: Set<string> }>();
    const storeMap = new Map<string, FirebaseFirestore.DocumentData>();

    const today = new Date().toLocaleDateString('sv-SE', { timeZone: 'Asia/Ho_Chi_Minh' });
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

    const storeIds = [...new Set([...assignments.values()].map(item => item.storeId))];
    const storeDocs = await Promise.all(storeIds.map(storeId => db.collection('stores').doc(storeId).get()));
    for (const storeDoc of storeDocs) {
        if (storeDoc.exists) storeMap.set(storeDoc.id, storeDoc.data()!);
    }

    const placements: ScannerPlacement[] = [];
    const locationRequests = new Map<string, Promise<WmsLocation[]>>();
    const fallbackStores = new Set<string>();
    const shiftIdsByStore = new Map<string, Set<string>>();
    for (const assignment of assignments.values()) {
        const shiftIds = shiftIdsByStore.get(assignment.storeId) || new Set<string>();
        assignment.shiftIds.forEach(shiftId => shiftIds.add(shiftId));
        shiftIdsByStore.set(assignment.storeId, shiftIds);
    }

    for (const assignment of assignments.values()) {
        const storeData = storeMap.get(assignment.storeId);
        if (!storeData || storeData.isActive === false || !storeData.wmsWarehouseId) continue;

        const counters: CounterDoc[] = Array.isArray(storeData.settings?.counters)
            ? storeData.settings.counters
            : [];
        const counter = counters.find(item => item.id === assignment.counterId);
        if (!counter || counter.isActive === false) continue;

        if (!counter.wmsLocationId) {
            if (fallbackStores.has(assignment.storeId)) continue;
            fallbackStores.add(assignment.storeId);
            const warehouseId = storeData.wmsWarehouseId as string;
            let locationsRequest = locationRequests.get(warehouseId);
            if (!locationsRequest) {
                locationsRequest = getActiveWmsLocations(warehouseId, storeData.name || assignment.storeId);
                locationRequests.set(warehouseId, locationsRequest);
            }
            const locations = await locationsRequest;
            for (const location of locations) {
                placements.push({
                    counterId: `erp:${location.id}`,
                    counterName: location.name || location.code || location.id,
                    storeId: assignment.storeId,
                    storeName: storeData.name || assignment.storeId,
                    shiftIds: [...(shiftIdsByStore.get(assignment.storeId) || [])].sort(),
                    wmsWarehouseId: warehouseId,
                    wmsLocationId: location.id,
                    wmsLocationCode: location.code || '',
                    wmsLocationName: location.name || location.code || location.id,
                });
            }
            continue;
        }

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

    const uniquePlacements = new Map<string, ScannerPlacement>();
    for (const placement of placements) {
        const key = `${placement.wmsWarehouseId}:${placement.wmsLocationId}`;
        const existing = uniquePlacements.get(key);
        if (!existing) {
            uniquePlacements.set(key, placement);
            continue;
        }
        existing.shiftIds = [...new Set([...existing.shiftIds, ...placement.shiftIds])].sort();
    }

    if (uniquePlacements.size === 0 && assignments.size > 0) {
        const assignedStores = [...assignments.values()]
            .map(assignment => storeMap.get(assignment.storeId))
            .filter((store): store is FirebaseFirestore.DocumentData => Boolean(store));
        if (assignedStores.length === 0 || assignedStores.every(store => store.isActive === false)) {
            throw new ScannerAccessError('Cửa hàng trong lịch phân công không tồn tại hoặc đã ngừng hoạt động.', 403);
        }
        if (assignedStores.every(store => !store.wmsWarehouseId)) {
            throw new ScannerAccessError('Cửa hàng trong lịch phân công chưa liên kết với kho ERP.', 403);
        }
        throw new ScannerAccessError('Kho ERP của cửa hàng chưa có vị trí xuất kho nào đang hoạt động.', 403);
    }

    return [...uniquePlacements.values()].sort((a, b) =>
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
