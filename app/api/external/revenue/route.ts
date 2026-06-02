import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { getJoyworldToken, getRevenueData } from '@/lib/joyworld';

// Helper to normalize revenue like in joyworld sync
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function normalizeRevenue(raw: any) {
    const items = raw?.data?.dataXs;
    if (!Array.isArray(items) || items.length === 0) return [];

    return items
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        .filter((item: any) => item.forDate !== 'Tổng cộng')
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

function getDaysInMonth(year: number, month: number) {
    return new Date(year, month, 0).getDate();
}

export async function GET(request: NextRequest) {
    try {
        const apiKey = request.headers.get('x-api-key');
        const expectedKey = process.env.EXTERNAL_API_SECRET;

        if (!expectedKey) {
            console.error('EXTERNAL_API_SECRET is not configured');
            return NextResponse.json({ success: false, error: 'Internal Server Error' }, { status: 500 });
        }

        if (!apiKey) {
            return NextResponse.json({ success: false, error: 'Unauthorized: Missing x-api-key header' }, { status: 401 });
        }

        // Constant time comparison to prevent timing attacks
        let isValid = false;
        try {
            const apiKeyBuffer = Buffer.from(apiKey);
            const expectedKeyBuffer = Buffer.from(expectedKey);
            if (apiKeyBuffer.length === expectedKeyBuffer.length) {
                isValid = crypto.timingSafeEqual(apiKeyBuffer, expectedKeyBuffer);
            }
        } catch (e) {
            isValid = false;
        }

        if (!isValid) {
            return NextResponse.json({ success: false, error: 'Unauthorized: Invalid API Key' }, { status: 401 });
        }

        const { searchParams } = new URL(request.url);
        let startDate = searchParams.get('startDate');
        let endDate = searchParams.get('endDate');

        const date = searchParams.get('date');
        const month = searchParams.get('month');
        const year = searchParams.get('year');

        if (date) {
            // YYYY-MM-DD
            startDate = date;
            endDate = date;
        } else if (month) {
            // YYYY-MM
            const [y, m] = month.split('-');
            const lastDay = getDaysInMonth(parseInt(y), parseInt(m));
            startDate = `${month}-01`;
            endDate = `${month}-${lastDay.toString().padStart(2, '0')}`;
        } else if (year) {
            // YYYY
            startDate = `${year}-01-01`;
            endDate = `${year}-12-31`;
        }

        if (!startDate || !endDate) {
            return NextResponse.json(
                { success: false, error: 'Missing required parameters. Please provide date, month, year, or both startDate and endDate.' },
                { status: 400 }
            );
        }

        const token = await getJoyworldToken();
        if (!token) {
            return NextResponse.json({ success: false, error: 'Failed to authenticate with Joyworld' }, { status: 500 });
        }

        const rawData = await getRevenueData(token, startDate, endDate);
        const normalizedData = normalizeRevenue(rawData);

        // Calculate totals
        const totals = normalizedData.reduce((acc, curr) => ({
            realMoney: acc.realMoney + curr.realMoney,
            sysMoney: acc.sysMoney + curr.sysMoney,
            cashRealMoney: acc.cashRealMoney + curr.cashRealMoney,
            transferRealMoney: acc.transferRealMoney + curr.transferRealMoney,
        }), {
            realMoney: 0,
            sysMoney: 0,
            cashRealMoney: 0,
            transferRealMoney: 0
        });

        return NextResponse.json({
            success: true,
            range: { startDate, endDate },
            totals,
            data: normalizedData
        });

    } catch (error) {
        console.error('[External API Error]', error);
        return NextResponse.json(
            { success: false, error: error instanceof Error ? error.message : 'Unknown error' },
            { status: 500 }
        );
    }
}
