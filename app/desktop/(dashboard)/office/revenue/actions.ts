'use server';

import { getAdminDb } from '@/lib/firebase-admin';
import {
    getJoyworldToken,
    getRevenueData,
    getSellData,
    getShopSummary,
    getPaymentStatistics,
    getGoodsTypeStatistics,
    getStoreBalance,
} from '@/lib/joyworld';
import {
    JOYWORLD_CACHE_COLLECTION,
    getCacheDocId,
    type RevenueRecord,
    type SellCategory,
    type RevenueCache,
    type ShopSummary,
    type PaymentStat,
    type GoodsTypeStats,
    type MemberStats,
    type DailyPanel,
} from '@/lib/revenue-cache';

// Re-export types for client
export type { RevenueRecord, SellCategory, RevenueCache, ShopSummary, PaymentStat, GoodsTypeStats, MemberStats, DailyPanel };

// ── Result types ──
export interface RevenueResult {
    success: boolean;
    data: RevenueRecord[];
    sellData: SellCategory[];
    dailyPanel: DailyPanel | null;  // populated when startDate === endDate
    updatedAt: string | null;
    fromCache: boolean;
    error?: string;
}

// ── Read from Firestore cache ──
export async function fetchRevenueFromCache(startDate: string, endDate: string): Promise<RevenueResult> {
    try {
        const db = getAdminDb();
        const docId = getCacheDocId(startDate, endDate);
        const doc = await db.collection(JOYWORLD_CACHE_COLLECTION).doc(docId).get();

        if (doc.exists) {
            const cached = doc.data() as RevenueCache;

            // Invalidate stale cache: if dailyPanel exists but memberStats is missing,
            // the doc was written before memberStats was added — re-fetch fresh data.
            const isStale = cached.dailyPanel != null && cached.dailyPanel.memberStats === undefined;
            if (isStale) {
                console.log('[Revenue Cache] Stale cache detected (missing memberStats), re-fetching:', docId);
                return await fetchDirectAndCache(startDate, endDate);
            }

            return {
                success: true,
                data: cached.revenue || [],
                sellData: cached.sellData || [],
                dailyPanel: cached.dailyPanel || null,
                updatedAt: cached.updatedAt || null,
                fromCache: true,
            };
        }

        // Cache miss — fallback to direct fetch and populate cache
        return await fetchDirectAndCache(startDate, endDate);
    } catch (err) {
        const message = err instanceof Error ? err.message : 'Lỗi không xác định.';
        console.error('[Revenue Cache Read Error]', message);
        return await fetchDirectAndCache(startDate, endDate);
    }
}

// ── Direct fetch from Joyworld + write to cache ──
async function fetchDirectAndCache(startDate: string, endDate: string): Promise<RevenueResult> {
    try {
        const token = await getJoyworldToken();
        if (!token) {
            return { success: false, data: [], sellData: [], dailyPanel: null, updatedAt: null, fromCache: false, error: 'Không thể xác thực với hệ thống Joyworld.' };
        }

        const isOneDay = startDate === endDate;

        // Always fetch overview data
        const [revenueRaw, sellRaw] = await Promise.all([
            getRevenueData(token, startDate, endDate),
            getSellData(token, startDate, endDate),
        ]);

        const revenue = normalizeRevenue(revenueRaw);
        const sellData = normalizeSell(sellRaw);

        // Fetch daily panel data only for single-day view
        let dailyPanel: DailyPanel | null = null;
        if (isOneDay) {
            const [summaryRaw, paymentRaw, goodsRaw, memberRaw] = await Promise.all([
                getShopSummary(token, startDate),
                getPaymentStatistics(token, startDate),
                getGoodsTypeStatistics(token, startDate),
                getStoreBalance(token, startDate, startDate),
            ]);
            dailyPanel = normalizeDailyPanel(startDate, summaryRaw, paymentRaw, goodsRaw, memberRaw);
        }

        const now = new Date().toISOString();

        // Write to cache
        try {
            const db = getAdminDb();
            const docId = getCacheDocId(startDate, endDate);
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const cacheDoc: any = {
                startDate,
                endDate,
                revenue,
                sellData,
                updatedAt: now,
                syncSource: 'manual' as const,
            };
            if (dailyPanel) cacheDoc.dailyPanel = dailyPanel;
            await db.collection(JOYWORLD_CACHE_COLLECTION).doc(docId).set(cacheDoc);
        } catch (cacheErr) {
            console.error('[Revenue Cache Write Error]', cacheErr);
        }

        return { success: true, data: revenue, sellData, dailyPanel, updatedAt: now, fromCache: false };
    } catch (err) {
        const message = err instanceof Error ? err.message : 'Lỗi không xác định.';
        console.error('[Revenue Direct Fetch Error]', message);
        return { success: false, data: [], sellData: [], dailyPanel: null, updatedAt: null, fromCache: false, error: message };
    }
}

