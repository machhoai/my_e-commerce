/**
 * voucher-queries.ts — Server-side Firestore utilities for high-performance voucher operations.
 *
 * Uses getCountFromServer() for aggregate stats (zero doc reads),
 * cursor-based pagination with startAfter/limit, and indexed phone lookups.
 *
 * ── Required Composite Indexes (create in Firebase Console) ──
 * 1. voucher_codes: campaignId ASC, status ASC
 * 2. voucher_codes: campaignId ASC, status ASC, distributedAt DESC
 * 3. voucher_codes: distributedToPhone ASC, distributedAt DESC
 * 4. voucher_codes: status ASC, validTo ASC
 */

import { getAdminDb } from '@/lib/firebase-admin';
import type { VoucherCode } from '@/types';

// ─── Types ───────────────────────────────────────────────────────
export interface CampaignVoucherStats {
    total: number;
    available: number;
    distributed: number;
    used: number;
    revoked: number;
}

export interface PaginatedVouchersResult {
    codes: (VoucherCode & { usedByStaffName?: string })[];
    lastDocId: string | null;
    hasMore: boolean;
}

export async function getCampaignVoucherStats(campaignId: string): Promise<CampaignVoucherStats> {
    const db = getAdminDb();
    const codesRef = db.collection('voucher_codes');
    const base = codesRef.where('campaignId', '==', campaignId);

    const [totalSnap, availableSnap, distributedSnap, usedSnap, revokedSnap] = await Promise.all([
        base.count().get(),
        base.where('status', '==', 'available').count().get(),
        base.where('status', '==', 'distributed').count().get(),
        base.where('status', '==', 'used').count().get(),
        base.where('status', '==', 'revoked').count().get(),
    ]);

    return {
        total: totalSnap.data().count,
        available: availableSnap.data().count,
        distributed: distributedSnap.data().count,
        used: usedSnap.data().count,
        revoked: revokedSnap.data().count,
    };
}

/** Get stats for ALL campaigns at once */
export async function getAllCampaignStats(campaignIds: string[]): Promise<Record<string, CampaignVoucherStats>> {
    const results: Record<string, CampaignVoucherStats> = {};
    // Process in parallel batches of 5 to avoid overwhelming Firestore
    const BATCH = 5;
    for (let i = 0; i < campaignIds.length; i += BATCH) {
        const chunk = campaignIds.slice(i, i + BATCH);
        const stats = await Promise.all(chunk.map(id => getCampaignVoucherStats(id)));
        chunk.forEach((id, idx) => { results[id] = stats[idx]; });
    }
    return results;
}

/** Get global aggregate counts across all campaigns (for dashboard KPIs) */
export async function getGlobalVoucherStats(): Promise<CampaignVoucherStats> {
    const db = getAdminDb();
    const codesRef = db.collection('voucher_codes');

    const [totalSnap, availableSnap, distributedSnap, usedSnap, revokedSnap] = await Promise.all([
        codesRef.count().get(),
        codesRef.where('status', '==', 'available').count().get(),
        codesRef.where('status', '==', 'distributed').count().get(),
        codesRef.where('status', '==', 'used').count().get(),
        codesRef.where('status', '==', 'revoked').count().get(),
    ]);

    return {
        total: totalSnap.data().count,
        available: availableSnap.data().count,
        distributed: distributedSnap.data().count,
        used: usedSnap.data().count,
        revoked: revokedSnap.data().count,
    };
}

