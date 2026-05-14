'use client';

/**
 * AIQuickChat.tsx
 * ─────────────────────────────────────────────────────────────
 * AI Chat BottomSheet — Mở từ FAB lơ lửng khi user có quyền AI.
 * Dùng useChat từ ai/react (SDK v4).
 */

import React, { useRef, useEffect, useCallback, useState } from 'react';
import { useChat } from 'ai/react';
import type { Message } from 'ai';
import { Send, X, Bot, Sparkles, Loader2 } from 'lucide-react';
import BottomSheet from '@/components/shared/BottomSheet';

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

// ── Quick Prompts ────────────────────────────────────────────
const QUICK_PROMPTS = [
    'Doanh thu hôm nay?',
    'Vé nào bán chạy nhất?',
    'Tình hình nhân sự?',
    'Tổng quan kho hàng?',
    'Thành viên mới hôm nay?',
];

// ── Props ────────────────────────────────────────────────────
interface AIQuickChatProps {
    isOpen: boolean;
    onClose: () => void;
}

export default function AIQuickChat({ isOpen, onClose }: AIQuickChatProps) {
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLInputElement>(null);
    const [hasInteracted, setHasInteracted] = useState(false);

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

    const handleQuickPrompt = useCallback((prompt: string) => {
        setInput(prompt);
        setHasInteracted(true);
        setTimeout(() => inputRef.current?.focus(), 50);
    }, [setInput]);

    return (
        <BottomSheet isOpen={isOpen} onClose={onClose} maxHeightClass="max-h-[85vh]">
            {/* ── Header ── */}
            <div className="flex items-center justify-between px-5 py-3 border-b border-surface-100">
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
                            ) : 'Claude Sonnet · Smart Routing'}
                        </p>
                    </div>
                </div>
                <button
                    onClick={onClose}
                    className="p-1.5 rounded-lg bg-surface-100 text-surface-500 hover:bg-surface-200 transition-colors"
                >
                    <X className="w-4 h-4" />
                </button>
            </div>

            {/* ── Messages ── */}
            <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3" style={{ maxHeight: 'calc(85vh - 140px)' }}>
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
                            : 'bg-surface-100 text-surface-800 rounded-2xl rounded-tl-sm px-3.5 py-2.5'
                            }`}>
                            {msg.role === 'assistant'
                                ? <SimpleMarkdown text={msg.content} />
                                : <p>{msg.content}</p>
                            }
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
                <div className="px-4 pb-2 flex flex-wrap gap-1.5">
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

            {/* ── Input bar ── */}
            <form
                onSubmit={(e) => {
                    setHasInteracted(true);
                    handleSubmit(e);
                }}
                className="flex items-center gap-2 px-4 py-3 border-t border-surface-100 shrink-0"
            >
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
        </BottomSheet>
    );
}
