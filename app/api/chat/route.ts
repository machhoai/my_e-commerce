// app/api/chat/route.ts
// AI Chat API — Trợ lý Tài chính Joy World
// Vercel AI SDK + @ai-sdk/anthropic + Gateway gwai.cloud
// Claude Sonnet 4.6 + Smart Context Routing + Prompt Caching

import { createAnthropic } from '@ai-sdk/anthropic';
import { generateText, streamText } from 'ai';
import { classifyIntent, extractDateRange } from '@/lib/ai/intent-classifier';
import { buildDataContext } from '@/lib/ai/context-builder';
import { buildStaticSystemPrompt, buildDataPrompt } from '@/lib/ai/system-prompt';
import { getAdminDb } from '@/lib/firebase-admin';

// ── Anthropic provider qua gateway gwai.cloud ───────────────
// Gateway kiểm tra User-Agent — thiếu header này sẽ bị 403 Forbidden
// SDK tự gắn x-api-key từ apiKey param, KHÔNG thêm thủ công để tránh xung đột
const anthropic = createAnthropic({
    baseURL: 'https://1gw.gwai.cloud/v1',
    apiKey: process.env.ANTHROPIC_API_KEY,
    headers: {
        'User-Agent': 'curl/8.7.1',
    },
});

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

/** Lấy ngày hôm nay (VN timezone) */
function getTodayVN(): string {
    return new Date(Date.now() + 7 * 3600000).toISOString().split('T')[0];
}

/** Kiểm tra API key (có TTL để tự phục hồi khi lỗi tạm thời) */
let apiKeyValid: boolean | null = null;
let apiKeyCheckedAt = 0;
let lastValidationError = '';
const VALIDATION_TTL_MS = 5 * 60 * 1000; // 5 phút

async function validateApiKey(): Promise<{ ok: boolean; error?: string }> {
    // Cache hit — chỉ dùng nếu result = true hoặc chưa hết hạn
    if (apiKeyValid !== null) {
        const age = Date.now() - apiKeyCheckedAt;
        if (apiKeyValid === true) return { ok: true };
        if (age < VALIDATION_TTL_MS) return { ok: false, error: lastValidationError };
        apiKeyValid = null;
    }

    const rawKey = process.env.ANTHROPIC_API_KEY;
    const keyPreview = rawKey
        ? `${rawKey.slice(0, 12)}...${rawKey.slice(-4)} (len=${rawKey.length})`
        : '⚠️ MISSING — env ANTHROPIC_API_KEY is undefined';
    const baseURL = process.env.ANTHROPIC_BASE_URL || 'https://api.anthropic.com/v1 (default)';
    console.log('[AI Chat] Validating | key:', keyPreview, '| endpoint:', baseURL);

    if (!rawKey) {
        lastValidationError = 'ANTHROPIC_API_KEY chưa được cấu hình trên server.';
        apiKeyValid = false;
        apiKeyCheckedAt = Date.now();
        return { ok: false, error: lastValidationError };
    }

    try {
        await generateText({
            model: anthropic('claude-sonnet-4-6'),
            prompt: 'Hi',
            maxTokens: 1,
        });
        apiKeyValid = true;
        apiKeyCheckedAt = Date.now();
        lastValidationError = '';
        console.log('[AI Chat] ✅ Gateway + API key validated');
        return { ok: true };
    } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        console.error('[AI Chat] ❌ Validation failed:', msg);
        lastValidationError = msg;
        apiKeyValid = false;
        apiKeyCheckedAt = Date.now();
        return { ok: false, error: msg };
    }
}

