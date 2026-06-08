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
import type { ProductDoc } from '@/types/inventory';

const PHONE_REGEX = /^(03|05|07|08|09)\d{8}$/;

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
    isActive: boolean;
    createdAt: string;
};

export async function preloadScannerData(wmsWarehouseId?: string): Promise<{
    employees: PreloadedEmployee[];
    products: PreloadedProduct[];
}> {
    const db = getAdminDb();

    const fetchProducts = async () => {
        if (!wmsWarehouseId) return { success: false, data: [] };
        try {
            const res = await fetch(`${process.env.WMS_API_URL}/api/external/v1/products?warehouse_id=${wmsWarehouseId}`, {
                headers: {
                    'x-api-key': process.env.WMS_API_KEY || ''
                },
                cache: 'no-store'
            });
            return await res.json();
        } catch {
            return { success: false, data: [] };
        }
    };

    const [empSnap, productsResponse] = await Promise.all([
        db.collection('users').where('isActive', '==', true).get(),
        fetchProducts()
    ]);

    const employees: PreloadedEmployee[] = empSnap.docs.map(d => {
        const data = d.data();
        return {
            uid: d.id,
            name: data.name || '',
            phone: data.phone || '',
            storeId: data.storeId || '',
            referralPoints: data.referralPoints ?? 0,
        };
    });

    const products: PreloadedProduct[] = (productsResponse.data || []).map((p: any) => ({
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

export async function submitExternalScanAction(data: {
    warehouse_id: string;
    barcode: string;
    product_id: string;
    warehouse_location_id: string;
    quantity: number;
    operator_name: string;
    operator_id_external: string | null;
    device_id: string | null;
}) {
    const res = await fetch(`${process.env.WMS_API_URL}/api/external/v1/scan`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'x-api-key': process.env.WMS_API_KEY || ''
        },
        body: JSON.stringify({
            ...data,
            scan_time: new Date().toISOString(),
        })
    });
    
    return res.json();
}

export async function getMyScansAction(operatorIdExternal: string) {
    const res = await fetch(`${process.env.WMS_API_URL}/api/external/v1/scan?operator_id_external=${operatorIdExternal}`, {
        headers: {
            'x-api-key': process.env.WMS_API_KEY || ''
        },
        cache: 'no-store'
    });
    return res.json();
}

export async function cancelExternalScanAction(scanId: string) {
    const res = await fetch(`${process.env.WMS_API_URL}/api/external/v1/scan/${scanId}`, {
        method: 'DELETE',
        headers: {
            'x-api-key': process.env.WMS_API_KEY || ''
        }
    });
    return res.json();
}

export async function submitBatchAction(data: {
    warehouse_id: string;
    warehouse_location_id: string;
    shift_date: string;
    operator_name: string;
    operator_id_external: string | null;
    notes: string | null;
}) {
    const res = await fetch(`${process.env.WMS_API_URL}/api/external/v1/batch-submit`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'x-api-key': process.env.WMS_API_KEY || ''
        },
        body: JSON.stringify(data)
    });
    return res.json();
}

export async function getAvailableWmsWarehousesAction() {
    try {
        const res = await fetch(`${process.env.WMS_API_URL}/api/external/v1/warehouses`, {
            headers: {
                'x-api-key': process.env.WMS_API_KEY || ''
            },
            cache: 'no-store'
        });
        return await res.json();
    } catch {
        return { success: false, data: [] };
    }
}

export async function getWmsLocationsAction(warehouseId: string) {
    if (!warehouseId) return { success: false, data: [] };
    try {
        const res = await fetch(`${process.env.WMS_API_URL}/api/external/v1/locations?warehouse_id=${warehouseId}`, {
            headers: {
                'x-api-key': process.env.WMS_API_KEY || ''
            },
            cache: 'no-store'
        });
        return await res.json();
    } catch {
        return { success: false, data: [] };
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
