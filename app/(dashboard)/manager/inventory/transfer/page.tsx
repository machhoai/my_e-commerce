'use client';

import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import {
    ArrowRight, CheckCircle2, AlertCircle, Package, Send,
    Warehouse, LayoutGrid, Search, Trash2, X, Plus, Minus,
} from 'lucide-react';
import type { ProductDoc, InventoryBalanceDoc } from '@/types/inventory';
import type { StoreDoc, CounterDoc } from '@/types';
import { DashboardHeader } from '@/components/inventory/overview/DashboardHeader';

// ── Transfer list item ──────────────────────────────────────────
interface TransferItem {
    productId: string;
    productCode: string;
    productName: string;
    unit: string;
    currentStock: number;
    transferQty: number;
}

// ── Searchable Combobox ─────────────────────────────────────────
function ProductCombobox({
    products,
    onSelect,
    disabledIds,
}: {
    products: { id: string; code: string; name: string; stock: number; unit: string }[];
    onSelect: (product: typeof products[number]) => void;
    disabledIds: Set<string>;
}) {
    const [open, setOpen] = useState(false);
    const [query, setQuery] = useState('');
    const inputRef = useRef<HTMLInputElement>(null);
    const wrapperRef = useRef<HTMLDivElement>(null);

    const filtered = useMemo(() => {
        if (!query) return products;
        const q = query.toLowerCase();
        return products.filter(p =>
            p.code.toLowerCase().includes(q) ||
            p.name.toLowerCase().includes(q)
        );
    }, [products, query]);

    const handleSelect = (product: typeof products[number]) => {
        onSelect(product);
        setQuery('');
        setOpen(false);
    };

    // Close on outside click
    useEffect(() => {
        const handler = (e: MouseEvent) => {
            if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
                setOpen(false);
            }
        };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, []);

    return (
        <div ref={wrapperRef} className="relative">
            <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-surface-400" />
                <input
                    ref={inputRef}
                    type="text"
                    value={query}
                    onChange={e => { setQuery(e.target.value); setOpen(true); }}
                    onFocus={() => setOpen(true)}
                    placeholder="Quét hoặc nhập Mã vạch / Tên sản phẩm..."
                    className="w-full pl-10 pr-4 py-3 bg-surface-50 border border-surface-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-accent-300 focus:border-accent-300 transition-all"
                />
                {query && (
                    <button onClick={() => { setQuery(''); inputRef.current?.focus(); }}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-surface-400 hover:text-surface-600">
                        <X className="w-4 h-4" />
                    </button>
                )}
            </div>

            {open && (
                <div className="absolute z-50 mt-1 w-full bg-white border border-surface-200 rounded-xl shadow-xl max-h-64 overflow-y-auto">
                    {filtered.length === 0 ? (
                        <div className="p-4 text-sm text-surface-400 text-center">Không tìm thấy sản phẩm</div>
                    ) : (
                        filtered.map(p => {
                            const isDisabled = disabledIds.has(p.id);
                            return (
                                <button
                                    key={p.id}
                                    onClick={() => !isDisabled && handleSelect(p)}
                                    disabled={isDisabled}
                                    className={`w-full text-left px-4 py-3 flex items-center justify-between gap-3 border-b border-surface-50 last:border-0 transition-colors ${isDisabled
                                        ? 'opacity-40 cursor-not-allowed bg-surface-50'
                                        : 'hover:bg-accent-50/60 cursor-pointer'
                                        }`}
                                >
                                    <div className="min-w-0">
                                        <span className="font-mono font-bold text-primary-600 text-sm">
                                            {p.code || '—'}
                                        </span>
                                        <span className="text-surface-500 text-sm ml-2 truncate">{p.name}</span>
                                    </div>
                                    <div className="shrink-0 text-right">
                                        <span className="text-xs font-semibold text-surface-600">
                                            Tồn: {p.stock} {p.unit}
                                        </span>
                                        {isDisabled && (
                                            <span className="text-[10px] text-accent-500 block">Đã thêm</span>
                                        )}
                                    </div>
                                </button>
                            );
                        })
                    )}
                </div>
            )}
        </div>
    );
}

