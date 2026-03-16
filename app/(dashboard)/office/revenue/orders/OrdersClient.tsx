'use client';

import { useState, useCallback, useTransition } from 'react';
import {
    Search, RefreshCw, ChevronLeft, ChevronRight, X,
    ShoppingCart, User, CreditCard, Package, Receipt,
    Clock, CheckCircle2, XCircle, AlertCircle, Loader2,
    Phone, Store, Tag, ChevronDown,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { fetchOrderList, fetchOrderDetail, JwOrder, JwOrderFoot, JwOrderDetailData } from './actions';

// ── Constants ─────────────────────────────────────────────────────────────────

const STATUS_MAP: Record<number, { label: string; className: string; icon: React.ReactNode }> = {
    1: { label: 'Chờ xử lý', className: 'bg-warning-100 text-warning-700 border-warning-200', icon: <Clock className="w-3 h-3" /> },
    2: { label: 'Một phần', className: 'bg-primary-100 text-primary-700 border-primary-200', icon: <AlertCircle className="w-3 h-3" /> },
    3: { label: 'Hoàn thành', className: 'bg-success-100 text-success-700 border-success-200', icon: <CheckCircle2 className="w-3 h-3" /> },
    4: { label: 'Đã huỷ', className: 'bg-danger-100 text-danger-700 border-danger-200', icon: <XCircle className="w-3 h-3" /> },
};

const PAGE_LIMIT = 20;

function fmt(n: number) {
    return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND', maximumFractionDigits: 0 }).format(n);
}

function fmtDate(s: string) {
    if (!s) return '—';
    return s.replace('T', ' ').substring(0, 16);
}

function today() {
    return new Date().toISOString().substring(0, 10);
}

// ── Status badge ──────────────────────────────────────────────────────────────
function StatusBadge({ status }: { status: number }) {
    const s = STATUS_MAP[status] ?? { label: `#${status}`, className: 'bg-surface-100 text-surface-600 border-surface-200', icon: null };
    return (
        <span className={cn('inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold border', s.className)}>
            {s.icon}{s.label}
        </span>
    );
}

// ── Order Detail Drawer ───────────────────────────────────────────────────────
function OrderDetailDrawer({
    order,
    detail,
    loading,
    onClose,
}: {
    order: JwOrder | null;
    detail: JwOrderDetailData | null;
    loading: boolean;
    onClose: () => void;
}) {
    if (!order) return null;

    return (
        <>
            {/* Backdrop */}
            <div
                className="fixed inset-0 bg-black/40 backdrop-blur-sm z-40 transition-opacity"
                onClick={onClose}
            />
            {/* Panel */}
            <div className="fixed right-0 top-0 h-full w-full max-w-lg bg-surface-950 shadow-2xl z-50 flex flex-col overflow-hidden border-l border-surface-800">
                {/* Header */}
                <div className="flex items-start justify-between gap-3 px-5 py-4 border-b border-surface-800/60">
                    <div>
                        <p className="text-xs text-surface-400 font-mono">{order.orderNumber}</p>
                        <h2 className="text-base font-bold text-white mt-0.5">Chi tiết đơn hàng</h2>
                        <p className="text-xs text-surface-400 mt-0.5">{fmtDate(order.createTime)}</p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                        <StatusBadge status={order.status} />
                        <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-surface-800 text-surface-400 transition-colors">
                            <X className="w-4 h-4" />
                        </button>
                    </div>
                </div>

                {/* Body */}
                <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
                    {loading ? (
                        <div className="flex flex-col items-center justify-center gap-3 py-20">
                            <Loader2 className="w-8 h-8 text-primary-500 animate-spin" />
                            <p className="text-surface-400 text-sm">Đang tải chi tiết...</p>
                        </div>
                    ) : !detail ? (
                        <div className="flex flex-col items-center justify-center gap-2 py-20 text-danger-400">
                            <XCircle className="w-8 h-8" />
                            <p className="text-sm">Không tải được chi tiết đơn hàng</p>
                        </div>
                    ) : (
                        <>
                            {/* Summary cards */}
                            <div className="grid grid-cols-2 gap-2">
                                {[
                                    { label: 'Giá gốc', value: fmt(detail.originalMoney), color: 'text-surface-300' },
                                    { label: 'Thực thu', value: fmt(detail.realMoney), color: 'text-success-400 font-bold' },
                                    { label: 'Giảm giá', value: fmt(detail.discountMoney), color: 'text-warning-400' },
                                    { label: 'Thuế', value: fmt(detail.taxMoney), color: 'text-surface-300' },
                                ].map(({ label, value, color }) => (
                                    <div key={label} className="bg-surface-900/60 rounded-xl p-3 border border-surface-800">
                                        <p className="text-[10px] text-surface-500 uppercase tracking-wide">{label}</p>
                                        <p className={cn('text-sm font-bold mt-0.5', color)}>{value}</p>
                                    </div>
                                ))}
                            </div>

                            {/* Info */}
                            <div className="bg-surface-900/60 rounded-xl border border-surface-800 divide-y divide-surface-800/60">
                                {[
                                    { icon: <User className="w-3.5 h-3.5" />, label: 'Nhân viên', value: detail.employeeName || '—' },
                                    { icon: <Phone className="w-3.5 h-3.5" />, label: 'Khách hàng', value: detail.realName ? `${detail.realName}${detail.phone ? ` · ${detail.phone}` : ''}` : '—' },
                                    { icon: <CreditCard className="w-3.5 h-3.5" />, label: 'Thanh toán', value: detail.payModeNames || '—' },
                                    ...(detail.remark ? [{ icon: <Tag className="w-3.5 h-3.5" />, label: 'Ghi chú', value: detail.remark }] : []),
                                ].map(({ icon, label, value }) => (
                                    <div key={label} className="flex items-center gap-3 px-3 py-2.5">
                                        <span className="text-surface-500 shrink-0">{icon}</span>
                                        <span className="text-[11px] text-surface-400 w-20 shrink-0">{label}</span>
                                        <span className="text-sm text-surface-200 font-medium flex-1 text-right">{value}</span>
                                    </div>
                                ))}
                            </div>

                            {/* Goods */}
                            {detail.goodsInfo.length > 0 && (
                                <div>
                                    <p className="text-xs font-bold text-surface-400 uppercase tracking-wide mb-2 flex items-center gap-1.5">
                                        <Package className="w-3.5 h-3.5" /> Sản phẩm ({detail.goodsInfo.length})
                                    </p>
                                    <div className="space-y-2">
                                        {detail.goodsInfo.map((g, i) => (
                                            <div key={i} className="bg-surface-900/60 rounded-xl border border-surface-800 p-3">
                                                <div className="flex items-start justify-between gap-2">
                                                    <div className="flex-1 min-w-0">
                                                        <p className="text-sm font-semibold text-white leading-tight">{g.goodsName}</p>
                                                        <p className="text-[11px] text-surface-400 mt-0.5">{g.goodsCategoryName}</p>
                                                    </div>
                                                    <span className="text-xs text-surface-400 shrink-0">×{g.qty}</span>
                                                </div>
                                                <div className="flex items-center justify-between mt-2 pt-2 border-t border-surface-800/60">
                                                    <span className="text-[11px] text-surface-500">
                                                        Đơn giá: <span className="text-surface-300">{fmt(g.price)}</span>
                                                        {g.taxRate > 0 && <> · Thuế {g.taxRate}%: <span className="text-surface-300">{fmt(g.taxMoney)}</span></>}
                                                    </span>
                                                    <span className="text-sm font-bold text-success-400">{fmt(g.realMoney)}</span>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* Payment modes */}
                            {detail.payModeInfo.length > 0 && (
                                <div>
                                    <p className="text-xs font-bold text-surface-400 uppercase tracking-wide mb-2 flex items-center gap-1.5">
                                        <Receipt className="w-3.5 h-3.5" /> Thanh toán
                                    </p>
                                    <div className="space-y-2">
                                        {detail.payModeInfo.map((p, i) => (
                                            <div key={i} className="bg-surface-900/60 rounded-xl border border-surface-800 p-3">
                                                <div className="flex items-center justify-between">
                                                    <div>
                                                        <p className="text-sm font-semibold text-white">{p.payMethodName}</p>
                                                        <p className="text-[11px] text-surface-400 mt-0.5">{p.payStatusName} · {p.payTime}</p>
                                                    </div>
                                                    <span className="text-sm font-bold text-primary-400">{fmt(p.money)}</span>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </>
                    )}
                </div>
            </div>
        </>
    );
}

// ── Main Component ────────────────────────────────────────────────────────────
export default function OrdersClient() {
    const [date, setDate] = useState(today());
    const [page, setPage] = useState(1);
    const [statusFilter, setStatusFilter] = useState('');
    const [payFilter, setPayFilter] = useState('');

    const [orders, setOrders] = useState<JwOrder[]>([]);
    const [foot, setFoot] = useState<JwOrderFoot | null>(null);
    const [totals, setTotals] = useState(0);
    const [fetched, setFetched] = useState(false);
    const [error, setError] = useState('');

    const [selectedOrder, setSelectedOrder] = useState<JwOrder | null>(null);
    const [detail, setDetail] = useState<JwOrderDetailData | null>(null);
    const [detailLoading, setDetailLoading] = useState(false);

    const [isPending, startTransition] = useTransition();

    const load = useCallback((p: number, d?: string, st?: string, pay?: string) => {
        const useDate = d ?? date;
        const useSt = st ?? statusFilter;
        const usePay = pay ?? payFilter;
        startTransition(async () => {
            setError('');
            const res = await fetchOrderList({
                startTime: `${useDate} 00:00:00`,
                endTime: `${useDate} 23:59:59`,
                statusContent: useSt,
                payMethodContent: usePay,
                page: p,
                limit: PAGE_LIMIT,
            });
            if (!res.success) {
                setError(res.error || 'Lỗi không xác định');
                setOrders([]);
            } else {
                setOrders(res.data);
                setFoot(res.foot);
                setTotals(res.totals);
                setPage(p);
            }
            setFetched(true);
        });
    }, [date, statusFilter, payFilter]);

    const openDetail = async (order: JwOrder) => {
        setSelectedOrder(order);
        setDetail(null);
        setDetailLoading(true);
        const res = await fetchOrderDetail(order.orderId);
        setDetail(res.data);
        setDetailLoading(false);
    };

    const totalPages = Math.ceil(totals / PAGE_LIMIT);

    return (
        <div className="space-y-4">
            {/* Filter bar */}
            <div className="bg-surface-900/40 border border-surface-800/60 rounded-2xl p-4">
                <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-end">
                    {/* Date picker */}
                    <div className="flex-1 min-w-0">
                        <label className="text-[11px] font-semibold text-surface-400 uppercase tracking-wide block mb-1">Ngày</label>
                        <input
                            type="date"
                            value={date}
                            onChange={e => { setDate(e.target.value); setFetched(false); setOrders([]); }}
                            className="w-full bg-surface-900 border border-surface-700 text-white rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-primary-500/30 focus:border-primary-500/60 outline-none"
                        />
                    </div>

                    {/* Status filter */}
                    <div className="relative flex-1 min-w-0">
                        <label className="text-[11px] font-semibold text-surface-400 uppercase tracking-wide block mb-1">Trạng thái</label>
                        <select
                            value={statusFilter}
                            onChange={e => setStatusFilter(e.target.value)}
                            className="w-full appearance-none bg-surface-900 border border-surface-700 text-white rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-primary-500/30 focus:border-primary-500/60 outline-none pr-8"
                        >
                            <option value="">Tất cả</option>
                            <option value="1">Chờ xử lý</option>
                            <option value="2">Một phần</option>
                            <option value="3">Hoàn thành</option>
                            <option value="4">Đã huỷ</option>
                        </select>
                        <ChevronDown className="absolute right-2.5 bottom-2.5 w-3.5 h-3.5 text-surface-500 pointer-events-none" />
                    </div>

                    {/* Search button */}
                    <button
                        onClick={() => load(1)}
                        disabled={isPending}
                        className="flex items-center gap-2 px-5 py-2 bg-primary-600 hover:bg-primary-500 disabled:opacity-60 text-white rounded-xl font-semibold text-sm transition-colors shrink-0"
                    >
                        {isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
                        Tìm kiếm
                    </button>

                    {fetched && (
                        <button
                            onClick={() => load(page)}
                            disabled={isPending}
                            className="p-2 rounded-xl border border-surface-700 hover:bg-surface-800 text-surface-400 transition-colors shrink-0"
                        >
                            <RefreshCw className={cn('w-4 h-4', isPending && 'animate-spin')} />
                        </button>
                    )}
                </div>
            </div>

            {/* Error */}
            {error && (
                <div className="bg-danger-950/60 border border-danger-900 text-danger-400 p-3 rounded-xl text-sm flex items-center gap-2">
                    <XCircle className="w-4 h-4 shrink-0" /> {error}
                </div>
            )}

            {/* Summary foot */}
            {foot && (
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
                    {[
                        { label: 'Tổng sản phẩm', value: `${foot.totalQty} sản phẩm`, color: 'text-white' },
                        { label: 'Giá gốc', value: fmt(foot.originalMoney), color: 'text-surface-300' },
                        { label: 'Thực thu', value: fmt(foot.realMoney), color: 'text-success-400 font-bold' },
                        { label: 'Giảm giá', value: fmt(foot.discountMoney), color: 'text-warning-400' },
                        { label: 'Hoàn huỷ', value: fmt(foot.cancelMoney), color: 'text-danger-400' },
                        { label: 'Thuế', value: fmt(foot.taxMoney), color: 'text-surface-300' },
                    ].map(({ label, value, color }) => (
                        <div key={label} className="bg-surface-900/40 border border-surface-800/60 rounded-xl p-3">
                            <p className="text-[10px] text-surface-500 uppercase tracking-wide">{label}</p>
                            <p className={cn('text-xs mt-0.5', color)}>{value}</p>
                        </div>
                    ))}
                </div>
            )}

            {/* Table / List */}
            {!fetched && !isPending ? (
                <div className="flex flex-col items-center justify-center gap-4 py-20 text-surface-500">
                    <ShoppingCart className="w-12 h-12 opacity-30" />
                    <p className="text-sm">Chọn ngày và nhấn <span className="text-primary-400 font-semibold">Tìm kiếm</span> để xem danh sách đơn hàng</p>
                </div>
            ) : isPending && orders.length === 0 ? (
                <div className="flex flex-col items-center justify-center gap-3 py-20">
                    <Loader2 className="w-8 h-8 text-primary-500 animate-spin" />
                    <p className="text-surface-400 text-sm">Đang tải dữ liệu...</p>
                </div>
            ) : orders.length === 0 && fetched ? (
                <div className="flex flex-col items-center justify-center gap-3 py-16 text-surface-500">
                    <ShoppingCart className="w-10 h-10 opacity-30" />
                    <p className="text-sm">Không có đơn hàng nào trong ngày này</p>
                </div>
            ) : (
                <>
                    {/* Desktop table */}
                    <div className="hidden md:block overflow-x-auto rounded-2xl border border-surface-800/60 shadow-sm">
                        <table className="w-full text-sm border-collapse">
                            <thead>
                                <tr className="bg-surface-900/80">
                                    {['Mã đơn', 'Sản phẩm', 'Nhân viên', 'Thanh toán', 'SL', 'Thực thu', 'Trạng thái', 'Thời gian'].map(h => (
                                        <th key={h} className="text-left px-3 py-3 text-[11px] font-bold text-surface-400 uppercase tracking-wide border-b border-surface-800/60">
                                            {h}
                                        </th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody>
                                {orders.map((order, i) => (
                                    <tr
                                        key={order.orderId}
                                        onClick={() => openDetail(order)}
                                        className={cn(
                                            'border-b border-surface-800/40 cursor-pointer transition-colors hover:bg-primary-500/5',
                                            i % 2 === 0 ? 'bg-surface-950/40' : 'bg-surface-900/20',
                                            order.status === 4 && 'opacity-60',
                                        )}
                                    >
                                        <td className="px-3 py-2.5">
                                            <p className="text-[11px] font-mono text-surface-400 leading-none">{order.orderNumber.slice(-8)}</p>
                                        </td>
                                        <td className="px-3 py-2.5 max-w-[180px]">
                                            <p className="text-sm text-white font-medium truncate">{order.goodsNames || '—'}</p>
                                            {order.terminalName && (
                                                <p className="text-[11px] text-surface-500 flex items-center gap-1 mt-0.5 truncate">
                                                    <Store className="w-2.5 h-2.5 shrink-0" />{order.terminalName}
                                                </p>
                                            )}
                                        </td>
                                        <td className="px-3 py-2.5">
                                            <p className="text-sm text-surface-200">{order.employeeName || '—'}</p>
                                            {order.realName && <p className="text-[11px] text-surface-500">{order.realName}</p>}
                                        </td>
                                        <td className="px-3 py-2.5">
                                            <p className="text-sm text-surface-300">{order.payModeNames || '—'}</p>
                                        </td>
                                        <td className="px-3 py-2.5 text-center">
                                            <span className="text-sm font-semibold text-white">{order.totalQty}</span>
                                        </td>
                                        <td className="px-3 py-2.5">
                                            <span className={cn('text-sm font-bold', order.status === 4 ? 'text-surface-500 line-through' : 'text-success-400')}>
                                                {fmt(order.realMoney)}
                                            </span>
                                        </td>
                                        <td className="px-3 py-2.5">
                                            <StatusBadge status={order.status} />
                                        </td>
                                        <td className="px-3 py-2.5 text-[11px] text-surface-400 whitespace-nowrap">
                                            {fmtDate(order.createTime)}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>

                    {/* Mobile cards */}
                    <div className="md:hidden space-y-2">
                        {orders.map(order => (
                            <div
                                key={order.orderId}
                                onClick={() => openDetail(order)}
                                className={cn(
                                    'bg-surface-900/40 border border-surface-800/60 rounded-2xl p-3.5 cursor-pointer transition-colors active:bg-surface-800/60',
                                    order.status === 4 && 'opacity-60'
                                )}
                            >
                                <div className="flex items-start justify-between gap-2 mb-2">
                                    <div className="flex-1 min-w-0">
                                        <p className="text-sm font-semibold text-white truncate">{order.goodsNames || '—'}</p>
                                        <p className="text-[11px] font-mono text-surface-500 mt-0.5">{order.orderNumber.slice(-12)}</p>
                                    </div>
                                    <StatusBadge status={order.status} />
                                </div>
                                <div className="flex items-center justify-between text-xs text-surface-400">
                                    <span className="flex items-center gap-1"><User className="w-3 h-3" />{order.employeeName || '—'}</span>
                                    <span className="flex items-center gap-1"><CreditCard className="w-3 h-3" />{order.payModeNames || '—'}</span>
                                </div>
                                <div className="flex items-center justify-between mt-2 pt-2 border-t border-surface-800/40">
                                    <span className="text-[11px] text-surface-400">{fmtDate(order.createTime)}</span>
                                    <span className={cn('text-sm font-bold', order.status === 4 ? 'text-surface-500 line-through' : 'text-success-400')}>
                                        {fmt(order.realMoney)}
                                    </span>
                                </div>
                            </div>
                        ))}
                    </div>

                    {/* Pagination */}
                    {totalPages > 1 && (
                        <div className="flex items-center justify-between">
                            <p className="text-xs text-surface-400">
                                Trang <span className="text-white font-semibold">{page}</span> / {totalPages}
                                &nbsp;·&nbsp;{totals} đơn hàng
                            </p>
                            <div className="flex gap-1">
                                <button
                                    onClick={() => load(page - 1)}
                                    disabled={page <= 1 || isPending}
                                    className="p-2 rounded-lg border border-surface-700 hover:bg-surface-800 disabled:opacity-40 text-surface-300 transition-colors"
                                >
                                    <ChevronLeft className="w-4 h-4" />
                                </button>
                                {/* Page number pills */}
                                {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => {
                                    const p = Math.max(1, Math.min(page - 2, totalPages - 4)) + i;
                                    return (
                                        <button
                                            key={p}
                                            onClick={() => load(p)}
                                            disabled={isPending}
                                            className={cn(
                                                'px-3 py-1.5 rounded-lg text-sm font-semibold transition-colors',
                                                p === page
                                                    ? 'bg-primary-600 text-white'
                                                    : 'border border-surface-700 text-surface-300 hover:bg-surface-800'
                                            )}
                                        >
                                            {p}
                                        </button>
                                    );
                                })}
                                <button
                                    onClick={() => load(page + 1)}
                                    disabled={page >= totalPages || isPending}
                                    className="p-2 rounded-lg border border-surface-700 hover:bg-surface-800 disabled:opacity-40 text-surface-300 transition-colors"
                                >
                                    <ChevronRight className="w-4 h-4" />
                                </button>
                            </div>
                        </div>
                    )}
                </>
            )}

            {/* Order Detail Drawer */}
            {selectedOrder && (
                <OrderDetailDrawer
                    order={selectedOrder}
                    detail={detail}
                    loading={detailLoading}
                    onClose={() => setSelectedOrder(null)}
                />
            )}
        </div>
    );
}
