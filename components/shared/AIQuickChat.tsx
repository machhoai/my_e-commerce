'use client';

/**
 * AIQuickChat.tsx
 * ─────────────────────────────────────────────────────────────
 * AI Chat BottomSheet — Mở từ FAB lơ lửng khi user có quyền AI.
 * Hỗ trợ chọn model, token tracking, và rich HTML mode.
 */

import React, { useRef, useEffect, useCallback, useState } from 'react';
import { useChat } from 'ai/react';
import type { Message } from 'ai';
import { Send, X, Bot, Sparkles, Loader2, ChevronDown, AlertTriangle, Code2, BarChart3 } from 'lucide-react';
import RichHtmlRenderer, { isHtmlContent } from '@/components/shared/RichHtmlRenderer';

// ── Model options (phải khớp với MODEL_OPTIONS trong route.ts) ───
const MODELS = [
    { id: 'llama-70b', label: 'Llama 3.3 70B', icon: '🦙', desc: 'Nhanh, đa năng', badge: '⭐ Đề xuất' as string | null },
    { id: 'gemini-flash', label: 'Gemini 2.0 Flash', icon: '✨', desc: 'Google AI, 1M context', badge: null },
    { id: 'llama-scout', label: 'Llama 4 Scout', icon: '🔍', desc: 'Nhẹ, tiết kiệm', badge: null },
    { id: 'compound-beta', label: 'Compound Beta', icon: '🧬', desc: 'Đa model kết hợp', badge: null },
    { id: 'llama-8b', label: 'Llama 3.1 8B', icon: '⚡', desc: 'Siêu nhanh', badge: null },
    { id: 'claude-sonnet', label: 'Claude Sonnet', icon: '🟣', desc: 'Phân tích sâu, chính xác', badge: '💎 Premium' },
];

// ── Markdown renderer ────────────────────────────────────────
function SimpleMarkdown({ text }: { text: string }) {
    const lines = text.split('\n');
    return (
        <div className="space-y-1">
            {lines.map((line, i) => {
                if (line.match(/^[-•*]\s/)) {
                    const content = line.replace(/^[-•*]\s/, '');
                    return (
                        <div key={i} className="flex items-start gap-1.5">
                            <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-current shrink-0 opacity-60" />
                            <span dangerouslySetInnerHTML={{ __html: formatInline(content) }} />
                        </div>
                    );
                }
                const numMatch = line.match(/^(\d+)\.\s(.*)/);
                if (numMatch) return (
                    <div key={i} className="flex items-start gap-1.5">
                        <span className="shrink-0 text-xs font-bold opacity-60 mt-0.5">{numMatch[1]}.</span>
                        <span dangerouslySetInnerHTML={{ __html: formatInline(numMatch[2]) }} />
                    </div>
                );
                if (line.startsWith('## ')) return (
                    <p key={i} className="font-bold text-sm mt-2" dangerouslySetInnerHTML={{ __html: formatInline(line.slice(3)) }} />
                );
                if (line.startsWith('# ')) return (
                    <p key={i} className="font-bold" dangerouslySetInnerHTML={{ __html: formatInline(line.slice(2)) }} />
                );
                if (!line.trim()) return <div key={i} className="h-1" />;
                return <p key={i} dangerouslySetInnerHTML={{ __html: formatInline(line) }} />;
            })}
        </div>
    );
}

function formatInline(text: string): string {
    return text
        .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
        .replace(/\*(.+?)\*/g, '<em>$1</em>')
        .replace(/`(.+?)`/g, '<code class="bg-black/10 px-1 rounded text-xs font-mono">$1</code>');
}

// ── Typing Indicator ─────────────────────────────────────────
function TypingDots() {
    return (
        <div className="flex items-center gap-1 px-1 py-0.5">
            {[0, 1, 2].map(i => (
                <span
                    key={i}
                    className="w-1.5 h-1.5 rounded-full bg-violet-400 animate-bounce"
                    style={{ animationDelay: `${i * 150}ms` }}
                />
            ))}
        </div>
    );
}

// ── Token Usage Badge ────────────────────────────────────────
function TokenBadge({ usage }: { usage: { input: number; output: number } }) {
    return (
        <div className="flex items-center gap-1.5 mt-1 text-[10px] text-surface-400 font-mono">
            <span title="Input tokens">↑{usage.input}</span>
            <span className="opacity-40">·</span>
            <span title="Output tokens">↓{usage.output}</span>
            <span className="opacity-40">·</span>
            <span title="Total tokens">Σ{usage.input + usage.output}</span>
        </div>
    );
}

// ── Quick Prompts ────────────────────────────────────────────
const QUICK_PROMPTS = [
    'Doanh thu hôm nay?',
    'Phân tích doanh thu tháng này',
    'Vé nào bán chạy nhất?',
    'Tình hình nhân sự tuần này?',
    'Tổng quan kho hàng?',
];

