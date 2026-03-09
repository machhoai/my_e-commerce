'use client';

import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import {
    Search, RefreshCw, FileText, ExternalLink, Package,
    Clock, Warehouse, ChevronDown, Filter, Printer,
    User, Building, Truck, CheckCircle2, XCircle, X,
    QrCode, ClipboardList,
} from 'lucide-react';
import type { PurchaseOrderDoc } from '@/types/inventory';
import type { StoreDoc, WarehouseDoc } from '@/types';
import Portal from '@/components/Portal';
import { QRCodeSVG } from 'qrcode.react';

const STATUS_CONFIG: Record<string, { label: string; badge: string }> = {
    PENDING_OFFICE: { label: 'Chờ VP duyệt', badge: 'bg-amber-100 text-amber-700 border-amber-200' },
    APPROVED_BY_OFFICE: { label: 'Chờ kho chấp nhận', badge: 'bg-sky-100 text-sky-700 border-sky-200' },
    PACKING: { label: 'Đang đóng gói', badge: 'bg-orange-100 text-orange-700 border-orange-200' },
    IN_TRANSIT: { label: 'Đang vận chuyển', badge: 'bg-indigo-100 text-indigo-700 border-indigo-200' },
    COMPLETED: { label: 'Hoàn tất', badge: 'bg-emerald-100 text-emerald-700 border-emerald-200' },
    REJECTED: { label: 'Từ chối', badge: 'bg-red-100 text-red-700 border-red-200' },
    CANCELED: { label: 'Đã hủy', badge: 'bg-slate-100 text-slate-500 border-slate-200' },
    PENDING: { label: 'Chờ duyệt', badge: 'bg-amber-100 text-amber-700 border-amber-200' },
    DISPATCHED: { label: 'Đã xuất', badge: 'bg-indigo-100 text-indigo-700 border-indigo-200' },
};

