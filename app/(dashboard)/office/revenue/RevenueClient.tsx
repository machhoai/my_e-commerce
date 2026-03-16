'use client';

import { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import {
    AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
    XAxis, YAxis, CartesianGrid,
    Tooltip as RechartsTooltip, ResponsiveContainer, Legend,
} from 'recharts';
import {
    TrendingUp, CalendarDays, Coins, Loader2, AlertTriangle, BarChart3,
    CalendarRange, Calendar, Table2, Package, ShoppingBag, RefreshCw,
    Wifi, WifiOff, Banknote, ArrowUpDown, DollarSign, XCircle, Clock,
    ShoppingCart, User, CreditCard, Store, CheckCircle2, ChevronLeft, ChevronRight, Receipt,
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { subscribeDocument } from '@/lib/firestore';
import { JOYWORLD_CACHE_COLLECTION, getCacheDocId, type RevenueCache, type RevenueRecord, type SellCategory, type DailyPanel } from '@/lib/revenue-cache';
import { fetchRevenueFromCache, triggerSyncAction } from './actions';
import OrdersClient from './orders/OrdersClient';

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

// ── KPI Card ─────────────────────────────────────────────────────────────────
function KPICard({ title, value, sub, icon, accent, badge, hero }: {
    title: string; value: string; sub: string; icon: React.ReactNode; accent: string; badge?: string; hero?: boolean;
}) {
    if (hero) {
        return (
            <div className="relative h-full items-center flex  shrink-0 flex-1 overflow-hidden rounded-2xl p-5 bg-gradient-to-br from-primary-600 to-primary-800 shadow-lg shadow-primary-200 hover:shadow-xl hover:shadow-primary-200 transition-all duration-200 min-w-[300px]">
                {/* Subtle pattern overlay */}
                <div className="absolute inset-0 opacity-[0.07]" style={{ backgroundImage: 'radial-gradient(circle at 80% 20%, white 1px, transparent 1px)', backgroundSize: '20px 20px' }} />
                <div className="relative flex items-center w-full justify-between gap-3">
                    <div className="flex-1 min-w-0">
                        <p className="text-[11px] font-bold uppercase tracking-widest text-primary-100">{title}</p>
                        <p className="mt-2 text-xl sm:text-2xl xl:text-3xl tracking-tighter font-extrabold text-white leading-tight drop-shadow-sm whitespace-nowrap">
                            {value}
                        </p>
                        <p className="mt-1.5 text-xs text-primary-100 break-words leading-tight">{sub}</p>
                    </div>
                    <div className="shrink-0 w-11 h-11 rounded-xl bg-white/20 backdrop-blur-sm flex items-center justify-center ring-1 ring-white/30">
                        {icon}
                    </div>
                </div>
                {badge && <div className="absolute top-3 right-3 text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-white/30 text-white">{badge}</div>}
            </div>
        );
    }
    return (
        <div className={`relative h-full flex items-center overflow-hidden rounded-2xl p-4 bg-white border border-surface-100 shadow-sm hover:shadow-md transition-all duration-200 group`}>
            <div className={`absolute inset-0 opacity-[0.04] ${accent} rounded-2xl`} />
            <div className="absolute top-0 left-0 w-1 h-full rounded-l-2xl" style={{ background: `var(--kpi-accent)` }} />
            <div className="flex items-start justify-between w-full gap-2">
                <div className="flex-1 min-w-0">
                    <p className="text-[10px] font-semibold uppercase tracking-widest text-surface-400 leading-tight">{title}</p>
                    <p className="mt-1.5 text-base sm:text-lg font-bold text-surface-800 leading-tight break-words truncate">{value}</p>
                    <p className="mt-1 text-[11px] text-surface-400 break-words leading-tight">{sub}</p>
                </div>
                <div className={`shrink-0 w-8 h-8 sm:w-10 sm:h-10 rounded-xl flex items-center justify-center ${accent} bg-opacity-10`}>
                    {icon}
                </div>
            </div>
            {badge && <div className="absolute top-2 right-2 text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-success-100 text-success-700">{badge}</div>}
        </div>
    );
}

// ── Custom Tooltip ────────────────────────────────────────────────────────────
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function ChartTooltip({ active, payload, label }: any) {
    if (!active || !payload?.length) return null;
    return (
        <div className="bg-white/95 backdrop-blur-sm rounded-xl shadow-xl border border-surface-100 px-4 py-3 min-w-[180px]">
            <p className="text-[11px] font-semibold text-surface-400 mb-2 uppercase tracking-wide">{label}</p>
            {payload.map((e: { name: string; value: number; color: string }, i: number) => (
                <div key={i} className="flex items-center justify-between gap-4 py-0.5">
                    <div className="flex items-center gap-1.5">
                        <div className="w-2 h-2 rounded-full" style={{ backgroundColor: e.color }} />
                        <span className="text-xs text-surface-600">{e.name}</span>
                    </div>
                    <span className="text-xs font-bold text-surface-900">{fmtShort(e.value)}</span>
                </div>
            ))}
        </div>
    );
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function PieLabel({ cx, cy, midAngle, innerRadius, outerRadius, percent }: any) {
    if (percent < 0.05) return null;
    const RADIAN = Math.PI / 180;
    const r = innerRadius + (outerRadius - innerRadius) * 0.5;
    const x = cx + r * Math.cos(-midAngle * RADIAN);
    const y = cy + r * Math.sin(-midAngle * RADIAN);
    return (
        <text x={x} y={y} fill="white" textAnchor="middle" dominantBaseline="central" fontSize={11} fontWeight={700}>
            {(percent * 100).toFixed(0)}%
        </text>
    );
}

// ── Section Header ─────────────────────────────────────────────────────────
function SectionHeader({ icon, title, subtitle }: { icon: React.ReactNode; title: string; subtitle?: string }) {
    return (
        <div className="flex items-center gap-3 py-1">
            <div className="w-8 h-8 rounded-lg bg-accent-50 flex items-center justify-center shrink-0">{icon}</div>
            <div>
                <h2 className="text-sm font-bold text-surface-700">{title}</h2>
                {subtitle && <p className="text-xs text-surface-400">{subtitle}</p>}
            </div>
            <div className="flex-1 h-px bg-gradient-to-r from-surface-200 to-transparent ml-2" />
        </div>
    );
}


// -- OrdersPanel - thin wrapper passing dates to shared OrdersClient ----------
function OrdersPanel({ getRange }: { getRange: () => { start: string; end: string } }) {
    const { start, end } = getRange();
    return <OrdersClient startDate={start} endDate={end} />;
}

// ===============================================================================
export default function RevenueClient() {
    const { userDoc, hasPermission } = useAuth();

    const [filterMode, setFilterMode] = useState<FilterMode>('day');
    const [dayDate, setDayDate] = useState(todayStr());
    const [monthDate, setMonthDate] = useState(todayStr().slice(0, 7));
    const [customStart, setCustomStart] = useState(monthStart());
    const [customEnd, setCustomEnd] = useState(todayStr());
    const [viewTab, setViewTab] = useState<ViewTab>('overview');

    const [data, setData] = useState<RevenueRecord[]>([]);
    const [sellData, setSellData] = useState<SellCategory[]>([]);
    const [dailyPanel, setDailyPanel] = useState<DailyPanel | null>(null);
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
            if (!result.success) { setError(result.error || 'Đã xảy ra lỗi.'); setData([]); setSellData([]); setDailyPanel(null); }
            else { setData(result.data); setSellData(result.sellData); setDailyPanel(result.dailyPanel ?? null); setUpdatedAt(result.updatedAt); }
            setActiveRange(`${start} → ${end}`);
        } catch { setError('Không thể kết nối. Vui lòng thử lại.'); setData([]); setSellData([]); setDailyPanel(null); }
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
            if (!result.success) {
                setError(result.error || 'Đồng bộ thất bại.');
            } else {
                // 👇 THÊM 5 DÒNG NÀY ĐỂ ÉP UI NHẢY SỐ NGAY LẬP TỨC 👇
                setData(result.data);
                setSellData(result.sellData);
                setDailyPanel(result.dailyPanel ?? null);
                setUpdatedAt(result.updatedAt);
                setError(null);
                // 👆 ------------------------------------------- 👆
            }
        } catch { setError('Đồng bộ thất bại.'); }
        finally { setSyncing(false); }
    }, [getRange]);

    // ── Computed data ──────────────────────────────────────────────────────────
    // ── Computed data ──────────────────────────────────────────────────────────
    const kpis = useMemo(() => {
        // 1. Tính toán mặc định từ mảng data (Dành cho khi xem nhiều ngày / theo tháng)
        let totalReal = data.reduce((s, d) => s + d.realMoney, 0);
        let totalSys = data.reduce((s, d) => s + d.sysMoney, 0);
        let totalCash = data.reduce((s, d) => s + d.cashRealMoney, 0);
        let totalTransfer = data.reduce((s, d) => s + d.transferRealMoney, 0);
        const totalCoins = data.reduce((s, d) => s + d.sellCoinAmount, 0);
        const totalRefund = dailyPanel?.shopSummary?.refundMoney ?? data.reduce((s, d) => s + d.cashErrorMoney, 0);
        const peakDay = data.length > 0 ? data.reduce((max, d) => d.realMoney > max.realMoney ? d : max, data[0]) : null;

        // 2. GHI ĐÈ BẰNG DỮ LIỆU REAL-TIME NẾU ĐANG XEM 1 NGÀY (dailyPanel tồn tại)
        if (dailyPanel) {
            // Ghi đè Thực thu bằng số chính xác nhất từ ShopSummary
            if (dailyPanel.shopSummary) {
                totalReal = dailyPanel.shopSummary.shopRealMoney;
                totalSys = dailyPanel.shopSummary.totalMoney;
            }

            // Ghi đè Tiền mặt & Chuyển khoản từ PaymentStats (Giống hệt Pie Chart)
            if (dailyPanel.paymentStats && dailyPanel.paymentStats.length > 0) {
                const pmCash = dailyPanel.paymentStats.find(p => p.paymentCategoryName.toLowerCase().includes('tiền mặt'));
                const pmTransfer = dailyPanel.paymentStats.find(p => p.paymentCategoryName.toLowerCase().includes('chuyển khoản'));

                if (pmCash) totalCash = pmCash.totalRealMoney;
                if (pmTransfer) totalTransfer = pmTransfer.totalRealMoney;
            }
        }

        return { totalReal, totalSys, totalCash, totalTransfer, totalCoins, totalRefund, peakDay };
    }, [data, dailyPanel]);

    const isMultiDay = data.length > 1;

    const chartData = useMemo(() =>
        [...data].sort((a, b) => a.forDate.localeCompare(b.forDate)).map(d => ({
            date: d.forDate.slice(5), 'Thực thu': d.realMoney, 'Tiền mặt': d.cashRealMoney, 'Chuyển khoản': d.transferRealMoney,
        })), [data]);

    const coinChartData = useMemo(() =>
        [...data].sort((a, b) => a.forDate.localeCompare(b.forDate)).map(d => ({
            date: d.forDate.slice(5), 'Xu bán': d.sellCoinAmount,
        })), [data]);

    const paymentPieData = useMemo(() => {
        if (dailyPanel?.paymentStats?.length) {
            return dailyPanel.paymentStats.map(p => ({ name: p.paymentCategoryName, value: p.totalRealMoney })).filter(d => d.value > 0);
        }
        return [
            { name: 'Tiền mặt', value: data.reduce((s, d) => s + d.cashRealMoney, 0) },
            { name: 'Chuyển khoản', value: data.reduce((s, d) => s + d.transferRealMoney, 0) },
        ].filter(d => d.value > 0);
    }, [data, dailyPanel]);

    const goodsPieData = useMemo(() => {
        const source = dailyPanel?.goodsTypeStats?.length ? dailyPanel.goodsTypeStats : sellData.map(s => ({ goodsTypeName: s.goodsCategory, totalRealMoney: s.realMoney }));
        return source.filter(g => g.totalRealMoney > 0).map(g => ({ name: g.goodsTypeName, value: g.totalRealMoney }));
    }, [sellData, dailyPanel]);

    const topProducts = useMemo(() => {
        if (dailyPanel?.goodsTypeStats?.length) {
            return dailyPanel.goodsTypeStats.flatMap(g => g.goodsItems).filter(i => i.realMoney > 0).sort((a, b) => b.realMoney - a.realMoney).slice(0, 10);
        }
        return sellData.flatMap(c => c.items).sort((a, b) => b.realMoney - a.realMoney).slice(0, 10);
    }, [sellData, dailyPanel]);

    // ── Style helpers ──────────────────────────────────────────────────────────
    const pillBtn = (active: boolean) =>
        `flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold transition-all cursor-pointer whitespace-nowrap ${active
            ? 'bg-accent-600 text-white shadow-sm shadow-accent-200' : 'text-surface-500 hover:text-surface-700 hover:bg-surface-100'}`;
    const tabBtn = (active: boolean) =>
        `flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium transition-all cursor-pointer ${active
            ? 'bg-white text-accent-600 shadow-sm border border-surface-200' : 'text-surface-500 hover:text-surface-700 hover:bg-white/60'}`;
    const inputCls = "rounded-xl bg-white px-3 text-sm text-surface-700 focus:border-accent-400 focus:ring-2 focus:ring-accent-100 outline-none transition-all";

    // ── Permission guard (placed AFTER all hooks — Rules of Hooks compliant) ──
    const isAdminOrSuper = userDoc?.role === 'admin' || userDoc?.role === 'super_admin';
    if (userDoc && !isAdminOrSuper && !hasPermission('view_revenue')) {
        return (
            <div className="flex flex-col items-center justify-center py-24 gap-5 bg-white rounded-3xl border border-surface-100">
                <div className="w-16 h-16 rounded-2xl bg-danger-50 flex items-center justify-center">
                    <AlertTriangle className="size-8 text-danger-400" />
                </div>
                <div className="text-center">
                    <h2 className="text-base font-bold text-surface-700">Không có quyền truy cập</h2>
                    <p className="text-sm text-surface-400 mt-1 max-w-xs">Bạn cần quyền <code className="bg-surface-100 px-1.5 py-0.5 rounded text-xs font-mono text-accent-600">view_revenue</code> để xem trang này.</p>
                    <p className="text-xs text-surface-400 mt-1">Liên hệ Admin để được cấp quyền qua trang <strong>Quản lý Phân quyền</strong>.</p>
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-5 animate-in fade-in duration-500">

            {/* ═══ HEADER ═══ */}
            <div className="flex flex-col gap-4">
                <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                    {/* Title */}
                    <div>
                        <div className="flex items-center gap-2.5">
                            <div className="w-9 h-9 rounded-xl bg-accent-600 flex items-center justify-center shadow-lg shadow-accent-200">
                                <BarChart3 className="size-5 text-white" />
                            </div>
                            <div>
                                <h1 className="text-xl font-bold text-surface-800 tracking-tight">Quản lý Doanh thu</h1>
                                <div className="flex items-center gap-2 mt-0.5">
                                    {activeRange && (
                                        <span className="text-xs text-surface-400 flex items-center gap-1">
                                            <CalendarDays className="size-3" />{activeRange}
                                        </span>
                                    )}
                                    {updatedAt && (
                                        <span className="text-xs text-surface-300 flex items-center gap-1">
                                            <Clock className="size-3" />{fmtTime(updatedAt)}
                                        </span>
                                    )}
                                    {isListening ? (
                                        <span className="flex items-center gap-1 text-[10px] font-semibold text-success-500 bg-success-50 px-1.5 py-0.5 rounded-full">
                                            <Wifi className="size-2.5" />Live
                                        </span>
                                    ) : <WifiOff className="size-3 text-surface-300" />}
                                    {(loading || syncing) && <Loader2 className="size-3 animate-spin text-accent-400" />}
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Controls */}
                    <div className="flex items-center gap-2 shrink-0">
                        <button onClick={handleSync} disabled={syncing || loading}
                            className="flex items-center gap-1.5 h-full px-3 py-2 rounded-xl text-sm font-medium text-surface-500 hover:text-accent-600 hover:bg-accent-50 border border-surface-200 transition-all disabled:opacity-40"
                            title="Đồng bộ từ Joyworld">
                            <RefreshCw className={`size-4 ${syncing ? 'animate-spin' : ''}`} />
                            <span className="hidden sm:inline">{syncing ? 'Đang sync...' : 'Sync'}</span>
                        </button>
                        <div className="flex items-center gap-1 bg-surface-100 rounded-xl p-1">
                            <button onClick={() => setViewTab('overview')} className={tabBtn(viewTab === 'overview')}>
                                <BarChart3 className="size-3.5" />Tổng quan
                            </button>
                            <button onClick={() => setViewTab('table')} className={tabBtn(viewTab === 'table')}>
                                <Table2 className="size-3.5" />Bảng
                            </button>
                            <button onClick={() => setViewTab('orders')} className={tabBtn(viewTab === 'orders')}>
                                <ShoppingCart className="size-3.5" />Đơn hàng
                            </button>
                        </div>
                    </div>
                </div>

                {/* Filter Bar */}
                <div className="flex flex-wrap items-center gap-3 bg-white rounded-2xl p-1 border border-surface-100 shadow-sm">
                    <div className="flex items-center gap-1 w-full sm:w-auto">
                        <button onClick={() => setFilterMode('day')} className={pillBtn(filterMode === 'day') + ' flex-1 flex justify-center items-center sm:flex-none'}>
                            <Calendar className="size-3" />Ngày
                        </button>
                        <button onClick={() => setFilterMode('month')} className={pillBtn(filterMode === 'month') + ' flex-1 flex justify-center items-center sm:flex-none'}>
                            <CalendarDays className="size-3" />Tháng
                        </button>
                        <button onClick={() => setFilterMode('custom')} className={pillBtn(filterMode === 'custom') + ' flex-1 flex justify-center items-center sm:flex-none'}>
                            <CalendarRange className="size-3" />Tùy chọn
                        </button>
                    </div>
                    <div className="flex items-center justify-center gap-2 flex-wrap w-full sm:w-auto">
                        {filterMode === 'day' && (
                            <input type="date" value={dayDate} onChange={e => setDayDate(e.target.value)} className={inputCls} />
                        )}
                        {filterMode === 'month' && (
                            <input type="month" value={monthDate} onChange={e => setMonthDate(e.target.value)} className={inputCls} />
                        )}
                        {filterMode === 'custom' && (
                            <>
                                <input type="date" value={customStart} onChange={e => setCustomStart(e.target.value)} className={inputCls} />
                                <span className="text-surface-300 font-medium">→</span>
                                <input type="date" value={customEnd} onChange={e => setCustomEnd(e.target.value)} className={inputCls} />
                                <button onClick={handleSync} disabled={syncing || loading}
                                    className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-accent-600 text-white text-sm font-semibold shadow-sm shadow-accent-200 hover:bg-accent-700 active:scale-[0.98] transition-all disabled:opacity-60">
                                    {syncing ? <Loader2 className="size-3.5 animate-spin" /> : <BarChart3 className="size-3.5" />}Xem
                                </button>
                            </>
                        )}
                    </div>
                </div>
            </div>

            {/* Error Banner */}
            {error && (
                <div className="rounded-2xl border border-danger-200 bg-danger-50 p-4 flex items-start gap-3">
                    <AlertTriangle className="size-5 text-danger-500 shrink-0 mt-0.5" />
                    <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-danger-800">Lỗi khi tải dữ liệu</p>
                        <p className="text-xs text-danger-600 mt-0.5 truncate">{error}</p>
                    </div>
                </div>
            )}

            {/* Loading Skeleton */}
            {loading && !hasFetched && (
                <div className="flex flex-col items-center justify-center py-24 gap-4 bg-white rounded-3xl border border-surface-100">
                    <div className="relative">
                        <div className="w-12 h-12 rounded-full border-4 border-accent-100" />
                        <div className="w-12 h-12 rounded-full border-4 border-accent-500 border-t-transparent absolute inset-0 animate-spin" />
                    </div>
                    <div className="text-center">
                        <p className="text-sm font-semibold text-surface-600">Đang tải dữ liệu</p>
                        <p className="text-xs text-surface-400 mt-0.5">Kết nối tới Joyworld...</p>
                    </div>
                </div>
            )}

            {/* ═══ MAIN CONTENT ═══ */}
            {hasFetched && !error && data.length > 0 && (
                <div className={`space-y-5 ${(loading || syncing) ? 'opacity-50 pointer-events-none' : ''} transition-opacity duration-300`}>

                    {/* KPI Cards */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 lg:flex lg:flex-nowrap gap-2.5">

                        {/* THỰC THU — hero card */}
                        <div className="col-span-2 sm:col-span-4 lg:w-fit lg:shrink-0">
                            <KPICard hero title="Thực thu" value={fmtVND(dailyPanel?.shopSummary?.shopRealMoney ?? kpis.totalReal)}
                                sub=""
                                icon={<DollarSign className="size-5 text-white" />} accent="bg-success-500" />
                        </div>

                        {/* TIỀN MẶT */}
                        <div className="col-span-1 lg:flex-1 lg:min-w-0" style={{ '--kpi-accent': '#3b82f6' } as React.CSSProperties}>
                            <KPICard title="Tiền mặt" value={fmtVND(kpis.totalCash)}
                                sub={`${kpis.totalReal > 0 ? ((kpis.totalCash / kpis.totalReal) * 100).toFixed(0) : 0}% tổng thu`}
                                icon={<Banknote className="size-5 text-primary-600" />} accent="bg-primary-500" />
                        </div>

                        {/* CHUYỂN KHOẢN */}
                        <div className="col-span-1 lg:flex-1 lg:min-w-0" style={{ '--kpi-accent': '#8b5cf6' } as React.CSSProperties}>
                            <KPICard title="Chuyển khoản" value={fmtVND(kpis.totalTransfer)}
                                sub={`${kpis.totalReal > 0 ? ((kpis.totalTransfer / kpis.totalReal) * 100).toFixed(0) : 0}% tổng thu`}
                                icon={<ArrowUpDown className="size-5 text-accent-600" />} accent="bg-accent-500" />
                        </div>

                        {/* XU BÁN */}
                        <div className="col-span-1 lg:flex-1 lg:min-w-0" style={{ '--kpi-accent': '#f59e0b' } as React.CSSProperties}>
                            <KPICard title="Xu bán" value={fmt(kpis.totalCoins)}
                                sub={`Đơn giá: ${fmtVND(data[0]?.sellCoinPrice || 0)}`}
                                icon={<Coins className="size-5 text-warning-600" />} accent="bg-warning-500" />
                        </div>

                        {/* ĐÃ HỦY / NGÀY CAO NHẤT */}
                        {isMultiDay ? (
                            <div className="col-span-1 lg:flex-1 lg:min-w-0" style={{ '--kpi-accent': '#ec4899' } as React.CSSProperties}>
                                <KPICard title="Ngày cao nhất" value={kpis.peakDay ? fmtShort(kpis.peakDay.realMoney) : '—'}
                                    sub={kpis.peakDay?.forDate || 'N/A'}
                                    icon={<TrendingUp className="size-5 text-pink-600" />} accent="bg-pink-500" />
                            </div>
                        ) : (
                            <div className="col-span-1 lg:flex-1 lg:min-w-0" style={{ '--kpi-accent': '#ef4444' } as React.CSSProperties}>
                                <KPICard title="Đã hủy" value={fmtVND(kpis.totalRefund)}
                                    sub={kpis.totalRefund > 0 ? 'Giao dịch bị hủy' : 'Không có hủy đơn'}
                                    icon={<XCircle className="size-5 text-danger-500" />} accent="bg-danger-500" />
                            </div>
                        )}
                    </div>

                    {/* ═══ OVERVIEW TAB ═══ */}
                    {viewTab === 'overview' && (
                        <div className="space-y-5">
                            {/* Row 1: Area chart + Payment pie */}
                            <div className="grid gap-4 lg:grid-cols-3">
                                {isMultiDay ? (
                                    /* Multi-day area chart */
                                    <div className="lg:col-span-2 bg-white rounded-2xl border border-surface-100 shadow-sm p-5">
                                        <div className="flex items-start justify-between mb-4">
                                            <div>
                                                <h3 className="text-sm font-bold text-surface-700">Doanh thu theo ngày</h3>
                                                <p className="text-xs text-surface-400 mt-0.5">Thực thu, tiền mặt và chuyển khoản</p>
                                            </div>
                                            <div className="text-right">
                                                <p className="text-2xl font-bold text-surface-800">{fmtShort(kpis.totalReal)}</p>
                                                <p className="text-[10px] text-surface-400 uppercase tracking-wider">{data.length} ngày</p>
                                            </div>
                                        </div>
                                        <div className="h-[260px]">
                                            <ResponsiveContainer width="100%" height="100%">
                                                <AreaChart data={chartData} margin={{ top: 5, right: 5, left: 0, bottom: 0 }}>
                                                    <defs>
                                                        <linearGradient id="gReal" x1="0" y1="0" x2="0" y2="1">
                                                            <stop offset="0%" stopColor="#10b981" stopOpacity={0.2} />
                                                            <stop offset="100%" stopColor="#10b981" stopOpacity={0.01} />
                                                        </linearGradient>
                                                        <linearGradient id="gCash" x1="0" y1="0" x2="0" y2="1">
                                                            <stop offset="0%" stopColor="#3b82f6" stopOpacity={0.15} />
                                                            <stop offset="100%" stopColor="#3b82f6" stopOpacity={0.01} />
                                                        </linearGradient>
                                                        <linearGradient id="gTrans" x1="0" y1="0" x2="0" y2="1">
                                                            <stop offset="0%" stopColor="#8b5cf6" stopOpacity={0.15} />
                                                            <stop offset="100%" stopColor="#8b5cf6" stopOpacity={0.01} />
                                                        </linearGradient>
                                                    </defs>
                                                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                                                    <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#94a3b8' }} />
                                                    <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#94a3b8' }} tickFormatter={fmtShort} width={48} />
                                                    <RechartsTooltip content={<ChartTooltip />} />
                                                    <Legend iconType="circle" iconSize={7} wrapperStyle={{ fontSize: '11px', paddingTop: '8px' }} />
                                                    <Area type="monotone" dataKey="Thực thu" stroke="#10b981" strokeWidth={2.5} fill="url(#gReal)" dot={false} activeDot={{ r: 4, strokeWidth: 2, stroke: '#fff' }} />
                                                    <Area type="monotone" dataKey="Tiền mặt" stroke="#3b82f6" strokeWidth={1.5} fill="url(#gCash)" dot={false} activeDot={{ r: 3 }} />
                                                    <Area type="monotone" dataKey="Chuyển khoản" stroke="#8b5cf6" strokeWidth={1.5} fill="url(#gTrans)" dot={false} activeDot={{ r: 3 }} />
                                                </AreaChart>
                                            </ResponsiveContainer>
                                        </div>
                                    </div>
                                ) : (
                                    /* Single-day summary */
                                    <div className="lg:col-span-2 bg-white rounded-2xl border border-surface-100 shadow-sm p-5">
                                        <div className="flex items-center justify-between mb-4">
                                            <div>
                                                <h3 className="text-sm font-bold text-surface-700">
                                                    Tổng kết ngày {data[0]?.forDate ?? dayDate}
                                                </h3>
                                                {dailyPanel?.shopSummary?.lastRefreshTime && (
                                                    <p className="text-xs text-surface-400 mt-0.5 truncate max-w-[280px]">{dailyPanel.shopSummary.lastRefreshTime}</p>
                                                )}
                                            </div>
                                            <div className="text-right">
                                                <p className="text-2xl font-bold text-success-600">{fmtShort(dailyPanel?.shopSummary?.shopRealMoney ?? kpis.totalReal)}</p>
                                                <p className="text-[10px] text-surface-400 uppercase tracking-wider">Doanh thu thực</p>
                                            </div>
                                        </div>
                                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                                            {[
                                                { l: 'Tổng hoá đơn', v: fmtVND(dailyPanel?.shopSummary?.shopMoney ?? 0), c: 'text-surface-700', bg: 'bg-surface-50' },
                                                { l: 'Thực thu', v: fmtVND(dailyPanel?.shopSummary?.shopRealMoney ?? kpis.totalReal), c: 'text-success-700', bg: 'bg-success-50' },
                                                { l: 'Đã hủy', v: fmtVND(dailyPanel?.shopSummary?.refundMoney ?? 0), c: 'text-danger-600', bg: 'bg-danger-50' },
                                                { l: 'Tiền mặt', v: fmtVND(kpis.totalCash), c: 'text-primary-700', bg: 'bg-primary-50' },
                                                { l: 'Chuyển khoản', v: fmtVND(kpis.totalTransfer), c: 'text-accent-700', bg: 'bg-accent-50' },
                                                { l: 'Xu bán', v: fmt(kpis.totalCoins), c: 'text-warning-700', bg: 'bg-warning-50' },
                                            ].map(item => (
                                                <div key={item.l} className={`${item.bg} rounded-xl p-2.5`}>
                                                    <p className="text-[10px] uppercase tracking-widest text-surface-400 font-semibold leading-tight">{item.l}</p>
                                                    <p className={`text-xs sm:text-sm font-bold mt-1 break-words leading-snug ${item.c}`}>{item.v}</p>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}

                                {/* Payment Pie */}
                                <div className="bg-white rounded-2xl border border-surface-100 shadow-sm p-5">
                                    <h3 className="text-sm font-bold text-surface-700 mb-1">Phương thức thanh toán</h3>
                                    <p className="text-xs text-surface-400 mb-3">Tỉ lệ phân bổ doanh thu</p>
                                    <div className="h-[160px]">
                                        <ResponsiveContainer width="100%" height="100%">
                                            <PieChart>
                                                <Pie data={paymentPieData} cx="50%" cy="50%" innerRadius={45} outerRadius={75}
                                                    paddingAngle={3} dataKey="value" labelLine={false} label={PieLabel}>
                                                    {paymentPieData.map((_, i) => <Cell key={i} fill={PALETTE[i % PALETTE.length]} />)}
                                                </Pie>
                                                <RechartsTooltip contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 8px 24px rgb(0 0 0 / 0.12)', fontSize: '12px' }} />
                                            </PieChart>
                                        </ResponsiveContainer>
                                    </div>
                                    <div className="flex flex-col gap-2 mt-2">
                                        {paymentPieData.map((item, i) => {
                                            const total = paymentPieData.reduce((s, d) => s + d.value, 0);
                                            const pct = total > 0 ? ((item.value / total) * 100).toFixed(0) : '0';
                                            const stat = dailyPanel?.paymentStats?.find(p => p.paymentCategoryName === item.name);
                                            return (
                                                <div key={item.name} className="flex items-center justify-between group">
                                                    <div className="flex items-center gap-2">
                                                        <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: PALETTE[i % PALETTE.length] }} />
                                                        <span className="text-xs text-surface-600">{item.name}</span>
                                                        {stat && <span className="text-[10px] text-surface-400">{stat.totalRealQty} GD</span>}
                                                    </div>
                                                    <div className="text-right">
                                                        <span className="text-xs font-bold text-surface-800">{fmtShort(item.value)}</span>
                                                        <span className="ml-1 text-[10px] text-surface-400">{pct}%</span>
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                    {/* Payment detail for daily panel */}
                                    {!isMultiDay && dailyPanel?.paymentStats && dailyPanel.paymentStats.some(p => p.totalCancelMoney > 0) && (
                                        <div className="mt-3 pt-3 border-t border-surface-100">
                                            {dailyPanel.paymentStats.filter(p => p.totalCancelMoney > 0).map(p => (
                                                <div key={p.paymentCategory} className="flex items-center justify-between text-[11px] text-danger-400 mt-1">
                                                    <span>{p.paymentCategoryName}: hủy</span>
                                                    <span className="font-semibold">-{fmtShort(p.totalCancelMoney)}</span>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* Xu chart (multi-day only) */}
                            {isMultiDay && coinChartData.some(d => d['Xu bán'] > 0) && (
                                <div className="bg-white rounded-2xl border border-surface-100 shadow-sm p-5">
                                    <div className="flex items-start justify-between mb-4">
                                        <div>
                                            <h3 className="text-sm font-bold text-surface-700">Xu bán theo ngày</h3>
                                            <p className="text-xs text-surface-400 mt-0.5">Số lượng xu bán ra từng ngày</p>
                                        </div>
                                        <div className="text-right">
                                            <p className="text-2xl font-bold text-warning-600">{fmt(kpis.totalCoins)}</p>
                                            <p className="text-[10px] text-surface-400 uppercase tracking-wider">Tổng xu</p>
                                        </div>
                                    </div>
                                    <div className="h-[180px]">
                                        <ResponsiveContainer width="100%" height="100%">
                                            <BarChart data={coinChartData} margin={{ top: 5, right: 5, left: 0, bottom: 0 }}>
                                                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                                                <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#94a3b8' }} />
                                                <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#94a3b8' }} tickFormatter={fmtShort} width={40} />
                                                <RechartsTooltip cursor={{ fill: '#fafafa', radius: 8 }} contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 8px 24px rgb(0 0 0 / 0.1)', fontSize: '12px' }} />
                                                <Bar dataKey="Xu bán" fill="#f59e0b" radius={[6, 6, 0, 0]} barSize={20} />
                                            </BarChart>
                                        </ResponsiveContainer>
                                    </div>
                                </div>
                            )}

                            {/* Product analytics section */}
                            {(sellData.length > 0 || (dailyPanel?.goodsTypeStats && dailyPanel.goodsTypeStats.length > 0)) && (
                                <div className="space-y-4">
                                    <SectionHeader
                                        icon={<ShoppingBag className="size-4 text-accent-600" />}
                                        title="Phân tích sản phẩm"
                                        subtitle={isMultiDay ? 'Danh mục & sản phẩm bán chạy' : 'Hàng hóa trong ngày'} />

                                    {/* Pie + Top products bar */}
                                    <div className="grid gap-4 lg:grid-cols-2">
                                        {/* Goods type pie */}
                                        <div className="bg-white rounded-2xl border border-surface-100 shadow-sm p-5">
                                            <h3 className="text-sm font-bold text-surface-700 mb-1">Doanh thu theo danh mục</h3>
                                            <p className="text-xs text-surface-400 mb-3">Phân bổ doanh thu giữa các nhóm</p>
                                            <div className="h-[180px]">
                                                <ResponsiveContainer width="100%" height="100%">
                                                    <PieChart>
                                                        <Pie data={goodsPieData} cx="50%" cy="50%" innerRadius={45} outerRadius={80}
                                                            paddingAngle={2} dataKey="value" labelLine={false} label={PieLabel}>
                                                            {goodsPieData.map((_, i) => <Cell key={i} fill={PALETTE[i % PALETTE.length]} />)}
                                                        </Pie>
                                                        <RechartsTooltip contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 8px 24px rgb(0 0 0 / 0.12)', fontSize: '12px' }} />
                                                    </PieChart>
                                                </ResponsiveContainer>
                                            </div>
                                            <div className="flex flex-col gap-2 mt-2">
                                                {goodsPieData.map((item, i) => {
                                                    const total = goodsPieData.reduce((s, d) => s + d.value, 0);
                                                    return (
                                                        <div key={item.name} className="flex items-center justify-between">
                                                            <div className="flex items-center gap-2">
                                                                <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: PALETTE[i % PALETTE.length] }} />
                                                                <span className="text-xs text-surface-600 truncate max-w-[140px]">{item.name}</span>
                                                            </div>
                                                            <div className="text-right">
                                                                <span className="text-xs font-bold text-surface-800">{fmtShort(item.value)}</span>
                                                                <span className="ml-1 text-[10px] text-surface-400">{total > 0 ? ((item.value / total) * 100).toFixed(0) : 0}%</span>
                                                            </div>
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        </div>

                                        {/* Top products horizontal bar */}
                                        <div className="bg-white rounded-2xl border border-surface-100 shadow-sm p-5">
                                            <h3 className="text-sm font-bold text-surface-700 mb-1">Top sản phẩm doanh thu cao</h3>
                                            <p className="text-xs text-surface-400 mb-3">10 sản phẩm dẫn đầu</p>
                                            <div className="h-[310px]">
                                                <ResponsiveContainer width="100%" height="100%">
                                                    <BarChart
                                                        data={topProducts.map(p => ({ name: p.goodsName.length > 20 ? p.goodsName.slice(0, 20) + '…' : p.goodsName, 'Doanh thu': p.realMoney }))}
                                                        layout="vertical" margin={{ top: 0, right: 10, left: 0, bottom: 0 }}>
                                                        <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} stroke="#f1f5f9" />
                                                        <XAxis type="number" hide />
                                                        <YAxis dataKey="name" type="category" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#64748b' }} width={148} />
                                                        <RechartsTooltip content={<ChartTooltip />} />
                                                        <Bar dataKey="Doanh thu" radius={[0, 6, 6, 0]} barSize={16}>
                                                            {topProducts.map((_, i) => <Cell key={i} fill={PALETTE[i % PALETTE.length]} fillOpacity={0.85} />)}
                                                        </Bar>
                                                    </BarChart>
                                                </ResponsiveContainer>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Category detail cards */}
                                    {(() => {
                                        const cats = dailyPanel?.goodsTypeStats?.filter(g => g.totalRealMoney > 0) ??
                                            sellData.filter(c => c.realMoney > 0).map(c => ({
                                                goodsTypeName: c.goodsCategory, totalRealQty: c.realQty, totalRealMoney: c.realMoney,
                                                cancelQty: c.cancelQty, cancelMoney: c.cancelMoney, sellRatioDisplay: '',
                                                goodsItems: c.items.map(it => ({ ...it, goodsId: it.goodsName, goodsTypeId: '', forDate: '', shopId: 0, totalCost: 0, cancelCost: 0, realCost: 0, sellRatioDisplay: '' })),
                                                totalQty: c.totalQty, totalMoney: c.totalMoney, realCost: 0, sellRatio: 0,
                                            }));
                                        return (
                                            <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
                                                {cats.map((cat, ci) => (
                                                    <div key={cat.goodsTypeName} className="bg-white rounded-2xl border border-surface-100 shadow-sm overflow-hidden">
                                                        <div className="flex items-center gap-3 px-4 pt-4 pb-3">
                                                            <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ backgroundColor: PALETTE[ci % PALETTE.length] + '20' }}>
                                                                <Package className="size-4" style={{ color: PALETTE[ci % PALETTE.length] }} />
                                                            </div>
                                                            <div className="min-w-0 flex-1">
                                                                <p className="text-sm font-bold text-surface-700 truncate">{cat.goodsTypeName}</p>
                                                                <p className="text-[11px] text-surface-400">
                                                                    {cat.totalRealQty} SP · {fmtVND(cat.totalRealMoney)}
                                                                    {cat.cancelQty > 0 && <span className="ml-1 text-danger-400">· Hủy: {cat.cancelQty}</span>}
                                                                </p>
                                                            </div>
                                                        </div>
                                                        <div className="border-t border-surface-50">
                                                            {cat.goodsItems.filter(it => it.realMoney > 0).sort((a, b) => b.realMoney - a.realMoney).slice(0, 5).map(item => (
                                                                <div key={item.goodsName} className="flex items-center justify-between px-4 py-2.5 hover:bg-surface-50/60 transition-colors">
                                                                    <div className="min-w-0 flex-1 pr-3">
                                                                        <p className="text-xs font-medium text-surface-700 truncate">{item.goodsName}</p>
                                                                        <p className="text-[10px] text-surface-400">SL: {item.realQty}{item.sellRatio > 0 ? ` · ${(item.sellRatio * 100).toFixed(1)}%` : ''}</p>
                                                                    </div>
                                                                    <div className="text-right shrink-0">
                                                                        <p className="text-xs font-bold text-surface-800">{fmtShort(item.realMoney)}</p>
                                                                        {item.cancelQty > 0 && <p className="text-[10px] text-danger-400">-{item.cancelQty}</p>}
                                                                    </div>
                                                                </div>
                                                            ))}
                                                            {cat.goodsItems.filter(i => i.realMoney > 0).length > 5 && (
                                                                <p className="text-center text-[10px] text-surface-400 py-2">+{cat.goodsItems.filter(i => i.realMoney > 0).length - 5} sản phẩm khác</p>
                                                            )}
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        );
                                    })()}
                                </div>
                            )}
                        </div>
                    )}

                    {/* ═══ TABLE TAB ═══ */}
                    {viewTab === 'table' && (
                        <div className="bg-white rounded-2xl border border-surface-100 shadow-sm overflow-hidden">
                            <div className="px-5 py-4 border-b border-surface-100 flex items-center justify-between">
                                <div>
                                    <h3 className="text-sm font-bold text-surface-700">Chi tiết doanh thu</h3>
                                    <p className="text-xs text-surface-400 mt-0.5">{data.length} bản ghi · {activeRange}</p>
                                </div>
                                <div className="text-right">
                                    <p className="text-lg font-bold text-surface-800">{fmtShort(kpis.totalReal)}</p>
                                    <p className="text-[10px] text-surface-400 uppercase tracking-wider">Tổng thực thu</p>
                                </div>
                            </div>
                            <div className="overflow-x-auto -mx-0 scrollbar-thin">
                                <p className="text-[10px] text-surface-400 sm:hidden px-5 py-1.5 bg-surface-50 border-b border-surface-100 flex items-center gap-1">
                                    ← Vuốt ngang để xem thêm →
                                </p>
                                <table className="w-full text-sm">
                                    <thead>
                                        <tr className="bg-surface-50">
                                            {['Ngày', 'Thực thu', 'Phải thu', 'Bán hàng', 'Tiền mặt', 'Lỗi TM', 'Chuyển khoản', 'Xu bán'].map((h, i) => (
                                                <th key={h} className={`px-4 py-3 text-[11px] font-semibold uppercase tracking-wider text-surface-500 whitespace-nowrap ${i === 0 ? 'text-left sticky left-0 bg-surface-50 z-10' : 'text-right'}`}>{h}</th>
                                            ))}
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-surface-50">
                                        {[...data].sort((a, b) => b.forDate.localeCompare(a.forDate)).map((row, idx) => (
                                            <tr key={row.forDate} className={`hover:bg-accent-50/30 transition-colors ${idx % 2 === 0 ? '' : 'bg-surface-50/30'}`}>
                                                <td className="px-4 py-3 font-semibold text-surface-700 whitespace-nowrap sticky left-0 bg-white z-10">{row.forDate}</td>
                                                <td className="px-4 py-3 text-right font-bold text-success-700 whitespace-nowrap">{fmtVND(row.realMoney)}</td>
                                                <td className="px-4 py-3 text-right text-surface-600 whitespace-nowrap">{fmtVND(row.sysMoney)}</td>
                                                <td className="px-4 py-3 text-right text-surface-600 whitespace-nowrap">{fmtVND(row.saleSubMoney)}</td>
                                                <td className="px-4 py-3 text-right text-primary-700 whitespace-nowrap">{fmtVND(row.cashRealMoney)}</td>
                                                <td className={`px-4 py-3 text-right whitespace-nowrap font-medium ${row.cashErrorMoney !== 0 ? 'text-warning-600' : 'text-surface-300'}`}>
                                                    {row.cashErrorMoney !== 0 ? fmtVND(row.cashErrorMoney) : '—'}
                                                </td>
                                                <td className="px-4 py-3 text-right text-accent-700 whitespace-nowrap">{fmtVND(row.transferRealMoney)}</td>
                                                <td className="px-4 py-3 text-right text-warning-700 whitespace-nowrap">{fmt(row.sellCoinAmount)}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                    <tfoot>
                                        <tr className="border-t-2 border-surface-200 bg-accent-50/30">
                                            <td className="px-4 py-3 font-bold text-surface-700 sticky left-0 bg-accent-50/30 z-10 text-xs uppercase tracking-wider">Tổng cộng</td>
                                            <td className="px-4 py-3 text-right font-bold text-success-700">{fmtVND(kpis.totalReal)}</td>
                                            <td className="px-4 py-3 text-right font-bold text-surface-700">{fmtVND(kpis.totalSys)}</td>
                                            <td className="px-4 py-3 text-right font-bold text-surface-700">{fmtVND(data.reduce((s, d) => s + d.saleSubMoney, 0))}</td>
                                            <td className="px-4 py-3 text-right font-bold text-primary-700">{fmtVND(kpis.totalCash)}</td>
                                            <td className="px-4 py-3 text-right font-bold text-warning-600">{fmtVND(data.reduce((s, d) => s + d.cashErrorMoney, 0))}</td>
                                            <td className="px-4 py-3 text-right font-bold text-accent-700">{fmtVND(kpis.totalTransfer)}</td>
                                            <td className="px-4 py-3 text-right font-bold text-warning-700">{fmt(kpis.totalCoins)}</td>
                                        </tr>
                                    </tfoot>
                                </table>
                            </div>
                        </div>
                    )}
                </div>
            )}

            {/* ═══ ORDERS TAB ═══ */}
            {viewTab === 'orders' && (
                <OrdersPanel getRange={getRange} />
            )}

            {/* Empty state */}
            {!loading && hasFetched && !error && data.length === 0 && (
                <div className="flex flex-col items-center justify-center py-20 gap-4 bg-white rounded-3xl border border-surface-100">
                    <div className="w-16 h-16 rounded-2xl bg-surface-100 flex items-center justify-center">
                        <BarChart3 className="size-8 text-surface-300" />
                    </div>
                    <div className="text-center">
                        <p className="text-sm font-semibold text-surface-600">Không có dữ liệu</p>
                        <p className="text-xs text-surface-400 mt-1">Nhấn <strong>Sync</strong> để tải dữ liệu từ Joyworld.</p>
                    </div>
                    <button onClick={handleSync} disabled={syncing}
                        className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-accent-600 text-white text-sm font-semibold shadow-sm hover:bg-accent-700 transition-all disabled:opacity-50">
                        <RefreshCw className={`size-4 ${syncing ? 'animate-spin' : ''}`} />
                        {syncing ? 'Đang tải...' : 'Đồng bộ ngay'}
                    </button>
                </div>
            )}
        </div>
    );
}