export async function POST(req: Request) {
    try {
        // ── Pre-flight: Validate API key ───────────────────────
        const validation = await validateApiKey();
        if (!validation.ok) {
            console.error('[AI Chat] Key validation failed:', validation.error);
            return Response.json(
                { error: `API Key / Gateway lỗi: ${validation.error}` },
                { status: 401 }
            );
        }

        const body = await req.json();
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const rawMessages: any[] = Array.isArray(body?.messages) ? body.messages : [];

        // ── Phase 1: Intent Classification (0 token cost) ──────
        const lastUserMsg = [...rawMessages].reverse().find(m => m.role === 'user');
        const userText = typeof lastUserMsg?.content === 'string' ? lastUserMsg.content : '';
        const intents = classifyIntent(userText);
        console.log('[AI Chat] Intents:', intents, '| Question:', userText.slice(0, 80));

        // ── Phase 1.5: Date Extraction ─────────────────────────
        const today = getTodayVN();
        const dateRange = extractDateRange(userText);
        const startDate = dateRange?.start ?? today;
        const endDate = dateRange?.end ?? today;
        console.log('[AI Chat] Date range:', startDate, '→', endDate);

        // ── Phase 2: Fetch + Slim relevant data ────────────────
        let context = '';
        let sources: string[] = [];
        let fetchTimeMs = 0;
        let fetchedRange = { start: startDate, end: endDate };
        try {
            const data = await buildDataContext(intents, startDate, endDate);
            context = data.context;
            sources = data.sources;
            fetchTimeMs = data.fetchTimeMs;
            fetchedRange = data.dateRange;
            console.log('[AI Chat] Data fetched in', fetchTimeMs, 'ms | Sources:', sources);
        } catch (fetchErr) {
            console.error('[AI Chat] Data fetch error:', fetchErr);
            context = '⚠️ Không thể tải dữ liệu. Hãy trả lời dựa trên kiến thức chung.';
        }

        // ── Phase 3: Build messages with Prompt Caching ────────
        // System prompt tĩnh → cache_control: ephemeral (TTL ~5 min)
        // Data context → thay đổi theo câu hỏi, không cache
        const staticPrompt = buildStaticSystemPrompt();
        const dataPrompt = buildDataPrompt(context, today, sources, fetchedRange);

        // Xây dựng messages array với cache markers
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const messages: any[] = [
            // Inject system prompt as a cacheable user message
            {
                role: 'user',
                content: [
                    {
                        type: 'text',
                        text: staticPrompt,
                        // Đánh dấu phần tĩnh là cacheable
                        experimental_providerMetadata: {
                            anthropic: { cacheControl: { type: 'ephemeral' } },
                        },
                    },
                    {
                        type: 'text',
                        text: dataPrompt,
                    },
                ],
            },
            {
                role: 'assistant',
                content: 'Đã nhận dữ liệu. Tôi sẵn sàng phân tích. Hãy đặt câu hỏi.',
            },
            // Append actual conversation messages (skip any previous system injection)
            ...rawMessages,
        ];

        // ── Phase 4: Stream to Claude via Gateway ──────────────
        const result = streamText({
            model: anthropic('claude-sonnet-4-6'),
            messages,
            maxTokens: 2048,
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            onFinish: async ({ usage }: any) => {
                try {
                    const db = getAdminDb();
                    await db.collection('ai_usage_logs').add({
                        timestamp: new Date().toISOString(),
                        model: 'claude-sonnet-4-6',
                        gateway: '1gw.gwai.cloud',
                        intents,
                        sources,
                        dateRange: fetchedRange,
                        inputTokens: usage?.promptTokens ?? 0,
                        outputTokens: usage?.completionTokens ?? 0,
                        totalTokens: (usage?.promptTokens ?? 0) + (usage?.completionTokens ?? 0),
                        cacheCreationInputTokens: usage?.cacheCreationInputTokens ?? 0,
                        cacheReadInputTokens: usage?.cacheReadInputTokens ?? 0,
                        fetchTimeMs,
                        question: userText.slice(0, 200),
                    });
                } catch (logErr) {
                    console.error('[AI Usage Log]', logErr);
                }
            },
        });

        return result.toDataStreamResponse({
            headers: {
                'X-AI-Intents': intents.join(','),
                'X-AI-Sources': sources.join(','),
                'X-AI-Fetch-Ms': String(fetchTimeMs),
                'X-AI-Date-Range': `${startDate}--${endDate}`,
            },
        });

    } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        console.error('[AI Chat FATAL]', msg);
        return Response.json({ error: msg }, { status: 500 });
    }
}
