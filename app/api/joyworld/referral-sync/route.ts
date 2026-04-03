// app/api/joyworld/referral-sync/route.ts
// Full lifecycle sync: waiting→matched | waiting→expired | expired→matched | matched→revoked

import { NextResponse } from 'next/server';
import { getAdminDb } from '@/lib/firebase-admin';
import { FieldValue } from 'firebase-admin/firestore';
import { getJoyworldToken, getOrderList } from '@/lib/joyworld';
import { broadcastByEvent } from '@/lib/notification-engine';
import type { PendingReferralDoc, ReferralPackage } from '@/types';

/** Get month key "YYYY-MM" from an ISO date string or current date */
function getMonthKey(isoDate?: string): string {
    const d = isoDate ? new Date(isoDate) : new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

// ── Helpers ──────────────────────────────────────────────────────

function matchesPackage(goodsNames: string, pkg: ReferralPackage): boolean {
    const lower = goodsNames.toLowerCase();
    if (pkg === 'Silver') return lower.includes('silver');
    if (pkg === 'Gold') return lower.includes('gold');
    if (pkg === 'Diamond') return lower.includes('diamond');
    return false;
}

function normalizePhone(phone: string): string {
    return phone.replace(/[\s\-().]/g, '').replace(/^\+84/, '0').replace(/^84/, '0');
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function findMatchingOrder(orders: any[], customerPhone: string, expectedPackage: ReferralPackage) {
    const normPhone = normalizePhone(customerPhone);
    return orders.find(o => {
        if (!o.phone) return false;
        if (normalizePhone(o.phone) !== normPhone) return false;
        return matchesPackage(o.goodsNames || '', expectedPackage);
    });
}

interface SyncAction {
    action: 'matched' | 'expired' | 'rematched' | 'revoked' | 'unchanged';
    referralId: string;
    saleEmployeeName: string;
    customerPhone: string;
    expectedPackage: ReferralPackage;
    orderNumber?: string;
    orderValue?: number;
    goodsNames?: string;
    points?: number;
    reason?: string;
}

// ── POST handler ─────────────────────────────────────────────────

export async function POST() {
    try {
        const db = getAdminDb();

        // 1. Get ALL referrals that need processing (waiting + expired/no_order + matched)
        const [waitingSnap, expiredSnap, matchedSnap] = await Promise.all([
            db.collection('pending_referrals').where('status', '==', 'waiting').get(),
            db.collection('pending_referrals').where('status', 'in', ['expired', 'no_order']).get(),
            db.collection('pending_referrals').where('status', '==', 'matched').get(),
        ]);

        const waitingRefs = waitingSnap.docs.map(d => ({ id: d.id, ...d.data() })) as PendingReferralDoc[];
        const expiredRefs = expiredSnap.docs.map(d => ({ id: d.id, ...d.data() })) as PendingReferralDoc[];
        const matchedRefs = matchedSnap.docs.map(d => ({ id: d.id, ...d.data() })) as PendingReferralDoc[];

        const allRefs = [...waitingRefs, ...expiredRefs, ...matchedRefs];

        if (allRefs.length === 0) {
            return NextResponse.json({
                success: true,
                message: 'Không có phiên nào cần đồng bộ.',
                actions: [],
            });
        }

        // 2. Get Joy World token + fetch orders
        const token = await getJoyworldToken();
        if (!token) {
            return NextResponse.json({ success: false, error: 'Không thể đăng nhập Joy World.' }, { status: 500 });
        }

        // Date range: from oldest referral to now
        const oldestCreatedAt = allRefs.reduce((min, r) => r.createdAt < min ? r.createdAt : min, allRefs[0].createdAt);
        const startDate = new Date(oldestCreatedAt);
        startDate.setHours(0, 0, 0, 0);
        const now = new Date();
        const startTime = `${startDate.getFullYear()}-${String(startDate.getMonth() + 1).padStart(2, '0')}-${String(startDate.getDate()).padStart(2, '0')} 00:00:00`;
        const endTime = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')} 23:59:59`;

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const allOrders: any[] = [];
        let page = 1;
        const pageSize = 100;
        let hasMore = true;

        while (hasMore) {
            const result = await getOrderList(token, { startTime, endTime, page, limit: pageSize });
            const orders = result?.data || [];
            if (Array.isArray(orders) && orders.length > 0) {
                allOrders.push(...orders);
                hasMore = orders.length >= pageSize;
                page++;
            } else {
                hasMore = false;
            }
        }

        console.log(`[Referral Sync] ${allOrders.length} orders, ${waitingRefs.length} waiting, ${expiredRefs.length} expired/no_order, ${matchedRefs.length} matched`);

        const actions: SyncAction[] = [];
        const nowIso = now.toISOString();

        // ── A. Process WAITING referrals ──────────────────────────────
        for (const pr of waitingRefs) {
            const match = findMatchingOrder(allOrders, pr.customerPhone, pr.expectedPackage);

            if (match) {
                // ✅ Found matching order → mark as matched, award 1 point
                const orderValue = parseFloat(match.realMoney) || 0;
                const points = 1;
                const userRef = db.collection('users').doc(pr.saleEmployeeId);
                const prRef = db.collection('pending_referrals').doc(pr.id);

                await db.runTransaction(async (tx) => {
                    const userSnap = await tx.get(userRef);
                    const currentPoints = userSnap.exists ? (userSnap.data()?.referralPoints ?? 0) : 0;
                    const monthKey = getMonthKey(nowIso);

                    tx.update(prRef, { status: 'matched', matchedOrderCode: match.orderNumber, matchedOrderValue: orderValue, pointsAwarded: points });
                    tx.update(userRef, {
                        referralPoints: currentPoints + points,
                        [`monthlyReferralPoints.${monthKey}`]: FieldValue.increment(points),
                    });
                    tx.set(db.collection('point_transactions').doc(), {
                        employeeId: pr.saleEmployeeId, type: 'earned',
                        customerPhone: pr.customerPhone, orderCode: match.orderNumber,
                        orderValue, points, packageName: pr.expectedPackage, createdAt: nowIso,
                    });
                });

                actions.push({ action: 'matched', referralId: pr.id, saleEmployeeName: pr.saleEmployeeName, customerPhone: pr.customerPhone, expectedPackage: pr.expectedPackage, orderNumber: match.orderNumber, orderValue, goodsNames: match.goodsNames, points });
                console.log(`[Sync] ✅ waiting→matched: ${pr.saleEmployeeName} ${pr.customerPhone} → ${match.orderNumber}`);

                // Broadcast congratulatory notification
                broadcastByEvent({
                    eventName: 'REFERRAL_POINTS_EARNED',
                    dataContext: { employeeName: pr.saleEmployeeName, points, packageName: pr.expectedPackage },
                }).catch(err => console.error('[Sync] broadcastByEvent error:', err));
            } else if (pr.expiresAt && new Date(pr.expiresAt) < now) {
                // ⏰ Session expired, no matching order → mark as expired
                await db.collection('pending_referrals').doc(pr.id).update({ status: 'expired' });
                actions.push({ action: 'expired', referralId: pr.id, saleEmployeeName: pr.saleEmployeeName, customerPhone: pr.customerPhone, expectedPackage: pr.expectedPackage, reason: 'Hết phiên chờ, không tìm thấy đơn khớp' });
                console.log(`[Sync] ⏰ waiting→expired: ${pr.saleEmployeeName} ${pr.customerPhone}`);
            }
            // If still within wait window and no match, leave as 'waiting'
        }

        // ── B. Process EXPIRED / NO_ORDER referrals (re-match attempt) ──
        for (const pr of expiredRefs) {
            const match = findMatchingOrder(allOrders, pr.customerPhone, pr.expectedPackage);

            if (match) {
                // 🔄 Found matching order for previously expired referral → re-match!
                const orderValue = parseFloat(match.realMoney) || 0;
                const points = 1;
                const userRef = db.collection('users').doc(pr.saleEmployeeId);
                const prRef = db.collection('pending_referrals').doc(pr.id);

                await db.runTransaction(async (tx) => {
                    const userSnap = await tx.get(userRef);
                    const currentPoints = userSnap.exists ? (userSnap.data()?.referralPoints ?? 0) : 0;
                    const monthKey = getMonthKey(nowIso);

                    tx.update(prRef, { status: 'matched', matchedOrderCode: match.orderNumber, matchedOrderValue: orderValue, pointsAwarded: points });
                    tx.update(userRef, {
                        referralPoints: currentPoints + points,
                        [`monthlyReferralPoints.${monthKey}`]: FieldValue.increment(points),
                    });
                    tx.set(db.collection('point_transactions').doc(), {
                        employeeId: pr.saleEmployeeId, type: 'earned',
                        customerPhone: pr.customerPhone, orderCode: match.orderNumber,
                        orderValue, points, packageName: pr.expectedPackage, createdAt: nowIso,
                    });
                });

                actions.push({ action: 'rematched', referralId: pr.id, saleEmployeeName: pr.saleEmployeeName, customerPhone: pr.customerPhone, expectedPackage: pr.expectedPackage, orderNumber: match.orderNumber, orderValue, goodsNames: match.goodsNames, points });
                console.log(`[Sync] 🔄 expired→matched: ${pr.saleEmployeeName} ${pr.customerPhone} → ${match.orderNumber}`);

                // Broadcast congratulatory notification
                broadcastByEvent({
                    eventName: 'REFERRAL_POINTS_EARNED',
                    dataContext: { employeeName: pr.saleEmployeeName, points, packageName: pr.expectedPackage },
                }).catch(err => console.error('[Sync] broadcastByEvent error:', err));
            }
        }

        // ── C. Process MATCHED referrals (check if order was cancelled) ──
        for (const pr of matchedRefs) {
            if (!pr.matchedOrderCode) continue;

            // Find the order that was previously matched
            const matchedOrder = allOrders.find(o => o.orderNumber === pr.matchedOrderCode);

            // If the order exists and its status indicates cancellation (status 4 or 5 typically)
            // status 3 = completed, anything else might be cancelled/refunded
            if (matchedOrder && matchedOrder.status !== 3) {
                const pointsToRevoke = pr.pointsAwarded || 0;
                if (pointsToRevoke <= 0) continue;

                const userRef = db.collection('users').doc(pr.saleEmployeeId);
                const prRef = db.collection('pending_referrals').doc(pr.id);

                await db.runTransaction(async (tx) => {
                    const userSnap = await tx.get(userRef);
                    const currentPoints = userSnap.exists ? (userSnap.data()?.referralPoints ?? 0) : 0;
                    const monthKey = getMonthKey(nowIso);

                    tx.update(prRef, { status: 'revoked', revokedReason: `Đơn hàng ${pr.matchedOrderCode} đã bị hủy (status: ${matchedOrder.status})` });
                    tx.update(userRef, {
                        referralPoints: Math.max(0, currentPoints - pointsToRevoke),
                        [`monthlyReferralPoints.${monthKey}`]: FieldValue.increment(-pointsToRevoke),
                    });
                    tx.set(db.collection('point_transactions').doc(), {
                        employeeId: pr.saleEmployeeId, type: 'refund_revocation',
                        customerPhone: pr.customerPhone, orderCode: pr.matchedOrderCode,
                        points: -pointsToRevoke, reason: `Thu hồi: đơn ${pr.matchedOrderCode} đã hủy`,
                        createdAt: nowIso,
                    });
                });

                actions.push({ action: 'revoked', referralId: pr.id, saleEmployeeName: pr.saleEmployeeName, customerPhone: pr.customerPhone, expectedPackage: pr.expectedPackage, orderNumber: pr.matchedOrderCode, points: -pointsToRevoke, reason: `Đơn hàng bị hủy (status: ${matchedOrder.status})` });
                console.log(`[Sync] ❌ matched→revoked: ${pr.saleEmployeeName} ${pr.customerPhone}, đơn ${pr.matchedOrderCode} bị hủy, thu hồi ${pointsToRevoke}đ`);
            }
        }

        // ── Summary ──
        const matched = actions.filter(a => a.action === 'matched').length;
        const rematched = actions.filter(a => a.action === 'rematched').length;
        const expired = actions.filter(a => a.action === 'expired').length;
        const revoked = actions.filter(a => a.action === 'revoked').length;

        return NextResponse.json({
            success: true,
            totalOrders: allOrders.length,
            summary: { waiting: waitingRefs.length, expired: expiredRefs.length, matched: matchedRefs.length },
            results: { matched, rematched, expired, revoked },
            actions,
        });
    } catch (err) {
        const message = err instanceof Error ? err.message : 'Unknown error';
        console.error('[Referral Sync Error]', message);
        return NextResponse.json({ success: false, error: message }, { status: 500 });
    }
}
