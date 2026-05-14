// app/api/chat/route.ts
// AI Chat API — Trợ lý Tài chính Joy World
// Multi-provider: Anthropic (gwai.cloud) + Groq + Google Gemini
// Smart Context Routing + Prompt Caching (Anthropic only)

import { createAnthropic } from '@ai-sdk/anthropic';
import { createGroq } from '@ai-sdk/groq';
import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { generateText, streamText } from 'ai';
import { classifyIntent, extractDateRange } from '@/lib/ai/intent-classifier';
import { buildDataContext } from '@/lib/ai/context-builder';
import { buildStaticSystemPrompt, buildDataPrompt } from '@/lib/ai/system-prompt';
import { getAdminDb } from '@/lib/firebase-admin';

// ── Model registry ──────────────────────────────────────────
interface ModelOption {
    id: string;         // Key gửi từ client
    label: string;      // Tên hiển thị
    provider: 'anthropic' | 'groq' | 'google';
    modelId: string;    // Model ID thực tế của provider
    description: string;
}

const MODEL_OPTIONS: ModelOption[] = [
    {
        id: 'claude-sonnet',
        label: 'Claude Sonnet',
        provider: 'anthropic',
        modelId: 'claude-sonnet-4-6',
        description: 'Phân tích sâu, chính xác nhất',
    },
    {
        id: 'llama-70b',
        label: 'Llama 3.3 70B',
        provider: 'groq',
        modelId: 'llama-3.3-70b-versatile',
        description: 'Nhanh, đa năng, miễn phí',
    },
    {
        id: 'llama-scout',
        label: 'Llama 4 Scout',
        provider: 'groq',
        modelId: 'meta-llama/llama-4-scout-17b-16e-instruct',
        description: 'Nhanh, nhẹ, tiết kiệm',
    },
    {
        id: 'compound-beta',
        label: 'Compound Beta',
        provider: 'groq',
        modelId: 'compound-beta',
        description: 'Đa model kết hợp, thông minh',
    },
    {
        id: 'llama-8b',
        label: 'Llama 3.1 8B',
        provider: 'groq',
        modelId: 'llama-3.1-8b-instant',
        description: 'Siêu nhanh, nhẹ nhất',
    },
    {
        id: 'gemini-flash',
        label: 'Gemini 2.0 Flash',
        provider: 'google',
        modelId: 'gemini-2.0-flash',
        description: 'Google AI, context 1M tokens',
    },
];

const DEFAULT_MODEL_ID = 'llama-70b';

// ── Providers ───────────────────────────────────────────────
// Anthropic qua gateway gwai.cloud (yêu cầu User-Agent đặc biệt)
const anthropic = createAnthropic({
    baseURL: 'https://1gw.gwai.cloud/v1',
    apiKey: process.env.ANTHROPIC_API_KEY,
    headers: {
        'User-Agent': 'curl/8.7.1',
    },
});

// Groq — trực tiếp, không cần gateway
const groq = createGroq({
    apiKey: process.env.GROQ_API_KEY,
});

// Google Gemini — trực tiếp
const google = createGoogleGenerativeAI({
    apiKey: process.env.GOOGLE_GENERATIVE_AI_API_KEY,
});

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

/** Lấy ngày hôm nay (VN timezone) */
function getTodayVN(): string {
    return new Date(Date.now() + 7 * 3600000).toISOString().split('T')[0];
}

/** Resolve model từ client ID */
function resolveModel(clientModelId?: string) {
    const opt = MODEL_OPTIONS.find(m => m.id === clientModelId) ??
                MODEL_OPTIONS.find(m => m.id === DEFAULT_MODEL_ID)!;

    if (opt.provider === 'anthropic') {
        return { model: anthropic(opt.modelId), option: opt };
    }
    if (opt.provider === 'google') {
        return { model: google(opt.modelId), option: opt };
    }
    return { model: groq(opt.modelId), option: opt };
}

/** Kiểm tra API key theo provider (có TTL cache) */
const validationCache = new Map<string, { ok: boolean; error?: string; at: number }>();
const VALIDATION_TTL_MS = 5 * 60 * 1000;

