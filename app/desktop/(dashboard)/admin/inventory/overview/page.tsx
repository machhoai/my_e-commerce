'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Warehouse } from 'lucide-react';
import type { ProductDoc, InventoryBalanceDoc } from '@/types/inventory';
import type { WarehouseDoc } from '@/types';

// New Components
import { DashboardHeader } from '@/components/inventory/overview/DashboardHeader';
import { KPICards } from '@/components/inventory/overview/KPICards';
import { InventoryCharts } from '@/components/inventory/overview/InventoryCharts';
import { ProductGrid } from '@/components/inventory/overview/ProductGrid';

// ── Types ──────────────────────────────────────────────────────────
export interface MergedProduct extends ProductDoc {
    currentStock: number;
    stockStatus: 'safe' | 'low' | 'out';
}

// ── Main Page ──────────────────────────────────────────────────────
export default function CentralOverviewPage() {
    const { user, userDoc } = useAuth();
    const [products, setProducts] = useState<ProductDoc[]>([]);
    const [balances, setBalances] = useState<InventoryBalanceDoc[]>([]);
    const [loading, setLoading] = useState(true);

    // Warehouse
    const [warehouses, setWarehouses] = useState<WarehouseDoc[]>([]);
    const [selectedWarehouseId, setSelectedWarehouseId] = useState('ALL'); // 'ALL' = tổng tất cả kho

    const getToken = useCallback(() => user?.getIdToken(), [user]);

    // Fetch warehouses
    useEffect(() => {
        if (!user) return;
        (async () => {
            try {
                const token = await getToken();
                const res = await fetch('/api/warehouses', { headers: { Authorization: `Bearer ${token}` } });
                const data = await res.json();
                setWarehouses(Array.isArray(data) ? data.filter((w: WarehouseDoc) => w.isActive) : []);
            } catch { /* silent */ }
        })();
    }, [user, getToken]);

    // Fetch products + balances
    useEffect(() => {
        if (!user) return;
        setLoading(true);
        (async () => {
            try {
                const token = await getToken();
                const headers = { Authorization: `Bearer ${token}` };

                const prodRes = await fetch('/api/inventory/products?all=true', { headers });
                const prodData = await prodRes.json();
                setProducts(Array.isArray(prodData) ? prodData : []);

                if (selectedWarehouseId === 'ALL') {
                    // Fetch balances for all active warehouses and aggregate
                    const activeWarehouses = warehouses.length > 0 ? warehouses : [];
                    if (activeWarehouses.length === 0) {
                        // Fallback: fetch with old CENTRAL if no warehouses loaded yet
                        const balRes = await fetch('/api/inventory/balances?locationType=CENTRAL&locationId=CENTRAL', { headers });
                        const balData = await balRes.json();
                        setBalances(Array.isArray(balData) ? balData : []);
                    } else {
                        const allBalances = await Promise.all(
                            activeWarehouses.map(async (w) => {
                                const res = await fetch(`/api/inventory/balances?locationType=CENTRAL&locationId=${w.id}`, { headers });
                                const data = await res.json();
                                return Array.isArray(data) ? data as InventoryBalanceDoc[] : [];
                            })
                        );
                        // Aggregate: sum currentStock per productId
                        const aggregated = new Map<string, InventoryBalanceDoc>();
                        for (const warehouseBalances of allBalances) {
                            for (const bal of warehouseBalances) {
                                const existing = aggregated.get(bal.productId);
                                if (existing) {
                                    existing.currentStock += bal.currentStock;
                                    if (bal.lastUpdated > existing.lastUpdated) existing.lastUpdated = bal.lastUpdated;
                                } else {
                                    aggregated.set(bal.productId, { ...bal });
                                }
                            }
                        }
                        setBalances(Array.from(aggregated.values()));
                    }
                } else {
                    const balRes = await fetch(`/api/inventory/balances?locationType=CENTRAL&locationId=${selectedWarehouseId}`, { headers });
                    const balData = await balRes.json();
                    setBalances(Array.isArray(balData) ? balData : []);
                }
            } catch { /* silent */ } finally { setLoading(false); }
        })();
    }, [user, getToken, selectedWarehouseId, warehouses]);

    // Merge products with central balances
    const merged: MergedProduct[] = useMemo(() => {
        return products.filter(p => p.isActive).map(p => {
            const balance = balances.find(b => b.productId === p.id);
            const currentStock = balance?.currentStock ?? 0;
            const stockStatus: 'safe' | 'low' | 'out' =
                currentStock <= 0 ? 'out'
                    : currentStock <= (p.minStock || 0) ? 'low'
                        : 'safe';
            return { ...p, currentStock, stockStatus };
        });
    }, [products, balances]);

    const categories = useMemo(() => [...new Set(products.map(p => p.category).filter(Boolean))].sort(), [products]);
    const totalValue = useMemo(() => merged.reduce((s, p) => s + p.currentStock * p.invoicePrice, 0), [merged]);
    const lowCount = merged.filter(p => p.stockStatus === 'low').length;
    const outCount = merged.filter(p => p.stockStatus === 'out').length;

    if (userDoc && userDoc.role !== 'admin' && !userDoc.customRoleId) {
        return <div className="flex items-center justify-center h-64 text-danger-500 font-bold">Không có quyền truy cập.</div>;
    }

    const titleChildren = (
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 w-full">
            <div>
                <h1 className="text-2xl font-bold tracking-tight text-surface-800 flex items-center gap-2">
                    <Warehouse className="size-6 text-success-600" />
                    Tổng quan Kho tổng
                </h1>
                <p className="text-surface-500 mt-1 text-sm">Theo dõi tồn kho tổng hợp trên hệ thống.</p>
            </div>
        </div>
    );

    return (
        <div className="space-y-4 mx-auto animate-in fade-in duration-500">
            {/* Header / Warehouse Selector */}
            <DashboardHeader
                warehouses={warehouses}
                selectedWarehouseId={selectedWarehouseId}
                onWarehouseChange={setSelectedWarehouseId}
                titleChildren={titleChildren}
            />

            {loading ? (
                <div className="flex flex-col items-center justify-center py-20 gap-3 bg-white rounded-2xl border border-surface-200">
                    <div className="w-8 h-8 border-4 border-success-500 border-t-transparent rounded-full animate-spin" />
                    <p className="text-surface-400 text-sm">Đang tải dữ liệu tổng quan...</p>
                </div>
            ) : (
                <>
                    {/* Primary KPI Summary Row */}
                    <KPICards
                        merged={merged}
                        totalValue={totalValue}
                        lowCount={lowCount}
                        outCount={outCount}
                    />

                    {/* Chart Dashboard Row */}
                    {merged.length > 0 && (
                        <div className="mt-2">
                            <InventoryCharts merged={merged} />
                        </div>
                    )}

                    {/* Data Grid Toolbar & Content */}
                    <div className="mt-6">
                        <ProductGrid merged={merged} categories={categories} />
                    </div>
                </>
            )}
        </div>
    );
}
