'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Truck, CheckCircle2, AlertCircle, ChevronDown, X, Package, Printer, QrCode, XCircle, Warehouse, FileText, ExternalLink, PackageCheck } from 'lucide-react';
import Portal from '@/components/Portal';
import type { PurchaseOrderDoc, PurchaseOrderItem } from '@/types/inventory';
import type { StoreDoc, WarehouseDoc } from '@/types';
import { QRCodeSVG } from 'qrcode.react';
import { DashboardHeader } from '@/components/inventory/overview/DashboardHeader';

interface DispatchResult {
    orderId: string;
    qrCodeToken: string;
    order: PurchaseOrderDoc;
    items: (PurchaseOrderItem & { approvedQty: number })[];
}

export default function AdminDispatchPage() {
    const { user, userDoc, hasPermission } = useAuth();
    const [orders, setOrders] = useState<PurchaseOrderDoc[]>([]);
    const [stores, setStores] = useState<StoreDoc[]>([]);
    const [warehouses, setWarehouses] = useState<WarehouseDoc[]>([]);
    const [selectedStoreId, setSelectedStoreId] = useState('');
    const [selectedWarehouseId, setSelectedWarehouseId] = useState('');
    const [loading, setLoading] = useState(true);
    const [dispatchingId, setDispatchingId] = useState<string | null>(null);
    const [modalItems, setModalItems] = useState<(PurchaseOrderItem & { approvedQty: number })[]>([]);
    const [message, setMessage] = useState({ type: '', text: '' });
    const [dispatchResult, setDispatchResult] = useState<DispatchResult | null>(null);
    const printRef = useRef<HTMLDivElement>(null);

    // Reject state
    const [rejectingId, setRejectingId] = useState<string | null>(null);
    const [rejectReason, setRejectReason] = useState('');
    const [isRejecting, setIsRejecting] = useState(false);

    const getToken = useCallback(() => user?.getIdToken(), [user]);

    if (userDoc && userDoc.role !== 'admin' && !hasPermission('page.admin.inventory.dispatch')) {
        return (
            <div className="flex flex-col items-center justify-center h-64 text-danger-500">
                <AlertCircle className="w-12 h-12 mb-2" />
                <p className="font-bold">Chỉ quản trị viên mới có quyền truy cập.</p>
            </div>
        );
    }

    // Fetch stores
    useEffect(() => {
        if (!user) return;
        (async () => {
            try {
                const token = await getToken();
                const res = await fetch('/api/stores', { headers: { Authorization: `Bearer ${token}` } });
                const data = await res.json();
                setStores(Array.isArray(data) ? data : []);
            } catch { /* silent */ }
        })();
    }, [user, getToken]);

    // Fetch warehouses
    useEffect(() => {
        if (!user) return;
        (async () => {
            try {
                const token = await getToken();
                const res = await fetch('/api/warehouses', { headers: { Authorization: `Bearer ${token}` } });
                const data = await res.json();
                setWarehouses(Array.isArray(data) ? data.filter((w: WarehouseDoc) => w.isActive) : []);
            } catch { /* silent */ }
        })();
    }, [user, getToken]);

    // Fetch APPROVED_BY_OFFICE + PACKING orders
    const fetchOrders = useCallback(async () => {
        if (!user) return;
        setLoading(true);
        try {
            const token = await getToken();
            let url = '/api/inventory/orders?status=APPROVED_BY_OFFICE,PACKING';
            if (selectedStoreId) url += `&storeId=${selectedStoreId}`;
            if (selectedWarehouseId) url += `&warehouseId=${selectedWarehouseId}`;
            const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
            const data = await res.json();
            setOrders(Array.isArray(data) ? data : []);
        } catch { /* silent */ } finally { setLoading(false); }
    }, [user, selectedStoreId, selectedWarehouseId, getToken]);

    useEffect(() => { fetchOrders(); }, [fetchOrders]);

    const openDispatchModal = (order: PurchaseOrderDoc) => {
        setDispatchingId(order.id);
        setModalItems(order.items.map(i => ({ ...i, approvedQty: i.requestedQty })));
    };

    const handleDispatch = async () => {
        if (!dispatchingId) return;
        setMessage({ type: '', text: '' });
        try {
            const token = await getToken();
            const currentOrder = orders.find(o => o.id === dispatchingId)!;
            const resolvedStoreName = stores.find(s => s.id === currentOrder.storeId)?.name || currentOrder.storeId;

            const res = await fetch('/api/inventory/dispatch', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
                body: JSON.stringify({ orderId: dispatchingId, approvedItems: modalItems }),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error);

            setMessage({ type: 'success', text: 'Đã duyệt xuất kho — đơn hàng đang vận chuyển!' });
            setDispatchResult({
                orderId: dispatchingId,
                qrCodeToken: data.qrCodeToken,
                order: { ...currentOrder, storeName: resolvedStoreName },
                items: modalItems,
            });
            setDispatchingId(null);
            fetchOrders();
        } catch (err: any) {
            setMessage({ type: 'error', text: err.message || 'Có lỗi xảy ra' });
        }
    };

    // Warehouse approve → PACKING
    const handleWarehouseApprove = async (orderId: string) => {
        try {
            const token = await getToken();
            const res = await fetch('/api/inventory/orders', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
                body: JSON.stringify({ orderId, action: 'warehouse_approve' }),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error);
            setMessage({ type: 'success', text: 'Đã chấp nhận — bắt đầu đóng gói!' });
            fetchOrders();
        } catch (err: any) {
            setMessage({ type: 'error', text: err.message || 'Có lỗi xảy ra' });
        }
    };

    const openRejectModal = (orderId: string) => {
        setRejectingId(orderId);
        setRejectReason('');
    };

    const handleReject = async () => {
        if (!rejectingId || !rejectReason.trim()) return;
        setIsRejecting(true);
        try {
            const token = await getToken();
            const res = await fetch('/api/inventory/orders', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
                body: JSON.stringify({ orderId: rejectingId, action: 'warehouse_reject', reason: rejectReason }),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error);
            setMessage({ type: 'success', text: 'Đã từ chối đơn hàng.' });
            setRejectingId(null);
            fetchOrders();
        } catch (err: any) {
            setMessage({ type: 'error', text: err.message || 'Có lỗi xảy ra' });
        } finally {
            setIsRejecting(false);
        }
    };

    const handlePrint = () => {
        if (!printRef.current) return;
        const printContent = printRef.current.innerHTML;
        const win = window.open('', '_blank', 'width=800,height=600');
        if (!win) return;
        win.document.write(`<!DOCTYPE html><html><head><title>Phiếu xuất kho</title>
            <style>
                body { font-family: Arial, sans-serif; padding: 24px; color: #1e293b; }
                h1 { font-size: 20px; margin: 0 0 4px; }
                h2 { font-size: 16px; margin: 16px 0 8px; color: #334155; }
                .meta { font-size: 13px; color: #64748b; margin-bottom: 16px; }
                table { width: 100%; border-collapse: collapse; margin: 12px 0; }
                th, td { border: 1px solid #cbd5e1; padding: 8px 12px; text-align: left; font-size: 13px; }
                th { background: #f1f5f9; font-weight: 600; }
                .qr-section { margin-top: 20px; text-align: center; }
                .qr-section p { font-size: 12px; color: #64748b; margin-top: 8px; }
                .footer { margin-top: 32px; font-size: 11px; color: #94a3b8; text-align: center; }
                .code { font-weight: bold; color: #2563eb; }
            </style>
        </head><body>${printContent}</body></html>`);
        win.document.close();
        win.focus();
        setTimeout(() => { win.print(); win.close(); }, 300);
    };

    const qrUrl = dispatchResult
        ? `${typeof window !== 'undefined' ? window.location.origin : ''}/manager/inventory/receive/${dispatchResult.orderId}?token=${dispatchResult.qrCodeToken}`
        : '';

    return (
        <div className="space-y-6 mx-auto">
            <DashboardHeader
                showSelect={false}
                titleChildren={
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 w-full">
                        <div>
                            <h1 className="text-2xl font-bold bg-gradient-to-r from-success-600 to-teal-600 bg-clip-text text-transparent flex items-center gap-2">
                                <Truck className="w-7 h-7 text-success-600" />
                                Duyệt xuất kho
                            </h1>
                            <p className="text-surface-500 mt-1 text-sm">Xem và duyệt các đơn đặt hàng từ cửa hàng. Hàng sẽ được trừ khỏi kho tổng và tạo mã QR để cửa hàng xác nhận nhận hàng.</p>
                        </div>
                    </div>
                }
            />

            {/* Store filter */}
            <div className="bg-white rounded-xl border border-surface-200 shadow-sm p-4 flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
                <div className="flex items-center gap-3 flex-1">
                    <Package className="w-5 h-5 text-accent-500 shrink-0" />
                    <select value={selectedStoreId} onChange={e => setSelectedStoreId(e.target.value)}
                        className="flex-1 bg-surface-50 border border-surface-200 rounded-lg p-2 text-sm outline-none focus:ring-2 focus:ring-accent-300">
                        <option value="">Tất cả cửa hàng</option>
                        {stores.map(s => <option key={s.id} value={s.id}>{(s as any).type === 'OFFICE' ? '🏢' : (s as any).type === 'CENTRAL' ? '🏭' : '🏪'} {s.name}</option>)}
                    </select>
                </div>
                <div className="flex items-center gap-3 flex-1">
                    <Warehouse className="w-5 h-5 text-accent-500 shrink-0" />
                    <select value={selectedWarehouseId} onChange={e => setSelectedWarehouseId(e.target.value)}
                        className="flex-1 bg-surface-50 border border-surface-200 rounded-lg p-2 text-sm outline-none focus:ring-2 focus:ring-accent-300">
                        <option value="">📊 Tất cả các kho</option>
                        {warehouses.map(w => <option key={w.id} value={w.id}>🏭 {w.name}</option>)}
                    </select>
                </div>
            </div>

            {message.text && (
                <div className={`p-3 rounded-xl flex items-center gap-2 border text-sm font-medium ${message.type === 'error' ? 'bg-danger-50 text-danger-700 border-danger-200' : 'bg-success-50 text-success-700 border-success-200'}`}>
                    {message.type === 'error' ? <AlertCircle className="w-4 h-4" /> : <CheckCircle2 className="w-4 h-4" />}
                    {message.text}
                </div>
            )}

            {/* Dispatch Result with QR Code */}
            {dispatchResult && (
                <div className="bg-white rounded-2xl border-2 border-success-200 shadow-sm overflow-hidden">
                    <div className="bg-success-50 p-4 border-b border-success-100 flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            <QrCode className="w-5 h-5 text-success-600" />
                            <h2 className="text-lg font-bold text-success-800">Phiếu xuất kho & Mã QR nhận hàng</h2>
                        </div>
                        <div className="flex items-center gap-2">
                            <button onClick={handlePrint}
                                className="flex items-center gap-1.5 bg-success-600 hover:bg-success-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors">
                                <Printer className="w-4 h-4" /> In phiếu
                            </button>
                            <button onClick={() => setDispatchResult(null)}
                                className="text-surface-400 hover:text-surface-700 p-1.5">
                                <X className="w-5 h-5" />
                            </button>
                        </div>
                    </div>

                    {/* Printable content */}
                    <div ref={printRef} className="p-6">
                        <h1 style={{ fontSize: '20px', fontWeight: 'bold', margin: '0 0 4px' }}>PHIẾU XUẤT KHO</h1>
                        <div style={{ fontSize: '13px', color: '#64748b', marginBottom: '16px' }}>
                            <p>Đơn hàng: <strong>{dispatchResult.orderId}</strong></p>
                            <p>Cửa hàng: <strong>{dispatchResult.order.storeName || dispatchResult.order.storeId}</strong></p>
                            {dispatchResult.order.warehouseName && <p>Kho xuất: <strong>{dispatchResult.order.warehouseName}</strong></p>}
                            <p>Người đặt: {dispatchResult.order.createdByName}</p>
                            <p>Ngày xuất: {new Date().toLocaleString('vi-VN')}</p>
                        </div>
                        <table style={{ width: '100%', borderCollapse: 'collapse', margin: '12px 0' }}>
                            <thead>
                                <tr>
                                    <th style={{ border: '1px solid #cbd5e1', padding: '8px 12px', textAlign: 'left', fontSize: '13px', background: '#f1f5f9', fontWeight: 600 }}>Sản phẩm</th>
                                    <th style={{ border: '1px solid #cbd5e1', padding: '8px 12px', textAlign: 'left', fontSize: '13px', background: '#f1f5f9', fontWeight: 600 }}>ĐVT</th>
                                    <th style={{ border: '1px solid #cbd5e1', padding: '8px 12px', textAlign: 'right', fontSize: '13px', background: '#f1f5f9', fontWeight: 600 }}>Yêu cầu</th>
                                    <th style={{ border: '1px solid #cbd5e1', padding: '8px 12px', textAlign: 'right', fontSize: '13px', background: '#f1f5f9', fontWeight: 600 }}>Thực xuất</th>
                                </tr>
                            </thead>
                            <tbody>
                                {dispatchResult.items.map(item => (
                                    <tr key={item.productId}>
                                        <td style={{ border: '1px solid #cbd5e1', padding: '8px 12px', fontSize: '13px' }}>
                                            <span style={{ fontWeight: 'bold', color: '#2563eb', fontFamily: 'monospace' }}>{item.productCode || '—'}</span>
                                            <span style={{ color: '#64748b', marginLeft: '8px' }}>{item.productName}</span>
                                        </td>
                                        <td style={{ border: '1px solid #cbd5e1', padding: '8px 12px', fontSize: '13px' }}>{item.unit}</td>
                                        <td style={{ border: '1px solid #cbd5e1', padding: '8px 12px', fontSize: '13px', textAlign: 'right' }}>{item.requestedQty}</td>
                                        <td style={{ border: '1px solid #cbd5e1', padding: '8px 12px', fontSize: '13px', textAlign: 'right', fontWeight: 'bold' }}>{item.approvedQty}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                        <div style={{ marginTop: '20px', textAlign: 'center' }}>
                            <QRCodeSVG value={qrUrl} size={200} level="H" />
                            <p style={{ fontSize: '12px', color: '#64748b', marginTop: '8px' }}>Quét mã QR để xác nhận nhận hàng tại cửa hàng</p>
                            <p style={{ fontSize: '10px', color: '#94a3b8', marginTop: '4px', wordBreak: 'break-all' }}>{qrUrl}</p>
                        </div>
                        <p style={{ marginTop: '32px', fontSize: '11px', color: '#94a3b8', textAlign: 'center' }}>
                            Phiếu xuất kho — In bởi hệ thống quản lý kho
                        </p>
                    </div>
                </div>
            )}

            {/* Orders Table */}
            <div className="bg-white rounded-2xl border border-surface-200 shadow-sm overflow-hidden">
                {loading ? (
                    <div className="flex justify-center py-12"><div className="w-6 h-6 border-4 border-surface-300 border-t-surface-700 rounded-full animate-spin" /></div>
                ) : orders.length === 0 ? (
                    <div className="text-center py-12 space-y-2">
                        <Truck className="w-8 h-8 text-surface-300 mx-auto" />
                        <p className="text-sm text-surface-400">Không có đơn hàng nào đang chờ duyệt</p>
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="text-left text-xs text-surface-500 uppercase bg-surface-50 border-b">
                                    <th className="px-6 py-3">Cửa hàng</th>
                                    <th className="px-6 py-3">Người đặt</th>
                                    <th className="px-6 py-3">Tài liệu</th>
                                    <th className="px-6 py-3">Sản phẩm</th>
                                    <th className="px-6 py-3">Ngày đặt</th>
                                    <th className="px-6 py-3 text-right">Hành động</th>
                                </tr>
                            </thead>
                            <tbody>
                                {orders.map(order => (
                                    <tr key={order.id} className="border-b border-surface-100 hover:bg-surface-50/50">
                                        <td className="px-6 py-3">
                                            <p className="font-medium text-surface-700">{stores.find(s => s.id === order.storeId)?.name || order.storeId}</p>
                                            {order.status === 'PACKING' ? (
                                                <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-accent-100 text-accent-700 border border-accent-200 mt-0.5">
                                                    <PackageCheck className="w-3 h-3" /> Đang đóng gói
                                                </span>
                                            ) : (
                                                <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-sky-100 text-sky-700 border border-sky-200 mt-0.5">
                                                    ✓ VP: {order.officeApprovedByName || 'đã duyệt'}
                                                </span>
                                            )}
                                            {order.warehouseName && (
                                                <p className="text-[10px] text-accent-600 font-medium mt-1 flex items-center gap-1">
                                                    <Warehouse className="w-3 h-3" /> {order.warehouseName}
                                                </p>
                                            )}
                                        </td>
                                        <td className="px-6 py-3">
                                            <p className="text-surface-600">{order.createdByName}</p>
                                        </td>
                                        <td className="px-6 py-3">
                                            <div className="flex flex-col gap-1">
                                                {order.attachmentUrl && (
                                                    <a href={order.attachmentUrl} target="_blank" rel="noopener noreferrer"
                                                        className="inline-flex items-center gap-1 text-[10px] font-bold text-accent-600 hover:text-accent-800">
                                                        <FileText className="w-3 h-3" /> File đề xuất
                                                        <ExternalLink className="w-2.5 h-2.5" />
                                                    </a>
                                                )}
                                                {order.officeExportSlipUrl && (
                                                    <a href={order.officeExportSlipUrl} target="_blank" rel="noopener noreferrer"
                                                        className="inline-flex items-center gap-1 text-[10px] font-bold text-success-600 hover:text-success-800">
                                                        <FileText className="w-3 h-3" /> Phiếu xuất kho
                                                        <ExternalLink className="w-2.5 h-2.5" />
                                                    </a>
                                                )}
                                                {!order.attachmentUrl && !order.officeExportSlipUrl && (
                                                    <span className="text-[10px] text-surface-300 italic">Không có file</span>
                                                )}
                                            </div>
                                        </td>
                                        <td className="px-6 py-3 text-surface-600">
                                            <div className="space-y-0.5">
                                                {order.items.map((item, i) => (
                                                    <div key={i} className="text-xs flex items-center gap-1.5">
                                                        <span className="font-mono font-bold text-surface-800 bg-surface-100 px-1.5 py-0.5 rounded text-[11px] shrink-0">
                                                            {item.productCode || '—'}
                                                        </span>
                                                        <span className="text-surface-400">×{item.requestedQty} {item.unit}</span>
                                                    </div>
                                                ))}
                                            </div>
                                        </td>
                                        <td className="px-6 py-3 text-surface-500 whitespace-nowrap">{new Date(order.timestamp).toLocaleString('vi-VN')}</td>
                                        <td className="px-6 py-3 text-right">
                                            <div className="flex items-center gap-2 justify-end">
                                                <button onClick={() => openRejectModal(order.id)}
                                                    className="bg-danger-50 hover:bg-danger-100 text-danger-600 border border-danger-200 px-3 py-1.5 rounded-lg text-xs font-bold transition-colors flex items-center gap-1">
                                                    <XCircle className="w-3.5 h-3.5" /> Từ chối
                                                </button>
                                                {order.status === 'PACKING' ? (
                                                    <button onClick={() => openDispatchModal(order)}
                                                        className="bg-accent-600 hover:bg-accent-700 text-white px-4 py-1.5 rounded-lg text-xs font-bold transition-colors flex items-center gap-1">
                                                        <Truck className="w-3.5 h-3.5" /> Xác nhận xuất kho
                                                    </button>
                                                ) : (
                                                    <button onClick={() => handleWarehouseApprove(order.id)}
                                                        className="bg-success-600 hover:bg-success-700 text-white px-4 py-1.5 rounded-lg text-xs font-bold transition-colors flex items-center gap-1">
                                                        <PackageCheck className="w-3.5 h-3.5" /> Chấp nhận đóng gói
                                                    </button>
                                                )}
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            {/* Reject Modal */}
            {rejectingId && (
                <Portal>
                    <div className="fixed inset-0 z-[110] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
                        <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
                            <div className="p-6 border-b border-surface-100 flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                    <XCircle className="w-5 h-5 text-danger-500" />
                                    <h2 className="text-lg font-bold text-surface-800">Từ chối đơn hàng</h2>
                                </div>
                                <button onClick={() => setRejectingId(null)} className="text-surface-400 hover:text-surface-700 p-1">
                                    <X className="w-5 h-5" />
                                </button>
                            </div>
                            <div className="p-6 space-y-4">
                                <p className="text-sm text-surface-600">Vui lòng nhập lý do từ chối để cửa hàng biết và đặt lại đơn phù hợp.</p>
                                <div>
                                    <label className="text-xs font-bold text-surface-600 block mb-1">
                                        Lý do từ chối <span className="text-danger-500">*</span>
                                    </label>
                                    <textarea
                                        value={rejectReason}
                                        onChange={e => setRejectReason(e.target.value)}
                                        rows={3}
                                        placeholder="VD: Hết hàng, đặt sai số lượng, mã sản phẩm không tồn tại..."
                                        className="w-full bg-surface-50 border border-surface-200 rounded-xl p-3 text-sm outline-none focus:ring-2 focus:ring-danger-300 resize-none"
                                    />
                                </div>
                            </div>
                            <div className="p-6 border-t border-surface-100 flex gap-3">
                                <button
                                    onClick={() => setRejectingId(null)}
                                    className="flex-1 bg-surface-100 hover:bg-surface-200 text-surface-700 py-2.5 rounded-xl font-medium text-sm transition-colors">
                                    Huỷ
                                </button>
                                <button
                                    onClick={handleReject}
                                    disabled={isRejecting || !rejectReason.trim()}
                                    className="flex-1 bg-danger-600 hover:bg-danger-700 disabled:opacity-40 text-white py-2.5 rounded-xl font-bold text-sm flex items-center justify-center gap-2 transition-all">
                                    {isRejecting
                                        ? <><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> Đang xử lý...</>
                                        : <><XCircle className="w-4 h-4" /> Từ chối đơn</>}
                                </button>
                            </div>
                        </div>
                    </div>
                </Portal>
            )}

            {/* Dispatch Modal */}
            {dispatchingId && (
                <Portal>
                    <div className="fixed inset-0 z-[110] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
                        <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[80vh] overflow-y-auto">
                            <div className="p-6 border-b border-surface-100 flex items-center justify-between">
                                <h2 className="text-lg font-bold text-surface-800">Duyệt và điều chỉnh số lượng thực xuất</h2>
                                <button onClick={() => setDispatchingId(null)} className="text-surface-400 hover:text-surface-700 p-1">
                                    <X className="w-5 h-5" />
                                </button>
                            </div>
                            <div className="p-6 space-y-4">
                                {modalItems.map((item, idx) => (
                                    <div key={item.productId} className="flex items-center gap-4 p-3 bg-surface-50 rounded-xl border border-surface-100">
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-2 flex-wrap">
                                                <span className="font-mono font-bold text-surface-800 bg-surface-100 px-1.5 py-0.5 rounded text-xs">
                                                    {item.productCode || '—'}
                                                </span>
                                                <span className="text-surface-500 text-xs truncate">{item.productName}</span>
                                            </div>
                                            <p className="text-xs text-surface-400 mt-0.5">Yêu cầu: {item.requestedQty} {item.unit}</p>
                                        </div>
                                        <div className="flex flex-col items-center">
                                            <span className="text-[10px] text-surface-400 mb-1">Thực xuất</span>
                                            <input type="number" min={0} value={item.approvedQty}
                                                onChange={e => {
                                                    const updated = [...modalItems];
                                                    updated[idx] = { ...updated[idx], approvedQty: Number(e.target.value) || 0 };
                                                    setModalItems(updated);
                                                }}
                                                className="w-20 bg-white border border-surface-200 rounded-lg p-2 text-sm text-center font-bold outline-none focus:ring-2 focus:ring-success-300" />
                                        </div>
                                    </div>
                                ))}
                            </div>
                            <div className="p-6 border-t border-surface-100">
                                <button onClick={handleDispatch}
                                    className="w-full bg-gradient-to-r from-success-600 to-teal-600 hover:from-success-700 hover:to-teal-700 text-white py-3 rounded-xl font-bold text-sm flex items-center justify-center gap-2 transition-all shadow-md">
                                    <Truck className="w-4 h-4" /> Xác nhận xuất kho & Tạo mã QR
                                </button>
                            </div>
                        </div>
                    </div>
                </Portal>
            )}
        </div>
    );
}
