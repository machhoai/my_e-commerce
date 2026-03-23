'use client';

import { useState, useMemo, useCallback, useEffect, useTransition } from 'react';
import {
    Search, RefreshCw, ChevronLeft, ChevronRight,
    ShoppingCart, User, CreditCard, Package, Receipt,
    CheckCircle2, XCircle, AlertCircle, Clock, Loader2,
    Filter, X, Banknote,
} from 'lucide-react';
import {
    fetchOrdersAction, fetchOrderDetailAction, fetchOrderGoodsAction,
    type OrderRecord, type OrderFilters, type OrderDetailData, type GoodsRecord, type GoodsFilters,
} from '@/app/desktop/(dashboard)/office/revenue/orders/actions';
import BottomSheet from '@/components/shared/BottomSheet';
import { cn } from '@/lib/utils';

const fmtVND = (v: number) => v.toLocaleString('vi-VN', { style: 'currency', currency: 'VND', maximumFractionDigits: 0 });
function fmtShort(v: number) {
    if (v >= 1_000_000_000) return `${(v / 1_000_000_000).toFixed(1)} tỷ`;
    if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(1)}M`;
    if (v >= 1_000) return `${(v / 1_000).toFixed(0)}K`;
    return v.toLocaleString('vi-VN');
}

const STATUS_STYLE: Record<number, { cls: string; icon: React.ReactNode }> = {
    1: { cls: 'bg-amber-50 text-amber-700 border-amber-200', icon: <Clock className="w-2.5 h-2.5" /> },
    2: { cls: 'bg-blue-50 text-blue-700 border-blue-200', icon: <AlertCircle className="w-2.5 h-2.5" /> },
    3: { cls: 'bg-emerald-50 text-emerald-700 border-emerald-200', icon: <CheckCircle2 className="w-2.5 h-2.5" /> },
    4: { cls: 'bg-red-50 text-red-700 border-red-200', icon: <XCircle className="w-2.5 h-2.5" /> },
};

function StatusBadge({ status, label }: { status: number; label: string }) {
    const s = STATUS_STYLE[status] ?? { cls: 'bg-gray-50 text-gray-500 border-gray-200', icon: null };
    return <span className={cn('inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-[9px] font-bold border', s.cls)}>{s.icon}{label}</span>;
}

interface Props {
    startDate: string;
    endDate: string;
}

export default function MobileOrdersPanel({ startDate, endDate }: Props) {
    // ── Data states ──────────────────────────────────────────────────────────
    const [allOrders, setAllOrders] = useState<OrderRecord[]>([]);
    const [filters, setFilters] = useState<OrderFilters>({ employees: [], statuses: [], payMethods: [], terminals: [] });
    const [allGoods, setAllGoods] = useState<GoodsRecord[]>([]);
    const [goodsFilters, setGoodsFilters] = useState<GoodsFilters>({ categories: [], goodsNames: [], employees: [], statuses: [] });
    const [fetched, setFetched] = useState(false);
    const [fetchError, setFetchError] = useState('');
    const [isPending, startTransition] = useTransition();

    // ── View mode ────────────────────────────────────────────────────────────
    const [viewMode, setViewMode] = useState<'orders' | 'goods'>('orders');

    // ── Filter states ────────────────────────────────────────────────────────
    const [search, setSearch] = useState('');
    const [selEmployee, setSelEmployee] = useState('ALL');
    const [selStatus, setSelStatus] = useState('ALL');
    const [selPayMethod, setSelPayMethod] = useState('ALL');
    const [selTerminal, setSelTerminal] = useState('ALL');
    const [gSearch, setGSearch] = useState('');
    const [gSelCategory, setGSelCategory] = useState('ALL');
    const [gSelEmployee, setGSelEmployee] = useState('ALL');
    const [gSelStatus, setGSelStatus] = useState('ALL');

    // ── UI states ────────────────────────────────────────────────────────────
    const [filterSheetOpen, setFilterSheetOpen] = useState(false);
    const [detailSheetOpen, setDetailSheetOpen] = useState(false);
    const [selectedOrder, setSelectedOrder] = useState<OrderRecord | null>(null);
    const [detail, setDetail] = useState<OrderDetailData | null>(null);
    const [detailLoading, setDetailLoading] = useState(false);
    const [currentPage, setCurrentPage] = useState(1);
    const [gCurrentPage, setGCurrentPage] = useState(1);
    const PAGE_SIZE = 20;

    // ── Fetch ────────────────────────────────────────────────────────────────
    const loadData = useCallback((start: string, end: string) => {
        startTransition(async () => {
            setFetchError('');
            const [ordRes, goodsRes] = await Promise.all([
                fetchOrdersAction(start, end),
                fetchOrderGoodsAction(start, end),
            ]);
            if (!ordRes.success) { setFetchError(ordRes.error ?? 'Lỗi'); setAllOrders([]); }
            else { setAllOrders(ordRes.data); setFilters(ordRes.filters); }
            if (goodsRes.success) { setAllGoods(goodsRes.data); setGoodsFilters(goodsRes.filters); }
            setFetched(true);
            setSelEmployee('ALL'); setSelStatus('ALL'); setSelPayMethod('ALL'); setSelTerminal('ALL'); setSearch('');
            setGSelCategory('ALL'); setGSelEmployee('ALL'); setGSelStatus('ALL'); setGSearch('');
            setCurrentPage(1); setGCurrentPage(1);
        });
    }, []);

    useEffect(() => { loadData(startDate, endDate); }, [startDate, endDate]); // eslint-disable-line react-hooks/exhaustive-deps

    // ── Filter logic ─────────────────────────────────────────────────────────
    const filteredOrders = useMemo(() => {
        let list = allOrders;
        if (selEmployee !== 'ALL') list = list.filter(o => o.employeeName === selEmployee);
        if (selStatus !== 'ALL') list = list.filter(o => String(o.status) === selStatus);
        if (selPayMethod !== 'ALL') list = list.filter(o => o.payModeNames.includes(selPayMethod));
        if (selTerminal !== 'ALL') list = list.filter(o => o.terminalName === selTerminal);
        if (search.trim()) { const q = search.trim().toLowerCase(); list = list.filter(o => o.orderNumber.toLowerCase().includes(q) || o.goodsNames.toLowerCase().includes(q) || o.employeeName.toLowerCase().includes(q)); }
        return list;
    }, [allOrders, selEmployee, selStatus, selPayMethod, selTerminal, search]);

    const filteredGoods = useMemo(() => {
        let list = allGoods;
        if (gSelCategory !== 'ALL') list = list.filter(g => g.showCategoryName === gSelCategory);
        if (gSelEmployee !== 'ALL') list = list.filter(g => g.employeeName === gSelEmployee);
        if (gSelStatus !== 'ALL') list = list.filter(g => String(g.status) === gSelStatus);
        if (gSearch.trim()) { const q = gSearch.trim().toLowerCase(); list = list.filter(g => g.goodsName.toLowerCase().includes(q) || g.orderNumber.toLowerCase().includes(q)); }
        return list;
    }, [allGoods, gSelCategory, gSelEmployee, gSelStatus, gSearch]);

    useEffect(() => { setCurrentPage(1); }, [selEmployee, selStatus, selPayMethod, selTerminal, search]);
    useEffect(() => { setGCurrentPage(1); }, [gSelCategory, gSelEmployee, gSelStatus, gSearch]);

    // ── Pagination ───────────────────────────────────────────────────────────
    const totalPages = Math.max(1, Math.ceil(filteredOrders.length / PAGE_SIZE));
    const paginatedOrders = useMemo(() => filteredOrders.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE), [filteredOrders, currentPage]);
    const gTotalPages = Math.max(1, Math.ceil(filteredGoods.length / PAGE_SIZE));
    const paginatedGoods = useMemo(() => filteredGoods.slice((gCurrentPage - 1) * PAGE_SIZE, gCurrentPage * PAGE_SIZE), [filteredGoods, gCurrentPage]);

    // ── Detail ───────────────────────────────────────────────────────────────
    const openDetail = async (order: OrderRecord) => {
        setSelectedOrder(order); setDetail(null); setDetailLoading(true); setDetailSheetOpen(true);
        const res = await fetchOrderDetailAction(order.orderId);
        setDetail(res.data); setDetailLoading(false);
    };

    // ── Computed ──────────────────────────────────────────────────────────────
    const activeFilterCount = viewMode === 'orders'
        ? [selEmployee, selStatus, selPayMethod, selTerminal].filter(v => v !== 'ALL').length
        : [gSelCategory, gSelEmployee, gSelStatus].filter(v => v !== 'ALL').length;

    const clearFilters = () => {
        if (viewMode === 'orders') { setSelEmployee('ALL'); setSelStatus('ALL'); setSelPayMethod('ALL'); setSelTerminal('ALL'); }
        else { setGSelCategory('ALL'); setGSelEmployee('ALL'); setGSelStatus('ALL'); }
    };

    const currentSearch = viewMode === 'orders' ? search : gSearch;
    const setCurrentSearch = viewMode === 'orders' ? setSearch : setGSearch;

    // ── Render ───────────────────────────────────────────────────────────────
    return (
        <div className="space-y-3">
            {/* ── Toggle: Đơn hàng / Hàng hóa ──────────────────────────── */}
            <div className="flex gap-1 bg-gray-100 rounded-lg p-0.5">
                <button onClick={() => setViewMode('orders')}
                    className={cn('flex-1 flex items-center justify-center gap-1 py-2 rounded-md text-[11px] font-bold transition-all',
                        viewMode === 'orders' ? 'bg-white text-primary-700 shadow-sm' : 'text-gray-500')}>
                    <ShoppingCart className="w-3 h-3" />Đơn hàng {fetched && <span className="bg-gray-200 text-gray-600 px-1 rounded-full text-[9px]">{allOrders.length}</span>}
                </button>
                <button onClick={() => setViewMode('goods')}
                    className={cn('flex-1 flex items-center justify-center gap-1 py-2 rounded-md text-[11px] font-bold transition-all',
                        viewMode === 'goods' ? 'bg-white text-primary-700 shadow-sm' : 'text-gray-500')}>
                    <Package className="w-3 h-3" />Hàng hóa {fetched && <span className="bg-gray-200 text-gray-600 px-1 rounded-full text-[9px]">{allGoods.length}</span>}
                </button>
            </div>

            {/* ── Search + Filter button ─────────────────────────────────── */}
            <div className="flex items-center gap-2">
                <div className="relative flex-1">
                    <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400 pointer-events-none" />
                    <input value={currentSearch} onChange={e => setCurrentSearch(e.target.value)}
                        placeholder={viewMode === 'orders' ? 'Mã, sản phẩm, NV...' : 'Tên hàng, mã đơn...'}
                        className="w-full pl-8 pr-3 py-2 border border-gray-200 rounded-lg bg-white text-[11px] text-gray-700 outline-none focus:border-primary-400 focus:ring-1 focus:ring-primary-100" />
                    {currentSearch && (
                        <button onClick={() => setCurrentSearch('')} className="absolute right-2 top-1/2 -translate-y-1/2">
                            <X className="w-3 h-3 text-gray-400" />
                        </button>
                    )}
                </div>
                <button onClick={() => setFilterSheetOpen(true)}
                    className={cn('relative w-9 h-9 rounded-lg border flex items-center justify-center shrink-0 transition-all',
                        activeFilterCount > 0 ? 'bg-primary-50 border-primary-200 text-primary-600' : 'bg-white border-gray-200 text-gray-500')}>
                    <Filter className="w-4 h-4" />
                    {activeFilterCount > 0 && (
                        <span className="absolute -top-1 -right-1 w-4 h-4 bg-primary-600 text-white text-[8px] font-bold rounded-full flex items-center justify-center">{activeFilterCount}</span>
                    )}
                </button>
                <button onClick={() => loadData(startDate, endDate)} disabled={isPending}
                    className="w-9 h-9 rounded-lg border border-gray-200 bg-white flex items-center justify-center shrink-0 active:scale-95 transition-all disabled:opacity-40">
                    <RefreshCw className={cn('w-4 h-4 text-gray-500', isPending && 'animate-spin')} />
                </button>
            </div>

            {/* ── Loading ─────────────────────────────────────────────────── */}
            {isPending && !fetched && (
                <div className="flex flex-col items-center py-12">
                    <div className="w-6 h-6 border-2 border-primary-200 border-t-primary-600 rounded-full animate-spin mb-2" />
                    <p className="text-[11px] text-gray-500">Đang tải đơn hàng...</p>
                </div>
            )}

            {/* ── Error ───────────────────────────────────────────────────── */}
            {fetchError && (
                <div className="flex items-center gap-2 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                    <XCircle className="w-3.5 h-3.5 text-red-500 shrink-0" />
                    <p className="text-[11px] font-medium text-red-700">{fetchError}</p>
                </div>
            )}

            {/* ═══ CONTENT ═══ */}
            {fetched && !fetchError && (
                <div className={cn(isPending && 'opacity-50 pointer-events-none')}>

                    {/* ── ORDERS VIEW ──────────────────────────────────────── */}
                    {viewMode === 'orders' && (<>
                        {/* Summary pills */}
                        {filteredOrders.length > 0 && (
                            <div className="flex gap-1.5 overflow-x-auto scrollbar-hide mb-2">
                                {[
                                    { l: `${filteredOrders.length} đơn`, c: 'text-gray-700 bg-gray-100' },
                                    { l: `${fmtShort(filteredOrders.reduce((s, o) => s + o.realMoney, 0))} thu`, c: 'text-emerald-700 bg-emerald-50' },
                                    { l: `${filteredOrders.reduce((s, o) => s + o.totalQty, 0)} SP`, c: 'text-blue-700 bg-blue-50' },
                                ].map(p => (
                                    <span key={p.l} className={cn('px-2 py-1 rounded-full text-[9px] font-bold whitespace-nowrap shrink-0', p.c)}>{p.l}</span>
                                ))}
                            </div>
                        )}

                        {/* Cards */}
                        {filteredOrders.length === 0 ? (
                            <div className="text-center py-12">
                                <ShoppingCart className="w-8 h-8 text-gray-300 mx-auto mb-2" />
                                <p className="text-xs text-gray-500">{allOrders.length === 0 ? 'Không có đơn hàng' : 'Không khớp bộ lọc'}</p>
                                {activeFilterCount > 0 && <button onClick={clearFilters} className="text-[10px] text-primary-600 font-bold mt-1">Xóa bộ lọc</button>}
                            </div>
                        ) : (<>
                            <div className="space-y-2">
                                {paginatedOrders.map(o => (
                                    <button key={o.orderId} onClick={() => openDetail(o)}
                                        className={cn('w-full text-left bg-white rounded-xl border border-gray-100 shadow-sm p-3 active:scale-[0.99] transition-all', o.status === 4 && 'opacity-60')}>
                                        <div className="flex items-start justify-between gap-2 mb-1.5">
                                            <div className="flex-1 min-w-0">
                                                <p className="text-[11px] font-semibold text-gray-800 truncate">{o.goodsNames || '—'}</p>
                                                <p className="text-[9px] font-mono text-gray-400 mt-0.5">{o.orderNumber.slice(-12)}</p>
                                            </div>
                                            <StatusBadge status={o.status} label={o.statusName} />
                                        </div>
                                        <div className="flex items-center justify-between text-[10px] text-gray-500">
                                            <span className="flex items-center gap-0.5 truncate"><User className="w-2.5 h-2.5 shrink-0" />{o.employeeName || '—'}</span>
                                            <span className="flex items-center gap-0.5 shrink-0"><CreditCard className="w-2.5 h-2.5" />{o.payModeNames || '—'}</span>
                                        </div>
                                        <div className="flex items-center justify-between mt-1.5 pt-1.5 border-t border-gray-50">
                                            <span className="text-[9px] text-gray-400">{o.createTime.slice(0, 16)}</span>
                                            <span className={cn('text-xs font-black', o.status === 4 ? 'text-gray-400 line-through' : 'text-emerald-700')}>{fmtShort(o.realMoney)}</span>
                                        </div>
                                    </button>
                                ))}
                            </div>

                            {/* Pagination */}
                            {totalPages > 1 && (
                                <div className="flex items-center justify-between mt-3">
                                    <p className="text-[10px] text-gray-400">{currentPage}/{totalPages} · {filteredOrders.length} đơn</p>
                                    <div className="flex gap-1">
                                        <button onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage <= 1}
                                            className="w-8 h-8 rounded-lg border border-gray-200 flex items-center justify-center disabled:opacity-30"><ChevronLeft className="w-4 h-4 text-gray-600" /></button>
                                        <button onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} disabled={currentPage >= totalPages}
                                            className="w-8 h-8 rounded-lg border border-gray-200 flex items-center justify-center disabled:opacity-30"><ChevronRight className="w-4 h-4 text-gray-600" /></button>
                                    </div>
                                </div>
                            )}
                        </>)}
                    </>)}

                    {/* ── GOODS VIEW ───────────────────────────────────────── */}
                    {viewMode === 'goods' && (<>
                        {filteredGoods.length > 0 && (
                            <div className="flex gap-1.5 overflow-x-auto scrollbar-hide mb-2">
                                {[
                                    { l: `${filteredGoods.length} dòng`, c: 'text-gray-700 bg-gray-100' },
                                    { l: `${fmtShort(filteredGoods.reduce((s, g) => s + g.realMoney, 0))} thu`, c: 'text-emerald-700 bg-emerald-50' },
                                    { l: `${filteredGoods.reduce((s, g) => s + g.qty, 0)} SL`, c: 'text-blue-700 bg-blue-50' },
                                ].map(p => (
                                    <span key={p.l} className={cn('px-2 py-1 rounded-full text-[9px] font-bold whitespace-nowrap shrink-0', p.c)}>{p.l}</span>
                                ))}
                            </div>
                        )}

                        {filteredGoods.length === 0 ? (
                            <div className="text-center py-12">
                                <Package className="w-8 h-8 text-gray-300 mx-auto mb-2" />
                                <p className="text-xs text-gray-500">{allGoods.length === 0 ? 'Không có hàng hóa' : 'Không khớp bộ lọc'}</p>
                                {activeFilterCount > 0 && <button onClick={clearFilters} className="text-[10px] text-primary-600 font-bold mt-1">Xóa bộ lọc</button>}
                            </div>
                        ) : (<>
                            <div className="space-y-2">
                                {paginatedGoods.map((g, i) => (
                                    <div key={`${g.orderId}-${g.id}-${i}`}
                                        className={cn('bg-white rounded-xl border border-gray-100 shadow-sm p-3', g.status === 4 && 'opacity-60')}>
                                        <div className="flex items-start justify-between gap-2 mb-1">
                                            <p className="text-[11px] font-semibold text-gray-800 truncate flex-1">{g.goodsName}</p>
                                            <span className={cn('text-xs font-black shrink-0', g.status === 4 ? 'text-gray-400 line-through' : 'text-emerald-700')}>{fmtShort(g.realMoney)}</span>
                                        </div>
                                        <p className="text-[9px] text-gray-400">{g.showCategoryName} · {g.createTime.slice(11, 16)}</p>
                                        <div className="flex items-center justify-between mt-1.5 pt-1.5 border-t border-gray-50 text-[10px] text-gray-500">
                                            <span><User className="w-2.5 h-2.5 inline mr-0.5" />{g.employeeName}</span>
                                            <span>SL: {g.qty} · {fmtShort(g.price)}</span>
                                        </div>
                                    </div>
                                ))}
                            </div>

                            {gTotalPages > 1 && (
                                <div className="flex items-center justify-between mt-3">
                                    <p className="text-[10px] text-gray-400">{gCurrentPage}/{gTotalPages} · {filteredGoods.length} dòng</p>
                                    <div className="flex gap-1">
                                        <button onClick={() => setGCurrentPage(p => Math.max(1, p - 1))} disabled={gCurrentPage <= 1}
                                            className="w-8 h-8 rounded-lg border border-gray-200 flex items-center justify-center disabled:opacity-30"><ChevronLeft className="w-4 h-4 text-gray-600" /></button>
                                        <button onClick={() => setGCurrentPage(p => Math.min(gTotalPages, p + 1))} disabled={gCurrentPage >= gTotalPages}
                                            className="w-8 h-8 rounded-lg border border-gray-200 flex items-center justify-center disabled:opacity-30"><ChevronRight className="w-4 h-4 text-gray-600" /></button>
                                    </div>
                                </div>
                            )}
                        </>)}
                    </>)}
                </div>
            )}

            {/* ═══ FILTER BOTTOMSHEET ═══ */}
            <BottomSheet isOpen={filterSheetOpen} onClose={() => setFilterSheetOpen(false)} title="Bộ lọc">
                <div className="space-y-4 px-4 pb-6">
                    {viewMode === 'orders' ? (<>
                        {/* Employee */}
                        {filters.employees.length > 0 && (
                            <div>
                                <label className="text-[10px] font-bold text-gray-500 uppercase mb-1 block">Nhân viên</label>
                                <select value={selEmployee} onChange={e => setSelEmployee(e.target.value)}
                                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-xs text-gray-700 bg-gray-50 outline-none">
                                    <option value="ALL">Tất cả</option>
                                    {filters.employees.map(e => <option key={e} value={e}>{e}</option>)}
                                </select>
                            </div>
                        )}
                        {/* Status */}
                        {filters.statuses.length > 0 && (
                            <div>
                                <label className="text-[10px] font-bold text-gray-500 uppercase mb-1 block">Trạng thái</label>
                                <div className="flex flex-wrap gap-1.5">
                                    <button onClick={() => setSelStatus('ALL')}
                                        className={cn('px-3 py-1.5 rounded-lg text-[11px] font-bold border transition-all', selStatus === 'ALL' ? 'bg-primary-600 text-white border-primary-600' : 'bg-white border-gray-200 text-gray-600')}>
                                        Tất cả
                                    </button>
                                    {filters.statuses.map(s => (
                                        <button key={s.value} onClick={() => setSelStatus(String(s.value))}
                                            className={cn('px-3 py-1.5 rounded-lg text-[11px] font-bold border transition-all', selStatus === String(s.value) ? 'bg-primary-600 text-white border-primary-600' : 'bg-white border-gray-200 text-gray-600')}>
                                            {s.label}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        )}
                        {/* PayMethod */}
                        {filters.payMethods.length > 0 && (
                            <div>
                                <label className="text-[10px] font-bold text-gray-500 uppercase mb-1 block">Thanh toán</label>
                                <select value={selPayMethod} onChange={e => setSelPayMethod(e.target.value)}
                                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-xs text-gray-700 bg-gray-50 outline-none">
                                    <option value="ALL">Tất cả</option>
                                    {filters.payMethods.map(p => <option key={p} value={p}>{p}</option>)}
                                </select>
                            </div>
                        )}
                        {/* Terminal */}
                        {filters.terminals.length > 1 && (
                            <div>
                                <label className="text-[10px] font-bold text-gray-500 uppercase mb-1 block">Quầy</label>
                                <select value={selTerminal} onChange={e => setSelTerminal(e.target.value)}
                                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-xs text-gray-700 bg-gray-50 outline-none">
                                    <option value="ALL">Tất cả</option>
                                    {filters.terminals.map(t => <option key={t} value={t}>{t}</option>)}
                                </select>
                            </div>
                        )}
                    </>) : (<>
                        {/* Category */}
                        {goodsFilters.categories.length > 0 && (
                            <div>
                                <label className="text-[10px] font-bold text-gray-500 uppercase mb-1 block">Danh mục</label>
                                <select value={gSelCategory} onChange={e => setGSelCategory(e.target.value)}
                                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-xs text-gray-700 bg-gray-50 outline-none">
                                    <option value="ALL">Tất cả</option>
                                    {goodsFilters.categories.map(c => <option key={c} value={c}>{c}</option>)}
                                </select>
                            </div>
                        )}
                        {/* Employee */}
                        {goodsFilters.employees.length > 0 && (
                            <div>
                                <label className="text-[10px] font-bold text-gray-500 uppercase mb-1 block">Nhân viên</label>
                                <select value={gSelEmployee} onChange={e => setGSelEmployee(e.target.value)}
                                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-xs text-gray-700 bg-gray-50 outline-none">
                                    <option value="ALL">Tất cả</option>
                                    {goodsFilters.employees.map(e => <option key={e} value={e}>{e}</option>)}
                                </select>
                            </div>
                        )}
                        {/* Status */}
                        {goodsFilters.statuses.length > 0 && (
                            <div>
                                <label className="text-[10px] font-bold text-gray-500 uppercase mb-1 block">Trạng thái</label>
                                <div className="flex flex-wrap gap-1.5">
                                    <button onClick={() => setGSelStatus('ALL')}
                                        className={cn('px-3 py-1.5 rounded-lg text-[11px] font-bold border transition-all', gSelStatus === 'ALL' ? 'bg-primary-600 text-white border-primary-600' : 'bg-white border-gray-200 text-gray-600')}>
                                        Tất cả
                                    </button>
                                    {goodsFilters.statuses.map(s => (
                                        <button key={s.value} onClick={() => setGSelStatus(String(s.value))}
                                            className={cn('px-3 py-1.5 rounded-lg text-[11px] font-bold border transition-all', gSelStatus === String(s.value) ? 'bg-primary-600 text-white border-primary-600' : 'bg-white border-gray-200 text-gray-600')}>
                                            {s.label}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        )}
                    </>)}

                    {/* Action buttons */}
                    <div className="flex gap-2 pt-2">
                        {activeFilterCount > 0 && (
                            <button onClick={() => { clearFilters(); setFilterSheetOpen(false); }}
                                className="flex-1 py-2.5 rounded-lg border border-gray-200 text-xs font-bold text-gray-600">Xóa lọc</button>
                        )}
                        <button onClick={() => setFilterSheetOpen(false)}
                            className="flex-1 py-2.5 rounded-lg bg-primary-600 text-white text-xs font-bold shadow-sm">
                            Áp dụng{activeFilterCount > 0 ? ` (${activeFilterCount})` : ''}
                        </button>
                    </div>
                </div>
            </BottomSheet>

            {/* ═══ ORDER DETAIL BOTTOMSHEET ═══ */}
            <BottomSheet isOpen={detailSheetOpen} onClose={() => { setDetailSheetOpen(false); setSelectedOrder(null); }} title="Chi tiết đơn hàng">
                <div className="px-4 pb-6">
                    {detailLoading ? (
                        <div className="flex flex-col items-center py-12">
                            <div className="w-6 h-6 border-2 border-primary-200 border-t-primary-600 rounded-full animate-spin mb-2" />
                            <p className="text-[11px] text-gray-500">Đang tải...</p>
                        </div>
                    ) : !detail ? (
                        <p className="text-center py-12 text-xs text-red-500">Không tải được chi tiết</p>
                    ) : (<>
                        {/* Order header */}
                        <div className="flex items-center justify-between mb-3">
                            <div>
                                <p className="text-[9px] font-mono text-gray-400">{selectedOrder?.orderNumber}</p>
                                <p className="text-[10px] text-gray-400 mt-0.5">{selectedOrder?.createTime.slice(0, 16)}</p>
                            </div>
                            {selectedOrder && <StatusBadge status={selectedOrder.status} label={selectedOrder.statusName} />}
                        </div>

                        {/* Money grid */}
                        <div className="grid grid-cols-2 gap-1.5 mb-3">
                            {[
                                { l: 'Giá gốc', v: fmtVND(detail.originalMoney), c: 'text-gray-700' },
                                { l: 'Thực thu', v: fmtVND(detail.realMoney), c: 'text-emerald-700 font-black' },
                                { l: 'Giảm giá', v: fmtVND(detail.discountMoney), c: 'text-amber-700' },
                                { l: 'Thuế', v: fmtVND(detail.taxMoney), c: 'text-gray-600' },
                            ].map(item => (
                                <div key={item.l} className="bg-gray-50 rounded-lg p-2">
                                    <p className="text-[8px] font-bold text-gray-400 uppercase">{item.l}</p>
                                    <p className={cn('text-xs mt-0.5', item.c)}>{item.v}</p>
                                </div>
                            ))}
                        </div>

                        {/* Info */}
                        <div className="bg-gray-50 rounded-lg divide-y divide-gray-100 mb-3">
                            {[
                                { icon: <User className="w-3 h-3" />, l: 'NV', v: detail.employeeName || '—' },
                                { icon: <CreditCard className="w-3 h-3" />, l: 'KH', v: detail.realName ? `${detail.realName}${detail.phone ? ` · ${detail.phone}` : ''}` : '—' },
                                { icon: <Banknote className="w-3 h-3" />, l: 'TT', v: detail.payModeNames || '—' },
                            ].map(row => (
                                <div key={row.l} className="flex items-center gap-2 px-3 py-2">
                                    <span className="text-gray-400 shrink-0">{row.icon}</span>
                                    <span className="text-[10px] text-gray-400 w-8 shrink-0">{row.l}</span>
                                    <span className="text-[11px] text-gray-700 font-medium flex-1 text-right truncate">{row.v}</span>
                                </div>
                            ))}
                        </div>

                        {/* Goods */}
                        {detail.goodsInfo.length > 0 && (
                            <div className="mb-3">
                                <p className="text-[10px] font-bold text-gray-500 uppercase flex items-center gap-1 mb-2">
                                    <Package className="w-3 h-3" />Sản phẩm ({detail.goodsInfo.length})
                                </p>
                                <div className="space-y-1.5">
                                    {detail.goodsInfo.map((g, i) => (
                                        <div key={i} className="bg-gray-50 rounded-lg p-2.5">
                                            <div className="flex items-start justify-between gap-2">
                                                <div className="flex-1 min-w-0">
                                                    <p className="text-[11px] font-semibold text-gray-800 leading-tight">{g.goodsName}</p>
                                                    <p className="text-[9px] text-gray-400 mt-0.5">{g.goodsCategoryName} · ×{g.qty}</p>
                                                </div>
                                                <span className="text-[11px] font-bold text-emerald-700 shrink-0">{fmtShort(g.realMoney)}</span>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Payments */}
                        {detail.payModeInfo.length > 0 && (
                            <div>
                                <p className="text-[10px] font-bold text-gray-500 uppercase flex items-center gap-1 mb-2">
                                    <Receipt className="w-3 h-3" />Thanh toán
                                </p>
                                <div className="space-y-1.5">
                                    {detail.payModeInfo.map((p, i) => (
                                        <div key={i} className="bg-gray-50 rounded-lg p-2.5 flex items-center justify-between">
                                            <div>
                                                <p className="text-[11px] font-semibold text-gray-800">{p.payMethodName}</p>
                                                <p className="text-[9px] text-gray-400">{p.payStatusName} · {p.payTime?.slice(11, 16)}</p>
                                            </div>
                                            <span className="text-[11px] font-bold text-primary-700">{fmtShort(p.money)}</span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </>)}
                </div>
            </BottomSheet>
        </div>
    );
}
