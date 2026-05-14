// lib/ai/context-builder.ts
// Fetch dữ liệu theo domain → transform slim → format text cho Claude
// Mỗi domain chỉ giữ các trường CẦN THIẾT cho phân tích, lược bỏ metadata thừa

import type { DataDomain } from '@/lib/ai/intent-classifier';
import {
    getJoyworldToken,
    getShopSummary,
    getPaymentStatistics,
    getGoodsTypeStatistics,
    getStoreBalance,
    getRevenueData,
    getOrderList,
} from '@/lib/joyworld';
import { getAdminDb } from '@/lib/firebase-admin';

// ── Format helpers ───────────────────────────────────────────
function fmtVND(n: number): string {
    return n.toLocaleString('vi-VN') + 'đ';
}

// ── Token getter (cached 5 min) ──────────────────────────────
let tokenCache: { token: string; expiresAt: number } | null = null;

async function getCachedToken(): Promise<string> {
    if (tokenCache && Date.now() < tokenCache.expiresAt) return tokenCache.token;
    const token = await getJoyworldToken();
    tokenCache = { token, expiresAt: Date.now() + 5 * 60_000 };
    return token;
}

// ═══════════════════════════════════════════════════════════════
// SLIM FETCHERS — mỗi hàm fetch raw → chỉ giữ trường quan trọng
// ═══════════════════════════════════════════════════════════════

async function fetchSlimRevenue(date: string): Promise<string> {
    try {
        const token = await getCachedToken();
        const [summaryRaw, paymentRaw] = await Promise.all([
            getShopSummary(token, date),
            getPaymentStatistics(token, date),
        ]);

        // ShopSummary: 11 fields → 3 fields (drop shopId, totalMoney, shopMoney, preDeposit*, otherMoney, lastRefreshTime)
        const sd = summaryRaw?.data;
        const revenue = parseFloat(sd?.shopRealMoney) || 0;
        const refund = parseFloat(sd?.refundMoney) || 0;

        // PaymentStat: 12 fields/item → 4 fields (drop shopId, forDate, paymentCategory, totalQty/Money, cancel*, sellRatio number)
        const payments = (paymentRaw?.data || [])
            .filter((p: { paymentCategory: number }) => p.paymentCategory !== 0)
            .map((p: { paymentCategoryName: string; totalRealQty: number; totalRealMoney: number; sellRatioDisplay: string }) =>
                `  · ${p.paymentCategoryName}: ${fmtVND(p.totalRealMoney)} | ${p.totalRealQty} đơn | ${p.sellRatioDisplay}`
            ).join('\n');

        return `📊 DOANH THU (${date})\n• Tổng doanh thu thực: ${fmtVND(revenue)}\n• Hoàn trả: ${fmtVND(refund)}\nTheo phương thức:\n${payments}`;
    } catch (e) { return `⚠️ Lỗi lấy doanh thu: ${e}`; }
}

async function fetchSlimGoods(date: string): Promise<string> {
    try {
        const token = await getCachedToken();
        const goodsRaw = await getGoodsTypeStatistics(token, date);

        // GoodsTypeStats: 14 fields/type → 4 fields + top5 items (3 fields each)
        // Drop: shopId, forDate, goodsTypeId, totalQty/Money, cancelQty/Money, realCost, sellRatio
        const categories = (goodsRaw?.data || [])
            .filter((g: { goodsTypeName: string }) => g.goodsTypeName !== 'Tổng cộng')
            .map((g: { goodsTypeName: string; totalRealQty: number; totalRealMoney: number; sellRatioDisplay: string; goodsItems?: { goodsName: string; realQty: number; realMoney: number }[] }) => {
                const items = (g.goodsItems || [])
                    .sort((a: { realMoney: number }, b: { realMoney: number }) => b.realMoney - a.realMoney)
                    .slice(0, 5)
                    .map((i: { goodsName: string; realQty: number; realMoney: number }) =>
                        `    - ${i.goodsName}: ${i.realQty} cái, ${fmtVND(i.realMoney)}`
                    ).join('\n');
                return `▸ ${g.goodsTypeName}: ${g.totalRealQty} sp, ${fmtVND(g.totalRealMoney)} (${g.sellRatioDisplay})\n${items}`;
            }).join('\n');

        return `🛍️ HÀNG HÓA (${date})\n${categories}`;
    } catch (e) { return `⚠️ Lỗi lấy hàng hóa: ${e}`; }
}

