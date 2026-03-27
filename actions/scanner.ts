'use server';

/**
 * ═══════════════════════════════════════════════════════════════
 * Universal Scanner — Smart Search Action
 * ═══════════════════════════════════════════════════════════════
 *
 * Routes scanned input (QR/barcode/manual) to the correct handler:
 *   1. Phone number → find unused vouchers for this customer
 *   2. Voucher code → show voucher details for redemption
 *   3. Product barcode → show product info
 *   4. Not found → return NOT_FOUND
 */

import { getAdminDb } from '@/lib/firebase-admin';
import type { VoucherCode, ScanResult } from '@/types';
import type { ProductDoc } from '@/types/inventory';

const PHONE_REGEX = /^(03|05|07|08|09)\d{8}$/;

export async function universalSearchAction(input: string): Promise<ScanResult> {
    const trimmed = input.trim();
    if (!trimmed) return { type: 'NOT_FOUND', data: null };

    const db = getAdminDb();

    // ── 1. Phone Number ─────────────────────────────────────────
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

    // ── 2. Voucher Code ─────────────────────────────────────────
    const voucherSnap = await db.collection('voucher_codes').doc(trimmed).get();
    if (voucherSnap.exists) {
        const voucher = { id: voucherSnap.id, ...voucherSnap.data() } as VoucherCode;

        // Also fetch campaign info for image
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

    // ── 3. Product Barcode ──────────────────────────────────────
    const productSnap = await db
        .collection('products')
        .where('barcode', '==', trimmed)
        .limit(1)
        .get();

    if (!productSnap.empty) {
        const product = {
            id: productSnap.docs[0].id,
            ...productSnap.docs[0].data(),
        } as ProductDoc;
        return { type: 'PRODUCT', data: product };
    }

    // Also try companyCode
    const productByCode = await db
        .collection('products')
        .where('companyCode', '==', trimmed)
        .limit(1)
        .get();

    if (!productByCode.empty) {
        const product = {
            id: productByCode.docs[0].id,
            ...productByCode.docs[0].data(),
        } as ProductDoc;
        return { type: 'PRODUCT', data: product };
    }

    // ── 4. Employee Referral Code (REF-{uid}) ───────────────────
    if (trimmed.startsWith('REF-')) {
        const employeeUid = trimmed.slice(4); // Remove "REF-" prefix
        if (employeeUid) {
            const empSnap = await db.collection('users').doc(employeeUid).get();
            if (empSnap.exists) {
                const empData = empSnap.data();
                return {
                    type: 'REFERRAL',
                    data: {
                        uid: empSnap.id,
                        name: empData?.name || 'Nhân viên',
                        phone: empData?.phone || '',
                        storeId: empData?.storeId || '',
                        referralPoints: empData?.referralPoints ?? 0,
                    },
                };
            }
        }
    }

    // ── 5. Not Found ────────────────────────────────────────────
    return { type: 'NOT_FOUND', data: null };
}