export default function WarehouseHistoryPage() {
    const { user, userDoc } = useAuth();
    const [orders, setOrders] = useState<PurchaseOrderDoc[]>([]);
    const [stores, setStores] = useState<StoreDoc[]>([]);
    const [warehouses, setWarehouses] = useState<WarehouseDoc[]>([]);
    const [loading, setLoading] = useState(true);

    // Filters
    const [search, setSearch] = useState('');
    const [filterStatus, setFilterStatus] = useState('');
    const [filterStoreId, setFilterStoreId] = useState('');
    const [filterWarehouseId, setFilterWarehouseId] = useState('');
    const [showFilters, setShowFilters] = useState(false);

    // Detail modal
    const [selectedOrder, setSelectedOrder] = useState<PurchaseOrderDoc | null>(null);
    const printRef = useRef<HTMLDivElement>(null);

    const getToken = useCallback(() => user?.getIdToken(), [user]);

    // Fetch stores & warehouses
    useEffect(() => {
        if (!user) return;
        (async () => {
            try {
                const token = await getToken();
                const headers = { Authorization: `Bearer ${token}` };
                const [stRes, whRes] = await Promise.all([
                    fetch('/api/stores', { headers }),
                    fetch('/api/warehouses', { headers }),
                ]);
                const [stData, whData] = await Promise.all([stRes.json(), whRes.json()]);
                setStores(Array.isArray(stData) ? stData : []);
                setWarehouses(Array.isArray(whData) ? whData.filter((w: WarehouseDoc) => w.isActive) : []);
            } catch { /* silent */ }
        })();
    }, [user, getToken]);

    // Fetch all orders
    const fetchOrders = useCallback(async () => {
        if (!user) return;
        setLoading(true);
        try {
            const token = await getToken();
            const res = await fetch('/api/inventory/orders?limit=200', {
                headers: { Authorization: `Bearer ${token}` },
            });
            const data = await res.json();
            setOrders(Array.isArray(data) ? data : []);
        } catch { /* silent */ } finally { setLoading(false); }
    }, [user, getToken]);

    useEffect(() => { fetchOrders(); }, [fetchOrders]);

    // Guard
    if (userDoc && userDoc.role !== 'admin' && !userDoc.customRoleId) {
        return <div className="flex items-center justify-center h-64 text-red-500 font-bold">Không có quyền truy cập.</div>;
    }

    // Filtering
    const filtered = useMemo(() => {
        return orders.filter(o => {
            if (filterStatus && o.status !== filterStatus) return false;
            if (filterStoreId && o.storeId !== filterStoreId) return false;
            if (filterWarehouseId && o.warehouseId !== filterWarehouseId) return false;
            if (search) {
                const q = search.toLowerCase();
                return (
                    o.storeName?.toLowerCase().includes(q) ||
                    o.createdByName?.toLowerCase().includes(q) ||
                    o.id?.toLowerCase().includes(q) ||
                    o.warehouseName?.toLowerCase().includes(q) ||
                    o.items.some(i => i.productName?.toLowerCase().includes(q) || i.productCode?.toLowerCase().includes(q))
                );
            }
            return true;
        });
    }, [orders, search, filterStatus, filterStoreId, filterWarehouseId]);

    const handlePrint = () => {
        if (!printRef.current) return;
        const printContent = printRef.current.innerHTML;
        const win = window.open('', '_blank', 'width=800,height=600');
        if (!win) return;
        win.document.write(`<!DOCTYPE html><html><head><title>Chi tiết đơn hàng</title>
            <style>
                body { font-family: Arial, sans-serif; padding: 24px; color: #1e293b; }
                h1 { font-size: 20px; margin: 0 0 4px; }
                h2 { font-size: 16px; margin: 16px 0 8px; color: #334155; }
                .meta { font-size: 13px; color: #64748b; margin-bottom: 16px; }
                .meta p { margin: 2px 0; }
                table { width: 100%; border-collapse: collapse; margin: 12px 0; }
                th, td { border: 1px solid #cbd5e1; padding: 8px 12px; text-align: left; font-size: 13px; }
                th { background: #f1f5f9; font-weight: 600; }
                .code { font-weight: bold; color: #2563eb; }
                .footer { margin-top: 32px; font-size: 11px; color: #94a3b8; text-align: center; }
            </style>
        </head><body>${printContent}</body></html>`);
        win.document.close();
        win.focus();
        setTimeout(() => { win.print(); win.close(); }, 300);
    };

    const qrUrl = selectedOrder?.qrCodeToken
        ? `${typeof window !== 'undefined' ? window.location.origin : ''}/manager/inventory/receive/${selectedOrder.id}?token=${selectedOrder.qrCodeToken}`
        : '';

    return (
        <div className="space-y-6 mx-auto">
            {/* Header */}
            <div className="flex items-start justify-between gap-4 flex-wrap">
                <div>
                    <h1 className="text-2xl font-bold bg-gradient-to-r from-violet-600 to-purple-600 bg-clip-text text-transparent flex items-center gap-2">
                        <ClipboardList className="w-7 h-7 text-violet-600" />
                        Lịch sử đơn hàng
                    </h1>
                    <p className="text-slate-500 mt-1">Xem tất cả đơn hàng, phiếu xuất kho, và thông tin duyệt.</p>
                </div>
                <button onClick={fetchOrders}
                    className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 rounded-xl text-sm font-medium text-slate-600 hover:bg-slate-50 transition-colors shadow-sm">
                    <RefreshCw className="w-4 h-4" /> Làm mới
                </button>
            </div>

            {/* Toolbar */}
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4 space-y-3">
                <div className="flex items-center gap-3">
                    <div className="relative flex-1">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                        <input value={search} onChange={e => setSearch(e.target.value)}
                            placeholder="Tìm theo cửa hàng, người đặt, mã đơn, sản phẩm..."
                            className="w-full pl-9 bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-sm outline-none focus:ring-2 focus:ring-violet-300" />
                    </div>
                    <button onClick={() => setShowFilters(v => !v)}
                        className={`flex items-center gap-1.5 px-3 py-2.5 rounded-xl border text-sm font-medium transition-colors ${showFilters ? 'bg-violet-600 text-white border-violet-600' : 'bg-slate-50 text-slate-600 border-slate-200 hover:border-violet-300'}`}>
                        <Filter className="w-4 h-4" />
                        <span className="hidden sm:inline">Bộ lọc</span>
                    </button>
                </div>

                {showFilters && (
                    <div className="flex flex-wrap gap-3 pt-3 border-t border-slate-100">
                        <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)}
                            className="bg-slate-50 border border-slate-200 rounded-xl p-2 text-sm outline-none focus:ring-2 focus:ring-violet-300">
                            <option value="">Tất cả trạng thái</option>
                            {Object.entries(STATUS_CONFIG).map(([k, v]) => (
                                <option key={k} value={k}>{v.label}</option>
                            ))}
                        </select>
                        <select value={filterStoreId} onChange={e => setFilterStoreId(e.target.value)}
                            className="bg-slate-50 border border-slate-200 rounded-xl p-2 text-sm outline-none focus:ring-2 focus:ring-violet-300">
                            <option value="">Tất cả cửa hàng</option>
                            {stores.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                        </select>
                        <select value={filterWarehouseId} onChange={e => setFilterWarehouseId(e.target.value)}
                            className="bg-slate-50 border border-slate-200 rounded-xl p-2 text-sm outline-none focus:ring-2 focus:ring-violet-300">
                            <option value="">Tất cả kho</option>
                            {warehouses.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
                        </select>
                    </div>
                )}
            </div>

            {/* Stats */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                {[
                    { label: 'Tổng đơn', value: filtered.length, color: 'text-slate-800' },
                    { label: 'Hoàn tất', value: filtered.filter(o => o.status === 'COMPLETED').length, color: 'text-emerald-600' },
                    { label: 'Đang xử lý', value: filtered.filter(o => ['PENDING_OFFICE', 'APPROVED_BY_OFFICE', 'IN_TRANSIT'].includes(o.status)).length, color: 'text-indigo-600' },
                    { label: 'Từ chối/Hủy', value: filtered.filter(o => ['REJECTED', 'CANCELED'].includes(o.status)).length, color: 'text-red-500' },
                ].map(card => (
                    <div key={card.label} className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4 text-center">
                        <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wide">{card.label}</p>
                        <p className={`text-2xl font-black mt-1 ${card.color}`}>{card.value}</p>
                    </div>
                ))}
            </div>

            {/* Orders List */}
            {loading ? (
                <div className="flex justify-center py-16">
                    <div className="w-8 h-8 border-4 border-slate-200 border-t-violet-500 rounded-full animate-spin" />
                </div>
            ) : filtered.length === 0 ? (
                <div className="bg-white rounded-2xl border border-slate-200 shadow-sm text-center py-16">
                    <ClipboardList className="w-12 h-12 text-slate-200 mx-auto mb-3" />
                    <p className="text-slate-500 font-medium">Không tìm thấy đơn hàng</p>
                </div>
            ) : (
                <div className="space-y-3">
                    <p className="text-xs text-slate-400 font-medium">Hiển thị {filtered.length} đơn hàng</p>
                    {filtered.map(order => {
                        const status = STATUS_CONFIG[order.status] || { label: order.status, badge: 'bg-slate-100 text-slate-500 border-slate-200' };

                        return (
                            <div key={order.id}
                                className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden hover:shadow-md transition-shadow cursor-pointer"
                                onClick={() => setSelectedOrder(order)}>
                                <div className="px-5 py-4 flex items-start gap-4">
                                    <div className="w-10 h-10 rounded-xl bg-violet-50 flex items-center justify-center shrink-0">
                                        <Package className="w-5 h-5 text-violet-600" />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2 flex-wrap">
                                            <h3 className="font-bold text-slate-800">{order.storeName || '—'}</h3>
                                            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${status.badge}`}>
                                                {status.label}
                                            </span>
                                            {order.warehouseName && (
                                                <span className="text-[10px] font-bold text-orange-600 flex items-center gap-0.5">
                                                    <Warehouse className="w-3 h-3" /> {order.warehouseName}
                                                </span>
                                            )}
                                        </div>
                                        <div className="flex items-center gap-3 mt-1 text-xs text-slate-500 flex-wrap">
                                            <span className="flex items-center gap-1"><User className="w-3 h-3" /> {order.createdByName}</span>
                                            <span className="flex items-center gap-1"><Clock className="w-3 h-3" /> {new Date(order.timestamp).toLocaleString('vi-VN')}</span>
                                            <span className="font-medium text-slate-600">{order.items.length} SP · {order.items.reduce((s, i) => s + i.requestedQty, 0)} đơn vị</span>
                                        </div>
                                        {/* Approver info */}
                                        <div className="flex items-center gap-3 mt-1 text-[10px] flex-wrap">
                                            {order.officeApprovedByName && (
                                                <span className="text-sky-600 flex items-center gap-1">
                                                    <Building className="w-3 h-3" /> VP: {order.officeApprovedByName}
                                                </span>
                                            )}
                                            {(order.warehouseDispatchedByName || order.approvedByName) && (
                                                <span className="text-emerald-600 flex items-center gap-1">
                                                    <Truck className="w-3 h-3" /> Kho: {order.warehouseDispatchedByName || order.approvedByName}
                                                </span>
                                            )}
                                        </div>
                                    </div>

                                    {/* Attachments */}
                                    <div className="flex flex-col items-end gap-1 shrink-0">
                                        {order.attachmentUrl && (
                                            <a href={order.attachmentUrl} target="_blank" rel="noopener noreferrer"
                                                onClick={e => e.stopPropagation()}
                                                className="inline-flex items-center gap-1 text-[10px] font-bold text-indigo-600 hover:text-indigo-800">
                                                <FileText className="w-3 h-3" /> Đề xuất <ExternalLink className="w-2.5 h-2.5" />
                                            </a>
                                        )}
                                        {order.officeExportSlipUrl && (
                                            <a href={order.officeExportSlipUrl} target="_blank" rel="noopener noreferrer"
                                                onClick={e => e.stopPropagation()}
                                                className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-600 hover:text-emerald-800">
                                                <FileText className="w-3 h-3" /> Phiếu xuất <ExternalLink className="w-2.5 h-2.5" />
                                            </a>
                                        )}
                                    </div>
                                </div>

                                {/* Items preview */}
                                <div className="px-5 pb-3 flex flex-wrap gap-1.5">
                                    {order.items.slice(0, 5).map((item, i) => (
                                        <span key={i} className="text-[11px] bg-slate-100 text-slate-600 px-2 py-0.5 rounded-lg">
                                            {item.productCode && <span className="font-mono font-bold mr-1">{item.productCode}</span>}
                                            ×{item.requestedQty}
                                            {item.dispatchedQty != null && item.dispatchedQty !== item.requestedQty && (
                                                <span className="text-amber-600 ml-1">(xuất {item.dispatchedQty})</span>
                                            )}
                                        </span>
                                    ))}
                                    {order.items.length > 5 && <span className="text-[11px] text-slate-400">+{order.items.length - 5}</span>}
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}

            {/* Detail Modal */}
            {selectedOrder && (
                <Portal>
                    <div className="fixed inset-0 z-[110] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
                        <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
                            {/* Modal Header */}
                            <div className="p-5 border-b border-slate-100 flex items-center justify-between sticky top-0 bg-white z-10 rounded-t-2xl">
                                <div className="flex items-center gap-2">
                                    <ClipboardList className="w-5 h-5 text-violet-600" />
                                    <h2 className="text-lg font-bold text-slate-800">Chi tiết đơn hàng</h2>
                                </div>
                                <div className="flex items-center gap-2">
                                    <button onClick={handlePrint}
                                        className="flex items-center gap-1.5 bg-violet-600 hover:bg-violet-700 text-white px-3 py-1.5 rounded-lg text-sm font-medium transition-colors">
                                        <Printer className="w-4 h-4" /> In đơn hàng
                                    </button>
                                    <button onClick={() => setSelectedOrder(null)}
                                        className="text-slate-400 hover:text-slate-700 p-1">
                                        <X className="w-5 h-5" />
                                    </button>
                                </div>
                            </div>

                            {/* Printable content */}
                            <div ref={printRef} className="p-6 space-y-5">
                                <h1 style={{ fontSize: '20px', fontWeight: 'bold', margin: '0 0 4px' }}>CHI TIẾT ĐƠN HÀNG</h1>

                                {/* Meta info */}
                                <div style={{ fontSize: '13px', color: '#64748b' }} className="space-y-0.5">
                                    <p>Mã đơn: <strong className="text-slate-800">{selectedOrder.id}</strong></p>
                                    <p>Cửa hàng: <strong className="text-slate-800">{selectedOrder.storeName || selectedOrder.storeId}</strong></p>
                                    {selectedOrder.warehouseName && <p>Kho: <strong className="text-slate-800">{selectedOrder.warehouseName}</strong></p>}
                                    <p>Trạng thái: <strong className="text-slate-800">{STATUS_CONFIG[selectedOrder.status]?.label || selectedOrder.status}</strong></p>
                                </div>

                                {/* People */}
                                <div className="bg-slate-50 rounded-xl p-4 space-y-2">
                                    <h2 className="text-sm font-bold text-slate-700 flex items-center gap-1.5" style={{ fontSize: '14px' }}>
                                        <User className="w-4 h-4" /> Thông tin nhân sự
                                    </h2>
                                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                                        <div className="bg-white rounded-lg p-3 border border-slate-200">
                                            <p className="text-slate-400 mb-0.5">Người đặt</p>
                                            <p className="font-bold text-slate-800">{selectedOrder.createdByName || '—'}</p>
                                            <p className="text-slate-400 mt-0.5">{new Date(selectedOrder.timestamp).toLocaleString('vi-VN')}</p>
                                        </div>
                                        <div className="bg-white rounded-lg p-3 border border-slate-200">
                                            <p className="text-slate-400 mb-0.5">VP duyệt</p>
                                            <p className="font-bold text-sky-700">{selectedOrder.officeApprovedByName || '—'}</p>
                                            {selectedOrder.officeApprovedAt && (
                                                <p className="text-slate-400 mt-0.5">{new Date(selectedOrder.officeApprovedAt).toLocaleString('vi-VN')}</p>
                                            )}
                                        </div>
                                        <div className="bg-white rounded-lg p-3 border border-slate-200">
                                            <p className="text-slate-400 mb-0.5">Kho duyệt xuất</p>
                                            <p className="font-bold text-emerald-700">{selectedOrder.warehouseDispatchedByName || selectedOrder.approvedByName || '—'}</p>
                                            {selectedOrder.dispatchedAt && (
                                                <p className="text-slate-400 mt-0.5">{new Date(selectedOrder.dispatchedAt).toLocaleString('vi-VN')}</p>
                                            )}
                                        </div>
                                    </div>
                                </div>

                                {/* Attachments */}
                                {(selectedOrder.attachmentUrl || selectedOrder.officeExportSlipUrl) && (
                                    <div className="bg-slate-50 rounded-xl p-4 space-y-2">
                                        <h2 className="text-sm font-bold text-slate-700 flex items-center gap-1.5" style={{ fontSize: '14px' }}>
                                            <FileText className="w-4 h-4" /> Tài liệu đính kèm
                                        </h2>
                                        <div className="flex flex-wrap gap-2">
                                            {selectedOrder.attachmentUrl && (
                                                <a href={selectedOrder.attachmentUrl} target="_blank" rel="noopener noreferrer"
                                                    className="flex items-center gap-1.5 text-xs font-bold text-indigo-600 hover:text-indigo-800 border border-indigo-200 hover:border-indigo-400 px-3 py-2 rounded-xl transition-colors bg-white">
                                                    <FileText className="w-4 h-4" /> File đề xuất cơ cấu
                                                    <ExternalLink className="w-3 h-3" />
                                                </a>
                                            )}
                                            {selectedOrder.officeExportSlipUrl && (
                                                <a href={selectedOrder.officeExportSlipUrl} target="_blank" rel="noopener noreferrer"
                                                    className="flex items-center gap-1.5 text-xs font-bold text-emerald-600 hover:text-emerald-800 border border-emerald-200 hover:border-emerald-400 px-3 py-2 rounded-xl transition-colors bg-white">
                                                    <FileText className="w-4 h-4" /> Phiếu xuất kho (VP)
                                                    <ExternalLink className="w-3 h-3" />
                                                </a>
                                            )}
                                        </div>
                                    </div>
                                )}

                                {/* Items table */}
                                <div>
                                    <h2 className="text-sm font-bold text-slate-700 mb-2 flex items-center gap-1.5" style={{ fontSize: '14px' }}>
                                        <Package className="w-4 h-4" /> Sản phẩm ({selectedOrder.items.length})
                                    </h2>
                                    <table style={{ width: '100%', borderCollapse: 'collapse' }} className="text-sm">
                                        <thead>
                                            <tr>
                                                <th style={{ border: '1px solid #cbd5e1', padding: '8px 12px', textAlign: 'left', fontSize: '12px', background: '#f1f5f9', fontWeight: 600 }}>Sản phẩm</th>
                                                <th style={{ border: '1px solid #cbd5e1', padding: '8px 12px', textAlign: 'left', fontSize: '12px', background: '#f1f5f9', fontWeight: 600 }}>ĐVT</th>
                                                <th style={{ border: '1px solid #cbd5e1', padding: '8px 12px', textAlign: 'right', fontSize: '12px', background: '#f1f5f9', fontWeight: 600 }}>SL yêu cầu</th>
                                                <th style={{ border: '1px solid #cbd5e1', padding: '8px 12px', textAlign: 'right', fontSize: '12px', background: '#f1f5f9', fontWeight: 600 }}>SL thực xuất</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {selectedOrder.items.map(item => (
                                                <tr key={item.productId}>
                                                    <td style={{ border: '1px solid #cbd5e1', padding: '8px 12px', fontSize: '13px' }}>
                                                        {item.productCode && <span style={{ fontWeight: 'bold', color: '#2563eb', fontFamily: 'monospace', marginRight: '8px' }}>{item.productCode}</span>}
                                                        <span style={{ color: '#64748b' }}>{item.productName}</span>
                                                    </td>
                                                    <td style={{ border: '1px solid #cbd5e1', padding: '8px 12px', fontSize: '13px' }}>{item.unit}</td>
                                                    <td style={{ border: '1px solid #cbd5e1', padding: '8px 12px', fontSize: '13px', textAlign: 'right' }}>{item.requestedQty}</td>
                                                    <td style={{ border: '1px solid #cbd5e1', padding: '8px 12px', fontSize: '13px', textAlign: 'right', fontWeight: 'bold' }}>
                                                        {item.dispatchedQty ?? item.approvedQty ?? '—'}
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>

                                {/* QR code if available */}
                                {selectedOrder.qrCodeToken && qrUrl && (
                                    <div style={{ marginTop: '20px', textAlign: 'center' }}>
                                        <QRCodeSVG value={qrUrl} size={160} level="H" />
                                        <p style={{ fontSize: '11px', color: '#64748b', marginTop: '8px' }}>Mã QR nhận hàng</p>
                                    </div>
                                )}

                                {/* Notes */}
                                {selectedOrder.note && (
                                    <div className="bg-amber-50 rounded-xl p-3 border border-amber-200">
                                        <p className="text-xs text-amber-700"><strong>Ghi chú:</strong> {selectedOrder.note}</p>
                                    </div>
                                )}
                                {selectedOrder.rejectReason && (
                                    <div className="bg-red-50 rounded-xl p-3 border border-red-200">
                                        <p className="text-xs text-red-700"><strong>Lý do từ chối:</strong> {selectedOrder.rejectReason}</p>
                                    </div>
                                )}
                                {selectedOrder.cancelReason && (
                                    <div className="bg-slate-50 rounded-xl p-3 border border-slate-200">
                                        <p className="text-xs text-slate-600"><strong>Lý do hủy:</strong> {selectedOrder.cancelReason}</p>
                                    </div>
                                )}

                                <p style={{ marginTop: '24px', fontSize: '11px', color: '#94a3b8', textAlign: 'center' }}>
                                    Hệ thống quản lý kho — In ngày {new Date().toLocaleString('vi-VN')}
                                </p>
                            </div>
                        </div>
                    </div>
                </Portal>
            )}
        </div>
    );
}
