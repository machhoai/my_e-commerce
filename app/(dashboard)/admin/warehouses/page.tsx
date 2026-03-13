'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { WarehouseDoc } from '@/types';
import { Warehouse, Plus, Pencil, Power, PowerOff, MapPin, Loader2, X, CheckCircle2, AlertCircle, Ruler } from 'lucide-react';
import { DashboardHeader } from '@/components/inventory/overview/DashboardHeader';

export default function AdminWarehousesPage() {
    const { user, userDoc } = useAuth();
    const [warehouses, setWarehouses] = useState<WarehouseDoc[]>([]);
    const [loading, setLoading] = useState(true);
    const [showForm, setShowForm] = useState(false);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [submitting, setSubmitting] = useState(false);
    const [msg, setMsg] = useState({ type: '', text: '' });

    const [formName, setFormName] = useState('');
    const [formAddress, setFormAddress] = useState('');
    const [formCapacity, setFormCapacity] = useState('');

    const getToken = useCallback(() => user?.getIdToken(), [user]);

    const fetchWarehouses = useCallback(async () => {
        try {
            const token = await getToken();
            const res = await fetch('/api/warehouses', { headers: { Authorization: `Bearer ${token}` } });
            const data = await res.json();
            setWarehouses(Array.isArray(data) ? data : []);
        } catch { /* silent */ } finally {
            setLoading(false);
        }
    }, [getToken]);

    useEffect(() => { fetchWarehouses(); }, [fetchWarehouses]);

    const resetForm = () => {
        setFormName(''); setFormAddress(''); setFormCapacity('');
        setEditingId(null); setShowForm(false);
    };

    const openCreate = () => { resetForm(); setShowForm(true); };

    const openEdit = (wh: WarehouseDoc) => {
        setEditingId(wh.id);
        setFormName(wh.name);
        setFormAddress(wh.address || '');
        setFormCapacity(wh.capacitySqm ? String(wh.capacitySqm) : '');
        setShowForm(true);
    };

    const handleSubmit = async () => {
        if (!formName.trim()) { setMsg({ type: 'error', text: 'Tên kho là bắt buộc' }); return; }
        setSubmitting(true);
        try {
            const token = await getToken();
            const body = {
                id: editingId || undefined,
                name: formName,
                address: formAddress,
                capacitySqm: formCapacity ? Number(formCapacity) : undefined,
            };
            const res = await fetch('/api/warehouses', {
                method: editingId ? 'PUT' : 'POST',
                headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
                body: JSON.stringify(body),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error);
            setMsg({ type: 'success', text: editingId ? 'Đã cập nhật kho' : 'Đã thêm kho mới' });
            resetForm();
            fetchWarehouses();
        } catch (err: any) {
            setMsg({ type: 'error', text: err.message });
        } finally {
            setSubmitting(false);
        }
    };

    const toggleActive = async (wh: WarehouseDoc) => {
        try {
            const token = await getToken();
            await fetch('/api/warehouses', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
                body: JSON.stringify({ id: wh.id, isActive: !wh.isActive }),
            });
            fetchWarehouses();
        } catch { /* silent */ }
    };

    if (userDoc?.role !== 'admin' && userDoc?.role !== 'super_admin') {
        return <div className="p-8 text-danger-500 font-bold">Không có quyền truy cập.</div>;
    }

    return (
        <div className="space-y-6 pb-12">
            {/* Header */}
            <DashboardHeader
                showSelect={false}
                titleChildren={
                    <div className="flex items-center justify-between w-full flex-wrap gap-4">
                        <div>
                            <h1 className="text-2xl font-bold text-surface-800 flex items-center gap-2">
                                <Warehouse className="w-6 h-6 text-orange-500" />
                                Quản lý Kho tổng
                            </h1>
                            <p className="text-surface-500 mt-1 text-sm">Danh sách các kho trung tâm trong hệ thống</p>
                        </div>
                        <button onClick={openCreate}
                            className="flex items-center gap-2 bg-orange-600 hover:bg-orange-700 text-white px-4 py-2.5 rounded-xl font-semibold text-sm shadow-md shadow-orange-500/20 transition-all">
                            <Plus className="w-4 h-4" /> Thêm Kho
                        </button>
                    </div>
                }
            />

            {/* Message */}
            {msg.text && (
                <div className={`flex items-center gap-2 p-3 rounded-xl border text-sm font-medium ${msg.type === 'error' ? 'bg-danger-50 text-danger-700 border-danger-200' : 'bg-success-50 text-success-700 border-success-200'}`}>
                    {msg.type === 'error' ? <AlertCircle className="w-4 h-4" /> : <CheckCircle2 className="w-4 h-4" />}
                    {msg.text}
                    <button onClick={() => setMsg({ type: '', text: '' })} className="ml-auto"><X className="w-4 h-4" /></button>
                </div>
            )}

            {/* Form */}
            {showForm && (
                <div className="bg-white rounded-2xl border border-surface-200 shadow-sm p-6">
                    <h2 className="font-bold text-surface-800 mb-4">{editingId ? 'Chỉnh sửa Kho' : 'Thêm Kho mới'}</h2>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div>
                            <label className="text-xs font-semibold text-surface-600 block mb-1">Tên Kho *</label>
                            <input value={formName} onChange={e => setFormName(e.target.value)}
                                className="w-full border border-surface-200 rounded-lg p-2.5 text-sm outline-none focus:ring-2 focus:ring-orange-300"
                                placeholder="VD: Kho Tổng Bình Dương" />
                        </div>
                        <div>
                            <label className="text-xs font-semibold text-surface-600 block mb-1">Diện tích (m²)</label>
                            <input value={formCapacity} onChange={e => setFormCapacity(e.target.value)}
                                type="number" min="0"
                                className="w-full border border-surface-200 rounded-lg p-2.5 text-sm outline-none focus:ring-2 focus:ring-orange-300"
                                placeholder="VD: 5000" />
                        </div>
                        <div>
                            <label className="text-xs font-semibold text-surface-600 block mb-1">Địa chỉ</label>
                            <input value={formAddress} onChange={e => setFormAddress(e.target.value)}
                                className="w-full border border-surface-200 rounded-lg p-2.5 text-sm outline-none focus:ring-2 focus:ring-orange-300"
                                placeholder="123 Đường ABC, Bình Dương" />
                        </div>
                    </div>
                    <div className="flex gap-3 mt-4">
                        <button onClick={handleSubmit} disabled={submitting}
                            className="flex items-center gap-2 bg-orange-600 hover:bg-orange-700 text-white px-5 py-2 rounded-xl text-sm font-bold transition-all disabled:opacity-60">
                            {submitting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                            {editingId ? 'Lưu thay đổi' : 'Tạo Kho'}
                        </button>
                        <button onClick={resetForm} className="px-4 py-2 rounded-xl text-sm bg-surface-100 hover:bg-surface-200 text-surface-600 font-medium">
                            Hủy
                        </button>
                    </div>
                </div>
            )}

            {/* Table */}
            <div className="bg-white rounded-2xl border border-surface-200 shadow-sm overflow-hidden">
                {loading ? (
                    <div className="flex items-center justify-center py-16 text-surface-400">
                        <Loader2 className="w-6 h-6 animate-spin mr-2" /> Đang tải...
                    </div>
                ) : warehouses.length === 0 ? (
                    <div className="py-16 text-center text-surface-400 text-sm">
                        <Warehouse className="w-10 h-10 mx-auto mb-3 text-surface-200" />
                        Chưa có kho nào. Nhấn "Thêm Kho" để bắt đầu.
                    </div>
                ) : (
                    <table className="w-full text-sm">
                        <thead>
                            <tr className="bg-surface-50 border-b border-surface-200 text-xs text-surface-500 uppercase text-left">
                                <th className="px-5 py-3">Tên Kho</th>
                                <th className="px-5 py-3">Địa chỉ</th>
                                <th className="px-5 py-3">Diện tích</th>
                                <th className="px-5 py-3">Trạng thái</th>
                                <th className="px-5 py-3 text-right">Thao tác</th>
                            </tr>
                        </thead>
                        <tbody>
                            {warehouses.map(wh => (
                                <tr key={wh.id} className="border-b border-surface-100 hover:bg-surface-50/50 transition-colors">
                                    <td className="px-5 py-3 font-semibold text-surface-800">
                                        <span className="mr-1.5">🏭</span>{wh.name}
                                    </td>
                                    <td className="px-5 py-3 text-surface-500">
                                        {wh.address ? <span className="flex items-center gap-1"><MapPin className="w-3 h-3" />{wh.address}</span> : '—'}
                                    </td>
                                    <td className="px-5 py-3 text-surface-500">
                                        {wh.capacitySqm ? <span className="flex items-center gap-1"><Ruler className="w-3 h-3" />{wh.capacitySqm.toLocaleString()} m²</span> : '—'}
                                    </td>
                                    <td className="px-5 py-3">
                                        <span className={`text-xs font-bold px-2 py-1 rounded-full ${wh.isActive ? 'bg-success-100 text-success-700' : 'bg-surface-100 text-surface-500'}`}>
                                            {wh.isActive ? 'Hoạt động' : 'Tạm ngưng'}
                                        </span>
                                    </td>
                                    <td className="px-5 py-3 text-right">
                                        <div className="flex items-center justify-end gap-2">
                                            <button onClick={() => openEdit(wh)}
                                                className="p-2 rounded-lg hover:bg-surface-100 text-surface-500 hover:text-surface-800 transition-colors">
                                                <Pencil className="w-4 h-4" />
                                            </button>
                                            <button onClick={() => toggleActive(wh)}
                                                className={`p-2 rounded-lg transition-colors ${wh.isActive ? 'hover:bg-danger-50 text-danger-400 hover:text-danger-600' : 'hover:bg-success-50 text-success-400 hover:text-success-600'}`}>
                                                {wh.isActive ? <PowerOff className="w-4 h-4" /> : <Power className="w-4 h-4" />}
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                )}
            </div>
        </div>
    );
}
