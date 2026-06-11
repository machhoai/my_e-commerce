// app/api/ai-usage/route.ts
// API endpoint để check usage thống kê của AI Claude

import { getAdminDb } from '@/lib/firebase-admin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
    try {
        const db = getAdminDb();
        const now = new Date(Date.now() + 7 * 3600000);
        const today = now.toISOString().split('T')[0];
        const monthStart = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;

        // Lấy logs trong tháng hiện tại
        const snap = await db.collection('ai_usage_logs')
            .where('timestamp', '>=', `${monthStart}T00:00:00`)
            .orderBy('timestamp', 'desc')
            .get();

        let totalInput = 0, totalOutput = 0, totalRequests = 0;
        let todayInput = 0, todayOutput = 0, todayRequests = 0;
        const recentLogs: { time: string; question: string; input: number; output: number; total: number }[] = [];

        for (const doc of snap.docs) {
            const d = doc.data();
            const inp = Number(d.inputTokens) || 0;
            const out = Number(d.outputTokens) || 0;

            totalInput += inp;
            totalOutput += out;
            totalRequests++;

            if (d.timestamp?.startsWith(today)) {
                todayInput += inp;
                todayOutput += out;
                todayRequests++;
            }

            if (recentLogs.length < 20) {
                recentLogs.push({
                    time: d.timestamp,
                    question: d.question || '',
                    input: inp,
                    output: out,
                    total: inp + out,
                });
            }
        }

        // Ước tính chi phí (Claude Sonnet 4 pricing)
        const INPUT_COST_PER_M = 3;   // $3 per 1M input tokens
        const OUTPUT_COST_PER_M = 15;  // $15 per 1M output tokens
        const estimatedCostUSD =
            (totalInput / 1_000_000) * INPUT_COST_PER_M +
            (totalOutput / 1_000_000) * OUTPUT_COST_PER_M;

        return Response.json({
            period: `${monthStart} → ${today}`,
            month: {
                requests: totalRequests,
                inputTokens: totalInput,
                outputTokens: totalOutput,
                totalTokens: totalInput + totalOutput,
                estimatedCostUSD: `$${estimatedCostUSD.toFixed(4)}`,
            },
            today: {
                requests: todayRequests,
                inputTokens: todayInput,
                outputTokens: todayOutput,
                totalTokens: todayInput + todayOutput,
            },
            recentLogs,
        });
    } catch (err) {
        return Response.json({ error: String(err) }, { status: 500 });
    }
}
