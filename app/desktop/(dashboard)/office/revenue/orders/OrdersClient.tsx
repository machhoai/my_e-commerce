'use client';

import { useState, useMemo, useCallback, useEffect, useTransition } from 'react';
import {
    Search, RefreshCw, ChevronLeft, ChevronRight, X,
    ShoppingCart, User, CreditCard, Package, Receipt,
    CheckCircle2, XCircle, AlertCircle, Clock, Loader2,
    Store, Filter, ChevronDown, FileDown, Download,
} from 'lucide-react';
import { fetchOrdersAction, fetchOrderDetailAction, fetchOrderGoodsAction, OrderRecord, OrderFilters, OrderFoot, OrderDetailData, GoodsRecord, GoodsFilters } from './actions';
import OrdersExcelExportDialog from './OrdersExcelExportDialog';

// ── Helpers ────────────────────────────────────────────────────────────────────

const fmtVND = (v: number) => v.toLocaleString('vi-VN', { style: 'currency', currency: 'VND', maximumFractionDigits: 0 });

const STATUS_STYLE: Record<number, { cls: string; icon: React.ReactNode }> = {
    1: { cls: 'bg-warning-100 text-warning-700 border-warning-200', icon: <Clock className="w-3 h-3" /> },
    2: { cls: 'bg-primary-100 text-primary-700 border-primary-200', icon: <AlertCircle className="w-3 h-3" /> },
    3: { cls: 'bg-success-100 text-success-700 border-success-200', icon: <CheckCircle2 className="w-3 h-3" /> },
    4: { cls: 'bg-danger-100 text-danger-700 border-danger-200', icon: <XCircle className="w-3 h-3" /> },
};

