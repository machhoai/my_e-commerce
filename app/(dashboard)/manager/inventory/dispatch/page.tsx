'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Truck, CheckCircle2, AlertCircle, X, Package } from 'lucide-react';
import type { PurchaseOrderDoc, PurchaseOrderItem } from '@/types/inventory';
import type { StoreDoc } from '@/types';

export default function DispatchPage() {
    const { user, userDoc } = useAuth();
    const [orders, setOrders] = useState<PurchaseOrderDoc[]>([]);
    const [stores, setStores] = useState<StoreDoc[]>([]);
    const [selectedStoreId, setSelectedStoreId] = useState('');
    const [loading, setLoading] = useState(true);
    const [dispatchingId, setDispatchingId] = useState<string | null>(null);
    const [modalItems, setModalItems] = useState<(PurchaseOrderItem & { approvedQty: number })[]>([]);
    const [message, setMessage] = useState({ type: '', text: '' });

    const getToken = useCallback(() => user?.getIdToken(), [user]);

    // Guard: admin only
    if (userDoc && userDoc.role !== 'admin') {
        return (
            <div className="flex flex-col items-center justify-center h-64 text-red-500">
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
        setMessage({ type: '', text: '' });
        try {
            const token = await getToken();
            const res = await fetch('/api/inventory/dispatch', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
                body: JSON.stringify({ orderId: dispatchingId, approvedItems: modalItems }),
            });
            if (!res.ok) throw new Error((await res.json()).error);
            setMessage({ type: 'success', text: 'Đã duyệt và xuất kho thành công!' });
            setDispatchingId(null);
            fetchOrders();
        } catch (err: any) {
            setMessage({ type: 'error', text: err.message || 'Có lỗi xảy ra' });
        }
    };

    return (
        <div className="space-y-6 mx-auto">
            <div>
                <h1 className="text-2xl font-bold bg-gradient-to-r from-emerald-600 to-teal-600 bg-clip-text text-transparent flex items-center gap-2">
                    <Truck className="w-7 h-7 text-emerald-600" />
                    Duyệt xuất kho
                </h1>
                <p className="text-slate-500 mt-1">Xem và duyệt các đơn đặt hàng từ cửa hàng.</p>
            </div>

            {/* Store filter */}
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4 flex items-center gap-3">
                <Package className="w-5 h-5 text-indigo-500" />
                <select value={selectedStoreId} onChange={e => setSelectedStoreId(e.target.value)}
                    className="flex-1 bg-slate-50 border border-slate-200 rounded-lg p-2 text-sm outline-none focus:ring-2 focus:ring-indigo-300">
                    <option value="">Tất cả cửa hàng</option>
                    {stores.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
            </div>

            {message.text && (
                <div className={`p-3 rounded-xl flex items-center gap-2 border text-sm font-medium ${message.type === 'error' ? 'bg-red-50 text-red-700 border-red-200' : 'bg-emerald-50 text-emerald-700 border-emerald-200'}`}>
                    {message.type === 'error' ? <AlertCircle className="w-4 h-4" /> : <CheckCircle2 className="w-4 h-4" />}
                    {message.text}
                </div>
            )}

            {/* Orders Table */}
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                {loading ? (
                    <div className="flex justify-center py-12"><div className="w-6 h-6 border-4 border-slate-300 border-t-slate-700 rounded-full animate-spin" /></div>
                ) : orders.length === 0 ? (
                    <p className="text-sm text-slate-400 text-center py-12">Không có đơn hàng nào đang chờ duyệt</p>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="text-left text-xs text-slate-500 uppercase bg-slate-50 border-b">
                                    <th className="px-6 py-3">Cửa hàng</th>
                                    <th className="px-6 py-3">Người đặt</th>
                                    <th className="px-6 py-3">Sản phẩm</th>
                                    <th className="px-6 py-3">Ngày đặt</th>
                                    <th className="px-6 py-3 text-right">Hành động</th>
                                </tr>
                            </thead>
                            <tbody>
                                {orders.map(order => (
                                    <tr key={order.id} className="border-b border-slate-100 hover:bg-slate-50/50">
                                        <td className="px-6 py-3 font-medium text-slate-700">{order.storeName || order.storeId}</td>
                                        <td className="px-6 py-3 text-slate-600">{order.createdByName}</td>
                                        <td className="px-6 py-3 text-slate-600">{order.items.length} mục</td>
                                        <td className="px-6 py-3 text-slate-500 whitespace-nowrap">{new Date(order.timestamp).toLocaleString('vi-VN')}</td>
                                        <td className="px-6 py-3 text-right">
                                            <button onClick={() => openDispatchModal(order)}
                                                className="bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-1.5 rounded-lg text-xs font-bold transition-colors">
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
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
                    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[80vh] overflow-y-auto">
                        <div className="p-6 border-b border-slate-100 flex items-center justify-between">
                            <h2 className="text-lg font-bold text-slate-800">Duyệt và điều chỉnh số lượng</h2>
                            <button onClick={() => setDispatchingId(null)} className="text-slate-400 hover:text-slate-700 p-1">
                                <X className="w-5 h-5" />
                            </button>
                        </div>
                        <div className="p-6 space-y-4">
                            {modalItems.map((item, idx) => (
                                <div key={item.productId} className="flex items-center gap-4 p-3 bg-slate-50 rounded-xl border border-slate-100">
                                    <div className="flex-1 min-w-0">
                                        <p className="font-semibold text-slate-700 text-sm truncate">{item.productName}</p>
                                        <p className="text-xs text-slate-400">Yêu cầu: {item.requestedQty} {item.unit}</p>
                                    </div>
                                    <input type="number" min={0} value={item.approvedQty}
                                        onChange={e => {
                                            const updated = [...modalItems];
                                            updated[idx] = { ...updated[idx], approvedQty: Number(e.target.value) || 0 };
                                            setModalItems(updated);
                                        }}
                                        className="w-20 bg-white border border-slate-200 rounded-lg p-2 text-sm text-center font-bold outline-none focus:ring-2 focus:ring-emerald-300" />
                                </div>
                            ))}
                        </div>
                        <div className="p-6 border-t border-slate-100">
                            <button onClick={handleDispatch}
                                className="w-full bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white py-3 rounded-xl font-bold text-sm flex items-center justify-center gap-2 transition-all shadow-md">
                                <Truck className="w-4 h-4" /> Xác nhận xuất kho
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
