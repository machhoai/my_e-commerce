'use server';

import { getAdminDb } from '@/lib/firebase-admin';
import { getJoyworldToken, getRevenueData, getSellData } from '@/lib/joyworld';
import {
    JOYWORLD_CACHE_COLLECTION,
    getCacheDocId,
    type RevenueRecord,
    type SellCategory,
    type RevenueCache,
} from '@/lib/revenue-cache';

// Re-export types for client
export type { RevenueRecord, SellCategory, RevenueCache };

// ── Result types ──
export interface RevenueResult {
    success: boolean;
    data: RevenueRecord[];
    sellData: SellCategory[];
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
            return {
                success: true,
                data: cached.revenue || [],
                sellData: cached.sellData || [],
                updatedAt: cached.updatedAt || null,
                fromCache: true,
            };
        }

        // Cache miss — fallback to direct fetch and populate cache
        return await fetchDirectAndCache(startDate, endDate);
    } catch (err) {
        const message = err instanceof Error ? err.message : 'Lỗi không xác định.';
        console.error('[Revenue Cache Read Error]', message);
        // Fallback to direct on cache error
        return await fetchDirectAndCache(startDate, endDate);
    }
}

// ── Direct fetch from Joyworld + write to cache ──
async function fetchDirectAndCache(startDate: string, endDate: string): Promise<RevenueResult> {
    try {
        const token = await getJoyworldToken();
        if (!token) {
            return { success: false, data: [], sellData: [], updatedAt: null, fromCache: false, error: 'Không thể xác thực với hệ thống Joyworld.' };
        }

        const [revenueRaw, sellRaw] = await Promise.all([
            getRevenueData(token, startDate, endDate),
            getSellData(token, startDate, endDate),
        ]);

        const revenue = normalizeRevenue(revenueRaw);
        const sellData = normalizeSell(sellRaw);
        const now = new Date().toISOString();

        // Write to cache in background
        try {
            const db = getAdminDb();
            const docId = getCacheDocId(startDate, endDate);
            await db.collection(JOYWORLD_CACHE_COLLECTION).doc(docId).set({
                startDate,
                endDate,
                revenue,
                sellData,
                updatedAt: now,
                syncSource: 'manual' as const,
            });
        } catch (cacheErr) {
            console.error('[Revenue Cache Write Error]', cacheErr);
        }

        return { success: true, data: revenue, sellData, updatedAt: now, fromCache: false };
    } catch (err) {
        const message = err instanceof Error ? err.message : 'Lỗi không xác định.';
        console.error('[Revenue Direct Fetch Error]', message);
        return { success: false, data: [], sellData: [], updatedAt: null, fromCache: false, error: message };
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
        .filter((item: { forDate: string }) => item.forDate !== 'Tổng cộng')
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
