'use server';

import { getJoyworldToken } from '@/lib/joyworld';

// ── Types ─────────────────────────────────────────────────────────────────────

const STATUS_NAMES: Record<number, string> = {
    1: 'Chờ xử lý',
    2: 'Một phần',
    3: 'Hoàn thành',
    4: 'Đã huỷ',
};

export interface OrderRecord {
    orderId: string;
    orderNumber: string;
    createTime: string;
    status: number;
    statusName: string;
    goodsNames: string;
    payModeNames: string;
    totalQty: number;
    originalMoney: number;
    discountMoney: number;
    realMoney: number;
    cancelMoney: number;
    taxMoney: number;
    employeeName: string;
    realName: string;
    phone: string;
    terminalName: string;
    remark: string;
    channel: number;
}

export interface OrderFilters {
    employees: string[];
    statuses: { value: number; label: string }[];
    payMethods: string[];
    terminals: string[];
}

export interface OrderFoot {
    totalQty: number;
    originalMoney: number;
    discountMoney: number;
    realMoney: number;
    cancelMoney: number;
    taxMoney: number;
}

export interface FetchOrdersResult {
    success: boolean;
    data: OrderRecord[];
    filters: OrderFilters;
    foot: OrderFoot | null;
    error?: string;
}

// ── Goods / Payment detail types ──────────────────────────────────────────────

export interface OrderGoodsItem {
    goodsName: string;
    goodsCategoryName: string;
    price: number;
    qty: number;
    discountMoney: number;
    realMoney: number;
    cancelQty: number;
    taxRate: number;
    taxMoney: number;
}

export interface OrderPayItem {
    payOrderNumber: string;
    payMethodName: string;
    money: number;
    payStatus: number;
    payStatusName: string;
    payTime: string;
}

export interface OrderDetailData {
    orderId: string;
    orderNumber: string;
    status: number;
    createTime: string;
    originalMoney: number;
    discountMoney: number;
    realMoney: number;
    cancelMoney: number;
    taxMoney: number;
    realName: string;
    phone: string;
    employeeName: string;
    payModeNames: string;
    remark: string;
    goodsInfo: OrderGoodsItem[];
    payModeInfo: OrderPayItem[];
}

export interface FetchOrderDetailResult {
    success: boolean;
    data: OrderDetailData | null;
    error?: string;
}

// ── Server Actions ─────────────────────────────────────────────────────────────

/**
 * Fetch ALL orders for a date range in one call (limit=9999999).
 * Extract unique filter options server-side via Set.
 * Client does local filtering + pagination — zero extra network round-trips.
 */
