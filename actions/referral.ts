'use server';

/**
 * ═══════════════════════════════════════════════════════════════
 * Referral Points — Server Actions
 * ═══════════════════════════════════════════════════════════════
 *
 * Handles pending referral ticket creation and point transaction queries.
 */

import { getAdminDb } from '@/lib/firebase-admin';
import type { PendingReferralDoc, PointTransactionDoc, ReferralPackage } from '@/types';
import { FieldValue } from 'firebase-admin/firestore';
import { broadcastByEvent } from '@/lib/notification-engine';

/** Get month key "YYYY-MM" from an ISO date string or current date */
function getMonthKey(isoDate?: string): string {
    const d = isoDate ? new Date(isoDate) : new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

// ── Create Pending Referral ────────────────────────────────────
export async function createPendingReferral(data: {
    saleEmployeeId: string;
    saleEmployeeName: string;
    cashierId: string;
    customerPhone: string;
    expectedPackage: ReferralPackage;
}): Promise<{ success: boolean; id?: string; error?: string }> {
    try {
        const db = getAdminDb();
        const now = new Date();
        const expiresAt = new Date(now.getTime() + 5 * 60 * 1000); // +5 minutes

        const docRef = await db.collection('pending_referrals').add({
            saleEmployeeId: data.saleEmployeeId,
            saleEmployeeName: data.saleEmployeeName,
            cashierId: data.cashierId,
            customerPhone: data.customerPhone,
            expectedPackage: data.expectedPackage,
            status: 'waiting',
            expiresAt: expiresAt.toISOString(),
            createdAt: now.toISOString(),
        });

        return { success: true, id: docRef.id };
    } catch (err) {
        console.error('[createPendingReferral]', err);
        return { success: false, error: 'Không thể tạo phiên chờ. Vui lòng thử lại.' };
    }
}

// ── Get Point Transactions ─────────────────────────────────────
export async function getPointTransactions(
    employeeId: string,
    limit = 20,
): Promise<PointTransactionDoc[]> {
    try {
        const db = getAdminDb();
        const snap = await db
            .collection('point_transactions')
            .where('employeeId', '==', employeeId)
            .orderBy('createdAt', 'desc')
            .limit(limit)
            .get();

        return snap.docs.map(d => ({
            id: d.id,
            ...d.data(),
        })) as PointTransactionDoc[];
    } catch (err) {
        console.error('[getPointTransactions]', err);
        return [];
    }
}

// ── Get Top 3 Employees by Monthly Referral Points ────────────
export async function getTopReferralEmployees(): Promise<
    { uid: string; name: string; points: number }[]
> {
    try {
        const db = getAdminDb();
        const monthKey = getMonthKey();

        // Fetch all active users that have monthlyReferralPoints
        const snap = await db
            .collection('users')
            .where('isActive', '==', true)
            .get();

        if (snap.empty) return [];

        // Extract current month points and filter > 0
        const employees = snap.docs
            .map(d => {
                const data = d.data();
                const monthlyPts = (data.monthlyReferralPoints as Record<string, number> | undefined) ?? {};
                return {
                    uid: d.id,
                    name: (data.name ?? 'Nhân viên') as string,
                    points: monthlyPts[monthKey] ?? 0,
                };
            })
            .filter(e => e.points > 0)
            .sort((a, b) => b.points - a.points)
            .slice(0, 3);

        return employees;
    } catch (err) {
        console.error('[getTopReferralEmployees]', err);
        return [];
    }
}

// ── Get Referral Points for an Employee ────────────────────────
export async function getReferralPoints(employeeId: string): Promise<number> {
    try {
        const db = getAdminDb();
        const snap = await db.collection('users').doc(employeeId).get();
        if (!snap.exists) return 0;
        return snap.data()?.referralPoints ?? 0;
    } catch (err) {
        console.error('[getReferralPoints]', err);
        return 0;
    }
}

// ── TODO: POS Order Matching ──────────────────────────────────
// When the POS system registers an order, call this function to
// match it against pending_referrals and award points.
//
// TODO: Call existing POS order fetch API here
// export async function matchPendingReferral(orderCode: string, customerPhone: string, orderValue: number) {
//   1. Query pending_referrals where customerPhone == phone && status == 'waiting' && expiresAt > now
//   2. If found, update status to 'matched', set matchedOrderCode, matchedOrderValue, pointsAwarded
//   3. Create a point_transactions doc
//   4. Increment users/{saleEmployeeId}.referralPoints
// }

// ── Get Pending Referrals for an Employee ─────────────────────
export async function getPendingReferrals(
    employeeId: string,
    limit = 20,
): Promise<PendingReferralDoc[]> {
    try {
        const db = getAdminDb();
        const snap = await db
            .collection('pending_referrals')
            .where('saleEmployeeId', '==', employeeId)
            .orderBy('createdAt', 'desc')
            .limit(limit)
            .get();

        return snap.docs.map(d => ({
            id: d.id,
            ...d.data(),
        })) as PendingReferralDoc[];
    } catch (err) {
        console.error('[getPendingReferrals]', err);
        return [];
    }
}

// ── Get Store-wide Pending Referrals ──────────────────────────
export async function getStorePendingReferrals(
    storeId: string,
    limit = 50,
): Promise<PendingReferralDoc[]> {
    try {
        const db = getAdminDb();
        // Get all active employees in the store
        const usersSnap = await db
            .collection('users')
            .where('storeId', '==', storeId)
            .where('isActive', '==', true)
            .get();

        if (usersSnap.empty) return [];

        const employeeIds = usersSnap.docs.map(d => d.id);

        // Firestore 'in' query supports max 30 items — batch if needed
        const batches: string[][] = [];
        for (let i = 0; i < employeeIds.length; i += 30) {
            batches.push(employeeIds.slice(i, i + 30));
        }

        const allPending: PendingReferralDoc[] = [];

        for (const batch of batches) {
            const snap = await db
                .collection('pending_referrals')
                .where('saleEmployeeId', 'in', batch)
                .orderBy('createdAt', 'desc')
                .limit(limit)
                .get();

            snap.docs.forEach(d => {
                allPending.push({
                    id: d.id,
                    ...d.data(),
                } as PendingReferralDoc);
            });
        }

        // Sort combined results by createdAt desc and take limit
        allPending.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
        return allPending.slice(0, limit);
    } catch (err) {
        console.error('[getStorePendingReferrals]', err);
        return [];
    }
}

// ── Get ALL Pending Referrals (admin, no storeId filter) ──────
export async function getAllPendingReferrals(
    limit = 50,
): Promise<PendingReferralDoc[]> {
    try {
        const db = getAdminDb();
        const snap = await db
            .collection('pending_referrals')
            .orderBy('createdAt', 'desc')
            .limit(limit)
            .get();

        return snap.docs.map(d => ({
            id: d.id,
            ...d.data(),
        })) as PendingReferralDoc[];
    } catch (err) {
        console.error('[getAllPendingReferrals]', err);
        return [];
    }
}

// ── Get ALL Point Transactions (admin, no storeId filter) ─────
export async function getAllPointTransactions(
    limit = 100,
): Promise<(PointTransactionDoc & { employeeName?: string })[]> {
    try {
        const db = getAdminDb();
        const snap = await db
            .collection('point_transactions')
            .orderBy('createdAt', 'desc')
            .limit(limit)
            .get();

        const txns = snap.docs.map(d => ({
            id: d.id,
            ...d.data(),
        })) as (PointTransactionDoc & { employeeName?: string })[];

        // Enrich with employee names
        const uniqueIds = [...new Set(txns.map(t => t.employeeId))];
        if (uniqueIds.length > 0) {
            const batches: string[][] = [];
            for (let i = 0; i < uniqueIds.length; i += 30) {
                batches.push(uniqueIds.slice(i, i + 30));
            }
            const empMap = new Map<string, string>();
            for (const batch of batches) {
                const usersSnap = await db.collection('users').where('__name__', 'in', batch).get();
                usersSnap.docs.forEach(d => empMap.set(d.id, d.data().name || 'Nhân viên'));
            }
            txns.forEach(tx => { tx.employeeName = empMap.get(tx.employeeId) || 'Nhân viên'; });
        }

        return txns;
    } catch (err) {
        console.error('[getAllPointTransactions]', err);
        return [];
    }
}

// ── Get Store-wide Point Transactions ─────────────────────────
export async function getStorePointTransactions(
    storeId: string,
    limit = 50,
): Promise<(PointTransactionDoc & { employeeName?: string })[]> {
    try {
        const db = getAdminDb();
        // 1. Get all active employees in the store
        const usersSnap = await db
            .collection('users')
            .where('storeId', '==', storeId)
            .where('isActive', '==', true)
            .get();

        if (usersSnap.empty) return [];

        const empMap = new Map<string, string>();
        usersSnap.docs.forEach(d => {
            empMap.set(d.id, d.data().name || 'Nhân viên');
        });

        const employeeIds = Array.from(empMap.keys());

        // Firestore 'in' query supports max 30 items — batch if needed
        const batches: string[][] = [];
        for (let i = 0; i < employeeIds.length; i += 30) {
            batches.push(employeeIds.slice(i, i + 30));
        }

        const allTxns: (PointTransactionDoc & { employeeName?: string })[] = [];

        for (const batch of batches) {
            const snap = await db
                .collection('point_transactions')
                .where('employeeId', 'in', batch)
                .orderBy('createdAt', 'desc')
                .limit(limit)
                .get();

            snap.docs.forEach(d => {
                const data = d.data();
                allTxns.push({
                    id: d.id,
                    ...data,
                    employeeName: empMap.get(data.employeeId) || 'Nhân viên',
                } as PointTransactionDoc & { employeeName?: string });
            });
        }

        // Sort combined results by createdAt desc and take limit
        allTxns.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
        return allTxns.slice(0, limit);
    } catch (err) {
        console.error('[getStorePointTransactions]', err);
        return [];
    }
}

// ── Search Employees by Name ──────────────────────────────────
export async function searchEmployeesByName(
    query: string,
): Promise<{ uid: string; name: string; phone: string; storeId: string; referralPoints: number }[]> {
    const q = query.trim();
    if (!q || q.length < 2) return [];
    try {
        const db = getAdminDb();

        // Fetch all active employees and filter in-memory
        // (Firestore prefix search only matches from the start of the name field,
        //  which doesn't work for Vietnamese names where users search by first name — the last word)
        const snap = await db
            .collection('users')
            .where('isActive', '==', true)
            .limit(100)
            .get();

        // Normalize for diacritics-insensitive comparison
        const normalize = (s: string) =>
            s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/g, 'd').replace(/Đ/g, 'D');

        const qNorm = normalize(q);

        return snap.docs
            .map(d => {
                const data = d.data();
                return {
                    uid: d.id,
                    name: (data.name || '') as string,
                    phone: (data.phone || '') as string,
                    storeId: (data.storeId || '') as string,
                    referralPoints: (data.referralPoints ?? 0) as number,
                };
            })
            .filter(emp => {
                const nameNorm = normalize(emp.name);
                // Match if any word in the name starts with the query, or the full name contains it
                return nameNorm.includes(qNorm) ||
                    nameNorm.split(/\s+/).some(word => word.startsWith(qNorm));
            })
            .slice(0, 5);
    } catch (err) {
        console.error('[searchEmployeesByName]', err);
        return [];
    }
}

