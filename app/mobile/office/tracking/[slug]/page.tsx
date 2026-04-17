'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import {
    BarChart, Bar, PieChart, Pie, Cell, LineChart, Line,
    XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts';
import {
    ArrowLeft, MousePointerClick, Users, Globe, Smartphone,
    Monitor, MapPin, Languages, Clock, Wifi, Download,
    Loader2, ExternalLink, Copy, Check, Link as LinkIcon,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuth } from '@/contexts/AuthContext';
import MobilePageShell from '@/components/mobile/MobilePageShell';
import { useMobileTranslation } from '@/lib/i18n';

// ── Types ────────────────────────────────────────────────────────────────────

interface ChartItem { name: string; value: number }
interface TimeItem { date: string; count: number }

interface DetailData {
    link: { slug: string; targetUrl: string; campaignName: string; active: boolean; createdAt: string };
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

const BASE_URL = 'joyworld.vn';
const PALETTE = ['#6366f1', '#10b981', '#f59e0b', '#06b6d4', '#ec4899', '#8b5cf6', '#f97316', '#14b8a6', '#ef4444', '#84cc16'];
const fmt = (n: number) => n.toLocaleString('vi-VN');

type Tab = 'overview' | 'sources' | 'devices' | 'location' | 'technical';
const TABS: { key: Tab; label: string; icon: React.ReactNode }[] = [
    { key: 'overview', label: 'Tổng quan', icon: <MousePointerClick className="w-3 h-3" /> },
    { key: 'sources', label: 'Nguồn', icon: <Globe className="w-3 h-3" /> },
    { key: 'devices', label: 'Thiết bị', icon: <Monitor className="w-3 h-3" /> },
    { key: 'location', label: 'Vị trí', icon: <MapPin className="w-3 h-3" /> },
    { key: 'technical', label: 'Kỹ thuật', icon: <Clock className="w-3 h-3" /> },
];

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function PieLabel({ cx, cy, midAngle, innerRadius, outerRadius, percent }: any) {
    if (percent < 0.07) return null;
    const RADIAN = Math.PI / 180;
    const r = innerRadius + (outerRadius - innerRadius) * 0.5;
    return (
        <text x={cx + r * Math.cos(-midAngle * RADIAN)} y={cy + r * Math.sin(-midAngle * RADIAN)}
            fill="white" textAnchor="middle" dominantBaseline="central" fontSize={9} fontWeight={700}>
            {(percent * 100).toFixed(0)}%
        </text>
    );
}

function hasData(data: ChartItem[]) {
    return data.length > 0 && !(data.length === 1 && data[0].name === 'Không rõ');
}

function MobilePie({ title, data, icon }: { title: string; data: ChartItem[]; icon: React.ReactNode }) {
    if (!hasData(data)) return null;
    const total = data.reduce((s, d) => s + d.value, 0);
    return (
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-3">
            <h3 className="text-[11px] font-bold text-gray-700 flex items-center gap-1.5 mb-2">{icon}{title}</h3>
            <div className="flex items-center gap-3">
                <div className="w-[110px] h-[110px] shrink-0">
                    <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                            <Pie data={data} cx="50%" cy="50%" innerRadius={28} outerRadius={50}
                                paddingAngle={2} dataKey="value" labelLine={false} label={PieLabel}>
                                {data.map((_, i) => <Cell key={i} fill={PALETTE[i % PALETTE.length]} />)}
                            </Pie>
                        </PieChart>
                    </ResponsiveContainer>
                </div>
                <div className="flex-1 space-y-1 max-h-[110px] overflow-y-auto">
                    {data.slice(0, 6).map((item, i) => (
                        <div key={item.name} className="flex items-center justify-between text-[10px]">
                            <div className="flex items-center gap-1.5 min-w-0">
                                <div className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: PALETTE[i % PALETTE.length] }} />
                                <span className="text-gray-600 truncate">{item.name}</span>
                            </div>
                            <span className="shrink-0 font-bold text-gray-800 ml-1">{total > 0 ? `${((item.value / total) * 100).toFixed(0)}%` : ''}</span>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}

function MobileBar({ title, data, icon, color = '#6366f1' }: { title: string; data: ChartItem[]; icon: React.ReactNode; color?: string }) {
    if (!data.length || (data.length === 1 && data[0].name === 'Không rõ')) return null;
    const top8 = data.slice(0, 8);
    return (
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-3">
            <h3 className="text-[11px] font-bold text-gray-700 flex items-center gap-1.5 mb-2">{icon}{title}</h3>
            <div className="h-[200px]">
                <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={top8} layout="vertical" margin={{ top: 0, right: 10, left: -5, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" horizontal={false} />
                        <XAxis type="number" axisLine={false} tickLine={false} tick={{ fontSize: 9, fill: '#94a3b8' }} />
                        <YAxis dataKey="name" type="category" axisLine={false} tickLine={false} tick={{ fontSize: 9, fill: '#64748b' }} width={80} />
                        <Tooltip contentStyle={{ borderRadius: 8, border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)', fontSize: 10 }} />
                        <Bar dataKey="value" fill={color} radius={[0, 4, 4, 0]} barSize={14} />
                    </BarChart>
                </ResponsiveContainer>
            </div>
        </div>
    );
}

// ─────────────────────────────────────────────────────────────────────────────
// Page
// ─────────────────────────────────────────────────────────────────────────────

export default function MobileTrackingDetailPage() {
    const { user } = useAuth();
    const router = useRouter();
    const params = useParams();
    const slug = params.slug as string;
    const { t } = useMobileTranslation();

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
        } catch (err) { console.error(err); }
        finally { setLoading(false); }
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
            a.download = `tracking_${slug}.xlsx`;
            a.click();
            URL.revokeObjectURL(url);
        } catch (err) { console.error(err); }
        finally { setExporting(false); }
    };

    const copyShortUrl = async () => {
        try {
            await navigator.clipboard.writeText(`https://${BASE_URL}/r/${slug}`);
            setCopiedSlug(true);
            setTimeout(() => setCopiedSlug(false), 2000);
        } catch { }
    };

    return (
        <MobilePageShell title={data?.link.campaignName || t('common.viewDetails')} headerRight={
            <div className="flex items-center gap-1.5">
                <button onClick={handleExport} disabled={exporting}
                    className="w-8 h-8 rounded-lg bg-emerald-600 flex items-center justify-center active:scale-95 transition-transform disabled:opacity-50">
                    {exporting ? <Loader2 className="w-4 h-4 text-white animate-spin" /> : <Download className="w-4 h-4 text-white" />}
                </button>
            </div>
        }>
            {loading && (
                <div className="flex flex-col items-center py-16">
                    <Loader2 className="w-7 h-7 text-indigo-500 animate-spin mb-2" />
                    <p className="text-xs text-gray-500">Đang tải...</p>
                </div>
            )}

            {!loading && data && (() => {
                const { link, stats, charts } = data;
                return (
                    <>
                        {/* Link info */}
                        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-3 mb-3">
                            <div className="flex items-center gap-1.5 mb-1.5">
                                <LinkIcon className="w-3 h-3 text-indigo-400" />
                                <code className="text-[10px] font-mono text-indigo-600 flex-1 truncate">{BASE_URL}/r/{slug}</code>
                                <button onClick={copyShortUrl} className="text-indigo-500">
                                    {copiedSlug ? <Check className="w-3 h-3 text-emerald-500" /> : <Copy className="w-3 h-3" />}
                                </button>
                            </div>
                            <a href={link.targetUrl} target="_blank" rel="noopener noreferrer"
                                className="text-[9px] text-gray-400 flex items-center gap-0.5">
                                <ExternalLink className="w-2.5 h-2.5" />
                                {link.targetUrl.length > 40 ? link.targetUrl.slice(0, 40) + '…' : link.targetUrl}
                            </a>
                        </div>

                        {/* Tabs */}
                        <div className="flex gap-0.5 bg-gray-100 rounded-lg p-0.5 mb-3 overflow-x-auto">
                            {TABS.map(t => (
                                <button key={t.key} onClick={() => setTab(t.key)}
                                    className={cn(
                                        'flex-1 flex items-center justify-center gap-1 py-1.5 rounded-md text-[10px] font-bold whitespace-nowrap transition-all min-w-[60px]',
                                        tab === t.key ? 'bg-white text-indigo-700 shadow-sm' : 'text-gray-500',
                                    )}>
                                    {t.icon}{t.label}
                                </button>
                            ))}
                        </div>

                        {/* ── OVERVIEW ── */}
                        {tab === 'overview' && (
                            <div className="space-y-2.5">
                                <div className="grid grid-cols-2 gap-2">
                                    <div className="bg-gradient-to-br from-indigo-600 to-indigo-800 rounded-xl p-3 text-white">
                                        <div className="flex items-center justify-between mb-1">
                                            <span className="text-[8px] font-bold uppercase text-indigo-200">Tổng Click</span>
                                            <MousePointerClick className="w-3.5 h-3.5 text-indigo-200" />
                                        </div>
                                        <p className="text-xl font-black">{fmt(stats.totalClicks)}</p>
                                    </div>
                                    <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-3">
                                        <div className="flex items-center justify-between mb-1">
                                            <span className="text-[8px] font-bold uppercase text-gray-400">IP duy nhất</span>
                                            <Users className="w-3.5 h-3.5 text-blue-500" />
                                        </div>
                                        <p className="text-xl font-black text-gray-800">{fmt(stats.uniqueIps)}</p>
                                    </div>
                                </div>

                                {charts.clicksOverTime.length > 1 && (
                                    <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-3">
                                        <h3 className="text-[11px] font-bold text-gray-700 mb-2">Click theo ngày</h3>
                                        <div className="h-[160px]">
                                            <ResponsiveContainer width="100%" height="100%">
                                                <LineChart data={charts.clicksOverTime} margin={{ top: 5, right: 10, left: -15, bottom: 0 }}>
                                                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                                                    <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{ fontSize: 9, fill: '#94a3b8' }}
                                                        tickFormatter={(d: string) => d.slice(5)} />
                                                    <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 9, fill: '#94a3b8' }} />
                                                    <Line type="monotone" dataKey="count" stroke="#6366f1" strokeWidth={2} dot={{ r: 2, fill: '#6366f1' }} />
                                                </LineChart>
                                            </ResponsiveContainer>
                                        </div>
                                    </div>
                                )}

                                <MobilePie title="Nguồn truy cập" data={charts.bySource} icon={<Globe className="w-3 h-3 text-blue-500" />} />
                                <MobilePie title="Thiết bị" data={charts.byDevice} icon={<Smartphone className="w-3 h-3 text-amber-500" />} />
                            </div>
                        )}

                        {/* ── SOURCES ── */}
                        {tab === 'sources' && (
                            <div className="space-y-2.5">
                                <MobilePie title="Nguồn truy cập" data={charts.bySource} icon={<Globe className="w-3 h-3 text-blue-500" />} />
                                <MobileBar title="Top nguồn" data={charts.bySource} icon={<Globe className="w-3 h-3 text-blue-500" />} />
                            </div>
                        )}

                        {/* ── DEVICES ── */}
                        {tab === 'devices' && (
                            <div className="space-y-2.5">
                                <MobilePie title="Thiết bị" data={charts.byDevice} icon={<Smartphone className="w-3 h-3 text-amber-500" />} />
                                <MobilePie title="Trình duyệt" data={charts.byBrowser} icon={<Monitor className="w-3 h-3 text-blue-500" />} />
                                <MobilePie title="Hệ điều hành" data={charts.byOS} icon={<Monitor className="w-3 h-3 text-emerald-500" />} />
                            </div>
                        )}

                        {/* ── LOCATION ── */}
                        {tab === 'location' && (
                            <div className="space-y-2.5">
                                {hasData(charts.byCity) || hasData(charts.byCountry) ? (
                                    <>
                                        <MobileBar title="Thành phố" data={charts.byCity} icon={<MapPin className="w-3 h-3 text-rose-500" />} color="#ec4899" />
                                        <MobileBar title="Quốc gia" data={charts.byCountry} icon={<Globe className="w-3 h-3 text-blue-500" />} color="#06b6d4" />
                                    </>
                                ) : (
                                    <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6 text-center">
                                        <MapPin className="w-6 h-6 text-gray-300 mx-auto mb-2" />
                                        <p className="text-[11px] text-gray-400 font-medium">Chưa có dữ liệu vị trí.<br/>Dữ liệu sẽ có khi deploy trên Vercel.</p>
                                    </div>
                                )}
                            </div>
                        )}

                        {/* ── TECHNICAL ── */}
                        {tab === 'technical' && (
                            <div className="space-y-2.5">
                                {charts.hourDistribution.length > 0 && (
                                    <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-3">
                                        <h3 className="text-[11px] font-bold text-gray-700 flex items-center gap-1.5 mb-2">
                                            <Clock className="w-3 h-3 text-indigo-500" />Phân bố theo giờ
                                        </h3>
                                        <div className="h-[180px]">
                                            <ResponsiveContainer width="100%" height="100%">
                                                <BarChart data={charts.hourDistribution} margin={{ top: 5, right: 10, left: -15, bottom: 0 }}>
                                                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                                                    <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 8, fill: '#94a3b8' }} />
                                                    <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 9, fill: '#94a3b8' }} />
                                                    <Bar dataKey="value" fill="#6366f1" radius={[3, 3, 0, 0]} barSize={12} />
                                                </BarChart>
                                            </ResponsiveContainer>
                                        </div>
                                    </div>
                                )}
                                <MobilePie title="Múi giờ" data={charts.byTimezone} icon={<Clock className="w-3 h-3 text-indigo-500" />} />
                                <MobilePie title="Loại mạng" data={charts.byNetwork} icon={<Wifi className="w-3 h-3 text-emerald-500" />} />
                                <MobilePie title="Ngôn ngữ" data={charts.byLanguage} icon={<Languages className="w-3 h-3 text-violet-500" />} />
                            </div>
                        )}
                    </>
                );
            })()}
        </MobilePageShell>
    );
}
