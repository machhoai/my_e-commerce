'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { OfficeDoc, StoreDoc } from '@/types';
import { Building2, Plus, Pencil, Power, PowerOff, Mail, MapPin, Loader2, X, CheckCircle2, AlertCircle, Store, ChevronDown, ChevronUp } from 'lucide-react';
import { DashboardHeader } from '@/components/inventory/overview/DashboardHeader';

export default function AdminOfficesPage() {
    const { user, userDoc } = useAuth();
    const [offices, setOffices] = useState<OfficeDoc[]>([]);
    const [stores, setStores] = useState<StoreDoc[]>([]);
    const [loading, setLoading] = useState(true);
    const [showForm, setShowForm] = useState(false);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [submitting, setSubmitting] = useState(false);
    const [msg, setMsg] = useState({ type: '', text: '' });
    const [expandedOfficeId, setExpandedOfficeId] = useState<string | null>(null);

    const [formName, setFormName] = useState('');
    const [formAddress, setFormAddress] = useState('');
    const [formEmail, setFormEmail] = useState('');
    const [formManagedStoreIds, setFormManagedStoreIds] = useState<string[]>([]);

    const getToken = useCallback(() => user?.getIdToken(), [user]);

    const fetchOffices = useCallback(async () => {
        try {
            const token = await getToken();
            const res = await fetch('/api/offices', { headers: { Authorization: `Bearer ${token}` } });
            const data = await res.json();
            setOffices(Array.isArray(data) ? data : []);
        } catch { /* silent */ } finally {
            setLoading(false);
        }
    }, [getToken]);

    const fetchStores = useCallback(async () => {
        try {
            const token = await getToken();
            const res = await fetch('/api/stores', { headers: { Authorization: `Bearer ${token}` } });
            const data = await res.json();
            setStores(Array.isArray(data) ? data.filter((s: StoreDoc) => s.isActive !== false) : []);
        } catch { /* silent */ }
    }, [getToken]);

    useEffect(() => { fetchOffices(); fetchStores(); }, [fetchOffices, fetchStores]);

    const resetForm = () => {
        setFormName(''); setFormAddress(''); setFormEmail(''); setFormManagedStoreIds([]);
        setEditingId(null); setShowForm(false);
    };

    const openCreate = () => {
        resetForm();
        setShowForm(true);
    };

    const openEdit = (office: OfficeDoc) => {
        setEditingId(office.id);
        setFormName(office.name);
        setFormAddress(office.address || '');
        setFormEmail(office.contactEmail || '');
        setFormManagedStoreIds(office.managedStoreIds ?? []);
        setShowForm(true);
    };

    const toggleStoreSelection = (storeId: string) => {
        setFormManagedStoreIds(prev =>
            prev.includes(storeId) ? prev.filter(id => id !== storeId) : [...prev, storeId]
        );
    };

    const selectAllStores = () => setFormManagedStoreIds(stores.map(s => s.id));
    const clearAllStores = () => setFormManagedStoreIds([]);

    const handleSubmit = async () => {
        if (!formName.trim()) { setMsg({ type: 'error', text: 'Tên văn phòng là bắt buộc' }); return; }
        setSubmitting(true);
        try {
            const token = await getToken();
            const body = {
                id: editingId || undefined,
                name: formName,
                address: formAddress,
                contactEmail: formEmail,
                managedStoreIds: formManagedStoreIds,
            };
            const res = await fetch('/api/offices', {
                method: editingId ? 'PUT' : 'POST',
                headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
                body: JSON.stringify(body),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error);
            setMsg({ type: 'success', text: editingId ? 'Đã cập nhật văn phòng' : 'Đã thêm văn phòng mới' });
            resetForm();
            fetchOffices();
        } catch (err: any) {
            setMsg({ type: 'error', text: err.message });
        } finally {
            setSubmitting(false);
        }
    };

    const toggleActive = async (office: OfficeDoc) => {
        try {
            const token = await getToken();
            await fetch('/api/offices', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
                body: JSON.stringify({ id: office.id, isActive: !office.isActive }),
            });
            fetchOffices();
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
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 w-full">
                        <div>
                            <h1 className="text-2xl font-bold bg-gradient-to-r from-teal-600 to-success-600 bg-clip-text text-transparent flex items-center gap-2">
                                <Building2 className="w-6 h-6 text-teal-500" />
                                Quản lý Văn phòng
                            </h1>
                            <p className="text-surface-500 mt-1 text-sm">Danh sách và phân quyền cửa hàng cho từng văn phòng</p>
                        </div>
                        <button onClick={openCreate}
                            className="flex items-center gap-2 bg-teal-600 hover:bg-teal-700 text-white px-4 py-2.5 rounded-xl font-semibold text-sm shadow-md shadow-teal-500/20 transition-all shrink-0">
                            <Plus className="w-4 h-4" /> Thêm Văn phòng
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
                <div className="bg-white rounded-2xl border border-surface-200 shadow-sm p-6 space-y-5">
                    <h2 className="font-bold text-surface-800 text-lg">{editingId ? 'Chỉnh sửa Văn phòng' : 'Thêm Văn phòng mới'}</h2>

                    {/* Basic Fields */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <label className="text-xs font-semibold text-surface-600 block mb-1">Tên Văn phòng *</label>
                            <input value={formName} onChange={e => setFormName(e.target.value)}
                                className="w-full border border-surface-200 rounded-lg p-2.5 text-sm outline-none focus:ring-2 focus:ring-teal-300"
                                placeholder="VD: Văn phòng HQ" />
                        </div>
                        <div>
                            <label className="text-xs font-semibold text-surface-600 block mb-1">Email liên hệ</label>
                            <input value={formEmail} onChange={e => setFormEmail(e.target.value)}
                                type="email"
                                className="w-full border border-surface-200 rounded-lg p-2.5 text-sm outline-none focus:ring-2 focus:ring-teal-300"
                                placeholder="office@company.com" />
                        </div>
                        <div className="md:col-span-2">
                            <label className="text-xs font-semibold text-surface-600 block mb-1">Địa chỉ</label>
                            <input value={formAddress} onChange={e => setFormAddress(e.target.value)}
                                className="w-full border border-surface-200 rounded-lg p-2.5 text-sm outline-none focus:ring-2 focus:ring-teal-300"
                                placeholder="123 Đường ABC, Quận X, TP.HCM" />
                        </div>
                    </div>

                    {/* Managed Stores Multi-Select */}
                    <div>
                        <div className="flex items-center justify-between mb-2">
                            <label className="text-xs font-semibold text-surface-600 flex items-center gap-1.5">
                                <Store className="w-3.5 h-3.5 text-teal-500" />
                                Cửa hàng được quản lý
                                {formManagedStoreIds.length > 0 && (
                                    <span className="ml-1 bg-teal-100 text-teal-700 text-[10px] font-bold px-1.5 py-0.5 rounded-full">
                                        {formManagedStoreIds.length} đã chọn
                                    </span>
                                )}
                            </label>
                            <div className="flex gap-2">
                                <button type="button" onClick={selectAllStores}
                                    className="text-[11px] text-teal-600 hover:text-teal-800 font-medium px-2 py-0.5 bg-teal-50 hover:bg-teal-100 rounded-lg transition-colors">
                                    Tất cả
                                </button>
                                <button type="button" onClick={clearAllStores}
                                    className="text-[11px] text-surface-500 hover:text-surface-700 font-medium px-2 py-0.5 bg-surface-100 hover:bg-surface-200 rounded-lg transition-colors">
                                    Bỏ chọn
                                </button>
                            </div>
                        </div>
                        {stores.length === 0 ? (
                            <p className="text-xs text-surface-400 italic py-3 text-center bg-surface-50 rounded-lg border border-dashed">Không có cửa hàng nào</p>
                        ) : (
                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 max-h-56 overflow-y-auto pr-1 custom-scrollbar">
                                {stores.map(store => {
                                    const selected = formManagedStoreIds.includes(store.id);
                                    return (
                                        <label key={store.id}
                                            className={`flex items-center gap-2.5 p-3 rounded-xl border cursor-pointer transition-all select-none ${selected
                                                ? 'bg-teal-50 border-teal-300 ring-1 ring-teal-300'
                                                : 'bg-surface-50 border-surface-200 hover:border-teal-200 hover:bg-teal-50/50'
                                            }`}>
                                            <input
                                                type="checkbox"
                                                checked={selected}
                                                onChange={() => toggleStoreSelection(store.id)}
                                                className="w-4 h-4 text-teal-600 rounded focus:ring-teal-500 cursor-pointer shrink-0"
                                            />
                                            <span className={`text-sm font-medium truncate ${selected ? 'text-teal-800' : 'text-surface-700'}`}>
                                                🏪 {store.name}
                                            </span>
                                        </label>
                                    );
                                })}
                            </div>
                        )}
                        <p className="text-[10px] text-surface-400 mt-1.5">
                            Nhân viên thuộc văn phòng này sẽ có thể xem dữ liệu của những cửa hàng được chọn trên.
                        </p>
                    </div>

                    <div className="flex gap-3 pt-1">
                        <button onClick={handleSubmit} disabled={submitting}
                            className="flex items-center gap-2 bg-teal-600 hover:bg-teal-700 text-white px-5 py-2 rounded-xl text-sm font-bold transition-all disabled:opacity-60">
                            {submitting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                            {editingId ? 'Lưu thay đổi' : 'Tạo Văn phòng'}
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
                ) : offices.length === 0 ? (
                    <div className="py-16 text-center text-surface-400 text-sm">
                        <Building2 className="w-10 h-10 mx-auto mb-3 text-surface-200" />
                        Chưa có văn phòng nào. Nhấn "Thêm Văn phòng" để bắt đầu.
                    </div>
                ) : (
                    <table className="w-full text-sm">
                        <thead>
                            <tr className="bg-surface-50 border-b border-surface-200 text-xs text-surface-500 uppercase text-left">
                                <th className="px-5 py-3">Tên Văn phòng</th>
                                <th className="px-5 py-3">Địa chỉ</th>
                                <th className="px-5 py-3">Email</th>
                                <th className="px-5 py-3">Cửa hàng quản lý</th>
                                <th className="px-5 py-3">Trạng thái</th>
                                <th className="px-5 py-3 text-right">Thao tác</th>
                            </tr>
                        </thead>
                        <tbody>
                            {offices.map(office => {
                                const officeStores = stores.filter(s => office.managedStoreIds?.includes(s.id));
                                const isExpanded = expandedOfficeId === office.id;
                                return (
                                    <>
                                        <tr key={office.id} className="border-b border-surface-100 hover:bg-surface-50/50 transition-colors">
                                            <td className="px-5 py-3 font-semibold text-surface-800">
                                                <span className="mr-1.5">🏢</span>{office.name}
                                            </td>
                                            <td className="px-5 py-3 text-surface-500">
                                                {office.address ? <span className="flex items-center gap-1"><MapPin className="w-3 h-3" />{office.address}</span> : '—'}
                                            </td>
                                            <td className="px-5 py-3 text-surface-500">
                                                {office.contactEmail ? <span className="flex items-center gap-1"><Mail className="w-3 h-3" />{office.contactEmail}</span> : '—'}
                                            </td>
                                            <td className="px-5 py-3">
                                                {officeStores.length === 0 ? (
                                                    <span className="text-xs text-surface-400 italic">Chưa phân quyền</span>
                                                ) : (
                                                    <button
                                                        onClick={() => setExpandedOfficeId(isExpanded ? null : office.id)}
                                                        className="flex items-center gap-1 text-xs font-semibold text-teal-600 bg-teal-50 hover:bg-teal-100 border border-teal-200 px-2.5 py-1 rounded-full transition-colors"
                                                    >
                                                        <Store className="w-3 h-3" />
                                                        {officeStores.length} cửa hàng
                                                        {isExpanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                                                    </button>
                                                )}
                                            </td>
                                            <td className="px-5 py-3">
                                                <span className={`text-xs font-bold px-2 py-1 rounded-full ${office.isActive ? 'bg-success-100 text-success-700' : 'bg-surface-100 text-surface-500'}`}>
                                                    {office.isActive ? 'Hoạt động' : 'Tạm ngưng'}
                                                </span>
                                            </td>
                                            <td className="px-5 py-3 text-right">
                                                <div className="flex items-center justify-end gap-2">
                                                    <button onClick={() => openEdit(office)}
                                                        className="p-2 rounded-lg hover:bg-surface-100 text-surface-500 hover:text-surface-800 transition-colors">
                                                        <Pencil className="w-4 h-4" />
                                                    </button>
                                                    <button onClick={() => toggleActive(office)}
                                                        className={`p-2 rounded-lg transition-colors ${office.isActive ? 'hover:bg-danger-50 text-danger-400 hover:text-danger-600' : 'hover:bg-success-50 text-success-400 hover:text-success-600'}`}>
                                                        {office.isActive ? <PowerOff className="w-4 h-4" /> : <Power className="w-4 h-4" />}
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                        {isExpanded && officeStores.length > 0 && (
                                            <tr key={`${office.id}-stores`} className="bg-teal-50/30 border-b border-teal-100">
                                                <td colSpan={6} className="px-8 py-3">
                                                    <div className="flex flex-wrap gap-2">
                                                        {officeStores.map(s => (
                                                            <span key={s.id} className="inline-flex items-center gap-1 text-xs bg-white border border-teal-200 text-teal-700 font-medium px-2.5 py-1 rounded-lg">
                                                                🏪 {s.name}
                                                            </span>
                                                        ))}
                                                    </div>
                                                </td>
                                            </tr>
                                        )}
                                    </>
                                );
                            })}
                        </tbody>
                    </table>
                )}
            </div>
        </div>
    );
}
