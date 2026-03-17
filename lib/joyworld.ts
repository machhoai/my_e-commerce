// lib/joyworld.ts

const BASE_URL = 'http://joyworld.jingjianx.vip';

/**
 * Đăng nhập và lấy Token
 */
export async function getJoyworldToken() {
    const response = await fetch(`${BASE_URL}/basic/manager/login/account`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        cache: 'no-store',
        body: JSON.stringify({
            userName: process.env.JOYWORLD_USER,
            password: process.env.JOYWORLD_PASS,
        }),
    });

    if (!response.ok) throw new Error('Đăng nhập thất bại');
    const data = await response.json();
    return data.token || data.data?.token;
}

/**
 * Lấy dữ liệu doanh thu theo khoảng ngày (Revenue overview)
 */
export async function getRevenueData(token: string, startDate: string, endDate: string) {
    const url = `${BASE_URL}/finance/manager/revenueoverview/revenue?startDate=${startDate}&endDate=${endDate}&_t=${Date.now()}`;
    const response = await fetch(url, {
        method: 'GET',
        cache: 'no-store',
        headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
        },
    });
    if (!response.ok) throw new Error('Lấy dữ liệu doanh thu thất bại');
    return response.json();
}

/**
 * Lấy dữ liệu sản phẩm bán theo khoảng ngày (Sell overview)
 */
export async function getSellData(token: string, startDate: string, endDate: string) {
    const url = `${BASE_URL}/finance/manager/revenueoverview/sell?startDate=${startDate}&endDate=${endDate}&_t=${Date.now()}`;
    const response = await fetch(url, {
        method: 'GET',
        cache: 'no-store',
        headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
        },
    });
    if (!response.ok) throw new Error('Lấy dữ liệu sản phẩm bán thất bại');
    return response.json();
}

// ─────────────────────────── DAILY PANEL APIs ───────────────────────────────

/**
 * Lấy tổng quan doanh thu trong ngày (shopRealMoney, refundMoney...)
 * GET /finance/manager/revenuepanel/getshopsummary?forDate=YYYY-MM-DD
 */
export async function getShopSummary(token: string, forDate: string) {
    const url = `${BASE_URL}/finance/manager/revenuepanel/getshopsummary?forDate=${forDate}&_t=${Date.now()}`;
    const response = await fetch(url, {
        method: 'GET',
        cache: 'no-store',
        headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
        },
    });
    if (!response.ok) throw new Error('Lấy shop summary thất bại');
    return response.json();
}

/**
 * Lấy thống kê theo phương thức thanh toán trong ngày
 * GET /finance/manager/revenuepanel/statistics/payment?forDate=YYYY-MM-DD
 */
export async function getPaymentStatistics(token: string, forDate: string) {
    const url = `${BASE_URL}/finance/manager/revenuepanel/statistics/payment?forDate=${forDate}&_t=${Date.now()}`;
    const response = await fetch(url, {
        method: 'GET',
        cache: 'no-store',
        headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
        },
    });
    if (!response.ok) throw new Error('Lấy thống kê thanh toán thất bại');
    return response.json();
}

/**
 * Lấy thống kê hàng hóa bán theo nhóm trong ngày
 * GET /finance/manager/revenuepanel/statistics/goods/type?forDate=YYYY-MM-DD
 */
export async function getGoodsTypeStatistics(token: string, forDate: string) {
    const url = `${BASE_URL}/finance/manager/revenuepanel/statistics/goods/type?forDate=${forDate}&_t=${Date.now()}`;
    const response = await fetch(url, {
        method: 'GET',
        cache: 'no-store',
        headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
        },
    });
    if (!response.ok) throw new Error('Lấy thống kê hàng hóa thất bại');
    return response.json();
}

// ─────────────────────────── ORDER APIs ─────────────────────────────────────

export interface OrderListParams {
    startTime: string;  // 'YYYY-MM-DD HH:mm:ss'
    endTime: string;
    statusContent?: string;
    payMethodContent?: string;
    couponIdContent?: string;
    page?: number;
    limit?: number;
}

/**
 * Lấy danh sách đơn hàng có lọc và phân trang
 * GET /order/manager/buy/order/list
 */
export async function getOrderList(token: string, params: OrderListParams) {
    const qs = new URLSearchParams({
        startTime: params.startTime,
        endTime: params.endTime,
        statusContent: params.statusContent ?? '',
        payMethodContent: params.payMethodContent ?? '',
        couponIdContent: params.couponIdContent ?? '',
        page: String(params.page ?? 1),
        limit: String(params.limit ?? 20),
        _t: String(Date.now()),
    });
    const url = `${BASE_URL}/order/manager/buy/order/list?${qs}`;
    const res = await fetch(url, {
        method: 'GET',
        cache: 'no-store',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    });
    if (!res.ok) throw new Error('Lấy danh sách đơn hàng thất bại');
    return res.json();
}

/**
 * Lấy chi tiết một đơn hàng
 * GET /order/manager/buy/getorderdetails?orderId=xxx
 */
export async function getOrderDetail(token: string, orderId: string) {
    const url = `${BASE_URL}/order/manager/buy/getorderdetails?orderId=${orderId}&_t=${Date.now()}`;
    const res = await fetch(url, {
        method: 'GET',
        cache: 'no-store',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    });
    if (!res.ok) throw new Error('Lấy chi tiết đơn hàng thất bại');
    return res.json();
}
