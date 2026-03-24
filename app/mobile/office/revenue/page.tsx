'use client';

import { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import {
    AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
    XAxis, YAxis, CartesianGrid,
    Tooltip as RechartsTooltip, ResponsiveContainer,
} from 'recharts';
import {
    TrendingUp, CalendarDays, Coins, Loader2, AlertTriangle, BarChart3,
    Calendar, Package, ShoppingBag, RefreshCw,
    Wifi, WifiOff, Banknote, ArrowUpDown, DollarSign, XCircle, Clock,
    ChevronLeft, ChevronRight, ChevronDown, Table2, ShoppingCart,
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { subscribeDocument } from '@/lib/firestore';
import { JOYWORLD_CACHE_COLLECTION, getCacheDocId, type RevenueCache, type RevenueRecord, type SellCategory, type DailyPanel } from '@/lib/revenue-cache';
import { fetchRevenueFromCache, triggerSyncAction } from '@/app/desktop/(dashboard)/office/revenue/actions';
import MobileOrdersPanel from '@/components/mobile/MobileOrdersPanel';
import MobilePageShell from '@/components/mobile/MobilePageShell';
import BottomSheet from '@/components/shared/BottomSheet';
import { cn } from '@/lib/utils';

// ── Helpers ─────────────────────────────────────────────────────────────────
const fmt = (v: number) => v.toLocaleString('vi-VN');
const fmtVND = (v: number) => v.toLocaleString('vi-VN', { style: 'currency', currency: 'VND' });
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
    try { return new Date(iso).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }); } catch { return iso; }
}

type FilterMode = 'day' | 'month' | 'custom';
type ViewTab = 'overview' | 'table' | 'orders';
const PALETTE = ['#6366f1', '#10b981', '#f59e0b', '#06b6d4', '#ec4899', '#8b5cf6', '#f97316', '#14b8a6'];

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function PieLabel({ cx, cy, midAngle, innerRadius, outerRadius, percent }: any) {
    if (percent < 0.05) return null;
    const RADIAN = Math.PI / 180;
    const r = innerRadius + (outerRadius - innerRadius) * 0.5;
    return (
        <text x={cx + r * Math.cos(-midAngle * RADIAN)} y={cy + r * Math.sin(-midAngle * RADIAN)}
            fill="white" textAnchor="middle" dominantBaseline="central" fontSize={10} fontWeight={700}>
            {(percent * 100).toFixed(0)}%
        </text>
    );
}

