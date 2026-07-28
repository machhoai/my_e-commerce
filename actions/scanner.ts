'use server';

/**
 * ═══════════════════════════════════════════════════════════════
 * Universal Scanner — Server Actions
 * ═══════════════════════════════════════════════════════════════
 *
 * Strategy:
 *   • Employees + Products are preloaded ONCE when the modal opens
 *     and searched locally on the client → instant results.
 *   • Only voucher lookups hit the server (1M+ docs, must use Firestore).
 */

import { getAdminDb } from '@/lib/firebase-admin';
import type { VoucherCode, ScanResult } from '@/types';
import { fetchWmsApi } from '@/lib/wms-api';
import {
    getScannerPlacementsForUser,
    requireScannerPlacementByWms,
    requireScannerUser,
    requireSessionUser,
    requireStoreSettingsManager,
    ScannerAccessError,
} from '@/lib/scanner-access';
import type { ScannerPlacement } from '@/lib/scanner-access';

const PHONE_REGEX = /^(03|05|07|08|09)\d{8}$/;

type WmsProduct = {
    id: string;
    name?: string;
    barcode?: string;
    code?: string;
    image_url?: string | null;
    unit_price?: number;
    unit?: string;
    product_type?: string;
    atp_quantity?: number | null;
};

type WmsResponse<T> = {
    success: boolean;
    data: T;
    error?: string;
    messages?: { vi?: string; zh?: string };
    apiUrl?: string;
};

type ExternalScanPayload = {
    warehouse_id: string;
    barcode: string;
    product_id: string;
    warehouse_location_id: string;
    quantity: number;
    operator_name: string;
    operator_id_external: string;
    device_id: string | null;
    shift_id?: string;
    shift_date?: string;
};

export type ExternalCountCheckpointType = 'SHIFT_OPENING' | 'OPTIONAL_CLOSING';
export type ExternalCountItemCondition = 'GOOD' | 'DAMAGED' | 'EXPIRED' | 'MISSING';

export type ExternalCountItemPayload = {
    barcode?: string | null;
    product_id?: string | null;
    counted_quantity: number;
    base_atp?: number | null;
    condition?: ExternalCountItemCondition;
    evidence_urls?: string[];
    notes?: string | null;
};

export type ExternalCountCheckpointPayload = {
    warehouse_id: string;
    warehouse_location_id: string;
    checkpoint_type: ExternalCountCheckpointType;
    business_date: string;
    idempotency_key: string;
    external_operator_name?: string | null;
    external_operator_id?: string | null;
    shift_id: string;
    shift_date: string;
    authorized_operator_ids?: string[];
    device_id?: string | null;
    notes?: string | null;
    action_time?: string;
    items: ExternalCountItemPayload[];
};

export type ExternalCountState = {
    config: {
        id: string;
        enabled: boolean;
        require_before_scan: boolean;
        require_before_submit: boolean;
    };
    gates: {
        before_scan: boolean;
        before_submit: boolean;
    };
    access: {
        can_scan: boolean;
        current_shift_active: boolean;
        active_count_session_id: string | null;
        active_shift_id: string | null;
        active_shift_date: string | null;
        activated_at?: unknown;
    };
    checkpoints: Array<{
        id: string;
        session_number: string;
        checkpoint_type: ExternalCountCheckpointType | 'BEFORE_SCAN' | 'BEFORE_SUBMIT';
        status: string;
        discrepancy_count?: number;
        shift_id?: string | null;
        shift_date?: string | null;
        external_operator_id?: string | null;
    }>;
};

function getErrorMessage(err: unknown) {
    return err instanceof Error ? err.message : String(err);
}

function accessDenied(err: unknown) {
    const message = err instanceof ScannerAccessError ? err.message : getErrorMessage(err);
    return { success: false, data: null, error: message, messages: { vi: message } };
}

// ── Lightweight types for preloaded data ──────────────────────
export type PreloadedEmployee = {
    uid: string;
    name: string;
    phone: string;
    storeId: string;
    referralPoints: number;
};

export type PreloadedProduct = {
    id: string;
    name: string;
    barcode: string;
    companyCode: string;
    image: string;
    actualPrice: number;
    unit: string;
    category: string;
    origin: string;
    invoicePrice: number;
    minStock: number;
    atpQuantity: number;
    isActive: boolean;
    createdAt: string;
};