async function fetchSlimMember(start: string, end: string): Promise<string> {
    try {
        const token = await getCachedToken();
        const memberRaw = await getStoreBalance(token, start, end);

        // MemberStats: already compact (7 fields), keep all
        const fd = memberRaw?.footData;
        if (!fd) return '👥 THÀNH VIÊN: Không có dữ liệu';
        return `👥 THÀNH VIÊN (${start})\n• Tổng thành viên: ${fd.memberTotal}\n• Mới trong kỳ: ${fd.newMemberAmount}\n• Lượt khách: ${fd.goShopMemberAmount}\n• Số dư VNĐ: ${fmtVND(Number(fd.localCurrency) || 0)}\n• Xu tặng: ${fmtVND(Number(fd.giftCoins) || 0)}`;
    } catch (e) { return `⚠️ Lỗi lấy thành viên: ${e}`; }
}

async function fetchSlimOrders(startDate: string, endDate: string): Promise<string> {
    try {
        const token = await getCachedToken();
        const raw = await getOrderList(token, {
            startTime: `${startDate} 00:00:00`,
            endTime: `${endDate} 23:59:59`,
            page: 1, limit: 20,
        });
        const orders = raw?.data || [];
        const total = raw?.totals || orders.length;
        const isMultiDay = startDate !== endDate;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const lines = orders.map((o: any) =>
            `  · #${o.orderCode || o.orderId} | ${fmtVND(o.realMoney || o.totalMoney || 0)} | ${o.payMethodName || '?'} | ${o.statusName || o.status}${isMultiDay ? ` | ${(o.createTime || '').slice(0, 10)}` : ''}`
        ).join('\n');
        const rangeLabel = isMultiDay ? `${startDate} → ${endDate}` : startDate;
        return `📦 ĐƠN HÀNG (${rangeLabel}) — Tổng: ${total} đơn${total > 20 ? ' (hiển thị 20 gần nhất)' : ''}\n${lines}`;
    } catch (e) { return `⚠️ Lỗi lấy đơn hàng: ${e}`; }
}

