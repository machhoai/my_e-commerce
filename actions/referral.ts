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

        // Fetch all active users
        const snap = await db
            .collection('users')
            .where('isActive', '==', true)
            .get();

        if (snap.empty) return [];

        // Extract current month points, fallback to total referralPoints
        const employees = snap.docs
            .map(d => {
                const data = d.data();
                const monthlyPts = (data.monthlyReferralPoints as Record<string, number> | undefined) ?? {};
                const monthly = monthlyPts[monthKey] ?? 0;
                // Fallback: if no monthly data exists for current month,
                // use total referralPoints so employees aren't hidden
                const totalPts = (data.referralPoints ?? 0) as number;
                return {
                    uid: d.id,
                    name: (data.name ?? 'Nhân viên') as string,
                    points: monthly > 0 ? monthly : totalPts,
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

// ── Sync Referral Points: Match pending referrals with Joyworld orders ────────
export interface SyncReferralResult {
    matched: number;   // số referral được match & cộng điểm
    expired: number;   // số referral hết hạn & không có đơn
    skipped: number;   // số referral bỏ qua (đã xử lý trước đó)
    error?: string;
}

export async function syncReferralPoints(): Promise<SyncReferralResult> {
    try {
        const db = getAdminDb();

        // 1. Lấy tất cả pending referrals đang chờ
        const pendingSnap = await db
            .collection('pending_referrals')
            .where('status', '==', 'waiting')
            .get();

        if (pendingSnap.empty) {
            return { matched: 0, expired: 0, skipped: 0 };
        }

        const pendingDocs = pendingSnap.docs.map(d => ({
            id: d.id,
            ...d.data(),
        })) as import('@/types').PendingReferralDoc[];

        // 2. Lấy token Joyworld
        const { getJoyworldToken, getOrderList } = await import('@/lib/joyworld');
        const token = await getJoyworldToken();
        if (!token) {
            return { matched: 0, expired: 0, skipped: 0, error: 'Không thể xác thực với Joyworld' };
        }

        // 3. Xác định khoảng thời gian query: 30 ngày về trước → bây giờ
        const now = new Date();
        const past30 = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        const fmt = (d: Date) => d.toISOString().slice(0, 10).replace(/-/g, '-');
        const startTime = `${fmt(past30)} 00:00:00`;
        const endTime = `${fmt(now)} 23:59:59`;

        // 4. Fetch đơn hàng từ Joyworld (lấy tối đa 500 đơn gần nhất — đủ cho thực tế)
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        let orderItems: any[] = [];
        try {
            const orderRes = await getOrderList(token, { startTime, endTime, page: 1, limit: 500 });
            orderItems = orderRes?.data?.dataList ?? orderRes?.data?.list ?? orderRes?.data ?? [];
        } catch (fetchErr) {
            console.error('[syncReferralPoints] Joyworld order fetch error:', fetchErr);
            return { matched: 0, expired: 0, skipped: 0, error: 'Lỗi khi lấy đơn hàng từ Joyworld' };
        }

        // 5. Build map: phone → list of orders (phone chuẩn hoá về 10 số)
        const normalizePhone = (p: string) => p?.replace(/\D/g, '').replace(/^84/, '0').slice(-10);
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const phoneOrderMap = new Map<string, any[]>();
        for (const order of orderItems) {
            // Joyworld field names may vary — try common field names
            const phone = normalizePhone(
                order.memberPhone || order.memberMobile || order.phone || order.mobile || ''
            );
            if (!phone) continue;
            if (!phoneOrderMap.has(phone)) phoneOrderMap.set(phone, []);
            phoneOrderMap.get(phone)!.push(order);
        }

        // Point rules per package
        const POINTS_MAP: Record<string, number> = {
            Silver: 1,
            Gold: 1,
            Diamond: 1,
        };

        let matched = 0;
        let expired = 0;

        const batch = db.batch();
        const txnDocs: {
            ref: FirebaseFirestore.DocumentReference;
            data: Record<string, unknown>;
        }[] = [];
        const userPointDeltas = new Map<string, { total: number; monthKey: string }>();

        for (const pending of pendingDocs) {
            const phone = normalizePhone(pending.customerPhone);
            const orders = phoneOrderMap.get(phone) ?? [];

            if (orders.length === 0) {
                // Không có đơn hàng nào trong 30 ngày → đánh dấu no_order
                const ref = db.collection('pending_referrals').doc(pending.id);
                batch.update(ref, { status: 'no_order', resolvedAt: now.toISOString() });
                expired++;
                continue;
            }

            // Lấy đơn hàng đầu tiên để match (theo thứ tự thời gian mới nhất)
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const order: any = orders[0];
            const orderCode = String(order.orderId || order.orderCode || order.id || '');
            const orderValue = parseFloat(order.realMoney || order.totalMoney || order.payMoney || 0);

            const points = POINTS_MAP[pending.expectedPackage] ?? 1;
            const monthKey = pending.createdAt.slice(0, 7); // "YYYY-MM"

            // Update pending referral → matched
            const pendingRef = db.collection('pending_referrals').doc(pending.id);
            batch.update(pendingRef, {
                status: 'matched',
                matchedOrderCode: orderCode,
                matchedOrderValue: orderValue,
                pointsAwarded: points,
                resolvedAt: now.toISOString(),
            });

            // Create point_transaction doc
            const txnRef = db.collection('point_transactions').doc();
            txnDocs.push({
                ref: txnRef,
                data: {
                    employeeId: pending.saleEmployeeId,
                    type: 'earned',
                    customerPhone: pending.customerPhone,
                    orderCode,
                    orderValue,
                    points,
                    packageName: pending.expectedPackage,
                    createdAt: now.toISOString(),
                },
            });

            // Aggregate point deltas per user
            const existing = userPointDeltas.get(pending.saleEmployeeId);
            if (existing) {
                existing.total += points;
            } else {
                userPointDeltas.set(pending.saleEmployeeId, { total: points, monthKey });
            }

            matched++;
        }

        // 6. Apply batch writes for pending referral updates + txn docs
        for (const { ref, data } of txnDocs) {
            batch.set(ref, data);
        }

        // 7. Update user monthlyReferralPoints only — source of truth
        for (const [uid, { total, monthKey }] of userPointDeltas.entries()) {
            const userRef = db.collection('users').doc(uid);
            await db.runTransaction(async tx => {
                const snap = await tx.get(userRef);
                if (!snap.exists) return;
                tx.update(userRef, {
                    [`monthlyReferralPoints.${monthKey}`]: FieldValue.increment(total),
                });
            });
        }

        await batch.commit();

        console.log(`[syncReferralPoints] matched=${matched}, expired=${expired}`);
        return { matched, expired, skipped: 0 };
    } catch (err) {
        console.error('[syncReferralPoints]', err);
        return {
            matched: 0, expired: 0, skipped: 0,
            error: err instanceof Error ? err.message : 'Lỗi không xác định',
        };
    }
}

// ── Get Referral Points for an Employee (current month) ──────────────
export async function getReferralPoints(employeeId: string): Promise<number> {
    try {
        const db = getAdminDb();
        const snap = await db.collection('users').doc(employeeId).get();
        if (!snap.exists) return 0;
        const data = snap.data()!;
        const monthKey = getMonthKey();
        const monthly = (data.monthlyReferralPoints as Record<string, number> | undefined)?.[monthKey] ?? 0;
        // Fallback to total referralPoints for backward compatibility if no monthly data
        return monthly > 0 ? monthly : ((data.referralPoints ?? 0) as number);
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
                const monthKey = getMonthKey();
                const monthly = (data.monthlyReferralPoints as Record<string, number> | undefined)?.[monthKey] ?? 0;
                // Fallback to total referralPoints for backward-compat
                const pts = monthly > 0 ? monthly : ((data.referralPoints ?? 0) as number);
                return {
                    uid: d.id,
                    name: (data.name || '') as string,
                    phone: (data.phone || '') as string,
                    storeId: (data.storeId || '') as string,
                    referralPoints: pts,
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

            const monthKey = getMonthKey();

            tx.update(userRef, {
                // Only write to monthlyReferralPoints — source of truth
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

            const deduction = -Math.abs(data.originalPoints);

            // Determine the month of the original transaction to deduct from correct month
            const originalTxData = txSnap.data();
            const txMonthKey = getMonthKey(originalTxData?.createdAt);

            // Deduct from the correct month's points only
            tx.update(userRef, {
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