export async function preloadScannerData(wmsWarehouseId?: string, wmsLocationId?: string, options?: { includeEmployees?: boolean; includeZeroAtp?: boolean }): Promise<{
    employees: PreloadedEmployee[];
    products: PreloadedProduct[];
}> {
    await requireSessionUser();
    if (wmsWarehouseId || wmsLocationId) {
        if (!wmsWarehouseId || !wmsLocationId) {
            throw new ScannerAccessError('Thiếu thông tin kho hoặc quầy WMS.', 400);
        }
        await requireScannerPlacementByWms(wmsWarehouseId, wmsLocationId);
    }

    const db = getAdminDb();
    const includeEmployees = options?.includeEmployees !== false;

    const fetchProducts = async () => {
        if (!wmsWarehouseId) return { success: false, data: [] };
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 8000);
        try {
            const params = new URLSearchParams({ warehouse_id: wmsWarehouseId });
            if (wmsLocationId) params.set('warehouse_location_id', wmsLocationId);
            const path = `/api/external/v1/products?${params.toString()}`;
            const res = await fetchWmsApi(path, {
                cache: 'no-store',
                signal: controller.signal
            });
            clearTimeout(timeout);
            return await res.json() as WmsResponse<WmsProduct[]>;
        } catch (err: unknown) {
            const message = getErrorMessage(err);
            console.error('fetchProducts error:', message);
            return { success: false, data: [], error: message };
        }
    };

    const [empSnap, productsResponse] = await Promise.all([
        includeEmployees ? db.collection('users').where('isActive', '==', true).get() : Promise.resolve(null),
        fetchProducts(),
    ]);

    const employees: PreloadedEmployee[] = empSnap?.docs.map(d => {
        const data = d.data();
        return {
            uid: d.id,
            name: data.name || '',
            phone: data.phone || '',
            storeId: data.storeId || '',
            referralPoints: data.referralPoints ?? 0,
        };
    }) ?? [];

    const rawProducts: WmsProduct[] = Array.isArray(productsResponse.data) ? productsResponse.data : [];
    const visibleProducts = wmsLocationId && !options?.includeZeroAtp
        ? rawProducts.filter(p => Number(p.atp_quantity ?? 0) > 0)
        : rawProducts;

    const products: PreloadedProduct[] = visibleProducts.map(p => ({
        id: p.id,
        name: p.name || '',
        barcode: (p.barcode || '').trim(),
        companyCode: (p.code || '').trim(),
        image: p.image_url || '',
        actualPrice: p.unit_price || 0,
        unit: p.unit || '',
        category: p.product_type || '',
        origin: '',
        invoicePrice: 0,
        minStock: 0,
        atpQuantity: Number(p.atp_quantity ?? 0),
        isActive: true,
        createdAt: '',
    }));

    return { employees, products };
}

// ── Voucher-only search (the only thing that MUST hit Firestore) ──
export async function voucherSearchAction(input: string): Promise<ScanResult> {
    await requireSessionUser();
    const trimmed = input.trim();
    if (!trimmed) return { type: 'NOT_FOUND', data: null };

    const db = getAdminDb();

    // Phone → find distributed vouchers
    if (PHONE_REGEX.test(trimmed)) {
        const snap = await db
            .collection('voucher_codes')
            .where('distributedToPhone', '==', trimmed)
            .where('status', '==', 'distributed')
            .get();

        const vouchers: VoucherCode[] = snap.docs.map(d => ({
            id: d.id,
            ...d.data(),
        })) as VoucherCode[];

        return { type: 'PHONE', data: { phone: trimmed, vouchers } };
    }

    // Direct voucher code lookup
    const voucherSnap = await db.collection('voucher_codes').doc(trimmed).get();
    if (voucherSnap.exists) {
        const voucher = { id: voucherSnap.id, ...voucherSnap.data() } as VoucherCode;

        let campaignImage: string | undefined;
        let campaignName: string | undefined;
        if (voucher.campaignId) {
            const campSnap = await db.collection('voucher_campaigns').doc(voucher.campaignId).get();
            if (campSnap.exists) {
                const campData = campSnap.data();
                campaignImage = campData?.image;
                campaignName = campData?.name;
            }
        }

        return {
            type: 'VOUCHER',
            data: { ...voucher, campaignImage, campaignName },
        };
    }

    return { type: 'NOT_FOUND', data: null };
}

