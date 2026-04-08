'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import {
    Link as LinkIcon, MousePointerClick, Smartphone, Globe,
    Plus, Copy, BarChart2, ExternalLink, X, Check, Loader2,
    Hash, Calendar, Search, ArrowUpRight, RefreshCw,
    TrendingUp, Activity, Target,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuth } from '@/contexts/AuthContext';
import { DashboardHeader } from '@/components/inventory/overview/DashboardHeader';
import {
    ChartCard, ChartTitle, EmptyChart,
    DonutPieChart, VerticalBarChart, CHART_PALETTE,
} from '@/components/admin/MarketingCharts';

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

const BASE_URL = 'erp.joyworld.vn';

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
    const router = useRouter();

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

    // ── Marketing Analytics: computed data ──────────────────────────
    const campaignBarData = useMemo(() => {
        return links
            .filter(l => l.clicks > 0)
            .sort((a, b) => b.clicks - a.clicks)
            .slice(0, 10)
            .map(l => ({ name: l.campaignName, value: l.clicks }));
    }, [links]);

    const sourceDistribution = useMemo(() => {
        const map: Record<string, number> = {};
        links.forEach(l => {
            if (l.topSource) {
                map[l.topSource] = (map[l.topSource] || 0) + l.clicks;
            }
        });
        return Object.entries(map)
            .map(([name, value]) => ({ name, value }))
            .sort((a, b) => b.value - a.value);
    }, [links]);

    const engagementStats = useMemo(() => {
        const totalClicks = links.reduce((s, l) => s + l.clicks, 0);
        const totalDevices = links.reduce((s, l) => s + l.uniqueDevices, 0);
        const activeLinks = links.filter(l => l.active).length;
        const avgClicksPerLink = links.length > 0 ? Math.round(totalClicks / links.length) : 0;
        const engagementRate = totalDevices > 0 ? ((totalClicks / totalDevices) * 100).toFixed(1) : '0';
        return { totalClicks, totalDevices, activeLinks, avgClicksPerLink, engagementRate };
    }, [links]);

    // ── Loading state ────────────────────────────────────────────────────
    if (loading) {
        return (
            <div className="flex flex-col items-center justify-center py-24">
                <div className="w-8 h-8 border-4 border-primary-500 border-t-transparent rounded-full animate-spin mb-4" />
                <p className="text-sm text-surface-400">Đang tải dữ liệu...</p>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* ═══ HEADER ═══ */}
            <DashboardHeader
                showSelect={false}
                titleChildren={
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 w-full">
                        <div>
                            <h1 className="text-2xl font-bold bg-gradient-to-r from-primary-600 to-accent-600 bg-clip-text text-transparent flex items-center gap-2">
                                <LinkIcon className="w-7 h-7 text-primary-600" />
                                Tracking Links
                            </h1>
                            <p className="text-surface-500 mt-1 text-sm">
                                Quản lý link rút gọn &amp; theo dõi lượt truy cập
                            </p>
                        </div>
                        <div className="flex items-center gap-2">
                            <button
                                onClick={() => fetchData()}
                                className="inline-flex items-center gap-2 px-3 py-2.5 bg-white border border-surface-200 hover:bg-surface-50 text-surface-600 text-sm font-semibold rounded-xl active:scale-95 transition-all"
                                title="Tải lại"
                            >
                                <RefreshCw className="w-4 h-4" />
                            </button>
                            <button
                                onClick={() => { setShowModal(true); setCreateError(''); }}
                                className="inline-flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-primary-600 to-accent-600 hover:from-primary-700 hover:to-accent-700 text-white text-sm font-semibold rounded-xl shadow-lg shadow-primary-600/20 active:scale-95 transition-all"
                            >
                                <Plus className="w-4 h-4" />
                                Tạo Tracking Link
                            </button>
                        </div>
                    </div>
                }
            />

            {/* ═══ ANALYTICS OVERVIEW ═══ */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                <div className="bg-white rounded-2xl border border-surface-200 shadow-sm p-4">
                    <div className="flex items-center justify-between mb-3">
                        <span className="text-[10px] font-bold text-surface-400 uppercase tracking-wider">Tổng lượt Click</span>
                        <div className="w-8 h-8 rounded-lg bg-primary-50 flex items-center justify-center">
                            <MousePointerClick className="w-4 h-4 text-primary-500" />
                        </div>
                    </div>
                    <p className="text-2xl font-black text-surface-800">{formatNumber(stats.totalClicks)}</p>
                </div>
                <div className="bg-white rounded-2xl border border-surface-200 shadow-sm p-4">
                    <div className="flex items-center justify-between mb-3">
                        <span className="text-[10px] font-bold text-surface-400 uppercase tracking-wider">Nguồn Top 1</span>
                        <div className="w-8 h-8 rounded-lg bg-info-50 flex items-center justify-center">
                            <Globe className="w-4 h-4 text-info-500" />
                        </div>
                    </div>
                    <p className="text-2xl font-black text-surface-800">{stats.topSource.name}</p>
                    <p className="text-[10px] text-surface-500 font-medium mt-1">{stats.topSource.pct}% tổng truy cập</p>
                </div>
                <div className="bg-white rounded-2xl border border-surface-200 shadow-sm p-4">
                    <div className="flex items-center justify-between mb-3">
                        <span className="text-[10px] font-bold text-surface-400 uppercase tracking-wider">Thiết bị phổ biến</span>
                        <div className="w-8 h-8 rounded-lg bg-warning-50 flex items-center justify-center">
                            <Smartphone className="w-4 h-4 text-warning-500" />
                        </div>
                    </div>
                    <p className="text-2xl font-black text-surface-800">{stats.topDevice.name}</p>
                    <p className="text-[10px] text-surface-500 font-medium mt-1">{stats.topDevice.pct}% thiết bị truy cập</p>
                </div>
                <div className="bg-white rounded-2xl border border-surface-200 shadow-sm p-4">
                    <div className="flex items-center justify-between mb-3">
                        <span className="text-[10px] font-bold text-surface-400 uppercase tracking-wider">Link hoạt động</span>
                        <div className="w-8 h-8 rounded-lg bg-success-50 flex items-center justify-center">
                            <BarChart2 className="w-4 h-4 text-success-500" />
                        </div>
                    </div>
                    <p className="text-2xl font-black text-surface-800">{stats.activeLinks}</p>
                    <p className="text-[10px] text-surface-500 font-medium mt-1">/ {stats.totalLinks} tổng số link</p>
                </div>
            </div>

            {/* ═══ MARKETING ANALYTICS CHARTS ═══ */}
            {links.length > 0 && (
                <div className="space-y-4">
                    <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-primary-500 to-accent-500 flex items-center justify-center shadow-sm">
                            <BarChart2 className="w-4 h-4 text-white" />
                        </div>
                        <div>
                            <h2 className="text-sm font-bold text-surface-700">Phân tích hiệu suất</h2>
                            <p className="text-[10px] text-surface-400">So sánh chiến dịch, nguồn truy cập & tương tác</p>
                        </div>
                        <div className="flex-1 h-px bg-gradient-to-r from-surface-200 to-transparent ml-2" />
                    </div>

                    {/* Engagement Quick Stats */}
                    <div className="grid grid-cols-3 gap-3">
                        {[
                            { label: 'Tổng thiết bị', value: formatNumber(engagementStats.totalDevices), icon: Smartphone, gradient: 'from-info-500 to-info-600', bgLight: 'bg-info-50' },
                            { label: 'Trung bình click/link', value: formatNumber(engagementStats.avgClicksPerLink), icon: Target, gradient: 'from-accent-500 to-accent-600', bgLight: 'bg-accent-50' },
                            { label: 'Tỉ lệ tương tác', value: `${engagementStats.engagementRate}%`, icon: Activity, gradient: 'from-success-500 to-success-600', bgLight: 'bg-success-50' },
                        ].map(k => (
                            <div key={k.label} className="rounded-xl border border-surface-200 bg-white p-4 hover:shadow-md hover:border-surface-300 transition-all duration-200">
                                <div className="flex items-center gap-2.5 mb-3">
                                    <div className={cn('w-8 h-8 rounded-lg bg-gradient-to-br flex items-center justify-center shadow-sm', k.gradient)}>
                                        <k.icon className="w-4 h-4 text-white" />
                                    </div>
                                    <span className="text-xs font-medium text-surface-500">{k.label}</span>
                                </div>
                                <p className="text-2xl font-black text-surface-800">{k.value}</p>
                            </div>
                        ))}
                    </div>

                    {/* Charts Row */}
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                        {/* Campaign Comparison */}
                        <ChartCard>
                            <ChartTitle
                                icon={<TrendingUp className="w-4 h-4 text-indigo-500" />}
                                title="Top chiến dịch theo Clicks"
                                subtitle="Xếp hạng 10 chiến dịch có lượt click cao nhất"
                            />
                            {campaignBarData.length > 0 ? (
                                <VerticalBarChart data={campaignBarData} height={260} />
                            ) : (
                                <EmptyChart
                                    icon={<TrendingUp className="w-5 h-5 text-surface-300" />}
                                    message="Chưa có dữ liệu click"
                                />
                            )}
                        </ChartCard>

                        {/* Source Distribution */}
                        <ChartCard>
                            <ChartTitle
                                icon={<Globe className="w-4 h-4 text-blue-500" />}
                                title="Phân bố nguồn truy cập"
                                subtitle="Tổng hợp nguồn clicks từ tất cả link"
                            />
                            {sourceDistribution.length > 0 ? (
                                <DonutPieChart data={sourceDistribution} height={220} />
                            ) : (
                                <EmptyChart
                                    icon={<Globe className="w-5 h-5 text-surface-300" />}
                                    message="Chưa có dữ liệu nguồn"
                                />
                            )}
                        </ChartCard>
                    </div>
                </div>
            )}

            {/* ═══ SEARCH BAR ═══ */}
            <div className="relative">
                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-surface-400 pointer-events-none" />
                <input
                    type="text"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Tìm theo tên chiến dịch hoặc slug..."
                    className="w-full bg-white border border-surface-200 rounded-xl pl-10 pr-4 py-2.5 text-sm text-surface-700 outline-none focus:border-primary-400 focus:ring-2 focus:ring-primary-100 transition-all"
                />
            </div>

            {/* ═══ LINK LIST ═══ */}
            <div className="space-y-3">
                {filtered.length === 0 ? (
                    <div className="bg-white rounded-2xl border border-surface-200 shadow-sm p-16 text-center flex flex-col items-center">
                        <div className="w-16 h-16 bg-surface-100 rounded-2xl flex items-center justify-center mb-4">
                            <LinkIcon className="w-7 h-7 text-surface-300" />
                        </div>
                        <h3 className="text-base font-bold text-surface-700 mb-1">
                            {links.length === 0 ? 'Chưa có tracking link nào' : 'Không tìm thấy link nào'}
                        </h3>
                        {links.length === 0 && (
                            <button
                                onClick={() => { setShowModal(true); setCreateError(''); }}
                                className="mt-3 inline-flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-primary-600 to-accent-600 text-white text-sm font-semibold rounded-xl active:scale-95 transition-all"
                            >
                                <Plus className="w-4 h-4" /> Tạo link đầu tiên
                            </button>
                        )}
                    </div>
                ) : (
                    filtered.map((link) => (
                        <div
                            key={link.id}
                            className={cn(
                                'bg-white rounded-2xl border shadow-sm overflow-hidden transition-all hover:shadow-md',
                                link.active ? 'border-surface-200' : 'border-danger-200 opacity-60',
                            )}
                        >
                            <div className="p-4">
                                <div className="flex items-start justify-between gap-2 mb-2">
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2">
                                            <h3 className="text-sm font-bold text-surface-800 truncate">{link.campaignName}</h3>
                                            <span className={cn(
                                                'shrink-0 px-1.5 py-0.5 rounded-full text-[9px] font-bold uppercase',
                                                link.active
                                                    ? 'bg-success-50 text-success-600 border border-success-200'
                                                    : 'bg-danger-50 text-danger-500 border border-danger-200',
                                            )}>
                                                {link.active ? 'Active' : 'Tạm dừng'}
                                            </span>
                                        </div>
                                        <a href={link.targetUrl} target="_blank" rel="noopener noreferrer"
                                            className="text-[11px] text-surface-400 hover:text-primary-500 transition-colors flex items-center gap-1 mt-0.5">
                                            <ExternalLink className="w-3 h-3 shrink-0" />
                                            {truncateUrl(link.targetUrl)}
                                        </a>
                                    </div>
                                    <div className="shrink-0 flex flex-col items-center bg-primary-50 rounded-xl px-3 py-1.5 border border-primary-100">
                                        <span className="text-lg font-black text-primary-600 leading-none">{formatNumber(link.clicks)}</span>
                                        <span className="text-[8px] font-bold text-primary-400 uppercase mt-0.5">clicks</span>
                                    </div>
                                </div>

                                <div className="flex items-center gap-2 bg-surface-50 rounded-lg px-3 py-2 mt-2">
                                    <LinkIcon className="w-3.5 h-3.5 text-primary-400 shrink-0" />
                                    <code className="flex-1 text-xs font-mono text-primary-600 truncate">{BASE_URL}/r/{link.slug}</code>
                                    <button
                                        onClick={() => copyToClipboard(`https://${BASE_URL}/r/${link.slug}`, link.id)}
                                        className={cn(
                                            'shrink-0 inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[10px] font-bold transition-all active:scale-95',
                                            copiedId === link.id ? 'bg-success-100 text-success-700' : 'bg-primary-100 text-primary-700 hover:bg-primary-200',
                                        )}
                                    >
                                        {copiedId === link.id ? (<><Check className="w-3 h-3" /> Đã copy</>) : (<><Copy className="w-3 h-3" /> Copy</>)}
                                    </button>
                                </div>

                                <div className="flex items-center gap-4 mt-3 text-[10px] text-surface-400 font-medium">
                                    <span className="inline-flex items-center gap-1"><Calendar className="w-3 h-3" />{link.createdAt}</span>
                                    <span className="inline-flex items-center gap-1"><Smartphone className="w-3 h-3" />{formatNumber(link.uniqueDevices)} thiết bị</span>
                                    <span className="inline-flex items-center gap-1"><ArrowUpRight className="w-3 h-3" />{link.topSource}</span>
                                </div>
                            </div>

                            <div className="flex border-t border-surface-100 divide-x divide-surface-100">
                                <button onClick={() => copyToClipboard(`https://${BASE_URL}/r/${link.slug}`, link.id)}
                                    className="flex-1 flex items-center justify-center gap-1.5 py-2.5 text-xs font-bold text-surface-500 hover:text-primary-600 hover:bg-primary-50/50 transition-colors">
                                    <Copy className="w-3.5 h-3.5" /> Copy Link
                                </button>
                                <button onClick={() => router.push(`/office/tracking/${link.slug}`)}
                                    className="flex-1 flex items-center justify-center gap-1.5 py-2.5 text-xs font-bold text-surface-500 hover:text-primary-600 hover:bg-primary-50/50 transition-colors">
                                    <BarChart2 className="w-3.5 h-3.5" /> Xem chi tiết
                                </button>
                            </div>
                        </div>
                    ))
                )}
            </div>

            {/* ═══ CREATE LINK MODAL ═══ */}
            {showModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                    <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setShowModal(false)} />
                    <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden animate-in zoom-in-95 fade-in duration-200">
                        <div className="flex items-center justify-between px-5 py-4 border-b border-surface-200">
                            <h2 className="text-sm font-bold text-surface-800 flex items-center gap-2">
                                <Plus className="w-4 h-4 text-primary-500" /> Tạo Tracking Link mới
                            </h2>
                            <button onClick={() => setShowModal(false)} className="p-1.5 rounded-lg hover:bg-surface-100 text-surface-400 hover:text-surface-600 transition-colors">
                                <X className="w-4 h-4" />
                            </button>
                        </div>
                        <div className="px-5 py-4 space-y-4">
                            {createError && (
                                <div className="bg-danger-50 border border-danger-200 rounded-xl px-3.5 py-2.5 text-xs text-danger-600 font-medium">{createError}</div>
                            )}
                            <div>
                                <label className="text-[10px] font-bold text-surface-500 uppercase tracking-wider mb-1.5 block">Tên chiến dịch <span className="text-danger-400">*</span></label>
                                <input type="text" value={formCampaign} onChange={(e) => setFormCampaign(e.target.value)} placeholder="VD: Khai trương Landmark 81"
                                    className="w-full bg-surface-50 border border-surface-200 rounded-xl px-3.5 py-2.5 text-sm text-surface-700 outline-none focus:border-primary-400 focus:ring-2 focus:ring-primary-100 transition-all placeholder-surface-400" />
                            </div>
                            <div>
                                <label className="text-[10px] font-bold text-surface-500 uppercase tracking-wider mb-1.5 block">URL đích <span className="text-danger-400">*</span></label>
                                <input type="url" value={formTarget} onChange={(e) => setFormTarget(e.target.value)} placeholder="https://facebook.com/..."
                                    className="w-full bg-surface-50 border border-surface-200 rounded-xl px-3.5 py-2.5 text-sm text-surface-700 outline-none focus:border-primary-400 focus:ring-2 focus:ring-primary-100 transition-all placeholder-surface-400 font-mono" />
                            </div>
                            <div>
                                <label className="text-[10px] font-bold text-surface-500 uppercase tracking-wider mb-1.5 block">Custom Slug <span className="text-surface-300">(tùy chọn)</span></label>
                                <div className="flex items-center bg-surface-50 border border-surface-200 rounded-xl overflow-hidden focus-within:border-primary-400 focus-within:ring-2 focus-within:ring-primary-100 transition-all">
                                    <span className="pl-3.5 pr-1 text-xs text-surface-400 font-mono whitespace-nowrap">{BASE_URL}/r/</span>
                                    <input type="text" value={formSlug} onChange={(e) => setFormSlug(e.target.value.replace(/[^a-z0-9-]/g, ''))} placeholder="khai-truong-l81"
                                        className="flex-1 bg-transparent py-2.5 pr-3.5 text-sm text-surface-700 outline-none placeholder-surface-400 font-mono" />
                                </div>
                                <p className="text-[9px] text-surface-400 mt-1 ml-1"><Hash className="w-2.5 h-2.5 inline mr-0.5" />Chỉ chấp nhận chữ thường, số và dấu gạch ngang</p>
                            </div>
                        </div>
                        <div className="flex gap-2 px-5 py-4 border-t border-surface-200 bg-surface-50/50">
                            <button onClick={() => setShowModal(false)} className="flex-1 py-2.5 rounded-xl border border-surface-200 text-xs font-bold text-surface-600 hover:bg-surface-100 active:scale-95 transition-all">Hủy</button>
                            <button onClick={handleCreate} disabled={isCreating || !formCampaign.trim() || !formTarget.trim()}
                                className="flex-1 py-2.5 rounded-xl bg-gradient-to-r from-primary-600 to-accent-600 hover:from-primary-700 hover:to-accent-700 text-white text-xs font-bold shadow-sm flex items-center justify-center gap-1.5 disabled:opacity-50 active:scale-95 transition-all">
                                {isCreating ? (<><Loader2 className="w-3.5 h-3.5 animate-spin" /> Đang tạo...</>) : (<><Plus className="w-3.5 h-3.5" /> Tạo Link</>)}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

