'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { useAuth } from '@/contexts/AuthContext';
import { ref as storageRef, uploadBytes, getDownloadURL } from 'firebase/storage';
import { storage } from '@/lib/firebase';
import {
    ShoppingCart, Search, AlertTriangle, Package, X, Plus, Minus,
    Trash2, Send, CheckCircle2, SlidersHorizontal,
    ChevronDown, ChevronUp, Pencil, Check, LayoutGrid, List, ClipboardList, XCircle, Warehouse,
} from 'lucide-react';
import { showToast } from '@/lib/utils/toast';
import type { ProductDoc, InventoryBalanceDoc, PurchaseOrderDoc } from '@/types/inventory';
// New Shared Components
import { InventoryCharts } from '@/components/inventory/overview/InventoryCharts';
import { ProductGrid } from '@/components/inventory/overview/ProductGrid';

import type { StoreDoc, WarehouseDoc } from '@/types';
import {
    PieChart, Pie, Cell, Tooltip, ResponsiveContainer,
    BarChart, Bar, XAxis, YAxis, CartesianGrid,
} from 'recharts';

import type { MergedProduct } from '@/app/desktop/(dashboard)/admin/inventory/overview/page';
import { DashboardHeader } from '@/components/inventory/overview/DashboardHeader';
import { OfficeManagedStorePicker } from '@/components/shared/OfficeManagedStorePicker';

// ── Types ───────────────────────────────────────────────────────