// ── Fallback: look up a single employee by UID ──────────────
export async function lookupEmployeeByUid(uid: string): Promise<PreloadedEmployee | null> {
    await requireSessionUser();
    const db = getAdminDb();
    const snap = await db.collection('users').doc(uid).get();
    if (!snap.exists) return null;
    const data = snap.data()!;
    return {
        uid: snap.id,
        name: data.name || '',
        phone: data.phone || '',
        storeId: data.storeId || '',
        referralPoints: data.referralPoints ?? 0,
    };
}

// ── WMS API Actions ──────────────────────────────────────────

export async function submitExternalScanAction(data: ExternalScanPayload) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);
    try {
        const { user, placement } = await requireScannerPlacementByWms(
            data.warehouse_id,
            data.warehouse_location_id,
            data.shift_id,
            data.shift_date,
        );
        const path = '/api/external/v1/scan';
        const rawBody = JSON.stringify({
            ...data,
            operator_name: user.name || user.email || 'Unknown',
            operator_id_external: user.uid,
            shift_id: placement.shiftId,
            shift_date: placement.shiftDate,
            scan_time: new Date().toISOString(),
        });
        const res = await fetchWmsApi(path, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: rawBody,
            signal: controller.signal
        });
        clearTimeout(timeout);
        return res.json();
    } catch (err: unknown) {
        clearTimeout(timeout);
        if (err instanceof ScannerAccessError) return accessDenied(err);
        return { success: false, data: null, messages: { vi: `Network Error: ${getErrorMessage(err)}` } };
    }
}

export async function getMyScansAction(_operator_id_external?: string) {
    void _operator_id_external;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);
    try {
        const user = await requireScannerUser();
        const placements = await getScannerPlacementsForUser(user);
        const allowedPairs = new Set(placements.map(item => `${item.wmsWarehouseId}:${item.wmsLocationId}`));
        const path = `/api/external/v1/scan?operator_id_external=${encodeURIComponent(user.uid)}`;
        const res = await fetchWmsApi(path, {
            cache: 'no-store',
            signal: controller.signal
        });
        clearTimeout(timeout);
        const result = await res.json();
        if (result.success && Array.isArray(result.data)) {
            result.data = result.data.filter((scan: { warehouse_id?: string; warehouse_location_id?: string }) =>
                allowedPairs.has(`${scan.warehouse_id || ''}:${scan.warehouse_location_id || ''}`)
            );
        }
        return result;
    } catch (err: unknown) {
        clearTimeout(timeout);
        if (err instanceof ScannerAccessError) return accessDenied(err);
        return { success: false, data: null, error: getErrorMessage(err) };
    }
}

export async function getLocationScansAction(warehouseId: string, locationId: string) {
    if (!warehouseId || !locationId) return { success: false, data: [] };
    const fetchLocationQueue = async (path: string) => {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 5000);
        try {
            const res = await fetchWmsApi(path, {
                cache: 'no-store',
                signal: controller.signal
            });
            clearTimeout(timeout);
            const text = await res.text();
            const contentType = res.headers.get('content-type') || '';
            const isJson = contentType.includes('application/json');
            if (!isJson) {
                return {
                    status: res.status,
                    isJson: false,
                    body: {
                        success: false,
                        data: null,
                        error: `WMS returned non-JSON response (${res.status}): ${text.slice(0, 120)}`,
                    },
                };
            }

            return {
                status: res.status,
                isJson: true,
                body: JSON.parse(text),
            };
        } catch (err: unknown) {
            clearTimeout(timeout);
            throw err;
        }
    };

    try {
        await requireScannerPlacementByWms(warehouseId, locationId);
        const params = new URLSearchParams({
            warehouse_id: warehouseId,
            warehouse_location_id: locationId,
        });

        const primary = await fetchLocationQueue(`/api/external/v1/location-queue?${params.toString()}`);
        if (primary.isJson && primary.status !== 404) return primary.body;

        const fallback = await fetchLocationQueue(`/api/external/v1/scan?${params.toString()}`);
        return fallback.body;
    } catch (err: unknown) {
        if (err instanceof ScannerAccessError) return accessDenied(err);
        return { success: false, data: null, error: getErrorMessage(err) };
    }
}

