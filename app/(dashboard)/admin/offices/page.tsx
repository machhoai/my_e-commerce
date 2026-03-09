'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { OfficeDoc } from '@/types';
import { Building2, Plus, Pencil, Power, PowerOff, Mail, MapPin, Loader2, X, CheckCircle2, AlertCircle } from 'lucide-react';

export default function AdminOfficesPage() {
    const { user, userDoc } = useAuth();
    const [offices, setOffices] = useState<OfficeDoc[]>([]);
    const [loading, setLoading] = useState(true);
    const [showForm, setShowForm] = useState(false);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [submitting, setSubmitting] = useState(false);
    const [msg, setMsg] = useState({ type: '', text: '' });

    const [formName, setFormName] = useState('');
    const [formAddress, setFormAddress] = useState('');
    const [formEmail, setFormEmail] = useState('');

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

    useEffect(() => { fetchOffices(); }, [fetchOffices]);

    const resetForm = () => {
        setFormName(''); setFormAddress(''); setFormEmail('');
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
        setShowForm(true);
    };

    const handleSubmit = async () => {
        if (!formName.trim()) { setMsg({ type: 'error', text: 'Tên văn phòng là bắt buộc' }); return; }
        setSubmitting(true);
        try {
            const token = await getToken();
            const body = { id: editingId || undefined, name: formName, address: formAddress, contactEmail: formEmail };
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
        return <div className="p-8 text-red-500 font-bold">Không có quyền truy cập.</div>;
    }

    return (
        <div className="space-y-6 pb-12">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
                        <Building2 className="w-6 h-6 text-teal-500" />
                        Quản lý Văn phòng
                    </h1>
                    <p className="text-slate-500 mt-1 text-sm">Danh sách các văn phòng trong hệ thống</p>
                </div>
                <button onClick={openCreate}
                    className="flex items-center gap-2 bg-teal-600 hover:bg-teal-700 text-white px-4 py-2.5 rounded-xl font-semibold text-sm shadow-md shadow-teal-500/20 transition-all">
                    <Plus className="w-4 h-4" /> Thêm Văn phòng
                </button>
            </div>

            {/* Message */}
            {msg.text && (
                <div className={`flex items-center gap-2 p-3 rounded-xl border text-sm font-medium ${msg.type === 'error' ? 'bg-red-50 text-red-700 border-red-200' : 'bg-emerald-50 text-emerald-700 border-emerald-200'}`}>
                    {msg.type === 'error' ? <AlertCircle className="w-4 h-4" /> : <CheckCircle2 className="w-4 h-4" />}
                    {msg.text}
                    <button onClick={() => setMsg({ type: '', text: '' })} className="ml-auto"><X className="w-4 h-4" /></button>
                </div>
            )}

            {/* Form */}
            {showForm && (
                <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
                    <h2 className="font-bold text-slate-800 mb-4">{editingId ? 'Chỉnh sửa Văn phòng' : 'Thêm Văn phòng mới'}</h2>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <label className="text-xs font-semibold text-slate-600 block mb-1">Tên Văn phòng *</label>
                            <input value={formName} onChange={e => setFormName(e.target.value)}
                                className="w-full border border-slate-200 rounded-lg p-2.5 text-sm outline-none focus:ring-2 focus:ring-teal-300"
                                placeholder="VD: Văn phòng HQ" />
                        </div>
                        <div>
                            <label className="text-xs font-semibold text-slate-600 block mb-1">Email liên hệ</label>
                            <input value={formEmail} onChange={e => setFormEmail(e.target.value)}
                                type="email"
                                className="w-full border border-slate-200 rounded-lg p-2.5 text-sm outline-none focus:ring-2 focus:ring-teal-300"
                                placeholder="office@company.com" />
                        </div>
                        <div className="md:col-span-2">
                            <label className="text-xs font-semibold text-slate-600 block mb-1">Địa chỉ</label>
                            <input value={formAddress} onChange={e => setFormAddress(e.target.value)}
                                className="w-full border border-slate-200 rounded-lg p-2.5 text-sm outline-none focus:ring-2 focus:ring-teal-300"
                                placeholder="123 Đường ABC, Quận X, TP.HCM" />
                        </div>
                    </div>
                    <div className="flex gap-3 mt-4">
                        <button onClick={handleSubmit} disabled={submitting}
                            className="flex items-center gap-2 bg-teal-600 hover:bg-teal-700 text-white px-5 py-2 rounded-xl text-sm font-bold transition-all disabled:opacity-60">
                            {submitting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                            {editingId ? 'Lưu thay đổi' : 'Tạo Văn phòng'}
                        </button>
                        <button onClick={resetForm} className="px-4 py-2 rounded-xl text-sm bg-slate-100 hover:bg-slate-200 text-slate-600 font-medium">
                            Hủy
                        </button>
                    </div>
                </div>
            )}

            {/* Table */}
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                {loading ? (
                    <div className="flex items-center justify-center py-16 text-slate-400">
                        <Loader2 className="w-6 h-6 animate-spin mr-2" /> Đang tải...
                    </div>
                ) : offices.length === 0 ? (
                    <div className="py-16 text-center text-slate-400 text-sm">
                        <Building2 className="w-10 h-10 mx-auto mb-3 text-slate-200" />
                        Chưa có văn phòng nào. Nhấn "Thêm Văn phòng" để bắt đầu.
                    </div>
                ) : (
                    <table className="w-full text-sm">
                        <thead>
                            <tr className="bg-slate-50 border-b border-slate-200 text-xs text-slate-500 uppercase text-left">
                                <th className="px-5 py-3">Tên Văn phòng</th>
                                <th className="px-5 py-3">Địa chỉ</th>
                                <th className="px-5 py-3">Email</th>
                                <th className="px-5 py-3">Trạng thái</th>
                                <th className="px-5 py-3 text-right">Thao tác</th>
                            </tr>
                        </thead>
                        <tbody>
                            {offices.map(office => (
                                <tr key={office.id} className="border-b border-slate-100 hover:bg-slate-50/50 transition-colors">
                                    <td className="px-5 py-3 font-semibold text-slate-800">
                                        <span className="mr-1.5">🏢</span>{office.name}
                                    </td>
                                    <td className="px-5 py-3 text-slate-500">
                                        {office.address ? <span className="flex items-center gap-1"><MapPin className="w-3 h-3" />{office.address}</span> : '—'}
                                    </td>
                                    <td className="px-5 py-3 text-slate-500">
                                        {office.contactEmail ? <span className="flex items-center gap-1"><Mail className="w-3 h-3" />{office.contactEmail}</span> : '—'}
                                    </td>
                                    <td className="px-5 py-3">
                                        <span className={`text-xs font-bold px-2 py-1 rounded-full ${office.isActive ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}>
                                            {office.isActive ? 'Hoạt động' : 'Tạm ngưng'}
                                        </span>
                                    </td>
                                    <td className="px-5 py-3 text-right">
                                        <div className="flex items-center justify-end gap-2">
                                            <button onClick={() => openEdit(office)}
                                                className="p-2 rounded-lg hover:bg-slate-100 text-slate-500 hover:text-slate-800 transition-colors">
                                                <Pencil className="w-4 h-4" />
                                            </button>
                                            <button onClick={() => toggleActive(office)}
                                                className={`p-2 rounded-lg transition-colors ${office.isActive ? 'hover:bg-red-50 text-red-400 hover:text-red-600' : 'hover:bg-emerald-50 text-emerald-400 hover:text-emerald-600'}`}>
                                                {office.isActive ? <PowerOff className="w-4 h-4" /> : <Power className="w-4 h-4" />}
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