async function fetchSlimHR(startDate: string, endDate: string): Promise<string> {
    try {
        const db = getAdminDb();

        // ── 1. Employee Roster ─────────────────────────────────────
        const usersSnap = await db.collection('users').where('isActive', '==', true).get();
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const users = usersSnap.docs.map(d => ({ uid: d.id, ...d.data() })) as any[];

        // Stores lookup for display names
        const storesSnap = await db.collection('stores').get();
        const storeMap = new Map<string, string>();
        storesSnap.forEach(d => { const s = d.data(); storeMap.set(d.id, s.name || d.id); });

        // Offices lookup
        const officesSnap = await db.collection('offices').get();
        const officeMap = new Map<string, string>();
        officesSnap.forEach(d => { const o = d.data(); officeMap.set(d.id, o.name || d.id); });

        // Group by type/role/workplace
        const ftCount = users.filter(u => u.type === 'FT').length;
        const ptCount = users.filter(u => u.type === 'PT').length;
        const byRole = new Map<string, number>();
        for (const u of users) {
            const r = u.role || 'unknown';
            byRole.set(r, (byRole.get(r) || 0) + 1);
        }

        // Employee list grouped by store/office
        const byWorkplace = new Map<string, string[]>();
        for (const u of users) {
            let wp = 'Chưa phân công';
            if (u.storeId && storeMap.has(u.storeId)) wp = storeMap.get(u.storeId)!;
            else if (u.officeId && officeMap.has(u.officeId)) wp = officeMap.get(u.officeId)!;
            else if (u.workplaceType === 'CENTRAL') wp = 'Kho Trung tâm';
            if (!byWorkplace.has(wp)) byWorkplace.set(wp, []);
            byWorkplace.get(wp)!.push(`${u.name} (${u.type || '?'}${u.jobTitle ? ' · ' + u.jobTitle : ''})`);
        }

        // Format workplace roster (compact)
        const rosterLines: string[] = [];
        for (const [wp, names] of byWorkplace) {
            rosterLines.push(`  ▸ ${wp} (${names.length} NV): ${names.join(', ')}`);
        }

        // ── 2. Attendance (date range) ────────────────────────────
        const startISO = `${startDate}T00:00:00`;
        const endISO = `${endDate}T23:59:59`;

        const attSnap = await db.collection('attendance_logs')
            .where('timestamp', '>=', startISO)
            .where('timestamp', '<=', endISO)
            .get();
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const attLogs = attSnap.docs.map(d => d.data()) as any[];

        // ZKTeco users mapping
        const zkUsersSnap = await db.collection('zkteco_users').get();
        const zkMap = new Map<string, { name: string; sysUid: string | null; sysName: string | null }>();
        zkUsersSnap.forEach(d => {
            const z = d.data();
            zkMap.set(z.zk_user_id, {
                name: z.zk_name,
                sysUid: z.mapped_system_uid || null,
                sysName: z.mapped_system_name || null,
            });
        });

        // Group attendance by date → employee (FILO: first punch = in, last = out)
        const attByDate = new Map<string, Map<string, { checkIn: string; checkOut: string | null; count: number; name: string }>>();
        for (const log of attLogs) {
            const date = (log.timestamp as string).slice(0, 10);
            const userId = log.zk_user_id;
            if (!attByDate.has(date)) attByDate.set(date, new Map());
            const dayMap = attByDate.get(date)!;

            const zk = zkMap.get(userId);
            const displayName = zk?.sysName || zk?.name || userId;

            if (!dayMap.has(userId)) {
                dayMap.set(userId, { checkIn: log.timestamp, checkOut: null, count: 1, name: displayName });
            } else {
                const rec = dayMap.get(userId)!;
                rec.count++;
                // FILO: update check-out to latest
                if (log.timestamp > (rec.checkOut || rec.checkIn)) rec.checkOut = log.timestamp;
                if (log.timestamp < rec.checkIn) rec.checkIn = log.timestamp;
            }
        }

        // Build attendance summary
        const attLines: string[] = [];
        const lateList: string[] = [];
        const isMultiDay = startDate !== endDate;
        const totalAttDays = attByDate.size;
        let totalCheckins = 0;
        let totalLateCount = 0;

        // Sort dates
        const sortedDates = [...attByDate.keys()].sort();
        for (const date of sortedDates) {
            const dayMap = attByDate.get(date)!;
            const dayTotal = dayMap.size;
            totalCheckins += dayTotal;

            // Check late (after 09:00)
            let dayLateCount = 0;
            const dayLateNames: string[] = [];
            for (const [, rec] of dayMap) {
                const checkInTime = rec.checkIn.slice(11, 16); // HH:MM
                if (checkInTime > '09:00') {
                    dayLateCount++;
                    dayLateNames.push(`${rec.name} (${checkInTime})`);
                }
            }
            totalLateCount += dayLateCount;
            if (dayLateCount > 0) {
                lateList.push(`  · ${date}: ${dayLateNames.join(', ')}`);
            }

            // Compact daily line (only show per-day detail if <= 7 days)
            if (!isMultiDay || sortedDates.length <= 7) {
                const empLines = [...dayMap.values()].map(r => {
                    const inTime = r.checkIn.slice(11, 16);
                    const outTime = r.checkOut ? r.checkOut.slice(11, 16) : '--:--';
                    const late = inTime > '09:00' ? ' ⚠️TRỄ' : '';
                    return `    - ${r.name}: ${inTime} → ${outTime}${late}`;
                }).join('\n');
                attLines.push(`  📅 ${date} (${dayTotal} NV):\n${empLines}`);
            }
        }

        // ── 3. Schedules in range ────────────────────────────────
        const schedSnap = await db.collection('schedules')
            .where('date', '>=', startDate)
            .where('date', '<=', endDate)
            .get();
        const scheduledDays = new Set<string>();
        let totalScheduledSlots = 0;
        for (const d of schedSnap.docs) {
            const s = d.data();
            scheduledDays.add(s.date);
            totalScheduledSlots += (s.employeeIds || []).length;
        }

        // ── 4. Referral Points ───────────────────────────────────
        const monthKey = startDate.slice(0, 7); // YYYY-MM
        const usersWithPoints = users
            .filter(u => u.referralPoints && u.referralPoints > 0)
            .sort((a, b) => (b.referralPoints || 0) - (a.referralPoints || 0))
            .slice(0, 10);

        const pointLines = usersWithPoints.map(u => {
            const monthPts = u.monthlyReferralPoints?.[monthKey] || 0;
            return `  · ${u.name}: ${u.referralPoints} điểm tổng${monthPts > 0 ? ` (tháng này: +${monthPts})` : ''}`;
        }).join('\n');

        // ── Build output ─────────────────────────────────────────
        const parts = [
            `👔 NHÂN SỰ (${startDate}${isMultiDay ? ' → ' + endDate : ''})`,
            `• Tổng NV active: ${users.length} (FT: ${ftCount}, PT: ${ptCount})`,
            `• Phân theo role: ${[...byRole.entries()].map(([r, c]) => `${r}: ${c}`).join(', ')}`,
            `\nDanh sách theo nơi làm việc:`,
            rosterLines.join('\n'),
            `\n📋 CHẤM CÔNG (${totalAttDays} ngày có dữ liệu):`,
            `• Tổng lượt chấm công: ${totalCheckins}`,
            `• Đi trễ (sau 09:00): ${totalLateCount} lượt`,
            `• Ca được xếp: ${totalScheduledSlots} slot trong ${scheduledDays.size} ngày`,
        ];

        // Detail per day (compact mode for ranges > 7 days)
        if (isMultiDay && sortedDates.length > 7) {
            parts.push(`\nTổng hợp theo ngày (${sortedDates.length} ngày):`);
            for (const date of sortedDates) {
                const dayMap = attByDate.get(date)!;
                parts.push(`  · ${date}: ${dayMap.size} NV chấm công`);
            }
        } else if (attLines.length > 0) {
            parts.push(`\nChi tiết chấm công:`);
            parts.push(attLines.join('\n'));
        }

        if (lateList.length > 0) {
            parts.push(`\n⚠️ DANH SÁCH ĐI TRỄ:`);
            parts.push(lateList.join('\n'));
        }

        if (usersWithPoints.length > 0) {
            parts.push(`\n🏆 TOP ĐIỂM GIỚI THIỆU:`);
            parts.push(pointLines);
        }

        return parts.join('\n');
    } catch (e) { return `⚠️ Lỗi lấy nhân sự: ${e}`; }
}