export async function cancelExternalScanAction(scanId: string) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);
    try {
        const user = await requireScannerUser();
        const placements = await getScannerPlacementsForUser(user);
        const allowedPairs = new Set(placements.map(item => `${item.wmsWarehouseId}:${item.wmsLocationId}`));

        const ownScansPath = `/api/external/v1/scan?operator_id_external=${encodeURIComponent(user.uid)}`;
        const ownScansResponse = await fetchWmsApi(ownScansPath, {
            cache: 'no-store',
            signal: controller.signal,
        });
        const ownScansResult = await ownScansResponse.json();
        const target = Array.isArray(ownScansResult.data)
            ? ownScansResult.data.find((scan: { id?: string }) => scan.id === scanId)
            : null;
        if (!target || !allowedPairs.has(`${target.warehouse_id || ''}:${target.warehouse_location_id || ''}`)) {
            throw new ScannerAccessError('Bạn không có quyền xóa lượt quét này.', 403);
        }

        const deletePath = `/api/external/v1/scan/${encodeURIComponent(scanId)}`;
        const res = await fetchWmsApi(deletePath, {
            method: 'DELETE',
            signal: controller.signal
        });
        clearTimeout(timeout);
        return res.json();
    } catch (err: unknown) {
        clearTimeout(timeout);
        if (err instanceof ScannerAccessError) return accessDenied(err);
        return { success: false, error: getErrorMessage(err) };
    }
}

export async function getScannerAccessAction(): Promise<{
    success: boolean;
    placements: ScannerPlacement[];
    error?: string;
}> {
    try {
        const user = await requireScannerUser();
        const placements = await getScannerPlacementsForUser(user);
        return {
            success: placements.length > 0,
            placements,
            error: placements.length > 0
                ? undefined
                : 'Bạn chưa được phân công vào quầy đang hoạt động.',
        };
    } catch (err: unknown) {
        return { success: false, placements: [], error: getErrorMessage(err) };
    }
}

export async function getAvailableWmsWarehousesAction() {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);
    try {
        await requireSessionUser();
        const res = await fetchWmsApi('/api/external/v1/warehouses', {
            cache: 'no-store',
            signal: controller.signal
        });
        clearTimeout(timeout);
        const data = await res.json();
        return data;
    } catch (err: unknown) {
        clearTimeout(timeout);
        if (err instanceof ScannerAccessError) return accessDenied(err);
        return { success: false, data: [], error: getErrorMessage(err), apiUrl: process.env.WMS_API_URL };
    }
}

export async function getWmsLocationsAction(warehouseId: string) {
    if (!warehouseId) return { success: false, data: [] };
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);
    try {
        await requireSessionUser();
        const path = `/api/external/v1/locations?warehouse_id=${encodeURIComponent(warehouseId)}`;
        const res = await fetchWmsApi(path, {
            cache: 'no-store',
            signal: controller.signal
        });
        clearTimeout(timeout);
        return await res.json();
    } catch (err: unknown) {
        clearTimeout(timeout);
        if (err instanceof ScannerAccessError) return accessDenied(err);
        return { success: false, data: [], error: getErrorMessage(err) };
    }
}

export async function getManageableWmsLocationsAction(storeId: string) {
    if (!storeId) return { success: false, data: [], error: 'Thiếu cửa hàng.' };
    try {
        await requireStoreSettingsManager(storeId);
        const storeSnap = await getAdminDb().collection('stores').doc(storeId).get();
        if (!storeSnap.exists) return { success: false, data: [], error: 'Không tìm thấy cửa hàng.' };
        const warehouseId = storeSnap.data()?.wmsWarehouseId || '';
        if (!warehouseId) return { success: false, data: [], error: 'Cửa hàng chưa liên kết với hệ thống ERP.' };

        const path = `/api/external/v1/locations?warehouse_id=${encodeURIComponent(warehouseId)}`;
        const response = await fetchWmsApi(path, {
            cache: 'no-store',
        });
        const result = await response.json();
        if (result.success && (!Array.isArray(result.data) || result.data.length === 0)) {
            return {
                success: false,
                data: [],
                error: 'Kho ERP đang liên kết không tồn tại hoặc chưa có vị trí đang hoạt động.',
                warehouseId,
            };
        }
        return { ...result, warehouseId };
    } catch (err: unknown) {
        return { success: false, data: [], error: getErrorMessage(err) };
    }
}

