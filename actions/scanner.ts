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
};

function getErrorMessage(err: unknown) {
    return err instanceof Error ? err.message : String(err);
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

export async function preloadScannerData(wmsWarehouseId?: string, wmsLocationId?: string, options?: { includeEmployees?: boolean }): Promise<{
    employees: PreloadedEmployee[];
    products: PreloadedProduct[];
}> {
    const db = getAdminDb();
    const includeEmployees = options?.includeEmployees !== false;

    const fetchProducts = async () => {
        if (!wmsWarehouseId) return { success: false, data: [] };
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 8000);
        try {
            const apiUrl = (process.env.WMS_API_URL || '').replace('localhost', '127.0.0.1');
            const params = new URLSearchParams({ warehouse_id: wmsWarehouseId });
            if (wmsLocationId) params.set('warehouse_location_id', wmsLocationId);
            const res = await fetch(`${apiUrl}/api/external/v1/products?${params.toString()}`, {
                headers: {
                    'x-api-key': process.env.WMS_API_KEY || ''
                },
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
    const visibleProducts = wmsLocationId
        ? rawProducts.filter(p => Number(p.atp_quantity ?? 0) > 0)
        : rawProducts;

    const products: PreloadedProduct[] = visibleProducts.map(p => ({
        id: p.id,
        name: p.name || '',
        barcode: p.barcode || '',
        companyCode: p.code || '',
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
        const apiUrl = (process.env.WMS_API_URL || '').replace('localhost', '127.0.0.1');
        const res = await fetch(`${apiUrl}/api/external/v1/scan`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-api-key': process.env.WMS_API_KEY || ''
            },
            body: JSON.stringify({
                ...data,
                scan_time: new Date().toISOString(),
            }),
            signal: controller.signal
        });
        clearTimeout(timeout);
        return res.json();
    } catch (err: unknown) {
        clearTimeout(timeout);
        return { success: false, data: null, messages: { vi: `Network Error: ${getErrorMessage(err)}` } };
    }
}

export async function getMyScansAction(operator_id_external: string) {
    if (!operator_id_external) return { success: false, data: [] };
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);
    try {
        const apiUrl = (process.env.WMS_API_URL || '').replace('localhost', '127.0.0.1');
        const res = await fetch(`${apiUrl}/api/external/v1/scan?operator_id_external=${operator_id_external}`, {
            headers: {
                'x-api-key': process.env.WMS_API_KEY || ''
            },
            cache: 'no-store',
            signal: controller.signal
        });
        clearTimeout(timeout);
        return res.json();
    } catch (err: unknown) {
        clearTimeout(timeout);
        return { success: false, data: null, error: getErrorMessage(err) };
    }
}

export async function getLocationScansAction(warehouseId: string, locationId: string) {
    if (!warehouseId || !locationId) return { success: false, data: [] };
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);
    try {
        const apiUrl = (process.env.WMS_API_URL || '').replace('localhost', '127.0.0.1');
        const params = new URLSearchParams({
            warehouse_id: warehouseId,
            warehouse_location_id: locationId,
        });
        const res = await fetch(`${apiUrl}/api/external/v1/scan?${params.toString()}`, {
            headers: {
                'x-api-key': process.env.WMS_API_KEY || ''
            },
            cache: 'no-store',
            signal: controller.signal
        });
        clearTimeout(timeout);
        return res.json();
    } catch (err: unknown) {
        clearTimeout(timeout);
        return { success: false, data: null, error: getErrorMessage(err) };
    }
}

export async function cancelExternalScanAction(scanId: string) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);
    try {
        const apiUrl = (process.env.WMS_API_URL || '').replace('localhost', '127.0.0.1');
        const res = await fetch(`${apiUrl}/api/external/v1/scan/${scanId}`, {
            method: 'DELETE',
            headers: {
                'x-api-key': process.env.WMS_API_KEY || ''
            },
            signal: controller.signal
        });
        clearTimeout(timeout);
        return res.json();
    } catch (err: unknown) {
        clearTimeout(timeout);
        return { success: false, error: getErrorMessage(err) };
    }
}

export async function submitBatchAction(data: Record<string, unknown>) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);
    try {
        const apiUrl = (process.env.WMS_API_URL || '').replace('localhost', '127.0.0.1');
        const res = await fetch(`${apiUrl}/api/external/v1/batch-submit`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-api-key': process.env.WMS_API_KEY || ''
            },
            body: JSON.stringify(data),
            signal: controller.signal
        });
        clearTimeout(timeout);
        return res.json();
    } catch (err: unknown) {
        clearTimeout(timeout);
        return { success: false, error: getErrorMessage(err) };
    }
}

export async function getAvailableWmsWarehousesAction() {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);
    try {
        const apiUrl = (process.env.WMS_API_URL || '').replace('localhost', '127.0.0.1');
        const res = await fetch(`${apiUrl}/api/external/v1/warehouses`, {
            headers: {
                'x-api-key': process.env.WMS_API_KEY || ''
            },
            cache: 'no-store',
            signal: controller.signal
        });
        clearTimeout(timeout);
        const data = await res.json();
        return data;
    } catch (err: unknown) {
        clearTimeout(timeout);
        return { success: false, data: [], error: getErrorMessage(err), apiUrl: process.env.WMS_API_URL };
    }
}

export async function getWmsLocationsAction(warehouseId: string) {
    if (!warehouseId) return { success: false, data: [] };
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);
    try {
        const apiUrl = (process.env.WMS_API_URL || '').replace('localhost', '127.0.0.1');
        const res = await fetch(`${apiUrl}/api/external/v1/locations?warehouse_id=${warehouseId}`, {
            headers: {
                'x-api-key': process.env.WMS_API_KEY || ''
            },
            cache: 'no-store',
            signal: controller.signal
        });
        clearTimeout(timeout);
        return await res.json();
    } catch (err: unknown) {
        clearTimeout(timeout);
        return { success: false, data: [], error: getErrorMessage(err) };
    }
}

export async function getWmsWarehouseMappingAction(type: 'STORE' | 'CENTRAL' | 'OFFICE', locationId: string) {
    if (!locationId) return { success: false, wmsWarehouseId: null };
    const db = getAdminDb();
    try {
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
