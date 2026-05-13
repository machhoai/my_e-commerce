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

async function fetchSlimOrders(date: string): Promise<string> {
    try {
        const token = await getCachedToken();
        const raw = await getOrderList(token, {
            startTime: `${date} 00:00:00`,
            endTime: `${date} 23:59:59`,
            page: 1, limit: 10,
        });
        const orders = raw?.data || [];
        const total = raw?.totals || orders.length;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const lines = orders.map((o: any) =>
            `  · #${o.orderCode || o.orderId} | ${fmtVND(o.realMoney || o.totalMoney || 0)} | ${o.payMethodName || '?'} | ${o.statusName || o.status}`
        ).join('\n');
        return `📦 ĐƠN HÀNG (${date}) — Tổng: ${total} đơn\n${lines}`;
    } catch (e) { return `⚠️ Lỗi lấy đơn hàng: ${e}`; }
}

async function fetchSlimHR(): Promise<string> {
    try {
        const db = getAdminDb();
        const today = new Date(Date.now() + 7 * 3600000).toISOString().split('T')[0];

        // Users: chỉ lấy count theo type/role, drop toàn bộ PII
        const usersSnap = await db.collection('users').where('isActive', '==', true).get();
        const users = usersSnap.docs.map(d => d.data());
        const ftCount = users.filter(u => u.type === 'FT').length;
        const ptCount = users.filter(u => u.type === 'PT').length;

        // Attendance today: chỉ đếm, không lấy chi tiết
        const attSnap = await db.collection('attendance_logs')
            .where('timestamp', '>=', `${today}T00:00:00`)
            .where('timestamp', '<=', `${today}T23:59:59`)
            .get();
        const checkedInIds = new Set(attSnap.docs.map(d => d.data().mapped_system_uid).filter(Boolean));

        // Schedules today: đếm số ca
        const schedSnap = await db.collection('schedules').where('date', '==', today).get();
        const scheduledIds = new Set(schedSnap.docs.flatMap(d => d.data().employeeIds || []));

        return `👔 NHÂN SỰ (${today})\n• Tổng NV active: ${users.length} (FT: ${ftCount}, PT: ${ptCount})\n• Đã chấm công hôm nay: ${checkedInIds.size}\n• Được xếp ca hôm nay: ${scheduledIds.size}\n• Chưa chấm công: ${Math.max(0, scheduledIds.size - checkedInIds.size)}`;
    } catch (e) { return `⚠️ Lỗi lấy nhân sự: ${e}`; }
}

async function fetchSlimInventory(): Promise<string> {
    try {
        const db = getAdminDb();

        // Products: chỉ count + low stock alerts
        const productsSnap = await db.collection('products').where('isActive', '==', true).get();
        const products = productsSnap.docs.map(d => ({ id: d.id, ...d.data() }));

        // Balances: chỉ lấy sản phẩm sắp hết
        const balancesSnap = await db.collection('inventory_balances').get();
        const lowStock: string[] = [];
        for (const doc of balancesSnap.docs) {
            const b = doc.data();
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const product = products.find((p: any) => p.id === b.productId) as any;
            if (product && product.minStock != null && b.currentStock <= product.minStock) {
                lowStock.push(`  · ${product.name}: còn ${b.currentStock} (min: ${product.minStock})`);
            }
        }

        // Recent purchase orders
        const poSnap = await db.collection('purchase_orders')
            .orderBy('timestamp', 'desc').limit(5).get();
        const recentPO = poSnap.docs.map(d => {
            const po = d.data();
            return `  · ${po.storeName} → ${po.status} (${(po.items || []).length} SP)`;
        }).join('\n');

        return `📦 KHO HÀNG\n• Tổng sản phẩm: ${products.length}\n• Cảnh báo tồn kho thấp (${lowStock.length}):\n${lowStock.slice(0, 10).join('\n') || '  Không có'}\n• Đơn đặt hàng gần đây:\n${recentPO || '  Không có'}`;
    } catch (e) { return `⚠️ Lỗi lấy kho: ${e}`; }
}

async function fetchSlimVoucher(): Promise<string> {
    try {
        const db = getAdminDb();
        const campaignsSnap = await db.collection('voucher_campaigns').get();
        const campaigns = campaignsSnap.docs.map(d => d.data());
        const active = campaigns.filter(c => c.status === 'active');

        const lines = active.slice(0, 5).map(c =>
            `  · ${c.name}: ${c.rewardType} ${c.rewardValue} | ${c.totalIssued} mã | ${c.validFrom}→${c.validTo}`
        ).join('\n');

        // Count used/available codes
        const codesSnap = await db.collection('voucher_codes').get();
        const codes = codesSnap.docs.map(d => d.data());
        const used = codes.filter(c => c.status === 'used').length;
        const available = codes.filter(c => c.status === 'available').length;

        return `🎫 VOUCHER\n• Chiến dịch active: ${active.length}/${campaigns.length}\n• Mã đã dùng: ${used} | Còn lại: ${available}\nTop chiến dịch:\n${lines || '  Không có'}`;
    } catch (e) { return `⚠️ Lỗi lấy voucher: ${e}`; }
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
                tasks.push(fetchSlimOrders(isMultiDay ? endDate : startDate).then(r => { parts.push(r); sources.push('JoyWorld Orders API'); }));
                break;
            case 'hr':
                tasks.push(fetchSlimHR().then(r => { parts.push(r); sources.push('Firestore HR'); }));
                break;
            case 'inventory':
                tasks.push(fetchSlimInventory().then(r => { parts.push(r); sources.push('Firestore Inventory'); }));
                break;
            case 'voucher':
                tasks.push(fetchSlimVoucher().then(r => { parts.push(r); sources.push('Firestore Vouchers'); }));
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

