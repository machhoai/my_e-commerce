'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import {
    BarChart, Bar, PieChart, Pie, Cell, LineChart, Line, AreaChart, Area,
    XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from 'recharts';
import {
    ArrowLeft, MousePointerClick, Users, Globe, Smartphone,
    Monitor, MapPin, Languages, Clock, Wifi, Download,
    Loader2, ExternalLink, Copy, Check, Link as LinkIcon,
    Activity, TrendingUp,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuth } from '@/contexts/AuthContext';
import { DashboardHeader } from '@/components/inventory/overview/DashboardHeader';

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

interface ChartItem { name: string; value: number }
interface TimeItem { date: string; count: number }

interface DetailData {
    link: {
        slug: string; targetUrl: string; campaignName: string;
        active: boolean; createdAt: string;
    };
    stats: { totalClicks: number; uniqueIps: number };
    charts: {
        clicksOverTime: TimeItem[];
        hourDistribution: ChartItem[];
        bySource: ChartItem[];
        byDevice: ChartItem[];
        byBrowser: ChartItem[];
        byOS: ChartItem[];
        byCity: ChartItem[];
        byCountry: ChartItem[];
        byLanguage: ChartItem[];
        byTimezone: ChartItem[];
        byNetwork: ChartItem[];
    };
}

// ─────────────────────────────────────────────────────────────────────────────
// Design tokens
// ─────────────────────────────────────────────────────────────────────────────

const BASE_URL = 'joyworld.vn';

const PALETTE = [
    '#6366f1', '#22d3ee', '#f59e0b', '#10b981', '#ec4899',
    '#8b5cf6', '#f97316', '#14b8a6', '#ef4444', '#84cc16',
];

type Tab = 'overview' | 'sources' | 'devices' | 'location' | 'technical';

const TABS: { key: Tab; label: string; icon: React.ReactNode }[] = [
    { key: 'overview', label: 'Tổng quan', icon: <Activity className="w-4 h-4" /> },
    { key: 'sources', label: 'Nguồn truy cập', icon: <Globe className="w-4 h-4" /> },
    { key: 'devices', label: 'Thiết bị', icon: <Monitor className="w-4 h-4" /> },
    { key: 'location', label: 'Vị trí', icon: <MapPin className="w-4 h-4" /> },
    { key: 'technical', label: 'Kỹ thuật', icon: <Clock className="w-4 h-4" /> },
];

const fmt = (n: number) => n.toLocaleString('vi-VN');

// ─────────────────────────────────────────────────────────────────────────────
// Reusable chart parts
// ─────────────────────────────────────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function RenderPieLabel({ cx, cy, midAngle, innerRadius, outerRadius, percent }: any) {
    if (percent < 0.05) return null;
    const RADIAN = Math.PI / 180;
    const r = innerRadius + (outerRadius - innerRadius) * 0.5;
    return (
        <text x={cx + r * Math.cos(-midAngle * RADIAN)} y={cy + r * Math.sin(-midAngle * RADIAN)}
            fill="white" textAnchor="middle" dominantBaseline="central" fontSize={11} fontWeight={700}>
            {(percent * 100).toFixed(0)}%
        </text>
    );
}

const chartTooltipStyle = {
    borderRadius: 12,
    border: '1px solid #e2e8f0',
    boxShadow: '0 8px 24px rgba(0,0,0,0.08)',
    fontSize: 12,
    padding: '8px 12px',
};

function hasData(data: ChartItem[]) {
    return data.length > 0 && !(data.length === 1 && data[0].name === 'Không rõ');
}

// ── Card wrapper ────────────────────────────────────────────────────────────
function ChartCard({ children, className }: { children: React.ReactNode; className?: string }) {
    return (
        <div className={cn(
            'bg-white rounded-2xl border border-slate-100 p-5',
            'shadow-[0_1px_3px_rgba(0,0,0,0.04),0_6px_24px_rgba(0,0,0,0.03)]',
            className,
        )}>
            {children}
        </div>
    );
}

function ChartTitle({ icon, title }: { icon: React.ReactNode; title: string }) {
    return (
        <h3 className="text-[13px] font-extrabold text-slate-700 flex items-center gap-2 mb-5">
            <span className="w-7 h-7 rounded-lg bg-slate-50 flex items-center justify-center">{icon}</span>
            {title}
        </h3>
    );
}

