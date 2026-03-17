'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Warehouse, AlertTriangle, Package, Search, Building2 } from 'lucide-react';
import type { ProductDoc, InventoryBalanceDoc } from '@/types/inventory';
import type { WarehouseDoc } from '@/types';
import { cn } from '@/lib/utils';
import { DashboardHeader } from '@/components/inventory/overview/DashboardHeader';

export default function CentralStockPage() {
    const { user, userDoc, hasPermission } = useAuth();
    const [warehouses, setWarehouses] = useState<WarehouseDoc[]>([]);
    const [products, setProducts] = useState<ProductDoc[]>([]);
    const [balances, setBalances] = useState<InventoryBalanceDoc[]>([]);
    const [loading, setLoading] = useState(true);
    const [warehousesLoading, setWarehousesLoading] = useState(true);
    const [search, setSearch] = useState('');
    const [filter, setFilter] = useState<'all' | 'low' | 'out'>('all');

    // Selected warehouse
    const [selectedWarehouseId, setSelectedWarehouseId] = useState('');

    const getToken = useCallback(() => user?.getIdToken(), [user]);

    if (userDoc && userDoc.role !== 'admin' && !hasPermission('page.admin.inventory')) {
        return <div className="flex items-center justify-center h-64 text-danger-500 font-bold">Chỉ quản trị viên.</div>;
    }

    // Fetch warehouses list
    useEffect(() => {
        if (!user) return;
        setWarehousesLoading(true);
        (async () => {
            try {
                const token = await getToken();
                const res = await fetch('/api/warehouses', { headers: { Authorization: `Bearer ${token}` } });
                const data = await res.json();
                const warehouseList: WarehouseDoc[] = Array.isArray(data) ? data.filter((w: WarehouseDoc) => w.isActive) : [];
                setWarehouses(warehouseList);

                // Auto-select first warehouse
                if (warehouseList.length > 0) {
                    setSelectedWarehouseId(warehouseList[0].id);
                }
            } catch { /* silent */ } finally { setWarehousesLoading(false); }
        })();
    }, [user, getToken]);

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

    // Fetch balances for selected warehouse
    useEffect(() => {
        if (!user || !selectedWarehouseId) {
            setBalances([]);
            setLoading(false);
            return;
        }
        setLoading(true);
        (async () => {
            try {
                const token = await getToken();
                const res = await fetch(`/api/inventory/balances?locationType=CENTRAL&locationId=${selectedWarehouseId}`, {
                    headers: { Authorization: `Bearer ${token}` },
                });
                const data = await res.json();
                setBalances(Array.isArray(data) ? data : []);
            } catch { /* silent */ } finally { setLoading(false); }
        })();
    }, [user, getToken, selectedWarehouseId]);

    // Get selected warehouse info
    const selectedWarehouse = warehouses.find(w => w.id === selectedWarehouseId);

    // Merge products with balances
    const stockRows = products.filter(p => p.isActive).map(product => {
        const balance = balances.find(b => b.productId === product.id);
        const currentStock = balance?.currentStock ?? 0;
        const isLowStock = currentStock > 0 && currentStock <= (product.minStock || 0);
        const isOutOfStock = currentStock <= 0;
        return {
            ...product,
            currentStock,
            isLowStock,
            isOutOfStock,
            lastUpdated: balance?.lastUpdated || '',
        };
    });

    // Apply filters
    const filtered = stockRows.filter(r => {
        if (filter === 'low' && !r.isLowStock) return false;
        if (filter === 'out' && !r.isOutOfStock) return false;
        if (search) {
            const s = search.toLowerCase();
            return r.name.toLowerCase().includes(s) || r.barcode.toLowerCase().includes(s) || r.companyCode.toLowerCase().includes(s);
        }
        return true;
    }).sort((a, b) => {
        if (a.isOutOfStock && !b.isOutOfStock) return -1;
        if (!a.isOutOfStock && b.isOutOfStock) return 1;
        if (a.isLowStock && !b.isLowStock) return -1;
        if (!a.isLowStock && b.isLowStock) return 1;
        return a.name.localeCompare(b.name);
    });

    const lowCount = stockRows.filter(r => r.isLowStock).length;
    const outCount = stockRows.filter(r => r.isOutOfStock).length;
    const totalValue = stockRows.reduce((sum, r) => sum + r.currentStock * r.invoicePrice, 0);

    return (
        <div className="space-y-6 mx-auto">
            <DashboardHeader
                warehouses={warehouses}
                selectedWarehouseId={selectedWarehouseId}
                onWarehouseChange={setSelectedWarehouseId}
                showSelect={true}
                titleChildren={
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 w-full">
                        <div>
                            <h1 className="text-2xl font-bold bg-gradient-to-r from-success-600 to-teal-600 bg-clip-text text-transparent flex items-center gap-2">
                                <Warehouse className="w-7 h-7 text-success-600" />
                                Tồn kho Kho tổng
                            </h1>
                            <p className="text-surface-500 mt-1 text-sm">Theo dõi tồn kho theo từng kho và nhận cảnh báo bổ sung hàng.</p>
                        </div>
                    </div>
                }
            />

            {/* Summary cards */}
            {selectedWarehouseId && !loading && (
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                    <div className="bg-white rounded-xl border border-surface-200 shadow-sm p-4 text-center">
                        <p className="text-[10px] font-bold text-surface-500 uppercase">Tổng SP</p>
                        <p className="text-2xl font-bold text-surface-800 mt-1">{stockRows.length}</p>
                    </div>
                    <div className="bg-white rounded-xl border border-surface-200 shadow-sm p-4 text-center">
                        <p className="text-[10px] font-bold text-surface-500 uppercase">Giá trị tồn kho</p>
                        <p className="text-2xl font-bold text-success-600 mt-1">{totalValue.toLocaleString('vi-VN')}đ</p>
                    </div>
                    <div className={`rounded-xl border shadow-sm p-4 text-center ${lowCount > 0 ? 'bg-warning-50 border-warning-200' : 'bg-white border-surface-200'}`}>
                        <p className="text-[10px] font-bold text-surface-500 uppercase">Sắp hết</p>
                        <p className={`text-2xl font-bold mt-1 ${lowCount > 0 ? 'text-warning-600' : 'text-surface-800'}`}>{lowCount}</p>
                    </div>
                    <div className={`rounded-xl border shadow-sm p-4 text-center ${outCount > 0 ? 'bg-danger-50 border-danger-200' : 'bg-white border-surface-200'}`}>
                        <p className="text-[10px] font-bold text-surface-500 uppercase">Hết hàng</p>
                        <p className={`text-2xl font-bold mt-1 ${outCount > 0 ? 'text-danger-600' : 'text-surface-800'}`}>{outCount}</p>
                    </div>
                </div>
            )}

            {/* Filters */}
            {selectedWarehouseId && (
                <div className="bg-white rounded-2xl border border-surface-200 shadow-sm p-4">
                    <div className="flex flex-col sm:flex-row gap-3">
                        <div className="relative flex-1">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-surface-400" />
                            <input value={search} onChange={e => setSearch(e.target.value)}
                                placeholder="Tìm theo tên, mã vạch..."
                                className="w-full pl-9 bg-surface-50 border border-surface-200 rounded-lg p-2.5 text-sm outline-none focus:ring-2 focus:ring-success-300" />
                        </div>
                        <div className="flex gap-2">
                            {[
                                { key: 'all', label: 'Tất cả' },
                                { key: 'low', label: `Sắp hết (${lowCount})` },
                                { key: 'out', label: `Hết hàng (${outCount})` },
                            ].map(f => (
                                <button key={f.key} onClick={() => setFilter(f.key as any)}
                                    className={`px-3 py-2 rounded-lg text-xs font-bold transition-colors whitespace-nowrap ${filter === f.key
                                        ? 'bg-success-600 text-white'
                                        : 'bg-surface-100 text-surface-600 hover:bg-surface-200'
                                        }`}>{f.label}</button>
                            ))}
                        </div>
                    </div>
                </div>
            )}

            {/* No warehouse selected */}
            {!selectedWarehouseId && !warehousesLoading && (
                <div className="bg-white rounded-2xl border border-surface-200 shadow-sm text-center py-16 space-y-2">
                    <Warehouse className="w-10 h-10 text-surface-300 mx-auto" />
                    <p className="text-sm text-surface-400 font-medium">Chưa có kho nào trong hệ thống</p>
                </div>
            )}

            {/* Stock Table */}
            {selectedWarehouseId && (
                <div className="bg-white rounded-2xl border border-surface-200 shadow-sm overflow-hidden">
                    {loading ? (
                        <div className="flex justify-center py-12"><div className="w-6 h-6 border-4 border-surface-300 border-t-surface-700 rounded-full animate-spin" /></div>
                    ) : filtered.length === 0 ? (
                        <div className="text-center py-12 space-y-2">
                            <Package className="w-8 h-8 text-surface-300 mx-auto" />
                            <p className="text-sm text-surface-400">Không có sản phẩm nào</p>
                        </div>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm">
                                <thead>
                                    <tr className="text-left text-xs text-surface-500 uppercase bg-surface-50 border-b">
                                        <th className="px-4 py-3">Sản phẩm</th>
                                        <th className="px-4 py-3">Mã</th>
                                        <th className="px-4 py-3">ĐVT</th>
                                        <th className="px-4 py-3 text-right">Tồn kho</th>
                                        <th className="px-4 py-3 text-right">Tối thiểu</th>
                                        <th className="px-4 py-3">Trạng thái</th>
                                        <th className="px-4 py-3 text-right">Giá trị</th>
                                        <th className="px-4 py-3 text-right">Cập nhật</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {filtered.map(r => (
                                        <tr key={r.id} className={`border-b border-surface-100 ${r.isOutOfStock ? 'bg-danger-50/60' : r.isLowStock ? 'bg-warning-50/60' : 'hover:bg-surface-50/50'}`}>
                                            <td className="px-4 py-3">
                                                <div className="flex items-center gap-3">
                                                    {r.image ? (
                                                        <img src={r.image} alt="" className="w-8 h-8 rounded-lg object-cover border border-surface-200" />
                                                    ) : (
                                                        <div className="w-8 h-8 rounded-lg bg-surface-100 flex items-center justify-center"><Package className="w-4 h-4 text-surface-400" /></div>
                                                    )}
                                                    <span className="font-medium text-surface-700">{r.name}</span>
                                                </div>
                                            </td>
                                            <td className="px-4 py-3 text-surface-500 font-mono text-xs">{r.companyCode || r.barcode || '—'}</td>
                                            <td className="px-4 py-3 text-surface-500">{r.unit}</td>
                                            <td className="px-4 py-3 text-right">
                                                <span className={`text-lg font-bold ${r.isOutOfStock ? 'text-danger-600' : r.isLowStock ? 'text-warning-600' : 'text-surface-800'}`}>
                                                    {r.currentStock}
                                                </span>
                                            </td>
                                            <td className="px-4 py-3 text-right text-surface-400">{r.minStock}</td>
                                            <td className="px-4 py-3">
                                                {r.isOutOfStock ? (
                                                    <span className="inline-flex items-center gap-1 text-[10px] font-bold text-danger-600 bg-danger-100 border border-danger-200 px-2 py-0.5 rounded">
                                                        <AlertTriangle className="w-3 h-3" /> Hết hàng
                                                    </span>
                                                ) : r.isLowStock ? (
                                                    <span className="inline-flex items-center gap-1 text-[10px] font-bold text-warning-600 bg-warning-100 border border-warning-200 px-2 py-0.5 rounded">
                                                        <AlertTriangle className="w-3 h-3" /> Sắp hết
                                                    </span>
                                                ) : (
                                                    <span className="text-[10px] font-bold text-success-600 bg-success-50 border border-success-200 px-2 py-0.5 rounded">Đủ hàng</span>
                                                )}
                                            </td>
                                            <td className="px-4 py-3 text-right font-medium text-surface-600">{(r.currentStock * r.invoicePrice).toLocaleString('vi-VN')}đ</td>
                                            <td className="px-4 py-3 text-right text-xs text-surface-400 whitespace-nowrap">
                                                {r.lastUpdated ? new Date(r.lastUpdated).toLocaleString('vi-VN') : '—'}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
