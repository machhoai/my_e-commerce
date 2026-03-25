'use client';

import { useState, useEffect, useCallback } from 'react';
import {
    Link as LinkIcon, MousePointerClick, Smartphone, Globe,
    Plus, Copy, BarChart2, ExternalLink, X, Check, Loader2,
    Hash, Calendar, Search, ArrowUpRight, RefreshCw,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuth } from '@/contexts/AuthContext';

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

interface TrackingLink {
    id: string;
    slug: string;
    targetUrl: string;
    campaignName: string;
    clicks: number;
    uniqueDevices: number;
    topSource: string;
    createdAt: string;
    active: boolean;
}

interface TrackingStats {
    totalClicks: number;
    topSource: { name: string; pct: number };
    topDevice: { name: string; pct: number };
    activeLinks: number;
    totalLinks: number;
}

// ─────────────────────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────────────────────

const BASE_URL = 'joyworld.vn';

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function truncateUrl(url: string, max = 45): string {
    if (url.length <= max) return url;
    return url.slice(0, max) + '\u2026';
}

function formatNumber(n: number): string {
    return n.toLocaleString('vi-VN');
}

// ─────────────────────────────────────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────────────────────────────────────

export default function TrackingPage() {
    const { user } = useAuth();

    const [links, setLinks] = useState<TrackingLink[]>([]);
    const [stats, setStats] = useState<TrackingStats>({
        totalClicks: 0,
        topSource: { name: 'N/A', pct: 0 },
        topDevice: { name: 'N/A', pct: 0 },
        activeLinks: 0,
        totalLinks: 0,
    });
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');
    const [showModal, setShowModal] = useState(false);
    const [copiedId, setCopiedId] = useState<string | null>(null);

    // Create-link form state
    const [formCampaign, setFormCampaign] = useState('');
    const [formTarget, setFormTarget] = useState('');
    const [formSlug, setFormSlug] = useState('');
    const [isCreating, setIsCreating] = useState(false);
    const [createError, setCreateError] = useState('');

    // ── Fetch data from /api/tracking ────────────────────────────────────
    const fetchData = useCallback(async () => {
        if (!user) return;
        try {
            setLoading(true);
            const token = await user.getIdToken();
            const res = await fetch('/api/tracking', {
                headers: { Authorization: `Bearer ${token}` },
            });
            if (!res.ok) throw new Error('Failed to fetch');
            const data = await res.json();
            setLinks(data.links ?? []);
            setStats(data.stats ?? {
                totalClicks: 0,
                topSource: { name: 'N/A', pct: 0 },
                topDevice: { name: 'N/A', pct: 0 },
                activeLinks: 0,
                totalLinks: 0,
            });
        } catch (err) {
            console.error('Failed to fetch tracking data:', err);
        } finally {
            setLoading(false);
        }
    }, [user]);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    // ── Copy to clipboard ────────────────────────────────────────────────
    const copyToClipboard = async (text: string, linkId: string) => {
        if (typeof navigator === 'undefined' || !navigator.clipboard) return;
        try {
            await navigator.clipboard.writeText(text);
            setCopiedId(linkId);
            setTimeout(() => setCopiedId(null), 2000);
        } catch {
            console.error('Copy failed');
        }
    };

    // ── Create link via POST /api/tracking ───────────────────────────────
    const handleCreate = async () => {
        if (!formCampaign.trim() || !formTarget.trim() || !user) return;
        setIsCreating(true);
        setCreateError('');

        try {
            const token = await user.getIdToken();
            const res = await fetch('/api/tracking', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${token}`,
                },
                body: JSON.stringify({
                    campaignName: formCampaign.trim(),
                    targetUrl: formTarget.trim(),
                    slug: formSlug.trim() || undefined,
                }),
            });

            const data = await res.json();

            if (!res.ok) {
                setCreateError(data.error || 'Có lỗi xảy ra');
                return;
            }

            setShowModal(false);
            setFormCampaign('');
            setFormTarget('');
            setFormSlug('');
            await fetchData();
        } catch {
            setCreateError('Không thể kết nối máy chủ');
        } finally {
            setIsCreating(false);
        }
    };

    // ── Filtered links ───────────────────────────────────────────────────
    const filtered = links.filter(
        (l) =>
            l.campaignName.toLowerCase().includes(search.toLowerCase()) ||
            l.slug.toLowerCase().includes(search.toLowerCase()),
    );

    // ── Loading state ────────────────────────────────────────────────────
    if (loading) {
        return (
            <div className="min-h-screen bg-slate-50 flex items-center justify-center">
                <div className="flex flex-col items-center gap-3">
                    <Loader2 className="w-8 h-8 text-indigo-500 animate-spin" />
                    <p className="text-sm text-slate-500 font-medium">Đang tải dữ liệu...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-slate-50">
            {/* ═══ HEADER ═══ */}
            <div className="bg-white border-b border-slate-100">
                <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6">
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                        <div>
                            <h1 className="text-xl font-black text-slate-800 flex items-center gap-2">
                                <LinkIcon className="w-5 h-5 text-indigo-500" />
                                Tracking Links
                            </h1>
                            <p className="text-xs text-slate-500 mt-1">
                                Quản lý link rút gọn &amp; theo dõi lượt truy cập
                            </p>
                        </div>
                        <div className="flex items-center gap-2">
                            <button
                                onClick={() => fetchData()}
                                className="inline-flex items-center gap-2 px-3 py-2.5 bg-white border border-slate-200 hover:bg-slate-50 text-slate-600 text-sm font-bold rounded-xl active:scale-[0.98] transition-all"
                                title="Tải lại"
                            >
                                <RefreshCw className="w-4 h-4" />
                            </button>
                            <button
                                onClick={() => { setShowModal(true); setCreateError(''); }}
                                className="inline-flex items-center gap-2 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-bold rounded-xl shadow-md shadow-indigo-200 active:scale-[0.98] transition-all"
                            >
                                <Plus className="w-4 h-4" />
                                Tạo Tracking Link
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6 space-y-6">
                {/* ═══ ANALYTICS OVERVIEW ═══ */}
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                    <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4">
                        <div className="flex items-center justify-between mb-3">
                            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Tổng lượt Click</span>
                            <div className="w-8 h-8 rounded-lg bg-indigo-50 flex items-center justify-center">
                                <MousePointerClick className="w-4 h-4 text-indigo-500" />
                            </div>
                        </div>
                        <p className="text-2xl font-black text-slate-800">{formatNumber(stats.totalClicks)}</p>
                    </div>
                    <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4">
                        <div className="flex items-center justify-between mb-3">
                            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Nguồn Top 1</span>
                            <div className="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center">
                                <Globe className="w-4 h-4 text-blue-500" />
                            </div>
                        </div>
                        <p className="text-2xl font-black text-slate-800">{stats.topSource.name}</p>
                        <p className="text-[10px] text-slate-500 font-medium mt-1">{stats.topSource.pct}% tổng truy cập</p>
                    </div>
                    <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4">
                        <div className="flex items-center justify-between mb-3">
                            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Thiết bị phổ biến</span>
                            <div className="w-8 h-8 rounded-lg bg-amber-50 flex items-center justify-center">
                                <Smartphone className="w-4 h-4 text-amber-500" />
                            </div>
                        </div>
                        <p className="text-2xl font-black text-slate-800">{stats.topDevice.name}</p>
                        <p className="text-[10px] text-slate-500 font-medium mt-1">{stats.topDevice.pct}% thiết bị truy cập</p>
                    </div>
                    <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4">
                        <div className="flex items-center justify-between mb-3">
                            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Link hoạt động</span>
                            <div className="w-8 h-8 rounded-lg bg-emerald-50 flex items-center justify-center">
                                <BarChart2 className="w-4 h-4 text-emerald-500" />
                            </div>
                        </div>
                        <p className="text-2xl font-black text-slate-800">{stats.activeLinks}</p>
                        <p className="text-[10px] text-slate-500 font-medium mt-1">/ {stats.totalLinks} tổng số link</p>
                    </div>
                </div>

                {/* ═══ SEARCH BAR ═══ */}
                <div className="relative">
                    <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                    <input
                        type="text"
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        placeholder="Tìm theo tên chiến dịch hoặc slug..."
                        className="w-full bg-white border border-slate-200 rounded-xl pl-10 pr-4 py-2.5 text-sm text-slate-700 outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 transition-all"
                    />
                </div>

                {/* ═══ LINK LIST ═══ */}
                <div className="space-y-3">
                    {filtered.length === 0 ? (
                        <div className="text-center py-16">
                            <LinkIcon className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                            <p className="text-sm text-slate-500 font-medium">
                                {links.length === 0 ? 'Chưa có tracking link nào' : 'Không tìm thấy link nào'}
                            </p>
                            {links.length === 0 && (
                                <button
                                    onClick={() => { setShowModal(true); setCreateError(''); }}
                                    className="mt-3 text-xs font-bold text-indigo-600 hover:text-indigo-700"
                                >
                                    + Tạo link đầu tiên
                                </button>
                            )}
                        </div>
                    ) : (
                        filtered.map((link) => (
                            <div
                                key={link.id}
                                className={cn(
                                    'bg-white rounded-2xl border shadow-sm overflow-hidden transition-all hover:shadow-md',
                                    link.active ? 'border-slate-100' : 'border-red-100 opacity-60',
                                )}
                            >
                                <div className="p-4">
                                    <div className="flex items-start justify-between gap-2 mb-2">
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-2">
                                                <h3 className="text-sm font-bold text-slate-800 truncate">{link.campaignName}</h3>
                                                <span className={cn(
                                                    'shrink-0 px-1.5 py-0.5 rounded-full text-[9px] font-bold uppercase',
                                                    link.active
                                                        ? 'bg-emerald-50 text-emerald-600 border border-emerald-100'
                                                        : 'bg-red-50 text-red-500 border border-red-100',
                                                )}>
                                                    {link.active ? 'Active' : 'Tạm dừng'}
                                                </span>
                                            </div>
                                            <a href={link.targetUrl} target="_blank" rel="noopener noreferrer"
                                                className="text-[11px] text-slate-400 hover:text-indigo-500 transition-colors flex items-center gap-1 mt-0.5">
                                                <ExternalLink className="w-3 h-3 shrink-0" />
                                                {truncateUrl(link.targetUrl)}
                                            </a>
                                        </div>
                                        <div className="shrink-0 flex flex-col items-center bg-indigo-50 rounded-xl px-3 py-1.5 border border-indigo-100">
                                            <span className="text-lg font-black text-indigo-600 leading-none">{formatNumber(link.clicks)}</span>
                                            <span className="text-[8px] font-bold text-indigo-400 uppercase mt-0.5">clicks</span>
                                        </div>
                                    </div>

                                    <div className="flex items-center gap-2 bg-slate-50 rounded-lg px-3 py-2 mt-2">
                                        <LinkIcon className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
                                        <code className="flex-1 text-xs font-mono text-indigo-600 truncate">{BASE_URL}/r/{link.slug}</code>
                                        <button
                                            onClick={() => copyToClipboard(`https://${BASE_URL}/r/${link.slug}`, link.id)}
                                            className={cn(
                                                'shrink-0 inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[10px] font-bold transition-all active:scale-95',
                                                copiedId === link.id ? 'bg-emerald-100 text-emerald-700' : 'bg-indigo-100 text-indigo-700 hover:bg-indigo-200',
                                            )}
                                        >
                                            {copiedId === link.id ? (<><Check className="w-3 h-3" /> Đã copy</>) : (<><Copy className="w-3 h-3" /> Copy</>)}
                                        </button>
                                    </div>

                                    <div className="flex items-center gap-4 mt-3 text-[10px] text-slate-400 font-medium">
                                        <span className="inline-flex items-center gap-1"><Calendar className="w-3 h-3" />{link.createdAt}</span>
                                        <span className="inline-flex items-center gap-1"><Smartphone className="w-3 h-3" />{formatNumber(link.uniqueDevices)} thiết bị</span>
                                        <span className="inline-flex items-center gap-1"><ArrowUpRight className="w-3 h-3" />{link.topSource}</span>
                                    </div>
                                </div>

                                <div className="flex border-t border-slate-50 divide-x divide-slate-50">
                                    <button onClick={() => copyToClipboard(`https://${BASE_URL}/r/${link.slug}`, link.id)}
                                        className="flex-1 flex items-center justify-center gap-1.5 py-2.5 text-xs font-bold text-slate-500 hover:text-indigo-600 hover:bg-indigo-50/50 transition-colors">
                                        <Copy className="w-3.5 h-3.5" /> Copy Link
                                    </button>
                                    <button className="flex-1 flex items-center justify-center gap-1.5 py-2.5 text-xs font-bold text-slate-500 hover:text-indigo-600 hover:bg-indigo-50/50 transition-colors">
                                        <BarChart2 className="w-3.5 h-3.5" /> Xem chi tiết
                                    </button>
                                </div>
                            </div>
                        ))
                    )}
                </div>
            </div>

            {/* ═══ CREATE LINK MODAL ═══ */}
            {showModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                    <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setShowModal(false)} />
                    <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden animate-in zoom-in-95 fade-in duration-200">
                        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
                            <h2 className="text-sm font-bold text-slate-800 flex items-center gap-2">
                                <Plus className="w-4 h-4 text-indigo-500" /> Tạo Tracking Link mới
                            </h2>
                            <button onClick={() => setShowModal(false)} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors">
                                <X className="w-4 h-4" />
                            </button>
                        </div>
                        <div className="px-5 py-4 space-y-4">
                            {createError && (
                                <div className="bg-red-50 border border-red-100 rounded-xl px-3.5 py-2.5 text-xs text-red-600 font-medium">{createError}</div>
                            )}
                            <div>
                                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1.5 block">Tên chiến dịch <span className="text-red-400">*</span></label>
                                <input type="text" value={formCampaign} onChange={(e) => setFormCampaign(e.target.value)} placeholder="VD: Khai trương Landmark 81"
                                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm text-slate-700 outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 transition-all placeholder-slate-400" />
                            </div>
                            <div>
                                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1.5 block">URL đích <span className="text-red-400">*</span></label>
                                <input type="url" value={formTarget} onChange={(e) => setFormTarget(e.target.value)} placeholder="https://facebook.com/..."
                                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm text-slate-700 outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 transition-all placeholder-slate-400 font-mono text-xs" />
                            </div>
                            <div>
                                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1.5 block">Custom Slug <span className="text-slate-300">(tùy chọn)</span></label>
                                <div className="flex items-center bg-slate-50 border border-slate-200 rounded-xl overflow-hidden focus-within:border-indigo-400 focus-within:ring-2 focus-within:ring-indigo-100 transition-all">
                                    <span className="pl-3.5 pr-1 text-xs text-slate-400 font-mono whitespace-nowrap">{BASE_URL}/r/</span>
                                    <input type="text" value={formSlug} onChange={(e) => setFormSlug(e.target.value.replace(/[^a-z0-9-]/g, ''))} placeholder="khai-truong-l81"
                                        className="flex-1 bg-transparent py-2.5 pr-3.5 text-sm text-slate-700 outline-none placeholder-slate-400 font-mono text-xs" />
                                </div>
                                <p className="text-[9px] text-slate-400 mt-1 ml-1"><Hash className="w-2.5 h-2.5 inline mr-0.5" />Chỉ chấp nhận chữ thường, số và dấu gạch ngang</p>
                            </div>
                        </div>
                        <div className="flex gap-2 px-5 py-4 border-t border-slate-100 bg-slate-50/50">
                            <button onClick={() => setShowModal(false)} className="flex-1 py-2.5 rounded-xl border border-slate-200 text-xs font-bold text-slate-600 hover:bg-slate-100 active:scale-[0.98] transition-all">Hủy</button>
                            <button onClick={handleCreate} disabled={isCreating || !formCampaign.trim() || !formTarget.trim()}
                                className="flex-1 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold shadow-sm flex items-center justify-center gap-1.5 disabled:opacity-50 active:scale-[0.98] transition-all">
                                {isCreating ? (<><Loader2 className="w-3.5 h-3.5 animate-spin" /> Đang tạo...</>) : (<><Plus className="w-3.5 h-3.5" /> Tạo Link</>)}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