// ── Empty state ─────────────────────────────────────────────────────────────
function EmptyChart({ icon, message }: { icon: React.ReactNode; message: string }) {
    return (
        <div className="flex flex-col items-center justify-center py-10 text-slate-400">
            <div className="w-10 h-10 rounded-xl bg-slate-50 flex items-center justify-center mb-3">{icon}</div>
            <p className="text-xs font-medium">{message}</p>
        </div>
    );
}

// ── Pie card ────────────────────────────────────────────────────────────────
function PieSection({ title, data, icon }: { title: string; data: ChartItem[]; icon: React.ReactNode }) {
    if (!hasData(data)) return null;
    const total = data.reduce((s, d) => s + d.value, 0);
    return (
        <ChartCard>
            <ChartTitle icon={icon} title={title} />
            <div className="flex items-start gap-6">
                <div className="w-[180px] h-[180px] shrink-0">
                    <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                            <Pie data={data} cx="50%" cy="50%" innerRadius={48} outerRadius={80}
                                paddingAngle={3} dataKey="value" labelLine={false} label={RenderPieLabel}
                                stroke="none">
                                {data.map((_, i) => <Cell key={i} fill={PALETTE[i % PALETTE.length]} />)}
                            </Pie>
                        </PieChart>
                    </ResponsiveContainer>
                </div>
                <div className="flex-1 space-y-2 max-h-[180px] overflow-y-auto pr-1">
                    {data.map((item, i) => (
                        <div key={item.name} className="flex items-center gap-3 group">
                            <div className="w-3 h-3 rounded-[4px] shrink-0 shadow-sm" style={{ backgroundColor: PALETTE[i % PALETTE.length] }} />
                            <span className="flex-1 text-[12px] text-slate-600 truncate group-hover:text-slate-900 transition-colors">{item.name}</span>
                            <span className="text-[12px] font-bold text-slate-800 tabular-nums">{fmt(item.value)}</span>
                            <span className="text-[11px] text-slate-400 w-10 text-right tabular-nums">
                                {total > 0 ? `${((item.value / total) * 100).toFixed(0)}%` : ''}
                            </span>
                        </div>
                    ))}
                </div>
            </div>
        </ChartCard>
    );
}