async function validateProvider(provider: 'anthropic' | 'groq' | 'google'): Promise<{ ok: boolean; error?: string }> {
    const cached = validationCache.get(provider);
    if (cached) {
        const age = Date.now() - cached.at;
        if (cached.ok || age < VALIDATION_TTL_MS) return { ok: cached.ok, error: cached.error };
    }

    const key = provider === 'anthropic'
        ? process.env.ANTHROPIC_API_KEY
        : provider === 'google'
            ? process.env.GOOGLE_GENERATIVE_AI_API_KEY
            : process.env.GROQ_API_KEY;
    const envName = provider === 'anthropic'
        ? 'ANTHROPIC_API_KEY'
        : provider === 'google'
            ? 'GOOGLE_GENERATIVE_AI_API_KEY'
            : 'GROQ_API_KEY';
    if (!key) {
        const error = `${envName} chưa được cấu hình.`;
        validationCache.set(provider, { ok: false, error, at: Date.now() });
        return { ok: false, error };
    }

    try {
        const testModelId = provider === 'anthropic' ? 'claude-sonnet' : provider === 'google' ? 'gemini-flash' : 'llama-70b';
        const { model } = resolveModel(testModelId);
        await generateText({ model, prompt: 'Hi', maxTokens: 1 });
        validationCache.set(provider, { ok: true, at: Date.now() });
        console.log(`[AI Chat] ✅ ${provider} validated`);
        return { ok: true };
    } catch (err) {
        const error = err instanceof Error ? err.message : String(err);
        console.error(`[AI Chat] ❌ ${provider} validation failed:`, error);
        validationCache.set(provider, { ok: false, error, at: Date.now() });
        return { ok: false, error };
    }
}

export async function POST(req: Request) {
    try {
        const body = await req.json();
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const rawMessages: any[] = Array.isArray(body?.messages) ? body.messages : [];
        const clientModelId: string = body?.modelId || DEFAULT_MODEL_ID;

        // ── Resolve model ──────────────────────────────────────
        const { model, option: modelOption } = resolveModel(clientModelId);

        // ── Pre-flight: Validate provider ──────────────────────
        const validation = await validateProvider(modelOption.provider);
        if (!validation.ok) {
            console.error(`[AI Chat] ${modelOption.provider} validation failed:`, validation.error);
            return Response.json(
                { error: `API Key / Gateway lỗi (${modelOption.label}): ${validation.error}` },
                { status: 401 }
            );
        }

        // ── Phase 1: Intent Classification (0 token cost) ──────
        const lastUserMsg = [...rawMessages].reverse().find(m => m.role === 'user');
        const userText = typeof lastUserMsg?.content === 'string' ? lastUserMsg.content : '';
        const intents = classifyIntent(userText);
        console.log(`[AI Chat] Model: ${modelOption.label} | Intents:`, intents, '| Q:', userText.slice(0, 80));

        // ── Phase 1.5: Date Extraction ─────────────────────────
        const today = getTodayVN();
        const dateRange = extractDateRange(userText);
        const startDate = dateRange?.start ?? today;
        const endDate = dateRange?.end ?? today;

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
        } catch (fetchErr) {
            console.error('[AI Chat] Data fetch error:', fetchErr);
            context = '⚠️ Không thể tải dữ liệu. Hãy trả lời dựa trên kiến thức chung.';
        }

        // ── Phase 3: Build messages ────────────────────────────
        const staticPrompt = buildStaticSystemPrompt();
        const dataPrompt = buildDataPrompt(context, today, sources, fetchedRange);

        // Anthropic supports prompt caching; Groq does not
        const isAnthropic = modelOption.provider === 'anthropic';

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const messages: any[] = [
            {
                role: 'user',
                content: isAnthropic
                    ? [
                        {
                            type: 'text',
                            text: staticPrompt,
                            experimental_providerMetadata: {
                                anthropic: { cacheControl: { type: 'ephemeral' } },
                            },
                        },
                        { type: 'text', text: dataPrompt },
                    ]
                    : `${staticPrompt}\n\n${dataPrompt}`,
            },
            {
                role: 'assistant',
                content: 'Đã nhận dữ liệu. Tôi sẵn sàng phân tích. Hãy đặt câu hỏi.',
            },
            ...rawMessages,
        ];

        // ── Phase 4: Stream response ───────────────────────────
        const result = streamText({
            model,
            messages,
            maxTokens: 2048,
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            onFinish: async ({ usage }: any) => {
                try {
                    const db = getAdminDb();
                    await db.collection('ai_usage_logs').add({
                        timestamp: new Date().toISOString(),
                        model: modelOption.modelId,
                        modelLabel: modelOption.label,
                        provider: modelOption.provider,
                        gateway: isAnthropic ? '1gw.gwai.cloud' : 'api.groq.com',
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
                'X-AI-Model': modelOption.id,
                'X-AI-Provider': modelOption.provider,
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
