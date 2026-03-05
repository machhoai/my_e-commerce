'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { ArrowRightLeft, CheckCircle2, AlertCircle, Package, Send } from 'lucide-react';
import type { ProductDoc, InventoryBalanceDoc } from '@/types/inventory';
import type { StoreDoc, CounterDoc } from '@/types';

export default function TransferPage() {
    const { user, userDoc } = useAuth();
    const [products, setProducts] = useState<ProductDoc[]>([]);
    const [counters, setCounters] = useState<CounterDoc[]>([]);
    const [balances, setBalances] = useState<InventoryBalanceDoc[]>([]);
    const [stores, setStores] = useState<StoreDoc[]>([]);

    const [selectedStoreId, setSelectedStoreId] = useState('');
    const [selectedCounter, setSelectedCounter] = useState('');
    const [selectedProduct, setSelectedProduct] = useState('');
    const [qty, setQty] = useState<number>(1);
    const [note, setNote] = useState('');

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

    // Fetch counters for the store
    useEffect(() => {
        if (!effectiveStoreId || !user) { setCounters([]); return; }
        (async () => {
            try {
                const token = await getToken();
                const res = await fetch(`/api/stores/${effectiveStoreId}/settings`, { headers: { Authorization: `Bearer ${token}` } });
                const data = await res.json();
                setCounters((data.counters || []).filter((c: CounterDoc) => c.isActive !== false));
            } catch { setCounters([]); }
        })();
    }, [user, effectiveStoreId, getToken]);

    // Fetch store balances
    useEffect(() => {
        if (!effectiveStoreId || !user) { setBalances([]); return; }
        (async () => {
            try {
                const token = await getToken();
                const res = await fetch(`/api/inventory/balances?locationType=STORE&locationId=${effectiveStoreId}`, {
                    headers: { Authorization: `Bearer ${token}` },
                });
                const data = await res.json();
                setBalances(Array.isArray(data) ? data : []);
            } catch { setBalances([]); }
        })();
    }, [user, effectiveStoreId, getToken]);

    const getStoreStock = (productId: string) => {
        return balances.find(b => b.productId === productId)?.currentStock ?? 0;
    };

    const handleTransfer = async () => {
        if (!selectedCounter || !selectedProduct || qty <= 0) {
            setMessage({ type: 'error', text: 'Vui lòng chọn quầy, sản phẩm và số lượng' });
            return;
        }

        const stock = getStoreStock(selectedProduct);
        if (qty > stock) {
            setMessage({ type: 'error', text: `Không đủ hàng. Tồn kho: ${stock}` });
            return;
        }

        setSubmitting(true);
        setMessage({ type: '', text: '' });
        try {
            const token = await getToken();
            const counter = counters.find(c => c.id === selectedCounter);
            const res = await fetch('/api/inventory/transfer', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
                body: JSON.stringify({
                    storeId: effectiveStoreId,
                    counterId: selectedCounter,
                    counterName: counter?.name || '',
                    productId: selectedProduct,
                    quantity: qty,
                    note,
                }),
            });
            if (!res.ok) throw new Error((await res.json()).error);
            setMessage({ type: 'success', text: 'Đã xuất hàng ra quầy thành công!' });
            setSelectedProduct('');
            setQty(1);
            setNote('');
            // Refresh balances
            const balRes = await fetch(`/api/inventory/balances?locationType=STORE&locationId=${effectiveStoreId}`, {
                headers: { Authorization: `Bearer ${token}` },
            });
            setBalances(await balRes.json());
        } catch (err: any) {
            setMessage({ type: 'error', text: err.message || 'Có lỗi xảy ra' });
        } finally { setSubmitting(false); }
    };

    // Products with stock info
    const productsWithStock = products.map(p => ({
        ...p,
        stock: getStoreStock(p.id),
    })).filter(p => p.stock > 0);

    return (
        <div className="space-y-6 mx-auto">
            <div>
                <h1 className="text-2xl font-bold bg-gradient-to-r from-violet-600 to-purple-600 bg-clip-text text-transparent flex items-center gap-2">
                    <ArrowRightLeft className="w-7 h-7 text-violet-600" />
                    Xuất hàng ra quầy
                </h1>
                <p className="text-slate-500 mt-1">Chuyển hàng từ kho cửa hàng đến quầy làm việc.</p>
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

            {/* Transfer Form */}
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 space-y-5">
                {/* Counter selector */}
                <div>
                    <label className="text-sm font-bold text-slate-700 block mb-2">Quầy đích</label>
                    <select value={selectedCounter} onChange={e => setSelectedCounter(e.target.value)}
                        className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2.5 text-sm outline-none focus:ring-2 focus:ring-violet-300">
                        <option value="">-- Chọn quầy --</option>
                        {counters.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                    </select>
                </div>

                {/* Product selector with stock */}
                <div>
                    <label className="text-sm font-bold text-slate-700 block mb-2">Sản phẩm (có tồn kho)</label>
                    <select value={selectedProduct} onChange={e => setSelectedProduct(e.target.value)}
                        className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2.5 text-sm outline-none focus:ring-2 focus:ring-violet-300">
                        <option value="">-- Chọn sản phẩm --</option>
                        {productsWithStock.map(p => (
                            <option key={p.id} value={p.id}>{p.name} — Tồn: {p.stock} {p.unit}</option>
                        ))}
                    </select>
                    {selectedProduct && (
                        <p className="text-xs text-slate-500 mt-1">
                            Tồn kho hiện tại: <span className="font-bold text-violet-600">{getStoreStock(selectedProduct)}</span>
                        </p>
                    )}
                </div>

                {/* Quantity */}
                <div>
                    <label className="text-sm font-bold text-slate-700 block mb-2">Số lượng</label>
                    <input type="number" min={1} max={selectedProduct ? getStoreStock(selectedProduct) : 9999}
                        value={qty} onChange={e => setQty(Number(e.target.value))}
                        className="w-full sm:w-40 bg-slate-50 border border-slate-200 rounded-lg p-2.5 text-sm outline-none focus:ring-2 focus:ring-violet-300" />
                </div>

                {/* Note */}
                <div>
                    <label className="text-sm font-bold text-slate-700 block mb-2">Ghi chú (tùy chọn)</label>
                    <input type="text" value={note} onChange={e => setNote(e.target.value)}
                        placeholder="VD: Xuất thêm hàng cho ca tối"
                        className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2.5 text-sm outline-none focus:ring-2 focus:ring-violet-300" />
                </div>

                <button onClick={handleTransfer} disabled={submitting || !selectedCounter || !selectedProduct}
                    className="w-full bg-gradient-to-r from-violet-600 to-purple-600 hover:from-violet-700 hover:to-purple-700 text-white py-3 rounded-xl font-bold text-sm flex items-center justify-center gap-2 transition-all disabled:opacity-50 shadow-md shadow-violet-500/20">
                    {submitting ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> : <Send className="w-4 h-4" />}
                    Xác nhận xuất quầy
                </button>
            </div>
        </div>
    );
}
