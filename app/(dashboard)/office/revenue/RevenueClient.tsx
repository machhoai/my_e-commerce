'use client';

import { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import {
    AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
    XAxis, YAxis, CartesianGrid,
    Tooltip as RechartsTooltip, ResponsiveContainer, Legend,
} from 'recharts';
import {
    DollarSign, Banknote, TrendingUp, CalendarDays, Coins,
    Loader2, AlertTriangle, BarChart3, ArrowUpDown,
    CalendarRange, Calendar, Table2, Package, ShoppingBag, RefreshCw, Wifi, WifiOff,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { subscribeDocument } from '@/lib/firestore';
import { JOYWORLD_CACHE_COLLECTION, getCacheDocId, type RevenueCache, type RevenueRecord, type SellCategory } from '@/lib/revenue-cache';
import { fetchRevenueFromCache, triggerSyncAction } from './actions';

// ── Helpers ─────────────────────────────────────────────
function fmt(v: number) { return v.toLocaleString('vi-VN'); }
function fmtVND(v: number) { return v.toLocaleString('vi-VN', { style: 'currency', currency: 'VND' }); }
function fmtShort(v: number) {
    if (v >= 1_000_000_000) return `${(v / 1_000_000_000).toFixed(1)} tỷ`;
    if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(1)}M`;
    if (v >= 1_000) return `${(v / 1_000).toFixed(0)}K`;
    return fmt(v);
}
function todayStr() {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
function monthStart() {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`;
}
function fmtTime(iso: string) {
    try { return new Date(iso).toLocaleTimeString('vi-VN'); } catch { return iso; }
}

type FilterMode = 'day' | 'month' | 'custom';
type ViewTab = 'overview' | 'table';

// ── Sub-components ──────────────────────────────────────
function KPICard({ title, value, subtitle, icon, gradient }: {
    title: string; value: string; subtitle: string; icon: React.ReactNode; gradient: string;
}) {
    return (
        <Card className={`relative overflow-hidden border-0 shadow-md ${gradient}`}>
            <CardContent className="p-4">
                <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                        <p className="text-[11px] sm:text-xs font-medium text-white/70 truncate uppercase tracking-wide">{title}</p>
                        <p className="mt-1 text-lg sm:text-xl font-bold text-white tracking-tight truncate">{value}</p>
                        <p className="mt-0.5 text-[10px] sm:text-xs text-white/50 truncate">{subtitle}</p>
                    </div>
                    <div className="flex-shrink-0 w-9 h-9 rounded-lg bg-white/20 flex items-center justify-center">{icon}</div>
                </div>
            </CardContent>
        </Card>
    );
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function ChartTooltip({ active, payload, label }: any) {
    if (!active || !payload?.length) return null;
    return (
        <div className="bg-white rounded-xl shadow-xl border border-slate-200 px-4 py-3 min-w-[200px]">
            <p className="text-xs font-medium text-slate-500 mb-2">{label}</p>
            {payload.map((e: { name: string; value: number; color: string }, i: number) => (
                <div key={i} className="flex items-center justify-between gap-4 py-0.5">
                    <div className="flex items-center gap-1.5">
                        <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: e.color }} />
                        <span className="text-xs text-slate-600">{e.name}</span>
                    </div>
                    <span className="text-xs font-semibold text-slate-900">{fmtVND(e.value)}</span>
                </div>
            ))}
        </div>
    );
}

const PIE_COLORS = ['#3b82f6', '#8b5cf6', '#f59e0b', '#10b981', '#ec4899', '#06b6d4', '#f97316', '#84cc16'];

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function PieLabel({ cx, cy, midAngle, innerRadius, outerRadius, percent }: any) {
    const RADIAN = Math.PI / 180;
    const r = innerRadius + (outerRadius - innerRadius) * 0.5;
    const x = cx + r * Math.cos(-midAngle * RADIAN);
    const y = cy + r * Math.sin(-midAngle * RADIAN);
    if (percent < 0.04) return null;
    return (
        <text x={x} y={y} fill="white" textAnchor="middle" dominantBaseline="central" fontSize={11} fontWeight={600}>
            {(percent * 100).toFixed(0)}%
        </text>
    );
}

