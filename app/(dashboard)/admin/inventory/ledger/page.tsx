'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { BookOpen } from 'lucide-react';
import type { ProductDoc, InventoryTransactionDoc } from '@/types/inventory';
import type { StoreDoc } from '@/types';

export default function CentralLedgerPage() {
    const { user, userDoc, hasPermission } = useAuth();
    const [products, setProducts] = useState<ProductDoc[]>([]);
    const [stores, setStores] = useState<StoreDoc[]>([]);
    const [transactions, setTransactions] = useState<InventoryTransactionDoc[]>([]);
    const [loading, setLoading] = useState(true);
    const [filterProductId, setFilterProductId] = useState('');
    const [filterType, setFilterType] = useState('');
    const [dateFrom, setDateFrom] = useState('');
    const [dateTo, setDateTo] = useState('');

    const getToken = useCallback(() => user?.getIdToken(), [user]);

    const canAccess = userDoc?.role === 'admin' || hasPermission('manage_central_warehouse');

    // Fetch products
    useEffect(() => {
        if (!user) return;
        (async () => {
            try {
                const token = await getToken();
                const res = await fetch('/api/inventory/products?all=true', { headers: { Authorization: `Bearer ${token}` } });
                const data = await res.json();
                setProducts(Array.isArray(data) ? data : []);
            } catch { /* silent */ }
        })();
    }, [user, getToken]);

    // Fetch stores for name resolution
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

    // Fetch transactions — only CENTRAL warehouse related
    const fetchTransactions = useCallback(async () => {
        if (!user) return;
        setLoading(true);
        try {
            const token = await getToken();
            const params = new URLSearchParams();
            params.set('locationType', 'CENTRAL');
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
    }, [user, filterProductId, filterType, dateFrom, dateTo, getToken]);

    useEffect(() => { fetchTransactions(); }, [fetchTransactions]);

    // Permission guard — placed AFTER all hooks to avoid Rules of Hooks violation
    if (userDoc && !canAccess) {
        return <div className="flex items-center justify-center h-64 text-red-500 font-bold">Bạn không có quyền truy cập.</div>;
    }

    const getProductName = (id: string) => products.find(p => p.id === id)?.name || id;

    const getLocationLabel = (locationType: string, locationId: string) => {
        if (locationType === 'CENTRAL') return 'Kho trung tâm';
        if (locationType === 'STORE') {
            const store = stores.find(s => s.id === locationId);
            return store ? store.name : `CH: ${locationId}`;
        }
        if (locationType === 'COUNTER') return `Quầy: ${locationId}`;
        return locationId || 'Ngoài';
    };

    const TYPE_LABELS: Record<string, string> = {
        IMPORT_CENTRAL: 'Nhập kho tổng',
        DISPATCH_TO_STORE: 'Xuất đến cửa hàng',
        TRANSFER_TO_COUNTER: 'Chuyển đến quầy',
    };

    const TYPE_COLORS: Record<string, string> = {
        IMPORT_CENTRAL: 'bg-blue-50 text-blue-700 border-blue-200',
        DISPATCH_TO_STORE: 'bg-amber-50 text-amber-700 border-amber-200',
        TRANSFER_TO_COUNTER: 'bg-purple-50 text-purple-700 border-purple-200',
    };

    return (
        <div className="space-y-6 mx-auto">
            <div>
                <h1 className="text-2xl font-bold bg-gradient-to-r from-slate-700 to-slate-500 bg-clip-text text-transparent flex items-center gap-2">
                    <BookOpen className="w-7 h-7 text-slate-600" />
                    Thẻ kho tổng
                </h1>
                <p className="text-slate-500 mt-1">Lịch sử nhập/xuất kho trung tâm.</p>
            </div>

            {/* Filters */}
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4 space-y-3">
                <div className="flex flex-col sm:flex-row gap-3">
                    <select value={filterProductId} onChange={e => setFilterProductId(e.target.value)}
                        className="flex-1 bg-slate-50 border border-slate-200 rounded-lg p-2.5 text-sm outline-none focus:ring-2 focus:ring-slate-300">
                        <option value="">Tất cả sản phẩm</option>
                        {products.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                    </select>
                    <select value={filterType} onChange={e => setFilterType(e.target.value)}
                        className="bg-slate-50 border border-slate-200 rounded-lg p-2.5 text-sm outline-none sm:w-48">
                        <option value="">Tất cả loại</option>
                        <option value="IMPORT_CENTRAL">Nhập kho</option>
                        <option value="DISPATCH_TO_STORE">Xuất cửa hàng</option>
                    </select>
                </div>
                <div className="flex flex-col sm:flex-row gap-3">
                    <div className="flex items-center gap-2 flex-1">
                        <span className="text-xs text-slate-500 whitespace-nowrap">Từ:</span>
                        <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)}
                            className="flex-1 bg-slate-50 border border-slate-200 rounded-lg p-2 text-sm outline-none" />
                    </div>
                    <div className="flex items-center gap-2 flex-1">
                        <span className="text-xs text-slate-500 whitespace-nowrap">Đến:</span>
                        <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)}
                            className="flex-1 bg-slate-50 border border-slate-200 rounded-lg p-2 text-sm outline-none" />
                    </div>
                </div>
            </div>

            {/* Transactions Table */}
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                {loading ? (
                    <div className="flex justify-center py-12"><div className="w-6 h-6 border-4 border-slate-300 border-t-slate-700 rounded-full animate-spin" /></div>
                ) : transactions.length === 0 ? (
                    <div className="text-center py-12 space-y-2">
                        <BookOpen className="w-8 h-8 text-slate-300 mx-auto" />
                        <p className="text-sm text-slate-400">Chưa có giao dịch nào</p>
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="text-left text-xs text-slate-500 uppercase bg-slate-50 border-b">
                                    <th className="px-4 py-3">Thời gian</th>
                                    <th className="px-4 py-3">Sản phẩm</th>
                                    <th className="px-4 py-3">Loại</th>
                                    <th className="px-4 py-3">Từ → Đến</th>
                                    <th className="px-4 py-3 text-right">Số lượng</th>
                                    <th className="px-4 py-3">Ghi chú</th>
                                </tr>
                            </thead>
                            <tbody>
                                {transactions.map(tx => (
                                    <tr key={tx.id} className="border-b border-slate-100 hover:bg-slate-50/50">
                                        <td className="px-4 py-3 text-slate-500 whitespace-nowrap text-xs">{new Date(tx.timestamp).toLocaleString('vi-VN')}</td>
                                        <td className="px-4 py-3 font-medium text-slate-700">{getProductName(tx.productId)}</td>
                                        <td className="px-4 py-3">
                                            <span className={`text-[10px] font-bold px-2 py-0.5 rounded border ${TYPE_COLORS[tx.type] || 'bg-slate-50 text-slate-600 border-slate-200'}`}>
                                                {TYPE_LABELS[tx.type] || tx.type}
                                            </span>
                                        </td>
                                        <td className="px-4 py-3 text-xs text-slate-500">
                                            {getLocationLabel(tx.fromLocationType, tx.fromLocationId)} → {getLocationLabel(tx.toLocationType, tx.toLocationId)}
                                        </td>
                                        <td className="px-4 py-3 text-right font-bold text-slate-800">{tx.quantity}</td>
                                        <td className="px-4 py-3 text-xs text-slate-400 max-w-[200px] truncate">{tx.note || '—'}</td>
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