async function fetchSlimInventory(): Promise<string> {
    try {
        const db = getAdminDb();

        // Products: count + low stock alerts
        const productsSnap = await db.collection('products').where('isActive', '==', true).get();
        const products = productsSnap.docs.map(d => ({ id: d.id, ...d.data() }));

        // Balances: lấy sản phẩm sắp hết
        const balancesSnap = await db.collection('inventory_balances').get();
        const lowStock: string[] = [];
        const stockSummary: { total: number; low: number; zero: number } = { total: 0, low: 0, zero: 0 };

        for (const doc of balancesSnap.docs) {
            const b = doc.data();
            stockSummary.total++;
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const product = products.find((p: any) => p.id === b.productId) as any;
            if (b.currentStock === 0) stockSummary.zero++;
            if (product && product.minStock != null && b.currentStock <= product.minStock) {
                stockSummary.low++;
                lowStock.push(`  · ${product.name}: còn ${b.currentStock} (min: ${product.minStock})`);
            }
        }

        // Stores for warehouse context
        const storesSnap = await db.collection('stores').get();
        const storeNames = storesSnap.docs
            .filter(d => d.data().isActive)
            .map(d => d.data().name).join(', ');

        // Recent purchase orders
        const poSnap = await db.collection('purchase_orders')
            .orderBy('timestamp', 'desc').limit(5).get();
        const recentPO = poSnap.docs.map(d => {
            const po = d.data();
            return `  · ${po.storeName || '?'} → ${po.status} (${(po.items || []).length} SP, ${fmtVND(po.totalAmount || 0)})`;
        }).join('\n');

        // Recent transactions
        const txSnap = await db.collection('inventory_transactions')
            .orderBy('timestamp', 'desc').limit(10).get();
        const txLines = txSnap.docs.map(d => {
            const tx = d.data();
            return `  · ${(tx.timestamp as string)?.slice(0, 10) || '?'}: ${tx.type} ${tx.productName || '?'} x${tx.quantity} (${tx.fromStore || '?'} → ${tx.toStore || '?'})`;
        }).join('\n');

        return [
            `📦 KHO HÀNG`,
            `• Tổng sản phẩm active: ${products.length}`,
            `• Tổng mã tồn kho: ${stockSummary.total} (hết hàng: ${stockSummary.zero})`,
            `• Cửa hàng: ${storeNames || 'Chưa có'}`,
            `• Cảnh báo tồn kho thấp (${stockSummary.low}):`,
            lowStock.slice(0, 15).join('\n') || '  Không có',
            `• Đơn đặt hàng gần đây:`,
            recentPO || '  Không có',
            `• Giao dịch kho gần đây:`,
            txLines || '  Không có',
        ].join('\n');
    } catch (e) { return `⚠️ Lỗi lấy kho: ${e}`; }
}

