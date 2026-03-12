// lib/revenue-cache.ts
// Shared types and constants for revenue data Firestore cache

// ── Collection & Doc ID ─────────────────────────────────
export const JOYWORLD_CACHE_COLLECTION = 'joyworld_cache';

export function getCacheDocId(startDate: string, endDate: string): string {
    return `revenue_${startDate}_${endDate}`;
}

// ── Revenue Record (normalized from Joyworld API) ───────
export interface RevenueRecord {
    forDate: string;
    realMoney: number;
    sysMoney: number;
    saleSubMoney: number;
    cashSysMoney: number;
    cashRealMoney: number;
    cashErrorMoney: number;
    transferSysMoney: number;
    transferRealMoney: number;
    sellCoinAmount: number;
    sellCoinPrice: number;
}

// ── Sell Item / Category ────────────────────────────────
export interface SellItem {
    goodsName: string;
    goodsCategory: string;
    realQty: number;
    realMoney: number;
    totalQty: number;
    totalMoney: number;
    cancelQty: number;
    cancelMoney: number;
    sellRatio: number;
}

export interface SellCategory {
    goodsCategory: string;
    items: SellItem[];
    realQty: number;
    realMoney: number;
    totalQty: number;
    totalMoney: number;
    cancelQty: number;
    cancelMoney: number;
}

// ── Firestore Cache Document ────────────────────────────
export interface RevenueCache {
    startDate: string;
    endDate: string;
    revenue: RevenueRecord[];
    sellData: SellCategory[];
    updatedAt: string; // ISO string
    syncSource: 'cron' | 'manual';
}
