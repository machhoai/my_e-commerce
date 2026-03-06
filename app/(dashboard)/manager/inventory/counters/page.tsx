'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { BarChart3, AlertTriangle, Package, LayoutGrid } from 'lucide-react';
import type { ProductDoc, InventoryBalanceDoc } from '@/types/inventory';
import type { StoreDoc, CounterDoc } from '@/types';

// ── Pivot row for the overview table ──────────────────────────
interface PivotRow {
    productId: string;
    productName: string;
    productImage: string;
    unit: string;
    minStock: number;
    storeBalance: number;
    counterBalances: Record<string, number>;
    totalCombined: number;
}

function buildPivot(
    products: ProductDoc[],
    storeBalances: InventoryBalanceDoc[],
    counterBalancesMap: Record<string, InventoryBalanceDoc[]>,
    counters: CounterDoc[]
): PivotRow[] {
    const map = new Map<string, PivotRow>();

    const ensure = (productId: string): PivotRow => {
        if (!map.has(productId)) {
            const p = products.find(x => x.id === productId);
            map.set(productId, {
                productId,
                productName: p?.name || productId,
                productImage: p?.image || '',
                unit: p?.unit || '',
                minStock: p?.minStock ?? 0,
                storeBalance: 0,
                counterBalances: Object.fromEntries(counters.map(c => [c.id, 0])),
                totalCombined: 0,
            });
        }
        return map.get(productId)!;
    };

    for (const b of storeBalances) {
        const row = ensure(b.productId);
        row.storeBalance = b.currentStock;
    }

    for (const [counterId, balances] of Object.entries(counterBalancesMap)) {
        for (const b of balances) {
            const row = ensure(b.productId);
            row.counterBalances[counterId] = b.currentStock;
        }
    }

    for (const row of map.values()) {
        row.totalCombined =
            row.storeBalance + counters.reduce((sum, c) => sum + (row.counterBalances[c.id] || 0), 0);
    }

    return Array.from(map.values())
        .sort((a, b) => a.productName.localeCompare(b.productName));
}