// ── Admin: Manual Point Adjustment ────────────────────────────
export async function adjustPoints(data: {
    employeeId: string;
    amount: number;
    reason: string;
    adminId: string;
}): Promise<{ success: boolean; error?: string }> {
    if (!data.reason.trim()) return { success: false, error: 'Lý do là bắt buộc.' };
    if (data.amount === 0) return { success: false, error: 'Số điểm phải khác 0.' };
    try {
        const db = getAdminDb();
        const userRef = db.collection('users').doc(data.employeeId);

        await db.runTransaction(async (tx) => {
            const userSnap = await tx.get(userRef);
            if (!userSnap.exists) throw new Error('Nhân viên không tồn tại.');

            const currentPoints = userSnap.data()?.referralPoints ?? 0;
            const newPoints = currentPoints + data.amount;
            const monthKey = getMonthKey();

            tx.update(userRef, {
                referralPoints: newPoints,
                [`monthlyReferralPoints.${monthKey}`]: FieldValue.increment(data.amount),
            });

            const txRef = db.collection('point_transactions').doc();
            tx.set(txRef, {
                employeeId: data.employeeId,
                type: 'manual_adjustment',
                points: data.amount,
                reason: data.reason.trim(),
                adminId: data.adminId,
                createdAt: new Date().toISOString(),
            });
        });
        // Broadcast congratulatory notification if points were ADDED
        if (data.amount > 0) {
            const db2 = getAdminDb();
            const empSnap = await db2.collection('users').doc(data.employeeId).get();
            const empName = empSnap.data()?.name || 'Nhân viên';
            broadcastByEvent({
                eventName: 'REFERRAL_POINTS_EARNED',
                dataContext: { employeeName: empName, points: data.amount },
            }).catch(err => console.error('[adjustPoints] broadcastByEvent error:', err));
        }

        return { success: true };
    } catch (err) {
        console.error('[adjustPoints]', err);
        return { success: false, error: err instanceof Error ? err.message : 'Lỗi không xác định.' };
    }
}

