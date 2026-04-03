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

// ── Daily Panel Types (single-day view) ─────────────────
export interface ShopSummary {
    shopId: number;
    totalMoney: number;
    shopMoney: number;
    shopRealMoney: number;     // Doanh thu thực tế (quan trọng nhất)
    thirdPartyMoney: number;
    refundMoney: number;       // Tổng tiền hủy
    preDepositPayMoney: number;
    preDepositRefundMoney: number;
    preDepositPayRealMoney: number;
    otherMoney: number;
    lastRefreshTime: string;
}

export interface PaymentStat {
    shopId: number;
    forDate: string;
    paymentCategory: number;
    paymentCategoryName: string;
    totalQty: number;
    totalMoney: number;
    totalCancelQty: number;
    totalCancelMoney: number;
    totalRealQty: number;
    totalRealMoney: number;
    sellRatio: number;
    sellRatioDisplay: string;
}

export interface GoodsItem {
    shopId: number;
    forDate: string;
    goodsTypeId: string;
    goodsTypeName: string;
    goodsId: string;
    goodsName: string;
    totalQty: number;
    totalMoney: number;
    totalCost: number;
    cancelQty: number;
    cancelMoney: number;
    cancelCost: number;
    realQty: number;
    realMoney: number;
    realCost: number;
    sellRatio: number;
    sellRatioDisplay: string;
}

export interface GoodsTypeStats {
    shopId: number;
    forDate: string;
    goodsTypeId: string;
    goodsTypeName: string;
    goodsItems: GoodsItem[];
    totalQty: number;
    totalMoney: number;
    cancelQty: number;
    cancelMoney: number;
    totalRealQty: number;
    totalRealMoney: number;
    realCost: number;
    sellRatio: number;
    sellRatioDisplay: string;
}

export interface MemberStats {
    memberTotal: number;       // Tổng số thành viên hiện có
    newMemberAmount: number;   // Thành viên mới trong ngày
    goShopMemberAmount: number;// Lượt khách đến cửa hàng
    currency: number;          // Tổng số dư xu hệ thống
    localCurrency: number;     // Tổng VND nạp
    giftCoins: number;         // Xu tặng
    lotteryTicket: number;     // Điểm tích lũy
}

export interface DailyPanel {
    forDate: string;
    shopSummary: ShopSummary | null;
    paymentStats: PaymentStat[];
    goodsTypeStats: GoodsTypeStats[];
    memberStats: MemberStats | null;
    updatedAt: string;
}

// ── Firestore Cache Document ────────────────────────────
export interface RevenueCache {
    startDate: string;
    endDate: string;
    revenue: RevenueRecord[];
    sellData: SellCategory[];
    updatedAt: string; // ISO string
    syncSource: 'cron' | 'manual';
    dailyPanel?: DailyPanel; // Only present when startDate === endDate
}
