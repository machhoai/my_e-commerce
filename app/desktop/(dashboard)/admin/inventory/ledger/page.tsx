'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { BookOpen } from 'lucide-react';
import type { ProductDoc, InventoryTransactionDoc } from '@/types/inventory';
import type { StoreDoc } from '@/types';
import { DashboardHeader } from '@/components/inventory/overview/DashboardHeader';

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
        return <div className="flex items-center justify-center h-64 text-danger-500 font-bold">Bạn không có quyền truy cập.</div>;
    }

    const getProductCode = (id: string) => {
        const p = products.find(p => p.id === id);
        return p?.companyCode || p?.barcode || p?.name || id;
    };

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
        IMPORT_CENTRAL: 'bg-primary-50 text-primary-700 border-primary-200',
        DISPATCH_TO_STORE: 'bg-warning-50 text-warning-700 border-warning-200',
        TRANSFER_TO_COUNTER: 'bg-accent-50 text-accent-700 border-accent-200',
    };

    return (
        <div className="space-y-6 mx-auto">
            <DashboardHeader
                showSelect={false}
                titleChildren={
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 w-full">
                        <div>
                            <h1 className="text-2xl font-bold bg-gradient-to-r from-surface-700 to-surface-500 bg-clip-text text-transparent flex items-center gap-2">
                                <BookOpen className="w-7 h-7 text-surface-600" />
                                Thẻ kho tổng
                            </h1>
                            <p className="text-surface-500 mt-1 text-sm">Lịch sử nhập/xuất kho trung tâm.</p>
                        </div>
                    </div>
                }
            />

            {/* Filters */}
            <div className="bg-white rounded-2xl border border-surface-200 shadow-sm p-4 space-y-3">
                <div className="flex flex-col sm:flex-row gap-3">
                    <select value={filterProductId} onChange={e => setFilterProductId(e.target.value)}
                        className="flex-1 bg-surface-50 border border-surface-200 rounded-lg p-2.5 text-sm outline-none focus:ring-2 focus:ring-surface-300">
                        <option value="">Tất cả sản phẩm</option>
                        {products.map(p => <option key={p.id} value={p.id}>{p.companyCode || p.barcode || p.name}</option>)}
                    </select>
                    <select value={filterType} onChange={e => setFilterType(e.target.value)}
                        className="bg-surface-50 border border-surface-200 rounded-lg p-2.5 text-sm outline-none sm:w-48">
                        <option value="">Tất cả loại</option>
                        <option value="IMPORT_CENTRAL">Nhập kho</option>
                        <option value="DISPATCH_TO_STORE">Xuất cửa hàng</option>
                    </select>
                </div>
                <div className="flex flex-col sm:flex-row gap-3">
                    <div className="flex items-center gap-2 flex-1">
                        <span className="text-xs text-surface-500 whitespace-nowrap">Từ:</span>
                        <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)}
                            className="flex-1 bg-surface-50 border border-surface-200 rounded-lg p-2 text-sm outline-none" />
                    </div>
                    <div className="flex items-center gap-2 flex-1">
                        <span className="text-xs text-surface-500 whitespace-nowrap">Đến:</span>
                        <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)}
                            className="flex-1 bg-surface-50 border border-surface-200 rounded-lg p-2 text-sm outline-none" />
                    </div>
                </div>
            </div>

            {/* Transactions Table */}
            <div className="bg-white rounded-2xl border border-surface-200 shadow-sm overflow-hidden">
                {loading ? (
                    <div className="flex justify-center py-12"><div className="w-6 h-6 border-4 border-surface-300 border-t-surface-700 rounded-full animate-spin" /></div>
                ) : transactions.length === 0 ? (
                    <div className="text-center py-12 space-y-2">
                        <BookOpen className="w-8 h-8 text-surface-300 mx-auto" />
                        <p className="text-sm text-surface-400">Chưa có giao dịch nào</p>
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="text-left text-xs text-surface-500 uppercase bg-surface-50 border-b">
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
                                    <tr key={tx.id} className="border-b border-surface-100 hover:bg-surface-50/50">
                                        <td className="px-4 py-3 text-surface-500 whitespace-nowrap text-xs">{new Date(tx.timestamp).toLocaleString('vi-VN')}</td>
                                        <td className="px-4 py-3 whitespace-nowrap">
                                            <span className="font-mono font-bold text-surface-800 bg-surface-100 px-1.5 py-0.5 rounded text-xs">{getProductCode(tx.productId)}</span>
                                        </td>
                                        <td className="px-4 py-3">
                                            <span className={`text-[10px] font-bold px-2 py-0.5 rounded border ${TYPE_COLORS[tx.type] || 'bg-surface-50 text-surface-600 border-surface-200'}`}>
                                                {TYPE_LABELS[tx.type] || tx.type}
                                            </span>
                                        </td>
                                        <td className="px-4 py-3 text-xs text-surface-500">
                                            {getLocationLabel(tx.fromLocationType, tx.fromLocationId)} → {getLocationLabel(tx.toLocationType, tx.toLocationId)}
                                        </td>
                                        <td className="px-4 py-3 text-right font-bold text-surface-800">{tx.quantity}</td>
                                        <td className="px-4 py-3 text-xs text-surface-400 max-w-[200px] truncate">{tx.note || '—'}</td>
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
