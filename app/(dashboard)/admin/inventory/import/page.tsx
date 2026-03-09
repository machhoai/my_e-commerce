'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { useAuth } from '@/contexts/AuthContext';
import {
    Package, Search, Download, X, Plus, Minus,
    Trash2, Send, CheckCircle2, AlertCircle, SlidersHorizontal,
    ChevronDown, Truck, Building, Warehouse,
} from 'lucide-react';
import type { ProductDoc, InventoryBalanceDoc } from '@/types/inventory';
import type { WarehouseDoc } from '@/types';

// ── Types ──────────────────────────────────────────────────────────
interface MergedProduct extends ProductDoc {
    currentStock: number;
    stockStatus: 'safe' | 'low' | 'out';
}

interface BatchItem {
    productId: string;
    productName: string;
    companyCode: string;
    barcode: string;
    unit: string;
    image: string;
    importQty: number;
    importPrice: number; // actual import price for this batch
}

// ── Product Card ───────────────────────────────────────────────────
function ImportProductCard({
    product, inBatch, onAdd,
}: {
    product: MergedProduct;
    inBatch: boolean;
    onAdd: (p: MergedProduct) => void;
}) {
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
                {inBatch && (
                    <div className="absolute top-2 left-2 bg-blue-600 text-white text-[10px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1">
                        <Download className="w-2.5 h-2.5" /> Trong lô
                    </div>
                )}
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

                {/* Add to batch button */}
                <button
                    onClick={() => onAdd(product)}
                    className={`w-full py-2 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-all ${inBatch
                        ? 'bg-blue-100 text-blue-700 border border-blue-200 hover:bg-blue-200'
                        : 'bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-700 hover:to-cyan-700 text-white shadow-sm shadow-blue-500/20'
                        }`}
                >
                    <Download className="w-3.5 h-3.5" />
                    {inBatch ? 'Đã có trong lô' : 'Thêm vào lô nhập'}
                </button>
            </div>
        </div>
    );
}

