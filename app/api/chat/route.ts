// app/api/chat/route.ts
// AI Chat API — Trợ lý Tài chính Joy World
// Vercel AI SDK v4 + @ai-sdk/google + Gemini 1.5 Flash + Function Calling

import { google } from '@ai-sdk/google';
import { streamText } from 'ai';
import { z } from 'zod';
import {
    getJoyworldToken,
    getRevenueData,
    getSellData,
    getShopSummary,
    getPaymentStatistics,
    getGoodsTypeStatistics,
    getStoreBalance,
} from '@/lib/joyworld';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const SYSTEM_PROMPT = `Bạn là Giám đốc Tài chính AI của Joy World Entertainment — hệ thống khu vui chơi tại Việt Nam.

Nhiệm vụ:
- Phân tích dữ liệu doanh thu, thành viên, hàng hóa từ hệ thống thực tế.
- Trả lời ngắn gọn, chính xác bằng tiếng Việt.
- BẮT BUỘC gọi tools để lấy số liệu thực tế trước khi trả lời.
- Format số tiền: VNĐ (ví dụ: 12,500,000 VNĐ hoặc 12.5 triệu VNĐ).

Ngày hôm nay: ${new Date(Date.now() + 7 * 3600000).toISOString().split('T')[0]} (GMT+7).
Định dạng ngày cho tools: YYYY-MM-DD.`;

export async function POST(req: Request) {
    try {
        const body = await req.json();
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const messages: any[] = Array.isArray(body?.messages) ? body.messages : [];

        const result = streamText({
            model: google('gemini-flash-latest'),
            system: SYSTEM_PROMPT,
            messages,
            maxSteps: 5,
            onError: (event) => {
                console.error('[AI Chat] Stream error:', JSON.stringify(event, null, 2));
            },
            tools: {
                getRevenue: {
                    description: 'Lấy dữ liệu doanh thu tổng quan theo khoảng ngày.',
                    parameters: z.object({
                        startDate: z.string().describe('Ngày bắt đầu YYYY-MM-DD'),
                        endDate: z.string().describe('Ngày kết thúc YYYY-MM-DD'),
                    }),
                    execute: async ({ startDate, endDate }) => {
                        try {
                            const token = await getJoyworldToken();
                            return { success: true, data: await getRevenueData(token, startDate, endDate) };
                        } catch (err) { return { success: false, error: String(err) }; }
                    },
                },
                getSellOverview: {
                    description: 'Lấy dữ liệu hàng hóa/vé/combo bán theo khoảng ngày.',
                    parameters: z.object({
                        startDate: z.string().describe('Ngày bắt đầu YYYY-MM-DD'),
                        endDate: z.string().describe('Ngày kết thúc YYYY-MM-DD'),
                    }),
                    execute: async ({ startDate, endDate }) => {
                        try {
                            const token = await getJoyworldToken();
                            return { success: true, data: await getSellData(token, startDate, endDate) };
                        } catch (err) { return { success: false, error: String(err) }; }
                    },
                },
                getDailyPanel: {
                    description: 'Lấy dữ liệu đầy đủ 1 ngày: doanh thu, thanh toán, hàng hóa.',
                    parameters: z.object({
                        date: z.string().describe('Ngày YYYY-MM-DD'),
                    }),
                    execute: async ({ date }) => {
                        try {
                            const token = await getJoyworldToken();
                            const [summary, payment, goods] = await Promise.all([
                                getShopSummary(token, date),
                                getPaymentStatistics(token, date),
                                getGoodsTypeStatistics(token, date),
                            ]);
                            return { success: true, date, summary, payment, goods };
                        } catch (err) { return { success: false, error: String(err) }; }
                    },
                },
                getMemberStats: {
                    description: 'Lấy thống kê thành viên: tổng số, thành viên mới, lượt khách, số dư.',
                    parameters: z.object({
                        startDate: z.string().describe('Ngày bắt đầu YYYY-MM-DD'),
                        endDate: z.string().describe('Ngày kết thúc YYYY-MM-DD'),
                    }),
                    execute: async ({ startDate, endDate }) => {
                        try {
                            const token = await getJoyworldToken();
                            return { success: true, data: await getStoreBalance(token, startDate, endDate) };
                        } catch (err) { return { success: false, error: String(err) }; }
                    },
                },
            },
        });

        return result.toDataStreamResponse();

    } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        console.error('[AI Chat FATAL]', msg, err instanceof Error ? err.stack : '');
        return Response.json({ error: msg }, { status: 500 });
    }
}
