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

// ── Preload all employees + products (called once on modal open) ──
export async function preloadScannerData(): Promise<{
    employees: PreloadedEmployee[];
    products: PreloadedProduct[];
}> {
    const db = getAdminDb();

    const [empSnap, prodSnap] = await Promise.all([
        db.collection('users').where('isActive', '==', true).get(),
        db.collection('products').where('isActive', '==', true).get(),
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

    const products: PreloadedProduct[] = prodSnap.docs.map(d => {
        const data = d.data();
        return {
            id: d.id,
            name: data.name || '',
            barcode: data.barcode || '',
            companyCode: data.companyCode || '',
            image: data.image || '',
            actualPrice: data.actualPrice ?? 0,
            unit: data.unit || '',
            category: data.category || '',
            origin: data.origin || '',
            invoicePrice: data.invoicePrice ?? 0,
            minStock: data.minStock ?? 0,
            isActive: true,
            createdAt: data.createdAt || '',
        };
    });

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