// ── Admin: Revoke Transaction (Clawback) ──────────────────────
export async function revokeTransaction(data: {
    transactionId: string;
    employeeId: string;
    originalPoints: number;
    adminId: string;
}): Promise<{ success: boolean; error?: string }> {
    try {
        const db = getAdminDb();
        const userRef = db.collection('users').doc(data.employeeId);
        const txRef = db.collection('point_transactions').doc(data.transactionId);

        await db.runTransaction(async (tx) => {
            const [userSnap, txSnap] = await Promise.all([
                tx.get(userRef),
                tx.get(txRef),
            ]);

            if (!userSnap.exists) throw new Error('Nhân viên không tồn tại.');
            if (!txSnap.exists) throw new Error('Giao dịch không tồn tại.');
            if (txSnap.data()?.isRevoked) throw new Error('Giao dịch đã được thu hồi.');

            const currentPoints = userSnap.data()?.referralPoints ?? 0;
            const deduction = -Math.abs(data.originalPoints);
            const newPoints = currentPoints + deduction;

            // Determine the month of the original transaction to deduct from correct month
            const originalTxData = txSnap.data();
            const txMonthKey = getMonthKey(originalTxData?.createdAt);

            // Deduct points from employee (total + monthly)
            tx.update(userRef, {
                referralPoints: newPoints,
                [`monthlyReferralPoints.${txMonthKey}`]: FieldValue.increment(deduction),
            });

            // Mark original transaction as revoked
            tx.update(txRef, { isRevoked: true });

            // Create revocation record
            const revRef = db.collection('point_transactions').doc();
            tx.set(revRef, {
                employeeId: data.employeeId,
                type: 'refund_revocation',
                points: deduction,
                linkedTransactionId: data.transactionId,
                reason: 'Khách đổi/trả sản phẩm',
                adminId: data.adminId,
                createdAt: new Date().toISOString(),
            });
        });

        return { success: true };
    } catch (err) {
        console.error('[revokeTransaction]', err);
        return { success: false, error: err instanceof Error ? err.message : 'Lỗi không xác định.' };
    }
}