// ── Manual sync trigger (from client) ──
export async function triggerSyncAction(startDate: string, endDate: string): Promise<RevenueResult> {
    return await fetchDirectAndCache(startDate, endDate);
}

// ── Normalization helpers ──
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function normalizeRevenue(raw: any): RevenueRecord[] {
    const items = raw?.data?.dataXs;
    if (!Array.isArray(items) || items.length === 0) return [];

    return items
        // Only keep rows where forDate is a real date (YYYY-MM-DD) — excludes any total/summary rows
        // regardless of their label ('Tổng cộng', 'Total', Chinese text, etc.)
        .filter((item: { forDate: string }) => /^\d{4}-\d{2}-\d{2}$/.test(item.forDate))
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        .map((item: any) => {
            const transferSysKey = Object.keys(item).find(k => k.includes('_SysMoney'));
            const transferRealKey = Object.keys(item).find(k => k.includes('_RealMoney'));
            return {
                forDate: item.forDate || '',
                realMoney: parseFloat(item.realMoney) || 0,
                sysMoney: parseFloat(item.sysMoney) || 0,
                saleSubMoney: parseFloat(item.saleSubMoney) || 0,
                cashSysMoney: parseFloat(item.cashSysMoney) || 0,
                cashRealMoney: parseFloat(item.cashRealMoney) || 0,
                cashErrorMoney: parseFloat(item.cashErrorMoney) || 0,
                transferSysMoney: transferSysKey ? parseFloat(item[transferSysKey]) || 0 : 0,
                transferRealMoney: transferRealKey ? parseFloat(item[transferRealKey]) || 0 : 0,
                sellCoinAmount: parseFloat(item.sellCoinAmount) || 0,
                sellCoinPrice: parseFloat(item.sellCoinPrice) || 0,
            };
        });
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function normalizeSell(raw: any): SellCategory[] {
    const items = raw?.data;
    if (!Array.isArray(items) || items.length === 0) return [];

    return items
        .filter((cat: { goodsCategory: string }) => cat.goodsCategory !== 'Tổng cộng')
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        .map((cat: any) => ({
            goodsCategory: cat.goodsCategory || '',
            realQty: parseFloat(cat.realQty) || 0,
            realMoney: parseFloat(cat.realMoney) || 0,
            totalQty: parseFloat(cat.totalQty) || 0,
            totalMoney: parseFloat(cat.totalMoney) || 0,
            cancelQty: parseFloat(cat.cancelQty) || 0,
            cancelMoney: parseFloat(cat.cancelMoney) || 0,
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            items: (cat.goodsItems || []).map((item: any) => ({
                goodsName: item.goodsName || '',
                goodsCategory: item.goodsCategory || '',
                realQty: parseFloat(item.realQty) || 0,
                realMoney: parseFloat(item.realMoney) || 0,
                totalQty: parseFloat(item.totalQty) || 0,
                totalMoney: parseFloat(item.totalMoney) || 0,
                cancelQty: parseFloat(item.cancelQty) || 0,
                cancelMoney: parseFloat(item.cancelMoney) || 0,
                sellRatio: parseFloat(item.sellRatio) || 0,
            })),
        }));
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function normalizeDailyPanel(forDate: string, summaryRaw: any, paymentRaw: any, goodsRaw: any, memberRaw: any): DailyPanel {
    // Shop summary
    const sd = summaryRaw?.data;
    const shopSummary: ShopSummary | null = sd ? {
        shopId: sd.shopId || 0,
        totalMoney: parseFloat(sd.totalMoney) || 0,
        shopMoney: parseFloat(sd.shopMoney) || 0,
        shopRealMoney: parseFloat(sd.shopRealMoney) || 0,
        thirdPartyMoney: parseFloat(sd.thirdPartyMoney) || 0,
        refundMoney: parseFloat(sd.refundMoney) || 0,
        preDepositPayMoney: parseFloat(sd.preDepositPayMoney) || 0,
        preDepositRefundMoney: parseFloat(sd.preDepositRefundMoney) || 0,
        preDepositPayRealMoney: parseFloat(sd.preDepositPayRealMoney) || 0,
        otherMoney: parseFloat(sd.otherMoney) || 0,
        lastRefreshTime: sd.lastRefreshTime || '',
    } : null;

    // Payment stats (exclude "Tổng cộng" which has paymentCategory === 0)
    const paymentStats: PaymentStat[] = Array.isArray(paymentRaw?.data)
        ? paymentRaw.data
            .filter((p: { paymentCategory: number }) => p.paymentCategory !== 0)
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            .map((p: any) => ({
                shopId: p.shopId || 0,
                forDate: p.forDate || '',
                paymentCategory: p.paymentCategory || 0,
                paymentCategoryName: p.paymentCategoryName || '',
                totalQty: parseFloat(p.totalQty) || 0,
                totalMoney: parseFloat(p.totalMoney) || 0,
                totalCancelQty: parseFloat(p.totalCancelQty) || 0,
                totalCancelMoney: parseFloat(p.totalCancelMoney) || 0,
                totalRealQty: parseFloat(p.totalRealQty) || 0,
                totalRealMoney: parseFloat(p.totalRealMoney) || 0,
                sellRatio: parseFloat(p.sellRatio) || 0,
                sellRatioDisplay: p.sellRatioDisplay || '',
            }))
        : [];

    // Goods type stats (exclude "Tổng cộng")
    const goodsTypeStats: GoodsTypeStats[] = Array.isArray(goodsRaw?.data)
        ? goodsRaw.data
            .filter((g: { goodsTypeName: string }) => g.goodsTypeName !== 'Tổng cộng')
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            .map((g: any) => ({
                shopId: g.shopId || 0,
                forDate: g.forDate || '',
                goodsTypeId: g.goodsTypeId || '',
                goodsTypeName: g.goodsTypeName || '',
                totalQty: parseFloat(g.totalQty) || 0,
                totalMoney: parseFloat(g.totalMoney) || 0,
                cancelQty: parseFloat(g.cancelQty) || 0,
                cancelMoney: parseFloat(g.cancelMoney) || 0,
                totalRealQty: parseFloat(g.totalRealQty) || 0,
                totalRealMoney: parseFloat(g.totalRealMoney) || 0,
                realCost: parseFloat(g.realCost) || 0,
                sellRatio: parseFloat(g.sellRatio) || 0,
                sellRatioDisplay: g.sellRatioDisplay || '',
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                goodsItems: (g.goodsItems || []).map((item: any) => ({
                    shopId: item.shopId || 0,
                    forDate: item.forDate || '',
                    goodsTypeId: item.goodsTypeId || '',
                    goodsTypeName: item.goodsTypeName || '',
                    goodsId: item.goodsId || '',
                    goodsName: item.goodsName || '',
                    totalQty: parseFloat(item.totalQty) || 0,
                    totalMoney: parseFloat(item.totalMoney) || 0,
                    totalCost: parseFloat(item.totalCost) || 0,
                    cancelQty: parseFloat(item.cancelQty) || 0,
                    cancelMoney: parseFloat(item.cancelMoney) || 0,
                    cancelCost: parseFloat(item.cancelCost) || 0,
                    realQty: parseFloat(item.realQty) || 0,
                    realMoney: parseFloat(item.realMoney) || 0,
                    realCost: parseFloat(item.realCost) || 0,
                    sellRatio: parseFloat(item.sellRatio) || 0,
                    sellRatioDisplay: item.sellRatioDisplay || '',
                })),
            }))
        : [];

    // Member stats — from footData (aggregated for the date range)
    const fd = memberRaw?.footData;

    const memberStats: MemberStats | null = fd ? {
        memberTotal: Number(fd.memberTotal) || 0,
        newMemberAmount: Number(fd.newMemberAmount) || 0,
        goShopMemberAmount: Number(fd.goShopMemberAmount) || 0,
        currency: Number(fd.currency) || 0,
        localCurrency: Number(fd.localCurrency) || 0,
        giftCoins: Number(fd.giftCoins) || 0,
        lotteryTicket: Number(fd.lotteryTicket) || 0,
    } : null;

    return {
        forDate,
        shopSummary,
        paymentStats,
        goodsTypeStats,
        memberStats,
        updatedAt: new Date().toISOString(),
    };
}
