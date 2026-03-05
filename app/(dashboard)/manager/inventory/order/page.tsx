'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { ShoppingCart, Plus, Trash2, Send, CheckCircle2, AlertCircle, Package } from 'lucide-react';
import type { ProductDoc, PurchaseOrderDoc } from '@/types/inventory';
import type { StoreDoc } from '@/types';

interface OrderItem {
    productId: string;
    productName: string;
    unit: string;
    requestedQty: number;
}

export default function StoreOrderPage() {
    const { user, userDoc } = useAuth();
    const [products, setProducts] = useState<ProductDoc[]>([]);
    const [stores, setStores] = useState<StoreDoc[]>([]);
    const [orders, setOrders] = useState<PurchaseOrderDoc[]>([]);
    const [items, setItems] = useState<OrderItem[]>([]);
    const [selectedProduct, setSelectedProduct] = useState('');
    const [qty, setQty] = useState<number>(1);
    const [note, setNote] = useState('');
    const [selectedStoreId, setSelectedStoreId] = useState('');
    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);
    const [message, setMessage] = useState({ type: '', text: '' });

    const getToken = useCallback(() => user?.getIdToken(), [user]);

    const isAdmin = userDoc?.role === 'admin';
    const effectiveStoreId = isAdmin ? selectedStoreId : userDoc?.storeId || '';

    // Fetch products
    useEffect(() => {
        if (!user) return;
        (async () => {
            try {
                const token = await getToken();
                const res = await fetch('/api/inventory/products', { headers: { Authorization: `Bearer ${token}` } });
                const data = await res.json();
                setProducts(Array.isArray(data) ? data : []);
            } catch { /* silent */ }
        })();
    }, [user, getToken]);

    // Fetch stores (admin)
    useEffect(() => {
        if (!user || !isAdmin) return;
        (async () => {
            try {
                const token = await getToken();
                const res = await fetch('/api/stores', { headers: { Authorization: `Bearer ${token}` } });
                const data = await res.json();
                setStores(Array.isArray(data) ? data : []);
            } catch { /* silent */ }
        })();
    }, [user, isAdmin, getToken]);

    // Fetch recent orders
    useEffect(() => {
        if (!user) return;
        setLoading(true);
        (async () => {
            try {
                const token = await getToken();
                const url = effectiveStoreId
                    ? `/api/inventory/orders?storeId=${effectiveStoreId}`
                    : '/api/inventory/orders';
                const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
                const data = await res.json();
                setOrders(Array.isArray(data) ? data : []);
            } catch { /* silent */ } finally { setLoading(false); }
        })();
    }, [user, effectiveStoreId, getToken]);

    const addItem = () => {
        if (!selectedProduct || qty <= 0) return;
        const prod = products.find(p => p.id === selectedProduct);
        if (!prod) return;
        if (items.find(i => i.productId === selectedProduct)) {
            setMessage({ type: 'error', text: 'Sản phẩm đã có trong danh sách' });
            return;
        }
        setItems([...items, { productId: prod.id, productName: prod.name, unit: prod.unit, requestedQty: qty }]);
        setSelectedProduct('');
        setQty(1);
    };

    const removeItem = (productId: string) => {
        setItems(items.filter(i => i.productId !== productId));
    };

    const handleSubmit = async () => {
        if (!items.length || !effectiveStoreId) {
            setMessage({ type: 'error', text: 'Vui lòng chọn cửa hàng và thêm sản phẩm' });
            return;
        }
        setSubmitting(true);
        setMessage({ type: '', text: '' });
        try {
            const token = await getToken();
            const storeName = isAdmin
                ? stores.find(s => s.id === effectiveStoreId)?.name || ''
                : '';
            const res = await fetch('/api/inventory/orders', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
                body: JSON.stringify({ storeId: effectiveStoreId, storeName, items, note }),
            });
            if (!res.ok) throw new Error((await res.json()).error);
            setMessage({ type: 'success', text: 'Đã tạo đơn đặt hàng thành công!' });
            setItems([]);
            setNote('');
            // Refresh orders
            const ordersRes = await fetch(`/api/inventory/orders?storeId=${effectiveStoreId}`, {
                headers: { Authorization: `Bearer ${token}` },
            });
            const ordersData = await ordersRes.json();
            setOrders(Array.isArray(ordersData) ? ordersData : []);
        } catch (err: any) {
            setMessage({ type: 'error', text: err.message || 'Có lỗi xảy ra' });
        } finally { setSubmitting(false); }
    };

    const STATUS_BADGE: Record<string, string> = {
        PENDING: 'bg-amber-100 text-amber-700 border-amber-200',
        DISPATCHED: 'bg-emerald-100 text-emerald-700 border-emerald-200',
        REJECTED: 'bg-red-100 text-red-700 border-red-200',
    };
    const STATUS_LABEL: Record<string, string> = {
        PENDING: 'Chờ duyệt', DISPATCHED: 'Đã xuất kho', REJECTED: 'Từ chối',
    };

    return (
        <div className="space-y-6 mx-auto">
            <div>
                <h1 className="text-2xl font-bold bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent flex items-center gap-2">
                    <ShoppingCart className="w-7 h-7 text-blue-600" />
                    Đặt hàng từ kho tổng
                </h1>
                <p className="text-slate-500 mt-1">Tạo đơn đặt hàng sản phẩm từ kho trung tâm về cửa hàng.</p>
            </div>

            {/* Admin store selector */}
            {isAdmin && (
                <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4 flex items-center gap-3">
                    <Package className="w-5 h-5 text-indigo-500" />
                    <select value={selectedStoreId} onChange={e => setSelectedStoreId(e.target.value)}
                        className="flex-1 bg-slate-50 border border-slate-200 rounded-lg p-2 text-sm outline-none focus:ring-2 focus:ring-indigo-300">
                        <option value="">-- Chọn cửa hàng --</option>
                        {stores.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                    </select>
                </div>
            )}

            {message.text && (
                <div className={`p-3 rounded-xl flex items-center gap-2 border text-sm font-medium ${message.type === 'error' ? 'bg-red-50 text-red-700 border-red-200' : 'bg-emerald-50 text-emerald-700 border-emerald-200'}`}>
                    {message.type === 'error' ? <AlertCircle className="w-4 h-4" /> : <CheckCircle2 className="w-4 h-4" />}
                    {message.text}
                </div>
            )}

            {/* Order Form */}
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 space-y-4">
                <h2 className="font-bold text-slate-800">Thêm sản phẩm vào đơn</h2>
                <div className="flex flex-col sm:flex-row gap-3">
                    <select value={selectedProduct} onChange={e => setSelectedProduct(e.target.value)}
                        className="flex-1 bg-slate-50 border border-slate-200 rounded-lg p-2.5 text-sm outline-none focus:ring-2 focus:ring-blue-300">
                        <option value="">-- Chọn sản phẩm --</option>
                        {products.map(p => <option key={p.id} value={p.id}>{p.name} ({p.unit})</option>)}
                    </select>
                    <input type="number" min={1} value={qty} onChange={e => setQty(Number(e.target.value))}
                        className="w-24 bg-slate-50 border border-slate-200 rounded-lg p-2.5 text-sm text-center outline-none focus:ring-2 focus:ring-blue-300"
                        placeholder="SL" />
                    <button onClick={addItem}
                        className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2.5 rounded-lg text-sm font-medium flex items-center gap-1.5 transition-colors">
                        <Plus className="w-4 h-4" /> Thêm
                    </button>
                </div>

                {items.length > 0 && (
                    <div className="space-y-2">
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm">
                                <thead>
                                    <tr className="text-left text-xs text-slate-500 uppercase border-b">
                                        <th className="py-2 pr-4">Sản phẩm</th>
                                        <th className="py-2 pr-4">ĐVT</th>
                                        <th className="py-2 pr-4 text-right">Số lượng</th>
                                        <th className="py-2 w-10"></th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {items.map(item => (
                                        <tr key={item.productId} className="border-b border-slate-100">
                                            <td className="py-2.5 pr-4 font-medium text-slate-700">{item.productName}</td>
                                            <td className="py-2.5 pr-4 text-slate-500">{item.unit}</td>
                                            <td className="py-2.5 pr-4 text-right font-bold">{item.requestedQty}</td>
                                            <td className="py-2.5">
                                                <button onClick={() => removeItem(item.productId)}
                                                    className="text-slate-400 hover:text-red-500 p-1 rounded transition-colors">
                                                    <Trash2 className="w-4 h-4" />
                                                </button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>

                        <textarea value={note} onChange={e => setNote(e.target.value)} rows={2}
                            placeholder="Ghi chú (tùy chọn)..."
                            className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2.5 text-sm outline-none focus:ring-2 focus:ring-blue-300 resize-none" />

                        <button onClick={handleSubmit} disabled={submitting}
                            className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white py-3 rounded-xl font-bold text-sm flex items-center justify-center gap-2 transition-all disabled:opacity-50 shadow-md shadow-blue-500/20">
                            {submitting ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> : <Send className="w-4 h-4" />}
                            Gửi đơn đặt hàng
                        </button>
                    </div>
                )}
            </div>

            {/* Recent Orders */}
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                <div className="p-6 border-b border-slate-100">
                    <h2 className="font-bold text-slate-800">Đơn đặt hàng gần đây</h2>
                </div>
                {loading ? (
                    <div className="flex justify-center py-12"><div className="w-6 h-6 border-4 border-slate-300 border-t-slate-700 rounded-full animate-spin" /></div>
                ) : orders.length === 0 ? (
                    <p className="text-sm text-slate-400 text-center py-12">Chưa có đơn đặt hàng nào</p>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="text-left text-xs text-slate-500 uppercase bg-slate-50 border-b">
                                    <th className="px-6 py-3">Thời gian</th>
                                    <th className="px-6 py-3">Người tạo</th>
                                    <th className="px-6 py-3">Sản phẩm</th>
                                    <th className="px-6 py-3">Trạng thái</th>
                                </tr>
                            </thead>
                            <tbody>
                                {orders.map(order => (
                                    <tr key={order.id} className="border-b border-slate-100 hover:bg-slate-50/50">
                                        <td className="px-6 py-3 text-slate-600 whitespace-nowrap">{new Date(order.timestamp).toLocaleString('vi-VN')}</td>
                                        <td className="px-6 py-3 text-slate-700 font-medium">{order.createdByName}</td>
                                        <td className="px-6 py-3 text-slate-600">
                                            <div className="space-y-0.5">
                                                {order.items.map((item, i) => (
                                                    <div key={i} className="text-xs">
                                                        <span className="text-slate-700">{item.productName}</span>
                                                        <span className="text-slate-400 ml-1">×{item.requestedQty} {item.unit}</span>
                                                        {item.approvedQty !== undefined && item.approvedQty !== item.requestedQty && (
                                                            <span className="text-emerald-600 ml-1">(duyệt: {item.approvedQty})</span>
                                                        )}
                                                    </div>
                                                ))}
                                            </div>
                                        </td>
                                        <td className="px-6 py-3">
                                            <span className={`text-xs font-bold px-2 py-1 rounded border ${STATUS_BADGE[order.status] || ''}`}>
                                                {STATUS_LABEL[order.status] || order.status}
                                            </span>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>
        </div>
    );
}