// ═══════════════════════════════════════════════════════════════════════════
export default function MobileOfficeRevenuePage() {
    const { userDoc, hasPermission } = useAuth();

    const [filterMode, setFilterMode] = useState<FilterMode>('day');
    const [dayDate, setDayDate] = useState(todayStr());
    const [monthDate, setMonthDate] = useState(todayStr().slice(0, 7));
    const [customStart, setCustomStart] = useState(monthStart());
    const [customEnd, setCustomEnd] = useState(todayStr());
    const [filterSheetOpen, setFilterSheetOpen] = useState(false);
    const [viewTab, setViewTab] = useState<ViewTab>('overview');

    const [data, setData] = useState<RevenueRecord[]>([]);
    const [sellData, setSellData] = useState<SellCategory[]>([]);
    const [dailyPanel, setDailyPanel] = useState<DailyPanel | null>(null);
    const [loading, setLoading] = useState(false);
    const [syncing, setSyncing] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [hasFetched, setHasFetched] = useState(false);
    const [updatedAt, setUpdatedAt] = useState<string | null>(null);
    const [isListening, setIsListening] = useState(false);
    const unsubRef = useRef<(() => void) | null>(null);
    const [expandedCat, setExpandedCat] = useState<string | null>(null);

    const getRange = useCallback(() => {
        if (filterMode === 'day') return { start: dayDate, end: dayDate };
        if (filterMode === 'month') {
            const [y, m] = monthDate.split('-').map(Number);
            const last = new Date(y, m, 0).getDate();
            return { start: `${monthDate}-01`, end: `${monthDate}-${String(last).padStart(2, '0')}` };
        }
        return { start: customStart, end: customEnd };
    }, [filterMode, dayDate, monthDate, customStart, customEnd]);

    const fetchInitial = useCallback(async () => {
        const { start, end } = getRange();
        setLoading(true); setError(null);
        try {
            const result = await fetchRevenueFromCache(start, end);
            if (!result.success) { setError(result.error || 'Lỗi'); setData([]); setSellData([]); setDailyPanel(null); }
            else { setData(result.data); setSellData(result.sellData); setDailyPanel(result.dailyPanel ?? null); setUpdatedAt(result.updatedAt); }
        } catch { setError('Không thể kết nối.'); setData([]); setSellData([]); setDailyPanel(null); }
        finally { setLoading(false); setHasFetched(true); }
    }, [getRange]);

    useEffect(() => {
        if (unsubRef.current) { unsubRef.current(); unsubRef.current = null; }
        const { start, end } = getRange();
        fetchInitial();
        const unsub = subscribeDocument<RevenueCache>(JOYWORLD_CACHE_COLLECTION, getCacheDocId(start, end), (cached) => {
            if (cached?.revenue) {
                setData(cached.revenue); setSellData(cached.sellData || []);
                setDailyPanel(cached.dailyPanel ?? null); setUpdatedAt(cached.updatedAt || null);
                setError(null); setHasFetched(true); setLoading(false);
            }
            setIsListening(true);
        });
        unsubRef.current = unsub;
        return () => { unsub(); setIsListening(false); };
    }, [getRange]); // eslint-disable-line react-hooks/exhaustive-deps

    const handleSync = useCallback(async () => {
        const { start, end } = getRange();
        setSyncing(true);
        try {
            const result = await triggerSyncAction(start, end);
            if (!result.success) setError(result.error || 'Đồng bộ thất bại.');
            else { setData(result.data); setSellData(result.sellData); setDailyPanel(result.dailyPanel ?? null); setUpdatedAt(result.updatedAt); setError(null); }
        } catch { setError('Đồng bộ thất bại.'); }
        finally { setSyncing(false); }
    }, [getRange]);

    // ── Computed ──────────────────────────────────────────────────────────────
    const kpis = useMemo(() => {
        let totalReal = data.reduce((s, d) => s + d.realMoney, 0);
        let totalSys = data.reduce((s, d) => s + d.sysMoney, 0);
        let totalCash = data.reduce((s, d) => s + d.cashRealMoney, 0);
        let totalTransfer = data.reduce((s, d) => s + d.transferRealMoney, 0);
        const totalCoins = data.reduce((s, d) => s + d.sellCoinAmount, 0);
        const totalRefund = dailyPanel?.shopSummary?.refundMoney ?? data.reduce((s, d) => s + d.cashErrorMoney, 0);
        const peakDay = data.length > 0 ? data.reduce((max, d) => d.realMoney > max.realMoney ? d : max, data[0]) : null;
        if (dailyPanel) {
            if (dailyPanel.shopSummary) { totalReal = dailyPanel.shopSummary.shopRealMoney; totalSys = dailyPanel.shopSummary.totalMoney; }
            if (dailyPanel.paymentStats?.length) {
                const c = dailyPanel.paymentStats.find(p => p.paymentCategoryName.toLowerCase().includes('tiền mặt'));
                const t = dailyPanel.paymentStats.find(p => p.paymentCategoryName.toLowerCase().includes('chuyển khoản'));
                if (c) totalCash = c.totalRealMoney; if (t) totalTransfer = t.totalRealMoney;
            }
        }
        return { totalReal, totalSys, totalCash, totalTransfer, totalCoins, totalRefund, peakDay };
    }, [data, dailyPanel]);

    useEffect(() => {
        console.log(data);
    }, [data]);

    const isMultiDay = data.length > 1;
    const chartData = useMemo(() => [...data].sort((a, b) => a.forDate.localeCompare(b.forDate)).map(d => ({ date: d.forDate.slice(5), 'Thực thu': d.realMoney, 'Tiền mặt': d.cashRealMoney, 'Chuyển khoản': d.transferRealMoney })), [data]);
    const paymentPieData = useMemo(() => {
        if (dailyPanel?.paymentStats?.length) return dailyPanel.paymentStats.map(p => ({ name: p.paymentCategoryName, value: p.totalRealMoney })).filter(d => d.value > 0);
        return [{ name: 'Tiền mặt', value: data.reduce((s, d) => s + d.cashRealMoney, 0) }, { name: 'Chuyển khoản', value: data.reduce((s, d) => s + d.transferRealMoney, 0) }].filter(d => d.value > 0);
    }, [data, dailyPanel]);
    const goodsPieData = useMemo(() => {
        const source = dailyPanel?.goodsTypeStats?.length ? dailyPanel.goodsTypeStats : sellData.map(s => ({ goodsTypeName: s.goodsCategory, totalRealMoney: s.realMoney }));
        return source.filter(g => g.totalRealMoney > 0).map(g => ({ name: g.goodsTypeName, value: g.totalRealMoney }));
    }, [sellData, dailyPanel]);
    const topProducts = useMemo(() => {
        if (dailyPanel?.goodsTypeStats?.length) return dailyPanel.goodsTypeStats.flatMap(g => g.goodsItems).filter(i => i.realMoney > 0).sort((a, b) => b.realMoney - a.realMoney).slice(0, 8);
        return sellData.flatMap(c => c.items).sort((a, b) => b.realMoney - a.realMoney).slice(0, 8);
    }, [sellData, dailyPanel]);

    // Navigation helpers for day filter
    const navigateDay = (dir: number) => {
        const d = new Date(dayDate + 'T00:00:00');
        d.setDate(d.getDate() + dir);
        setDayDate(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`);
    };
    const navigateMonth = (dir: number) => {
        const [y, m] = monthDate.split('-').map(Number);
        const d = new Date(y, m - 1 + dir, 1);
        setMonthDate(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
    };

    const filterLabel = filterMode === 'day'
        ? new Date(dayDate + 'T00:00:00').toLocaleDateString('vi-VN', { weekday: 'short', day: '2-digit', month: '2-digit', year: 'numeric' })
        : filterMode === 'month'
            ? new Date(monthDate + '-01T00:00:00').toLocaleDateString('vi-VN', { month: 'long', year: 'numeric' })
            : `${customStart} → ${customEnd}`;

    // ── Guards ───────────────────────────────────────────────────────────────
    const isAdminOrSuper = userDoc?.role === 'admin' || userDoc?.role === 'super_admin';
    if (userDoc && !isAdminOrSuper && !hasPermission('page.office.revenue')) {
        return (
            <MobilePageShell title="Doanh thu">
                <div className="p-8 text-center"><AlertTriangle className="w-8 h-8 text-red-400 mx-auto mb-2" /><p className="text-sm text-red-600 font-bold">Không có quyền truy cập</p></div>
            </MobilePageShell>
        );
    }

    return (
        <MobilePageShell title="Doanh thu" headerRight={
            <button onClick={handleSync} disabled={syncing || loading}
                className="w-8 h-8 rounded-lg bg-gray-100 flex items-center justify-center active:scale-95 transition-transform disabled:opacity-40">
                <RefreshCw className={cn('w-4 h-4 text-gray-600', syncing && 'animate-spin')} />
            </button>
        }>
            {/* ── Filter bar ──────────────────────────────────────────────── */}
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-2 mb-3">
                {/* Filter mode pills */}
                <div className="flex gap-1 mb-2">
                    {([['day', 'Ngày', <Calendar key="d" className="w-3 h-3" />], ['month', 'Tháng', <CalendarDays key="m" className="w-3 h-3" />], ['custom', 'Tuỳ chọn', <CalendarDays key="c" className="w-3 h-3" />]] as [FilterMode, string, React.ReactNode][]).map(([mode, label, icon]) => (
                        <button key={mode} onClick={() => setFilterMode(mode)}
                            className={cn('flex-1 flex items-center justify-center gap-1 py-2 rounded-lg text-[11px] font-bold transition-all',
                                filterMode === mode ? 'bg-primary-600 text-white shadow-sm' : 'bg-gray-50 text-gray-500')}>
                            {icon}{label}
                        </button>
                    ))}
                </div>

                {/* Date navigation */}
                {filterMode === 'day' && (
                    <div className="flex items-center gap-1">
                        <button onClick={() => navigateDay(-1)} className="w-8 h-8 rounded-lg bg-gray-50 flex items-center justify-center active:scale-95"><ChevronLeft className="w-4 h-4 text-gray-500" /></button>
                        <div className="flex-1 text-center text-xs font-bold text-gray-700">{filterLabel}</div>
                        <button onClick={() => navigateDay(1)} className="w-8 h-8 rounded-lg bg-gray-50 flex items-center justify-center active:scale-95"><ChevronRight className="w-4 h-4 text-gray-500" /></button>
                    </div>
                )}
                {filterMode === 'month' && (
                    <div className="flex items-center gap-1">
                        <button onClick={() => navigateMonth(-1)} className="w-8 h-8 rounded-lg bg-gray-50 flex items-center justify-center active:scale-95"><ChevronLeft className="w-4 h-4 text-gray-500" /></button>
                        <div className="flex-1 text-center text-xs font-bold text-gray-700 capitalize">{filterLabel}</div>
                        <button onClick={() => navigateMonth(1)} className="w-8 h-8 rounded-lg bg-gray-50 flex items-center justify-center active:scale-95"><ChevronRight className="w-4 h-4 text-gray-500" /></button>
                    </div>
                )}
                {filterMode === 'custom' && (
                    <div className="flex items-center gap-1.5">
                        <input type="date" value={customStart} onChange={e => setCustomStart(e.target.value)}
                            className="flex-1 text-[11px] px-2 py-1.5 border border-gray-200 rounded-lg bg-gray-50 outline-none" />
                        <span className="text-gray-300 text-xs">→</span>
                        <input type="date" value={customEnd} onChange={e => setCustomEnd(e.target.value)}
                            className="flex-1 text-[11px] px-2 py-1.5 border border-gray-200 rounded-lg bg-gray-50 outline-none" />
                    </div>
                )}

                {/* Status row */}
                <div className="flex items-center justify-between mt-1.5 pt-1.5 border-t border-gray-50">
                    <div className="flex items-center gap-1.5">
                        {isListening ? (
                            <span className="flex items-center gap-0.5 text-[8px] font-bold text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded-full">
                                <Wifi className="w-2 h-2" />Live
                            </span>
                        ) : <WifiOff className="w-2.5 h-2.5 text-gray-300" />}
                        {updatedAt && <span className="text-[9px] text-gray-400 flex items-center gap-0.5"><Clock className="w-2 h-2" />{fmtTime(updatedAt)}</span>}
                    </div>
                    {(loading || syncing) && <Loader2 className="w-3 h-3 animate-spin text-primary-500" />}
                </div>
            </div>

            {/* ── View tabs ────────────────────────────────────────────── */}
            <div className="flex gap-1 bg-gray-100 rounded-lg p-0.5 mb-3">
                {([['overview', 'Tổng quan', <BarChart3 key="o" className="w-3 h-3" />], ['table', 'Bảng', <Table2 key="t" className="w-3 h-3" />], ['orders', 'Đơn hàng', <ShoppingCart key="od" className="w-3 h-3" />]] as [ViewTab, string, React.ReactNode][]).map(([tab, label, icon]) => (
                    <button key={tab} onClick={() => setViewTab(tab)}
                        className={cn('flex-1 flex items-center justify-center gap-1 py-1.5 rounded-md text-[11px] font-bold transition-all',
                            viewTab === tab ? 'bg-white text-primary-700 shadow-sm' : 'text-gray-500')}>
                        {icon}{label}
                    </button>
                ))}
            </div>

            {/* ── Error ───────────────────────────────────────────────────── */}
            {error && (
                <div className="flex items-center gap-2 bg-red-50 border border-red-200 rounded-lg px-3 py-2 mb-3">
                    <AlertTriangle className="w-3.5 h-3.5 text-red-500 shrink-0" />
                    <p className="text-[11px] font-medium text-red-700 flex-1">{error}</p>
                </div>
            )}

            {/* ── Loading ─────────────────────────────────────────────────── */}
            {loading && !hasFetched && (
                <div className="flex flex-col items-center justify-center py-16">
                    <div className="w-8 h-8 border-2 border-primary-200 border-t-primary-600 rounded-full animate-spin mb-3" />
                    <p className="text-xs font-semibold text-gray-500">Đang tải dữ liệu...</p>
                </div>
            )}

            {/* ═══ MAIN CONTENT ═══ */}
            {/* ═══ OVERVIEW TAB ═══ */}
            {viewTab === 'overview' && hasFetched && !error && data.length > 0 && (
                <div className={cn('space-y-3', (loading || syncing) && 'opacity-50 pointer-events-none')}>

                    {/* ── Hero KPI ─────────────────────────────────────────── */}
                    <div className="relative overflow-hidden rounded-xl bg-gradient-to-br from-primary-600 to-primary-800 p-4 shadow-lg shadow-primary-200">
                        <div className="absolute inset-0 opacity-[0.06]" style={{ backgroundImage: 'radial-gradient(circle at 80% 20%, white 1px, transparent 1px)', backgroundSize: '16px 16px' }} />
                        <div className="relative flex items-center justify-between">
                            <div>
                                <p className="text-[9px] font-bold uppercase tracking-widest text-primary-200">Thực thu</p>
                                <p className="text-2xl font-black text-white tracking-tight mt-1">{fmtShort(kpis.totalSys)}</p>
                                <p className="text-[10px] text-primary-200 mt-0.5">{fmtVND(kpis.totalSys)}</p>
                            </div>
                            <div className="w-10 h-10 rounded-xl bg-white/20 backdrop-blur-sm flex items-center justify-center">
                                <DollarSign className="w-5 h-5 text-white" />
                            </div>
                        </div>
                    </div>

                    {/* ── KPI Grid ─────────────────────────────────────────── */}
                    <div className="grid grid-cols-2 gap-2">
                        {[
                            { title: 'Tiền mặt', value: fmtShort(kpis.totalCash), sub: `${kpis.totalReal > 0 ? ((kpis.totalCash / kpis.totalReal) * 100).toFixed(0) : 0}%`, icon: <Banknote className="w-4 h-4 text-blue-600" />, bg: 'bg-blue-50', border: 'border-blue-100', color: 'text-blue-700' },
                            { title: 'Chuyển khoản', value: fmtShort(kpis.totalTransfer), sub: `${kpis.totalReal > 0 ? ((kpis.totalTransfer / kpis.totalReal) * 100).toFixed(0) : 0}%`, icon: <ArrowUpDown className="w-4 h-4 text-violet-600" />, bg: 'bg-violet-50', border: 'border-violet-100', color: 'text-violet-700' },
                            { title: 'Xu bán', value: fmt(kpis.totalCoins), sub: `${fmtShort(data[0]?.sellCoinPrice || 0)}/xu`, icon: <Coins className="w-4 h-4 text-amber-600" />, bg: 'bg-amber-50', border: 'border-amber-100', color: 'text-amber-700' },
                            isMultiDay
                                ? { title: 'Ngày cao nhất', value: kpis.peakDay ? fmtShort(kpis.peakDay.realMoney) : '—', sub: kpis.peakDay?.forDate?.slice(5) || '', icon: <TrendingUp className="w-4 h-4 text-pink-600" />, bg: 'bg-pink-50', border: 'border-pink-100', color: 'text-pink-700' }
                                : { title: 'Đã hủy', value: fmtShort(kpis.totalRefund), sub: kpis.totalRefund > 0 ? 'Giao dịch hủy' : 'Không hủy', icon: <XCircle className="w-4 h-4 text-red-500" />, bg: 'bg-red-50', border: 'border-red-100', color: 'text-red-700' },
                        ].map(card => (
                            <div key={card.title} className={cn('rounded-xl border p-3', card.bg, card.border)}>
                                <div className="flex items-center justify-between mb-1">
                                    <span className="text-[9px] font-bold text-gray-400 uppercase">{card.title}</span>
                                    {card.icon}
                                </div>
                                <p className={cn('text-base font-black', card.color)}>{card.value}</p>
                                <p className="text-[9px] text-gray-400 font-medium">{card.sub}</p>
                            </div>
                        ))}
                    </div>

                    {/* ── Revenue chart (multi-day) ────────────────────────── */}
                    {isMultiDay && (
                        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-3">
                            <h3 className="text-xs font-bold text-gray-700 mb-2">Doanh thu theo ngày</h3>
                            <div className="h-[180px]">
                                <ResponsiveContainer width="100%" height="100%">
                                    <AreaChart data={chartData} margin={{ top: 5, right: 5, left: -15, bottom: 0 }}>
                                        <defs>
                                            <linearGradient id="gR" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#10b981" stopOpacity={0.2} /><stop offset="100%" stopColor="#10b981" stopOpacity={0.01} /></linearGradient>
                                        </defs>
                                        <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                                        <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{ fontSize: 9, fill: '#94a3b8' }} />
                                        <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 9, fill: '#94a3b8' }} tickFormatter={fmtShort} width={40} />
                                        <RechartsTooltip contentStyle={{ borderRadius: '10px', border: 'none', boxShadow: '0 4px 16px rgb(0 0 0/0.1)', fontSize: '11px' }} />
                                        <Area type="monotone" dataKey="Thực thu" stroke="#10b981" strokeWidth={2} fill="url(#gR)" dot={false} />
                                    </AreaChart>
                                </ResponsiveContainer>
                            </div>
                        </div>
                    )}

                    {/* ── Single-day summary grid ─────────────────────────── */}
                    {!isMultiDay && dailyPanel?.shopSummary && (
                        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-3">
                            <h3 className="text-xs font-bold text-gray-700 mb-2">Tổng kết ngày</h3>
                            <div className="grid grid-cols-3 gap-1.5">
                                {[
                                    { l: 'Tổng HĐ', v: fmtShort(dailyPanel.shopSummary.shopMoney), c: 'text-gray-700' },
                                    { l: 'Thực thu', v: fmtShort(dailyPanel.shopSummary.shopRealMoney), c: 'text-emerald-700' },
                                    { l: 'Đã hủy', v: fmtShort(dailyPanel.shopSummary.refundMoney), c: 'text-red-600' },
                                    { l: 'Tiền mặt', v: fmtShort(kpis.totalCash), c: 'text-blue-700' },
                                    { l: 'CK', v: fmtShort(kpis.totalTransfer), c: 'text-violet-700' },
                                    { l: 'Xu', v: fmt(kpis.totalCoins), c: 'text-amber-700' },
                                ].map(item => (
                                    <div key={item.l} className="bg-gray-50 rounded-lg p-2 text-center">
                                        <p className="text-[8px] font-bold text-gray-400 uppercase">{item.l}</p>
                                        <p className={cn('text-xs font-black mt-0.5', item.c)}>{item.v}</p>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* ── Payment pie + legend ────────────────────────────── */}
                    {paymentPieData.length > 0 && (
                        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-3">
                            <h3 className="text-xs font-bold text-gray-700 mb-2">Thanh toán</h3>
                            <div className="flex items-center">
                                <div className="w-[120px] h-[120px] shrink-0">
                                    <ResponsiveContainer width="100%" height="100%">
                                        <PieChart>
                                            <Pie data={paymentPieData} cx="50%" cy="50%" innerRadius={30} outerRadius={55}
                                                paddingAngle={3} dataKey="value" labelLine={false} label={PieLabel}>
                                                {paymentPieData.map((_, i) => <Cell key={i} fill={PALETTE[i % PALETTE.length]} />)}
                                            </Pie>
                                        </PieChart>
                                    </ResponsiveContainer>
                                </div>
                                <div className="flex-1 pl-3 space-y-1.5">
                                    {paymentPieData.map((item, i) => {
                                        const total = paymentPieData.reduce((s, d) => s + d.value, 0);
                                        const pct = total > 0 ? ((item.value / total) * 100).toFixed(0) : '0';
                                        return (
                                            <div key={item.name} className="flex items-center justify-between">
                                                <div className="flex items-center gap-1.5">
                                                    <div className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: PALETTE[i % PALETTE.length] }} />
                                                    <span className="text-[10px] text-gray-600 truncate max-w-[80px]">{item.name}</span>
                                                </div>
                                                <div className="text-right">
                                                    <span className="text-[10px] font-bold text-gray-800">{fmtShort(item.value)}</span>
                                                    <span className="ml-1 text-[8px] text-gray-400">{pct}%</span>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        </div>
                    )}

                    {/* ── Top products ─────────────────────────────────────── */}
                    {topProducts.length > 0 && (
                        <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
                            <div className="px-3 py-2.5 border-b border-gray-50">
                                <h3 className="text-xs font-bold text-gray-700">Top sản phẩm</h3>
                            </div>
                            {topProducts.map((p, i) => {
                                const maxVal = topProducts[0]?.realMoney || 1;
                                const pct = (p.realMoney / maxVal) * 100;
                                return (
                                    <div key={p.goodsName + i} className="flex items-center gap-2 px-3 py-2 border-b border-gray-50 last:border-0">
                                        <span className={cn('w-5 h-5 rounded-md flex items-center justify-center text-[9px] font-black text-white shrink-0',
                                            i < 3 ? 'bg-primary-500' : 'bg-gray-300')}>
                                            {i + 1}
                                        </span>
                                        <div className="flex-1 min-w-0">
                                            <p className="text-[11px] font-semibold text-gray-700 truncate">{p.goodsName}</p>
                                            <div className="h-1 bg-gray-100 rounded-full mt-1 overflow-hidden">
                                                <div className="h-full rounded-full bg-primary-400" style={{ width: `${pct}%` }} />
                                            </div>
                                        </div>
                                        <div className="text-right shrink-0">
                                            <p className="text-[10px] font-bold text-gray-800">{fmtShort(p.realMoney)}</p>
                                            <p className="text-[8px] text-gray-400">SL: {p.realQty}</p>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}

                    {/* ── Category breakdown ───────────────────────────────── */}
                    {goodsPieData.length > 0 && (
                        <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
                            <div className="px-3 py-2.5 border-b border-gray-50 flex items-center gap-2">
                                <ShoppingBag className="w-3.5 h-3.5 text-primary-500" />
                                <h3 className="text-xs font-bold text-gray-700">Danh mục hàng hoá</h3>
                            </div>
                            {goodsPieData.map((cat, ci) => {
                                const total = goodsPieData.reduce((s, d) => s + d.value, 0);
                                const pct = total > 0 ? ((cat.value / total) * 100).toFixed(0) : '0';
                                const items = dailyPanel?.goodsTypeStats?.find(g => g.goodsTypeName === cat.name)?.goodsItems
                                    ?? sellData.find(s => s.goodsCategory === cat.name)?.items
                                    ?? [];
                                const topItems = items.filter(i => i.realMoney > 0).sort((a, b) => b.realMoney - a.realMoney).slice(0, 5);
                                const isOpen = expandedCat === cat.name;
                                return (
                                    <div key={cat.name} className="border-b border-gray-50 last:border-0">
                                        <button onClick={() => setExpandedCat(isOpen ? null : cat.name)}
                                            className="w-full flex items-center gap-2.5 px-3 py-2.5 active:bg-gray-50 transition-colors">
                                            <div className="w-6 h-6 rounded-md flex items-center justify-center shrink-0"
                                                style={{ backgroundColor: PALETTE[ci % PALETTE.length] + '20' }}>
                                                <Package className="w-3 h-3" style={{ color: PALETTE[ci % PALETTE.length] }} />
                                            </div>
                                            <div className="flex-1 text-left min-w-0">
                                                <p className="text-[11px] font-bold text-gray-700 truncate">{cat.name}</p>
                                            </div>
                                            <div className="text-right shrink-0 mr-1">
                                                <span className="text-[10px] font-bold text-gray-800">{fmtShort(cat.value)}</span>
                                                <span className="ml-1 text-[8px] text-gray-400">{pct}%</span>
                                            </div>
                                            <ChevronDown className={cn('w-3.5 h-3.5 text-gray-400 transition-transform shrink-0', isOpen && 'rotate-180')} />
                                        </button>
                                        {isOpen && topItems.length > 0 && (
                                            <div className="px-3 pb-2 pl-11">
                                                {topItems.map((item, idx) => (
                                                    <div key={item.goodsName + idx} className="flex items-center justify-between py-1.5 border-t border-gray-50 first:border-0">
                                                        <p className="text-[10px] text-gray-600 truncate flex-1 pr-2">{item.goodsName}</p>
                                                        <div className="text-right shrink-0">
                                                            <span className="text-[10px] font-bold text-gray-700">{fmtShort(item.realMoney)}</span>
                                                            <span className="ml-1 text-[8px] text-gray-400">×{item.realQty}</span>
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    )}


                </div>
            )}

            {/* ═══ TABLE TAB ═══ */}
            {viewTab === 'table' && hasFetched && !error && data.length > 0 && (
                <div className={cn((loading || syncing) && 'opacity-50 pointer-events-none')}>
                    <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
                        <div className="px-3 py-2.5 border-b border-gray-50 flex items-center justify-between">
                            <div>
                                <h3 className="text-xs font-bold text-gray-700">Chi tiết doanh thu</h3>
                                <p className="text-[9px] text-gray-400">{data.length} bản ghi</p>
                            </div>
                            <p className="text-sm font-bold text-gray-800">{fmtShort(kpis.totalReal)}</p>
                        </div>
                        <p className="text-[9px] text-gray-400 px-3 py-1 bg-gray-50 border-b border-gray-100">← Vuốt ngang →</p>
                        <div className="overflow-x-auto">
                            <table className="w-full text-[10px]">
                                <thead>
                                    <tr className="bg-gray-50">
                                        {['Ngày', 'Thực thu', 'Phải thu', 'Bán hàng', 'TM', 'Lỗi TM', 'CK', 'Xu'].map((h, i) => (
                                            <th key={h} className={cn('px-2 py-2 font-bold text-gray-500 uppercase whitespace-nowrap', i === 0 ? 'text-left sticky left-0 bg-gray-50 z-10' : 'text-right')}>{h}</th>
                                        ))}
                                    </tr>
                                </thead>
                                <tbody>
                                    {[...data].sort((a, b) => b.forDate.localeCompare(a.forDate)).map((row, idx) => (
                                        <tr key={row.forDate} className={idx % 2 === 1 ? 'bg-gray-50/30' : ''}>
                                            <td className="px-2 py-1.5 font-semibold text-gray-700 whitespace-nowrap sticky left-0 bg-white z-10">{row.forDate.slice(5)}</td>
                                            <td className="px-2 py-1.5 text-right font-bold text-emerald-700 whitespace-nowrap">{fmtShort(row.realMoney)}</td>
                                            <td className="px-2 py-1.5 text-right text-gray-600 whitespace-nowrap">{fmtShort(row.sysMoney)}</td>
                                            <td className="px-2 py-1.5 text-right text-gray-600 whitespace-nowrap">{fmtShort(row.saleSubMoney)}</td>
                                            <td className="px-2 py-1.5 text-right text-blue-700 whitespace-nowrap">{fmtShort(row.cashRealMoney)}</td>
                                            <td className={cn('px-2 py-1.5 text-right whitespace-nowrap font-medium', row.cashErrorMoney !== 0 ? 'text-amber-600' : 'text-gray-300')}>{row.cashErrorMoney !== 0 ? fmtShort(row.cashErrorMoney) : '—'}</td>
                                            <td className="px-2 py-1.5 text-right text-violet-700 whitespace-nowrap">{fmtShort(row.transferRealMoney)}</td>
                                            <td className="px-2 py-1.5 text-right text-amber-700 whitespace-nowrap">{fmt(row.sellCoinAmount)}</td>
                                        </tr>
                                    ))}
                                </tbody>
                                <tfoot>
                                    <tr className="border-t-2 border-gray-200 bg-primary-50/30">
                                        <td className="px-2 py-2 font-bold text-gray-700 sticky left-0 bg-primary-50/30 z-10 text-[8px] uppercase">Tổng</td>
                                        <td className="px-2 py-2 text-right font-bold text-emerald-700">{fmtShort(kpis.totalReal)}</td>
                                        <td className="px-2 py-2 text-right font-bold text-gray-700">{fmtShort(kpis.totalSys)}</td>
                                        <td className="px-2 py-2 text-right font-bold text-gray-700">{fmtShort(data.reduce((s, d) => s + d.saleSubMoney, 0))}</td>
                                        <td className="px-2 py-2 text-right font-bold text-blue-700">{fmtShort(kpis.totalCash)}</td>
                                        <td className="px-2 py-2 text-right font-bold text-amber-600">{fmtShort(data.reduce((s, d) => s + d.cashErrorMoney, 0))}</td>
                                        <td className="px-2 py-2 text-right font-bold text-violet-700">{fmtShort(kpis.totalTransfer)}</td>
                                        <td className="px-2 py-2 text-right font-bold text-amber-700">{fmt(kpis.totalCoins)}</td>
                                    </tr>
                                </tfoot>
                            </table>
                        </div>
                    </div>
                </div>
            )}

            {/* ═══ ORDERS TAB ═══ */}
            {viewTab === 'orders' && (
                <MobileOrdersPanel startDate={getRange().start} endDate={getRange().end} />
            )}

            {/* ── Empty state ─────────────────────────────────────────────── */}
            {!loading && hasFetched && !error && data.length === 0 && (
                <div className="flex flex-col items-center justify-center py-16">
                    <BarChart3 className="w-8 h-8 text-gray-300 mb-3" />
                    <p className="text-xs font-semibold text-gray-500 mb-1">Không có dữ liệu</p>
                    <p className="text-[10px] text-gray-400 mb-4">Nhấn Sync để tải từ Joyworld</p>
                    <button onClick={handleSync} disabled={syncing}
                        className="flex items-center gap-1.5 px-4 py-2 bg-primary-600 text-white rounded-lg text-xs font-bold shadow-sm active:scale-95 transition-all disabled:opacity-50">
                        <RefreshCw className={cn('w-3.5 h-3.5', syncing && 'animate-spin')} />{syncing ? 'Đang tải...' : 'Đồng bộ ngay'}
                    </button>
                </div>
            )}
        </MobilePageShell>
    );
}