// ═══════════════════════════════════════════════════════
export default function RevenueClient() {
    const [filterMode, setFilterMode] = useState<FilterMode>('month');
    const [dayDate, setDayDate] = useState(todayStr());
    const [monthDate, setMonthDate] = useState(todayStr().slice(0, 7));
    const [customStart, setCustomStart] = useState(monthStart());
    const [customEnd, setCustomEnd] = useState(todayStr());
    const [viewTab, setViewTab] = useState<ViewTab>('overview');

    const [data, setData] = useState<RevenueRecord[]>([]);
    const [sellData, setSellData] = useState<SellCategory[]>([]);
    const [loading, setLoading] = useState(false);
    const [syncing, setSyncing] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [hasFetched, setHasFetched] = useState(false);
    const [activeRange, setActiveRange] = useState('');
    const [updatedAt, setUpdatedAt] = useState<string | null>(null);
    const [isListening, setIsListening] = useState(false);
    const unsubRef = useRef<(() => void) | null>(null);

    const getRange = useCallback(() => {
        if (filterMode === 'day') return { start: dayDate, end: dayDate };
        if (filterMode === 'month') {
            const [y, m] = monthDate.split('-').map(Number);
            const lastDay = new Date(y, m, 0).getDate();
            return { start: `${monthDate}-01`, end: `${monthDate}-${String(lastDay).padStart(2, '0')}` };
        }
        return { start: customStart, end: customEnd };
    }, [filterMode, dayDate, monthDate, customStart, customEnd]);

    // ── Initial fetch from server action (SSR-safe) ──
    const fetchInitial = useCallback(async () => {
        const { start, end } = getRange();
        setLoading(true);
        setError(null);
        try {
            const result = await fetchRevenueFromCache(start, end);
            if (!result.success) {
                setError(result.error || 'Đã xảy ra lỗi.');
                setData([]); setSellData([]);
            } else {
                setData(result.data);
                setSellData(result.sellData);
                setUpdatedAt(result.updatedAt);
            }
            setActiveRange(`${start} → ${end}`);
        } catch {
            setError('Không thể kết nối. Vui lòng thử lại.');
            setData([]); setSellData([]);
        } finally {
            setLoading(false);
            setHasFetched(true);
        }
    }, [getRange]);

    // ── Subscribe to Firestore cache for real-time updates ──
    useEffect(() => {
        // Cleanup previous subscription
        if (unsubRef.current) { unsubRef.current(); unsubRef.current = null; }

        const { start, end } = getRange();
        const docId = getCacheDocId(start, end);

        // Initial fetch
        fetchInitial();

        // Subscribe to real-time updates
        const unsub = subscribeDocument<RevenueCache>(
            JOYWORLD_CACHE_COLLECTION,
            docId,
            (cached) => {
                if (cached && cached.revenue) {
                    setData(cached.revenue);
                    setSellData(cached.sellData || []);
                    setUpdatedAt(cached.updatedAt || null);
                    setError(null);
                    setHasFetched(true);
                    setLoading(false);
                }
                setIsListening(true);
            }
        );

        unsubRef.current = unsub;
        return () => { unsub(); setIsListening(false); };
    }, [getRange]); // eslint-disable-line react-hooks/exhaustive-deps

    // ── Manual sync (force refresh from Joyworld) ──
    const handleManualSync = useCallback(async () => {
        const { start, end } = getRange();
        setSyncing(true);
        try {
            const result = await triggerSyncAction(start, end);
            if (!result.success) {
                setError(result.error || 'Đồng bộ thất bại.');
            }
            // Data will auto-update via onSnapshot after cache write
        } catch {
            setError('Đồng bộ thất bại.');
        } finally {
            setSyncing(false);
        }
    }, [getRange]);

    // ── KPIs ──
    const kpis = useMemo(() => {
        const totalReal = data.reduce((s, d) => s + d.realMoney, 0);
        const totalSys = data.reduce((s, d) => s + d.sysMoney, 0);
        const totalCash = data.reduce((s, d) => s + d.cashRealMoney, 0);
        const totalTransfer = data.reduce((s, d) => s + d.transferRealMoney, 0);
        const totalCoins = data.reduce((s, d) => s + d.sellCoinAmount, 0);
        const totalCashError = data.reduce((s, d) => s + d.cashErrorMoney, 0);
        const peakDay = data.length > 0 ? data.reduce((max, d) => d.realMoney > max.realMoney ? d : max, data[0]) : null;
        return { totalReal, totalSys, totalCash, totalTransfer, totalCoins, totalCashError, peakDay };
    }, [data]);

    // ── Chart data ──
    const chartData = useMemo(() =>
        [...data].sort((a, b) => a.forDate.localeCompare(b.forDate)).map(d => ({
            date: d.forDate.slice(5), 'Thực thu': d.realMoney, 'Tiền mặt': d.cashRealMoney, 'Chuyển khoản': d.transferRealMoney,
        })), [data]);
    const coinChartData = useMemo(() =>
        [...data].sort((a, b) => a.forDate.localeCompare(b.forDate)).map(d => ({
            date: d.forDate.slice(5), 'Xu bán': d.sellCoinAmount,
        })), [data]);
    const paymentPieData = useMemo(() => [
        { name: 'Tiền mặt', value: data.reduce((s, d) => s + d.cashRealMoney, 0) },
        { name: 'Chuyển khoản', value: data.reduce((s, d) => s + d.transferRealMoney, 0) },
    ].filter(d => d.value > 0), [data]);

    // ── Sell analytics ──
    const categoryPieData = useMemo(() =>
        sellData.filter(c => c.realMoney > 0).map(c => ({ name: c.goodsCategory, value: c.realMoney })), [sellData]);
    const topProducts = useMemo(() => {
        return sellData.flatMap(c => c.items).sort((a, b) => b.realMoney - a.realMoney).slice(0, 10);
    }, [sellData]);
    const topProductsByQty = useMemo(() => {
        return sellData.flatMap(c => c.items).sort((a, b) => b.realQty - a.realQty).slice(0, 10);
    }, [sellData]);

    // ── Styles ──
    const pillClass = (active: boolean) =>
        `px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer whitespace-nowrap ${active
            ? 'bg-indigo-600 text-white shadow-sm' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'}`;
    const tabClass = (active: boolean) =>
        `flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium transition-all cursor-pointer ${active
            ? 'bg-white text-slate-800 shadow-sm border border-slate-200' : 'text-slate-500 hover:text-slate-700 hover:bg-white/50'}`;

    const isMultiDay = data.length > 1;

    return (
        <div className="space-y-4 mx-auto animate-in fade-in duration-500">
            {/* ═══ HEADER ═══ */}
            <div className="flex flex-col gap-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div>
                        <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-800 flex items-center gap-2">
                            <BarChart3 className="size-5 sm:size-6 text-indigo-600" />
                            Quản lý Doanh thu
                        </h1>
                        <div className="flex items-center gap-2 mt-0.5">
                            {activeRange && (
                                <p className="text-slate-400 text-xs flex items-center gap-1">
                                    <CalendarDays className="size-3" /> {activeRange}
                                </p>
                            )}
                            {updatedAt && (
                                <span className="text-slate-300 text-xs">• Cập nhật {fmtTime(updatedAt)}</span>
                            )}
                            {isListening ? (
                                <span className="flex items-center gap-1 text-[10px] text-emerald-500 font-medium">
                                    <Wifi className="size-3" /> Live
                                </span>
                            ) : (
                                <span className="flex items-center gap-1 text-[10px] text-slate-400">
                                    <WifiOff className="size-3" />
                                </span>
                            )}
                            {(loading || syncing) && <Loader2 className="size-3 animate-spin text-indigo-400" />}
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        <button onClick={handleManualSync} disabled={syncing || loading}
                            className="p-1.5 rounded-lg text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 transition-all disabled:opacity-50"
                            title="Đồng bộ ngay từ Joyworld">
                            <RefreshCw className={`size-4 ${syncing ? 'animate-spin' : ''}`} />
                        </button>
                        <div className="flex items-center gap-1 bg-slate-50 rounded-xl p-1 border border-slate-200/60">
                            <button onClick={() => setViewTab('overview')} className={tabClass(viewTab === 'overview')}>
                                <BarChart3 className="size-3.5" /> Tổng quan
                            </button>
                            <button onClick={() => setViewTab('table')} className={tabClass(viewTab === 'table')}>
                                <Table2 className="size-3.5" /> Bảng dữ liệu
                            </button>
                        </div>
                    </div>
                </div>

                {/* Filter Bar */}
                <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 bg-white rounded-xl p-3 border border-slate-200/60 shadow-xs">
                    <div className="flex gap-1.5">
                        <button onClick={() => setFilterMode('day')} className={pillClass(filterMode === 'day')}>
                            <span className="flex items-center gap-1"><Calendar className="size-3" /> Ngày</span>
                        </button>
                        <button onClick={() => setFilterMode('month')} className={pillClass(filterMode === 'month')}>
                            <span className="flex items-center gap-1"><CalendarDays className="size-3" /> Tháng</span>
                        </button>
                        <button onClick={() => setFilterMode('custom')} className={pillClass(filterMode === 'custom')}>
                            <span className="flex items-center gap-1"><CalendarRange className="size-3" /> Tùy chọn</span>
                        </button>
                    </div>
                    <div className="flex items-center gap-2 flex-1 flex-wrap">
                        {filterMode === 'day' && (
                            <input type="date" value={dayDate} onChange={e => setDayDate(e.target.value)}
                                className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm text-slate-700 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none" />
                        )}
                        {filterMode === 'month' && (
                            <input type="month" value={monthDate} onChange={e => setMonthDate(e.target.value)}
                                className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm text-slate-700 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none" />
                        )}
                        {filterMode === 'custom' && (
                            <>
                                <input type="date" value={customStart} onChange={e => setCustomStart(e.target.value)}
                                    className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm text-slate-700 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none" />
                                <span className="text-slate-400 text-xs">→</span>
                                <input type="date" value={customEnd} onChange={e => setCustomEnd(e.target.value)}
                                    className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm text-slate-700 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none" />
                                <button onClick={handleManualSync} disabled={syncing || loading}
                                    className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-4 py-1.5 text-sm font-semibold text-white shadow-sm hover:bg-indigo-700 active:scale-[0.98] transition-all disabled:opacity-60">
                                    {syncing ? <Loader2 className="size-3.5 animate-spin" /> : <BarChart3 className="size-3.5" />}
                                    Xem
                                </button>
                            </>
                        )}
                    </div>
                </div>
            </div>

            {/* Error */}
            {error && (
                <div className="rounded-xl border border-red-200 bg-red-50 p-4 flex items-start gap-3">
                    <AlertTriangle className="size-5 text-red-500 flex-shrink-0 mt-0.5" />
                    <div>
                        <p className="text-sm font-medium text-red-800">Lỗi khi tải dữ liệu</p>
                        <p className="text-sm text-red-600 mt-0.5">{error}</p>
                    </div>
                </div>
            )}
            {loading && !hasFetched && (
                <div className="flex flex-col items-center justify-center py-20 gap-3 bg-white rounded-2xl border border-slate-200">
                    <div className="w-8 h-8 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin" />
                    <p className="text-slate-400 text-sm">Đang tải dữ liệu doanh thu...</p>
                </div>
            )}

            {/* ═══ DATA ═══ */}
            {hasFetched && !error && data.length > 0 && (
                <div className={(loading || syncing) ? 'opacity-50 pointer-events-none transition-opacity' : 'transition-opacity'}>
                    {/* KPI Cards */}
                    <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
                        <KPICard title="Tổng thu nhập" value={fmtVND(kpis.totalReal)}
                            subtitle={`Phải thu: ${fmtShort(kpis.totalSys)}`}
                            icon={<DollarSign className="size-4 text-white" />}
                            gradient="bg-gradient-to-br from-emerald-500 to-emerald-700" />
                        <KPICard title="Tiền mặt" value={fmtVND(kpis.totalCash)}
                            subtitle={kpis.totalCashError !== 0 ? `Lỗi: ${fmtVND(kpis.totalCashError)}` : 'Không có lỗi'}
                            icon={<Banknote className="size-4 text-white" />}
                            gradient="bg-gradient-to-br from-blue-500 to-blue-700" />
                        <KPICard title="Chuyển khoản" value={fmtVND(kpis.totalTransfer)}
                            subtitle={`${kpis.totalReal > 0 ? ((kpis.totalTransfer / kpis.totalReal) * 100).toFixed(1) : 0}% tổng thu`}
                            icon={<ArrowUpDown className="size-4 text-white" />}
                            gradient="bg-gradient-to-br from-violet-500 to-violet-700" />
                        <KPICard title="Xu bán" value={fmt(kpis.totalCoins)}
                            subtitle={`Đơn giá: ${fmtVND(data[0]?.sellCoinPrice || 0)}`}
                            icon={<Coins className="size-4 text-white" />}
                            gradient="bg-gradient-to-br from-amber-500 to-orange-600" />
                        <KPICard title="Ngày cao nhất" value={kpis.peakDay ? fmtShort(kpis.peakDay.realMoney) : '—'}
                            subtitle={kpis.peakDay?.forDate || 'N/A'}
                            icon={<TrendingUp className="size-4 text-white" />}
                            gradient="bg-gradient-to-br from-pink-500 to-rose-600" />
                    </div>

                    {/* ═══ TAB: OVERVIEW ═══ */}
                    {viewTab === 'overview' && (
                        <div className="space-y-4 mt-4">
                            <div className="grid gap-4 lg:grid-cols-3">
                                {isMultiDay ? (
                                    <Card className="p-4 border-slate-200 lg:col-span-2">
                                        <CardHeader className="pb-2">
                                            <div className="flex items-center justify-between">
                                                <div>
                                                    <CardTitle className="text-base font-semibold text-slate-800">Doanh thu theo ngày</CardTitle>
                                                    <CardDescription className="text-xs">Thực thu, tiền mặt và chuyển khoản</CardDescription>
                                                </div>
                                                <div className="text-right">
                                                    <p className="text-xl font-bold text-slate-800">{fmtShort(kpis.totalReal)}</p>
                                                    <p className="text-[10px] text-slate-400 uppercase tracking-wide">{data.length} ngày</p>
                                                </div>
                                            </div>
                                        </CardHeader>
                                        <CardContent>
                                            <div className="h-[280px] w-full">
                                                <ResponsiveContainer width="100%" height="100%">
                                                    <AreaChart data={chartData} margin={{ top: 5, right: 5, left: 0, bottom: 0 }}>
                                                        <defs>
                                                            <linearGradient id="gReal" x1="0" y1="0" x2="0" y2="1">
                                                                <stop offset="0%" stopColor="#10b981" stopOpacity={0.25} />
                                                                <stop offset="95%" stopColor="#10b981" stopOpacity={0.02} />
                                                            </linearGradient>
                                                            <linearGradient id="gCash" x1="0" y1="0" x2="0" y2="1">
                                                                <stop offset="0%" stopColor="#3b82f6" stopOpacity={0.15} />
                                                                <stop offset="95%" stopColor="#3b82f6" stopOpacity={0.02} />
                                                            </linearGradient>
                                                            <linearGradient id="gTrans" x1="0" y1="0" x2="0" y2="1">
                                                                <stop offset="0%" stopColor="#8b5cf6" stopOpacity={0.15} />
                                                                <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0.02} />
                                                            </linearGradient>
                                                        </defs>
                                                        <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                                                        <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#94a3b8' }} />
                                                        <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#94a3b8' }} tickFormatter={fmtShort} width={50} />
                                                        <RechartsTooltip content={<ChartTooltip />} />
                                                        <Legend iconType="circle" iconSize={7} wrapperStyle={{ fontSize: '11px', paddingTop: '8px' }} />
                                                        <Area type="monotone" dataKey="Thực thu" stroke="#10b981" strokeWidth={2.5} fill="url(#gReal)" dot={false} activeDot={{ r: 4, strokeWidth: 2, stroke: '#fff' }} />
                                                        <Area type="monotone" dataKey="Tiền mặt" stroke="#3b82f6" strokeWidth={1.5} fill="url(#gCash)" dot={false} activeDot={{ r: 3 }} />
                                                        <Area type="monotone" dataKey="Chuyển khoản" stroke="#8b5cf6" strokeWidth={1.5} fill="url(#gTrans)" dot={false} activeDot={{ r: 3 }} />
                                                    </AreaChart>
                                                </ResponsiveContainer>
                                            </div>
                                        </CardContent>
                                    </Card>
                                ) : (
                                    <Card className="p-4 border-slate-200 lg:col-span-2">
                                        <CardHeader className="pb-3">
                                            <CardTitle className="text-base font-semibold text-slate-800">Tổng kết ngày {data[0]?.forDate}</CardTitle>
                                        </CardHeader>
                                        <CardContent>
                                            <div className="grid grid-cols-2 gap-4">
                                                {[
                                                    { label: 'Thực thu', value: fmtVND(data[0]?.realMoney || 0), color: 'text-emerald-600' },
                                                    { label: 'Phải thu', value: fmtVND(data[0]?.sysMoney || 0), color: 'text-slate-700' },
                                                    { label: 'Bán hàng', value: fmtVND(data[0]?.saleSubMoney || 0), color: 'text-slate-600' },
                                                    { label: 'Tiền mặt', value: fmtVND(data[0]?.cashRealMoney || 0), color: 'text-blue-600' },
                                                    { label: 'Chuyển khoản', value: fmtVND(data[0]?.transferRealMoney || 0), color: 'text-violet-600' },
                                                    { label: 'Xu bán', value: fmt(data[0]?.sellCoinAmount || 0), color: 'text-amber-600' },
                                                ].map(item => (
                                                    <div key={item.label} className="bg-slate-50 rounded-xl p-3">
                                                        <p className="text-[11px] text-slate-400 uppercase tracking-wide font-medium">{item.label}</p>
                                                        <p className={`text-lg font-bold mt-0.5 ${item.color}`}>{item.value}</p>
                                                    </div>
                                                ))}
                                            </div>
                                        </CardContent>
                                    </Card>
                                )}

                                <Card className="p-4 border-slate-200">
                                    <CardHeader className="pb-2">
                                        <CardTitle className="text-base font-semibold text-slate-800">Phương thức thanh toán</CardTitle>
                                        <CardDescription className="text-xs">Tỉ lệ tiền mặt vs chuyển khoản</CardDescription>
                                    </CardHeader>
                                    <CardContent>
                                        <div className="h-[180px] w-full">
                                            <ResponsiveContainer width="100%" height="100%">
                                                <PieChart>
                                                    <Pie data={paymentPieData} cx="50%" cy="50%" innerRadius={50} outerRadius={80}
                                                        paddingAngle={3} dataKey="value" labelLine={false} label={PieLabel}>
                                                        {paymentPieData.map((_, i) => <Cell key={i} fill={PIE_COLORS[i]} />)}
                                                    </Pie>
                                                    <RechartsTooltip contentStyle={{ borderRadius: '10px', border: 'none', boxShadow: '0 4px 12px rgb(0 0 0 / 0.1)', fontSize: '12px' }} />
                                                </PieChart>
                                            </ResponsiveContainer>
                                        </div>
                                        <div className="flex flex-col gap-2 mt-1">
                                            {paymentPieData.map((item, i) => (
                                                <div key={item.name} className="flex items-center justify-between">
                                                    <div className="flex items-center gap-2">
                                                        <div className="w-3 h-3 rounded-full" style={{ backgroundColor: PIE_COLORS[i] }} />
                                                        <span className="text-xs font-medium text-slate-600">{item.name}</span>
                                                    </div>
                                                    <span className="text-xs font-bold text-slate-800">{fmtVND(item.value)}</span>
                                                </div>
                                            ))}
                                        </div>
                                    </CardContent>
                                </Card>
                            </div>

                            {isMultiDay && coinChartData.length > 1 && (
                                <Card className="p-4 border-slate-200">
                                    <CardHeader className="pb-2">
                                        <div className="flex items-center justify-between">
                                            <div>
                                                <CardTitle className="text-base font-semibold text-slate-800">Xu bán hàng ngày</CardTitle>
                                                <CardDescription className="text-xs">Số lượng xu bán theo từng ngày</CardDescription>
                                            </div>
                                            <div className="text-right">
                                                <p className="text-xl font-bold text-amber-600">{fmt(kpis.totalCoins)}</p>
                                                <p className="text-[10px] text-slate-400 uppercase tracking-wide">Tổng xu</p>
                                            </div>
                                        </div>
                                    </CardHeader>
                                    <CardContent>
                                        <div className="h-[200px] w-full">
                                            <ResponsiveContainer width="100%" height="100%">
                                                <BarChart data={coinChartData} margin={{ top: 5, right: 5, left: 0, bottom: 0 }}>
                                                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                                                    <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#94a3b8' }} />
                                                    <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#94a3b8' }} tickFormatter={fmtShort} width={45} />
                                                    <RechartsTooltip cursor={{ fill: '#f8fafc' }} contentStyle={{ borderRadius: '10px', border: '1px solid #e2e8f0', fontSize: '12px' }} />
                                                    <Bar dataKey="Xu bán" fill="#f59e0b" radius={[4, 4, 0, 0]} barSize={24} />
                                                </BarChart>
                                            </ResponsiveContainer>
                                        </div>
                                    </CardContent>
                                </Card>
                            )}

                            {/* Product Analytics */}
                            {sellData.length > 0 && (
                                <>
                                    <div className="flex items-center gap-3 pt-2">
                                        <div className="flex items-center gap-2">
                                            <ShoppingBag className="size-4 text-indigo-500" />
                                            <h2 className="text-sm font-bold text-slate-700 uppercase tracking-wide">Phân tích sản phẩm</h2>
                                        </div>
                                        <div className="flex-1 h-px bg-slate-200" />
                                    </div>

                                    <div className="grid gap-4 lg:grid-cols-3">
                                        <Card className="p-4 border-slate-200">
                                            <CardHeader className="pb-2">
                                                <CardTitle className="text-base font-semibold text-slate-800">Doanh thu theo danh mục</CardTitle>
                                                <CardDescription className="text-xs">Phân bổ doanh thu giữa các nhóm</CardDescription>
                                            </CardHeader>
                                            <CardContent>
                                                <div className="h-[200px] w-full">
                                                    <ResponsiveContainer width="100%" height="100%">
                                                        <PieChart>
                                                            <Pie data={categoryPieData} cx="50%" cy="50%" innerRadius={50} outerRadius={85}
                                                                paddingAngle={2} dataKey="value" labelLine={false} label={PieLabel}>
                                                                {categoryPieData.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                                                            </Pie>
                                                            <RechartsTooltip contentStyle={{ borderRadius: '10px', border: 'none', boxShadow: '0 4px 12px rgb(0 0 0 / 0.1)', fontSize: '12px' }} />
                                                        </PieChart>
                                                    </ResponsiveContainer>
                                                </div>
                                                <div className="flex flex-col gap-2 mt-2">
                                                    {categoryPieData.map((item, i) => (
                                                        <div key={item.name} className="flex items-center justify-between">
                                                            <div className="flex items-center gap-2">
                                                                <div className="w-3 h-3 rounded-full" style={{ backgroundColor: PIE_COLORS[i % PIE_COLORS.length] }} />
                                                                <span className="text-xs font-medium text-slate-600 truncate max-w-[130px]">{item.name}</span>
                                                            </div>
                                                            <span className="text-xs font-bold text-slate-800">{fmtVND(item.value)}</span>
                                                        </div>
                                                    ))}
                                                </div>
                                            </CardContent>
                                        </Card>

                                        <Card className="p-4 border-slate-200 lg:col-span-2">
                                            <CardHeader className="pb-2">
                                                <div className="flex items-center justify-between">
                                                    <div>
                                                        <CardTitle className="text-base font-semibold text-slate-800">Top sản phẩm theo doanh thu</CardTitle>
                                                        <CardDescription className="text-xs">10 sản phẩm đem lại doanh thu cao nhất</CardDescription>
                                                    </div>
                                                    <Package className="size-5 text-slate-300" />
                                                </div>
                                            </CardHeader>
                                            <CardContent>
                                                <div className="h-[320px] w-full">
                                                    <ResponsiveContainer width="100%" height="100%">
                                                        <BarChart data={topProducts.map(p => ({ name: p.goodsName.length > 22 ? p.goodsName.slice(0, 22) + '…' : p.goodsName, 'Doanh thu': p.realMoney }))}
                                                            layout="vertical" margin={{ top: 0, right: 10, left: 0, bottom: 0 }}>
                                                            <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} stroke="#f1f5f9" />
                                                            <XAxis type="number" hide />
                                                            <YAxis dataKey="name" type="category" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#475569' }} width={155} />
                                                            <RechartsTooltip content={<ChartTooltip />} />
                                                            <Bar dataKey="Doanh thu" fill="#6366f1" radius={[0, 6, 6, 0]} barSize={18} />
                                                        </BarChart>
                                                    </ResponsiveContainer>
                                                </div>
                                            </CardContent>
                                        </Card>
                                    </div>

                                    <Card className="p-4 border-slate-200">
                                        <CardHeader className="pb-2">
                                            <div className="flex items-center justify-between">
                                                <div>
                                                    <CardTitle className="text-base font-semibold text-slate-800">Top sản phẩm theo số lượng</CardTitle>
                                                    <CardDescription className="text-xs">Sản phẩm bán chạy nhất theo số lượng thực bán</CardDescription>
                                                </div>
                                                <ShoppingBag className="size-5 text-slate-300" />
                                            </div>
                                        </CardHeader>
                                        <CardContent>
                                            <div className="h-[300px] w-full">
                                                <ResponsiveContainer width="100%" height="100%">
                                                    <BarChart data={topProductsByQty.map(p => ({ name: p.goodsName.length > 18 ? p.goodsName.slice(0, 18) + '…' : p.goodsName, 'Số lượng': p.realQty }))}
                                                        margin={{ top: 5, right: 5, left: 0, bottom: 0 }}>
                                                        <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                                                        <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#94a3b8' }} angle={-25} textAnchor="end" height={70} />
                                                        <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#94a3b8' }} />
                                                        <RechartsTooltip cursor={{ fill: '#f8fafc' }} contentStyle={{ borderRadius: '10px', border: '1px solid #e2e8f0', fontSize: '12px' }} />
                                                        <Bar dataKey="Số lượng" fill="#06b6d4" radius={[4, 4, 0, 0]} barSize={28} />
                                                    </BarChart>
                                                </ResponsiveContainer>
                                            </div>
                                        </CardContent>
                                    </Card>

                                    <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
                                        {sellData.filter(c => c.realMoney > 0).map((cat) => (
                                            <Card key={cat.goodsCategory} className="border-slate-200 overflow-hidden">
                                                <CardHeader className="p-3 pb-1.5 bg-slate-50/50">
                                                    <CardTitle className="text-sm font-semibold text-slate-700 truncate">{cat.goodsCategory}</CardTitle>
                                                    <CardDescription className="text-xs">
                                                        {fmt(cat.realQty)} SP | {fmtVND(cat.realMoney)}
                                                        {cat.cancelQty > 0 && <span className="text-red-500 ml-1">(Hủy: {fmt(cat.cancelQty)})</span>}
                                                    </CardDescription>
                                                </CardHeader>
                                                <CardContent className="p-0">
                                                    <div className="divide-y divide-slate-50">
                                                        {cat.items.filter(item => item.realMoney > 0).sort((a, b) => b.realMoney - a.realMoney).slice(0, 5).map((item) => (
                                                            <div key={item.goodsName} className="flex items-center justify-between px-3 py-2 hover:bg-slate-50/50 transition-colors">
                                                                <div className="min-w-0 flex-1 pr-2">
                                                                    <p className="text-xs font-medium text-slate-700 truncate">{item.goodsName}</p>
                                                                    <p className="text-[10px] text-slate-400">SL: {fmt(item.realQty)}{item.sellRatio > 0 ? ` | ${(item.sellRatio * 100).toFixed(1)}%` : ''}</p>
                                                                </div>
                                                                <span className="text-xs font-bold text-slate-800 whitespace-nowrap">{fmtShort(item.realMoney)}</span>
                                                            </div>
                                                        ))}
                                                        {cat.items.filter(item => item.realMoney > 0).length > 5 && (
                                                            <div className="px-3 py-1.5 text-center text-[10px] text-slate-400">
                                                                +{cat.items.filter(item => item.realMoney > 0).length - 5} sản phẩm khác
                                                            </div>
                                                        )}
                                                    </div>
                                                </CardContent>
                                            </Card>
                                        ))}
                                    </div>
                                </>
                            )}
                        </div>
                    )}

                    {/* ═══ TAB: TABLE ═══ */}
                    {viewTab === 'table' && (
                        <Card className="border-slate-200 overflow-hidden mt-4">
                            <CardHeader className="p-4 pb-2">
                                <CardTitle className="text-base font-semibold text-slate-800">Chi tiết doanh thu</CardTitle>
                                <CardDescription>{data.length} bản ghi — {activeRange}</CardDescription>
                            </CardHeader>
                            <CardContent className="p-0">
                                <div className="overflow-x-auto">
                                    <table className="w-full text-sm">
                                        <thead>
                                            <tr className="border-b border-slate-100 bg-slate-50/80">
                                                <th className="text-left px-3 py-2.5 font-semibold text-slate-600 whitespace-nowrap sticky left-0 bg-slate-50/80 z-10">Ngày</th>
                                                <th className="text-right px-3 py-2.5 font-semibold text-slate-600 whitespace-nowrap">Thực thu</th>
                                                <th className="text-right px-3 py-2.5 font-semibold text-slate-600 whitespace-nowrap">Phải thu</th>
                                                <th className="text-right px-3 py-2.5 font-semibold text-slate-600 whitespace-nowrap">Bán hàng</th>
                                                <th className="text-right px-3 py-2.5 font-semibold text-slate-600 whitespace-nowrap">Tiền mặt</th>
                                                <th className="text-right px-3 py-2.5 font-semibold text-slate-600 whitespace-nowrap">Lỗi TM</th>
                                                <th className="text-right px-3 py-2.5 font-semibold text-slate-600 whitespace-nowrap">Chuyển khoản</th>
                                                <th className="text-right px-3 py-2.5 font-semibold text-slate-600 whitespace-nowrap">Xu bán</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {[...data].sort((a, b) => b.forDate.localeCompare(a.forDate)).map((row) => (
                                                <tr key={row.forDate} className="border-b border-slate-50 hover:bg-indigo-50/40 transition-colors">
                                                    <td className="px-3 py-2.5 font-medium text-slate-700 whitespace-nowrap sticky left-0 bg-white z-10">{row.forDate}</td>
                                                    <td className="px-3 py-2.5 text-right font-semibold text-emerald-700 whitespace-nowrap">{fmtVND(row.realMoney)}</td>
                                                    <td className="px-3 py-2.5 text-right text-slate-600 whitespace-nowrap">{fmtVND(row.sysMoney)}</td>
                                                    <td className="px-3 py-2.5 text-right text-slate-600 whitespace-nowrap">{fmtVND(row.saleSubMoney)}</td>
                                                    <td className="px-3 py-2.5 text-right text-blue-700 whitespace-nowrap">{fmtVND(row.cashRealMoney)}</td>
                                                    <td className={`px-3 py-2.5 text-right whitespace-nowrap font-medium ${row.cashErrorMoney !== 0 ? (row.cashErrorMoney > 0 ? 'text-amber-600' : 'text-red-600') : 'text-slate-400'}`}>
                                                        {row.cashErrorMoney !== 0 ? fmtVND(row.cashErrorMoney) : '—'}
                                                    </td>
                                                    <td className="px-3 py-2.5 text-right text-violet-700 whitespace-nowrap">{fmtVND(row.transferRealMoney)}</td>
                                                    <td className="px-3 py-2.5 text-right text-amber-700 whitespace-nowrap">{fmt(row.sellCoinAmount)}</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                        <tfoot>
                                            <tr className="bg-slate-50/80 border-t-2 border-slate-200">
                                                <td className="px-3 py-3 font-bold text-slate-700 sticky left-0 bg-slate-50/80 z-10">Tổng cộng</td>
                                                <td className="px-3 py-3 text-right font-bold text-emerald-700">{fmtVND(kpis.totalReal)}</td>
                                                <td className="px-3 py-3 text-right font-bold text-slate-700">{fmtVND(kpis.totalSys)}</td>
                                                <td className="px-3 py-3 text-right font-bold text-slate-700">{fmtVND(data.reduce((s, d) => s + d.saleSubMoney, 0))}</td>
                                                <td className="px-3 py-3 text-right font-bold text-blue-700">{fmtVND(kpis.totalCash)}</td>
                                                <td className={`px-3 py-3 text-right font-bold ${kpis.totalCashError !== 0 ? (kpis.totalCashError > 0 ? 'text-amber-600' : 'text-red-600') : 'text-slate-400'}`}>
                                                    {kpis.totalCashError !== 0 ? fmtVND(kpis.totalCashError) : '—'}
                                                </td>
                                                <td className="px-3 py-3 text-right font-bold text-violet-700">{fmtVND(kpis.totalTransfer)}</td>
                                                <td className="px-3 py-3 text-right font-bold text-amber-700">{fmt(kpis.totalCoins)}</td>
                                            </tr>
                                        </tfoot>
                                    </table>
                                </div>
                            </CardContent>
                        </Card>
                    )}
                </div>
            )}

            {/* Empty */}
            {!loading && hasFetched && !error && data.length === 0 && (
                <div className="flex flex-col items-center justify-center py-16 gap-3 bg-white rounded-2xl border border-slate-200">
                    <BarChart3 className="size-10 text-slate-300" />
                    <p className="text-slate-500 font-medium">Không có dữ liệu cho khoảng thời gian này</p>
                    <p className="text-sm text-slate-400">Nhấn <RefreshCw className="size-3 inline" /> để đồng bộ từ Joyworld.</p>
                </div>
            )}
        </div>
    );
}
