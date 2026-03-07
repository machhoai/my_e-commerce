'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import {
    Package, Search, AlertTriangle, SlidersHorizontal,
    ChevronDown, BarChart3, Warehouse,
} from 'lucide-react';
import type { ProductDoc, InventoryBalanceDoc } from '@/types/inventory';
import {
    PieChart, Pie, Cell, Tooltip, ResponsiveContainer,
    BarChart, Bar, XAxis, YAxis, CartesianGrid,
} from 'recharts';

// ── Types ──────────────────────────────────────────────────────────
interface MergedProduct extends ProductDoc {
    currentStock: number;
    stockStatus: 'safe' | 'low' | 'out';
}

// ── Donut: Inventory Health ────────────────────────────────────────
// Color is embedded in each entry so filtering zeros never shifts indices

function InventoryHealthDonut({ data }: { data: MergedProduct[] }) {
    const chartData = useMemo(() => {
        const safe = data.filter(d => d.stockStatus === 'safe').length;
        const low = data.filter(d => d.stockStatus === 'low').length;
        const out = data.filter(d => d.stockStatus === 'out').length;
        return [
            { name: 'An toàn', value: safe, color: '#10b981' },
            { name: 'Sắp hết', value: low, color: '#f59e0b' },
            { name: 'Hết hàng', value: out, color: '#ef4444' },
        ].filter(d => d.value > 0);
    }, [data]);

    return (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
            <h3 className="text-sm font-bold text-slate-700 mb-1">Sức khỏe tồn kho</h3>
            <p className="text-xs text-slate-400 mb-4">{data.length} sản phẩm tại kho tổng</p>
            <div className="flex items-center gap-4">
                <div className="w-28 h-28 shrink-0">
                    <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                            <Pie data={chartData} cx="50%" cy="50%" innerRadius={28} outerRadius={52} dataKey="value" strokeWidth={2}>
                                {chartData.map((entry, i) => <Cell key={i} fill={entry.color} />)}
                            </Pie>
                            <Tooltip formatter={(v, n) => [v, n]} />
                        </PieChart>
                    </ResponsiveContainer>
                </div>
                <div className="space-y-2 flex-1">
                    {[
                        { label: 'An toàn', color: 'bg-emerald-500', count: data.filter(d => d.stockStatus === 'safe').length },
                        { label: 'Sắp hết', color: 'bg-amber-500', count: data.filter(d => d.stockStatus === 'low').length },
                        { label: 'Hết hàng', color: 'bg-red-500', count: data.filter(d => d.stockStatus === 'out').length },
                    ].map(item => (
                        <div key={item.label} className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <div className={`w-2.5 h-2.5 rounded-full ${item.color}`} />
                                <span className="text-xs text-slate-600">{item.label}</span>
                            </div>
                            <span className="text-xs font-bold text-slate-700">{item.count}</span>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}

// ── Bar: Top 5 Critical ────────────────────────────────────────────
function CriticalItemsBar({ data }: { data: MergedProduct[] }) {
    const chartData = useMemo(() => {
        return [...data]
            .sort((a, b) => (a.currentStock - a.minStock) - (b.currentStock - b.minStock))
            .slice(0, 5)
            .map(d => {
                const code = d.companyCode || d.barcode || d.name;
                return {
                    name: code.length > 12 ? code.slice(0, 12) + '…' : code,
                    tồnKho: d.currentStock,
                    tốiThiểu: d.minStock,
                };
            });
    }, [data]);

    return (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
            <h3 className="text-sm font-bold text-slate-700 mb-1">Top 5 sản phẩm cần nhập bổ sung</h3>
            <p className="text-xs text-slate-400 mb-4">Sắp xếp theo mức tồn kho thấp nhất (kho tổng)</p>
            <ResponsiveContainer width="100%" height={160}>
                <BarChart data={chartData} layout="vertical" margin={{ top: 0, right: 12, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f1f5f9" />
                    <XAxis type="number" tick={{ fontSize: 10, fill: '#94a3b8' }} />
                    <YAxis type="category" dataKey="name" tick={{ fontSize: 10, fill: '#475569' }} width={90} />
                    <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid #e2e8f0' }} cursor={{ fill: '#f8fafc' }} />
                    <Bar dataKey="tồnKho" fill="#6366f1" radius={[0, 4, 4, 0]} />
                    <Bar dataKey="tốiThiểu" fill="#fca5a5" radius={[0, 4, 4, 0]} />
                </BarChart>
            </ResponsiveContainer>
        </div>
    );
}

// ── Product Card (read-only) ───────────────────────────────────────
function StockCard({ product }: { product: MergedProduct }) {
    const statusConfig = {
        safe: { bg: 'bg-white', border: 'border-slate-200', text: 'text-emerald-700', label: 'Đủ hàng', badge: 'bg-emerald-100 text-emerald-700 border-emerald-200' },
        low: { bg: 'bg-amber-50', border: 'border-amber-200', text: 'text-amber-700', label: 'Sắp hết', badge: 'bg-amber-100 text-amber-700 border-amber-200' },
        out: { bg: 'bg-red-50', border: 'border-red-200', text: 'text-red-700', label: 'Hết hàng', badge: 'bg-red-100 text-red-700 border-red-200' },
    }[product.stockStatus];

    return (
        <div className={`relative rounded-2xl border overflow-hidden transition-all hover:shadow-md group flex flex-col ${statusConfig.bg} ${statusConfig.border}`}>
            {/* Image */}
            <div className="relative aspect-[4/3] bg-slate-100 overflow-hidden">
                {product.image ? (
                    <img src={product.image} alt={product.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
                ) : (
                    <div className="w-full h-full flex items-center justify-center">
                        <Package className="w-10 h-10 text-slate-300" />
                    </div>
                )}
                <div className="absolute top-2 right-2">
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${statusConfig.badge}`}>
                        {statusConfig.label}
                    </span>
                </div>
            </div>

            {/* Body */}
            <div className="p-3 flex flex-col gap-2 flex-1">
                <div>
                    <p className="font-bold text-slate-800 text-sm leading-tight line-clamp-2">{product.companyCode || product.barcode || '—'}</p>
                    <p className="text-[14px] text-slate-800 mt-0.5 line-clamp-2">{product.name}</p>
                    {product.category && <p className="text-[14px] text-blue-600 mt-0.5">{product.category}</p>}
                </div>

                <div className="flex items-end justify-between mt-auto">
                    <div>
                        <p className="text-[10px] text-slate-400 uppercase tracking-wide">Tồn kho tổng</p>
                        <p className={`text-2xl font-black ${statusConfig.text}`}>
                            {product.currentStock}
                            <span className="text-xs font-normal text-slate-400 ml-1">{product.unit}</span>
                        </p>
                    </div>
                    <div className="text-right">
                        <p className="text-[10px] text-slate-400">Tối thiểu</p>
                        <p className="text-sm font-semibold text-slate-600">{product.minStock}</p>
                    </div>
                </div>

                {product.minStock > 0 && (
                    <div className="w-full bg-slate-100 rounded-full h-1">
                        <div
                            className={`h-1 rounded-full transition-all ${product.stockStatus === 'safe' ? 'bg-emerald-500' : product.stockStatus === 'low' ? 'bg-amber-500' : 'bg-red-500'}`}
                            style={{ width: `${Math.min(100, (product.currentStock / Math.max(product.minStock * 2, 1)) * 100)}%` }}
                        />
                    </div>
                )}

                {/* Value footer */}
                <div className="text-[10px] text-slate-400 border-t border-slate-100 pt-2 flex justify-between">
                    <span>Giá nhập</span>
                    <span className="font-semibold text-slate-600">{product.invoicePrice.toLocaleString('vi-VN')}đ</span>
                </div>
            </div>
        </div>
    );
}

// ── Main Page ──────────────────────────────────────────────────────
export default function CentralOverviewPage() {
    const { user, userDoc } = useAuth();
    const [products, setProducts] = useState<ProductDoc[]>([]);
    const [balances, setBalances] = useState<InventoryBalanceDoc[]>([]);
    const [loading, setLoading] = useState(true);

    // Filters
    const [search, setSearch] = useState('');
    const [filterStatus, setFilterStatus] = useState<'all' | 'safe' | 'low' | 'out'>('all');
    const [filterCategory, setFilterCategory] = useState('');
    const [sortBy, setSortBy] = useState<'name' | 'stock_asc' | 'stock_desc'>('stock_asc');
    const [showFilters, setShowFilters] = useState(false);

    const getToken = useCallback(() => user?.getIdToken(), [user]);

    useEffect(() => {
        if (!user) return;
        setLoading(true);
        (async () => {
            try {
                const token = await getToken();
                const [prodRes, balRes] = await Promise.all([
                    fetch('/api/inventory/products?all=true', { headers: { Authorization: `Bearer ${token}` } }),
                    fetch('/api/inventory/balances?locationType=CENTRAL&locationId=CENTRAL', { headers: { Authorization: `Bearer ${token}` } }),
                ]);
                const [prodData, balData] = await Promise.all([prodRes.json(), balRes.json()]);
                setProducts(Array.isArray(prodData) ? prodData : []);
                setBalances(Array.isArray(balData) ? balData : []);
            } catch { /* silent */ } finally { setLoading(false); }
        })();
    }, [user, getToken]);

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

    // Apply filters + sort
    const filtered = useMemo(() => {
        let rows = merged.filter(p => {
            if (filterStatus !== 'all' && p.stockStatus !== filterStatus) return false;
            if (filterCategory && p.category !== filterCategory) return false;
            if (search) {
                const s = search.toLowerCase();
                return p.name.toLowerCase().includes(s) || p.barcode?.toLowerCase().includes(s) || p.companyCode?.toLowerCase().includes(s);
            }
            return true;
        });
        if (sortBy === 'name') rows = [...rows].sort((a, b) => a.name.localeCompare(b.name));
        else if (sortBy === 'stock_asc') rows = [...rows].sort((a, b) => a.currentStock - b.currentStock);
        else if (sortBy === 'stock_desc') rows = [...rows].sort((a, b) => b.currentStock - a.currentStock);
        return rows;
    }, [merged, search, filterStatus, filterCategory, sortBy]);

    const categories = useMemo(() => [...new Set(products.map(p => p.category).filter(Boolean))].sort(), [products]);
    const totalValue = useMemo(() => merged.reduce((s, p) => s + p.currentStock * p.invoicePrice, 0), [merged]);
    const safeCount = merged.filter(p => p.stockStatus === 'safe').length;
    const lowCount = merged.filter(p => p.stockStatus === 'low').length;
    const outCount = merged.filter(p => p.stockStatus === 'out').length;

    if (userDoc && userDoc.role !== 'admin' && !userDoc.customRoleId) {
        return <div className="flex items-center justify-center h-64 text-red-500 font-bold">Không có quyền truy cập.</div>;
    }

    return (
        <div className="space-y-6 mx-auto">
            {/* Header */}
            <div className="flex items-start justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold bg-gradient-to-r from-emerald-600 to-teal-600 bg-clip-text text-transparent flex items-center gap-2">
                        <Warehouse className="w-7 h-7 text-emerald-600" />
                        Tổng quan Kho tổng
                    </h1>
                    <p className="text-slate-500 mt-1">Theo dõi toàn bộ tồn kho trung tâm theo thời gian thực.</p>
                </div>
            </div>

            {/* Summary KPI Cards */}
            {!loading && (
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                    {[
                        { label: 'Tổng sản phẩm', value: merged.length, color: 'text-slate-800', bg: 'bg-white' },
                        { label: 'Giá trị tồn kho', value: `${totalValue.toLocaleString('vi-VN')}đ`, color: 'text-emerald-600', bg: 'bg-white', small: true },
                        { label: 'Sắp hết hàng', value: lowCount, color: lowCount > 0 ? 'text-amber-600' : 'text-slate-800', bg: lowCount > 0 ? 'bg-amber-50 border-amber-200' : 'bg-white' },
                        { label: 'Hết hàng', value: outCount, color: outCount > 0 ? 'text-red-600' : 'text-slate-800', bg: outCount > 0 ? 'bg-red-50 border-red-200' : 'bg-white' },
                    ].map(card => (
                        <div key={card.label} className={`${card.bg} rounded-2xl border border-slate-200 shadow-sm p-4 text-center`}>
                            <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wide">{card.label}</p>
                            <p className={`font-black mt-1 ${card.color} ${card.small ? 'text-lg' : 'text-2xl'}`}>{card.value}</p>
                        </div>
                    ))}
                </div>
            )}

            {/* Charts */}
            {!loading && merged.length > 0 && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <InventoryHealthDonut data={merged} />
                    <CriticalItemsBar data={merged} />
                </div>
            )}

            {/* Toolbar */}
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4">
                <div className="flex items-center gap-3">
                    {/* Search */}
                    <div className="relative flex-1">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                        <input
                            value={search} onChange={e => setSearch(e.target.value)}
                            placeholder="Tìm theo tên, mã vạch..."
                            className="w-full pl-9 bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-sm outline-none focus:ring-2 focus:ring-emerald-300"
                        />
                    </div>
                    {/* Filter toggle */}
                    <button
                        onClick={() => setShowFilters(v => !v)}
                        className={`flex items-center gap-1.5 px-3 py-2.5 rounded-xl border text-sm font-medium transition-colors ${showFilters ? 'bg-emerald-600 text-white border-emerald-600' : 'bg-slate-50 text-slate-600 border-slate-200 hover:border-emerald-300'}`}
                    >
                        <SlidersHorizontal className="w-4 h-4" />
                        <span className="hidden sm:inline">Bộ lọc</span>
                    </button>
                    {/* Sort */}
                    <div className="relative">
                        <select
                            value={sortBy} onChange={e => setSortBy(e.target.value as typeof sortBy)}
                            className="appearance-none pl-3 pr-8 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-emerald-300 cursor-pointer"
                        >
                            <option value="stock_asc">Tồn kho thấp ↑</option>
                            <option value="stock_desc">Tồn kho cao ↓</option>
                            <option value="name">Tên A-Z</option>
                        </select>
                        <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 pointer-events-none" />
                    </div>
                </div>

                {/* Expanded filter row */}
                {showFilters && (
                    <div className="flex flex-wrap gap-2 mt-3 pt-3 border-t border-slate-100">
                        {/* Status filters */}
                        {[
                            { key: 'all', label: `Tất cả (${merged.length})` },
                            { key: 'safe', label: `An toàn (${safeCount})` },
                            { key: 'low', label: `Sắp hết (${lowCount})` },
                            { key: 'out', label: `Hết hàng (${outCount})` },
                        ].map(f => (
                            <button
                                key={f.key}
                                onClick={() => setFilterStatus(f.key as typeof filterStatus)}
                                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors whitespace-nowrap ${filterStatus === f.key ? 'bg-emerald-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
                            >{f.label}</button>
                        ))}
                        <div className="w-px bg-slate-200 mx-1" />
                        {/* Category filters */}
                        <button
                            onClick={() => setFilterCategory('')}
                            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors ${!filterCategory ? 'bg-slate-700 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
                        >Mọi danh mục</button>
                        {categories.map(cat => (
                            <button
                                key={cat}
                                onClick={() => setFilterCategory(cat)}
                                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors ${filterCategory === cat ? 'bg-slate-700 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
                            >{cat}</button>
                        ))}
                    </div>
                )}
            </div>

            {/* Product Grid */}
            {loading ? (
                <div className="flex flex-col items-center justify-center py-20 gap-3">
                    <div className="w-8 h-8 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin" />
                    <p className="text-slate-400 text-sm">Đang tải dữ liệu kho tổng...</p>
                </div>
            ) : filtered.length === 0 ? (
                <div className="text-center py-20 space-y-3">
                    <Warehouse className="w-12 h-12 text-slate-300 mx-auto" />
                    <p className="text-slate-400 font-medium">Không tìm thấy sản phẩm nào</p>
                    <button onClick={() => { setSearch(''); setFilterStatus('all'); setFilterCategory(''); }} className="text-sm text-emerald-600 hover:underline">Xóa bộ lọc</button>
                </div>
            ) : (
                <>
                    <p className="text-xs text-slate-400 font-medium">Hiển thị {filtered.length} / {merged.length} sản phẩm</p>
                    <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-3">
                        {filtered.map(p => <StockCard key={p.id} product={p} />)}
                    </div>
                </>
            )}
        </div>
    );
}