export async function getWmsWarehouseMappingAction(type: 'STORE' | 'CENTRAL' | 'OFFICE', locationId: string) {
    if (!locationId) return { success: false, wmsWarehouseId: null };
    const db = getAdminDb();
    try {
        const user = await requireSessionUser();
        const isAdmin = user.role === 'admin' || user.role === 'super_admin';
        if (!isAdmin && type === 'STORE' && user.storeId !== locationId) {
            throw new ScannerAccessError('Bạn không có quyền xem liên kết kho này.', 403);
        }
        let docRef;
        if (type === 'STORE' || type === 'OFFICE') {
            docRef = db.collection('stores').doc(locationId);
        } else if (type === 'CENTRAL') {
            docRef = db.collection('warehouses').doc(locationId);
        } else {
            return { success: false, wmsWarehouseId: null };
        }

        const snap = await docRef.get();
        if (!snap.exists) return { success: false, wmsWarehouseId: null };
        const data = snap.data();
        return { success: true, wmsWarehouseId: data?.wmsWarehouseId || null };
    } catch {
        return { success: false, wmsWarehouseId: null };
    }
}

export async function getExternalCountStateAction(
    warehouseId: string,
    warehouseLocationId: string,
    businessDate: string,
    shiftId?: string,
    shiftDate?: string,
): Promise<WmsResponse<ExternalCountState>> {
    if (!warehouseId || !warehouseLocationId || !businessDate) {
        return {
            success: false,
            data: null as unknown as ExternalCountState,
            messages: { vi: 'Thiếu kho, vị trí hoặc ngày kiểm đếm.' },
        };
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);

    try {
        const { user, placement } = await requireScannerPlacementByWms(
            warehouseId,
            warehouseLocationId,
            shiftId,
            shiftDate,
        );
        const params = new URLSearchParams({
            warehouse_id: warehouseId,
            warehouse_location_id: warehouseLocationId,
            business_date: businessDate,
            operator_id_external: user.uid,
            shift_id: placement.shiftId,
            shift_date: placement.shiftDate,
        });
        const path = `/api/external/v1/count/state?${params.toString()}`;
        const response = await fetchWmsApi(path, {
            cache: 'no-store',
            signal: controller.signal,
        });
        return await response.json() as WmsResponse<ExternalCountState>;
    } catch (err: unknown) {
        return {
            success: false,
            data: null as unknown as ExternalCountState,
            messages: { vi: `Không thể tải trạng thái kiểm đếm: ${getErrorMessage(err)}` },
        };
    } finally {
        clearTimeout(timeout);
    }
}

export async function submitExternalCountCheckpointAction(
    payload: ExternalCountCheckpointPayload,
): Promise<WmsResponse<Record<string, unknown>>> {
    const path = '/api/external/v1/count';
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000);

    try {
        const { user, placement } = await requireScannerPlacementByWms(
            payload.warehouse_id,
            payload.warehouse_location_id,
            payload.shift_id,
            payload.shift_date,
        );
        if (payload.checkpoint_type === 'SHIFT_OPENING' && !placement.canStartOpeningCount) {
            throw new ScannerAccessError(
                'Ca này thuộc ngày trước và chỉ được giữ quyền quét đến lúc ca mới bàn giao; không thể mở lại kiểm kê đầu ca.',
                409,
            );
        }
        const securedPayload = {
            ...payload,
            external_operator_name: user.name || user.email || 'Unknown',
            external_operator_id: user.uid,
            shift_id: placement.shiftId,
            shift_date: placement.shiftDate,
            business_date: placement.shiftDate,
            authorized_operator_ids: placement.operatorIds,
        };
        const securedRawBody = JSON.stringify(securedPayload);
        const response = await fetchWmsApi(path, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: securedRawBody,
            cache: 'no-store',
            signal: controller.signal,
        });
        return await response.json() as WmsResponse<Record<string, unknown>>;
    } catch (err: unknown) {
        return {
            success: false,
            data: {},
            messages: { vi: `Không thể gửi kiểm đếm: ${getErrorMessage(err)}` },
        };
    } finally {
        clearTimeout(timeout);
    }
}
