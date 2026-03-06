'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { useAuth } from '@/contexts/AuthContext';
import {
    ShoppingCart, Search, AlertTriangle, Package, X, Plus, Minus,
    Trash2, Send, CheckCircle2, AlertCircle, SlidersHorizontal,
    ChevronDown, Pencil, Check, LayoutGrid, List, ClipboardList,
} from 'lucide-react';
import type { ProductDoc, InventoryBalanceDoc, PurchaseOrderDoc } from '@/types/inventory';
import type { StoreDoc } from '@/types';
import {
    PieChart, Pie, Cell, Tooltip, ResponsiveContainer,
    BarChart, Bar, XAxis, YAxis, CartesianGrid,
} from 'recharts';

// ── Types ───────────────────────────────────────────────────────
interface MergedProduct extends ProductDoc {
    currentStoreStock: number;
    stockStatus: 'safe' | 'low' | 'out';
}

interface CartItem {
    productId: string;
    productName: string;
    unit: string;
    image: string;
    requestedQty: number;
}

// ── Donut: Inventory Health ──────────────────────────────────────
const DONUT_COLORS = ['#10b981', '#f59e0b', '#ef4444'];

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

    const total = data.length;

    return (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
            <h3 className="text-sm font-bold text-slate-700 mb-1">Sức khỏe tồn kho</h3>
            <p className="text-xs text-slate-400 mb-4">{total} sản phẩm</p>
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

// ── Bar: Top 5 Critical ──────────────────────────────────────────
function CriticalItemsBar({ data }: { data: MergedProduct[] }) {
    const chartData = useMemo(() => {
        return [...data]
            .sort((a, b) => (a.currentStoreStock - a.minStock) - (b.currentStoreStock - b.minStock))
            .slice(0, 5)
            .map(d => ({
                name: d.name.length > 14 ? d.name.slice(0, 14) + '…' : d.name,
                tồnKho: d.currentStoreStock,
                tốiThiểu: d.minStock,
            }));
    }, [data]);

    return (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
            <h3 className="text-sm font-bold text-slate-700 mb-1">Top 5 sản phẩm cần bổ sung</h3>
            <p className="text-xs text-slate-400 mb-4">Sắp xếp theo mức tồn kho thấp nhất</p>
            <ResponsiveContainer width="100%" height={160}>
                <BarChart data={chartData} layout="vertical" margin={{ top: 0, right: 12, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f1f5f9" />
                    <XAxis type="number" tick={{ fontSize: 10, fill: '#94a3b8' }} />
                    <YAxis type="category" dataKey="name" tick={{ fontSize: 10, fill: '#475569' }} width={90} />
                    <Tooltip
                        contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid #e2e8f0' }}
                        cursor={{ fill: '#f8fafc' }}
                    />
                    <Bar dataKey="tồnKho" fill="#6366f1" radius={[0, 4, 4, 0]} />
                    <Bar dataKey="tốiThiểu" fill="#fca5a5" radius={[0, 4, 4, 0]} />
                </BarChart>
            </ResponsiveContainer>
        </div>
    );
}

// ── Product Card ──────────────────────────────────────────────────
function ProductCard({
    product,
    inCart,
    onAddToCart,
    onUpdateMinStock,
}: {
    product: MergedProduct;
    inCart: boolean;
    onAddToCart: (product: MergedProduct) => void;
    onUpdateMinStock: (productId: string, newMin: number) => void;
}) {
    const [editingMin, setEditingMin] = useState(false);
    const [minValue, setMinValue] = useState(product.minStock);

    const statusConfig = {
        safe: { bg: 'bg-emerald-50', border: 'border-emerald-200', text: 'text-emerald-700', label: 'Đủ hàng', badge: 'bg-emerald-100 text-emerald-700 border-emerald-200' },
        low: { bg: 'bg-amber-50', border: 'border-amber-200', text: 'text-amber-700', label: 'Sắp hết', badge: 'bg-amber-100 text-amber-700 border-amber-200' },
        out: { bg: 'bg-red-50', border: 'border-red-200', text: 'text-red-700', label: 'Hết hàng', badge: 'bg-red-100 text-red-700 border-red-200' },
    }[product.stockStatus];

    const handleSaveMin = () => {
        onUpdateMinStock(product.id, minValue);
        setEditingMin(false);
    };

    return (
        <div className={`relative rounded-2xl border overflow-hidden transition-all hover:shadow-md group flex flex-col ${product.stockStatus !== 'safe' ? `${statusConfig.bg} ${statusConfig.border}` : 'bg-white border-slate-200'}`}>
            {/* Image */}
            <div className="relative aspect-[4/3] bg-slate-100 overflow-hidden">
                {product.image ? (
                    <img src={product.image} alt={product.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
                ) : (
                    <div className="w-full h-full flex items-center justify-center">
                        <Package className="w-10 h-10 text-slate-300" />
                    </div>
                )}
                {/* Status badge */}
                <div className="absolute top-2 right-2">
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${statusConfig.badge}`}>
                        {statusConfig.label}
                    </span>
                </div>
                {/* In cart indicator */}
                {inCart && (
                    <div className="absolute top-2 left-2 bg-indigo-600 text-white text-[10px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1">
                        <ShoppingCart className="w-2.5 h-2.5" /> Đã thêm
                    </div>
                )}
            </div>

            {/* Body */}
            <div className="p-3 flex flex-col gap-2 flex-1">
                <div>
                    <p className="font-bold text-slate-800 text-sm leading-tight line-clamp-2">{product.name}</p>
                    <p className="text-[14px] text-slate-400 font-mono mt-0.5">{product.companyCode || product.barcode || '—'}</p>
                </div>

                {/* Stock display */}
                <div className="flex items-end justify-between mt-auto">
                    <div>
                        <p className="text-[10px] text-slate-400 uppercase tracking-wide">Tồn kho</p>
                        <p className={`text-2xl font-black ${statusConfig.text}`}>
                            {product.currentStoreStock}
                            <span className="text-xs font-normal text-slate-400 ml-1">{product.unit}</span>
                        </p>
                    </div>
                    {/* Min stock — inline edit */}
                    <div className="flex flex-col items-end">
                        <p className="text-[10px] text-slate-400">Tối thiểu</p>
                        {editingMin ? (
                            <div className="flex items-center gap-1 mt-0.5">
                                <input
                                    type="number" min={0}
                                    value={minValue}
                                    onChange={e => setMinValue(Number(e.target.value))}
                                    className="w-14 text-xs text-center border border-indigo-300 rounded-lg p-1 outline-none focus:ring-2 focus:ring-indigo-300 bg-white"
                                    autoFocus
                                />
                                <button onClick={handleSaveMin} className="text-emerald-600 hover:text-emerald-700">
                                    <Check className="w-3.5 h-3.5" />
                                </button>
                                <button onClick={() => setEditingMin(false)} className="text-slate-400 hover:text-slate-600">
                                    <X className="w-3.5 h-3.5" />
                                </button>
                            </div>
                        ) : (
                            <div className="flex items-center gap-1 mt-0.5">
                                <span className="text-sm font-semibold text-slate-600">{product.minStock}</span>
                                <button onClick={() => setEditingMin(true)} className="text-slate-300 hover:text-indigo-500 transition-colors">
                                    <Pencil className="w-3 h-3" />
                                </button>
                            </div>
                        )}
                    </div>
                </div>

                {/* Low stock bar */}
                {product.minStock > 0 && (
                    <div className="w-full bg-slate-100 rounded-full h-1">
                        <div
                            className={`h-1 rounded-full transition-all ${product.stockStatus === 'safe' ? 'bg-emerald-500' : product.stockStatus === 'low' ? 'bg-amber-500' : 'bg-red-500'}`}
                            style={{ width: `${Math.min(100, (product.currentStoreStock / Math.max(product.minStock * 2, 1)) * 100)}%` }}
                        />
                    </div>
                )}

                {/* Add to cart button */}
                <button
                    onClick={() => onAddToCart(product)}
                    className={`w-full py-2 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-all ${inCart
                        ? 'bg-indigo-100 text-indigo-700 border border-indigo-200 hover:bg-indigo-200'
                        : 'bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-700 hover:to-blue-700 text-white shadow-sm shadow-indigo-500/20'
                        }`}
                >
                    <ShoppingCart className="w-3.5 h-3.5" />
                    {inCart ? 'Trong giỏ hàng' : 'Thêm vào giỏ'}
                </button>
            </div>
        </div>
    );
}

// ── Cart Drawer ───────────────────────────────────────────────────
function CartDrawer({
    open,
    onClose,
    cart,
    onUpdateQty,
    onRemove,
    onSubmit,
    submitting,
    message,
}: {
    open: boolean;
    onClose: () => void;
    cart: CartItem[];
    onUpdateQty: (productId: string, qty: number) => void;
    onRemove: (productId: string) => void;
    onSubmit: (note: string) => void;
    submitting: boolean;
    message: { type: string; text: string };
}) {
    const [note, setNote] = useState('');
    const [mounted, setMounted] = useState(false);
    useEffect(() => { setMounted(true); }, []);

    const drawerContent = (
        <>
            {/* Backdrop */}
            {open && <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-[105]" onClick={onClose} />}
            {/* Drawer — always rendered but off-screen when closed so transition works */}
            <div className={`fixed inset-y-0 top-0 right-0 w-full max-w-md bg-white shadow-2xl z-[110] flex flex-col transition-transform duration-300 ${open ? 'translate-x-0' : 'translate-x-full'}`}>
                {/* Header */}
                <div className="p-5 border-b border-slate-100 flex items-center justify-between bg-gradient-to-r from-indigo-600 to-blue-600 text-white">
                    <div className="flex items-center gap-2">
                        <ShoppingCart className="w-5 h-5" />
                        <h2 className="font-bold text-lg">Giỏ hàng</h2>
                        {cart.length > 0 && <span className="bg-white/20 text-white text-xs font-bold px-2 py-0.5 rounded-full">{cart.length}</span>}
                    </div>
                    <button onClick={onClose} className="text-white/70 hover:text-white transition-colors">
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Items */}
                <div className="flex-1 overflow-y-auto p-4 space-y-3">
                    {cart.length === 0 ? (
                        <div className="flex flex-col items-center justify-center h-full space-y-3 text-slate-400">
                            <ShoppingCart className="w-12 h-12 opacity-20" />
                            <p className="text-sm">Giỏ hàng trống</p>
                        </div>
                    ) : (
                        cart.map(item => (
                            <div key={item.productId} className="bg-slate-50 rounded-2xl p-3 border border-slate-200 flex items-center gap-3">
                                {/* Image */}
                                <div className="w-12 h-12 rounded-xl bg-slate-200 overflow-hidden shrink-0">
                                    {item.image ? (
                                        <img src={item.image} alt="" className="w-full h-full object-cover" />
                                    ) : (
                                        <div className="w-full h-full flex items-center justify-center">
                                            <Package className="w-5 h-5 text-slate-400" />
                                        </div>
                                    )}
                                </div>
                                <div className="flex-1 min-w-0">
                                    <p className="font-semibold text-slate-800 text-sm truncate">{item.productName}</p>
                                    <p className="text-xs text-slate-400">{item.unit}</p>
                                </div>
                                {/* Qty stepper */}
                                <div className="flex items-center gap-1.5 shrink-0">
                                    <button
                                        onClick={() => onUpdateQty(item.productId, item.requestedQty - 1)}
                                        className="w-7 h-7 rounded-lg bg-slate-200 hover:bg-slate-300 flex items-center justify-center transition-colors"
                                    >
                                        <Minus className="w-3 h-3 text-slate-600" />
                                    </button>
                                    <input
                                        type="number" min={1}
                                        value={item.requestedQty}
                                        onChange={e => onUpdateQty(item.productId, Number(e.target.value) || 1)}
                                        className="w-10 text-center text-sm font-bold bg-white border border-slate-200 rounded-lg py-1 outline-none"
                                    />
                                    <button
                                        onClick={() => onUpdateQty(item.productId, item.requestedQty + 1)}
                                        className="w-7 h-7 rounded-lg bg-indigo-100 hover:bg-indigo-200 flex items-center justify-center transition-colors"
                                    >
                                        <Plus className="w-3 h-3 text-indigo-600" />
                                    </button>
                                    <button onClick={() => onRemove(item.productId)} className="w-7 h-7 rounded-lg hover:bg-red-100 flex items-center justify-center transition-colors ml-1">
                                        <Trash2 className="w-3.5 h-3.5 text-slate-400 hover:text-red-500" />
                                    </button>
                                </div>
                            </div>
                        ))
                    )}
                </div>

                {/* Footer */}
                {cart.length > 0 && (
                    <div className="p-4 border-t border-slate-100 space-y-3 bg-slate-50">
                        {message.text && (
                            <div className={`p-3 rounded-xl flex items-center gap-2 border text-sm font-medium ${message.type === 'error' ? 'bg-red-50 text-red-700 border-red-200' : 'bg-emerald-50 text-emerald-700 border-emerald-200'}`}>
                                {message.type === 'error' ? <AlertCircle className="w-4 h-4 shrink-0" /> : <CheckCircle2 className="w-4 h-4 shrink-0" />}
                                {message.text}
                            </div>
                        )}
                        <textarea
                            value={note}
                            onChange={e => setNote(e.target.value)}
                            rows={2}
                            placeholder="Ghi chú (tùy chọn)..."
                            className="w-full bg-white border border-slate-200 rounded-xl p-2.5 text-sm outline-none focus:ring-2 focus:ring-indigo-300 resize-none"
                        />
                        <div className="flex items-center justify-between text-sm text-slate-500 mb-1">
                            <span>{cart.length} loại sản phẩm</span>
                            <span className="font-bold text-slate-700">{cart.reduce((s, i) => s + i.requestedQty, 0)} đơn vị</span>
                        </div>
                        <button
                            onClick={() => onSubmit(note)}
                            disabled={submitting}
                            className="w-full bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-700 hover:to-blue-700 text-white py-3.5 rounded-xl font-bold text-sm flex items-center justify-center gap-2 transition-all disabled:opacity-50 shadow-md shadow-indigo-500/20"
                        >
                            {submitting
                                ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                                : <Send className="w-4 h-4" />}
                            Xác nhận đặt hàng
                        </button>
                    </div>
                )}
            </div>
        </>
    );

    if (!mounted) return null;
    return createPortal(drawerContent, document.body);
}

// ── Status badges ─────────────────────────────────────────────────
const STATUS_BADGE: Record<string, string> = {
    PENDING: 'bg-amber-100 text-amber-700 border-amber-200',
    IN_TRANSIT: 'bg-blue-100 text-blue-700 border-blue-200',
    COMPLETED: 'bg-emerald-100 text-emerald-700 border-emerald-200',
    DISPATCHED: 'bg-emerald-100 text-emerald-700 border-emerald-200',
    REJECTED: 'bg-red-100 text-red-700 border-red-200',
};
const STATUS_LABEL: Record<string, string> = {
    PENDING: 'Chờ duyệt',
    IN_TRANSIT: 'Đang vận chuyển',
    COMPLETED: 'Đã nhận hàng',
    DISPATCHED: 'Đã xuất kho',
    REJECTED: 'Từ chối',
};

// ── Main Page ─────────────────────────────────────────────────────
type ActiveTab = 'order' | 'history';

export default function StoreInventoryDashboard() {
    const { user, userDoc } = useAuth();

    // Data
    const [products, setProducts] = useState<ProductDoc[]>([]);
    const [balances, setBalances] = useState<InventoryBalanceDoc[]>([]);
    const [orders, setOrders] = useState<PurchaseOrderDoc[]>([]);
    const [stores, setStores] = useState<StoreDoc[]>([]);
    const [loading, setLoading] = useState(true);

    // UI state
    const [activeTab, setActiveTab] = useState<ActiveTab>('order');
    const [cartOpen, setCartOpen] = useState(false);
    const [cart, setCart] = useState<CartItem[]>([]);
    const [submitting, setSubmitting] = useState(false);
    const [message, setMessage] = useState({ type: '', text: '' });
    const [selectedStoreId, setSelectedStoreId] = useState('');

    // Filters
    const [search, setSearch] = useState('');
    const [filterCategory, setFilterCategory] = useState('');
    const [filterStatus, setFilterStatus] = useState<'all' | 'safe' | 'low' | 'out'>('all');
    const [sortBy, setSortBy] = useState<'name' | 'stockAsc' | 'stockDesc'>('name');
    const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');

    const getToken = useCallback(() => user?.getIdToken(), [user]);
    const isAdmin = userDoc?.role === 'admin';
    const effectiveStoreId = isAdmin ? selectedStoreId : userDoc?.storeId || '';

    // Fetch products + balances + orders in parallel
    const fetchAll = useCallback(async () => {
        if (!user) return;
        setLoading(true);
        try {
            const token = await getToken();
            const headers = { Authorization: `Bearer ${token}` };

            const [prodRes, ordersRes] = await Promise.all([
                fetch('/api/inventory/products', { headers }),
                fetch(effectiveStoreId ? `/api/inventory/orders?storeId=${effectiveStoreId}` : '/api/inventory/orders', { headers }),
            ]);

            const [prodData, ordersData] = await Promise.all([prodRes.json(), ordersRes.json()]);
            setProducts(Array.isArray(prodData) ? prodData.filter((p: ProductDoc) => p.isActive !== false) : []);
            setOrders(Array.isArray(ordersData) ? ordersData : []);

            // Fetch store balance if store selected
            if (effectiveStoreId) {
                const balRes = await fetch(`/api/inventory/balances?locationType=STORE&locationId=${effectiveStoreId}`, { headers });
                const balData = await balRes.json();
                setBalances(Array.isArray(balData) ? balData : []);
            } else {
                setBalances([]);
            }
        } catch (err) {
            console.error(err);
        } finally { setLoading(false); }
    }, [user, effectiveStoreId, getToken]);

    useEffect(() => { fetchAll(); }, [fetchAll]);

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

    // Merge products + balances
    const mergedProducts = useMemo<MergedProduct[]>(() => {
        return products.map(p => {
            const bal = balances.find(b => b.productId === p.id);
            const stock = bal?.currentStock ?? 0;
            const stockStatus: MergedProduct['stockStatus'] =
                stock === 0 ? 'out' : stock <= p.minStock ? 'low' : 'safe';
            return { ...p, currentStoreStock: stock, stockStatus };
        });
    }, [products, balances]);

    // Categories
    const categories = useMemo(() => {
        const cats = [...new Set(products.map(p => p.category).filter(Boolean))];
        return cats.sort();
    }, [products]);

    // Filtered + sorted
    const filteredProducts = useMemo(() => {
        let list = [...mergedProducts];
        if (search) {
            const q = search.toLowerCase();
            list = list.filter(p => p.name.toLowerCase().includes(q) || p.barcode?.toLowerCase().includes(q));
        }
        if (filterCategory) list = list.filter(p => p.category === filterCategory);
        if (filterStatus !== 'all') list = list.filter(p => p.stockStatus === filterStatus);
        if (sortBy === 'name') list.sort((a, b) => a.name.localeCompare(b.name));
        else if (sortBy === 'stockAsc') list.sort((a, b) => a.currentStoreStock - b.currentStoreStock);
        else list.sort((a, b) => b.currentStoreStock - a.currentStoreStock);
        return list;
    }, [mergedProducts, search, filterCategory, filterStatus, sortBy]);

    // Cart actions
    const addToCart = (product: MergedProduct) => {
        setCart(prev => {
            if (prev.find(i => i.productId === product.id)) return prev;
            return [...prev, { productId: product.id, productName: product.name, unit: product.unit, image: product.image, requestedQty: 1 }];
        });
    };

    const updateCartQty = (productId: string, qty: number) => {
        if (qty <= 0) return;
        setCart(prev => prev.map(i => i.productId === productId ? { ...i, requestedQty: qty } : i));
    };

    const removeFromCart = (productId: string) => {
        setCart(prev => prev.filter(i => i.productId !== productId));
    };

    const handleUpdateMinStock = async (productId: string, newMin: number) => {
        // Fire-and-forget update to product minStock
        try {
            const token = await getToken();
            await fetch(`/api/inventory/products/${productId}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
                body: JSON.stringify({ minStock: newMin }),
            });
            setProducts(prev => prev.map(p => p.id === productId ? { ...p, minStock: newMin } : p));
        } catch { /* silent */ }
    };

    const handleSubmitOrder = async (note: string) => {
        if (!cart.length || !effectiveStoreId) {
            setMessage({ type: 'error', text: 'Vui lòng chọn cửa hàng và thêm sản phẩm' });
            return;
        }
        setSubmitting(true);
        setMessage({ type: '', text: '' });
        try {
            const token = await getToken();
            const storeName = isAdmin ? stores.find(s => s.id === effectiveStoreId)?.name || '' : '';
            const res = await fetch('/api/inventory/orders', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
                body: JSON.stringify({
                    storeId: effectiveStoreId,
                    storeName,
                    items: cart.map(i => ({ productId: i.productId, productName: i.productName, unit: i.unit, requestedQty: i.requestedQty })),
                    note,
                }),
            });
            if (!res.ok) throw new Error((await res.json()).error);
            setMessage({ type: 'success', text: 'Đã tạo đơn đặt hàng thành công!' });
            setCart([]);
            // Refresh orders
            fetchAll();
        } catch (err: any) {
            setMessage({ type: 'error', text: err.message || 'Có lỗi xảy ra' });
        } finally { setSubmitting(false); }
    };

    const inCartIds = new Set(cart.map(i => i.productId));
    const outCount = mergedProducts.filter(p => p.stockStatus === 'out').length;
    const lowCount = mergedProducts.filter(p => p.stockStatus === 'low').length;

    return (
        <div className="space-y-5 mx-auto pb-24">
            {/* Header */}
            <div className="flex items-start justify-between">
                <div>
                    <h1 className="text-2xl font-bold bg-gradient-to-r from-indigo-600 to-blue-600 bg-clip-text text-transparent flex items-center gap-2">
                        <LayoutGrid className="w-7 h-7 text-indigo-600" />
                        Kho hàng cửa hàng
                    </h1>
                    <p className="text-slate-500 mt-1 text-sm">Theo dõi tồn kho và đặt hàng từ kho trung tâm.</p>
                </div>
            </div>

            {/* Tabs */}
            <div className="flex gap-1 bg-slate-100 rounded-xl p-1 w-fit">
                <button onClick={() => setActiveTab('order')}
                    className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-bold transition-all ${activeTab === 'order' ? 'bg-white text-indigo-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>
                    <LayoutGrid className="w-4 h-4" /> Hàng hoá
                </button>
                <button onClick={() => setActiveTab('history')}
                    className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-bold transition-all ${activeTab === 'history' ? 'bg-white text-indigo-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>
                    <ClipboardList className="w-4 h-4" /> Lịch sử đặt hàng
                </button>
            </div>

            {/* Admin store selector */}
            {isAdmin && (
                <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4 flex items-center gap-3">
                    <Package className="w-5 h-5 text-indigo-500" />
                    <select value={selectedStoreId} onChange={e => setSelectedStoreId(e.target.value)}
                        className="flex-1 bg-slate-50 border border-slate-200 rounded-lg p-2 text-sm outline-none focus:ring-2 focus:ring-indigo-300">
                        <option value="">-- Chọn cửa hàng --</option>
                        {stores.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                    </select>
                </div>
            )}

            {/* ── ORDER TAB ── */}
            {activeTab === 'order' && (
                <>
                    {/* Alerts */}
                    {(outCount > 0 || lowCount > 0) && effectiveStoreId && (
                        <div className={`p-3 rounded-xl text-sm flex items-center gap-2 border ${outCount > 0 ? 'bg-red-50 text-red-700 border-red-200' : 'bg-amber-50 text-amber-700 border-amber-200'}`}>
                            <AlertTriangle className="w-4 h-4 shrink-0" />
                            <span>
                                {outCount > 0 && <><strong>{outCount}</strong> sản phẩm hết hàng. </>}
                                {lowCount > 0 && <><strong>{lowCount}</strong> sản phẩm sắp hết. </>}
                                Hãy đặt hàng ngay!
                            </span>
                        </div>
                    )}

                    {/* Charts row */}
                    {effectiveStoreId && !loading && mergedProducts.length > 0 && (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <InventoryHealthDonut data={mergedProducts} />
                            <CriticalItemsBar data={mergedProducts} />
                        </div>
                    )}

                    {/* Toolbar */}
                    {effectiveStoreId && (
                        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4 space-y-3">
                            <div className="flex flex-col sm:flex-row gap-3">
                                {/* Search */}
                                <div className="relative flex-1">
                                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                                    <input
                                        type="text"
                                        placeholder="Tìm sản phẩm (tên, mã vạch)..."
                                        value={search}
                                        onChange={e => setSearch(e.target.value)}
                                        className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-indigo-300"
                                    />
                                </div>
                                {/* Category filter */}
                                <div className="relative">
                                    <SlidersHorizontal className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                                    <select value={filterCategory} onChange={e => setFilterCategory(e.target.value)}
                                        className="pl-9 pr-8 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-indigo-300 appearance-none">
                                        <option value="">Tất cả danh mục</option>
                                        {categories.map(c => <option key={c} value={c}>{c}</option>)}
                                    </select>
                                    <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                                </div>
                                {/* Sort */}
                                <div className="relative">
                                    <select value={sortBy} onChange={e => setSortBy(e.target.value as typeof sortBy)}
                                        className="pr-8 pl-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-indigo-300 appearance-none">
                                        <option value="name">Tên A-Z</option>
                                        <option value="stockAsc">Tồn kho thấp → cao</option>
                                        <option value="stockDesc">Tồn kho cao → thấp</option>
                                    </select>
                                    <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                                </div>
                                {/* View toggle */}
                                <div className="flex border border-slate-200 rounded-xl overflow-hidden shrink-0">
                                    <button onClick={() => setViewMode('grid')}
                                        className={`px-3 py-2 ${viewMode === 'grid' ? 'bg-indigo-600 text-white' : 'bg-slate-50 text-slate-500 hover:bg-slate-100'} transition-colors`}>
                                        <LayoutGrid className="w-4 h-4" />
                                    </button>
                                    <button onClick={() => setViewMode('list')}
                                        className={`px-3 py-2 ${viewMode === 'list' ? 'bg-indigo-600 text-white' : 'bg-slate-50 text-slate-500 hover:bg-slate-100'} transition-colors`}>
                                        <List className="w-4 h-4" />
                                    </button>
                                </div>
                            </div>

                            {/* Status filter chips */}
                            <div className="flex gap-2 flex-wrap">
                                {[
                                    { value: 'all', label: 'Tất cả' },
                                    { value: 'safe', label: '✓ An toàn' },
                                    { value: 'low', label: '⚠ Sắp hết' },
                                    { value: 'out', label: '✕ Hết hàng' },
                                ].map(opt => (
                                    <button key={opt.value} onClick={() => setFilterStatus(opt.value as typeof filterStatus)}
                                        className={`px-3 py-1 rounded-full text-xs font-bold border transition-all ${filterStatus === opt.value
                                            ? 'bg-indigo-600 text-white border-indigo-600'
                                            : 'bg-white text-slate-600 border-slate-200 hover:border-indigo-300'
                                            }`}>
                                        {opt.label}
                                    </button>
                                ))}
                                {search || filterCategory || filterStatus !== 'all' ? (
                                    <button onClick={() => { setSearch(''); setFilterCategory(''); setFilterStatus('all'); }}
                                        className="px-3 py-1 rounded-full text-xs font-bold border border-slate-200 text-slate-400 hover:text-red-500 hover:border-red-200 transition-colors flex items-center gap-1">
                                        <X className="w-3 h-3" /> Xóa lọc
                                    </button>
                                ) : null}
                                <span className="ml-auto text-xs text-slate-400 self-center">{filteredProducts.length} / {mergedProducts.length} sản phẩm</span>
                            </div>
                        </div>
                    )}

                    {/* Loading */}
                    {loading && (
                        <div className="flex justify-center py-16">
                            <div className="w-8 h-8 border-4 border-slate-200 border-t-indigo-600 rounded-full animate-spin" />
                        </div>
                    )}

                    {/* No store */}
                    {!effectiveStoreId && !isAdmin && !loading && (
                        <div className="text-center py-16 text-slate-400 text-sm">Tài khoản chưa được gán cửa hàng</div>
                    )}

                    {/* Product Grid */}
                    {effectiveStoreId && !loading && (
                        viewMode === 'grid' ? (
                            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
                                {filteredProducts.map(p => (
                                    <ProductCard key={p.id} product={p} inCart={inCartIds.has(p.id)}
                                        onAddToCart={addToCart} onUpdateMinStock={handleUpdateMinStock} />
                                ))}
                            </div>
                        ) : (
                            /* List view */
                            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                                <div className="overflow-x-auto">
                                    <table className="w-full text-sm">
                                        <thead>
                                            <tr className="text-left text-xs text-slate-500 uppercase bg-slate-50 border-b">
                                                <th className="px-4 py-3">Sản phẩm</th>
                                                <th className="px-4 py-3">Danh mục</th>
                                                <th className="px-4 py-3 text-right">Tồn kho</th>
                                                <th className="px-4 py-3 text-right">Tối thiểu</th>
                                                <th className="px-4 py-3">Trạng thái</th>
                                                <th className="px-4 py-3 text-right">Hành động</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {filteredProducts.map(p => (
                                                <tr key={p.id} className={`border-b border-slate-100 ${p.stockStatus !== 'safe' ? 'bg-red-50/30' : 'hover:bg-slate-50/50'}`}>
                                                    <td className="px-4 py-3">
                                                        <div className="flex items-center gap-3">
                                                            <div className="w-8 h-8 rounded-lg bg-slate-100 overflow-hidden shrink-0">
                                                                {p.image ? <img src={p.image} alt="" className="w-full h-full object-cover" /> : <div className="w-full h-full flex items-center justify-center"><Package className="w-4 h-4 text-slate-300" /></div>}
                                                            </div>
                                                            <div>
                                                                <p className="font-medium text-slate-700">{p.name}</p>
                                                                {p.barcode && <p className="text-xs text-slate-400">{p.barcode}</p>}
                                                            </div>
                                                        </div>
                                                    </td>
                                                    <td className="px-4 py-3 text-slate-500">{p.category || '—'}</td>
                                                    <td className={`px-4 py-3 text-right font-bold text-lg ${p.stockStatus === 'out' ? 'text-red-600' : p.stockStatus === 'low' ? 'text-amber-600' : 'text-slate-800'}`}>{p.currentStoreStock}</td>
                                                    <td className="px-4 py-3 text-right text-slate-400">{p.minStock}</td>
                                                    <td className="px-4 py-3">
                                                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${p.stockStatus === 'safe' ? 'bg-emerald-100 text-emerald-700 border-emerald-200' : p.stockStatus === 'low' ? 'bg-amber-100 text-amber-700 border-amber-200' : 'bg-red-100 text-red-700 border-red-200'}`}>
                                                            {p.stockStatus === 'safe' ? 'An toàn' : p.stockStatus === 'low' ? 'Sắp hết' : 'Hết hàng'}
                                                        </span>
                                                    </td>
                                                    <td className="px-4 py-3 text-right">
                                                        <button onClick={() => addToCart(p)} disabled={inCartIds.has(p.id)}
                                                            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${inCartIds.has(p.id) ? 'bg-indigo-100 text-indigo-700' : 'bg-indigo-600 hover:bg-indigo-700 text-white'}`}>
                                                            {inCartIds.has(p.id) ? 'Đã thêm' : '+ Thêm'}
                                                        </button>
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        )
                    )}
                </>
            )}

            {/* ── HISTORY TAB ── */}
            {activeTab === 'history' && (
                <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                    <div className="p-5 border-b border-slate-100">
                        <h2 className="font-bold text-slate-800">Lịch sử đặt hàng</h2>
                    </div>
                    {loading ? (
                        <div className="flex justify-center py-12"><div className="w-6 h-6 border-4 border-slate-300 border-t-indigo-600 rounded-full animate-spin" /></div>
                    ) : orders.length === 0 ? (
                        <p className="text-sm text-slate-400 text-center py-12">Chưa có đơn đặt hàng nào</p>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm">
                                <thead>
                                    <tr className="text-left text-xs text-slate-500 uppercase bg-slate-50 border-b">
                                        <th className="px-6 py-3">Thời gian</th>
                                        <th className="px-6 py-3">Người tạo</th>
                                        <th className="px-6 py-3">Sản phẩm</th>
                                        <th className="px-6 py-3">Trạng thái</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {orders.map(order => (
                                        <tr key={order.id} className="border-b border-slate-100 hover:bg-slate-50/50">
                                            <td className="px-6 py-3 text-slate-500 whitespace-nowrap">{new Date(order.timestamp).toLocaleString('vi-VN')}</td>
                                            <td className="px-6 py-3 text-slate-700 font-medium">{order.createdByName}</td>
                                            <td className="px-6 py-3 text-slate-600">
                                                <div className="space-y-0.5">
                                                    {order.items.map((item, i) => (
                                                        <div key={i} className="text-xs">
                                                            <span className="text-slate-700">{item.productName}</span>
                                                            <span className="text-slate-400 ml-1">×{item.requestedQty} {item.unit}</span>
                                                            {item.dispatchedQty !== undefined && item.dispatchedQty !== item.requestedQty && (
                                                                <span className="text-emerald-600 ml-1">(xuất: {item.dispatchedQty})</span>
                                                            )}
                                                        </div>
                                                    ))}
                                                </div>
                                            </td>
                                            <td className="px-6 py-3">
                                                <span className={`text-xs font-bold px-2 py-1 rounded border ${STATUS_BADGE[order.status] || ''}`}>
                                                    {STATUS_LABEL[order.status] || order.status}
                                                </span>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            )}

            {/* ── Floating Cart FAB ── */}
            {activeTab === 'order' && effectiveStoreId && (
                <button
                    onClick={() => setCartOpen(true)}
                    className="fixed bottom-6 right-6 z-30 bg-gradient-to-r from-indigo-600 to-blue-600 text-white rounded-2xl px-5 py-3.5 shadow-xl shadow-indigo-500/30 flex items-center gap-3 hover:shadow-2xl hover:from-indigo-700 hover:to-blue-700 transition-all"
                >
                    <ShoppingCart className="w-5 h-5" />
                    <span className="font-bold text-sm">Giỏ hàng</span>
                    {cart.length > 0 && (
                        <span className="bg-white text-indigo-700 font-black text-xs px-2 py-0.5 rounded-full min-w-[22px] text-center">
                            {cart.length}
                        </span>
                    )}
                </button>
            )}

            {/* ── Cart Drawer ── */}
            <CartDrawer
                open={cartOpen}
                onClose={() => setCartOpen(false)}
                cart={cart}
                onUpdateQty={updateCartQty}
                onRemove={removeFromCart}
                onSubmit={handleSubmitOrder}
                submitting={submitting}
                message={message}
            />
        </div>
    );
}