async function fetchSlimVoucher(): Promise<string> {
    try {
        const db = getAdminDb();
        const campaignsSnap = await db.collection('voucher_campaigns').get();
        const campaigns = campaignsSnap.docs.map(d => ({ id: d.id, ...d.data() }));
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const active = campaigns.filter((c: any) => c.status === 'active');

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const lines = campaigns.slice(0, 10).map((c: any) =>
            `  · ${c.name}: ${c.status} | ${c.rewardType} ${c.rewardValue || ''} | ${c.totalIssued || 0} mã | ${c.validFrom || '?'}→${c.validTo || '?'}`
        ).join('\n');

        // Count used/available codes
        const codesSnap = await db.collection('voucher_codes').get();
        const codes = codesSnap.docs.map(d => d.data());
        const used = codes.filter(c => c.status === 'used').length;
        const available = codes.filter(c => c.status === 'available').length;
        const expired = codes.filter(c => c.status === 'expired').length;

        return [
            `🎫 VOUCHER & KHUYẾN MÃI`,
            `• Chiến dịch: ${campaigns.length} (active: ${active.length})`,
            `• Mã: đã dùng ${used} | còn ${available} | hết hạn ${expired}`,
            `Danh sách chiến dịch:`,
            lines || '  Không có',
        ].join('\n');
    } catch (e) { return `⚠️ Lỗi lấy voucher: ${e}`; }
}

// ── Events / Sự kiện ────────────────────────────────────────
async function fetchSlimEvents(): Promise<string> {
    try {
        const db = getAdminDb();
        const eventsSnap = await db.collection('events').orderBy('createdAt', 'desc').limit(5).get();
        const events = eventsSnap.docs.map(d => ({ id: d.id, ...d.data() }));

        if (events.length === 0) return '🎪 SỰ KIỆN: Không có sự kiện nào.';

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const lines = events.map((e: any) => {
            const prizes = (e.prizePool || []).length;
            return `  · ${e.name}: ${e.status} | ${e.startDate}→${e.endDate} | ${prizes} giải thưởng`;
        }).join('\n');

        // Event participations count
        const partSnap = await db.collection('event_participations').count().get();
        const totalParticipants = partSnap.data().count;

        return [
            `🎪 SỰ KIỆN & MINI-GAME`,
            `• Tổng sự kiện gần đây: ${events.length}`,
            `• Tổng lượt tham gia: ${totalParticipants}`,
            `Danh sách:`,
            lines,
        ].join('\n');
    } catch (e) { return `⚠️ Lỗi lấy sự kiện: ${e}`; }
}

async function fetchSlimMultiDay(start: string, end: string): Promise<string> {
    try {
        const token = await getCachedToken();
        const revenueRaw = await getRevenueData(token, start, end);
        const items = revenueRaw?.data?.dataXs || [];

        // Filter valid day records
        const days = items
            .filter((r: { forDate: string }) => /^\d{4}-\d{2}-\d{2}$/.test(r.forDate))
            .map((r: { forDate: string; realMoney: number; cashRealMoney: number }) => ({
                date: r.forDate,
                revenue: Number(r.realMoney) || 0,
                cash: Number(r.cashRealMoney) || 0,
            }));

        if (days.length === 0) return `📈 DOANH THU ${start} → ${end}\nKhông có dữ liệu.`;

        // ── Aggregation ──
        const totalRevenue = days.reduce((s: number, d: { revenue: number }) => s + d.revenue, 0);
        const totalCash = days.reduce((s: number, d: { cash: number }) => s + d.cash, 0);
        const avgDaily = totalRevenue / days.length;
        const daysWithRevenue = days.filter((d: { revenue: number }) => d.revenue > 0);

        // Peak & Low days
        let peakDay = days[0];
        let lowDay = daysWithRevenue[0] || days[0];
        for (const d of days) {
            if (d.revenue > peakDay.revenue) peakDay = d;
            if (d.revenue > 0 && d.revenue < lowDay.revenue) lowDay = d;
        }

        // Daily breakdown (compact: max 31 lines for a month)
        const rows = days.map((d: { date: string; revenue: number; cash: number }) =>
            `  · ${d.date}: ${fmtVND(d.revenue)} (TM: ${fmtVND(d.cash)})`
        ).join('\n');

        return [
            `📈 DOANH THU ${start} → ${end} (${days.length} ngày)`,
            `• Tổng doanh thu: ${fmtVND(totalRevenue)}`,
            `• Tổng tiền mặt: ${fmtVND(totalCash)}`,
            `• Trung bình/ngày: ${fmtVND(Math.round(avgDaily))}`,
            `• Ngày cao nhất: ${peakDay.date} (${fmtVND(peakDay.revenue)})`,
            lowDay !== peakDay ? `• Ngày thấp nhất: ${lowDay.date} (${fmtVND(lowDay.revenue)})` : '',
            `• Ngày có doanh thu: ${daysWithRevenue.length}/${days.length}`,
            `Chi tiết theo ngày:`,
            rows,
        ].filter(Boolean).join('\n');
    } catch (e) { return `⚠️ Lỗi lấy doanh thu nhiều ngày: ${e}`; }
}

