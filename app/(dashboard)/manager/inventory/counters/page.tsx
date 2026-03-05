'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { BarChart3, AlertTriangle, Package, ArrowRightLeft } from 'lucide-react';
import type { ProductDoc, InventoryBalanceDoc } from '@/types/inventory';
import type { StoreDoc, CounterDoc } from '@/types';

export default function CounterStockDashboard() {
    const { user, userDoc } = useAuth();
    const [products, setProducts] = useState<ProductDoc[]>([]);
    const [counters, setCounters] = useState<CounterDoc[]>([]);
    const [balances, setBalances] = useState<InventoryBalanceDoc[]>([]);
    const [stores, setStores] = useState<StoreDoc[]>([]);
    const [selectedCounter, setSelectedCounter] = useState('');
    const [selectedStoreId, setSelectedStoreId] = useState('');
    const [loading, setLoading] = useState(true);

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
        if (!effectiveStoreId || !user) { setCounters([]); setSelectedCounter(''); return; }
        (async () => {
            try {
                const token = await getToken();
                const res = await fetch(`/api/stores/${effectiveStoreId}/settings`, { headers: { Authorization: `Bearer ${token}` } });
                const data = await res.json();
                const activeCounters = (data.counters || []).filter((c: CounterDoc) => c.isActive !== false);
                setCounters(activeCounters);
                if (activeCounters.length > 0 && !selectedCounter) setSelectedCounter(activeCounters[0].id);
            } catch { setCounters([]); }
        })();
    }, [user, effectiveStoreId, getToken]);

    // Fetch balances for selected counter
    useEffect(() => {
        if (!selectedCounter || !user) { setBalances([]); return; }
        setLoading(true);
        (async () => {
            try {
                const token = await getToken();
                const res = await fetch(`/api/inventory/balances?locationType=COUNTER&locationId=${selectedCounter}`, {
                    headers: { Authorization: `Bearer ${token}` },
                });
                const data = await res.json();
                setBalances(Array.isArray(data) ? data : []);
            } catch { setBalances([]); } finally { setLoading(false); }
        })();
    }, [user, selectedCounter, getToken]);

    const getProduct = (productId: string) => products.find(p => p.id === productId);

    // Merge balances with product info
    const stockRows = balances.map(b => {
        const product = getProduct(b.productId);
        return {
            ...b,
            productName: product?.name || b.productId,
            productImage: product?.image || '',
            unit: product?.unit || '',
            minStock: product?.minStock ?? 0,
            isLowStock: product ? (b.currentStock <= (product.minStock || 0)) : false,
        };
    }).sort((a, b) => {
        // Low stock first
        if (a.isLowStock && !b.isLowStock) return -1;
        if (!a.isLowStock && b.isLowStock) return 1;
        return a.productName.localeCompare(b.productName);
    });

    const counterName = counters.find(c => c.id === selectedCounter)?.name || '';
    const lowStockCount = stockRows.filter(r => r.isLowStock).length;

    return (
        <div className="space-y-6 mx-auto">
            <div>
                <h1 className="text-2xl font-bold bg-gradient-to-r from-teal-600 to-cyan-600 bg-clip-text text-transparent flex items-center gap-2">
                    <BarChart3 className="w-7 h-7 text-teal-600" />
                    Tồn kho theo Quầy
                </h1>
                <p className="text-slate-500 mt-1">Theo dõi tồn kho tại từng quầy — nhận cảnh báo khi cần bổ sung hàng.</p>
            </div>

            {/* Admin store selector */}
            {isAdmin && (
                <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4 flex items-center gap-3">
                    <Package className="w-5 h-5 text-indigo-500" />
                    <select value={selectedStoreId} onChange={e => { setSelectedStoreId(e.target.value); setSelectedCounter(''); }}
                        className="flex-1 bg-slate-50 border border-slate-200 rounded-lg p-2 text-sm outline-none focus:ring-2 focus:ring-indigo-300">
                        <option value="">-- Chọn cửa hàng --</option>
                        {stores.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                    </select>
                </div>
            )}

            {/* Counter Tabs */}
            {counters.length > 0 && (
                <div className="flex gap-2 overflow-x-auto pb-1">
                    {counters.map(c => (
                        <button key={c.id} onClick={() => setSelectedCounter(c.id)}
                            className={`px-4 py-2 rounded-xl text-sm font-bold whitespace-nowrap transition-all ${selectedCounter === c.id
                                    ? 'bg-teal-600 text-white shadow-md shadow-teal-500/20'
                                    : 'bg-white text-slate-600 border border-slate-200 hover:border-teal-300 hover:bg-teal-50'
                                }`}>
                            {c.name}
                        </button>
                    ))}
                </div>
            )}

            {!counters.length && effectiveStoreId && (
                <div className="bg-amber-50 text-amber-700 border border-amber-200 rounded-xl p-4 text-sm flex items-center gap-2">
                    <AlertTriangle className="w-5 h-5 shrink-0" />
                    Cửa hàng chưa có quầy nào được kích hoạt. Vui lòng cấu hình trong Cài đặt.
                </div>
            )}

            {/* Low stock summary */}
            {lowStockCount > 0 && (
                <div className="bg-red-50 text-red-700 border border-red-200 rounded-xl p-4 text-sm flex items-center gap-2">
                    <AlertTriangle className="w-5 h-5 shrink-0" />
                    <span><strong>{lowStockCount}</strong> sản phẩm đang ở mức tồn kho thấp tại <strong>{counterName}</strong>. Cần bổ sung hàng!</span>
                </div>
            )}

            {/* Stock Grid */}
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                {!selectedCounter ? (
                    <p className="text-sm text-slate-400 text-center py-12">Chọn cửa hàng và quầy để xem tồn kho</p>
                ) : loading ? (
                    <div className="flex justify-center py-12"><div className="w-6 h-6 border-4 border-slate-300 border-t-slate-700 rounded-full animate-spin" /></div>
                ) : stockRows.length === 0 ? (
                    <div className="text-center py-12 space-y-2">
                        <Package className="w-8 h-8 text-slate-300 mx-auto" />
                        <p className="text-sm text-slate-400">Quầy này chưa có hàng tồn kho</p>
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="text-left text-xs text-slate-500 uppercase bg-slate-50 border-b">
                                    <th className="px-4 py-3">Sản phẩm</th>
                                    <th className="px-4 py-3">ĐVT</th>
                                    <th className="px-4 py-3 text-right">Tồn kho</th>
                                    <th className="px-4 py-3 text-right">Tối thiểu</th>
                                    <th className="px-4 py-3">Trạng thái</th>
                                    <th className="px-4 py-3 text-right">Cập nhật</th>
                                </tr>
                            </thead>
                            <tbody>
                                {stockRows.map(row => (
                                    <tr key={row.id} className={`border-b border-slate-100 ${row.isLowStock ? 'bg-red-50/60' : 'hover:bg-slate-50/50'}`}>
                                        <td className="px-4 py-3">
                                            <div className="flex items-center gap-3">
                                                {row.productImage ? (
                                                    <img src={row.productImage} alt="" className="w-8 h-8 rounded-lg object-cover border border-slate-200" />
                                                ) : (
                                                    <div className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center"><Package className="w-4 h-4 text-slate-400" /></div>
                                                )}
                                                <span className="font-medium text-slate-700">{row.productName}</span>
                                            </div>
                                        </td>
                                        <td className="px-4 py-3 text-slate-500">{row.unit}</td>
                                        <td className="px-4 py-3 text-right">
                                            <span className={`text-lg font-bold ${row.isLowStock ? 'text-red-600' : 'text-slate-800'}`}>
                                                {row.currentStock}
                                            </span>
                                        </td>
                                        <td className="px-4 py-3 text-right text-slate-400">{row.minStock}</td>
                                        <td className="px-4 py-3">
                                            {row.isLowStock ? (
                                                <span className="inline-flex items-center gap-1 text-xs font-bold text-red-600 bg-red-100 border border-red-200 px-2 py-0.5 rounded">
                                                    <AlertTriangle className="w-3 h-3" />
                                                    Thiếu hàng
                                                </span>
                                            ) : (
                                                <span className="text-xs font-bold text-emerald-600 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded">Đủ hàng</span>
                                            )}
                                        </td>
                                        <td className="px-4 py-3 text-right text-xs text-slate-400 whitespace-nowrap">
                                            {new Date(row.lastUpdated).toLocaleString('vi-VN')}
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