// ── Bar card ────────────────────────────────────────────────────────────────
function BarSection({ title, data, icon, color = '#6366f1' }: { title: string; data: ChartItem[]; icon: React.ReactNode; color?: string }) {
    if (!hasData(data)) return null;
    const top = data.slice(0, 10);
    return (
        <ChartCard>
            <ChartTitle icon={icon} title={title} />
            <div className="h-[280px]">
                <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={top} layout="vertical" margin={{ top: 0, right: 20, left: 0, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" horizontal={false} />
                        <XAxis type="number" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#94a3b8' }} />
                        <YAxis dataKey="name" type="category" axisLine={false} tickLine={false}
                            tick={{ fontSize: 11, fill: '#475569', fontWeight: 500 }} width={110} />
                        <Tooltip contentStyle={chartTooltipStyle} />
                        <Bar dataKey="value" fill={color} radius={[0, 8, 8, 0]} barSize={20}
                            name="Lượt click" />
                    </BarChart>
                </ResponsiveContainer>
            </div>
        </ChartCard>
    );
}

// ─────────────────────────────────────────────────────────────────────────────
// Page
// ─────────────────────────────────────────────────────────────────────────────

export default function TrackingDetailPage() {
    const { user } = useAuth();
    const router = useRouter();
    const params = useParams();
    const slug = params.slug as string;

    const [data, setData] = useState<DetailData | null>(null);
    const [loading, setLoading] = useState(true);
    const [tab, setTab] = useState<Tab>('overview');
    const [copiedSlug, setCopiedSlug] = useState(false);
    const [exporting, setExporting] = useState(false);

    const fetchData = useCallback(async () => {
        if (!user || !slug) return;
        try {
            setLoading(true);
            const token = await user.getIdToken();
            const res = await fetch(`/api/tracking/${slug}`, {
                headers: { Authorization: `Bearer ${token}` },
            });
            if (!res.ok) throw new Error('Failed');
            setData(await res.json());
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    }, [user, slug]);

    useEffect(() => { fetchData(); }, [fetchData]);

    const handleExport = async () => {
        if (!user || !slug) return;
        setExporting(true);
        try {
            const token = await user.getIdToken();
            const res = await fetch(`/api/tracking/${slug}/export`, {
                headers: { Authorization: `Bearer ${token}` },
            });
            if (!res.ok) throw new Error('Export failed');
            const blob = await res.blob();
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `tracking_${slug}_${new Date().toISOString().split('T')[0]}.xlsx`;
            a.click();
            URL.revokeObjectURL(url);
        } catch (err) {
            console.error(err);
        } finally {
            setExporting(false);
        }
    };

    const copyShortUrl = async () => {
        try {
            await navigator.clipboard.writeText(`https://${BASE_URL}/r/${slug}`);
            setCopiedSlug(true);
            setTimeout(() => setCopiedSlug(false), 2000);
        } catch { /* noop */ }
    };

    // ── Loading / empty ─────────────────────────────────────────────────
    if (loading) {
        return (
            <div className="flex flex-col items-center justify-center py-24">
                <div className="w-8 h-8 border-4 border-primary-500 border-t-transparent rounded-full animate-spin mb-4" />
                <p className="text-sm text-surface-400">Đang tải phân tích...</p>
            </div>
        );
    }

    if (!data) {
        return (
            <div className="flex flex-col items-center justify-center py-24">
                <p className="text-sm text-surface-500">Không có dữ liệu</p>
            </div>
        );
    }

    const { link, stats, charts } = data;

    return (
        <div className="space-y-6">
            {/* ═══ HEADER ═══ */}
            <DashboardHeader
                showSelect={false}
                titleChildren={
                    <div className="flex flex-col gap-4 w-full">
                        {/* Top row: back + campaign info + export */}
                        <div className="flex items-center gap-4">
                            <button onClick={() => router.push('/office/tracking')}
                                className="w-9 h-9 rounded-xl bg-surface-50 hover:bg-surface-100 flex items-center justify-center text-surface-500 hover:text-surface-700 transition-all active:scale-95">
                                <ArrowLeft className="w-4 h-4" />
                            </button>

                            <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2.5">
                                    <h1 className="text-xl font-bold bg-gradient-to-r from-primary-600 to-accent-600 bg-clip-text text-transparent truncate">{link.campaignName}</h1>
                                    <span className={cn(
                                        'shrink-0 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wide',
                                        link.active
                                            ? 'bg-success-50 text-success-600 ring-1 ring-success-200'
                                            : 'bg-danger-50 text-danger-500 ring-1 ring-danger-200',
                                    )}>
                                        {link.active ? 'Active' : 'Tạm dừng'}
                                    </span>
                                </div>
                                <div className="flex items-center gap-3 mt-1.5">
                                    <button onClick={copyShortUrl}
                                        className={cn(
                                            'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-mono font-semibold transition-all active:scale-95',
                                            copiedSlug
                                                ? 'bg-success-50 text-success-700 ring-1 ring-success-200'
                                                : 'bg-primary-50 text-primary-600 ring-1 ring-primary-100 hover:ring-primary-200',
                                        )}>
                                        {copiedSlug ? <Check className="w-3 h-3" /> : <LinkIcon className="w-3 h-3" />}
                                        {BASE_URL}/r/{slug}
                                        {!copiedSlug && <Copy className="w-3 h-3 ml-0.5 opacity-50" />}
                                    </button>
                                    <a href={link.targetUrl} target="_blank" rel="noopener noreferrer"
                                        className="text-[11px] text-surface-400 hover:text-primary-500 flex items-center gap-1 transition-colors">
                                        <ExternalLink className="w-3 h-3" />
                                        <span className="truncate max-w-[300px]">{link.targetUrl}</span>
                                    </a>
                                </div>
                            </div>

                            <button onClick={handleExport} disabled={exporting}
                                className="inline-flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-success-600 to-success-500 hover:from-success-700 hover:to-success-600 text-white text-xs font-bold rounded-xl shadow-lg shadow-success-600/20 active:scale-95 transition-all disabled:opacity-50 disabled:shadow-none">
                                {exporting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
                                Xuất Excel
                            </button>
                        </div>
                    </div>
                }
            />

            {/* ═══ TAB BAR ═══ */}
            <div className="bg-white rounded-xl border border-surface-200 shadow-sm p-1 flex gap-1">
                {TABS.map(t => (
                    <button key={t.key} onClick={() => setTab(t.key)}
                        className={cn(
                            'flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm font-semibold whitespace-nowrap transition-all',
                            tab === t.key
                                ? 'bg-gradient-to-r from-primary-600 to-accent-600 text-white shadow-sm'
                                : 'text-surface-500 hover:text-surface-700 hover:bg-surface-50',
                        )}>
                        {t.icon}{t.label}
                    </button>
                ))}
            </div>

            {/* ═══ CONTENT ═══ */}
            <div>

                {/* ──────────── OVERVIEW ──────────── */}
                {tab === 'overview' && (
                    <div className="space-y-6">
                        {/* KPI strip */}
                        <div className="grid grid-cols-4 gap-4">
                            <div className="relative overflow-hidden bg-gradient-to-br from-indigo-600 via-indigo-700 to-violet-800 rounded-2xl p-5 text-white shadow-xl shadow-indigo-600/20">
                                <div className="absolute -right-3 -top-3 w-20 h-20 rounded-full bg-white/5" />
                                <div className="flex items-center justify-between mb-3">
                                    <span className="text-[10px] font-bold uppercase tracking-widest text-indigo-200">Tổng Click</span>
                                    <MousePointerClick className="w-5 h-5 text-indigo-200" />
                                </div>
                                <p className="text-4xl font-black tracking-tight">{fmt(stats.totalClicks)}</p>
                            </div>

                            {[
                                { label: 'IP duy nhất', value: fmt(stats.uniqueIps), Icon: Users, accent: 'text-blue-500', bg: 'bg-blue-50' },
                                { label: 'Nguồn chính', value: charts.bySource[0]?.name ?? 'N/A', Icon: Globe, accent: 'text-emerald-500', bg: 'bg-emerald-50', sub: charts.bySource[0] ? `${fmt(charts.bySource[0].value)} clicks` : '' },
                                { label: 'Thiết bị chính', value: charts.byDevice[0]?.name ?? 'N/A', Icon: Smartphone, accent: 'text-amber-500', bg: 'bg-amber-50', sub: charts.byDevice[0] ? `${fmt(charts.byDevice[0].value)} clicks` : '' },
                            ].map((kpi) => (
                                <ChartCard key={kpi.label} className="flex flex-col justify-between">
                                    <div className="flex items-center justify-between mb-3">
                                        <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400">{kpi.label}</span>
                                        <div className={cn('w-8 h-8 rounded-lg flex items-center justify-center', kpi.bg)}>
                                            <kpi.Icon className={cn('w-4 h-4', kpi.accent)} />
                                        </div>
                                    </div>
                                    <p className="text-2xl font-black text-slate-800 tracking-tight">{kpi.value}</p>
                                    {kpi.sub && <p className="text-[11px] text-slate-400 font-medium mt-1">{kpi.sub}</p>}
                                </ChartCard>
                            ))}
                        </div>

                        {/* Area chart — clicks over time */}
                        {charts.clicksOverTime.length > 1 && (
                            <ChartCard>
                                <ChartTitle icon={<TrendingUp className="w-4 h-4 text-indigo-500" />} title="Lượt click theo ngày" />
                                <div className="h-[280px]">
                                    <ResponsiveContainer width="100%" height="100%">
                                        <AreaChart data={charts.clicksOverTime} margin={{ top: 5, right: 20, left: -10, bottom: 0 }}>
                                            <defs>
                                                <linearGradient id="areaGrad" x1="0" y1="0" x2="0" y2="1">
                                                    <stop offset="0%" stopColor="#6366f1" stopOpacity={0.2} />
                                                    <stop offset="100%" stopColor="#6366f1" stopOpacity={0.01} />
                                                </linearGradient>
                                            </defs>
                                            <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                                            <XAxis dataKey="date" axisLine={false} tickLine={false}
                                                tick={{ fontSize: 11, fill: '#94a3b8' }}
                                                tickFormatter={(d: string) => d.slice(5)} />
                                            <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#94a3b8' }} />
                                            <Tooltip contentStyle={chartTooltipStyle} />
                                            <Area type="monotone" dataKey="count" stroke="#6366f1" strokeWidth={2.5}
                                                fill="url(#areaGrad)" dot={{ r: 4, fill: '#6366f1', strokeWidth: 2, stroke: '#fff' }}
                                                activeDot={{ r: 6 }} name="Lượt click" />
                                        </AreaChart>
                                    </ResponsiveContainer>
                                </div>
                            </ChartCard>
                        )}

                        {/* Quick pies */}
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                            <PieSection title="Nguồn truy cập" data={charts.bySource} icon={<Globe className="w-4 h-4 text-blue-500" />} />
                            <PieSection title="Thiết bị" data={charts.byDevice} icon={<Smartphone className="w-4 h-4 text-amber-500" />} />
                        </div>
                    </div>
                )}

                {/* ──────────── SOURCES ──────────── */}
                {tab === 'sources' && (
                    <div className="space-y-6">
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                            <PieSection title="Phân bố nguồn truy cập" data={charts.bySource} icon={<Globe className="w-4 h-4 text-blue-500" />} />
                            <BarSection title="Chi tiết nguồn (Top 10)" data={charts.bySource} icon={<Globe className="w-4 h-4 text-blue-500" />} color="#6366f1" />
                        </div>
                    </div>
                )}

                {/* ──────────── DEVICES ──────────── */}
                {tab === 'devices' && (
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
                        <PieSection title="Loại thiết bị" data={charts.byDevice} icon={<Smartphone className="w-4 h-4 text-amber-500" />} />
                        <PieSection title="Trình duyệt" data={charts.byBrowser} icon={<Monitor className="w-4 h-4 text-blue-500" />} />
                        <PieSection title="Hệ điều hành" data={charts.byOS} icon={<Monitor className="w-4 h-4 text-emerald-500" />} />
                    </div>
                )}

                {/* ──────────── LOCATION ──────────── */}
                {tab === 'location' && (
                    <div className="space-y-6">
                        {hasData(charts.byCity) || hasData(charts.byCountry) ? (
                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                                <BarSection title="Thành phố (Top 10)" data={charts.byCity} icon={<MapPin className="w-4 h-4 text-rose-500" />} color="#ec4899" />
                                <BarSection title="Quốc gia" data={charts.byCountry} icon={<Globe className="w-4 h-4 text-cyan-500" />} color="#06b6d4" />
                            </div>
                        ) : (
                            <ChartCard>
                                <EmptyChart
                                    icon={<MapPin className="w-5 h-5 text-slate-300" />}
                                    message="Chưa có dữ liệu vị trí. Dữ liệu thành phố/quốc gia sẽ được thu thập khi deploy trên Vercel hoặc khi IP geolocation API hoạt động."
                                />
                            </ChartCard>
                        )}
                    </div>
                )}

                {/* ──────────── TECHNICAL ──────────── */}
                {tab === 'technical' && (
                    <div className="space-y-6">
                        {/* Hour-of-day distribution */}
                        {charts.hourDistribution.length > 0 && (
                            <ChartCard>
                                <ChartTitle icon={<Clock className="w-4 h-4 text-indigo-500" />} title="Phân bố theo giờ trong ngày" />
                                <div className="h-[280px]">
                                    <ResponsiveContainer width="100%" height="100%">
                                        <BarChart data={charts.hourDistribution} margin={{ top: 5, right: 20, left: -10, bottom: 0 }}>
                                            <defs>
                                                <linearGradient id="hourGrad" x1="0" y1="0" x2="0" y2="1">
                                                    <stop offset="0%" stopColor="#6366f1" />
                                                    <stop offset="100%" stopColor="#a5b4fc" />
                                                </linearGradient>
                                            </defs>
                                            <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                                            <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#94a3b8' }} />
                                            <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#94a3b8' }} />
                                            <Tooltip contentStyle={chartTooltipStyle} />
                                            <Bar dataKey="value" fill="url(#hourGrad)" radius={[6, 6, 0, 0]} barSize={18} name="Lượt click" />
                                        </BarChart>
                                    </ResponsiveContainer>
                                </div>
                            </ChartCard>
                        )}

                        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
                            <PieSection title="Múi giờ" data={charts.byTimezone} icon={<Clock className="w-4 h-4 text-indigo-500" />} />
                            <PieSection title="Loại kết nối" data={charts.byNetwork} icon={<Wifi className="w-4 h-4 text-emerald-500" />} />
                            <PieSection title="Ngôn ngữ trình duyệt" data={charts.byLanguage} icon={<Languages className="w-4 h-4 text-violet-500" />} />
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