// ── Props ────────────────────────────────────────────────────
interface AIQuickChatProps {
    isOpen: boolean;
    onClose: () => void;
}

export default function AIQuickChat({ isOpen, onClose }: AIQuickChatProps) {
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLInputElement>(null);
    const sheetRef = useRef<HTMLDivElement>(null);
    const [hasInteracted, setHasInteracted] = useState(false);
    const [selectedModel, setSelectedModel] = useState(MODELS[0]);
    const [showModelPicker, setShowModelPicker] = useState(false);
    const [costWarning, setCostWarning] = useState<string | null>(null);
    const [richMode, setRichMode] = useState(false);
    const [showUsage, setShowUsage] = useState(false);
    const [tokenMap, setTokenMap] = useState<Record<string, { input: number; output: number }>>({});
    const [totalUsage, setTotalUsage] = useState({ input: 0, output: 0, requests: 0 });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const handleFinish = useCallback((message: Message, options: any) => {
        const u = options?.usage;
        if (u) {
            const inp = u.promptTokens ?? u.inputTokens ?? 0;
            const out = u.completionTokens ?? u.outputTokens ?? 0;
            setTokenMap(prev => ({ ...prev, [message.id]: { input: inp, output: out } }));
            setTotalUsage(prev => ({
                input: prev.input + inp,
                output: prev.output + out,
                requests: prev.requests + 1,
            }));
        }
    }, []);

    const {
        messages,
        input,
        handleInputChange,
        handleSubmit: rawSubmit,
        isLoading,
        error,
        setInput,
    } = useChat({
        api: '/api/chat',
        body: { modelId: selectedModel.id, richMode },
        onFinish: handleFinish,
        onResponse: (response) => {
            const warning = response.headers.get('X-AI-Cost-Warning');
            if (warning) setCostWarning(decodeURIComponent(warning));
            else setCostWarning(null);
        },
        onError: (err) => {
            console.error('[AI Quick Chat] Error:', err);
        },
        initialMessages: [
            {
                id: 'welcome',
                role: 'assistant',
                content: `Xin chào! Tôi là Trợ lý AI 👋\n\nTôi có thể giúp bạn:\n• 💰 Doanh thu & thanh toán\n• 🛍️ Hàng hóa & vé\n• 👥 Thành viên\n• 👔 Nhân sự & chấm công\n• 📦 Kho hàng\n\nHãy đặt câu hỏi nhé!`,
            } as Message,
        ],
    });

    // Wrap submit
    const handleSubmit = useCallback((e: React.FormEvent) => {
        setHasInteracted(true);
        setShowModelPicker(false);
        rawSubmit(e);
    }, [rawSubmit]);

    // Auto scroll
    useEffect(() => {
        if (isOpen) {
            messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
        }
    }, [messages, isLoading, isOpen]);

    // Focus input when opens
    useEffect(() => {
        if (isOpen) {
            setTimeout(() => inputRef.current?.focus(), 300);
        }
    }, [isOpen]);

    // Lock body scroll when open
    useEffect(() => {
        if (isOpen) {
            const prev = document.body.style.overflow;
            document.body.style.overflow = 'hidden';
            return () => { document.body.style.overflow = prev; };
        }
    }, [isOpen]);

    // Esc to close
    useEffect(() => {
        if (!isOpen) return;
        const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
        window.addEventListener('keydown', handler);
        return () => window.removeEventListener('keydown', handler);
    }, [isOpen, onClose]);

    const handleQuickPrompt = useCallback((prompt: string) => {
        setInput(prompt);
        setHasInteracted(true);
        setTimeout(() => inputRef.current?.focus(), 50);
    }, [setInput]);

    if (typeof window === 'undefined') return null;
    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex flex-col justify-end pointer-events-auto" aria-modal="true" role="dialog">
            {/* Backdrop */}
            <div
                onClick={onClose}
                className="absolute inset-0 bg-black/40 backdrop-blur-[2px] animate-in fade-in duration-200"
            />

            {/* ── Chat Sheet — full flex column, no double scroll ── */}
            <div
                ref={sheetRef}
                className={`relative w-full bg-white rounded-t-3xl shadow-2xl flex flex-col animate-in slide-in-from-bottom duration-300 ${richMode ? 'max-h-[95vh]' : 'max-h-[88vh]'}`}
            >
                {/* Drag handle */}
                <div className="flex justify-center pt-2.5 pb-1 shrink-0">
                    <div className="w-10 h-1 rounded-full bg-surface-300" />
                </div>

                {/* ── Header ── */}
                <div className="flex items-center justify-between px-4 py-2 border-b border-surface-100 shrink-0">
                    <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center">
                            <Sparkles className="w-4 h-4 text-white" />
                        </div>
                        <div>
                            <h2 className="text-sm font-bold text-surface-800">Trợ lý AI</h2>
                            <p className="text-[10px] text-surface-400">
                                {isLoading ? (
                                    <span className="flex items-center gap-1">
                                        <Loader2 className="w-3 h-3 animate-spin" /> Đang phân tích...
                                    </span>
                                ) : `${selectedModel.icon} ${selectedModel.label}`}
                            </p>
                        </div>
                    </div>
                    <div className="flex items-center gap-1">
                        <button
                            onClick={() => setRichMode(v => !v)}
                            className={`p-1.5 rounded-lg transition-colors ${richMode ? 'bg-violet-100 text-violet-600' : 'bg-surface-100 text-surface-400'}`}
                            title={richMode ? 'Tắt HTML' : 'Bật HTML trực quan'}
                        >
                            <Code2 className="w-4 h-4" />
                        </button>
                        <button
                            onClick={() => setShowUsage(v => !v)}
                            className={`p-1.5 rounded-lg transition-colors ${showUsage ? 'bg-violet-100 text-violet-600' : 'bg-surface-100 text-surface-400'}`}
                            title="Thống kê Token"
                        >
                            <BarChart3 className="w-4 h-4" />
                        </button>
                        <button
                            onClick={onClose}
                            className="p-1.5 rounded-lg bg-surface-100 text-surface-500 hover:bg-surface-200 transition-colors"
                        >
                            <X className="w-4 h-4" />
                        </button>
                    </div>
                </div>

                {/* ── Token Usage Panel ── */}
                {showUsage && (
                    <div className="bg-surface-50 border-b border-surface-100 px-4 py-2 text-[11px] font-mono space-y-0.5 shrink-0">
                        <div className="flex justify-between text-surface-600">
                            <span>Phiên này:</span>
                            <span className="font-semibold">{totalUsage.requests} câu hỏi</span>
                        </div>
                        <div className="flex justify-between text-surface-500">
                            <span>↑ Input tokens:</span>
                            <span>{totalUsage.input.toLocaleString()}</span>
                        </div>
                        <div className="flex justify-between text-surface-500">
                            <span>↓ Output tokens:</span>
                            <span>{totalUsage.output.toLocaleString()}</span>
                        </div>
                        <div className="flex justify-between text-violet-600 font-semibold">
                            <span>Σ Tổng tokens:</span>
                            <span>{(totalUsage.input + totalUsage.output).toLocaleString()}</span>
                        </div>
                        <div className="flex justify-between text-amber-600">
                            <span>≈ Chi phí:</span>
                            <span>${((totalUsage.input / 1_000_000) * 3 + (totalUsage.output / 1_000_000) * 15).toFixed(5)}</span>
                        </div>
                    </div>
                )}

                {/* ── Cost Warning ── */}
                {costWarning && (
                    <div className="mx-4 mt-2 flex items-center gap-2 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2 text-[11px] text-amber-700 shrink-0">
                        <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                        <span className="flex-1">{costWarning}</span>
                        <button onClick={() => setCostWarning(null)} className="text-amber-400 hover:text-amber-600 transition-colors">
                            <X className="w-3 h-3" />
                        </button>
                    </div>
                )}

                {/* ── Messages (single scroll zone) ── */}
                <div className="flex-1 overflow-y-auto overscroll-contain px-4 py-3 space-y-3 min-h-0">
                    {messages.map((msg: Message) => (
                        <div
                            key={msg.id}
                            className={`flex gap-2 ${msg.role === 'user' ? 'flex-row-reverse' : 'flex-row'}`}
                        >
                            {msg.role === 'assistant' && (
                                <div className="w-7 h-7 rounded-xl bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center shrink-0 mt-0.5">
                                    <Bot className="w-3.5 h-3.5 text-white" />
                                </div>
                            )}
                            <div className={`text-sm leading-relaxed ${msg.role === 'user'
                                ? 'max-w-[82%] bg-gradient-to-br from-violet-500 to-purple-600 text-white rounded-2xl rounded-tr-sm px-3.5 py-2.5'
                                : msg.role === 'assistant' && isHtmlContent(msg.content)
                                    ? 'w-full rounded-2xl rounded-tl-sm overflow-hidden'
                                    : 'max-w-[82%] bg-surface-100 text-surface-800 rounded-2xl rounded-tl-sm px-3.5 py-2.5'
                                }`}>
                                {msg.role === 'assistant'
                                    ? isHtmlContent(msg.content)
                                        ? <RichHtmlRenderer html={msg.content} />
                                        : <SimpleMarkdown text={msg.content} />
                                    : <p>{msg.content}</p>
                                }
                                {msg.role === 'assistant' && tokenMap[msg.id] && (
                                    <TokenBadge usage={tokenMap[msg.id]} />
                                )}
                            </div>
                        </div>
                    ))}

                    {/* Typing */}
                    {isLoading && (
                        <div className="flex gap-2">
                            <div className="w-7 h-7 rounded-xl bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center shrink-0">
                                <Bot className="w-3.5 h-3.5 text-white" />
                            </div>
                            <div className="bg-surface-100 rounded-2xl rounded-tl-sm px-3.5 py-2.5">
                                <TypingDots />
                            </div>
                        </div>
                    )}

                    {/* Error */}
                    {error && (
                        <div className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-xl px-3 py-2 space-y-1">
                            <p className="font-semibold">⚠️ Lỗi kết nối</p>
                            <p className="opacity-80 font-mono break-all">{error.message || String(error)}</p>
                        </div>
                    )}

                    <div ref={messagesEndRef} />
                </div>

                {/* ── Quick prompts — only when fresh ── */}
                {messages.length <= 1 && !hasInteracted && (
                    <div className="px-4 pb-2 flex flex-wrap gap-1.5 shrink-0">
                        {QUICK_PROMPTS.map(p => (
                            <button
                                key={p}
                                onClick={() => handleQuickPrompt(p)}
                                disabled={isLoading}
                                className="text-[11px] bg-violet-50 text-violet-700 border border-violet-200 px-2.5 py-1 rounded-full hover:bg-violet-100 disabled:opacity-40 transition-colors"
                            >
                                {p}
                            </button>
                        ))}
                    </div>
                )}

                {/* ── Model Picker ── */}
                {showModelPicker && (
                    <div className="px-4 pb-2 bottom-16 shrink-0 absolute">
                        <div className="bg-white border border-surface-200 rounded-2xl shadow-lg p-1.5 space-y-0.5">
                            {MODELS.map(m => (
                                <button
                                    key={m.id}
                                    onClick={() => {
                                        setSelectedModel(m);
                                        setShowModelPicker(false);
                                    }}
                                    className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-left transition-colors ${selectedModel.id === m.id
                                        ? 'bg-violet-50 border border-violet-200'
                                        : 'hover:bg-surface-50'
                                        }`}
                                >
                                    <span className="text-base">{m.icon}</span>
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-1.5">
                                            <p className="text-[12px] font-bold text-surface-800">{m.label}</p>
                                            {m.badge && (
                                                <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full ${m.badge.includes('Premium')
                                                    ? 'bg-violet-50 text-violet-600 border border-violet-200'
                                                    : 'bg-amber-50 text-amber-700 border border-amber-200'
                                                    }`}>
                                                    {m.badge}
                                                </span>
                                            )}
                                        </div>
                                        <p className="text-[10px] text-surface-400">{m.desc}</p>
                                    </div>
                                    {selectedModel.id === m.id && (
                                        <span className="text-violet-600 text-[10px] font-bold">✓</span>
                                    )}
                                </button>
                            ))}
                        </div>
                    </div>
                )}

                {/* ── Input bar — always pinned at bottom ── */}
                <form
                    onSubmit={handleSubmit}
                    className="flex items-center gap-2 px-4 py-3 border-t border-surface-100 shrink-0 bg-white"
                    style={{ paddingBottom: 'max(12px, env(safe-area-inset-bottom))' }}
                >
                    {/* Model selector toggle */}
                    <button
                        type="button"
                        onClick={() => setShowModelPicker(v => !v)}
                        className={`flex items-center gap-1 text-[11px] font-bold px-2 py-2 rounded-xl border transition-colors shrink-0 ${showModelPicker
                            ? 'bg-violet-50 border-violet-300 text-violet-700'
                            : 'bg-surface-100 border-surface-200 text-surface-500 hover:bg-surface-50'
                            }`}
                        title="Chọn model AI"
                    >
                        <span>{selectedModel.icon}</span>
                        <ChevronDown className={`w-3 h-3 transition-transform ${showModelPicker ? 'rotate-180' : ''}`} />
                    </button>

                    <input
                        ref={inputRef}
                        value={input}
                        onChange={handleInputChange}
                        placeholder="Hỏi về doanh thu, thành viên..."
                        disabled={isLoading}
                        className="flex-1 bg-surface-100 text-surface-800 text-sm rounded-xl px-3.5 py-2.5 outline-none placeholder-surface-400 disabled:opacity-60 focus:ring-2 focus:ring-violet-500/40 transition-all"
                    />
                    <button
                        type="submit"
                        disabled={isLoading || !input.trim()}
                        className="w-9 h-9 rounded-xl bg-gradient-to-br from-violet-500 to-purple-600 text-white flex items-center justify-center shadow-md shadow-violet-500/25 hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed transition-all shrink-0"
                    >
                        {isLoading
                            ? <Loader2 className="w-4 h-4 animate-spin" />
                            : <Send className="w-4 h-4" />
                        }
                    </button>
                </form>
            </div>
        </div>
    );
}