// ── Import Batch Drawer ────────────────────────────────────────────
function ImportBatchDrawer({
    open, onClose, batch, supplier, onSupplierChange,
    onUpdateQty, onUpdatePrice, onRemove, onSubmit, submitting, message,
}: {
    open: boolean;
    onClose: () => void;
    batch: BatchItem[];
    supplier: string;
    onSupplierChange: (v: string) => void;
    onUpdateQty: (productId: string, qty: number) => void;
    onUpdatePrice: (productId: string, price: number) => void;
    onRemove: (productId: string) => void;
    onSubmit: () => void;
    submitting: boolean;
    message: { type: string; text: string };
}) {
    const [mounted, setMounted] = useState(false);
    useEffect(() => { setMounted(true); }, []);

    const totalQty = batch.reduce((s, i) => s + i.importQty, 0);
    const totalValue = batch.reduce((s, i) => s + i.importQty * i.importPrice, 0);

    const drawerContent = (
        <>
            {open && <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-[105]" onClick={onClose} />}
            <div className={`fixed inset-y-0 top-0 right-0 w-full max-w-md bg-white shadow-2xl z-[110] flex flex-col transition-transform duration-300 ${open ? 'translate-x-0' : 'translate-x-full'}`}>
                {/* Header */}
                <div className="p-5 border-b border-slate-100 flex items-center justify-between bg-gradient-to-r from-blue-600 to-cyan-600 text-white">
                    <div className="flex items-center gap-2">
                        <Truck className="w-5 h-5" />
                        <h2 className="font-bold text-lg">Lô nhập kho</h2>
                        {batch.length > 0 && <span className="bg-white/20 text-white text-xs font-bold px-2 py-0.5 rounded-full">{batch.length}</span>}
                    </div>
                    <button onClick={onClose} className="text-white/70 hover:text-white transition-colors">
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Supplier input */}
                <div className="px-5 py-3 border-b border-slate-100 bg-slate-50">
                    <label className="text-xs font-bold text-slate-600 flex items-center gap-1.5 mb-1.5">
                        <Building className="w-3.5 h-3.5" /> Nhà cung cấp
                    </label>
                    <input
                        value={supplier} onChange={e => onSupplierChange(e.target.value)}
                        placeholder="VD: Công ty ABC, NCC Đại Phát..."
                        className="w-full bg-white border border-slate-200 rounded-xl p-2.5 text-sm outline-none focus:ring-2 focus:ring-blue-300"
                    />
                </div>

                {/* Items */}
                <div className="flex-1 overflow-y-auto p-4 space-y-3">
                    {batch.length === 0 ? (
                        <div className="flex flex-col items-center justify-center h-full space-y-3 text-slate-400">
                            <Download className="w-12 h-12 opacity-20" />
                            <p className="text-sm">Lô nhập trống</p>
                            <p className="text-xs text-center">Thêm sản phẩm từ bảng hàng để bắt đầu nhập kho</p>
                        </div>
                    ) : (
                        batch.map(item => (
                            <div key={item.productId} className="bg-slate-50 rounded-2xl p-3 border border-slate-200">
                                <div className="flex items-center gap-3 mb-3">
                                    <div className="w-10 h-10 rounded-xl bg-slate-200 overflow-hidden shrink-0">
                                        {item.image ? (
                                            <img src={item.image} alt="" className="w-full h-full object-cover" />
                                        ) : (
                                            <div className="w-full h-full flex items-center justify-center">
                                                <Package className="w-5 h-5 text-slate-400" />
                                            </div>
                                        )}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <p className="font-semibold text-slate-800 text-sm truncate">{item.companyCode || item.barcode}</p>
                                        <p className="text-xs text-slate-400 truncate">{item.productName}</p>
                                    </div>
                                    <button onClick={() => onRemove(item.productId)} className="text-slate-400 hover:text-red-500 p-1 rounded-lg transition-colors shrink-0">
                                        <Trash2 className="w-3.5 h-3.5" />
                                    </button>
                                </div>

                                {/* Qty + Price row */}
                                <div className="grid grid-cols-2 gap-2">
                                    <div>
                                        <p className="text-[10px] text-slate-500 font-medium mb-1">Số lượng nhập</p>
                                        <div className="flex items-center gap-1">
                                            <button
                                                onClick={() => onUpdateQty(item.productId, item.importQty - 1)}
                                                className="w-7 h-7 rounded-lg bg-slate-200 hover:bg-slate-300 flex items-center justify-center transition-colors"
                                            >
                                                <Minus className="w-3 h-3 text-slate-600" />
                                            </button>
                                            <input
                                                type="number" min={1}
                                                value={item.importQty}
                                                onChange={e => onUpdateQty(item.productId, Number(e.target.value) || 1)}
                                                className="w-12 text-center text-sm font-bold bg-white border border-slate-200 rounded-lg py-1 outline-none focus:ring-2 focus:ring-blue-200"
                                            />
                                            <button
                                                onClick={() => onUpdateQty(item.productId, item.importQty + 1)}
                                                className="w-7 h-7 rounded-lg bg-slate-200 hover:bg-slate-300 flex items-center justify-center transition-colors"
                                            >
                                                <Plus className="w-3 h-3 text-slate-600" />
                                            </button>
                                        </div>
                                    </div>
                                    <div>
                                        <p className="text-[10px] text-slate-500 font-medium mb-1">Giá nhập (đ)</p>
                                        <input
                                            type="number" min={0}
                                            value={item.importPrice}
                                            onChange={e => onUpdatePrice(item.productId, Number(e.target.value) || 0)}
                                            className="w-full text-sm font-bold bg-white border border-slate-200 rounded-lg p-1.5 outline-none focus:ring-2 focus:ring-blue-200"
                                        />
                                    </div>
                                </div>

                                <p className="text-right text-xs text-slate-500 mt-2">
                                    Thành tiền: <span className="font-bold text-slate-700">{(item.importQty * item.importPrice).toLocaleString('vi-VN')}đ</span>
                                </p>
                            </div>
                        ))
                    )}
                </div>

                {/* Footer */}
                {batch.length > 0 && (
                    <div className="p-4 border-t border-slate-100 bg-slate-50 space-y-3">
                        {message.text && (
                            <div className={`p-3 rounded-xl flex items-start gap-2 text-sm border ${message.type === 'error' ? 'bg-red-50 text-red-700 border-red-200' : 'bg-emerald-50 text-emerald-700 border-emerald-200'}`}>
                                {message.type === 'error' ? <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" /> : <CheckCircle2 className="w-4 h-4 mt-0.5 shrink-0" />}
                                <span>{message.text}</span>
                            </div>
                        )}
                        <div className="flex justify-between text-sm text-slate-600 px-1">
                            <span>{batch.length} sản phẩm — {totalQty} đơn vị</span>
                            <span className="font-bold text-slate-800">{totalValue.toLocaleString('vi-VN')}đ</span>
                        </div>
                        <button
                            onClick={onSubmit} disabled={submitting}
                            className="w-full bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-700 hover:to-cyan-700 text-white py-3 rounded-xl font-bold text-sm flex items-center justify-center gap-2 transition-all disabled:opacity-50 shadow-md shadow-blue-500/20"
                        >
                            {submitting ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> : <Send className="w-4 h-4" />}
                            Xác nhận nhập kho
                        </button>
                    </div>
                )}
            </div>
        </>
    );

    return mounted ? createPortal(drawerContent, document.body) : null;
}

// ── Main Page ──────────────────────────────────────────────────────
export default function CentralImportPage() {
    const { user, userDoc } = useAuth();
    const [products, setProducts] = useState<ProductDoc[]>([]);
    const [balances, setBalances] = useState<InventoryBalanceDoc[]>([]);
    const [loading, setLoading] = useState(true);
    const [drawerOpen, setDrawerOpen] = useState(false);

    // Batch state
    const [batch, setBatch] = useState<BatchItem[]>([]);
    const [supplier, setSupplier] = useState('');
    const [submitting, setSubmitting] = useState(false);
    const [message, setMessage] = useState({ type: '', text: '' });

    // Filters
    const [search, setSearch] = useState('');
    const [filterStatus, setFilterStatus] = useState<'all' | 'safe' | 'low' | 'out'>('all');
    const [filterCategory, setFilterCategory] = useState('');
    const [sortBy, setSortBy] = useState<'name' | 'stock_asc' | 'stock_desc'>('stock_asc');
    const [showFilters, setShowFilters] = useState(false);

    // Warehouse
    const [warehouses, setWarehouses] = useState<WarehouseDoc[]>([]);
    const [selectedWarehouseId, setSelectedWarehouseId] = useState('');

    const getToken = useCallback(() => user?.getIdToken(), [user]);

    // Fetch warehouses
    useEffect(() => {
        if (!user) return;
        (async () => {
            try {
                const token = await getToken();
                const res = await fetch('/api/warehouses', { headers: { Authorization: `Bearer ${token}` } });
                const data = await res.json();
                const list: WarehouseDoc[] = Array.isArray(data) ? data.filter((w: WarehouseDoc) => w.isActive) : [];
                setWarehouses(list);
                if (list.length > 0 && !selectedWarehouseId) {
                    setSelectedWarehouseId(list[0].id);
                }
            } catch { /* silent */ }
        })();
    }, [user, getToken]);

    // Fetch balances for selected warehouse
    useEffect(() => {
        if (!user || !selectedWarehouseId) return;
        setLoading(true);
        (async () => {
            try {
                const token = await getToken();
                const [prodRes, balRes] = await Promise.all([
                    fetch('/api/inventory/products?all=true', { headers: { Authorization: `Bearer ${token}` } }),
                    fetch(`/api/inventory/balances?locationType=CENTRAL&locationId=${selectedWarehouseId}`, { headers: { Authorization: `Bearer ${token}` } }),
                ]);
                const [prodData, balData] = await Promise.all([prodRes.json(), balRes.json()]);
                setProducts(Array.isArray(prodData) ? prodData : []);
                setBalances(Array.isArray(balData) ? balData : []);
            } catch { /* silent */ } finally { setLoading(false); }
        })();
    }, [user, getToken, selectedWarehouseId]);

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
    const lowCount = merged.filter(p => p.stockStatus === 'low').length;
    const outCount = merged.filter(p => p.stockStatus === 'out').length;

    const handleAddToBatch = (product: MergedProduct) => {
        setBatch(prev => {
            if (prev.find(i => i.productId === product.id)) return prev;
            return [...prev, {
                productId: product.id,
                productName: product.name,
                unit: product.unit,
                image: product.image,
                companyCode: product.companyCode,
                barcode: product.barcode,
                importQty: 1,
                importPrice: product.invoicePrice,
            }];
        });
        setDrawerOpen(true);
    };

    const handleUpdateQty = (productId: string, qty: number) => {
        if (qty <= 0) return;
        setBatch(prev => prev.map(i => i.productId === productId ? { ...i, importQty: qty } : i));
    };

    const handleUpdatePrice = (productId: string, price: number) => {
        setBatch(prev => prev.map(i => i.productId === productId ? { ...i, importPrice: price } : i));
    };

    const handleRemove = (productId: string) => {
        setBatch(prev => prev.filter(i => i.productId !== productId));
    };

    const handleSubmit = async () => {
        if (!batch.length) {
            setMessage({ type: 'error', text: 'Vui lòng thêm sản phẩm vào lô nhập' });
            return;
        }
        setSubmitting(true);
        setMessage({ type: '', text: '' });
        try {
            const token = await getToken();
            const res = await fetch('/api/inventory/import', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
                body: JSON.stringify({
                    items: batch.map(i => ({
                        productId: i.productId,
                        productName: i.productName,
                        quantity: i.importQty,
                    })),
                    warehouseId: selectedWarehouseId,
                    note: supplier ? `Nhập kho từ NCC: ${supplier}` : 'Nhập kho',
                }),
            });
            if (!res.ok) throw new Error((await res.json()).error);
            const data = await res.json();
            setMessage({ type: 'success', text: `Nhập kho thành công! Mã lô: ${data.batchId}` });
            setBatch([]);
            setSupplier('');
            // Refresh balances
            const balRes = await fetch(`/api/inventory/balances?locationType=CENTRAL&locationId=${selectedWarehouseId}`, {
                headers: { Authorization: `Bearer ${token}` },
            });
            const balData = await balRes.json();
            if (Array.isArray(balData)) setBalances(balData);
        } catch (err: unknown) {
            const msg = err instanceof Error ? err.message : 'Có lỗi xảy ra';
            setMessage({ type: 'error', text: msg });
        } finally { setSubmitting(false); }
    };

    if (userDoc && userDoc.role !== 'admin') {
        return <div className="flex items-center justify-center h-64 text-red-500 font-bold">Chỉ quản trị viên.</div>;
    }

    return (
        <div className="space-y-6 mx-auto">
            {/* Header */}
            <div className="flex items-start justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold bg-gradient-to-r from-blue-600 to-cyan-600 bg-clip-text text-transparent flex items-center gap-2">
                        <Download className="w-7 h-7 text-blue-600" />
                        Nhập kho
                    </h1>
                    <p className="text-slate-500 mt-1">Chọn kho và lập lô nhập từ nhà cung cấp.</p>
                </div>
                {batch.length > 0 && (
                    <button
                        onClick={() => setDrawerOpen(true)}
                        className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2.5 rounded-xl font-bold text-sm shadow-md shadow-blue-500/20 transition-all"
                    >
                        <Truck className="w-4 h-4" />
                        <span>Lô nhập ({batch.length})</span>
                    </button>
                )}
            </div>

            {/* Warehouse Selector */}
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4 flex items-center gap-3">
                <Warehouse className="w-5 h-5 text-orange-500" />
                <span className="text-sm font-semibold text-slate-700 shrink-0">Nhập vào kho:</span>
                <select value={selectedWarehouseId} onChange={e => setSelectedWarehouseId(e.target.value)}
                    className="flex-1 bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-sm outline-none focus:ring-2 focus:ring-orange-300">
                    {warehouses.length === 0 && <option value="">Chưa có kho nào</option>}
                    {warehouses.map(w => <option key={w.id} value={w.id}>🏭 {w.name}</option>)}
                </select>
            </div>

            {/* Summary Cards */}
            {!loading && (
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                    {[
                        { label: 'Tổng sản phẩm', value: merged.length, color: 'text-slate-800' },
                        { label: 'Trong lô nhập', value: batch.length, color: 'text-blue-600' },
                        { label: 'Sắp hết hàng', value: lowCount, color: lowCount > 0 ? 'text-amber-600' : 'text-slate-800' },
                        { label: 'Hết hàng', value: outCount, color: outCount > 0 ? 'text-red-600' : 'text-slate-800' },
                    ].map(card => (
                        <div key={card.label} className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4 text-center">
                            <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wide">{card.label}</p>
                            <p className={`text-2xl font-black mt-1 ${card.color}`}>{card.value}</p>
                        </div>
                    ))}
                </div>
            )}

            {/* Toolbar */}
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4">
                <div className="flex items-center gap-3">
                    <div className="relative flex-1">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                        <input
                            value={search} onChange={e => setSearch(e.target.value)}
                            placeholder="Tìm theo tên, mã vạch..."
                            className="w-full pl-9 bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-sm outline-none focus:ring-2 focus:ring-blue-300"
                        />
                    </div>
                    <button
                        onClick={() => setShowFilters(v => !v)}
                        className={`flex items-center gap-1.5 px-3 py-2.5 rounded-xl border text-sm font-medium transition-colors ${showFilters ? 'bg-blue-600 text-white border-blue-600' : 'bg-slate-50 text-slate-600 border-slate-200 hover:border-blue-300'}`}
                    >
                        <SlidersHorizontal className="w-4 h-4" />
                        <span className="hidden sm:inline">Bộ lọc</span>
                    </button>
                    <div className="relative">
                        <select
                            value={sortBy} onChange={e => setSortBy(e.target.value as typeof sortBy)}
                            className="appearance-none pl-3 pr-8 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-blue-300 cursor-pointer"
                        >
                            <option value="stock_asc">Tồn kho thấp ↑</option>
                            <option value="stock_desc">Tồn kho cao ↓</option>
                            <option value="name">Tên A-Z</option>
                        </select>
                        <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 pointer-events-none" />
                    </div>
                </div>

                {showFilters && (
                    <div className="flex flex-wrap gap-2 mt-3 pt-3 border-t border-slate-100">
                        {[
                            { key: 'all', label: `Tất cả (${merged.length})` },
                            { key: 'low', label: `Sắp hết (${lowCount})` },
                            { key: 'out', label: `Hết hàng (${outCount})` },
                        ].map(f => (
                            <button key={f.key} onClick={() => setFilterStatus(f.key as typeof filterStatus)}
                                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors whitespace-nowrap ${filterStatus === f.key ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
                            >{f.label}</button>
                        ))}
                        <div className="w-px bg-slate-200 mx-1" />
                        <button onClick={() => setFilterCategory('')}
                            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors ${!filterCategory ? 'bg-slate-700 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
                        >Mọi danh mục</button>
                        {categories.map(cat => (
                            <button key={cat} onClick={() => setFilterCategory(cat)}
                                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors ${filterCategory === cat ? 'bg-slate-700 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
                            >{cat}</button>
                        ))}
                    </div>
                )}
            </div>

            {/* Product Grid */}
            {loading ? (
                <div className="flex flex-col items-center justify-center py-20 gap-3">
                    <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
                    <p className="text-slate-400 text-sm">Đang tải danh sách sản phẩm...</p>
                </div>
            ) : filtered.length === 0 ? (
                <div className="text-center py-20 space-y-3">
                    <Package className="w-12 h-12 text-slate-300 mx-auto" />
                    <p className="text-slate-400 font-medium">Không tìm thấy sản phẩm nào</p>
                    <button onClick={() => { setSearch(''); setFilterStatus('all'); setFilterCategory(''); }} className="text-sm text-blue-600 hover:underline">Xóa bộ lọc</button>
                </div>
            ) : (
                <>
                    <p className="text-xs text-slate-400 font-medium">Hiển thị {filtered.length} / {merged.length} sản phẩm</p>
                    <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-3">
                        {filtered.map(p => (
                            <ImportProductCard
                                key={p.id}
                                product={p}
                                inBatch={batch.some(i => i.productId === p.id)}
                                onAdd={handleAddToBatch}
                            />
                        ))}
                    </div>
                </>
            )}

            {/* Floating FAB */}
            {batch.length > 0 && (
                <button
                    onClick={() => setDrawerOpen(true)}
                    className="fixed bottom-6 right-6 z-30 bg-gradient-to-r from-blue-600 to-cyan-600 text-white rounded-2xl px-5 py-3.5 shadow-xl shadow-blue-500/30 flex items-center gap-3 hover:shadow-2xl hover:from-blue-700 hover:to-cyan-700 transition-all"
                >
                    <Truck className="w-5 h-5" />
                    <span className="font-bold text-sm">Lô nhập kho</span>
                    <span className="bg-white text-blue-700 font-black text-xs px-2 py-0.5 rounded-full min-w-[22px] text-center">
                        {batch.length}
                    </span>
                </button>
            )}

            {/* Drawer */}
            <ImportBatchDrawer
                open={drawerOpen}
                onClose={() => setDrawerOpen(false)}
                batch={batch}
                supplier={supplier}
                onSupplierChange={setSupplier}
                onUpdateQty={handleUpdateQty}
                onUpdatePrice={handleUpdatePrice}
                onRemove={handleRemove}
                onSubmit={handleSubmit}
                submitting={submitting}
                message={message}
            />
        </div>
    );
}
