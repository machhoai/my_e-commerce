'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { BarChart3, AlertTriangle, Package, LayoutGrid } from 'lucide-react';
import type { ProductDoc, InventoryBalanceDoc } from '@/types/inventory';
import type { StoreDoc, CounterDoc } from '@/types';
import { DashboardHeader } from '@/components/inventory/overview/DashboardHeader';
import { KPICards } from '@/components/inventory/overview/KPICards';
import { InventoryCharts } from '@/components/inventory/overview/InventoryCharts';
import { ProductGrid } from '@/components/inventory/overview/ProductGrid';
import type { MergedProduct } from '@/app/(dashboard)/admin/inventory/overview/page';

// ── Shared Component Mappers ─────────────────────────────────────
function mapCounterBalancesToMerged(balances: InventoryBalanceDoc[], products: ProductDoc[]): MergedProduct[] {
    return products.filter(p => p.isActive).map(p => {
        const balance = balances.find(b => b.productId === p.id);
        const currentStock = balance?.currentStock ?? 0;
        const stockStatus: 'safe' | 'low' | 'out' =
            currentStock <= 0 ? 'out'
                : currentStock <= (p.minStock || 0) ? 'low'
                    : 'safe';
        return { ...p, currentStock, stockStatus };
    });
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

    // Overview pivot state & mapped state
    const [overviewLoading, setOverviewLoading] = useState(false);
    const [mergedOverviewData, setMergedOverviewData] = useState<MergedProduct[]>([]);


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
                setProducts(Array.isArray(data) ? data.filter((p: ProductDoc) => p.isActive !== false) : []);
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

            // To get categories directly from the products array 
            const categories = [...new Set(products.map(p => p.category).filter(Boolean))].sort();

            setMergedOverviewData(mapCounterBalancesToMerged(
                // We fake an overview balance by adding total for all balances. This replaces the complex pivot table mapping
                storeBalances.concat(Object.values(counterBalancesMap).flat()).reduce((acc, curr) => {
                    const existing = acc.find(a => a.productId === curr.productId);
                    if (existing) {
                        existing.currentStock += curr.currentStock;
                    } else {
                        acc.push({ ...curr });
                    }
                    return acc;
                }, [] as InventoryBalanceDoc[]),
                products
            ));
        } catch (err) {
            console.error('Overview fetch error:', err);
            setMergedOverviewData([]);
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

    const titleChildren = (
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 w-full">
            <div>
                <h1 className="text-2xl font-bold bg-gradient-to-r from-teal-600 to-cyan-600 bg-clip-text text-transparent flex items-center gap-2">
                    <BarChart3 className="w-7 h-7 text-teal-600" />
                    Tồn kho theo Quầy
                </h1>
                <p className="text-surface-500 mt-1 text-sm">Xem tổng quan tồn kho toàn cửa hàng hoặc theo từng quầy.</p>
            </div>
        </div>
    )

    return (
        <div className="space-y-6 mx-auto">
            <DashboardHeader
                type="store"
                warehouses={stores}
                selectedWarehouseId={selectedStoreId}
                onWarehouseChange={setSelectedStoreId}
                titleChildren={titleChildren}
                showSelect={isAdmin}
            />


            {/* Tabs: Overview + per-counter */}
            {effectiveStoreId && (
                <div className="flex gap-2 overflow-x-auto pb-1">
                    {/* Overview tab */}
                    <button
                        onClick={() => setSelectedTab(OVERVIEW_TAB)}
                        className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-bold whitespace-nowrap transition-all ${selectedTab === OVERVIEW_TAB
                            ? 'bg-accent-600 text-white shadow-md shadow-accent-500/20'
                            : 'bg-white text-surface-600 border border-surface-200 hover:border-accent-300 hover:bg-accent-50'
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
                                : 'bg-white text-surface-600 border border-surface-200 hover:border-teal-300 hover:bg-teal-50'
                                }`}>
                            {c.name}
                        </button>
                    ))}
                </div>
            )}

            {!counters.length && effectiveStoreId && (
                <div className="bg-warning-50 text-warning-700 border border-warning-200 rounded-xl p-4 text-sm flex items-center gap-2">
                    <AlertTriangle className="w-5 h-5 shrink-0" />
                    Cửa hàng chưa có quầy nào được kích hoạt. Vui lòng cấu hình trong Cài đặt.
                </div>
            )}

            {!effectiveStoreId && (
                <div className="bg-surface-50 text-surface-500 border border-surface-200 rounded-xl p-8 text-sm text-center">
                    Chọn cửa hàng để xem tồn kho
                </div>
            )}

            {/* Overview or per-counter content */}
            {effectiveStoreId && !overviewLoading && !counterLoading && (
                <div className="mt-4 animate-in fade-in duration-500">
                    {(() => {
                        const data = selectedTab === OVERVIEW_TAB
                            ? mergedOverviewData
                            : mapCounterBalancesToMerged(counterBalances, products);

                        const totalValue = data.reduce((s, p) => s + p.currentStock * p.invoicePrice, 0);
                        const lowCount = data.filter(p => p.stockStatus === 'low').length;
                        const outCount = data.filter(p => p.stockStatus === 'out').length;
                        const categories = [...new Set(products.map(p => p.category).filter(Boolean))].sort();

                        return (
                            <div className="space-y-4">
                                <KPICards
                                    merged={data}
                                    totalValue={totalValue}
                                    lowCount={lowCount}
                                    outCount={outCount}
                                />
                                {data.length > 0 && (
                                    <>
                                        <div className="mt-2">
                                            <InventoryCharts merged={data} />
                                        </div>
                                        <div className="mt-6">
                                            <ProductGrid merged={data} categories={categories} />
                                        </div>
                                    </>
                                )}
                            </div>
                        );
                    })()}
                </div>
            )}

            {/* Loading State Overlay */}
            {(overviewLoading || counterLoading) && (
                <div className="flex flex-col items-center justify-center py-20 gap-3 bg-white rounded-2xl border border-surface-200 mt-4">
                    <div className="w-8 h-8 border-4 border-success-500 border-t-transparent rounded-full animate-spin" />
                    <p className="text-surface-400 text-sm">Đang tải dữ liệu tồn kho...</p>
                </div>
            )}
        </div>
    );
}
