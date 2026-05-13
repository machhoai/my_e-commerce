'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { showToast } from '@/lib/utils/toast';
import { Truck, CheckCircle2, X, Package, Printer, QrCode, AlertCircle } from 'lucide-react';
import Portal from '@/components/Portal';
import type { PurchaseOrderDoc, PurchaseOrderItem } from '@/types/inventory';
import type { StoreDoc } from '@/types';
import { QRCodeSVG } from 'qrcode.react';
import { DashboardHeader } from '@/components/inventory/overview/DashboardHeader';

interface DispatchResult {
    orderId: string;
    qrCodeToken: string;
    order: PurchaseOrderDoc;
    items: (PurchaseOrderItem & { approvedQty: number })[];
}

export default function DispatchPage() {
    const { user, userDoc, hasPermission } = useAuth();
    const [orders, setOrders] = useState<PurchaseOrderDoc[]>([]);
    const [stores, setStores] = useState<StoreDoc[]>([]);
    const [selectedStoreId, setSelectedStoreId] = useState('');
    const [loading, setLoading] = useState(true);
    const [dispatchingId, setDispatchingId] = useState<string | null>(null);
    const [modalItems, setModalItems] = useState<(PurchaseOrderItem & { approvedQty: number })[]>([]);

    const [dispatchResult, setDispatchResult] = useState<DispatchResult | null>(null);
    const printRef = useRef<HTMLDivElement>(null);

    const getToken = useCallback(() => user?.getIdToken(), [user]);

    // Guard: admin or custom role with page.admin.inventory.dispatch permission
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

    // Fetch PENDING orders
    const fetchOrders = useCallback(async () => {
        if (!user) return;
        setLoading(true);
        try {
            const token = await getToken();
            let url = '/api/inventory/orders?status=PENDING';
            if (selectedStoreId) url += `&storeId=${selectedStoreId}`;
            const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
            const data = await res.json();
            setOrders(Array.isArray(data) ? data : []);
        } catch { /* silent */ } finally { setLoading(false); }
    }, [user, selectedStoreId, getToken]);

    useEffect(() => { fetchOrders(); }, [fetchOrders]);

    const openDispatchModal = (order: PurchaseOrderDoc) => {
        setDispatchingId(order.id);
        setModalItems(order.items.map(i => ({ ...i, approvedQty: i.requestedQty })));
    };

    const handleDispatch = async () => {
        if (!dispatchingId) return;

        try {
            const token = await getToken();
            const currentOrder = orders.find(o => o.id === dispatchingId)!;
            const res = await fetch('/api/inventory/dispatch', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
                body: JSON.stringify({ orderId: dispatchingId, approvedItems: modalItems }),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error);

            showToast.success('Đã duyệt xuất kho', 'Đơn hàng đang vận chuyển!');
            setDispatchResult({
                orderId: dispatchingId,
                qrCodeToken: data.qrCodeToken,
                order: currentOrder,
                items: modalItems,
            });
            setDispatchingId(null);
            fetchOrders();
        } catch (err: unknown) {
            showToast.error('Lỗi xuất kho', err instanceof Error ? err.message : 'Có lỗi xảy ra');
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
                table { width: 100%; border-collapse: collapse; margin: 12px 0; }
                th, td { border: 1px solid #cbd5e1; padding: 8px 12px; text-align: left; font-size: 13px; }
                th { background: #f1f5f9; font-weight: 600; }
                .footer { margin-top: 32px; font-size: 11px; color: #94a3b8; text-align: center; }
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
            {/* Header */}
            <DashboardHeader
                warehouses={stores}
                selectedWarehouseId={selectedStoreId}
                onWarehouseChange={setSelectedStoreId}
                type="store"
                titleChildren={
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 w-full">
                        <div>
                            <h1 className="text-2xl font-bold bg-gradient-to-r from-success-600 to-teal-600 bg-clip-text text-transparent flex items-center gap-2">
                                <Truck className="w-7 h-7 text-success-600" />
                                Duyệt xuất kho
                            </h1>
                            <p className="text-surface-500 mt-1 text-sm">Xem và duyệt các đơn đặt hàng từ cửa hàng.</p>
                        </div>
                    </div>
                }
            />



            {/* Dispatch Result with QR */}
            {dispatchResult && (
                <div className="bg-white rounded-2xl border-2 border-success-200 shadow-sm overflow-hidden">
                    <div className="bg-success-50 p-4 border-b border-success-100 flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            <QrCode className="w-5 h-5 text-success-600" />
                            <h2 className="text-lg font-bold text-success-800">Phiếu xuất kho & Mã QR</h2>
                        </div>
                        <div className="flex items-center gap-2">
                            <button onClick={handlePrint}
                                className="flex items-center gap-1.5 bg-success-600 hover:bg-success-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors">
                                <Printer className="w-4 h-4" /> In phiếu
                            </button>
                            <button onClick={() => setDispatchResult(null)} className="text-surface-400 hover:text-surface-700 p-1.5">
                                <X className="w-5 h-5" />
                            </button>
                        </div>
                    </div>
                    <div ref={printRef} className="p-6">
                        <h1 style={{ fontSize: '20px', fontWeight: 'bold', margin: '0 0 4px' }}>PHIẾU XUẤT KHO</h1>
                        <div style={{ fontSize: '13px', color: '#64748b', marginBottom: '16px' }}>
                            <p>Đơn hàng: <strong>{dispatchResult.orderId}</strong></p>
                            <p>Cửa hàng: <strong>{dispatchResult.order.storeName || dispatchResult.order.storeId}</strong></p>
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
                                        <td style={{ border: '1px solid #cbd5e1', padding: '8px 12px', fontSize: '13px' }}>{item.productName}</td>
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
                    <p className="text-sm text-surface-400 text-center py-12">Không có đơn hàng nào đang chờ duyệt</p>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="text-left text-xs text-surface-500 uppercase bg-surface-50 border-b">
                                    <th className="px-6 py-3">Cửa hàng</th>
                                    <th className="px-6 py-3">Người đặt</th>
                                    <th className="px-6 py-3">Sản phẩm</th>
                                    <th className="px-6 py-3">Ngày đặt</th>
                                    <th className="px-6 py-3 text-right">Hành động</th>
                                </tr>
                            </thead>
                            <tbody>
                                {orders.map(order => (
                                    <tr key={order.id} className="border-b border-surface-100 hover:bg-surface-50/50">
                                        <td className="px-6 py-3 font-medium text-surface-700">{order.storeName || order.storeId}</td>
                                        <td className="px-6 py-3 text-surface-600">{order.createdByName}</td>
                                        <td className="px-6 py-3 text-surface-600">{order.items.length} mục</td>
                                        <td className="px-6 py-3 text-surface-500 whitespace-nowrap">{new Date(order.timestamp).toLocaleString('vi-VN')}</td>
                                        <td className="px-6 py-3 text-right">
                                            <button onClick={() => openDispatchModal(order)}
                                                className="bg-success-600 hover:bg-success-700 text-white px-4 py-1.5 rounded-lg text-xs font-bold transition-colors">
                                                Duyệt xuất kho
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

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
                                            <p className="font-semibold text-surface-700 text-sm truncate">{item.productName}</p>
                                            <p className="text-xs text-surface-400">Yêu cầu: {item.requestedQty} {item.unit}</p>
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