// ═══════════════════════════════════════════════════════════════
// MAIN ORCHESTRATOR
// ═══════════════════════════════════════════════════════════════

export interface ContextResult {
    context: string;
    sources: string[];
    fetchTimeMs: number;
    dateRange: { start: string; end: string };
}

export async function buildDataContext(
    domains: DataDomain[],
    startDate: string,
    endDate: string,
): Promise<ContextResult> {
    const t0 = Date.now();
    const parts: string[] = [];
    const sources: string[] = [];
    const isMultiDay = startDate !== endDate;

    const tasks: Promise<void>[] = [];

    for (const domain of domains) {
        switch (domain) {
            case 'revenue':
                tasks.push(isMultiDay
                    ? fetchSlimMultiDay(startDate, endDate).then(r => { parts.push(r); sources.push('JoyWorld Revenue API'); })
                    : fetchSlimRevenue(startDate).then(r => { parts.push(r); sources.push('JoyWorld Revenue Panel'); })
                );
                break;
            case 'goods':
                // Goods: cho multi-day lấy ngày cuối (hoặc hôm nay) làm snapshot
                tasks.push(fetchSlimGoods(isMultiDay ? endDate : startDate).then(r => { parts.push(r); sources.push('JoyWorld Goods API'); }));
                break;
            case 'member':
                tasks.push(fetchSlimMember(startDate, endDate).then(r => { parts.push(r); sources.push('JoyWorld Member API'); }));
                break;
            case 'orders':
                tasks.push(fetchSlimOrders(startDate, endDate).then(r => { parts.push(r); sources.push('JoyWorld Orders API'); }));
                break;
            case 'hr':
                tasks.push(fetchSlimHR(startDate, endDate).then(r => { parts.push(r); sources.push('Firestore HR', 'Firestore Attendance', 'ZKTeco'); }));
                break;
            case 'inventory':
                tasks.push(fetchSlimInventory().then(r => { parts.push(r); sources.push('Firestore Inventory'); }));
                break;
            case 'voucher':
                tasks.push(fetchSlimVoucher().then(r => { parts.push(r); sources.push('Firestore Vouchers'); }));
                break;
            case 'event':
                tasks.push(fetchSlimEvents().then(r => { parts.push(r); sources.push('Firestore Events'); }));
                break;
            case 'general':
                // General: lấy summary tất cả domain chính
                if (isMultiDay) {
                    tasks.push(fetchSlimMultiDay(startDate, endDate).then(r => { parts.push(r); sources.push('JoyWorld Revenue'); }));
                } else {
                    tasks.push(fetchSlimRevenue(startDate).then(r => { parts.push(r); sources.push('JoyWorld Revenue'); }));
                }
                tasks.push(fetchSlimGoods(isMultiDay ? endDate : startDate).then(r => { parts.push(r); sources.push('JoyWorld Goods'); }));
                tasks.push(fetchSlimMember(startDate, endDate).then(r => { parts.push(r); sources.push('JoyWorld Members'); }));
                break;
        }
    }

    await Promise.all(tasks);

    return {
        context: parts.join('\n\n'),
        sources: [...new Set(sources)],
        fetchTimeMs: Date.now() - t0,
        dateRange: { start: startDate, end: endDate },
    };
}

