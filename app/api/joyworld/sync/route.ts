// app/api/joyworld/sync/route.ts
// Cron endpoint: fetches Joyworld revenue + sell data and caches to Firestore

import { NextRequest, NextResponse } from 'next/server';
import { getAdminDb } from '@/lib/firebase-admin';
import { getJoyworldToken, getRevenueData, getSellData } from '@/lib/joyworld';
import {
    JOYWORLD_CACHE_COLLECTION,
    getCacheDocId,
    type RevenueRecord,
    type SellCategory,
} from '@/lib/revenue-cache';

// ── Revenue normalization ──
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

// ── Sell normalization ──
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

// ── Helper: compute default date range (current month) ──
function getDefaultRange() {
    const now = new Date();
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, '0');
    const d = String(now.getDate()).padStart(2, '0');
    return { startDate: `${y}-${m}-01`, endDate: `${y}-${m}-${d}` };
}

// ═══ POST handler ═══
export async function POST(request: NextRequest) {
    try {
        // ── Auth check ──
        const secret = request.headers.get('x-sync-secret') || request.nextUrl.searchParams.get('secret');
        if (secret !== process.env.JOYWORLD_SYNC_SECRET && process.env.JOYWORLD_SYNC_SECRET) {
            return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
        }

        // ── Parse date range (optional, defaults to current month) ──
        let body: { startDate?: string; endDate?: string } = {};
        try { body = await request.json(); } catch { /* empty body = use defaults */ }
        const defaults = getDefaultRange();
        const startDate: string = body.startDate || defaults.startDate;
        const endDate: string = body.endDate || defaults.endDate;

        // ── Fetch from Joyworld ──
        const token = await getJoyworldToken();
        if (!token) {
            return NextResponse.json({ success: false, error: 'Token authentication failed' }, { status: 500 });
        }

        const [revenueRaw, sellRaw] = await Promise.all([
            getRevenueData(token, startDate, endDate),
            getSellData(token, startDate, endDate),
        ]);

        const revenue = normalizeRevenue(revenueRaw);
        const sellData = normalizeSell(sellRaw);

        // ── Write to Firestore ──
        const db = getAdminDb();
        const docId = getCacheDocId(startDate, endDate);
        const now = new Date().toISOString();

        await db.collection(JOYWORLD_CACHE_COLLECTION).doc(docId).set({
            startDate,
            endDate,
            revenue,
            sellData,
            updatedAt: now,
            syncSource: 'cron',
        });

        console.log(`[Joyworld Sync] Cached ${revenue.length} revenue records, ${sellData.length} sell categories → ${docId}`);

        return NextResponse.json({
            success: true,
            docId,
            revenueCount: revenue.length,
            sellCategoryCount: sellData.length,
            updatedAt: now,
        });
    } catch (err) {
        const message = err instanceof Error ? err.message : 'Unknown error';
        console.error('[Joyworld Sync Error]', message);
        return NextResponse.json({ success: false, error: message }, { status: 500 });
    }
}
