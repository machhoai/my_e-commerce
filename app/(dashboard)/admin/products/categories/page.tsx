'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Layers, Plus, Pencil, Trash2, X, Save, CheckCircle2, AlertCircle, Package, Search } from 'lucide-react';
import { DashboardHeader } from '@/components/inventory/overview/DashboardHeader';

interface Category {
    id: string;
    name: string;
    createdAt?: string;
}

export default function CategoryManagementPage() {
    const { user, userDoc } = useAuth();
    const [categories, setCategories] = useState<Category[]>([]);
    const [loading, setLoading] = useState(true);
    const [newName, setNewName] = useState('');
    const [editingId, setEditingId] = useState<string | null>(null);
    const [editName, setEditName] = useState('');
    const [saving, setSaving] = useState(false);
    const [message, setMessage] = useState({ type: '', text: '' });
    const [search, setSearch] = useState('');

    // Product count per category
    const [productCountMap, setProductCountMap] = useState<Map<string, number>>(new Map());
    const [totalProducts, setTotalProducts] = useState(0);

    const getToken = useCallback(() => user?.getIdToken(), [user]);

    if (userDoc && userDoc.role !== 'admin') {
        return <div className="flex items-center justify-center h-64 text-danger-500 font-bold">Chỉ quản trị viên mới có quyền truy cập.</div>;
    }

    const fetchCategories = useCallback(async () => {
        if (!user) return;
        setLoading(true);
        try {
            const token = await getToken();
            const res = await fetch('/api/inventory/categories', { headers: { Authorization: `Bearer ${token}` } });
            const data = await res.json();
            setCategories(Array.isArray(data) ? data : []);
        } catch { /* silent */ } finally { setLoading(false); }
    }, [user, getToken]);

    // Fetch products to count per category
    const fetchProductCounts = useCallback(async () => {
        if (!user) return;
        try {
            const token = await getToken();
            const res = await fetch('/api/inventory/products?all=true', { headers: { Authorization: `Bearer ${token}` } });
            const data = await res.json();
            const products = Array.isArray(data) ? data : [];
            setTotalProducts(products.length);
            const countMap = new Map<string, number>();
            products.forEach((p: { category?: string }) => {
                if (p.category) {
                    countMap.set(p.category, (countMap.get(p.category) || 0) + 1);
                }
            });
            setProductCountMap(countMap);
        } catch { /* silent */ }
    }, [user, getToken]);

    useEffect(() => { fetchCategories(); fetchProductCounts(); }, [fetchCategories, fetchProductCounts]);

    const handleAdd = async () => {
        if (!newName.trim()) return;
        setSaving(true);
        setMessage({ type: '', text: '' });
        try {
            const token = await getToken();
            const res = await fetch('/api/inventory/categories', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
                body: JSON.stringify({ name: newName.trim() }),
            });
            if (!res.ok) throw new Error((await res.json()).error);
            setNewName('');
            setMessage({ type: 'success', text: 'Đã tạo danh mục!' });
            fetchCategories();
        } catch (err: any) {
            setMessage({ type: 'error', text: err.message || 'Có lỗi xảy ra' });
        } finally { setSaving(false); }
    };

    const handleRename = async (id: string) => {
        if (!editName.trim()) return;
        setSaving(true);
        try {
            const token = await getToken();
            const res = await fetch('/api/inventory/categories', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
                body: JSON.stringify({ id, name: editName.trim() }),
            });
            if (!res.ok) throw new Error((await res.json()).error);
            setEditingId(null);
            fetchCategories();
        } catch (err: any) {
            setMessage({ type: 'error', text: err.message });
        } finally { setSaving(false); }
    };

    const handleDelete = async (id: string, name: string) => {
        const count = productCountMap.get(name) || 0;
        const extra = count > 0 ? `\n⚠️ Danh mục này đang có ${count} sản phẩm.` : '';
        if (!confirm(`Xóa danh mục "${name}"?${extra}`)) return;
        try {
            const token = await getToken();
            await fetch('/api/inventory/categories', {
                method: 'DELETE',
                headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
                body: JSON.stringify({ id }),
            });
            fetchCategories();
        } catch { /* silent */ }
    };

    // Filter categories by search
    const filtered = categories.filter(c =>
        !search || c.name.toLowerCase().includes(search.toLowerCase())
    );

    // Uncategorized product count
    const categorizedCount = Array.from(productCountMap.values()).reduce((a, b) => a + b, 0);
    const uncategorizedCount = totalProducts - categorizedCount;

    // Color palette for categories
    const colorPalette = [
        { bg: 'bg-primary-100', text: 'text-primary-600', dot: 'bg-primary-500', border: 'border-primary-200' },
        { bg: 'bg-success-100', text: 'text-success-600', dot: 'bg-success-500', border: 'border-success-200' },
        { bg: 'bg-warning-100', text: 'text-warning-600', dot: 'bg-warning-500', border: 'border-warning-200' },
        { bg: 'bg-accent-100', text: 'text-accent-600', dot: 'bg-accent-500', border: 'border-accent-200' },
        { bg: 'bg-rose-100', text: 'text-rose-600', dot: 'bg-rose-500', border: 'border-rose-200' },
        { bg: 'bg-cyan-100', text: 'text-cyan-600', dot: 'bg-cyan-500', border: 'border-cyan-200' },
        { bg: 'bg-orange-100', text: 'text-orange-600', dot: 'bg-orange-500', border: 'border-orange-200' },
        { bg: 'bg-pink-100', text: 'text-pink-600', dot: 'bg-pink-500', border: 'border-pink-200' },
    ];

    const getColor = (idx: number) => colorPalette[idx % colorPalette.length];

    return (
        <div className="space-y-6 mx-auto">
            <DashboardHeader
                showSelect={false}
                titleChildren={
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 w-full">
                        <div>
                            <h1 className="text-2xl font-bold bg-gradient-to-r from-accent-600 to-accent-600 bg-clip-text text-transparent flex items-center gap-2">
                                <Layers className="w-7 h-7 text-accent-600" />
                                Quản lý Danh mục
                            </h1>
                            <p className="text-surface-500 mt-1 text-sm">Tạo và quản lý danh mục sản phẩm trong hệ thống kho.</p>
                        </div>
                    </div>
                }
            />

            {/* KPI cards */}
            <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
                <div className="bg-white rounded-xl border border-surface-200 shadow-sm p-4">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-accent-100 flex items-center justify-center">
                            <Layers className="w-5 h-5 text-accent-600" />
                        </div>
                        <div>
                            <p className="text-2xl font-black text-surface-800">{categories.length}</p>
                            <p className="text-xs text-surface-500 font-medium">Danh mục</p>
                        </div>
                    </div>
                </div>
                <div className="bg-white rounded-xl border border-surface-200 shadow-sm p-4">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-primary-100 flex items-center justify-center">
                            <Package className="w-5 h-5 text-primary-600" />
                        </div>
                        <div>
                            <p className="text-2xl font-black text-surface-800">{totalProducts}</p>
                            <p className="text-xs text-surface-500 font-medium">Tổng sản phẩm</p>
                        </div>
                    </div>
                </div>
                <div className="bg-white rounded-xl border border-surface-200 shadow-sm p-4 col-span-2 lg:col-span-1">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-warning-100 flex items-center justify-center">
                            <AlertCircle className="w-5 h-5 text-warning-600" />
                        </div>
                        <div>
                            <p className="text-2xl font-black text-surface-800">{uncategorizedCount}</p>
                            <p className="text-xs text-surface-500 font-medium">Chưa phân loại</p>
                        </div>
                    </div>
                </div>
            </div>

            {message.text && (
                <div className={`p-3 rounded-xl flex items-center gap-2 border text-sm font-medium ${message.type === 'error' ? 'bg-danger-50 text-danger-700 border-danger-200' : 'bg-success-50 text-success-700 border-success-200'}`}>
                    {message.type === 'error' ? <AlertCircle className="w-4 h-4" /> : <CheckCircle2 className="w-4 h-4" />}
                    {message.text}
                </div>
            )}

            {/* Add new category */}
            <div className="bg-white rounded-2xl border border-surface-200 shadow-sm p-4">
                <div className="flex gap-3">
                    <input value={newName} onChange={e => setNewName(e.target.value)}
                        onKeyDown={e => e.key === 'Enter' && handleAdd()}
                        placeholder="Nhập tên danh mục mới..."
                        className="flex-1 bg-surface-50 border border-surface-200 rounded-xl p-2.5 text-sm outline-none focus:ring-2 focus:ring-accent-300 transition-all" />
                    <button onClick={handleAdd} disabled={saving || !newName.trim()}
                        className="bg-gradient-to-r from-accent-600 to-accent-600 hover:from-accent-700 hover:to-accent-700 text-white px-5 py-2.5 rounded-xl font-medium text-sm flex items-center gap-1.5 transition-all disabled:opacity-50 shadow-lg shadow-accent-500/20 active:scale-95">
                        <Plus className="w-4 h-4" /> Thêm
                    </button>
                </div>
            </div>

            {/* Search bar */}
            {categories.length > 5 && (
                <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-surface-400" />
                    <input value={search} onChange={e => setSearch(e.target.value)}
                        placeholder="Tìm danh mục..."
                        className="w-full pl-9 bg-white border border-surface-200 rounded-xl p-2.5 text-sm outline-none focus:ring-2 focus:ring-accent-300 transition-all shadow-sm" />
                </div>
            )}

            {/* Category grid */}
            <div className="bg-white rounded-2xl border border-surface-200 shadow-sm overflow-hidden">
                {loading ? (
                    <div className="flex flex-col items-center justify-center py-16 gap-3">
                        <div className="w-8 h-8 border-4 border-accent-500 border-t-transparent rounded-full animate-spin" />
                        <p className="text-sm text-surface-400">Đang tải danh mục...</p>
                    </div>
                ) : filtered.length === 0 ? (
                    <div className="text-center py-16 space-y-3">
                        <div className="w-16 h-16 rounded-2xl bg-surface-100 flex items-center justify-center mx-auto">
                            <Layers className="w-8 h-8 text-surface-300" />
                        </div>
                        <p className="text-sm font-medium text-surface-500">
                            {search ? 'Không tìm thấy danh mục nào' : 'Chưa có danh mục nào'}
                        </p>
                        <p className="text-xs text-surface-400">
                            {search ? 'Thử thay đổi từ khóa' : 'Tạo danh mục đầu tiên ở phía trên'}
                        </p>
                    </div>
                ) : (
                    <div className="divide-y divide-surface-100">
                        {filtered.map((cat, idx) => {
                            const count = productCountMap.get(cat.name) || 0;
                            const color = getColor(idx);

                            return (
                                <div key={cat.id} className="flex items-center gap-3 px-5 py-3.5 hover:bg-surface-50/50 transition-colors group">
                                    {editingId === cat.id ? (
                                        <>
                                            <input value={editName} onChange={e => setEditName(e.target.value)}
                                                onKeyDown={e => {
                                                    if (e.key === 'Enter') handleRename(cat.id);
                                                    if (e.key === 'Escape') setEditingId(null);
                                                }}
                                                className="flex-1 bg-surface-50 border border-accent-300 rounded-xl p-2.5 text-sm outline-none focus:ring-2 focus:ring-accent-300"
                                                autoFocus />
                                            <button onClick={() => handleRename(cat.id)} disabled={saving}
                                                className="text-accent-600 hover:bg-accent-50 p-2 rounded-xl transition-colors">
                                                <Save className="w-4 h-4" />
                                            </button>
                                            <button onClick={() => setEditingId(null)}
                                                className="text-surface-400 hover:bg-surface-100 p-2 rounded-xl transition-colors">
                                                <X className="w-4 h-4" />
                                            </button>
                                        </>
                                    ) : (
                                        <>
                                            {/* Color dot */}
                                            <div className={`w-3 h-3 rounded-full ${color.dot} shrink-0`} />

                                            {/* Category name */}
                                            <span className="flex-1 text-sm font-semibold text-surface-800">{cat.name}</span>

                                            {/* Product count badge */}
                                            <span className={`text-xs font-bold px-2.5 py-1 rounded-lg border ${color.bg} ${color.text} ${color.border}`}>
                                                {count} <span className="font-medium">sản phẩm</span>
                                            </span>

                                            {/* Action buttons */}
                                            <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                                <button onClick={() => { setEditingId(cat.id); setEditName(cat.name); }}
                                                    className="text-surface-400 hover:text-accent-600 hover:bg-accent-50 p-2 rounded-xl transition-all">
                                                    <Pencil className="w-4 h-4" />
                                                </button>
                                                <button onClick={() => handleDelete(cat.id, cat.name)}
                                                    className="text-surface-400 hover:text-danger-500 hover:bg-danger-50 p-2 rounded-xl transition-all">
                                                    <Trash2 className="w-4 h-4" />
                                                </button>
                                            </div>
                                        </>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>
        </div>
    );
}