interface CartItem {
    productId: string;
    productCode?: string;
    productName: string;
    unit: string;
    image: string;
    requestedQty: number;
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
    warehouses,
    selectedWarehouseId,
    onWarehouseChange,
}: {
    open: boolean;
    onClose: () => void;
    cart: CartItem[];
    onUpdateQty: (productId: string, qty: number) => void;
    onRemove: (productId: string) => void;
    onSubmit: (note: string, attachmentFile: File | null) => void;
    submitting: boolean;
    warehouses: { id: string; name: string }[];
    selectedWarehouseId: string;
    onWarehouseChange: (id: string) => void;
}) {
    const [note, setNote] = useState('');
    const [attachmentFile, setAttachmentFile] = useState<File | null>(null);
    const [mounted, setMounted] = useState(false);
    useEffect(() => { setMounted(true); }, []);

    const drawerContent = (
        <>
            {/* Backdrop */}
            {open && <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-[105]" onClick={onClose} />}
            {/* Drawer */}
            <div className={`fixed inset-y-0 top-0 right-0 w-full max-w-md bg-white shadow-2xl z-[110] flex flex-col transition-transform duration-300 ${open ? 'translate-x-0' : 'translate-x-full'}`}>
                {/* Header */}
                <div className="p-5 border-b border-surface-100 flex items-center justify-between bg-gradient-to-r from-accent-600 to-primary-600 text-white">
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
                        <div className="flex flex-col items-center justify-center h-full space-y-3 text-surface-400">
                            <ShoppingCart className="w-12 h-12 opacity-20" />
                            <p className="text-sm">Giỏ hàng trống</p>
                        </div>
                    ) : (
                        cart.map(item => (
                            <div key={item.productId} className="bg-surface-50 rounded-2xl p-3 border border-surface-200 flex items-center gap-3">
                                {/* Image */}
                                <div className="w-12 h-12 rounded-xl bg-surface-200 overflow-hidden shrink-0">
                                    {item.image ? (
                                        <img src={item.image} alt="" className="w-full h-full object-cover" />
                                    ) : (
                                        <div className="w-full h-full flex items-center justify-center">
                                            <Package className="w-5 h-5 text-surface-400" />
                                        </div>
                                    )}
                                </div>
                                <div className="flex-1 min-w-0">
                                    {item.productCode && (
                                        <p className="text-xs font-bold text-surface-800">{item.productCode}</p>
                                    )}
                                    <p className="font-semibold text-surface-800 text-sm truncate">{item.productName}</p>
                                    <p className="text-xs text-surface-400">{item.unit}</p>
                                </div>
                                {/* Qty stepper */}
                                <div className="flex items-center gap-1.5 shrink-0">
                                    <button
                                        onClick={() => onUpdateQty(item.productId, item.requestedQty - 1)}
                                        className="w-7 h-7 rounded-lg bg-surface-200 hover:bg-surface-300 flex items-center justify-center transition-colors"
                                    >
                                        <Minus className="w-3 h-3 text-surface-600" />
                                    </button>
                                    <input
                                        type="number" min={1}
                                        value={item.requestedQty}
                                        onChange={e => onUpdateQty(item.productId, Number(e.target.value) || 1)}
                                        className="w-10 text-center text-sm font-bold bg-white border border-surface-200 rounded-lg py-1 outline-none"
                                    />
                                    <button
                                        onClick={() => onUpdateQty(item.productId, item.requestedQty + 1)}
                                        className="w-7 h-7 rounded-lg bg-accent-100 hover:bg-accent-200 flex items-center justify-center transition-colors"
                                    >
                                        <Plus className="w-3 h-3 text-accent-600" />
                                    </button>
                                    <button onClick={() => onRemove(item.productId)} className="w-7 h-7 rounded-lg hover:bg-danger-100 flex items-center justify-center transition-colors ml-1">
                                        <Trash2 className="w-3.5 h-3.5 text-surface-400 hover:text-danger-500" />
                                    </button>
                                </div>
                            </div>
                        ))
                    )}
                </div>

                {/* Footer */}
                {cart.length > 0 && (
                    <div className="p-4 border-t border-surface-100 space-y-3 bg-surface-50">


                        {/* Warehouse selector */}
                        <div className="space-y-1.5">
                            <p className="text-xs font-bold text-surface-600 flex items-center gap-1.5">
                                <Warehouse className="w-3.5 h-3.5 text-accent-500" />
                                Đặt hàng từ kho <span className="text-danger-500">*</span>
                            </p>
                            <select value={selectedWarehouseId} onChange={e => onWarehouseChange(e.target.value)}
                                className={`w-full bg-white border rounded-xl p-2.5 text-sm outline-none focus:ring-2 focus:ring-accent-300 ${!selectedWarehouseId ? 'border-danger-300 text-surface-400' : 'border-surface-200 text-surface-800'}`}>
                                <option value="">-- Chọn kho đặt hàng --</option>
                                {warehouses.map(w => <option key={w.id} value={w.id}>🏭 {w.name}</option>)}
                            </select>
                            {!selectedWarehouseId && (
                                <p className="text-[11px] text-danger-500 font-medium">Vui lòng chọn kho trước khi đặt hàng</p>
                            )}
                        </div>

                        {/* File Attachment */}
                        <div className="space-y-1.5">
                            <p className="text-xs font-bold text-surface-600">
                                Đính kèm file đề xuất cơ cấu
                                <span className="text-surface-400 font-normal ml-1">(PDF, Excel, Word)</span>
                            </p>
                            <label className="flex items-center gap-2 cursor-pointer bg-white border-2 border-dashed border-surface-200 hover:border-accent-300 rounded-xl px-3 py-2.5 transition-colors group">
                                <input
                                    type="file"
                                    accept=".pdf,.xlsx,.xls,.doc,.docx"
                                    className="hidden"
                                    onChange={e => setAttachmentFile(e.target.files?.[0] ?? null)}
                                />
                                {attachmentFile ? (
                                    <>
                                        <CheckCircle2 className="w-4 h-4 text-success-500 shrink-0" />
                                        <span className="text-xs text-success-700 font-medium truncate flex-1">{attachmentFile.name}</span>
                                        <button
                                            type="button"
                                            onClick={e => { e.preventDefault(); setAttachmentFile(null); }}
                                            className="text-surface-400 hover:text-danger-500 shrink-0"
                                        >
                                            <X className="w-3.5 h-3.5" />
                                        </button>
                                    </>
                                ) : (
                                    <>
                                        <Send className="w-4 h-4 text-surface-400 group-hover:text-accent-500 shrink-0" />
                                        <span className="text-xs text-surface-400 group-hover:text-accent-600">Chọn file đính kèm...</span>
                                    </>
                                )}
                            </label>
                        </div>

                        <textarea
                            value={note}
                            onChange={e => setNote(e.target.value)}
                            rows={2}
                            placeholder="Ghi chú (tùy chọn)..."
                            className="w-full bg-white border border-surface-200 rounded-xl p-2.5 text-sm outline-none focus:ring-2 focus:ring-accent-300 resize-none"
                        />
                        <div className="flex items-center justify-between text-sm text-surface-500 mb-1">
                            <span>{cart.length} loại sản phẩm</span>
                            <span className="font-bold text-surface-700">{cart.reduce((s, i) => s + i.requestedQty, 0)} đơn vị</span>
                        </div>
                        <button
                            onClick={() => onSubmit(note, attachmentFile)}
                            disabled={submitting || !selectedWarehouseId}
                            className="w-full bg-gradient-to-r from-accent-600 to-primary-600 hover:from-accent-700 hover:to-primary-700 text-white py-3.5 rounded-xl font-bold text-sm flex items-center justify-center gap-2 transition-all disabled:opacity-50 shadow-md shadow-accent-500/20"
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
    PENDING_OFFICE: 'bg-warning-100 text-warning-700 border-warning-200',
    APPROVED_BY_OFFICE: 'bg-sky-100 text-sky-700 border-sky-200',
    IN_TRANSIT: 'bg-accent-100 text-accent-700 border-accent-200',
    COMPLETED: 'bg-success-100 text-success-700 border-success-200',
    REJECTED: 'bg-danger-100 text-danger-700 border-danger-200',
    CANCELED: 'bg-surface-100 text-surface-500 border-surface-200',
    PENDING: 'bg-warning-100 text-warning-700 border-warning-200',
    DISPATCHED: 'bg-success-100 text-success-700 border-success-200',
};
const STATUS_LABEL: Record<string, string> = {
    PENDING_OFFICE: 'Ch\u1edd VP duy\u1ec7t',
    APPROVED_BY_OFFICE: 'VP \u0111\u00e3 duy\u1ec7t',
    IN_TRANSIT: '\u0110ang giao h\u00e0ng',
    COMPLETED: 'Ho\u00e0n t\u1ea5t',
    REJECTED: '\u0110\u00e3 t\u1eeb ch\u1ed1i',
    CANCELED: '\u0110\u00e3 h\u1ee7y',
    PENDING: 'Ch\u1edd duy\u1ec7t',
    DISPATCHED: '\u0110\u00e3 xu\u1ea5t kho',
};

// ── Main Page ─────────────────────────────────────────────────────
type ActiveTab = 'order' | 'history';

export default function StoreInventoryDashboard() {
    const { user, userDoc, effectiveStoreId: contextStoreId, managedStoreIds } = useAuth();

    // Data
    const [products, setProducts] = useState<ProductDoc[]>([]);
    const [balances, setBalances] = useState<InventoryBalanceDoc[]>([]);
    const [orders, setOrders] = useState<PurchaseOrderDoc[]>([]);
    const [stores, setStores] = useState<StoreDoc[]>([]);
    const [warehouses, setWarehouses] = useState<WarehouseDoc[]>([]);
    const [loading, setLoading] = useState(true);

    // UI state
    const [activeTab, setActiveTab] = useState<ActiveTab>('order');
    const [cartOpen, setCartOpen] = useState(false);
    const [cart, setCart] = useState<CartItem[]>([]);
    const [submitting, setSubmitting] = useState(false);

    const [selectedStoreId, setSelectedStoreId] = useState('ALL');
    const [selectedWarehouseId, setSelectedWarehouseId] = useState('');

    // Collapsible history orders
    const [expandedHistoryOrders, setExpandedHistoryOrders] = useState<Set<string>>(new Set());

    // Cancel order state
    const [cancelingId, setCancelingId] = useState<string | null>(null);
    const [cancelReason, setCancelReason] = useState('');
    const [isCanceling, setIsCanceling] = useState(false);

    // Filters
    const [search, setSearch] = useState('');
    const [filterCategory, setFilterCategory] = useState('');
    const [filterStatus, setFilterStatus] = useState<'all' | 'safe' | 'low' | 'out'>('all');
    const [sortBy, setSortBy] = useState<'name' | 'stockAsc' | 'stockDesc'>('name');
    const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');

    const getToken = useCallback(() => user?.getIdToken(), [user]);
    const isAdmin = userDoc?.role === 'admin' || userDoc?.role === 'super_admin';
    // Office-context users: use effectiveStoreId from AuthContext (set via managed stores)
    // Store-context users: use userDoc.storeId
    const effectiveStoreId = isAdmin ? selectedStoreId : (contextStoreId || userDoc?.storeId || '');
    const isOfficeUser = !!userDoc?.officeId && !userDoc?.storeId;

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

    // Fetch stores (admin or office users with multiple managed stores)
    useEffect(() => {
        if (!user || (!isAdmin && managedStoreIds.length <= 1)) return;
        (async () => {
            try {
                const token = await getToken();
                const res = await fetch('/api/stores', { headers: { Authorization: `Bearer ${token}` } });
                const data = await res.json();
                setStores(Array.isArray(data) ? data : []);
            } catch { /* silent */ }
        })();
    }, [user, isAdmin, managedStoreIds, getToken]);

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
            } catch { /* silent */ }
        })();
    }, [user, getToken]);

    // Merge products + balances
    const mergedProducts = useMemo<MergedProduct[]>(() => {
        return products.map(p => {
            const bal = balances.find(b => b.productId === p.id);
            const stock = bal?.currentStock ?? 0;
            const stockStatus: MergedProduct['stockStatus'] =
                stock === 0 ? 'out' : stock <= p.minStock ? 'low' : 'safe';
            return { ...p, currentStoreStock: stock, currentStock: stock, stockStatus };
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
            list = list.filter(p =>
                p.name.toLowerCase().includes(q) ||
                p.barcode?.toLowerCase().includes(q) ||
                p.companyCode?.toLowerCase().includes(q)
            );
        }
        if (filterCategory) list = list.filter(p => p.category === filterCategory);
        if (filterStatus !== 'all') list = list.filter(p => p.stockStatus === filterStatus);
        if (sortBy === 'name') list.sort((a, b) => a.name.localeCompare(b.name));
        else if (sortBy === 'stockAsc') list.sort((a, b) => a.currentStock - b.currentStock);
        else list.sort((a, b) => b.currentStock - a.currentStock);
        return list;
    }, [mergedProducts, search, filterCategory, filterStatus, sortBy]);

    // Cart actions
    const addToCart = (product: MergedProduct) => {
        setCart(prev => {
            if (prev.find(i => i.productId === product.id)) return prev;
            return [...prev, {
                productId: product.id,
                productCode: product.companyCode || product.barcode || '',
                productName: product.name,
                unit: product.unit,
                image: product.image,
                requestedQty: 1,
            }];
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

    const handleSubmitOrder = async (note: string, attachmentFile: File | null) => {
        if (!cart.length || !effectiveStoreId) {
            showToast.warning('Thiếu thông tin', 'Vui lòng chọn cửa hàng và thêm sản phẩm');
            return;
        }
        setSubmitting(true);
        try {
            const token = await getToken();
            const storeName = isAdmin
                ? stores.find(s => s.id === effectiveStoreId)?.name || ''
                : stores.find(s => s.id === effectiveStoreId)?.name || userDoc?.name || '';

            // Upload attachment to Firebase Storage if provided
            let attachmentUrl: string | null = null;
            if (attachmentFile) {
                const fileRef = storageRef(
                    storage,
                    `purchase_proposals/${effectiveStoreId}/${Date.now()}_${attachmentFile.name}`
                );
                await uploadBytes(fileRef, attachmentFile);
                attachmentUrl = await getDownloadURL(fileRef);
            }

            const res = await fetch('/api/inventory/orders', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
                body: JSON.stringify({
                    storeId: effectiveStoreId,
                    storeName,
                    warehouseId: selectedWarehouseId,
                    warehouseName: warehouses.find(w => w.id === selectedWarehouseId)?.name || '',
                    items: cart.map(i => ({
                        productId: i.productId,
                        productCode: i.productCode || '',
                        productName: i.productName,
                        unit: i.unit,
                        requestedQty: i.requestedQty,
                    })),
                    note,
                    attachmentUrl,
                }),
            });
            if (!res.ok) throw new Error((await res.json()).error);
            showToast.success('Đã tạo đơn', 'Đã tạo đơn đặt hàng! Đang chờ văn phòng duyệt.');
            setCart([]);
            fetchAll();
        } catch (err: unknown) {
            showToast.error('Lỗi đặt hàng', err instanceof Error ? err.message : 'Có lỗi xảy ra');
        } finally { setSubmitting(false); }
    };

    const inCartIds = new Set(cart.map(i => i.productId));
    const outCount = mergedProducts.filter(p => p.stockStatus === 'out').length;
    const lowCount = mergedProducts.filter(p => p.stockStatus === 'low').length;

    const toggleHistoryOrder = (orderId: string) => {
        setExpandedHistoryOrders(prev => {
            const next = new Set(prev);
            if (next.has(orderId)) next.delete(orderId);
            else next.add(orderId);
            return next;
        });
    };

    const handleCancel = async () => {
        if (!cancelingId) return;
        setIsCanceling(true);
        try {
            const token = await getToken();
            const res = await fetch('/api/inventory/orders', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
                body: JSON.stringify({ orderId: cancelingId, action: 'cancel', reason: cancelReason }),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error);
            setCancelingId(null);
            fetchAll();
        } catch (err: unknown) {
            console.error(err instanceof Error ? err.message : err);
        } finally {
            setIsCanceling(false);
        }
    };

    const title = (
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 w-full">
            <div>
                <h1 className="text-2xl font-bold bg-gradient-to-r from-accent-600 to-primary-600 bg-clip-text text-transparent flex items-center gap-2">
                    <LayoutGrid className="w-7 h-7 text-accent-600" />
                    Kho hàng cửa hàng
                </h1>
                <p className="text-surface-500 mt-1 text-sm">Theo dõi tồn kho và đặt hàng từ kho trung tâm.</p>
            </div>
        </div>
    )

    return (
        <div className="space-y-5 mx-auto pb-24">
            {/* Header */}
            <DashboardHeader
                type="store"
                warehouses={stores}
                selectedWarehouseId={selectedStoreId}
                onWarehouseChange={setSelectedStoreId}
                titleChildren={title}
                showSelect={isAdmin}
            />

            {/* Tabs */}
            <div className="flex gap-1 bg-surface-100 rounded-xl p-1 w-fit">
                <button onClick={() => setActiveTab('order')}
                    className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-bold transition-all ${activeTab === 'order' ? 'bg-white text-accent-700 shadow-sm' : 'text-surface-500 hover:text-surface-700'}`}>
                    <LayoutGrid className="w-4 h-4" /> Hàng hoá
                </button>
                <button onClick={() => setActiveTab('history')}
                    className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-bold transition-all ${activeTab === 'history' ? 'bg-white text-accent-700 shadow-sm' : 'text-surface-500 hover:text-surface-700'}`}>
                    <ClipboardList className="w-4 h-4" /> Lịch sử đặt hàng
                </button>
            </div>

            {/* ── ORDER TAB ── */}
            {
                activeTab === 'order' && (
                    <>
                        {/* Alerts */}
                        {(outCount > 0 || lowCount > 0) && effectiveStoreId && (
                            <div className={`p-3 rounded-xl text-sm flex items-center gap-2 border ${outCount > 0 ? 'bg-danger-50 text-danger-700 border-danger-200' : 'bg-warning-50 text-warning-700 border-warning-200'}`}>
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
                            <div className="mt-2">
                                <InventoryCharts merged={mergedProducts} />
                            </div>
                        )}

                        {/* Toolbar and Data Grid */}
                        {effectiveStoreId && !loading && (
                            <div className="mt-6">
                                <ProductGrid
                                    merged={mergedProducts}
                                    categories={categories}
                                    cartItemIds={inCartIds}
                                    onAddToCart={addToCart}
                                    onUpdateMinStock={handleUpdateMinStock}
                                />
                            </div>
                        )}

                        {/* Office user store picker (when managing multiple stores) */}
                        {isOfficeUser && managedStoreIds.length > 1 && (
                            <div className="bg-white rounded-xl border border-surface-200 shadow-sm p-3 flex items-center gap-3">
                                <span className="text-sm font-semibold text-surface-600 shrink-0">Xem cửa hàng:</span>
                                <OfficeManagedStorePicker />
                            </div>
                        )}

                        {/* No store */}
                        {!effectiveStoreId && !isAdmin && !loading && (
                            <div className="text-center py-16 text-surface-400 text-sm">Tài khoản chưa được gán cửa hàng</div>
                        )}
                    </>
                )
            }

            {/* ── HISTORY TAB ── */}
            {
                activeTab === 'history' && (
                    <div className="space-y-3">
                        <div className="flex items-center justify-between">
                            <h2 className="font-bold text-surface-800 text-lg">Lịch sử đặt hàng</h2>
                            <span className="text-xs text-surface-400">{orders.length} đơn</span>
                        </div>
                        {loading ? (
                            <div className="flex justify-center py-12"><div className="w-6 h-6 border-4 border-surface-300 border-t-accent-600 rounded-full animate-spin" /></div>
                        ) : orders.length === 0 ? (
                            <div className="bg-white rounded-2xl border border-surface-200 shadow-sm text-center py-12">
                                <p className="text-sm text-surface-400">Chưa có đơn đặt hàng nào</p>
                            </div>
                        ) : (
                            orders.map(order => {
                                const isExpanded = expandedHistoryOrders.has(order.id);
                                const totalItems = order.items.length;
                                const totalQty = order.items.reduce((s, i) => s + i.requestedQty, 0);

                                return (
                                    <div key={order.id} className="bg-white rounded-2xl border border-surface-200 shadow-sm overflow-hidden">
                                        {/* Collapsible header */}
                                        <button
                                            onClick={() => toggleHistoryOrder(order.id)}
                                            className="w-full flex items-center gap-3 px-4 py-3.5 text-left hover:bg-surface-50/80 transition-colors"
                                        >
                                            <div className="flex-1 min-w-0">
                                                <div className="flex items-center gap-2 flex-wrap">
                                                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${STATUS_BADGE[order.status] || ''}`}>
                                                        {STATUS_LABEL[order.status] || order.status}
                                                    </span>
                                                    <span className="text-xs text-surface-400">
                                                        {new Date(order.timestamp).toLocaleString('vi-VN')}
                                                    </span>
                                                </div>
                                                <div className="flex items-center gap-2 mt-1">
                                                    <p className="text-sm text-surface-600">
                                                        <span className="font-bold text-surface-800">{totalItems}</span> sản phẩm · <span className="font-bold text-surface-800">{totalQty}</span> đơn vị
                                                    </p>
                                                    <span className="text-xs text-surface-400">· {order.createdByName}</span>
                                                </div>
                                            </div>

                                            {/* Cancel button for orders that can still be cancelled */}
                                            {(order.status === 'PENDING_OFFICE' || order.status === 'PENDING') && (
                                                <button
                                                    onClick={e => { e.stopPropagation(); setCancelingId(order.id); setCancelReason(''); }}
                                                    className="flex items-center gap-1 text-xs font-bold text-danger-500 hover:text-danger-700 border border-danger-200 hover:border-danger-400 px-2.5 py-1.5 rounded-xl transition-colors whitespace-nowrap shrink-0"
                                                >
                                                    <XCircle className="w-3 h-3" /> Hủy đơn
                                                </button>
                                            )}

                                            {isExpanded
                                                ? <ChevronUp className="w-4 h-4 text-surface-400 shrink-0" />
                                                : <ChevronDown className="w-4 h-4 text-surface-400 shrink-0" />}
                                        </button>

                                        {/* Collapsible item list */}
                                        {isExpanded && (
                                            <div className="border-t border-surface-100 px-4 py-3 bg-surface-50/50">
                                                <div className="space-y-1.5">
                                                    {order.items.map((item, i) => (
                                                        <div key={i} className="flex items-center justify-between text-xs py-1">
                                                            <div className="flex items-center gap-2 min-w-0">
                                                                <span className="font-mono font-bold text-surface-800 bg-surface-100 px-1.5 py-0.5 rounded text-[11px]">
                                                                    {item.productCode || '—'}
                                                                </span>
                                                                <span className="text-surface-500 truncate">{item.productName}</span>
                                                            </div>
                                                            <div className="flex items-center gap-2 shrink-0 ml-2">
                                                                <span className="text-surface-600 font-semibold whitespace-nowrap">
                                                                    ×{item.requestedQty} {item.unit}
                                                                </span>
                                                                {item.dispatchedQty !== undefined && item.dispatchedQty !== item.requestedQty && (
                                                                    <span className="text-success-600 whitespace-nowrap">(xuất: {item.dispatchedQty})</span>
                                                                )}
                                                            </div>
                                                        </div>
                                                    ))}
                                                </div>
                                                {order.attachmentUrl && (
                                                    <a
                                                        href={order.attachmentUrl}
                                                        target="_blank"
                                                        rel="noopener noreferrer"
                                                        className="flex items-center justify-between mt-3 p-2.5 bg-accent-50 border border-accent-100 rounded-xl hover:bg-accent-100 transition-colors group"
                                                    >
                                                        <div className="flex items-center gap-2 text-xs text-accent-700">
                                                            <span className="text-sm">📎</span>
                                                            <span className="font-semibold">File đề xuất đính kèm</span>
                                                        </div>
                                                        <span className="text-xs font-bold text-accent-600 group-hover:underline">Xem / Tải xuống ↗️</span>
                                                    </a>
                                                )}
                                                {(order as any).officeApprovedBy && (
                                                    <p className="text-xs text-sky-600 mt-2 pt-2 border-t border-surface-100 flex items-center gap-1">
                                                        ✓ Văn phòng đã duyệt bởi <strong>{(order as any).officeApprovedByName || (order as any).officeApprovedBy}</strong>
                                                    </p>
                                                )}
                                                {(order as any).rejectReason && (
                                                    <p className="text-xs text-danger-500 mt-2 flex items-center gap-1 pt-2 border-t border-surface-100">
                                                        <XCircle className="w-3 h-3 shrink-0" /> Lý do từ chối: {(order as any).rejectReason}
                                                    </p>
                                                )}
                                                {(order as any).cancelReason && (
                                                    <p className="text-xs text-surface-400 mt-2 pt-2 border-t border-surface-100">
                                                        Lý do hủy: {(order as any).cancelReason}
                                                    </p>
                                                )}
                                                {order.note && (
                                                    <p className="text-xs text-surface-400 mt-2 pt-2 border-t border-surface-100">
                                                        Ghi chú: {order.note}
                                                    </p>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                );
                            })
                        )}
                    </div>
                )
            }

            {/* ── Floating Cart FAB ── */}
            {
                activeTab === 'order' && effectiveStoreId && (
                    <button
                        onClick={() => setCartOpen(true)}
                        className="fixed bottom-6 right-6 z-30 bg-gradient-to-r from-accent-600 to-primary-600 text-white rounded-2xl px-5 py-3.5 shadow-xl shadow-accent-500/30 flex items-center gap-3 hover:shadow-2xl hover:from-accent-700 hover:to-primary-700 transition-all"
                    >
                        <ShoppingCart className="w-5 h-5" />
                        <span className="font-bold text-sm">Giỏ hàng</span>
                        {cart.length > 0 && (
                            <span className="bg-white text-accent-700 font-black text-xs px-2 py-0.5 rounded-full min-w-[22px] text-center">
                                {cart.length}
                            </span>
                        )}
                    </button>
                )
            }

            {/* ── Cart Drawer ── */}
            <CartDrawer
                open={cartOpen}
                onClose={() => setCartOpen(false)}
                cart={cart}
                onUpdateQty={updateCartQty}
                onRemove={removeFromCart}
                onSubmit={handleSubmitOrder}
                submitting={submitting}
                warehouses={warehouses}
                selectedWarehouseId={selectedWarehouseId}
                onWarehouseChange={setSelectedWarehouseId}
            />

            {/* ── Cancel Order Modal ── */}
            {
                cancelingId && typeof document !== 'undefined' && createPortal(
                    <div className="fixed inset-0 z-[110] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
                        <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
                            <div className="p-6 border-b border-surface-100 flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                    <XCircle className="w-5 h-5 text-danger-500" />
                                    <h2 className="text-lg font-bold text-surface-800">Hủy đơn hàng</h2>
                                </div>
                                <button onClick={() => setCancelingId(null)} className="text-surface-400 hover:text-surface-700 p-1">
                                    <X className="w-5 h-5" />
                                </button>
                            </div>
                            <div className="p-6 space-y-4">
                                <p className="text-sm text-surface-600">Bạn có chắc muốn hủy đơn này? Đơn sẽ được lưu trong lịch sử với trạng thái <strong>Đã hủy</strong>.</p>
                                <div>
                                    <label className="text-xs font-bold text-surface-600 block mb-1">Lý do hủy (tùy chọn)</label>
                                    <textarea
                                        value={cancelReason}
                                        onChange={e => setCancelReason(e.target.value)}
                                        rows={2}
                                        placeholder="VD: Đặt nhầm, không cần nữa..."
                                        className="w-full bg-surface-50 border border-surface-200 rounded-xl p-3 text-sm outline-none focus:ring-2 focus:ring-danger-300 resize-none"
                                    />
                                </div>
                            </div>
                            <div className="p-6 border-t border-surface-100 flex gap-3">
                                <button
                                    onClick={() => setCancelingId(null)}
                                    className="flex-1 bg-surface-100 hover:bg-surface-200 text-surface-700 py-2.5 rounded-xl font-medium text-sm transition-colors">
                                    Quay lại
                                </button>
                                <button
                                    onClick={handleCancel}
                                    disabled={isCanceling}
                                    className="flex-1 bg-danger-600 hover:bg-danger-700 disabled:opacity-40 text-white py-2.5 rounded-xl font-bold text-sm flex items-center justify-center gap-2 transition-all">
                                    {isCanceling
                                        ? <><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> Đang hủy...</>
                                        : <><XCircle className="w-4 h-4" /> Xác nhận hủy</>}
                                </button>
                            </div>
                        </div>
                    </div>,
                    document.body
                )
            }
        </div >
    );
}
