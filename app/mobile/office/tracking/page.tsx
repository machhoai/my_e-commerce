'use client';

import { useState, useEffect, useCallback } from 'react';
import {
    Link as LinkIcon, MousePointerClick, Smartphone, Globe,
    Plus, Copy, BarChart2, ExternalLink, X, Check, Loader2,
    Hash, Calendar, Search, ArrowUpRight, RefreshCw,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuth } from '@/contexts/AuthContext';
import MobilePageShell from '@/components/mobile/MobilePageShell';

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

const BASE_URL = 'joyworld.vn';

function truncateUrl(url: string, max = 35): string {
    if (url.length <= max) return url;
    return url.slice(0, max) + '\u2026';
}

function formatNumber(n: number): string {
    return n.toLocaleString('vi-VN');
}

// ─────────────────────────────────────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────────────────────────────────────

export default function MobileTrackingPage() {
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

    const [formCampaign, setFormCampaign] = useState('');
    const [formTarget, setFormTarget] = useState('');
    const [formSlug, setFormSlug] = useState('');
    const [isCreating, setIsCreating] = useState(false);
    const [createError, setCreateError] = useState('');

    // ── Fetch data ───────────────────────────────────────────────────────
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

    useEffect(() => { fetchData(); }, [fetchData]);

    const copyToClipboard = async (text: string, linkId: string) => {
        if (typeof navigator === 'undefined' || !navigator.clipboard) return;
        try {
            await navigator.clipboard.writeText(text);
            setCopiedId(linkId);
            setTimeout(() => setCopiedId(null), 2000);
        } catch { console.error('Copy failed'); }
    };

    const handleCreate = async () => {
        if (!formCampaign.trim() || !formTarget.trim() || !user) return;
        setIsCreating(true);
        setCreateError('');
        try {
            const token = await user.getIdToken();
            const res = await fetch('/api/tracking', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
                body: JSON.stringify({
                    campaignName: formCampaign.trim(),
                    targetUrl: formTarget.trim(),
                    slug: formSlug.trim() || undefined,
                }),
            });
            const data = await res.json();
            if (!res.ok) { setCreateError(data.error || 'Có lỗi xảy ra'); return; }
            setShowModal(false);
            setFormCampaign(''); setFormTarget(''); setFormSlug('');
            await fetchData();
        } catch { setCreateError('Không thể kết nối máy chủ'); }
        finally { setIsCreating(false); }
    };

    const filtered = links.filter(
        (l) => l.campaignName.toLowerCase().includes(search.toLowerCase()) || l.slug.toLowerCase().includes(search.toLowerCase()),
    );

    return (
        <MobilePageShell title="Tracking Links" headerRight={
            <div className="flex items-center gap-1.5">
                <button onClick={() => fetchData()} disabled={loading}
                    className="w-8 h-8 rounded-lg bg-gray-100 flex items-center justify-center active:scale-95 transition-transform disabled:opacity-40">
                    <RefreshCw className={cn('w-4 h-4 text-gray-600', loading && 'animate-spin')} />
                </button>
                <button onClick={() => { setShowModal(true); setCreateError(''); }}
                    className="w-8 h-8 rounded-lg bg-indigo-600 flex items-center justify-center active:scale-95 transition-transform">
                    <Plus className="w-4 h-4 text-white" />
                </button>
            </div>
        }>
            {/* ═══ Loading ═══ */}
            {loading && (
                <div className="flex flex-col items-center justify-center py-16">
                    <Loader2 className="w-8 h-8 text-indigo-500 animate-spin mb-3" />
                    <p className="text-xs font-semibold text-gray-500">Đang tải dữ liệu...</p>
                </div>
            )}

            {!loading && (
                <>
                    {/* ═══ KPI Grid ═══ */}
                    <div className="grid grid-cols-2 gap-2 mb-3">
                        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-3">
                            <div className="flex items-center justify-between mb-1.5">
                                <span className="text-[8px] font-bold text-gray-400 uppercase">Tổng Click</span>
                                <MousePointerClick className="w-3.5 h-3.5 text-indigo-500" />
                            </div>
                            <p className="text-lg font-black text-gray-800">{formatNumber(stats.totalClicks)}</p>
                        </div>
                        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-3">
                            <div className="flex items-center justify-between mb-1.5">
                                <span className="text-[8px] font-bold text-gray-400 uppercase">Nguồn Top 1</span>
                                <Globe className="w-3.5 h-3.5 text-blue-500" />
                            </div>
                            <p className="text-lg font-black text-gray-800">{stats.topSource.name}</p>
                            <p className="text-[9px] text-gray-400">{stats.topSource.pct}%</p>
                        </div>
                        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-3">
                            <div className="flex items-center justify-between mb-1.5">
                                <span className="text-[8px] font-bold text-gray-400 uppercase">Thiết bị</span>
                                <Smartphone className="w-3.5 h-3.5 text-amber-500" />
                            </div>
                            <p className="text-lg font-black text-gray-800">{stats.topDevice.name}</p>
                            <p className="text-[9px] text-gray-400">{stats.topDevice.pct}%</p>
                        </div>
                        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-3">
                            <div className="flex items-center justify-between mb-1.5">
                                <span className="text-[8px] font-bold text-gray-400 uppercase">Hoạt động</span>
                                <BarChart2 className="w-3.5 h-3.5 text-emerald-500" />
                            </div>
                            <p className="text-lg font-black text-gray-800">{stats.activeLinks}</p>
                            <p className="text-[9px] text-gray-400">/ {stats.totalLinks} link</p>
                        </div>
                    </div>

                    {/* ═══ Search ═══ */}
                    <div className="relative mb-3">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400 pointer-events-none" />
                        <input type="text" value={search} onChange={(e) => setSearch(e.target.value)}
                            placeholder="Tìm chiến dịch hoặc slug..."
                            className="w-full bg-white border border-gray-200 rounded-xl pl-9 pr-3 py-2 text-xs text-gray-700 outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 transition-all" />
                    </div>

                    {/* ═══ Link List ═══ */}
                    <div className="space-y-2">
                        {filtered.length === 0 ? (
                            <div className="text-center py-12">
                                <LinkIcon className="w-7 h-7 text-gray-300 mx-auto mb-2" />
                                <p className="text-xs text-gray-500 font-medium">
                                    {links.length === 0 ? 'Chưa có tracking link' : 'Không tìm thấy'}
                                </p>
                                {links.length === 0 && (
                                    <button onClick={() => { setShowModal(true); setCreateError(''); }}
                                        className="mt-2 text-[11px] font-bold text-indigo-600">+ Tạo link đầu tiên</button>
                                )}
                            </div>
                        ) : (
                            filtered.map((link) => (
                                <div key={link.id} className={cn(
                                    'bg-white rounded-xl border shadow-sm overflow-hidden',
                                    link.active ? 'border-gray-100' : 'border-red-100 opacity-60',
                                )}>
                                    <div className="p-3">
                                        <div className="flex items-start justify-between gap-2 mb-1.5">
                                            <div className="flex-1 min-w-0">
                                                <div className="flex items-center gap-1.5">
                                                    <h3 className="text-[12px] font-bold text-gray-800 truncate">{link.campaignName}</h3>
                                                    <span className={cn(
                                                        'shrink-0 px-1 py-0.5 rounded-full text-[7px] font-bold uppercase',
                                                        link.active ? 'bg-emerald-50 text-emerald-600' : 'bg-red-50 text-red-500',
                                                    )}>
                                                        {link.active ? 'ON' : 'OFF'}
                                                    </span>
                                                </div>
                                                <a href={link.targetUrl} target="_blank" rel="noopener noreferrer"
                                                    className="text-[10px] text-gray-400 flex items-center gap-0.5 mt-0.5">
                                                    <ExternalLink className="w-2.5 h-2.5 shrink-0" />
                                                    {truncateUrl(link.targetUrl)}
                                                </a>
                                            </div>
                                            <div className="shrink-0 flex flex-col items-center bg-indigo-50 rounded-lg px-2.5 py-1 border border-indigo-100">
                                                <span className="text-sm font-black text-indigo-600 leading-none">{formatNumber(link.clicks)}</span>
                                                <span className="text-[7px] font-bold text-indigo-400 uppercase">clicks</span>
                                            </div>
                                        </div>

                                        {/* Short URL + copy */}
                                        <div className="flex items-center gap-1.5 bg-gray-50 rounded-lg px-2.5 py-1.5 mt-1.5">
                                            <LinkIcon className="w-3 h-3 text-indigo-400 shrink-0" />
                                            <code className="flex-1 text-[10px] font-mono text-indigo-600 truncate">{BASE_URL}/r/{link.slug}</code>
                                            <button onClick={() => copyToClipboard(`https://${BASE_URL}/r/${link.slug}`, link.id)}
                                                className={cn(
                                                    'shrink-0 inline-flex items-center gap-0.5 px-2 py-0.5 rounded-md text-[9px] font-bold active:scale-95 transition-all',
                                                    copiedId === link.id ? 'bg-emerald-100 text-emerald-700' : 'bg-indigo-100 text-indigo-700',
                                                )}>
                                                {copiedId === link.id ? (<><Check className="w-2.5 h-2.5" /> Đã copy</>) : (<><Copy className="w-2.5 h-2.5" /> Copy</>)}
                                            </button>
                                        </div>

                                        {/* Meta */}
                                        <div className="flex items-center gap-3 mt-2 text-[9px] text-gray-400 font-medium">
                                            <span className="inline-flex items-center gap-0.5"><Calendar className="w-2.5 h-2.5" />{link.createdAt}</span>
                                            <span className="inline-flex items-center gap-0.5"><Smartphone className="w-2.5 h-2.5" />{formatNumber(link.uniqueDevices)}</span>
                                            <span className="inline-flex items-center gap-0.5"><ArrowUpRight className="w-2.5 h-2.5" />{link.topSource}</span>
                                        </div>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                </>
            )}

            {/* ═══ CREATE MODAL ═══ */}
            {showModal && (
                <div className="fixed inset-0 z-50 flex items-end justify-center">
                    <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setShowModal(false)} />
                    <div className="relative bg-white rounded-t-2xl shadow-2xl w-full max-w-md overflow-hidden animate-in slide-in-from-bottom duration-200 pb-safe">
                        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
                            <h2 className="text-xs font-bold text-gray-800 flex items-center gap-1.5">
                                <Plus className="w-3.5 h-3.5 text-indigo-500" /> Tạo Tracking Link
                            </h2>
                            <button onClick={() => setShowModal(false)} className="p-1 rounded-lg hover:bg-gray-100 text-gray-400">
                                <X className="w-4 h-4" />
                            </button>
                        </div>
                        <div className="px-4 py-3 space-y-3">
                            {createError && (
                                <div className="bg-red-50 border border-red-100 rounded-lg px-3 py-2 text-[11px] text-red-600 font-medium">{createError}</div>
                            )}
                            <div>
                                <label className="text-[9px] font-bold text-gray-500 uppercase mb-1 block">Tên chiến dịch <span className="text-red-400">*</span></label>
                                <input type="text" value={formCampaign} onChange={(e) => setFormCampaign(e.target.value)} placeholder="VD: Khai trương Landmark 81"
                                    className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 text-xs text-gray-700 outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100" />
                            </div>
                            <div>
                                <label className="text-[9px] font-bold text-gray-500 uppercase mb-1 block">URL đích <span className="text-red-400">*</span></label>
                                <input type="url" value={formTarget} onChange={(e) => setFormTarget(e.target.value)} placeholder="https://facebook.com/..."
                                    className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 text-xs text-gray-700 outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 font-mono" />
                            </div>
                            <div>
                                <label className="text-[9px] font-bold text-gray-500 uppercase mb-1 block">Slug <span className="text-gray-300">(tùy chọn)</span></label>
                                <div className="flex items-center bg-gray-50 border border-gray-200 rounded-xl overflow-hidden focus-within:border-indigo-400 focus-within:ring-2 focus-within:ring-indigo-100">
                                    <span className="pl-3 pr-0.5 text-[10px] text-gray-400 font-mono whitespace-nowrap">{BASE_URL}/r/</span>
                                    <input type="text" value={formSlug} onChange={(e) => setFormSlug(e.target.value.replace(/[^a-z0-9-]/g, ''))} placeholder="my-slug"
                                        className="flex-1 bg-transparent py-2 pr-3 text-xs text-gray-700 outline-none font-mono" />
                                </div>
                                <p className="text-[8px] text-gray-400 mt-0.5 ml-0.5"><Hash className="w-2 h-2 inline mr-0.5" />Chữ thường, số, dấu gạch ngang</p>
                            </div>
                        </div>
                        <div className="flex gap-2 px-4 py-3 border-t border-gray-100 bg-gray-50/50">
                            <button onClick={() => setShowModal(false)} className="flex-1 py-2 rounded-xl border border-gray-200 text-[11px] font-bold text-gray-600 active:scale-[0.98]">Hủy</button>
                            <button onClick={handleCreate} disabled={isCreating || !formCampaign.trim() || !formTarget.trim()}
                                className="flex-1 py-2 rounded-xl bg-indigo-600 text-white text-[11px] font-bold flex items-center justify-center gap-1 disabled:opacity-50 active:scale-[0.98]">
                                {isCreating ? (<><Loader2 className="w-3 h-3 animate-spin" /> Đang tạo...</>) : (<><Plus className="w-3 h-3" /> Tạo Link</>)}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </MobilePageShell>
    );
}
