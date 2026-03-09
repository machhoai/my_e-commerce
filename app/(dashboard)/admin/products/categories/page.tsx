'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Layers, Plus, Pencil, Trash2, X, Save, CheckCircle2, AlertCircle } from 'lucide-react';

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

    const getToken = useCallback(() => user?.getIdToken(), [user]);

    if (userDoc && userDoc.role !== 'admin') {
        return <div className="flex items-center justify-center h-64 text-red-500 font-bold">Chỉ quản trị viên mới có quyền truy cập.</div>;
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

    useEffect(() => { fetchCategories(); }, [fetchCategories]);

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
        if (!confirm(`Xóa danh mục "${name}"?`)) return;
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

    return (
        <div className="space-y-6 mx-auto">
            <div>
                <h1 className="text-2xl font-bold bg-gradient-to-r from-violet-600 to-purple-600 bg-clip-text text-transparent flex items-center gap-2">
                    <Layers className="w-7 h-7 text-violet-600" />
                    Quản lý Danh mục
                </h1>
                <p className="text-slate-500 mt-1">Tạo và quản lý danh mục sản phẩm trong hệ thống kho.</p>
            </div>

            {message.text && (
                <div className={`p-3 rounded-xl flex items-center gap-2 border text-sm font-medium ${message.type === 'error' ? 'bg-red-50 text-red-700 border-red-200' : 'bg-emerald-50 text-emerald-700 border-emerald-200'}`}>
                    {message.type === 'error' ? <AlertCircle className="w-4 h-4" /> : <CheckCircle2 className="w-4 h-4" />}
                    {message.text}
                </div>
            )}

            {/* Add new category */}
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4">
                <div className="flex gap-3">
                    <input value={newName} onChange={e => setNewName(e.target.value)}
                        onKeyDown={e => e.key === 'Enter' && handleAdd()}
                        placeholder="Nhập tên danh mục mới..."
                        className="flex-1 bg-slate-50 border border-slate-200 rounded-lg p-2.5 text-sm outline-none focus:ring-2 focus:ring-violet-300" />
                    <button onClick={handleAdd} disabled={saving || !newName.trim()}
                        className="bg-violet-600 hover:bg-violet-700 text-white px-5 py-2.5 rounded-lg font-medium text-sm flex items-center gap-1.5 transition-colors disabled:opacity-50">
                        <Plus className="w-4 h-4" /> Thêm
                    </button>
                </div>
            </div>

            {/* Category list */}
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                {loading ? (
                    <div className="flex justify-center py-12"><div className="w-6 h-6 border-4 border-slate-300 border-t-slate-700 rounded-full animate-spin" /></div>
                ) : categories.length === 0 ? (
                    <div className="text-center py-12 space-y-2">
                        <Layers className="w-8 h-8 text-slate-300 mx-auto" />
                        <p className="text-sm text-slate-400">Chưa có danh mục nào</p>
                    </div>
                ) : (
                    <div className="divide-y divide-slate-100">
                        {categories.map(cat => (
                            <div key={cat.id} className="flex items-center gap-3 px-6 py-3 hover:bg-slate-50/50">
                                {editingId === cat.id ? (
                                    <>
                                        <input value={editName} onChange={e => setEditName(e.target.value)}
                                            onKeyDown={e => e.key === 'Enter' && handleRename(cat.id)}
                                            className="flex-1 bg-slate-50 border border-violet-300 rounded-lg p-2 text-sm outline-none focus:ring-2 focus:ring-violet-300"
                                            autoFocus />
                                        <button onClick={() => handleRename(cat.id)} disabled={saving}
                                            className="text-violet-600 hover:bg-violet-50 p-1.5 rounded-lg transition-colors">
                                            <Save className="w-4 h-4" />
                                        </button>
                                        <button onClick={() => setEditingId(null)}
                                            className="text-slate-400 hover:bg-slate-100 p-1.5 rounded-lg transition-colors">
                                            <X className="w-4 h-4" />
                                        </button>
                                    </>
                                ) : (
                                    <>
                                        <div className="w-2 h-2 rounded-full bg-violet-400 shrink-0" />
                                        <span className="flex-1 text-sm font-medium text-slate-700">{cat.name}</span>
                                        <button onClick={() => { setEditingId(cat.id); setEditName(cat.name); }}
                                            className="text-slate-400 hover:text-violet-600 hover:bg-violet-50 p-1.5 rounded-lg transition-colors">
                                            <Pencil className="w-4 h-4" />
                                        </button>
                                        <button onClick={() => handleDelete(cat.id, cat.name)}
                                            className="text-slate-400 hover:text-red-500 hover:bg-red-50 p-1.5 rounded-lg transition-colors">
                                            <Trash2 className="w-4 h-4" />
                                        </button>
                                    </>
                                )}
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}