// ── Pivot Table component ──────────────────────────────────────
function PivotTable({ rows, counters }: { rows: PivotRow[]; counters: CounterDoc[] }) {
    if (rows.length === 0) {
        return (
            <div className="text-center py-16 space-y-3">
                <Package className="w-10 h-10 text-slate-200 mx-auto" />
                <p className="text-sm text-slate-400">Chưa có dữ liệu tồn kho</p>
            </div>
        );
    }

    const lowStockCount = rows.filter(r => r.totalCombined <= r.minStock && r.minStock > 0).length;

    return (
        <div className="space-y-3">
            {lowStockCount > 0 && (
                <div className="bg-red-50 text-red-700 border border-red-200 rounded-xl p-3 text-sm flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 shrink-0" />
                    <span><strong>{lowStockCount}</strong> sản phẩm đang ở mức tồn kho thấp trên toàn hệ thống.</span>
                </div>
            )}
            <div className="overflow-x-auto rounded-2xl border border-slate-200 shadow-sm">
                <table className="w-full text-sm border-collapse">
                    <thead>
                        <tr className="bg-slate-50 border-b border-slate-200 text-xs font-bold text-slate-500 uppercase tracking-wide">
                            {/* Sticky product column */}
                            <th className="sticky left-0 z-10 bg-slate-50 px-4 py-3 text-left min-w-[180px] border-r border-slate-200">
                                Sản phẩm
                            </th>
                            {/* Total column — highlighted */}
                            <th className="px-4 py-3 text-right min-w-[90px] bg-indigo-50 text-indigo-600 whitespace-nowrap">
                                Tổng tồn
                            </th>
                            {/* Store column */}
                            <th className="px-4 py-3 text-right min-w-[110px] whitespace-nowrap">
                                Kho CH
                            </th>
                            {/* Dynamic counter columns */}
                            {counters.map(c => (
                                <th key={c.id} className="px-4 py-3 text-right min-w-[110px] whitespace-nowrap">
                                    {c.name}
                                </th>
                            ))}
                        </tr>
                    </thead>
                    <tbody>
                        {rows.map((row, idx) => {
                            const isLow = row.minStock > 0 && row.totalCombined <= row.minStock;
                            return (
                                <tr
                                    key={row.productId}
                                    className={`border-b border-slate-100 transition-colors ${isLow ? 'bg-red-50/50' : idx % 2 === 0 ? 'bg-white' : 'bg-slate-50/40'} hover:bg-indigo-50/30`}
                                >
                                    {/* Sticky product cell */}
                                    <td className={`sticky left-0 z-10 px-4 py-3 border-r border-slate-200 ${isLow ? 'bg-red-50' : idx % 2 === 0 ? 'bg-white' : 'bg-slate-50/60'}`}>
                                        <div className="flex items-center gap-3">
                                            {row.productImage ? (
                                                <img src={row.productImage} alt="" className="w-8 h-8 rounded-lg object-cover border border-slate-200 shrink-0" />
                                            ) : (
                                                <div className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center shrink-0">
                                                    <Package className="w-4 h-4 text-slate-400" />
                                                </div>
                                            )}
                                            <div className="min-w-0">
                                                <p className={`font-medium truncate ${isLow ? 'text-red-700' : 'text-slate-700'}`}>{row.productName}</p>
                                                <p className="text-[10px] text-slate-400">{row.unit}</p>
                                            </div>
                                            {isLow && (
                                                <AlertTriangle className="w-3.5 h-3.5 text-red-500 shrink-0 ml-auto" />
                                            )}
                                        </div>
                                    </td>
                                    {/* Total */}
                                    <td className="px-4 py-3 text-right bg-indigo-50/40">
                                        <span className={`text-base font-bold ${isLow ? 'text-red-600' : 'text-indigo-700'}`}>
                                            {row.totalCombined}
                                        </span>
                                    </td>
                                    {/* Store balance */}
                                    <td className="px-4 py-3 text-right">
                                        <span className={`font-semibold ${row.storeBalance === 0 ? 'text-slate-300' : 'text-slate-700'}`}>
                                            {row.storeBalance}
                                        </span>
                                    </td>
                                    {/* Counter balances */}
                                    {counters.map(c => {
                                        const qty = row.counterBalances[c.id] ?? 0;
                                        return (
                                            <td key={c.id} className="px-4 py-3 text-right">
                                                <span className={`font-semibold ${qty === 0 ? 'text-slate-300' : 'text-slate-700'}`}>
                                                    {qty}
                                                </span>
                                            </td>
                                        );
                                    })}
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>
        </div>
    );
}

// ── Per-counter stock table (original view) ───────────────────
function CounterStockTable({
    balances,
    products,
    loading,
}: {
    balances: InventoryBalanceDoc[];
    products: ProductDoc[];
    loading: boolean;
}) {
    const stockRows = balances.map(b => {
        const product = products.find(p => p.id === b.productId);
        return {
            ...b,
            productName: product?.name || b.productId,
            productImage: product?.image || '',
            unit: product?.unit || '',
            minStock: product?.minStock ?? 0,
            isLowStock: product ? b.currentStock <= (product.minStock || 0) : false,
        };
    }).sort((a, b) => {
        if (a.isLowStock && !b.isLowStock) return -1;
        if (!a.isLowStock && b.isLowStock) return 1;
        return a.productName.localeCompare(b.productName);
    });

    if (loading) return (
        <div className="flex justify-center py-16">
            <div className="w-6 h-6 border-4 border-slate-300 border-t-teal-600 rounded-full animate-spin" />
        </div>
    );

    if (stockRows.length === 0) return (
        <div className="text-center py-12 space-y-2">
            <Package className="w-8 h-8 text-slate-300 mx-auto" />
            <p className="text-sm text-slate-400">Quầy này chưa có hàng tồn kho</p>
        </div>
    );

    const lowCount = stockRows.filter(r => r.isLowStock).length;

    return (
        <div className="space-y-3">
            {lowCount > 0 && (
                <div className="bg-red-50 text-red-700 border border-red-200 rounded-xl p-3 text-sm flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 shrink-0" />
                    <span><strong>{lowCount}</strong> sản phẩm đang thiếu hàng. Cần bổ sung!</span>
                </div>
            )}
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
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
                                                <div className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center">
                                                    <Package className="w-4 h-4 text-slate-400" />
                                                </div>
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
                                                <AlertTriangle className="w-3 h-3" /> Thiếu hàng
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
            </div>
        </div>
    );
}

// ── Main page ──────────────────────────────────────────────────
const OVERVIEW_TAB = '__overview__';

export default function CounterStockDashboard() {
    const { user, userDoc } = useAuth();
    const [products, setProducts] = useState<ProductDoc[]>([]);
    const [counters, setCounters] = useState<CounterDoc[]>([]);
    const [stores, setStores] = useState<StoreDoc[]>([]);
    const [selectedTab, setSelectedTab] = useState<string>(OVERVIEW_TAB);
    const [selectedStoreId, setSelectedStoreId] = useState('');

    // Per-counter view state
    const [counterBalances, setCounterBalances] = useState<InventoryBalanceDoc[]>([]);
    const [counterLoading, setCounterLoading] = useState(false);

    // Overview pivot state
    const [pivotRows, setPivotRows] = useState<PivotRow[]>([]);
    const [overviewLoading, setOverviewLoading] = useState(false);

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

    // Fetch stores (admin only)
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

    // Fetch counters when store changes
    useEffect(() => {
        if (!effectiveStoreId || !user) { setCounters([]); setSelectedTab(OVERVIEW_TAB); return; }
        (async () => {
            try {
                const token = await getToken();
                const res = await fetch(`/api/stores/${effectiveStoreId}/settings`, { headers: { Authorization: `Bearer ${token}` } });
                const data = await res.json();
                const active = (data.counters || []).filter((c: CounterDoc) => c.isActive !== false);
                setCounters(active);
                setSelectedTab(OVERVIEW_TAB);
            } catch { setCounters([]); }
        })();
    }, [user, effectiveStoreId, getToken]);

    // Fetch overview pivot data
    const fetchOverview = useCallback(async () => {
        if (!user || !effectiveStoreId) return;
        setOverviewLoading(true);
        try {
            const token = await getToken();
            // Fetch store balance + all counter balances in parallel
            const [storeRes, ...counterResArray] = await Promise.all([
                fetch(`/api/inventory/balances?locationType=STORE&locationId=${effectiveStoreId}`, {
                    headers: { Authorization: `Bearer ${token}` },
                }),
                ...counters.map(c =>
                    fetch(`/api/inventory/balances?locationType=COUNTER&locationId=${c.id}`, {
                        headers: { Authorization: `Bearer ${token}` },
                    })
                ),
            ]);

            const storeBalances: InventoryBalanceDoc[] = await storeRes.json().catch(() => []);
            const counterBalancesMap: Record<string, InventoryBalanceDoc[]> = {};
            for (let i = 0; i < counters.length; i++) {
                const data = await counterResArray[i].json().catch(() => []);
                counterBalancesMap[counters[i].id] = Array.isArray(data) ? data : [];
            }

            setPivotRows(buildPivot(products, storeBalances, counterBalancesMap, counters));
        } catch (err) {
            console.error('Overview fetch error:', err);
            setPivotRows([]);
        } finally {
            setOverviewLoading(false);
        }
    }, [user, effectiveStoreId, counters, products, getToken]);

    // Fetch per-counter balances
    const fetchCounterBalances = useCallback(async (counterId: string) => {
        if (!user || !counterId) return;
        setCounterLoading(true);
        try {
            const token = await getToken();
            const res = await fetch(`/api/inventory/balances?locationType=COUNTER&locationId=${counterId}`, {
                headers: { Authorization: `Bearer ${token}` },
            });
            const data = await res.json();
            setCounterBalances(Array.isArray(data) ? data : []);
        } catch { setCounterBalances([]); } finally { setCounterLoading(false); }
    }, [user, getToken]);

    // Trigger fetches when tab changes
    useEffect(() => {
        if (selectedTab === OVERVIEW_TAB) {
            if (effectiveStoreId) fetchOverview();
        } else {
            fetchCounterBalances(selectedTab);
        }
    }, [selectedTab, fetchOverview, fetchCounterBalances, effectiveStoreId]);

    return (
        <div className="space-y-6 mx-auto">
            <div>
                <h1 className="text-2xl font-bold bg-gradient-to-r from-teal-600 to-cyan-600 bg-clip-text text-transparent flex items-center gap-2">
                    <BarChart3 className="w-7 h-7 text-teal-600" />
                    Tồn kho theo Quầy
                </h1>
                <p className="text-slate-500 mt-1">Xem tổng quan tồn kho toàn cửa hàng hoặc theo từng quầy.</p>
            </div>

            {/* Admin store selector */}
            {isAdmin && (
                <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4 flex items-center gap-3">
                    <Package className="w-5 h-5 text-indigo-500" />
                    <select value={selectedStoreId} onChange={e => { setSelectedStoreId(e.target.value); setSelectedTab(OVERVIEW_TAB); }}
                        className="flex-1 bg-slate-50 border border-slate-200 rounded-lg p-2 text-sm outline-none focus:ring-2 focus:ring-indigo-300">
                        <option value="">-- Chọn cửa hàng --</option>
                        {stores.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                    </select>
                </div>
            )}

            {/* Tabs: Overview + per-counter */}
            {effectiveStoreId && (
                <div className="flex gap-2 overflow-x-auto pb-1">
                    {/* Overview tab */}
                    <button
                        onClick={() => setSelectedTab(OVERVIEW_TAB)}
                        className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-bold whitespace-nowrap transition-all ${selectedTab === OVERVIEW_TAB
                            ? 'bg-indigo-600 text-white shadow-md shadow-indigo-500/20'
                            : 'bg-white text-slate-600 border border-slate-200 hover:border-indigo-300 hover:bg-indigo-50'
                            }`}
                    >
                        <LayoutGrid className="w-4 h-4" />
                        Tổng quan
                    </button>

                    {/* Counter tabs */}
                    {counters.map(c => (
                        <button key={c.id} onClick={() => setSelectedTab(c.id)}
                            className={`px-4 py-2 rounded-xl text-sm font-bold whitespace-nowrap transition-all ${selectedTab === c.id
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

            {!effectiveStoreId && (
                <div className="bg-slate-50 text-slate-500 border border-slate-200 rounded-xl p-8 text-sm text-center">
                    Chọn cửa hàng để xem tồn kho
                </div>
            )}

            {/* Overview or per-counter content */}
            {effectiveStoreId && (
                <>
                    {selectedTab === OVERVIEW_TAB ? (
                        overviewLoading ? (
                            <div className="flex justify-center py-16">
                                <div className="w-7 h-7 border-4 border-slate-200 border-t-indigo-600 rounded-full animate-spin" />
                            </div>
                        ) : (
                            <PivotTable rows={pivotRows} counters={counters} />
                        )
                    ) : (
                        <CounterStockTable
                            balances={counterBalances}
                            products={products}
                            loading={counterLoading}
                        />
                    )}
                </>
            )}
        </div>
    );
}
