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
        // Firestore doesn't support full-text search, so we use a range query
        // on the 'name' field for prefix matching
        const snap = await db
            .collection('users')
            .where('isActive', '==', true)
            .orderBy('name')
            .startAt(q)
            .endAt(q + '\uf8ff')
            .limit(5)
            .get();

        return snap.docs.map(d => {
            const data = d.data();
            return {
                uid: d.id,
                name: data.name || '',
                phone: data.phone || '',
                storeId: data.storeId || '',
                referralPoints: data.referralPoints ?? 0,
            };
        });
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

            tx.update(userRef, { referralPoints: newPoints });

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

            // Deduct points from employee
            tx.update(userRef, { referralPoints: newPoints });

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