export async function fetchOrdersAction(
    startDate: string,
    endDate: string,
): Promise<FetchOrdersResult> {
    const empty: FetchOrdersResult = {
        success: false,
        data: [],
        filters: { employees: [], statuses: [], payMethods: [], terminals: [] },
        foot: null,
    };

    try {
        const token = await getJoyworldToken();
        if (!token) return { ...empty, error: 'Không thể xác thực với Joyworld' };

        const st = encodeURIComponent(`${startDate} 00:00:00`);
        const et = encodeURIComponent(`${endDate} 23:59:59`);
        const url = `http://joyworld.jingjianx.vip/order/manager/buy/order/list?startTime=${st}&endTime=${et}&statusContent=&payMethodContent=&couponIdContent=&page=1&limit=9999999`;

        const res = await fetch(url, {
            method: 'GET',
            cache: 'no-store',
            headers: { Authorization: `Bearer ${token}` },
        });

        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const raw = await res.json();
        if (!raw.success) return { ...empty, error: raw.msg || 'Joyworld API trả lỗi' };

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const rows: OrderRecord[] = (raw.data?.dataXs ?? raw.data ?? []).map((o: any) => ({
            orderId: o.orderId,
            orderNumber: o.orderNumber || '',
            createTime: o.createTime || '',
            status: o.status,
            statusName: STATUS_NAMES[o.status] ?? `#${o.status}`,
            goodsNames: o.goodsNames || '',
            payModeNames: o.payModeNames || '',
            totalQty: o.totalQty || 0,
            originalMoney: o.originalMoney || 0,
            discountMoney: o.discountMoney || 0,
            realMoney: o.realMoney || 0,
            cancelMoney: o.cancelMoney || 0,
            taxMoney: o.taxMoney || 0,
            employeeName: o.employeeName || '',
            realName: o.realName || '',
            phone: o.phone || '',
            terminalName: o.terminalName || '',
            remark: o.remark || '',
            channel: o.channel || 0,
        }));

        // ── Extract unique filter options with Set ─────────────────────────────
        const empSet = new Set<string>();
        const statusSet = new Set<number>();
        const paySet = new Set<string>();
        const termSet = new Set<string>();

        for (const r of rows) {
            if (r.employeeName) empSet.add(r.employeeName);
            statusSet.add(r.status);
            if (r.terminalName) termSet.add(r.terminalName);
            r.payModeNames
                .split(/[,、，]/)
                .map((s) => s.trim())
                .filter(Boolean)
                .forEach((p) => paySet.add(p));
        }

        const foot: OrderFoot | null = raw.footData
            ? {
                  totalQty: raw.footData.totalQty || 0,
                  originalMoney: raw.footData.originalMoney || 0,
                  discountMoney: raw.footData.discountMoney || 0,
                  realMoney: raw.footData.realMoney || 0,
                  cancelMoney: raw.footData.cancelMoney || 0,
                  taxMoney: raw.footData.taxMoney || 0,
              }
            : null;

        return {
            success: true,
            data: rows,
            filters: {
                employees: Array.from(empSet).sort(),
                statuses: Array.from(statusSet)
                    .sort()
                    .map((s) => ({ value: s, label: STATUS_NAMES[s] ?? `#${s}` })),
                payMethods: Array.from(paySet).sort(),
                terminals: Array.from(termSet).sort(),
            },
            foot,
        };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch (e: any) {
        return { ...empty, error: e.message };
    }
}

/**
 * Fetch full detail for a single order (for the detail drawer).
 */
export async function fetchOrderDetailAction(orderId: string): Promise<FetchOrderDetailResult> {
    try {
        const token = await getJoyworldToken();
        if (!token) return { success: false, data: null, error: 'Không thể xác thực' };

        const url = `http://joyworld.jingjianx.vip/order/manager/buy/getorderdetails?orderId=${orderId}&_t=${Date.now()}`;
        const res = await fetch(url, {
            method: 'GET',
            cache: 'no-store',
            headers: { Authorization: `Bearer ${token}` },
        });

        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const raw = await res.json();
        if (!raw.success) return { success: false, data: null, error: raw.msg || 'Lỗi API' };

        const d = raw.data;
        return {
            success: true,
            data: {
                orderId,
                orderNumber: d.orderNumber,
                status: d.status,
                createTime: d.createTime,
                originalMoney: d.originalMoney || 0,
                discountMoney: d.discountMoney || 0,
                realMoney: d.realMoney || 0,
                cancelMoney: d.cancelMoney || 0,
                taxMoney: d.taxMoney || 0,
                realName: d.realName || '',
                phone: d.phone || '',
                employeeName: d.employeeName || '',
                payModeNames: d.payModeNames || '',
                remark: d.remark || '',
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                goodsInfo: (d.goodsInfo || []).map((g: any) => ({
                    goodsName: g.goodsName,
                    goodsCategoryName: g.goodsCategoryName,
                    price: g.price || 0,
                    qty: g.qty || 0,
                    discountMoney: g.discountMoney || 0,
                    realMoney: g.realMoney || 0,
                    cancelQty: g.cancelQty || 0,
                    taxRate: g.taxRate || 0,
                    taxMoney: g.taxMoney || 0,
                })),
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                payModeInfo: (d.payModeInfo || []).map((p: any) => ({
                    payOrderNumber: p.payOrderNumber,
                    payMethodName: p.payMethodName,
                    money: p.money || 0,
                    payStatus: p.payStatus,
                    payStatusName: p.payStatusName,
                    payTime: p.payTime,
                })),
            },
        };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch (e: any) {
        return { success: false, data: null, error: e.message };
    }
}

// ── Goods list types ──────────────────────────────────────────────────────────

export interface GoodsRecord {
    id: string;
    orderId: string;
    orderNumber: string;
    goodsName: string;
    showCategoryName: string;
    goodsTypeName: string;
    price: number;
    qty: number;
    realMoney: number;
    cancelMoney: number;
    payModeNames: string;
    employeeName: string;
    createTime: string;
    status: number;
    statusName: string;
}

export interface GoodsFilters {
    categories: string[];
    goodsNames: string[];
    employees: string[];
    statuses: { value: number; label: string }[];
}

export interface FetchOrderGoodsResult {
    success: boolean;
    data: GoodsRecord[];
    filters: GoodsFilters;
    error?: string;
}

/**
 * Fetch ALL order goods lines for a date range in one call (limit=9999999).
 * Extract unique filter options server-side via Set.
 */
export async function fetchOrderGoodsAction(
    startDate: string,
    endDate: string,
): Promise<FetchOrderGoodsResult> {
    const empty: FetchOrderGoodsResult = {
        success: false,
        data: [],
        filters: { categories: [], goodsNames: [], employees: [], statuses: [] },
    };

    try {
        const token = await getJoyworldToken();
        if (!token) return { ...empty, error: 'Không thể xác thực với Joyworld' };

        const st = encodeURIComponent(`${startDate} 00:00:00`);
        const et = encodeURIComponent(`${endDate} 23:59:59`);
        const url = `http://joyworld.jingjianx.vip/order/manager/buy/order/goods/list?startTime=${st}&endTime=${et}&page=1&limit=9999999`;

        const res = await fetch(url, {
            method: 'GET',
            cache: 'no-store',
            headers: { Authorization: `Bearer ${token}` },
        });

        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const raw = await res.json();
        if (!raw.success) return { ...empty, error: raw.msg || 'Joyworld API trả lỗi' };

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const rows: GoodsRecord[] = (raw.data?.dataXs ?? raw.data ?? []).map((g: any) => ({
            id: g.id ?? g.goodsId ?? '',
            orderId: g.orderId ?? '',
            orderNumber: g.orderNumber || '',
            goodsName: g.goodsName || '',
            showCategoryName: g.showCategoryName || g.goodsCategoryName || '',
            goodsTypeName: g.goodsTypeName || '',
            price: g.price || 0,
            qty: g.qty || 0,
            realMoney: g.realMoney || 0,
            cancelMoney: g.cancelMoney || 0,
            payModeNames: g.payModeNames || '',
            employeeName: g.employeeName || '',
            createTime: g.createTime || '',
            status: g.status || 0,
            statusName: STATUS_NAMES[g.status] ?? `#${g.status}`,
        }));

        // ── Extract unique filter options ──────────────────────────────────────
        const catSet = new Set<string>();
        const nameSet = new Set<string>();
        const empSet = new Set<string>();
        const statusSet = new Set<number>();

        for (const r of rows) {
            if (r.showCategoryName) catSet.add(r.showCategoryName);
            if (r.goodsName) nameSet.add(r.goodsName);
            if (r.employeeName) empSet.add(r.employeeName);
            statusSet.add(r.status);
        }

        return {
            success: true,
            data: rows,
            filters: {
                categories: Array.from(catSet).sort(),
                goodsNames: Array.from(nameSet).sort(),
                employees: Array.from(empSet).sort(),
                statuses: Array.from(statusSet)
                    .sort()
                    .map((s) => ({ value: s, label: STATUS_NAMES[s] ?? `#${s}` })),
            },
        };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch (e: any) {
        return { ...empty, error: e.message };
    }
}
