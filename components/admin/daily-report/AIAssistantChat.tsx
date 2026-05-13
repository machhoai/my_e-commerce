'use client';

/**
 * AIAssistantChat.tsx
 * ─────────────────────────────────────────────────────────────
 * Floating AI chat panel cho Daily Report.
 * Dùng useChat từ ai/react (SDK v4).
 */

import React, { useRef, useEffect, useState, useCallback } from 'react';
import { useChat } from 'ai/react';
import type { Message } from 'ai';
import { Send, X, Bot, ChevronDown, Sparkles, Loader2, BarChart3 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

// ─────────────────────────────────────────────────────────────
// Markdown renderer (basic: bold, italic, list, heading)
// ─────────────────────────────────────────────────────────────
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

// ─────────────────────────────────────────────────────────────
// Typing Indicator
// ─────────────────────────────────────────────────────────────
function TypingIndicator() {
    return (
        <div className="flex items-center gap-1.5 px-1 py-0.5">
            {[0, 1, 2].map(i => (
                <motion.div
                    key={i}
                    className="w-1.5 h-1.5 rounded-full bg-slate-400"
                    animate={{ y: [0, -4, 0] }}
                    transition={{ duration: 0.6, repeat: Infinity, delay: i * 0.15 }}
                />
            ))}
        </div>
    );
}

// ─────────────────────────────────────────────────────────────
// Quick Prompts
// ─────────────────────────────────────────────────────────────
const QUICK_PROMPTS = [
    'Doanh thu hôm nay là bao nhiêu?',
    'Loại vé nào bán chạy nhất hôm nay?',
    'Tình hình nhân sự hôm nay?',
    'Tổng quan kho hàng?',
    'Số thành viên mới hôm nay?',
];

// ─────────────────────────────────────────────────────────────
// Token Usage Badge (hiển thị dưới mỗi câu trả lời AI)
// ─────────────────────────────────────────────────────────────
function TokenBadge({ usage }: { usage: { input: number; output: number } }) {
    return (
        <div className="flex items-center gap-1.5 mt-1 text-[10px] text-slate-400 dark:text-slate-500 font-mono">
            <span title="Input tokens">↑{usage.input}</span>
            <span className="opacity-40">·</span>
            <span title="Output tokens">↓{usage.output}</span>
            <span className="opacity-40">·</span>
            <span title="Total tokens">Σ{usage.input + usage.output}</span>
        </div>
    );
}

// ─────────────────────────────────────────────────────────────
// Props
// ─────────────────────────────────────────────────────────────
interface AIAssistantChatProps {
    currentDate?: string;
}

// ─────────────────────────────────────────────────────────────
// Main Component
// ─────────────────────────────────────────────────────────────
export default function AIAssistantChat({ currentDate }: AIAssistantChatProps) {
    const [isOpen, setIsOpen] = useState(false);
    const [isMinimized, setIsMinimized] = useState(false);
    const [showUsage, setShowUsage] = useState(false);
    const [tokenMap, setTokenMap] = useState<Record<string, { input: number; output: number }>>({}); // msgId → usage
    const [totalUsage, setTotalUsage] = useState({ input: 0, output: 0, requests: 0 });
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLInputElement>(null);

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
        handleSubmit,
        isLoading,
        error,
        setInput,
    } = useChat({
        api: '/api/chat',
        onFinish: handleFinish,
        onError: (err) => {
            console.error('[AI Chat] useChat error:', err);
        },
        initialMessages: [
            {
                id: 'welcome',
                role: 'assistant',
                content: `Xin chào! Tôi là Trợ lý AI Joy World 👋\n\nBạn đang xem báo cáo ngày **${currentDate ?? 'hôm nay'}**. Tôi có thể phân tích:\n• 💰 Doanh thu & thanh toán\n• 🛍️ Hàng hóa & vé\n• 👥 Thành viên\n• 👔 Nhân sự & chấm công\n• 📦 Kho hàng & tồn kho\n• 🎫 Voucher\n\nHãy đặt câu hỏi nhé!`,
            } as Message,
        ],
    });

    // Auto scroll to latest message
    useEffect(() => {
        if (isOpen && !isMinimized) {
            messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
        }
    }, [messages, isLoading, isOpen, isMinimized]);

    // Focus input when panel opens
    useEffect(() => {
        if (isOpen && !isMinimized) {
            setTimeout(() => inputRef.current?.focus(), 150);
        }
    }, [isOpen, isMinimized]);

    const handleQuickPrompt = (prompt: string) => {
        setInput(prompt);
        setTimeout(() => inputRef.current?.focus(), 50);
    };

    return (
        <>
            {/* ── Floating Toggle Button ── */}
            <AnimatePresence>
                {!isOpen && (
                    <motion.button
                        initial={{ scale: 0, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        exit={{ scale: 0, opacity: 0 }}
                        whileHover={{ scale: 1.1 }}
                        whileTap={{ scale: 0.95 }}
                        onClick={() => setIsOpen(true)}
                        className="fixed bottom-7 right-4 z-50 w-14 h-14 rounded-2xl bg-gradient-to-br from-violet-500 to-purple-600 text-white shadow-xl shadow-violet-500/30 flex items-center justify-center"
                        title="Mở Trợ lý AI"
                    >
                        <Sparkles className="w-6 h-6" />
                    </motion.button>
                )}
            </AnimatePresence>

            {/* ── Chat Panel ── */}
            <AnimatePresence>
                {isOpen && (
                    <motion.div
                        initial={{ opacity: 0, scale: 0.9, y: 24 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.9, y: 24 }}
                        transition={{ type: 'spring', stiffness: 380, damping: 28 }}
                        className="fixed bottom-6 right-6 z-50 flex flex-col rounded-2xl bg-white dark:bg-slate-900 shadow-2xl border border-slate-200 dark:border-slate-700 overflow-hidden w-[380px] max-w-[calc(100vw-2rem)]"
                        style={{ height: isMinimized ? 'auto' : 540 }}
                    >
                        {/* ── Header ── */}
                        <div className="flex items-center gap-2.5 px-4 py-3 bg-gradient-to-r from-violet-600 to-purple-600 text-white shrink-0 relative">
                            <div className="w-8 h-8 rounded-xl bg-white/20 flex items-center justify-center">
                                <Bot className="w-4 h-4" />
                            </div>
                            <div className="flex-1 min-w-0">
                                <p className="font-semibold text-sm leading-tight">Trợ lý AI Joy World</p>
                                <p className="text-[11px] text-white/70 leading-tight flex items-center gap-1">
                                    {isLoading ? (
                                        <><Loader2 className="w-3 h-3 animate-spin" /> Đang phân tích...</>
                                    ) : (
                                        'Claude Sonnet 4 · Smart Routing'
                                    )}
                                </p>
                            </div>
                            <div className="flex items-center gap-1">
                                <button
                                    onClick={() => setShowUsage(v => !v)}
                                    className={`w-7 h-7 rounded-lg flex items-center justify-center transition-colors ${showUsage ? 'bg-white/30' : 'bg-white/15 hover:bg-white/25'}`}
                                    title="Token Usage"
                                >
                                    <BarChart3 className="w-3.5 h-3.5" />
                                </button>
                                <button
                                    onClick={() => setIsMinimized(v => !v)}
                                    className="w-7 h-7 rounded-lg bg-white/15 hover:bg-white/25 flex items-center justify-center transition-colors"
                                    title={isMinimized ? 'Mở rộng' : 'Thu gọn'}
                                >
                                    <motion.div animate={{ rotate: isMinimized ? 180 : 0 }} transition={{ duration: 0.25 }}>
                                        <ChevronDown className="w-4 h-4" />
                                    </motion.div>
                                </button>
                                <button
                                    onClick={() => setIsOpen(false)}
                                    className="w-7 h-7 rounded-lg bg-white/15 hover:bg-white/25 flex items-center justify-center transition-colors"
                                    title="Đóng"
                                >
                                    <X className="w-4 h-4" />
                                </button>
                            </div>
                        </div>

                        {/* ── Body (collapsible) ── */}
                        <AnimatePresence initial={false}>
                            {!isMinimized && (
                                <motion.div
                                    key="body"
                                    initial={{ height: 0 }}
                                    animate={{ height: 'auto', flex: 1 }}
                                    exit={{ height: 0 }}
                                    transition={{ duration: 0.2 }}
                                    className="flex flex-col overflow-hidden"
                                    style={{ flex: 1 }}
                                >
                                    {/* Token Usage Panel */}
                                    <AnimatePresence>
                                        {showUsage && (
                                            <motion.div
                                                initial={{ height: 0, opacity: 0 }}
                                                animate={{ height: 'auto', opacity: 1 }}
                                                exit={{ height: 0, opacity: 0 }}
                                                className="bg-slate-50 dark:bg-slate-800/50 border-b border-slate-200 dark:border-slate-700 px-3 py-2 text-[11px] font-mono space-y-1 overflow-hidden"
                                            >
                                                <div className="flex justify-between text-slate-600 dark:text-slate-300">
                                                    <span>Phiên này:</span>
                                                    <span className="font-semibold">{totalUsage.requests} câu hỏi</span>
                                                </div>
                                                <div className="flex justify-between text-slate-500 dark:text-slate-400">
                                                    <span>↑ Input tokens:</span>
                                                    <span>{totalUsage.input.toLocaleString()}</span>
                                                </div>
                                                <div className="flex justify-between text-slate-500 dark:text-slate-400">
                                                    <span>↓ Output tokens:</span>
                                                    <span>{totalUsage.output.toLocaleString()}</span>
                                                </div>
                                                <div className="flex justify-between text-violet-600 dark:text-violet-400 font-semibold">
                                                    <span>Σ Tổng tokens:</span>
                                                    <span>{(totalUsage.input + totalUsage.output).toLocaleString()}</span>
                                                </div>
                                                <div className="flex justify-between text-amber-600 dark:text-amber-400">
                                                    <span>≈ Chi phí:</span>
                                                    <span>${((totalUsage.input / 1_000_000) * 3 + (totalUsage.output / 1_000_000) * 15).toFixed(5)}</span>
                                                </div>
                                            </motion.div>
                                        )}
                                    </AnimatePresence>
                                    {/* Messages list */}
                                    <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
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
                                                <div className={`max-w-[82%] text-sm leading-relaxed ${msg.role === 'user'
                                                    ? 'bg-gradient-to-br from-violet-500 to-purple-600 text-white rounded-2xl rounded-tr-sm px-3.5 py-2.5'
                                                    : 'bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200 rounded-2xl rounded-tl-sm px-3.5 py-2.5'
                                                    }`}>
                                                    {msg.role === 'assistant'
                                                        ? <SimpleMarkdown text={msg.content} />
                                                        : <p>{msg.content}</p>
                                                    }
                                                    {msg.role === 'assistant' && tokenMap[msg.id] && (
                                                        <TokenBadge usage={tokenMap[msg.id]} />
                                                    )}
                                                </div>
                                            </div>
                                        ))}

                                        {/* Typing indicator */}
                                        {isLoading && (
                                            <div className="flex gap-2">
                                                <div className="w-7 h-7 rounded-xl bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center shrink-0">
                                                    <Bot className="w-3.5 h-3.5 text-white" />
                                                </div>
                                                <div className="bg-slate-100 dark:bg-slate-800 rounded-2xl rounded-tl-sm px-3.5 py-2.5">
                                                    <TypingIndicator />
                                                </div>
                                            </div>
                                        )}

                                        {/* Error */}
                                        {error && (
                                            <div className="text-xs text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl px-3 py-2 space-y-1">
                                                <p className="font-semibold">⚠️ Lỗi kết nối API</p>
                                                <p className="opacity-80 font-mono break-all">{error.message || String(error)}</p>
                                                <p className="opacity-60">Xem Console (F12) để biết chi tiết.</p>
                                            </div>
                                        )}
                                        <div ref={messagesEndRef} />
                                    </div>

                                    {/* Quick prompts — only when conversation is fresh */}
                                    {messages.length <= 1 && (
                                        <div className="px-4 pb-2 flex flex-wrap gap-1.5">
                                            {QUICK_PROMPTS.map(p => (
                                                <button
                                                    key={p}
                                                    onClick={() => handleQuickPrompt(p)}
                                                    disabled={isLoading}
                                                    className="text-[11px] bg-violet-50 dark:bg-violet-900/20 text-violet-700 dark:text-violet-400 border border-violet-200 dark:border-violet-800/50 px-2.5 py-1 rounded-full hover:bg-violet-100 dark:hover:bg-violet-900/40 disabled:opacity-40 transition-colors text-left"
                                                >
                                                    {p}
                                                </button>
                                            ))}
                                        </div>
                                    )}

                                    {/* Input bar */}
                                    <form
                                        onSubmit={handleSubmit}
                                        className="flex items-center gap-2 px-3 py-3 border-t border-slate-100 dark:border-slate-800 shrink-0"
                                    >
                                        <input
                                            ref={inputRef}
                                            value={input}
                                            onChange={handleInputChange}
                                            placeholder="Hỏi về doanh thu, thành viên..."
                                            disabled={isLoading}
                                            className="flex-1 bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200 text-sm rounded-xl px-3.5 py-2.5 outline-none placeholder-slate-400 disabled:opacity-60 focus:ring-2 focus:ring-violet-500/40 transition-all"
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
                                </motion.div>
                            )}
                        </AnimatePresence>
                    </motion.div>
                )}
            </AnimatePresence>
        </>
    );
}
