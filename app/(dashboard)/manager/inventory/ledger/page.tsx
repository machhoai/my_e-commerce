'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { BookOpen, Search } from 'lucide-react';
import type { InventoryTransactionDoc, ProductDoc } from '@/types/inventory';
import type { CounterDoc } from '@/types';
import { DashboardHeader } from '@/components/inventory/overview/DashboardHeader';

const TYPE_LABEL: Record<string, string> = {
    IMPORT_CENTRAL: 'Nhập kho TT',
    STORE_ORDER: 'Đặt hàng',
    DISPATCH_TO_STORE: 'Xuất → CH',
    TRANSFER_TO_COUNTER: 'Xuất → Quầy',
    USAGE: 'Sử dụng',
    ADJUSTMENT: 'Điều chỉnh',
};

const TYPE_COLOR: Record<string, string> = {
    IMPORT_CENTRAL: 'bg-primary-100 text-primary-700',
    DISPATCH_TO_STORE: 'bg-success-100 text-success-700',
    TRANSFER_TO_COUNTER: 'bg-accent-100 text-accent-700',
    USAGE: 'bg-warning-100 text-warning-700',
    ADJUSTMENT: 'bg-surface-100 text-surface-700',
};

export default function LedgerPage() {
    const { user, userDoc } = useAuth();
    const [transactions, setTransactions] = useState<InventoryTransactionDoc[]>([]);
    const [products, setProducts] = useState<ProductDoc[]>([]);
    const [counters, setCounters] = useState<CounterDoc[]>([]);
    const [loading, setLoading] = useState(true);

    // Filters
    const [filterLocationId, setFilterLocationId] = useState('');
    const [filterProductId, setFilterProductId] = useState('');
    const [filterType, setFilterType] = useState('');
    const [dateFrom, setDateFrom] = useState('');
    const [dateTo, setDateTo] = useState('');

    const getToken = useCallback(() => user?.getIdToken(), [user]);
    const storeId = userDoc?.storeId || '';

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



    // Fetch counters
    useEffect(() => {
        if (!storeId || !user) { setCounters([]); return; }
        (async () => {
            try {
                const token = await getToken();
                const res = await fetch(`/api/stores/${storeId}/settings`, { headers: { Authorization: `Bearer ${token}` } });
                const data = await res.json();
                setCounters(data.counters || []);
            } catch { setCounters([]); }
        })();
    }, [user, storeId, getToken]);

    // Fetch transactions — scoped to this store
    const fetchTransactions = useCallback(async () => {
        if (!user || !storeId) {
            setLoading(false);
            return;
        }
        setLoading(true);
        try {
            const token = await getToken();
            const params = new URLSearchParams();
            params.set('storeId', storeId);
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
        } catch (err) {
            console.error('Ledger fetch error:', err);
            setTransactions([]);
        } finally { setLoading(false); }
    }, [user, storeId, filterLocationId, filterProductId, filterType, dateFrom, dateTo, getToken]);

    useEffect(() => { fetchTransactions(); }, [fetchTransactions]);

    const getProductCode = (id: string) => {
        const p = products.find(p => p.id === id);
        return p?.companyCode || p?.barcode || p?.name || id;
    };

    const getLocationLabel = (type: string, id: string) => {
        if (type === 'CENTRAL') return 'Kho trung tâm';
        if (type === 'STORE') return 'Kho cửa hàng';
        if (type === 'COUNTER') {
            const counter = counters.find(c => c.id === id);
            return counter ? `Quầy: ${counter.name}` : `Quầy: ${id}`;
        }
        return id || '—';
    };

    // Build location filter options (store-scoped, no CENTRAL)
    const locationOptions: { value: string; label: string }[] = [
        { value: '', label: 'Tất cả' },
    ];
    if (storeId) {
        locationOptions.push({ value: storeId, label: 'Kho cửa hàng' });
        counters.forEach(c => locationOptions.push({ value: c.id, label: `Quầy: ${c.name}` }));
    }

    return (
        <div className="space-y-6 mx-auto">
            {/* ... (in the render body) */}

            <DashboardHeader
                warehouses={locationOptions as any[]} // Treat locations as warehouses for dropdown
                selectedWarehouseId={filterLocationId}
                onWarehouseChange={setFilterLocationId}
                type="warehouse"
                titleChildren={
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 w-full">
                        <div>
                            <h1 className="text-2xl font-bold bg-gradient-to-r from-warning-600 to-orange-600 bg-clip-text text-transparent flex items-center gap-2">
                                <BookOpen className="w-7 h-7 text-warning-600" />
                                Thẻ kho (Sổ giao dịch)
                            </h1>
                            <p className="text-surface-500 mt-1 text-sm">Lịch sử giao dịch xuất nhập kho cửa hàng.</p>
                        </div>
                    </div>
                }
            />

            {/* Filters */}
            <div className="bg-white rounded-2xl border border-surface-200 shadow-sm p-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                    <div>
                        <label className="text-[10px] font-bold text-surface-500 uppercase block mb-1">Sản phẩm</label>
                        <select value={filterProductId} onChange={e => setFilterProductId(e.target.value)}
                            className="w-full bg-surface-50 border border-surface-200 rounded-lg p-2 text-sm outline-none">
                            <option value="">Tất cả</option>
                            {products.map(p => <option key={p.id} value={p.id}>{p.companyCode || p.barcode || p.name}</option>)}
                        </select>
                    </div>
                    <div>
                        <label className="text-[10px] font-bold text-surface-500 uppercase block mb-1">Loại</label>
                        <select value={filterType} onChange={e => setFilterType(e.target.value)}
                            className="w-full bg-surface-50 border border-surface-200 rounded-lg p-2 text-sm outline-none">
                            <option value="">Tất cả</option>
                            {Object.entries(TYPE_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                        </select>
                    </div>
                    <div>
                        <label className="text-[10px] font-bold text-surface-500 uppercase block mb-1">Từ ngày</label>
                        <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)}
                            className="w-full bg-surface-50 border border-surface-200 rounded-lg p-2 text-sm outline-none" />
                    </div>
                    <div>
                        <label className="text-[10px] font-bold text-surface-500 uppercase block mb-1">Đến ngày</label>
                        <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)}
                            className="w-full bg-surface-50 border border-surface-200 rounded-lg p-2 text-sm outline-none" />
                    </div>
                </div>
            </div>

            {/* Transactions Table */}
            <div className="bg-white rounded-2xl border border-surface-200 shadow-sm overflow-hidden">
                {loading ? (
                    <div className="flex justify-center py-12"><div className="w-6 h-6 border-4 border-surface-300 border-t-surface-700 rounded-full animate-spin" /></div>
                ) : transactions.length === 0 ? (
                    <div className="text-center py-12 space-y-2">
                        <Search className="w-8 h-8 text-surface-300 mx-auto" />
                        <p className="text-sm text-surface-400">Không có giao dịch nào</p>
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="text-left text-xs text-surface-500 uppercase bg-surface-50 border-b">
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
                                    <tr key={tx.id} className="border-b border-surface-100 hover:bg-surface-50/50">
                                        <td className="px-4 py-3 text-surface-500 whitespace-nowrap text-xs">{new Date(tx.timestamp).toLocaleString('vi-VN')}</td>
                                        <td className="px-4 py-3">
                                            <span className={`text-[10px] font-bold px-2 py-0.5 rounded ${TYPE_COLOR[tx.type] || 'bg-surface-100 text-surface-600'}`}>
                                                {TYPE_LABEL[tx.type] || tx.type}
                                            </span>
                                        </td>
                                        <td className="px-4 py-3 whitespace-nowrap">
                                            <span className="font-mono font-bold text-surface-800 bg-surface-100 px-1.5 py-0.5 rounded text-xs">{getProductCode(tx.productId)}</span>
                                        </td>
                                        <td className="px-4 py-3 text-right font-bold text-surface-800">{tx.quantity}</td>
                                        <td className="px-4 py-3 text-surface-500 text-xs whitespace-nowrap">{getLocationLabel(tx.fromLocationType, tx.fromLocationId)}</td>
                                        <td className="px-4 py-3 text-surface-500 text-xs whitespace-nowrap">{getLocationLabel(tx.toLocationType, tx.toLocationId)}</td>
                                        <td className="px-4 py-3 text-surface-400 text-xs max-w-[150px] truncate">{tx.note || '—'}</td>
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