// ── Main Page ───────────────────────────────────────────────────
export default function TransferPage() {
    const { user, userDoc } = useAuth();
    const [products, setProducts] = useState<ProductDoc[]>([]);
    const [counters, setCounters] = useState<CounterDoc[]>([]);
    const [balances, setBalances] = useState<InventoryBalanceDoc[]>([]);
    const [stores, setStores] = useState<StoreDoc[]>([]);

    const [selectedStoreId, setSelectedStoreId] = useState('');
    const [selectedCounter, setSelectedCounter] = useState('');
    const [transferItems, setTransferItems] = useState<TransferItem[]>([]);
    const [note, setNote] = useState('');

    const [submitting, setSubmitting] = useState(false);
    const [message, setMessage] = useState({ type: '', text: '' });

    const getToken = useCallback(() => user?.getIdToken(), [user]);
    const isAdmin = userDoc?.role === 'admin';
    const effectiveStoreId = isAdmin ? selectedStoreId : userDoc?.storeId || '';

    // Fetch products (active only)
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

    // Fetch counters for the store
    useEffect(() => {
        if (!effectiveStoreId || !user) { setCounters([]); return; }
        (async () => {
            try {
                const token = await getToken();
                const res = await fetch(`/api/stores/${effectiveStoreId}/settings`, { headers: { Authorization: `Bearer ${token}` } });
                const data = await res.json();
                setCounters((data.counters || []).filter((c: CounterDoc) => c.isActive !== false));
            } catch { setCounters([]); }
        })();
    }, [user, effectiveStoreId, getToken]);

    // Fetch store balances
    const fetchBalances = useCallback(async () => {
        if (!effectiveStoreId || !user) { setBalances([]); return; }
        try {
            const token = await getToken();
            const res = await fetch(`/api/inventory/balances?locationType=STORE&locationId=${effectiveStoreId}`, {
                headers: { Authorization: `Bearer ${token}` },
            });
            const data = await res.json();
            setBalances(Array.isArray(data) ? data : []);
        } catch { setBalances([]); }
    }, [user, effectiveStoreId, getToken]);

    useEffect(() => { fetchBalances(); }, [fetchBalances]);

    const getStoreStock = useCallback((productId: string) => {
        return balances.find(b => b.productId === productId)?.currentStock ?? 0;
    }, [balances]);

    // Products available for the combobox (with stock > 0)
    const comboProducts = useMemo(() => {
        return products
            .map(p => ({
                id: p.id,
                code: p.companyCode || p.barcode || '',
                name: p.name,
                stock: getStoreStock(p.id),
                unit: p.unit,
            }))
            .filter(p => p.stock > 0);
    }, [products, getStoreStock]);

    const addTransferItem = (product: typeof comboProducts[number]) => {
        setTransferItems(prev => [
            ...prev,
            {
                productId: product.id,
                productCode: product.code,
                productName: product.name,
                unit: product.unit,
                currentStock: product.stock,
                transferQty: 1,
            },
        ]);
    };

    const updateTransferQty = (productId: string, qty: number) => {
        setTransferItems(prev =>
            prev.map(item => {
                if (item.productId !== productId) return item;
                const clampedQty = Math.max(1, Math.min(qty, item.currentStock));
                return { ...item, transferQty: clampedQty };
            })
        );
    };

    const removeTransferItem = (productId: string) => {
        setTransferItems(prev => prev.filter(i => i.productId !== productId));
    };

    const handleTransfer = async () => {
        if (!selectedCounter) {
            setMessage({ type: 'error', text: 'Vui lòng chọn quầy đích' });
            return;
        }
        if (transferItems.length === 0) {
            setMessage({ type: 'error', text: 'Vui lòng thêm ít nhất 1 sản phẩm' });
            return;
        }

        setSubmitting(true);
        setMessage({ type: '', text: '' });

        const counter = counters.find(c => c.id === selectedCounter);
        let successCount = 0;
        let lastError = '';

        try {
            const token = await getToken();

            for (const item of transferItems) {
                try {
                    const res = await fetch('/api/inventory/transfer', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
                        body: JSON.stringify({
                            storeId: effectiveStoreId,
                            counterId: selectedCounter,
                            counterName: counter?.name || '',
                            productId: item.productId,
                            quantity: item.transferQty,
                            note: note || `Xuất ra ${counter?.name || selectedCounter}`,
                        }),
                    });
                    if (!res.ok) {
                        const data = await res.json();
                        throw new Error(data.error);
                    }
                    successCount++;
                } catch (err: any) {
                    lastError = err.message || 'Có lỗi xảy ra';
                }
            }

            if (successCount === transferItems.length) {
                setMessage({ type: 'success', text: `Đã xuất ${successCount} sản phẩm ra quầy thành công!` });
                setTransferItems([]);
                setNote('');
            } else if (successCount > 0) {
                setMessage({ type: 'error', text: `Đã xuất ${successCount}/${transferItems.length} sản phẩm. Lỗi: ${lastError}` });
            } else {
                setMessage({ type: 'error', text: lastError });
            }

            await fetchBalances();
        } catch (err: any) {
            setMessage({ type: 'error', text: err.message || 'Có lỗi xảy ra' });
        } finally {
            setSubmitting(false);
        }
    };

    const transferItemIds = useMemo(() => new Set(transferItems.map(i => i.productId)), [transferItems]);
    const totalTransferUnits = transferItems.reduce((s, i) => s + i.transferQty, 0);
    const counterName = counters.find(c => c.id === selectedCounter)?.name || '';

    return (
        <div className="space-y-6 mx-auto pb-24">
            {/* Header */}
            <DashboardHeader
                warehouses={stores}
                selectedWarehouseId={selectedStoreId}
                onWarehouseChange={setSelectedStoreId}
                type="store"
                showSelect={isAdmin}
                titleChildren={
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 w-full">
                        <div>
                            <h1 className="text-2xl font-bold bg-gradient-to-r from-accent-600 to-accent-600 bg-clip-text text-transparent flex items-center gap-2">
                                <Send className="w-7 h-7 text-accent-600" />
                                Xuất hàng ra quầy
                            </h1>
                            <p className="text-surface-500 mt-1 text-sm">Chuyển hàng từ kho cửa hàng đến quầy làm việc.</p>
                        </div>
                    </div>
                }
            />

            {/* Message */}
            {message.text && (
                <div className={`p-3 rounded-xl flex items-center gap-2 border text-sm font-medium ${message.type === 'error' ? 'bg-danger-50 text-danger-700 border-danger-200' : 'bg-success-50 text-success-700 border-success-200'}`}>
                    {message.type === 'error' ? <AlertCircle className="w-4 h-4 shrink-0" /> : <CheckCircle2 className="w-4 h-4 shrink-0" />}
                    {message.text}
                </div>
            )}

            {effectiveStoreId && (
                <>
                    {/* ── LOCATION CARDS ── */}
                    <div className="grid grid-cols-1 md:grid-cols-[1fr_auto_1fr] gap-3 items-center">
                        {/* Source: Kho cửa hàng */}
                        <div className="bg-gradient-to-br from-warning-50 to-accent-50 rounded-2xl border-2 border-warning-200 p-5">
                            <div className="flex items-center gap-3 mb-2">
                                <div className="w-10 h-10 rounded-xl bg-warning-100 flex items-center justify-center">
                                    <Warehouse className="w-5 h-5 text-warning-600" />
                                </div>
                                <div>
                                    <p className="text-[10px] font-bold text-warning-500 uppercase tracking-wider">Nguồn</p>
                                    <p className="font-bold text-warning-800 text-lg">Kho cửa hàng</p>
                                </div>
                            </div>
                            <p className="text-xs text-warning-600/70">
                                {balances.length > 0
                                    ? `${balances.length} sản phẩm trong kho`
                                    : 'Chưa có dữ liệu tồn kho'}
                            </p>
                        </div>

                        {/* Arrow */}
                        <div className="hidden md:flex items-center justify-center">
                            <div className="w-12 h-12 rounded-full bg-gradient-to-r from-accent-500 to-accent-500 flex items-center justify-center shadow-lg shadow-accent-500/30">
                                <ArrowRight className="w-6 h-6 text-white" />
                            </div>
                        </div>
                        <div className="flex md:hidden justify-center -my-1">
                            <div className="w-10 h-10 rounded-full bg-gradient-to-b from-accent-500 to-accent-500 flex items-center justify-center shadow-lg shadow-accent-500/30 rotate-90">
                                <ArrowRight className="w-5 h-5 text-white" />
                            </div>
                        </div>

                        {/* Destination: Quầy */}
                        <div className={`rounded-2xl border-2 p-5 transition-all ${selectedCounter
                            ? 'bg-gradient-to-br from-success-50 to-teal-50 border-success-200'
                            : 'bg-surface-50 border-dashed border-surface-300'
                            }`}>
                            <div className="flex items-center gap-3 mb-2">
                                <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${selectedCounter ? 'bg-success-100' : 'bg-surface-200'
                                    }`}>
                                    <LayoutGrid className={`w-5 h-5 ${selectedCounter ? 'text-success-600' : 'text-surface-400'}`} />
                                </div>
                                <div className="flex-1">
                                    <p className={`text-[10px] font-bold uppercase tracking-wider ${selectedCounter ? 'text-success-500' : 'text-surface-400'
                                        }`}>Đích đến</p>
                                    <select
                                        value={selectedCounter}
                                        onChange={e => setSelectedCounter(e.target.value)}
                                        className={`font-bold text-lg bg-transparent outline-none cursor-pointer w-full ${selectedCounter ? 'text-success-800' : 'text-surface-400'
                                            }`}
                                    >
                                        <option value="">Chọn quầy...</option>
                                        {counters.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                                    </select>
                                </div>
                            </div>
                            <p className={`text-xs ${selectedCounter ? 'text-success-600/70' : 'text-surface-400'}`}>
                                {selectedCounter ? 'Sẵn sàng nhận hàng' : 'Vui lòng chọn quầy đích'}
                            </p>
                        </div>
                    </div>

                    {/* ── PRODUCT SEARCH ── */}
                    <div className="bg-white rounded-2xl border border-surface-200 shadow-sm p-5">
                        <h3 className="text-sm font-bold text-surface-700 mb-3 flex items-center gap-2">
                            <Plus className="w-4 h-4 text-accent-500" />
                            Thêm sản phẩm
                        </h3>
                        <ProductCombobox
                            products={comboProducts}
                            onSelect={addTransferItem}
                            disabledIds={transferItemIds}
                        />
                    </div>

                    {/* ── TRANSFER LIST TABLE ── */}
                    {transferItems.length > 0 && (
                        <div className="bg-white rounded-2xl border border-surface-200 shadow-sm overflow-hidden">
                            <div className="px-5 py-4 border-b border-surface-100 flex items-center justify-between">
                                <h3 className="font-bold text-surface-800">
                                    Danh sách xuất quầy
                                    <span className="ml-2 bg-accent-100 text-accent-700 text-xs font-bold px-2 py-0.5 rounded-full">
                                        {transferItems.length}
                                    </span>
                                </h3>
                                <span className="text-xs text-surface-400">
                                    Tổng: <span className="font-bold text-surface-700">{totalTransferUnits}</span> đơn vị
                                </span>
                            </div>

                            <div className="overflow-x-auto">
                                <table className="w-full text-sm">
                                    <thead>
                                        <tr className="text-left text-xs text-surface-500 uppercase bg-surface-50 border-b">
                                            <th className="px-5 py-3">Sản phẩm</th>
                                            <th className="px-5 py-3 text-right">Tồn kho</th>
                                            <th className="px-5 py-3 text-center">Số lượng chuyển</th>
                                            <th className="px-5 py-3 text-right w-12">Xóa</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {transferItems.map(item => (
                                            <tr key={item.productId} className="border-b border-surface-100 hover:bg-surface-50/50">
                                                {/* Product — Barcode first */}
                                                <td className="px-5 py-3">
                                                    <div className="flex flex-col">
                                                        <span className="font-mono font-bold text-primary-600 text-sm">
                                                            {item.productCode || '—'}
                                                        </span>
                                                        <span className="text-xs text-surface-400 line-clamp-1">{item.productName}</span>
                                                    </div>
                                                </td>

                                                {/* Current stock */}
                                                <td className="px-5 py-3 text-right">
                                                    <span className="text-surface-600 font-semibold">{item.currentStock}</span>
                                                    <span className="text-surface-400 text-xs ml-1">{item.unit}</span>
                                                </td>

                                                {/* Transfer qty stepper */}
                                                <td className="px-5 py-3">
                                                    <div className="flex items-center justify-center gap-1.5">
                                                        <button
                                                            onClick={() => updateTransferQty(item.productId, item.transferQty - 1)}
                                                            className="w-8 h-8 rounded-lg bg-surface-100 hover:bg-surface-200 flex items-center justify-center transition-colors"
                                                        >
                                                            <Minus className="w-3.5 h-3.5 text-surface-600" />
                                                        </button>
                                                        <input
                                                            type="number"
                                                            min={1}
                                                            max={item.currentStock}
                                                            value={item.transferQty}
                                                            onChange={e => updateTransferQty(item.productId, Number(e.target.value) || 1)}
                                                            className="w-16 text-center text-sm font-bold bg-white border border-surface-200 rounded-lg py-1.5 outline-none focus:ring-2 focus:ring-accent-300"
                                                        />
                                                        <button
                                                            onClick={() => updateTransferQty(item.productId, item.transferQty + 1)}
                                                            className="w-8 h-8 rounded-lg bg-accent-100 hover:bg-accent-200 flex items-center justify-center transition-colors"
                                                        >
                                                            <Plus className="w-3.5 h-3.5 text-accent-600" />
                                                        </button>
                                                    </div>
                                                    {item.transferQty >= item.currentStock && (
                                                        <p className="text-[10px] text-warning-500 text-center mt-1">Tối đa</p>
                                                    )}
                                                </td>

                                                {/* Remove */}
                                                <td className="px-5 py-3 text-right">
                                                    <button
                                                        onClick={() => removeTransferItem(item.productId)}
                                                        className="w-8 h-8 rounded-lg hover:bg-danger-50 flex items-center justify-center transition-colors group"
                                                    >
                                                        <Trash2 className="w-4 h-4 text-surface-300 group-hover:text-danger-500 transition-colors" />
                                                    </button>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>

                            {/* Note */}
                            <div className="px-5 py-4 border-t border-surface-100 bg-surface-50/50">
                                <input
                                    type="text"
                                    value={note}
                                    onChange={e => setNote(e.target.value)}
                                    placeholder="Ghi chú (tùy chọn) — VD: Xuất thêm hàng cho ca tối"
                                    className="w-full bg-white border border-surface-200 rounded-xl px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-accent-300"
                                />
                            </div>
                        </div>
                    )}

                    {/* ── EMPTY STATE ── */}
                    {transferItems.length === 0 && (
                        <div className="bg-white rounded-2xl border border-dashed border-surface-300 py-12 text-center">
                            <Package className="w-10 h-10 text-surface-200 mx-auto mb-3" />
                            <p className="text-sm text-surface-400">Tìm kiếm và thêm sản phẩm vào danh sách xuất quầy</p>
                        </div>
                    )}

                    {/* ── ACTION FOOTER ── */}
                    {transferItems.length > 0 && (
                        <div className="fixed bottom-0 left-0 right-0 z-30 bg-white/95 backdrop-blur border-t border-surface-200 shadow-[0_-4px_20px_rgba(0,0,0,0.06)]">
                            <div className="max-w-4xl mx-auto flex items-center justify-between px-5 py-4">
                                <div className="text-sm text-surface-600">
                                    <span className="font-bold text-accent-600">{transferItems.length}</span> sản phẩm
                                    {counterName && (
                                        <span className="text-surface-400 ml-1">→ <span className="font-semibold text-success-600">{counterName}</span></span>
                                    )}
                                </div>
                                <div className="flex items-center gap-3">
                                    <button
                                        onClick={() => { setTransferItems([]); setNote(''); setMessage({ type: '', text: '' }); }}
                                        className="px-5 py-2.5 bg-surface-100 hover:bg-surface-200 text-surface-600 rounded-xl text-sm font-medium transition-colors"
                                    >
                                        Hủy
                                    </button>
                                    <button
                                        onClick={handleTransfer}
                                        disabled={submitting || !selectedCounter}
                                        className="px-6 py-2.5 bg-gradient-to-r from-accent-600 to-accent-600 hover:from-accent-700 hover:to-accent-700 text-white rounded-xl font-bold text-sm flex items-center gap-2 transition-all disabled:opacity-50 shadow-md shadow-accent-500/20"
                                    >
                                        {submitting
                                            ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                                            : <Send className="w-4 h-4" />}
                                        Tạo phiếu chuyển
                                    </button>
                                </div>
                            </div>
                        </div>
                    )}
                </>
            )}

            {/* No store selected */}
            {!effectiveStoreId && !isAdmin && (
                <div className="text-center py-16 text-surface-400 text-sm">Tài khoản chưa được gán cửa hàng</div>
            )}
        </div>
    );
}