// ─── 2. Cursor-Paginated Voucher List ────────────────────────────
export async function getVouchersPaginated(opts: {
    campaignId?: string;
    status?: string;       // 'available' | 'distributed' | 'used' | 'revoked'
    rewardType?: string;   // 'discount_percent' | 'free_ticket' etc
    search?: string;       // phone number partial match or exact voucher ID
    lastDocId?: string;    // cursor for pagination
    pageSize?: number;
}): Promise<PaginatedVouchersResult> {
    const db = getAdminDb();
    const { campaignId, status, rewardType, search, lastDocId, pageSize = 50 } = opts;

    // If search is provided
    if (search) {
        const s = search.trim();
        // Check if it's a phone number (only numbers, min 3 length)
        if (/^[0-9]{3,}$/.test(s)) {
            return findVouchersByPhonePaginated(s, lastDocId, pageSize);
        } else {
            // Treat as exact Voucher ID search
            const docRef = db.collection('voucher_codes').doc(s.toUpperCase());
            const docSnap = await docRef.get();
            if (docSnap.exists) {
                const code = { id: docSnap.id, ...docSnap.data() } as VoucherCode;
                // Client-side verify if it matches other conditions
                if (status && code.status !== status) return { codes: [], lastDocId: null, hasMore: false };
                if (campaignId && code.campaignId !== campaignId) return { codes: [], lastDocId: null, hasMore: false };
                if (rewardType && code.rewardType !== rewardType) return { codes: [], lastDocId: null, hasMore: false };
                
                const returnCodes = [code];
                await enrichStaffNames(db, returnCodes);
                return { codes: returnCodes, lastDocId: docSnap.id, hasMore: false };
            }
            return { codes: [], lastDocId: null, hasMore: false };
        }
    }

    let q: FirebaseFirestore.Query = db.collection('voucher_codes');

    // Apply filters
    if (campaignId) {
        q = q.where('campaignId', '==', campaignId);
    }
    if (status) {
        q = q.where('status', '==', status);
    }
    if (rewardType) {
        q = q.where('rewardType', '==', rewardType);
    }

    // Order by document ID for stable cursor pagination
    q = q.orderBy('__name__');

    // Cursor: start after the last document
    if (lastDocId) {
        const lastDocRef = db.collection('voucher_codes').doc(lastDocId);
        const lastDocSnap = await lastDocRef.get();
        if (lastDocSnap.exists) {
            q = q.startAfter(lastDocSnap);
        }
    }

    // Fetch one extra to detect if there are more pages
    const snapshot = await q.limit(pageSize + 1).get();
    const hasMore = snapshot.docs.length > pageSize;
    const docs = hasMore ? snapshot.docs.slice(0, pageSize) : snapshot.docs;

    const codes = docs.map(d => ({ id: d.id, ...d.data() })) as (VoucherCode & { usedByStaffName?: string })[];

    // Enrich with staff names (only for this page — max 50 docs)
    await enrichStaffNames(db, codes);

    return {
        codes,
        lastDocId: docs.length > 0 ? docs[docs.length - 1].id : null,
        hasMore,
    };
}

// ─── 3. Phone Lookup (indexed, fast) ─────────────────────────────
export async function findVouchersByPhone(phone: string, limit = 10): Promise<VoucherCode[]> {
    const db = getAdminDb();
    const snapshot = await db.collection('voucher_codes')
        .where('distributedToPhone', '==', phone)
        .orderBy('__name__')
        .limit(limit)
        .get();

    return snapshot.docs.map(d => ({ id: d.id, ...d.data() })) as VoucherCode[];
}

/** Paginated variant for the UI phone search */
async function findVouchersByPhonePaginated(
    phone: string,
    lastDocId?: string,
    pageSize = 50,
): Promise<PaginatedVouchersResult> {
    const db = getAdminDb();
    let q: FirebaseFirestore.Query = db.collection('voucher_codes')
        .where('distributedToPhone', '==', phone)
        .orderBy('__name__');

    if (lastDocId) {
        const lastDocSnap = await db.collection('voucher_codes').doc(lastDocId).get();
        if (lastDocSnap.exists) {
            q = q.startAfter(lastDocSnap);
        }
    }

    const snapshot = await q.limit(pageSize + 1).get();
    const hasMore = snapshot.docs.length > pageSize;
    const docs = hasMore ? snapshot.docs.slice(0, pageSize) : snapshot.docs;

    const codes = docs.map(d => ({ id: d.id, ...d.data() })) as (VoucherCode & { usedByStaffName?: string })[];
    await enrichStaffNames(db, codes);

    return {
        codes,
        lastDocId: docs.length > 0 ? docs[docs.length - 1].id : null,
        hasMore,
    };
}

// ─── Helper: Enrich codes with staff names ───────────────────────
async function enrichStaffNames(
    db: FirebaseFirestore.Firestore,
    codes: (VoucherCode & { usedByStaffName?: string })[],
) {
    const staffIds = [...new Set(codes.map(c => c.usedByStaffId).filter(Boolean))] as string[];
    if (staffIds.length === 0) return;

    const staffMap = new Map<string, string>();
    // Firestore 'in' supports max 30 per query
    for (let i = 0; i < staffIds.length; i += 30) {
        const chunk = staffIds.slice(i, i + 30);
        const snap = await db.collection('users').where('__name__', 'in', chunk).select('name').get();
        snap.docs.forEach(d => staffMap.set(d.id, d.data().name || d.id));
    }
    codes.forEach(c => {
        if (c.usedByStaffId && staffMap.has(c.usedByStaffId)) {
            c.usedByStaffName = staffMap.get(c.usedByStaffId);
        }
    });
}