function StatusBadge({ status, label }: { status: number; label: string }) {
    const s = STATUS_STYLE[status] ?? { cls: 'bg-surface-100 text-surface-500 border-surface-200', icon: null };
    return (
        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold border whitespace-nowrap ${s.cls}`}>
            {s.icon}{label}
        </span>
    );
}

const selectCls = 'w-full bg-white border border-surface-200 text-surface-700 rounded-xl px-3 py-2 text-xs font-medium focus:ring-2 focus:ring-accent-200 focus:border-accent-400 outline-none cursor-pointer';

// ── Detail Drawer ─────────────────────────────────────────────────────────────

function DetailDrawer({
    order,
    detail,
    loading,
    onClose,
}: {
    order: OrderRecord;
    detail: OrderDetailData | null;
    loading: boolean;
    onClose: () => void;
}) {
    return (
        <div className="fixed left-0 top-0 inset-0 z-50">
            <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" onClick={onClose} />
            <div className="absolute right-0 top-0 h-full w-full max-w-lg bg-white shadow-2xl flex flex-col border-l border-surface-100">
                {/* Header */}
                <div className="flex items-start justify-between gap-3 px-5 py-4 border-b border-surface-100 shrink-0">
                    <div className="min-w-0">
                        <p className="text-[11px] font-mono text-surface-400 truncate">{order.orderNumber}</p>
                        <h2 className="text-base font-bold text-surface-800 mt-0.5">Chi tiết đơn hàng</h2>
                        <p className="text-xs text-surface-400 mt-0.5">{order.createTime.slice(0, 16)}</p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                        <StatusBadge status={order.status} label={order.statusName} />
                        <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-surface-100 text-surface-400 transition-colors">
                            <X className="w-4 h-4" />
                        </button>
                    </div>
                </div>
                {/* Body */}
                <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
                    {loading ? (
                        <div className="flex flex-col items-center justify-center gap-3 py-20">
                            <div className="relative">
                                <div className="w-8 h-8 rounded-full border-4 border-accent-100" />
                                <div className="w-8 h-8 rounded-full border-4 border-accent-500 border-t-transparent absolute inset-0 animate-spin" />
                            </div>
                            <p className="text-sm text-surface-400">Đang tải chi tiết...</p>
                        </div>
                    ) : !detail ? (
                        <p className="text-center py-20 text-sm text-danger-500">Không tải được chi tiết đơn hàng</p>
                    ) : (
                        <>
                            {/* Money summary */}
                            <div className="grid grid-cols-2 gap-2">
                                {([
                                    { l: 'Giá gốc', v: fmtVND(detail.originalMoney), c: 'text-surface-700' },
                                    { l: 'Thực thu', v: fmtVND(detail.realMoney), c: 'text-success-700 font-bold' },
                                    { l: 'Giảm giá', v: fmtVND(detail.discountMoney), c: 'text-warning-700' },
                                    { l: 'Thuế', v: fmtVND(detail.taxMoney), c: 'text-surface-600' },
                                ] as { l: string; v: string; c: string }[]).map(({ l, v, c }) => (
                                    <div key={l} className="bg-surface-50 rounded-xl p-3">
                                        <p className="text-[10px] uppercase tracking-widest text-surface-400 font-semibold">{l}</p>
                                        <p className={`text-sm mt-0.5 ${c}`}>{v}</p>
                                    </div>
                                ))}
                            </div>
                            {/* Info rows */}
                            <div className="bg-surface-50 rounded-2xl divide-y divide-surface-100">
                                {[
                                    { icon: <User className="w-3.5 h-3.5" />, label: 'Nhân viên', value: detail.employeeName || '—' },
                                    { icon: <CreditCard className="w-3.5 h-3.5" />, label: 'Khách hàng', value: detail.realName ? `${detail.realName}${detail.phone ? ` · ${detail.phone}` : ''}` : '—' },
                                    { icon: <Receipt className="w-3.5 h-3.5" />, label: 'Thanh toán', value: detail.payModeNames || '—' },
                                ].map(({ icon, label, value }) => (
                                    <div key={label} className="flex items-center gap-3 px-3 py-2.5">
                                        <span className="text-surface-400 shrink-0">{icon}</span>
                                        <span className="text-[11px] text-surface-400 w-20 shrink-0">{label}</span>
                                        <span className="text-sm text-surface-700 font-medium flex-1 text-right truncate">{value}</span>
                                    </div>
                                ))}
                            </div>
                            {/* Goods */}
                            {detail.goodsInfo.length > 0 && (
                                <div>
                                    <p className="text-xs font-bold text-surface-500 uppercase tracking-wide mb-2 flex items-center gap-1.5">
                                        <Package className="w-3.5 h-3.5" /> Sản phẩm ({detail.goodsInfo.length})
                                    </p>
                                    <div className="space-y-2">
                                        {detail.goodsInfo.map((g, i) => (
                                            <div key={i} className="bg-surface-50 rounded-xl p-3">
                                                <div className="flex items-start justify-between gap-2">
                                                    <div className="flex-1 min-w-0">
                                                        <p className="text-sm font-semibold text-surface-800 leading-tight">{g.goodsName}</p>
                                                        <p className="text-[11px] text-surface-400 mt-0.5">{g.goodsCategoryName}</p>
                                                    </div>
                                                    <span className="text-xs text-surface-400 shrink-0">×{g.qty}</span>
                                                </div>
                                                <div className="flex items-center justify-between mt-2 pt-2 border-t border-surface-100">
                                                    <span className="text-[11px] text-surface-500">
                                                        {fmtVND(g.price)}{g.taxRate > 0 && ` · VAT ${g.taxRate}%`}
                                                    </span>
                                                    <span className="text-sm font-bold text-success-700">{fmtVND(g.realMoney)}</span>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                            {/* Payment modes */}
                            {detail.payModeInfo.length > 0 && (
                                <div>
                                    <p className="text-xs font-bold text-surface-500 uppercase tracking-wide mb-2 flex items-center gap-1.5">
                                        <Receipt className="w-3.5 h-3.5" /> Thanh toán
                                    </p>
                                    <div className="space-y-2">
                                        {detail.payModeInfo.map((p, i) => (
                                            <div key={i} className="bg-surface-50 rounded-xl p-3 flex items-center justify-between">
                                                <div>
                                                    <p className="text-sm font-semibold text-surface-800">{p.payMethodName}</p>
                                                    <p className="text-[11px] text-surface-400 mt-0.5">{p.payStatusName} · {p.payTime}</p>
                                                </div>
                                                <span className="text-sm font-bold text-accent-700">{fmtVND(p.money)}</span>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </>
                    )}
                </div>
            </div>
        </div>
    );
}

// ── Export Config ─────────────────────────────────────────────────────────────

interface ExportColumn { key: string; label: string; }

const ORDER_EXPORT_COLUMNS: ExportColumn[] = [
    { key: 'orderNumber', label: 'Mã Đơn Hàng' },
    { key: 'createTime', label: 'Thời Gian' },
    { key: 'employeeName', label: 'Nhân Viên' },
    { key: 'goodsNames', label: 'Sản Phẩm' },
    { key: 'totalQty', label: 'Số Lượng' },
    { key: 'realMoney', label: 'Thực Thu (VND)' },
    { key: 'discountMoney', label: 'Giảm Giá (VND)' },
    { key: 'cancelMoney', label: 'Hoàn Huỷ (VND)' },
    { key: 'taxMoney', label: 'Tiền Thuế (VND)' },
    { key: 'payModeNames', label: 'Thanh Toán' },
    { key: 'statusName', label: 'Trạng Thái' },
    { key: 'terminalName', label: 'Quầy' },
];

const GOODS_EXPORT_COLUMNS: ExportColumn[] = [
    { key: 'orderNumber', label: 'Mã Đơn Hàng' },
    { key: 'createTime', label: 'Thời Gian' },
    { key: 'goodsName', label: 'Tên Sản Phẩm' },
    { key: 'showCategoryName', label: 'Danh Mục' },
    { key: 'price', label: 'Đơn Giá (VND)' },
    { key: 'qty', label: 'Số Lượng' },
    { key: 'totalBeforeTax', label: 'Thành Tiền Trước Thuế (VND)' },
    { key: 'taxMoney', label: 'Thuế Của Thành Tiền (VND)' },
    { key: 'realMoney', label: 'Thực Thu (VND)' },
    { key: 'payModeNames', label: 'Thanh Toán' },
    { key: 'employeeName', label: 'Nhân Viên' },
    { key: 'statusName', label: 'Trạng Thái' },
];

function ExportModal({
    isOpen,
    onClose,
    data,
    columns,
}: {
    isOpen: boolean;
    onClose: () => void;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    data: any[];
    columns: ExportColumn[];
}) {
    const [selectedCols, setSelectedCols] = useState<string[]>(
        columns.map(c => c.key)
    );

    // Reset selections when columns change (view mode switch)
    const prevColKeys = columns.map(c => c.key).join(',');
    // eslint-disable-next-line react-hooks/exhaustive-deps
    useEffect(() => { setSelectedCols(columns.map(c => c.key)); }, [prevColKeys]);

    const toggleCol = (key: string) =>
        setSelectedCols(prev =>
            prev.includes(key) ? prev.filter(k => k !== key) : [...prev, key]
        );

    const visibleCols = columns.filter(c => selectedCols.includes(c.key));
    const previewRows = data.slice(0, 5);

    const handleExport = async () => {
        const xlsxMod = await import('xlsx');
        const XLSX = xlsxMod.default || xlsxMod;
        const mapped = data.map(o => {
            const row: Record<string, string | number> = {};
            for (const col of visibleCols) {
                const raw = o[col.key as keyof OrderRecord];
                if (typeof raw === 'number' &&
                    (col.key === 'realMoney' || col.key === 'discountMoney' || col.key === 'cancelMoney')) {
                    row[col.label] = raw; // keep as number for Excel formatting
                } else {
                    row[col.label] = raw != null ? String(raw) : '';
                }
            }
            return row;
        });
        const ws = XLSX.utils.json_to_sheet(mapped);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, 'Dữ liệu');
        XLSX.writeFile(wb, `Xuat_Du_Lieu_${new Date().toISOString().slice(0, 10)}.xlsx`);
        onClose();
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            {/* Overlay */}
            <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
            {/* Panel */}
            <div className="relative bg-white rounded-3xl shadow-2xl w-full max-w-3xl max-h-[90vh] flex flex-col overflow-hidden">
                {/* Header */}
                <div className="flex items-center justify-between px-6 py-4 border-b border-surface-100 shrink-0">
                    <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-xl bg-success-50 flex items-center justify-center">
                            <FileDown className="w-5 h-5 text-success-600" />
                        </div>
                        <div>
                            <h2 className="text-base font-bold text-surface-800">Xuất Excel</h2>
                            <p className="text-xs text-surface-400 mt-0.5">{data.length.toLocaleString()} đơn sẽ được xuất</p>
                        </div>
                    </div>
                    <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-surface-100 text-surface-400 transition-colors">
                        <X className="w-4 h-4" />
                    </button>
                </div>

                <div className="flex-1 overflow-y-auto p-6 space-y-5">
                    {/* Column selector */}
                    <div>
                        <div className="flex items-center justify-between mb-3">
                            <p className="text-xs font-bold text-surface-600 uppercase tracking-wider">Chọn cột xuất</p>
                            <div className="flex gap-2">
                                <button onClick={() => setSelectedCols(columns.map(c => c.key))}
                                    className="text-[11px] text-accent-600 hover:text-accent-800 font-semibold">Chọn tất cả</button>
                                <span className="text-surface-300">·</span>
                                <button onClick={() => setSelectedCols([])}
                                    className="text-[11px] text-surface-400 hover:text-surface-600 font-semibold">Bỏ chọn</button>
                            </div>
                        </div>
                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                            {columns.map((col: ExportColumn) => {
                                const checked = selectedCols.includes(col.key);
                                return (
                                    <label key={col.key}
                                        className={`flex items-center gap-2.5 px-3 py-2.5 rounded-xl border cursor-pointer transition-all select-none ${checked
                                            ? 'bg-accent-50 border-accent-200 text-accent-700'
                                            : 'bg-surface-50 border-surface-200 text-surface-500 hover:border-surface-300'
                                            }`}>
                                        <input type="checkbox" checked={checked} onChange={() => toggleCol(col.key)}
                                            className="w-3.5 h-3.5 rounded accent-accent-600" />
                                        <span className="text-xs font-medium leading-tight">{col.label}</span>
                                    </label>
                                );
                            })}
                        </div>
                    </div>

                    {/* Live preview */}
                    {selectedCols.length > 0 && previewRows.length > 0 && (
                        <div>
                            <p className="text-xs font-bold text-surface-600 uppercase tracking-wider mb-3">
                                Xem trước (5 dòng đầu)
                            </p>
                            <div className="overflow-x-auto rounded-2xl border border-surface-100">
                                <table className="w-full text-xs border-collapse">
                                    <thead>
                                        <tr className="bg-surface-50 border-b border-surface-100">
                                            {visibleCols.map(col => (
                                                <th key={col.key} className="px-3 py-2 text-left font-semibold text-surface-500 whitespace-nowrap">
                                                    {col.label}
                                                </th>
                                            ))}
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {previewRows.map((row, i) => (
                                            <tr key={i} className={`border-b border-surface-50 ${i % 2 ? 'bg-surface-50/40' : ''}`}>
                                                {visibleCols.map(col => {
                                                    const val = row[col.key as keyof OrderRecord];
                                                    return (
                                                        <td key={col.key} className="px-3 py-2 text-surface-700 whitespace-nowrap max-w-[160px] truncate">
                                                            {typeof val === 'number' &&
                                                                (col.key === 'realMoney' || col.key === 'discountMoney' || col.key === 'cancelMoney')
                                                                ? fmtVND(val)
                                                                : val != null ? String(val) : '—'}
                                                        </td>
                                                    );
                                                })}
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}

                    {selectedCols.length === 0 && (
                        <div className="text-center py-8 text-sm text-surface-400">Vui lòng chọn ít nhất một cột để xuất</div>
                    )}
                </div>

                {/* Footer */}
                <div className="flex items-center justify-between gap-3 px-6 py-4 border-t border-surface-100 bg-surface-50/50 shrink-0">
                    <p className="text-xs text-surface-400">
                        <span className="font-semibold text-surface-600">{selectedCols.length}</span> / {columns.length} cột được chọn
                    </p>
                    <div className="flex gap-2">
                        <button onClick={onClose}
                            className="px-4 py-2 rounded-xl text-sm font-semibold border border-surface-200 hover:bg-surface-100 text-surface-600 transition-colors">
                            Huỷ
                        </button>
                        <button onClick={handleExport} disabled={selectedCols.length === 0}
                            className="flex items-center gap-2 px-5 py-2 rounded-xl text-sm font-semibold bg-success-600 text-white hover:bg-success-700 disabled:opacity-50 shadow-sm transition-all">
                            <Download className="w-4 h-4" />
                            Tải xuống ({data.length.toLocaleString()} đơn)
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}

// ── Props ─────────────────────────────────────────────────────────────────────

interface Props {
    /** When embedded in RevenueClient tab, pass dates from getRange() */
    startDate?: string;
    endDate?: string;
}

// ── Main Component ────────────────────────────────────────────────────────────

export default function OrdersClient({ startDate, endDate }: Props) {
    // ── Date state (only used when standalone) ─────────────────────────────────
    function todayStr() {
        const d = new Date();
        return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    }
    const isEmbedded = startDate !== undefined;
    const [localStart, setLocalStart] = useState(startDate ?? todayStr());
    const [localEnd, setLocalEnd] = useState(endDate ?? todayStr());

    const effectiveStart = isEmbedded ? (startDate ?? todayStr()) : localStart;
    const effectiveEnd = isEmbedded ? (endDate ?? todayStr()) : localEnd;

    // ── Server data — Orders ─────────────────────────────────────────────────
    const [allOrders, setAllOrders] = useState<OrderRecord[]>([]);
    const [filters, setFilters] = useState<OrderFilters>({ employees: [], statuses: [], payMethods: [], terminals: [] });
    const [foot, setFoot] = useState<OrderFoot | null>(null);

    // ── Server data — Goods ──────────────────────────────────────────────────
    const [allGoods, setAllGoods] = useState<GoodsRecord[]>([]);
    const [goodsFilters, setGoodsFilters] = useState<GoodsFilters>({ categories: [], goodsNames: [], employees: [], statuses: [] });

    const [fetched, setFetched] = useState(false);
    const [fetchError, setFetchError] = useState('');
    const [isPending, startTransition] = useTransition();

    // ── View mode ────────────────────────────────────────────────────────────
    const [viewMode, setViewMode] = useState<'orders' | 'goods'>('orders');

    // ── Filter state — Orders ────────────────────────────────────────────────
    const [selEmployee, setSelEmployee] = useState('ALL');
    const [selStatus, setSelStatus] = useState('ALL');
    const [selPayMethod, setSelPayMethod] = useState('ALL');
    const [selTerminal, setSelTerminal] = useState('ALL');
    const [search, setSearch] = useState('');

    // ── Filter state — Goods ─────────────────────────────────────────────────
    const [gSelCategory, setGSelCategory] = useState('ALL');
    const [gSelEmployee, setGSelEmployee] = useState('ALL');
    const [gSelStatus, setGSelStatus] = useState('ALL');
    const [gSearch, setGSearch] = useState('');

    // ── Pagination state ─────────────────────────────────────────────────────
    const [currentPage, setCurrentPage] = useState(1);
    const [pageSize, setPageSize] = useState(20);

    // ── Goods pagination ─────────────────────────────────────────────────────
    const [gCurrentPage, setGCurrentPage] = useState(1);
    const [gPageSize, setGPageSize] = useState(20);

    // ── Detail drawer ────────────────────────────────────────────────────────
    const [selectedOrder, setSelectedOrder] = useState<OrderRecord | null>(null);
    const [detail, setDetail] = useState<OrderDetailData | null>(null);
    const [detailLoading, setDetailLoading] = useState(false);

    // ── Export modal ─────────────────────────────────────────────────────────
    const [isExportOpen, setIsExportOpen] = useState(false);
    const [showCustomExport, setShowCustomExport] = useState(false);

    // ── Fetch all data (orders + goods in parallel) ──────────────────────────
    const loadOrders = useCallback((start: string, end: string) => {
        startTransition(async () => {
            setFetchError('');
            const [ordRes, goodsRes] = await Promise.all([
                fetchOrdersAction(start, end),
                fetchOrderGoodsAction(start, end),
            ]);
            if (!ordRes.success) {
                setFetchError(ordRes.error ?? 'Lỗi tải đơn hàng');
                setAllOrders([]);
            } else {
                setAllOrders(ordRes.data);
                setFilters(ordRes.filters);
                setFoot(ordRes.foot);
            }
            if (goodsRes.success) {
                setAllGoods(goodsRes.data);
                setGoodsFilters(goodsRes.filters);
            }
            setFetched(true);
            // Reset all filters + pages
            setSelEmployee('ALL'); setSelStatus('ALL'); setSelPayMethod('ALL'); setSelTerminal('ALL'); setSearch('');
            setCurrentPage(1);
            setGSelCategory('ALL'); setGSelEmployee('ALL'); setGSelStatus('ALL'); setGSearch('');
            setGCurrentPage(1);
        });
    }, []);

    // Auto-load on mount, or when embedded dates change
    useEffect(() => {
        loadOrders(effectiveStart, effectiveEnd);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [effectiveStart, effectiveEnd]);

    // ── Orders filtering (useMemo) ───────────────────────────────────────────
    const filteredOrders = useMemo(() => {
        let list = allOrders;
        if (selEmployee !== 'ALL') list = list.filter(o => o.employeeName === selEmployee);
        if (selStatus !== 'ALL') list = list.filter(o => String(o.status) === selStatus);
        if (selPayMethod !== 'ALL') list = list.filter(o => o.payModeNames.includes(selPayMethod));
        if (selTerminal !== 'ALL') list = list.filter(o => o.terminalName === selTerminal);
        if (search.trim()) {
            const q = search.trim().toLowerCase();
            list = list.filter(o =>
                o.orderNumber.toLowerCase().includes(q) ||
                o.goodsNames.toLowerCase().includes(q) ||
                o.employeeName.toLowerCase().includes(q) ||
                o.realName.toLowerCase().includes(q)
            );
        }
        return list;
    }, [allOrders, selEmployee, selStatus, selPayMethod, selTerminal, search]);

    // Reset orders page when filters change
    useEffect(() => { setCurrentPage(1); }, [selEmployee, selStatus, selPayMethod, selTerminal, search]);

    // ── Goods filtering (useMemo) ────────────────────────────────────────────
    const filteredGoods = useMemo(() => {
        let list = allGoods;
        if (gSelCategory !== 'ALL') list = list.filter(g => g.showCategoryName === gSelCategory);
        if (gSelEmployee !== 'ALL') list = list.filter(g => g.employeeName === gSelEmployee);
        if (gSelStatus !== 'ALL') list = list.filter(g => String(g.status) === gSelStatus);
        if (gSearch.trim()) {
            const q = gSearch.trim().toLowerCase();
            list = list.filter(g =>
                g.goodsName.toLowerCase().includes(q) ||
                g.orderNumber.toLowerCase().includes(q) ||
                g.employeeName.toLowerCase().includes(q)
            );
        }
        return list;
    }, [allGoods, gSelCategory, gSelEmployee, gSelStatus, gSearch]);

    useEffect(() => { setGCurrentPage(1); }, [gSelCategory, gSelEmployee, gSelStatus, gSearch]);

    // ── Goods pagination ─────────────────────────────────────────────────────
    const gTotalPages = Math.max(1, Math.ceil(filteredGoods.length / gPageSize));
    const paginatedGoods = useMemo(
        () => filteredGoods.slice((gCurrentPage - 1) * gPageSize, gCurrentPage * gPageSize),
        [filteredGoods, gCurrentPage, gPageSize]
    );

    // ── Goods: per-order color grouping ─────────────────────────────────────────
    const paginatedGoodsWithGroupColor = useMemo(() => {
        let isAlt = false;
        let lastOrder: string | null = null;
        return paginatedGoods.map(item => {
            if (item.orderNumber !== lastOrder) {
                isAlt = !isAlt;
                lastOrder = item.orderNumber;
            }
            return { ...item, isAlt };
        });
    }, [paginatedGoods]);

    // ── Local pagination (useMemo) ────────────────────────────────────────────
    const totalPages = Math.max(1, Math.ceil(filteredOrders.length / pageSize));
    const paginatedOrders = useMemo(
        () => filteredOrders.slice((currentPage - 1) * pageSize, currentPage * pageSize),
        [filteredOrders, currentPage, pageSize]
    );

    // ── Computed foot for filtered set ─────────────────────────────────────────
    const filteredFoot = useMemo(() => ({
        count: filteredOrders.length,
        totalQty: filteredOrders.reduce((s, o) => s + o.totalQty, 0),
        cancelMoney: filteredOrders.reduce((s, o) => s + o.cancelMoney, 0),
        discountMoney: filteredOrders.reduce((s, o) => s + o.discountMoney, 0),
        taxMoney: filteredOrders.reduce((s, o) => s + o.taxMoney, 0),
    }), [filteredOrders]);

    // ── Open detail ────────────────────────────────────────────────────────────
    const openDetail = async (order: OrderRecord) => {
        setSelectedOrder(order);
        setDetail(null);
        setDetailLoading(true);
        const res = await fetchOrderDetailAction(order.orderId);
        setDetail(res.data);
        setDetailLoading(false);
    };

    const activeFilterCount = [selEmployee, selStatus, selPayMethod, selTerminal].filter(v => v !== 'ALL').length + (search ? 1 : 0);
    const gActiveFilterCount = [gSelCategory, gSelEmployee, gSelStatus].filter(v => v !== 'ALL').length + (gSearch ? 1 : 0);
    const activeExportColumns = viewMode === 'orders' ? ORDER_EXPORT_COLUMNS : GOODS_EXPORT_COLUMNS;
    const activeExportData = viewMode === 'orders' ? filteredOrders : filteredGoods;

    // ── Render ─────────────────────────────────────────────────────────────────
    return (
        <div className="space-y-4">
            {/* Standalone date picker */}
            {!isEmbedded && (
                <div className="bg-white rounded-2xl border border-surface-100 shadow-sm p-4">
                    <div className="flex flex-wrap items-end gap-3">
                        <div>
                            <label className="block text-[10px] font-semibold uppercase tracking-wider text-surface-400 mb-1">Từ ngày</label>
                            <input type="date" value={localStart} onChange={e => setLocalStart(e.target.value)}
                                className="bg-surface-50 border border-surface-200 text-surface-700 rounded-xl px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-accent-200 focus:border-accent-400" />
                        </div>
                        <div>
                            <label className="block text-[10px] font-semibold uppercase tracking-wider text-surface-400 mb-1">Đến ngày</label>
                            <input type="date" value={localEnd} onChange={e => setLocalEnd(e.target.value)}
                                className="bg-surface-50 border border-surface-200 text-surface-700 rounded-xl px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-accent-200 focus:border-accent-400" />
                        </div>
                        <button onClick={() => loadOrders(localStart, localEnd)} disabled={isPending}
                            className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-accent-600 text-white text-sm font-semibold shadow-sm hover:bg-accent-700 disabled:opacity-60 transition-all">
                            {isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
                            Tìm kiếm
                        </button>
                        {fetched && (
                            <button onClick={() => loadOrders(effectiveStart, effectiveEnd)} disabled={isPending}
                                className="p-2 rounded-xl border border-surface-200 hover:bg-surface-100 text-surface-400 transition-colors">
                                <RefreshCw className={`w-4 h-4 ${isPending ? 'animate-spin' : ''}`} />
                            </button>
                        )}
                    </div>
                </div>
            )}

            {/* View mode toggle */}
            {fetched && (
                <div className="flex items-center gap-1 bg-surface-100 p-1 rounded-2xl w-fit">
                    {(['orders', 'goods'] as const).map(mode => (
                        <button key={mode} onClick={() => setViewMode(mode)}
                            className={`px-4 py-1.5 rounded-xl text-xs font-semibold transition-all ${viewMode === mode
                                ? 'bg-white shadow-sm text-surface-800'
                                : 'text-surface-500 hover:text-surface-700'
                                }`}>
                            {mode === 'orders' ? `Đơn hàng (${allOrders.length.toLocaleString()})` : `Hàng hóa (${allGoods.length.toLocaleString()})`}
                        </button>
                    ))}
                </div>
            )}

            {/* Loading skeleton */}
            {isPending && !fetched && (
                <div className="flex flex-col items-center justify-center py-20 gap-4 bg-white rounded-3xl border border-surface-100">
                    <div className="relative">
                        <div className="w-10 h-10 rounded-full border-4 border-accent-100" />
                        <div className="w-10 h-10 rounded-full border-4 border-accent-500 border-t-transparent absolute inset-0 animate-spin" />
                    </div>
                    <p className="text-sm text-surface-500">Đang tải đơn hàng...</p>
                </div>
            )}

            {/* Error */}
            {fetchError && (
                <div className="rounded-2xl border border-danger-200 bg-danger-50 p-3 flex items-center gap-2 text-sm text-danger-700">
                    <XCircle className="size-4 shrink-0" />{fetchError}
                </div>
            )}

            {/* Main content */}
            {fetched && !fetchError && (
                <div className={`space-y-4 transition-opacity ${isPending ? 'opacity-50 pointer-events-none' : ''}`}>

                    {/* ── Orders View ────────────────────────────────────────────── */}
                    {viewMode === 'orders' && (<>

                        {/* ── Filter Bar ─────────────────────────────────────────────── */}
                        <div className="bg-white rounded-2xl border border-surface-100 shadow-sm p-3">
                            <div className="flex flex-wrap items-center gap-2">
                                {/* <span className="flex items-center gap-1 text-xs font-semibold text-surface-500 mr-1">
                                <Filter className="w-3.5 h-3.5" />
                                {activeFilterCount > 0 && (
                                    <span className="flex items-center justify-center w-4 h-4 rounded-full bg-accent-600 text-white text-[10px] font-bold">{activeFilterCount}</span>
                                )}
                            </span> */}

                                {/* Search */}
                                <div className="relative flex-1 min-w-[200px]">
                                    <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-surface-400 pointer-events-none" />
                                    <input value={search} onChange={e => setSearch(e.target.value)}
                                        placeholder="Mã, sản phẩm, nhân viên..."
                                        className="pl-8 w-full pr-3 py-2 text-xs border border-surface-200 rounded-xl bg-white text-surface-700 outline-none focus:ring-2 focus:ring-accent-200 focus:border-accent-400" />
                                </div>

                                {/* Employee */}
                                {filters.employees.length > 0 && (
                                    <div className="relative flex-1 min-w-[200px]">
                                        <select value={selEmployee} onChange={e => setSelEmployee(e.target.value)} className={`${selectCls} appearance-none pr-7`}>
                                            <option value="ALL">Tất cả nhân viên</option>
                                            {filters.employees.map(e => <option key={e} value={e}>{e}</option>)}
                                        </select>
                                        <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-3 h-3 text-surface-400 pointer-events-none" />
                                    </div>
                                )}

                                {/* Status */}
                                {filters.statuses.length > 0 && (
                                    <div className="relative flex-1 min-w-[200px]">
                                        <select value={selStatus} onChange={e => setSelStatus(e.target.value)} className={`${selectCls} appearance-none pr-7`}>
                                            <option value="ALL">Tất cả trạng thái</option>
                                            {filters.statuses.map(s => <option key={s.value} value={String(s.value)}>{s.label}</option>)}
                                        </select>
                                        <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-3 h-3 text-surface-400 pointer-events-none" />
                                    </div>
                                )}

                                {/* Pay method */}
                                {filters.payMethods.length > 0 && (
                                    <div className="relative flex-1 min-w-[200px]">
                                        <select value={selPayMethod} onChange={e => setSelPayMethod(e.target.value)} className={`${selectCls} appearance-none pr-7`}>
                                            <option value="ALL">Tất cả thanh toán</option>
                                            {filters.payMethods.map(p => <option key={p} value={p}>{p}</option>)}
                                        </select>
                                        <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-3 h-3 text-surface-400 pointer-events-none" />
                                    </div>
                                )}

                                {/* Terminal */}
                                {filters.terminals.length > 1 && (
                                    <div className="relative flex-1 min-w-[200px]">
                                        <select value={selTerminal} onChange={e => setSelTerminal(e.target.value)} className={`${selectCls} appearance-none pr-7`}>
                                            <option value="ALL">Tất cả quầy</option>
                                            {filters.terminals.map(t => <option key={t} value={t}>{t}</option>)}
                                        </select>
                                        <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-3 h-3 text-surface-400 pointer-events-none" />
                                    </div>
                                )}

                                {/* Reset */}
                                {activeFilterCount > 0 && (
                                    <button onClick={() => { setSelEmployee('ALL'); setSelStatus('ALL'); setSelPayMethod('ALL'); setSelTerminal('ALL'); setSearch(''); }}
                                        className="text-[11px] text-accent-600 hover:text-accent-800 font-semibold underline">
                                        Xóa lọc
                                    </button>
                                )}

                                {/* Right-side controls */}
                                <div className="ml-auto flex items-center gap-1.5">
                                    {/* Export Excel — custom dialog */}
                                    {filteredOrders.length > 0 && (
                                        <button onClick={() => setShowCustomExport(true)}
                                            className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-emerald-200 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 text-xs font-semibold transition-colors">
                                            <FileDown className="w-3.5 h-3.5" />
                                            Xuất Excel
                                        </button>
                                    )}
                                    {/* Embed: refresh */}
                                    {isEmbedded && (
                                        <button onClick={() => loadOrders(effectiveStart, effectiveEnd)} disabled={isPending}
                                            className="p-1.5 rounded-lg border border-surface-200 hover:bg-surface-100 text-surface-400 transition-colors">
                                            <RefreshCw className={`w-3.5 h-3.5 ${isPending ? 'animate-spin' : ''}`} />
                                        </button>
                                    )}
                                </div>
                            </div>
                        </div>

                        {/* ── Filtered Summary ──────────────────────────────────────── */}
                        {allOrders.length > 0 && (
                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                                {([
                                    { l: 'Số đơn', v: filteredFoot.count.toLocaleString(), c: 'text-surface-800 font-bold' },
                                    { l: 'Tổng SP', v: filteredFoot.totalQty.toLocaleString(), c: 'text-surface-700' },
                                    { l: 'Giảm giá', v: fmtVND(filteredFoot.discountMoney), c: 'text-warning-700' },
                                    { l: 'Hoàn huỷ', v: fmtVND(filteredFoot.cancelMoney), c: 'text-danger-700' },
                                ] as { l: string; v: string; c: string }[]).map(({ l, v, c }) => (
                                    <div key={l} className="bg-white rounded-2xl border border-surface-100 shadow-sm p-3">
                                        <p className="text-[10px] font-semibold uppercase tracking-widest text-surface-400">{l}</p>
                                        <p className={`text-xs mt-0.5 ${c}`}>{v}</p>
                                    </div>
                                ))}
                            </div>
                        )}

                        {/* ── Empty ─────────────────────────────────────────────────── */}
                        {allOrders.length === 0 ? (
                            <div className="flex flex-col items-center justify-center py-20 gap-3 bg-white rounded-3xl border border-surface-100">
                                <ShoppingCart className="size-10 text-surface-300" />
                                <p className="text-sm text-surface-500">Không có đơn hàng nào trong khoảng thời gian này</p>
                            </div>
                        ) : filteredOrders.length === 0 ? (
                            <div className="flex flex-col items-center justify-center py-12 gap-2 bg-white rounded-3xl border border-surface-100">
                                <p className="text-sm text-surface-500">Không có đơn nào khớp với bộ lọc</p>
                                <button onClick={() => { setSelEmployee('ALL'); setSelStatus('ALL'); setSelPayMethod('ALL'); setSelTerminal('ALL'); setSearch(''); }}
                                    className="text-xs text-accent-600 hover:underline font-semibold">Xóa bộ lọc</button>
                            </div>
                        ) : (
                            <>
                                {/* ── Desktop Table ─────────────────────────────────────── */}
                                <div className="hidden md:block overflow-x-auto rounded-2xl border border-surface-100 shadow-sm bg-white">
                                    <table className="w-full text-sm border-collapse">
                                        <thead>
                                            <tr className="bg-surface-50 border-b border-surface-100">
                                                {['Mã đơn', 'Sản phẩm / Quầy', 'Nhân viên', 'Thanh toán', 'SL', 'Thực thu', 'Thuế', 'Trạng thái', 'Thời gian'].map((h) => (
                                                    <th key={h} className="px-4 py-3 text-[11px] font-semibold text-center uppercase tracking-wider text-surface-500 whitespace-nowrap">{h}</th>
                                                ))}
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {paginatedOrders.map((o, i) => (
                                                <tr key={o.orderId} onClick={() => openDetail(o)}
                                                    className={`border-b border-surface-50 cursor-pointer transition-colors hover:bg-accent-50/30 ${i % 2 !== 0 ? 'bg-surface-50/20' : ''} ${o.status === 4 ? 'opacity-60' : ''}`}>
                                                    <td className="px-4 py-2.5 font-mono text-[11px] text-surface-400">{o.orderNumber.slice(-10)}</td>
                                                    <td className="px-4 py-2.5 max-w-[200px]">
                                                        <p className="text-sm text-surface-800 font-medium truncate">{o.goodsNames || '—'}</p>
                                                        {o.terminalName && <p className="text-[11px] text-surface-400 flex items-center gap-1 truncate"><Store className="w-2.5 h-2.5 shrink-0" />{o.terminalName}</p>}
                                                    </td>
                                                    <td className="px-4 py-2.5 text-sm text-surface-700 whitespace-nowrap text-center">{o.employeeName || '—'}</td>
                                                    <td className="px-4 py-2.5 text-sm text-surface-600 whitespace-nowrap text-center">{o.payModeNames || '—'}</td>
                                                    <td className="px-4 py-2.5 text-center font-semibold text-surface-800">{o.totalQty}</td>
                                                    <td className="px-4 py-2.5 text-center">
                                                        <span className={`text-sm font-bold ${o.status === 4 ? 'text-surface-400 line-through' : 'text-success-700'}`}>{fmtVND(o.realMoney)}</span>
                                                    </td>
                                                    <td className="px-4 py-2.5 text-center">
                                                        {o.taxMoney > 0 ? (
                                                            <span className="text-xs text-surface-500">
                                                                {fmtVND(o.taxMoney)}
                                                                {o.taxRate > 0 && <span className="ml-1 text-[10px] text-surface-400">({o.taxRate}%)</span>}
                                                            </span>
                                                        ) : <span className="text-surface-300 text-xs">—</span>}
                                                    </td>
                                                    <td className="px-4 py-2.5 text-center"><StatusBadge status={o.status} label={o.statusName} /></td>
                                                    <td className="px-4 py-2.5 text-center text-[11px] text-surface-400 whitespace-nowrap">{o.createTime.slice(0, 16)}</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>

                                {/* ── Mobile Cards ──────────────────────────────────────── */}
                                <div className="md:hidden space-y-2">
                                    {paginatedOrders.map(o => (
                                        <div key={o.orderId} onClick={() => openDetail(o)}
                                            className={`bg-white rounded-2xl border border-surface-100 shadow-sm p-3.5 cursor-pointer transition-colors hover:border-accent-200 ${o.status === 4 ? 'opacity-60' : ''}`}>
                                            <div className="flex items-start justify-between gap-2 mb-2">
                                                <div className="flex-1 min-w-0">
                                                    <p className="text-sm font-semibold text-surface-800 truncate">{o.goodsNames || '—'}</p>
                                                    <p className="text-[11px] font-mono text-surface-400 mt-0.5">{o.orderNumber.slice(-12)}</p>
                                                </div>
                                                <StatusBadge status={o.status} label={o.statusName} />
                                            </div>
                                            <div className="flex items-center justify-between text-xs text-surface-500 gap-2">
                                                <span className="flex items-center gap-1 min-w-0 truncate"><User className="w-3 h-3 shrink-0" />{o.employeeName || '—'}</span>
                                                <span className="flex items-center gap-1 shrink-0"><CreditCard className="w-3 h-3" />{o.payModeNames || '—'}</span>
                                            </div>
                                            <div className="flex items-center justify-between mt-2 pt-2 border-t border-surface-50">
                                                <span className="text-[11px] text-surface-400">{o.createTime.slice(0, 16)}</span>
                                                <span className={`text-sm font-bold ${o.status === 4 ? 'text-surface-400 line-through' : 'text-success-700'}`}>{fmtVND(o.realMoney)}</span>
                                            </div>
                                        </div>
                                    ))}
                                </div>

                                {/* ── Pagination + Page-size selector ───────────────────── */}
                                <div className="flex flex-wrap items-center justify-between gap-3">
                                    {/* Info + page-size */}
                                    <div className="flex items-center gap-3">
                                        <p className="text-xs text-surface-400">
                                            Trang <span className="font-semibold text-surface-700">{currentPage}</span> / {totalPages}
                                            &nbsp;·&nbsp;<span className="font-semibold text-surface-700">{filteredOrders.length}</span> đơn
                                        </p>
                                        <div className="relative">
                                            <select value={pageSize} onChange={e => { setPageSize(Number(e.target.value)); setCurrentPage(1); }}
                                                className={`${selectCls} appearance-none pr-7`}>
                                                {[20, 50, 100, 500].map(n => <option key={n} value={n}>{n} / trang</option>)}
                                            </select>
                                            <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-3 h-3 text-surface-400 pointer-events-none" />
                                        </div>
                                    </div>
                                    {/* Page buttons */}
                                    {totalPages > 1 && (
                                        <div className="flex gap-1">
                                            <button onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage <= 1}
                                                className="p-2 rounded-xl border border-surface-200 hover:bg-surface-100 disabled:opacity-40 transition-colors">
                                                <ChevronLeft className="w-4 h-4 text-surface-600" />
                                            </button>
                                            {Array.from({ length: Math.min(totalPages, 5) }, (_, idx) => {
                                                const p = Math.max(1, Math.min(currentPage - 2, totalPages - 4)) + idx;
                                                return (
                                                    <button key={p} onClick={() => setCurrentPage(p)}
                                                        className={`px-3 py-1.5 rounded-xl text-sm font-semibold transition-colors ${p === currentPage ? 'bg-accent-600 text-white' : 'border border-surface-200 text-surface-600 hover:bg-surface-100'}`}>
                                                        {p}
                                                    </button>
                                                );
                                            })}
                                            <button onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} disabled={currentPage >= totalPages}
                                                className="p-2 rounded-xl border border-surface-200 hover:bg-surface-100 disabled:opacity-40 transition-colors">
                                                <ChevronRight className="w-4 h-4 text-surface-600" />
                                            </button>
                                        </div>
                                    )}
                                </div>
                            </>
                        )}
                    </>)}

                    {/* ── Goods View ─────────────────────────────────────────────── */}
                    {viewMode === 'goods' && (<>
                        {/* Goods Filter Bar */}
                        <div className="bg-white rounded-2xl border border-surface-100 shadow-sm p-3">
                            <div className="flex flex-wrap items-center gap-2">
                                <div className="relative flex-1 min-w-[200px]">
                                    <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-surface-400 pointer-events-none" />
                                    <input value={gSearch} onChange={e => setGSearch(e.target.value)}
                                        placeholder="Tên hàng, mã đơn, nhân viên..."
                                        className="pl-8 w-full pr-3 py-2 text-xs border border-surface-200 rounded-xl bg-white text-surface-700 outline-none focus:ring-2 focus:ring-accent-200 focus:border-accent-400" />
                                </div>
                                {goodsFilters.categories.length > 0 && (
                                    <div className="relative flex-1 min-w-[180px]">
                                        <select value={gSelCategory} onChange={e => setGSelCategory(e.target.value)} className={`${selectCls} appearance-none pr-7`}>
                                            <option value="ALL">Tất cả danh mục</option>
                                            {goodsFilters.categories.map(c => <option key={c} value={c}>{c}</option>)}
                                        </select>
                                        <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-3 h-3 text-surface-400 pointer-events-none" />
                                    </div>
                                )}
                                {goodsFilters.employees.length > 0 && (
                                    <div className="relative flex-1 min-w-[180px]">
                                        <select value={gSelEmployee} onChange={e => setGSelEmployee(e.target.value)} className={`${selectCls} appearance-none pr-7`}>
                                            <option value="ALL">Tất cả nhân viên</option>
                                            {goodsFilters.employees.map(e => <option key={e} value={e}>{e}</option>)}
                                        </select>
                                        <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-3 h-3 text-surface-400 pointer-events-none" />
                                    </div>
                                )}
                                {goodsFilters.statuses.length > 0 && (
                                    <div className="relative flex-1 min-w-[180px]">
                                        <select value={gSelStatus} onChange={e => setGSelStatus(e.target.value)} className={`${selectCls} appearance-none pr-7`}>
                                            <option value="ALL">Tất cả trạng thái</option>
                                            {goodsFilters.statuses.map(s => <option key={s.value} value={String(s.value)}>{s.label}</option>)}
                                        </select>
                                        <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-3 h-3 text-surface-400 pointer-events-none" />
                                    </div>
                                )}
                                {gActiveFilterCount > 0 && (
                                    <button onClick={() => { setGSelCategory('ALL'); setGSelEmployee('ALL'); setGSelStatus('ALL'); setGSearch(''); }}
                                        className="text-[11px] text-accent-600 hover:text-accent-800 font-semibold underline">
                                        Xóa lọc
                                    </button>
                                )}
                                <div className="ml-auto flex items-center gap-1.5">
                                    {filteredGoods.length > 0 && (
                                        <button onClick={() => setShowCustomExport(true)}
                                            className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-emerald-200 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 text-xs font-semibold transition-colors">
                                            <FileDown className="w-3.5 h-3.5" />
                                            Xuất Excel
                                        </button>
                                    )}
                                    {isEmbedded && (
                                        <button onClick={() => loadOrders(effectiveStart, effectiveEnd)} disabled={isPending}
                                            className="p-1.5 rounded-lg border border-surface-200 hover:bg-surface-100 text-surface-400 transition-colors">
                                            <RefreshCw className={`w-3.5 h-3.5 ${isPending ? 'animate-spin' : ''}`} />
                                        </button>
                                    )}
                                </div>
                            </div>
                        </div>

                        {/* Goods summary */}
                        {filteredGoods.length > 0 && (
                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                                {([
                                    { l: 'Số dòng', v: filteredGoods.length.toLocaleString(), c: 'text-surface-800 font-bold' },
                                    { l: 'Tổng SL', v: filteredGoods.reduce((s, g) => s + g.qty, 0).toLocaleString(), c: 'text-surface-700' },
                                    { l: 'Thực thu', v: filteredGoods.reduce((s, g) => s + g.realMoney, 0).toLocaleString('vi-VN', { style: 'currency', currency: 'VND', maximumFractionDigits: 0 }), c: 'text-success-700 font-bold' },
                                    { l: 'Hoàn huỷ', v: filteredGoods.reduce((s, g) => s + g.cancelMoney, 0).toLocaleString('vi-VN', { style: 'currency', currency: 'VND', maximumFractionDigits: 0 }), c: 'text-danger-700' },
                                ] as { l: string; v: string; c: string }[]).map(({ l, v, c }) => (
                                    <div key={l} className="bg-white rounded-2xl border border-surface-100 shadow-sm p-3">
                                        <p className="text-[10px] font-semibold uppercase tracking-widest text-surface-400">{l}</p>
                                        <p className={`text-xs mt-0.5 ${c}`}>{v}</p>
                                    </div>
                                ))}
                            </div>
                        )}

                        {/* Goods empty */}
                        {allGoods.length === 0 ? (
                            <div className="flex flex-col items-center justify-center py-20 gap-3 bg-white rounded-3xl border border-surface-100">
                                <Package className="size-10 text-surface-300" />
                                <p className="text-sm text-surface-500">Không có hàng hóa trong khoảng thời gian này</p>
                            </div>
                        ) : filteredGoods.length === 0 ? (
                            <div className="flex flex-col items-center justify-center py-12 gap-2 bg-white rounded-3xl border border-surface-100">
                                <p className="text-sm text-surface-500">Không có hàng hóa khớp với bộ lọc</p>
                                <button onClick={() => { setGSelCategory('ALL'); setGSelEmployee('ALL'); setGSelStatus('ALL'); setGSearch(''); }}
                                    className="text-xs text-accent-600 hover:underline font-semibold">Xóa bộ lọc</button>
                            </div>
                        ) : (<>
                            {/* Goods Desktop Table */}
                            <div className="hidden md:block overflow-x-auto rounded-2xl border border-surface-100 shadow-sm bg-white">
                                <table className="w-full text-sm border-collapse">
                                    <thead>
                                        <tr className="bg-surface-50 border-b border-surface-100">
                                            {['Mã đơn', 'Thời gian', 'Tên hàng', 'Danh mục', 'SL', 'Đơn giá', 'Thuế', 'Thực thu', 'Thanh toán', 'Nhân viên'].map(h => (
                                                <th key={h} className="px-4 py-3 text-[11px] font-semibold text-center uppercase tracking-wider text-surface-500 whitespace-nowrap">{h}</th>
                                            ))}
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {paginatedGoodsWithGroupColor.map((g, i) => (
                                            <tr key={`${g.orderId}-${g.id}-${i}`}
                                                className={`border-b border-surface-50 transition-colors hover:bg-accent-50/40 ${g.isAlt ? 'bg-surface-50/70' : 'bg-white'} ${g.status === 4 ? 'opacity-60' : ''}`}>
                                                <td className="px-4 py-2.5 font-mono text-[11px] text-surface-400 text-center">{g.orderNumber.slice(-10)}</td>
                                                <td className="px-4 py-2.5 text-[11px] text-surface-400 whitespace-nowrap text-center">{g.createTime.slice(0, 16)}</td>
                                                <td className="px-4 py-2.5 max-w-[180px]">
                                                    <p className="text-sm text-surface-800 font-medium truncate">{g.goodsName || '—'}</p>
                                                </td>
                                                <td className="px-4 py-2.5 text-xs text-surface-500 text-center whitespace-nowrap">{g.showCategoryName || '—'}</td>
                                                <td className="px-4 py-2.5 text-center font-semibold text-surface-800">{g.qty}</td>
                                                <td className="px-4 py-2.5 text-center text-xs text-surface-600">{fmtVND(g.price)}</td>
                                                <td className="px-4 py-2.5 text-center text-xs text-surface-600">{fmtVND(g.taxMoney)}</td>
                                                <td className="px-4 py-2.5 text-center">
                                                    <span className={`text-sm font-bold ${g.status === 4 ? 'text-surface-400 line-through' : 'text-success-700'}`}>{fmtVND(g.realMoney)}</span>
                                                </td>
                                                <td className="px-4 py-2.5 text-center text-xs text-surface-600 whitespace-nowrap">{g.payModeNames || '—'}</td>
                                                <td className="px-4 py-2.5 text-center text-xs text-surface-700">{g.employeeName || '—'}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>

                            {/* Goods Mobile Cards */}
                            <div className="md:hidden space-y-2">
                                {paginatedGoodsWithGroupColor.map((g, i) => (
                                    <div key={`${g.orderId}-${g.id}-${i}`}
                                        className={`rounded-2xl border shadow-sm p-3.5 ${g.isAlt ? 'bg-surface-50 border-surface-200' : 'bg-white border-surface-100'} ${g.status === 4 ? 'opacity-60' : ''}`}>
                                        <div className="flex items-start justify-between gap-2 mb-1">
                                            <p className="text-sm font-semibold text-surface-800 truncate flex-1">{g.goodsName}</p>
                                            <span className={`text-sm font-bold shrink-0 ${g.status === 4 ? 'text-surface-400 line-through' : 'text-success-700'}`}>{fmtVND(g.realMoney)}</span>
                                        </div>
                                        <p className="text-[11px] text-surface-400">{g.showCategoryName} · {g.createTime.slice(0, 16)}</p>
                                        <div className="flex items-center justify-between mt-2 pt-2 border-t border-surface-50 text-xs text-surface-500">
                                            <span><User className="w-3 h-3 inline mr-1" />{g.employeeName}</span>
                                            <span>SL: {g.qty} · {fmtVND(g.price)}</span>
                                        </div>
                                    </div>
                                ))}
                            </div>

                            {/* Goods Pagination */}
                            <div className="flex flex-wrap items-center justify-between gap-3">
                                <div className="flex items-center gap-3">
                                    <p className="text-xs text-surface-400">
                                        Trang <span className="font-semibold text-surface-700">{gCurrentPage}</span> / {gTotalPages}
                                        &nbsp;·&nbsp;<span className="font-semibold text-surface-700">{filteredGoods.length}</span> dòng
                                    </p>
                                    <div className="relative">
                                        <select value={gPageSize} onChange={e => { setGPageSize(Number(e.target.value)); setGCurrentPage(1); }}
                                            className={`${selectCls} appearance-none pr-7`}>
                                            {[20, 50, 100, 500].map(n => <option key={n} value={n}>{n} / trang</option>)}
                                        </select>
                                        <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-3 h-3 text-surface-400 pointer-events-none" />
                                    </div>
                                </div>
                                {gTotalPages > 1 && (
                                    <div className="flex gap-1">
                                        <button onClick={() => setGCurrentPage(p => Math.max(1, p - 1))} disabled={gCurrentPage <= 1}
                                            className="p-2 rounded-xl border border-surface-200 hover:bg-surface-100 disabled:opacity-40 transition-colors">
                                            <ChevronLeft className="w-4 h-4 text-surface-600" />
                                        </button>
                                        {Array.from({ length: Math.min(gTotalPages, 5) }, (_, idx) => {
                                            const p = Math.max(1, Math.min(gCurrentPage - 2, gTotalPages - 4)) + idx;
                                            return (
                                                <button key={p} onClick={() => setGCurrentPage(p)}
                                                    className={`px-3 py-1.5 rounded-xl text-sm font-semibold transition-colors ${p === gCurrentPage ? 'bg-accent-600 text-white' : 'border border-surface-200 text-surface-600 hover:bg-surface-100'}`}>
                                                    {p}
                                                </button>
                                            );
                                        })}
                                        <button onClick={() => setGCurrentPage(p => Math.min(gTotalPages, p + 1))} disabled={gCurrentPage >= gTotalPages}
                                            className="p-2 rounded-xl border border-surface-200 hover:bg-surface-100 disabled:opacity-40 transition-colors">
                                            <ChevronRight className="w-4 h-4 text-surface-600" />
                                        </button>
                                    </div>
                                )}
                            </div>
                        </>)}
                    </>)}

                </div>
            )}

            {/* ── Detail Drawer ───────────────────────────────────────────────── */}
            {selectedOrder && (
                <DetailDrawer
                    order={selectedOrder}
                    detail={detail}
                    loading={detailLoading}
                    onClose={() => setSelectedOrder(null)}
                />
            )}

            {/* ── Export Modal (legacy, kept for reference) ───────────────── */}
            <ExportModal
                isOpen={isExportOpen}
                onClose={() => setIsExportOpen(false)}
                data={activeExportData}
                columns={activeExportColumns}
            />

            {/* ── Orders Custom Excel Export Dialog ────────────────────────── */}
            <OrdersExcelExportDialog
                open={showCustomExport}
                onClose={() => setShowCustomExport(false)}
                orders={viewMode === 'orders' ? filteredOrders : allOrders}
                goods={allGoods}
                viewMode={viewMode}
                activeRange={`${effectiveStart}_${effectiveEnd}`}
            />
        </div>
    );
}
