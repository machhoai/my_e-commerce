'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { BookOpen, Search, Package } from 'lucide-react';
import type { InventoryTransactionDoc, ProductDoc } from '@/types/inventory';
import type { StoreDoc, CounterDoc } from '@/types';

const TYPE_LABEL: Record<string, string> = {
    IMPORT_CENTRAL: 'Nhập kho TT',
    STORE_ORDER: 'Đặt hàng',
    DISPATCH_TO_STORE: 'Xuất → CH',
    TRANSFER_TO_COUNTER: 'Xuất → Quầy',
    USAGE: 'Sử dụng',
    ADJUSTMENT: 'Điều chỉnh',
};

const TYPE_COLOR: Record<string, string> = {
    IMPORT_CENTRAL: 'bg-blue-100 text-blue-700',
    DISPATCH_TO_STORE: 'bg-emerald-100 text-emerald-700',
    TRANSFER_TO_COUNTER: 'bg-violet-100 text-violet-700',
    USAGE: 'bg-amber-100 text-amber-700',
    ADJUSTMENT: 'bg-slate-100 text-slate-700',
};

export default function LedgerPage() {
    const { user, userDoc } = useAuth();
    const [transactions, setTransactions] = useState<InventoryTransactionDoc[]>([]);
    const [products, setProducts] = useState<ProductDoc[]>([]);
    const [stores, setStores] = useState<StoreDoc[]>([]);
    const [counters, setCounters] = useState<CounterDoc[]>([]);
    const [loading, setLoading] = useState(true);

    // Filters
    const [selectedStoreId, setSelectedStoreId] = useState('');
    const [filterLocationId, setFilterLocationId] = useState('');
    const [filterProductId, setFilterProductId] = useState('');
    const [filterType, setFilterType] = useState('');
    const [dateFrom, setDateFrom] = useState('');
    const [dateTo, setDateTo] = useState('');

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

    // Fetch counters
    useEffect(() => {
        if (!effectiveStoreId || !user) { setCounters([]); return; }
        (async () => {
            try {
                const token = await getToken();
                const res = await fetch(`/api/stores/${effectiveStoreId}/settings`, { headers: { Authorization: `Bearer ${token}` } });
                const data = await res.json();
                setCounters(data.counters || []);
            } catch { setCounters([]); }
        })();
    }, [user, effectiveStoreId, getToken]);

    // Fetch transactions
    const fetchTransactions = useCallback(async () => {
        if (!user) return;
        setLoading(true);
        try {
            const token = await getToken();
            const params = new URLSearchParams();
            if (filterLocationId) params.set('locationId', filterLocationId);
            if (filterProductId) params.set('productId', filterProductId);
            if (filterType) params.set('type', filterType);
            if (dateFrom) params.set('dateFrom', dateFrom);
            if (dateTo) params.set('dateTo', dateTo);

            const res = await fetch(`/api/inventory/transactions?${params.toString()}`, {
                headers: { Authorization: `Bearer ${token}` },
            });
            const data = await res.json();
            setTransactions(Array.isArray(data) ? data : []);
        } catch { /* silent */ } finally { setLoading(false); }
    }, [user, filterLocationId, filterProductId, filterType, dateFrom, dateTo, getToken]);

    useEffect(() => { fetchTransactions(); }, [fetchTransactions]);

    const getProductName = (id: string) => products.find(p => p.id === id)?.name || id;

    const getLocationLabel = (type: string, id: string) => {
        if (type === 'CENTRAL') return 'Kho trung tâm';
        if (type === 'STORE') {
            const store = stores.find(s => s.id === id);
            return store ? `CH: ${store.name}` : `CH: ${id}`;
        }
        if (type === 'COUNTER') {
            const counter = counters.find(c => c.id === id);
            return counter ? `Quầy: ${counter.name}` : `Quầy: ${id}`;
        }
        return id || '—';
    };

    // Build location filter options
    const locationOptions: { value: string; label: string }[] = [
        { value: '', label: 'Tất cả' },
        { value: 'CENTRAL', label: 'Kho trung tâm' },
    ];
    if (effectiveStoreId) {
        locationOptions.push({ value: effectiveStoreId, label: `Kho cửa hàng` });
        counters.forEach(c => locationOptions.push({ value: c.id, label: `Quầy: ${c.name}` }));
    }

    return (
        <div className="space-y-6 mx-auto">
            <div>
                <h1 className="text-2xl font-bold bg-gradient-to-r from-amber-600 to-orange-600 bg-clip-text text-transparent flex items-center gap-2">
                    <BookOpen className="w-7 h-7 text-amber-600" />
                    Thẻ kho (Sổ giao dịch)
                </h1>
                <p className="text-slate-500 mt-1">Lịch sử tất cả các giao dịch xuất nhập kho.</p>
            </div>

            {/* Admin store selector */}
            {isAdmin && (
                <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4 flex items-center gap-3">
                    <Package className="w-5 h-5 text-indigo-500" />
                    <select value={selectedStoreId} onChange={e => { setSelectedStoreId(e.target.value); setFilterLocationId(''); }}
                        className="flex-1 bg-slate-50 border border-slate-200 rounded-lg p-2 text-sm outline-none focus:ring-2 focus:ring-indigo-300">
                        <option value="">-- Chọn cửa hàng --</option>
                        {stores.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                    </select>
                </div>
            )}

            {/* Filters */}
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
                    <div>
                        <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">Vị trí</label>
                        <select value={filterLocationId} onChange={e => setFilterLocationId(e.target.value)}
                            className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2 text-sm outline-none">
                            {locationOptions.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                        </select>
                    </div>
                    <div>
                        <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">Sản phẩm</label>
                        <select value={filterProductId} onChange={e => setFilterProductId(e.target.value)}
                            className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2 text-sm outline-none">
                            <option value="">Tất cả</option>
                            {products.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                        </select>
                    </div>
                    <div>
                        <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">Loại</label>
                        <select value={filterType} onChange={e => setFilterType(e.target.value)}
                            className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2 text-sm outline-none">
                            <option value="">Tất cả</option>
                            {Object.entries(TYPE_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                        </select>
                    </div>
                    <div>
                        <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">Từ ngày</label>
                        <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)}
                            className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2 text-sm outline-none" />
                    </div>
                    <div>
                        <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">Đến ngày</label>
                        <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)}
                            className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2 text-sm outline-none" />
                    </div>
                </div>
            </div>

            {/* Transactions Table */}
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                {loading ? (
                    <div className="flex justify-center py-12"><div className="w-6 h-6 border-4 border-slate-300 border-t-slate-700 rounded-full animate-spin" /></div>
                ) : transactions.length === 0 ? (
                    <div className="text-center py-12 space-y-2">
                        <Search className="w-8 h-8 text-slate-300 mx-auto" />
                        <p className="text-sm text-slate-400">Không có giao dịch nào</p>
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="text-left text-xs text-slate-500 uppercase bg-slate-50 border-b">
                                    <th className="px-4 py-3">Thời gian</th>
                                    <th className="px-4 py-3">Loại</th>
                                    <th className="px-4 py-3">Sản phẩm</th>
                                    <th className="px-4 py-3 text-right">SL</th>
                                    <th className="px-4 py-3">Từ</th>
                                    <th className="px-4 py-3">Đến</th>
                                    <th className="px-4 py-3">Ghi chú</th>
                                </tr>
                            </thead>
                            <tbody>
                                {transactions.map(tx => (
                                    <tr key={tx.id} className="border-b border-slate-100 hover:bg-slate-50/50">
                                        <td className="px-4 py-3 text-slate-500 whitespace-nowrap text-xs">{new Date(tx.timestamp).toLocaleString('vi-VN')}</td>
                                        <td className="px-4 py-3">
                                            <span className={`text-[10px] font-bold px-2 py-0.5 rounded ${TYPE_COLOR[tx.type] || 'bg-slate-100 text-slate-600'}`}>
                                                {TYPE_LABEL[tx.type] || tx.type}
                                            </span>
                                        </td>
                                        <td className="px-4 py-3 font-medium text-slate-700 whitespace-nowrap">{getProductName(tx.productId)}</td>
                                        <td className="px-4 py-3 text-right font-bold text-slate-800">{tx.quantity}</td>
                                        <td className="px-4 py-3 text-slate-500 text-xs whitespace-nowrap">{getLocationLabel(tx.fromLocationType, tx.fromLocationId)}</td>
                                        <td className="px-4 py-3 text-slate-500 text-xs whitespace-nowrap">{getLocationLabel(tx.toLocationType, tx.toLocationId)}</td>
                                        <td className="px-4 py-3 text-slate-400 text-xs max-w-[150px] truncate">{tx.note || '—'}</td>
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
