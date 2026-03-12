// lib/joyworld.ts

const BASE_URL = 'http://joyworld.jingjianx.vip';

/**
 * Hàm 1: Đăng nhập và lấy Token
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
    // Trích xuất token tùy theo cấu trúc trả về thực tế
    return data.token || data.data?.token;
}

/**
 * Hàm 2: Lấy dữ liệu doanh thu (Revenue)
 */
export async function getRevenueData(token: string, startDate: string, endDate: string) {
    const url = `${BASE_URL}/finance/manager/revenueoverview/revenue?startDate=${startDate}&endDate=${endDate}`;
    console.log(url);

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
 * Hàm 2b: Lấy dữ liệu sản phẩm bán (Sell)
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

/**
 * Hàm 3: Ví dụ lấy dữ liệu Danh sách nhân viên (Data A)
 */
export async function getEmployeeData(token: string) {
    const url = `${BASE_URL}/basic/manager/employee/list`; // Ví dụ URL
    const response = await fetch(url, {
        headers: { 'Authorization': `Bearer ${token}` },
    });
    return response.json();
}

/**
 * Hàm 4: Ví dụ lấy dữ liệu Kho hàng (Data B)
 */
export async function getInventoryData(token: string) {
    const url = `${BASE_URL}/inventory/manager/stock`; // Ví dụ URL
    const response = await fetch(url, {
        headers: { 'Authorization': `Bearer ${token}` },
    });
    return response.json();
}