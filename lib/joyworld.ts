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
    const url = `${BASE_URL}/finance/manager/revenueoverview/revenue?startDate=${startDate}&endDate=${endDate}`;
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
    const url = `${BASE_URL}/finance/manager/revenueoverview/sell?startDate=${startDate}&endDate=${endDate}`;
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
    const url = `${BASE_URL}/finance/manager/revenuepanel/getshopsummary?forDate=${forDate}`;
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
    const url = `${BASE_URL}/finance/manager/revenuepanel/statistics/payment?forDate=${forDate}`;
    console.log(url);
    const response = await fetch(url, {
        method: 'GET',
        cache: 'no-store',
        headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
        },
    });
    console.log("=== DỮ LIỆU DOANH THU THẬT SỰ ===");
    console.log(JSON.stringify(response, null, 2));
    console.log("=================================");
    if (!response.ok) throw new Error('Lấy thống kê thanh toán thất bại');
    return response.json();
}

/**
 * Lấy thống kê hàng hóa bán theo nhóm trong ngày
 * GET /finance/manager/revenuepanel/statistics/goods/type?forDate=YYYY-MM-DD
 */
export async function getGoodsTypeStatistics(token: string, forDate: string) {
    const url = `${BASE_URL}/finance/manager/revenuepanel/statistics/goods/type?forDate=${forDate}`;
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