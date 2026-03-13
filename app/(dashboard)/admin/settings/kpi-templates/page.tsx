'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { KpiTemplateDoc, KpiGroup, KpiCriteria, StoreDoc, CounterDoc } from '@/types';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import {
    ClipboardList, Plus, Trash2, Save, X, CheckCircle2, AlertCircle,
    RefreshCw, ChevronDown, ChevronUp, Building2, Layers,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { DashboardHeader } from '@/components/inventory/overview/DashboardHeader';

export default function KpiTemplatesPage() {
    const { user, userDoc, getToken } = useAuth();

    const [templates, setTemplates] = useState<KpiTemplateDoc[]>([]);
    const [counters, setCounters] = useState<CounterDoc[]>([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');

    // Admin store selector
    const [stores, setStores] = useState<StoreDoc[]>([]);
    const [selectedStoreId, setSelectedStoreId] = useState(() => {
        if (typeof window !== 'undefined') return localStorage.getItem('globalSelectedStoreId') || '';
        return '';
    });
    const effectiveStoreId = userDoc?.role === 'admin' ? selectedStoreId : userDoc?.storeId ?? '';

    // Form state
    const [formMode, setFormMode] = useState<'create' | 'edit'>('create');
    const [editingId, setEditingId] = useState<string | null>(null);
    const [formName, setFormName] = useState('');
    const [formGroups, setFormGroups] = useState<KpiGroup[]>([{ name: 'Nhóm 1', criteria: [{ name: '', maxScore: 10 }] }]);
    const [formCounterIds, setFormCounterIds] = useState<Set<string>>(new Set());
    const [expandedTemplate, setExpandedTemplate] = useState<string | null>(null);

    // Computed total
    const totalScore = formGroups.reduce((sum, g) => sum + g.criteria.reduce((s, c) => s + (c.maxScore || 0), 0), 0);
    const isValid = totalScore === 100 && formName.trim().length > 0 && formGroups.every(g => g.name.trim() && g.criteria.every(c => c.name.trim() && c.maxScore > 0));

    const fetchStores = useCallback(async () => {
        if (userDoc?.role !== 'admin' || !user) return;
        try {
            const token = await getToken();
            const res = await fetch('/api/stores', { headers: { Authorization: `Bearer ${token}` } });
            setStores(await res.json());
        } catch { /* noop */ }
    }, [user, userDoc, getToken]);

    const fetchCounters = useCallback(async () => {
        if (!effectiveStoreId) { setCounters([]); return; }
        try {
            const snap = await getDoc(doc(db, 'stores', effectiveStoreId));
            if (snap.exists()) {
                const data = snap.data() as StoreDoc;
                setCounters((data.settings as any)?.counters || []);
            }
        } catch { setCounters([]); }
    }, [effectiveStoreId]);

    const fetchTemplates = useCallback(async () => {
        if (!effectiveStoreId || !user) return;
        setLoading(true);
        try {
            const token = await getToken();
            const res = await fetch(`/api/kpi-templates?storeId=${effectiveStoreId}`, { headers: { Authorization: `Bearer ${token}` } });
            const data = await res.json();
            setTemplates(Array.isArray(data) ? data : []);
        } catch { setError('Không thể tải danh sách mẫu KPI'); } finally { setLoading(false); }
    }, [effectiveStoreId, user, getToken]);

    useEffect(() => { fetchStores(); }, [fetchStores]);
    useEffect(() => { fetchCounters(); fetchTemplates(); }, [fetchCounters, fetchTemplates]);

    const resetForm = () => {
        setFormMode('create');
        setEditingId(null);
        setFormName('');
        setFormGroups([{ name: 'Nhóm 1', criteria: [{ name: '', maxScore: 10 }] }]);
        setFormCounterIds(new Set());
    };

    const startEdit = (t: KpiTemplateDoc) => {
        setFormMode('edit');
        setEditingId(t.id);
        setFormName(t.name);
        setFormGroups(JSON.parse(JSON.stringify(t.groups)));
        setFormCounterIds(new Set(t.assignedCounterIds || []));
    };

    const handleSave = async () => {
        if (!isValid) return;
        setSaving(true); setError(''); setSuccess('');
        try {
            const token = await getToken();
            const payload = { name: formName, storeId: effectiveStoreId, groups: formGroups, assignedCounterIds: Array.from(formCounterIds) };
            const url = formMode === 'edit' && editingId ? `/api/kpi-templates/${editingId}` : '/api/kpi-templates';
            const method = formMode === 'edit' ? 'PUT' : 'POST';
            const res = await fetch(url, { method, headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify(payload) });
            if (!res.ok) { const d = await res.json(); throw new Error(d.error); }
            setSuccess(formMode === 'edit' ? 'Đã cập nhật mẫu KPI!' : 'Đã tạo mẫu KPI mới!');
            resetForm();
            fetchTemplates();
        } catch (err) { setError(err instanceof Error ? err.message : 'Lỗi lưu mẫu KPI'); } finally { setSaving(false); }
    };

    const handleDelete = async (id: string, name: string) => {
        if (!confirm(`Xóa mẫu KPI "${name}"?`)) return;
        try {
            const token = await getToken();
            const res = await fetch(`/api/kpi-templates/${id}`, { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } });
            if (!res.ok) throw new Error('Không thể xóa');
            setSuccess(`Đã xóa mẫu "${name}"`);
            if (editingId === id) resetForm();
            fetchTemplates();
        } catch (err) { setError(err instanceof Error ? err.message : 'Lỗi xóa mẫu KPI'); }
    };

    // Group helpers
    const addGroup = () => setFormGroups([...formGroups, { name: `Nhóm ${formGroups.length + 1}`, criteria: [{ name: '', maxScore: 10 }] }]);
    const removeGroup = (gi: number) => setFormGroups(formGroups.filter((_, i) => i !== gi));
    const updateGroupName = (gi: number, name: string) => {
        const g = [...formGroups]; g[gi] = { ...g[gi], name }; setFormGroups(g);
    };
    const addCriteria = (gi: number) => {
        const g = [...formGroups]; g[gi] = { ...g[gi], criteria: [...g[gi].criteria, { name: '', maxScore: 5 }] }; setFormGroups(g);
    };
    const removeCriteria = (gi: number, ci: number) => {
        const g = [...formGroups]; g[gi] = { ...g[gi], criteria: g[gi].criteria.filter((_, i) => i !== ci) }; setFormGroups(g);
    };
    const updateCriteria = (gi: number, ci: number, field: keyof KpiCriteria, value: string | number) => {
        const g = JSON.parse(JSON.stringify(formGroups)) as KpiGroup[];
        (g[gi].criteria[ci] as any)[field] = value;
        setFormGroups(g);
    };

    const toggleCounter = (id: string) => {
        const s = new Set(formCounterIds);
        s.has(id) ? s.delete(id) : s.add(id);
        setFormCounterIds(s);
    };

    if (!userDoc || (userDoc.role !== 'admin' && userDoc.role !== 'store_manager')) {
        return <div className="p-8 text-center text-danger-500 font-bold">Không có quyền truy cập.</div>;
    }

    return (
        <div className="space-y-6 mx-auto">
            {/* Header */}
            <DashboardHeader
                showSelect={false}
                titleChildren={
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 w-full">
                        <div>
                            <h1 className="text-2xl font-bold bg-gradient-to-r from-teal-600 to-success-600 bg-clip-text text-transparent flex items-center gap-2">
                                <ClipboardList className="w-7 h-7 text-teal-600" />
                                Quản lý Mẫu KPI
                            </h1>
                            <p className="text-surface-500 mt-1 text-sm">Tạo và quản lý các mẫu chấm điểm KPI cho từng quầy.</p>
                        </div>
                        <button onClick={fetchTemplates} className="p-2 rounded-lg hover:bg-surface-100 text-surface-500 transition-colors shrink-0">
                            <RefreshCw className="w-4 h-4" />
                        </button>
                    </div>
                }
            />

            {/* Admin Store Selector */}
            {userDoc.role === 'admin' && (
                <div className="bg-white rounded-xl border border-surface-200 shadow-sm p-3 flex items-center gap-3">
                    <Building2 className="w-4 h-4 text-accent-500" />
                    <select value={selectedStoreId} onChange={e => setSelectedStoreId(e.target.value)}
                        className="flex-1 border border-surface-200 rounded-lg p-2 text-sm outline-none focus:ring-2 focus:ring-accent-300">
                        <option value="">-- Chọn cửa hàng --</option>
                        {stores.map(s => <option key={s.id} value={s.id}>{(s as any).type === 'OFFICE' ? '🏢' : (s as any).type === 'CENTRAL' ? '🏭' : '🏪'} {s.name}</option>)}
                    </select>
                </div>
            )}

            {/* Alerts */}
            {error && <div className="bg-danger-50 text-danger-600 p-3 rounded-xl flex items-center gap-2 border border-danger-100">
                <AlertCircle className="w-4 h-4 shrink-0" /><span className="text-sm flex-1">{error}</span>
                <button onClick={() => setError('')}><X className="w-4 h-4" /></button>
            </div>}
            {success && <div className="bg-success-50 text-success-700 p-3 rounded-xl flex items-center gap-2 border border-success-100">
                <CheckCircle2 className="w-4 h-4 shrink-0" /><span className="text-sm flex-1">{success}</span>
                <button onClick={() => setSuccess('')}><X className="w-4 h-4" /></button>
            </div>}

            {!effectiveStoreId ? (
                <div className="bg-white border-2 border-dashed border-surface-300 rounded-2xl p-12 text-center text-surface-400">
                    <Building2 className="w-12 h-12 mx-auto mb-3 text-surface-300" />
                    <p className="font-semibold">Chọn cửa hàng để quản lý mẫu KPI</p>
                </div>
            ) : (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    {/* Left – Form */}
                    <div className="bg-white border border-surface-200 rounded-2xl p-6 shadow-sm">
                        <h2 className="text-base font-bold text-surface-800 mb-4 flex items-center gap-2">
                            {formMode === 'edit' ? <Save className="w-4 h-4 text-teal-500" /> : <Plus className="w-4 h-4 text-teal-500" />}
                            {formMode === 'edit' ? 'Sửa Mẫu KPI' : 'Tạo Mẫu KPI'}
                            {formMode === 'edit' && <button onClick={resetForm} className="ml-auto text-xs text-surface-400 hover:text-surface-600">Hủy sửa</button>}
                        </h2>

                        <div className="space-y-4">
                            {/* Name */}
                            <div>
                                <label className="text-xs font-semibold text-surface-600 block mb-1">Tên mẫu KPI</label>
                                <input value={formName} onChange={e => setFormName(e.target.value)} placeholder="VD: Mẫu KPI Quầy Bida"
                                    className="w-full border border-surface-200 rounded-lg p-2.5 text-sm focus:ring-2 focus:ring-teal-500/20 focus:border-teal-400 outline-none" />
                            </div>

                            {/* Counter Selector */}
                            <div>
                                <label className="text-xs font-semibold text-surface-600 block mb-2">Quầy áp dụng</label>
                                <div className="flex flex-wrap gap-2">
                                    {counters.length === 0 ? <span className="text-xs text-surface-400 italic">Chưa có quầy nào</span> : counters.map(c => (
                                        <label key={c.id} className={cn(
                                            'flex items-center gap-1.5 px-3 py-1.5 rounded-lg border cursor-pointer text-sm transition-colors',
                                            formCounterIds.has(c.id) ? 'bg-teal-50 border-teal-300 text-teal-700 font-semibold' : 'border-surface-200 hover:border-teal-200'
                                        )}>
                                            <input type="checkbox" className="accent-teal-600" checked={formCounterIds.has(c.id)} onChange={() => toggleCounter(c.id)} />
                                            {c.name}
                                        </label>
                                    ))}
                                </div>
                            </div>

                            {/* Groups & Criteria */}
                            <div>
                                <div className="flex items-center justify-between mb-2">
                                    <label className="text-xs font-semibold text-surface-600">Nhóm tiêu chí</label>
                                    <div className={cn(
                                        'text-xs font-bold px-2.5 py-1 rounded-full border',
                                        totalScore === 100 ? 'text-success-700 bg-success-50 border-success-200' :
                                            totalScore > 100 ? 'text-danger-700 bg-danger-50 border-danger-200' :
                                                'text-warning-700 bg-warning-50 border-warning-200'
                                    )}>
                                        Tổng: {totalScore}/100
                                    </div>
                                </div>

                                <div className="space-y-3 max-h-[400px] overflow-y-auto pr-1">
                                    {formGroups.map((group, gi) => (
                                        <div key={gi} className="border border-surface-200 rounded-xl p-3 bg-surface-50/50">
                                            <div className="flex items-center gap-2 mb-2">
                                                <Layers className="w-4 h-4 text-teal-500 shrink-0" />
                                                <input value={group.name} onChange={e => updateGroupName(gi, e.target.value)} placeholder="Tên nhóm"
                                                    className="flex-1 text-sm font-semibold border border-surface-200 rounded-lg px-2.5 py-1.5 focus:ring-2 focus:ring-teal-500/20 outline-none" />
                                                {formGroups.length > 1 && (
                                                    <button onClick={() => removeGroup(gi)} className="p-1 text-danger-400 hover:text-danger-600 rounded"><Trash2 className="w-3.5 h-3.5" /></button>
                                                )}
                                            </div>

                                            <div className="space-y-1.5 ml-6">
                                                {group.criteria.map((c, ci) => (
                                                    <div key={ci} className="flex items-center gap-2">
                                                        <input value={c.name} onChange={e => updateCriteria(gi, ci, 'name', e.target.value)} placeholder="Tiêu chí..."
                                                            className="flex-1 text-sm border border-surface-200 rounded-lg px-2.5 py-1.5 outline-none focus:ring-2 focus:ring-teal-500/20" />
                                                        <div className="flex items-center gap-1">
                                                            <input type="number" min={1} max={100} value={c.maxScore}
                                                                onChange={e => updateCriteria(gi, ci, 'maxScore', Math.max(1, parseInt(e.target.value) || 0))}
                                                                className="w-16 text-sm text-center border border-surface-200 rounded-lg px-2 py-1.5 outline-none focus:ring-2 focus:ring-teal-500/20 font-bold" />
                                                            <span className="text-xs text-surface-400">đ</span>
                                                        </div>
                                                        {group.criteria.length > 1 && (
                                                            <button onClick={() => removeCriteria(gi, ci)} className="p-0.5 text-danger-400 hover:text-danger-600"><X className="w-3.5 h-3.5" /></button>
                                                        )}
                                                    </div>
                                                ))}
                                                <button onClick={() => addCriteria(gi)} className="text-xs text-teal-600 hover:text-teal-700 font-semibold mt-1 flex items-center gap-1">
                                                    <Plus className="w-3 h-3" /> Thêm tiêu chí
                                                </button>
                                            </div>
                                        </div>
                                    ))}
                                </div>

                                <button onClick={addGroup} className="mt-2 text-sm text-teal-600 hover:text-teal-700 font-semibold flex items-center gap-1">
                                    <Plus className="w-4 h-4" /> Thêm nhóm
                                </button>
                            </div>

                            {/* Save */}
                            <button onClick={handleSave} disabled={saving || !isValid}
                                className="w-full bg-teal-600 hover:bg-teal-700 disabled:opacity-50 text-white py-2.5 rounded-xl font-semibold text-sm flex items-center justify-center gap-2 transition-colors">
                                {saving ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> : <Save className="w-4 h-4" />}
                                {formMode === 'edit' ? 'Cập nhật Mẫu' : 'Tạo Mẫu'}
                            </button>
                            {!isValid && formName.trim() && (
                                <p className="text-xs text-warning-600 text-center">
                                    {totalScore !== 100 ? `Tổng điểm phải bằng 100 (hiện tại: ${totalScore})` : 'Vui lòng điền đầy đủ tên nhóm và tiêu chí'}
                                </p>
                            )}
                        </div>
                    </div>

                    {/* Right – Existing Templates */}
                    <div className="space-y-3">
                        <h2 className="text-base font-bold text-surface-800 flex items-center gap-2">
                            <ClipboardList className="w-4 h-4 text-teal-500" /> Danh sách Mẫu
                            <span className="ml-auto text-xs text-surface-400 font-normal">{templates.length} mẫu</span>
                        </h2>

                        {loading ? (
                            <div className="flex justify-center py-8"><div className="w-6 h-6 border-4 border-teal-500 border-t-transparent rounded-full animate-spin" /></div>
                        ) : templates.length === 0 ? (
                            <div className="bg-surface-50 border border-dashed border-surface-300 rounded-2xl p-8 text-center text-surface-400 text-sm">
                                Chưa có mẫu KPI nào. Tạo mẫu đầu tiên →
                            </div>
                        ) : templates.map(t => (
                            <div key={t.id} className="bg-white border border-surface-200 rounded-2xl p-4 shadow-sm">
                                <div className="flex items-start justify-between">
                                    <div className="flex-1 min-w-0 cursor-pointer" onClick={() => setExpandedTemplate(expandedTemplate === t.id ? null : t.id)}>
                                        <div className="flex items-center gap-2">
                                            <h3 className="font-bold text-surface-800 truncate">{t.name}</h3>
                                            {expandedTemplate === t.id ? <ChevronUp className="w-4 h-4 text-surface-400 shrink-0" /> : <ChevronDown className="w-4 h-4 text-surface-400 shrink-0" />}
                                        </div>
                                        <p className="text-xs text-surface-400 mt-0.5">{t.groups.length} nhóm · {t.groups.reduce((s, g) => s + g.criteria.length, 0)} tiêu chí · {t.assignedCounterIds?.length || 0} quầy</p>
                                    </div>
                                    <div className="flex gap-1 shrink-0 ml-2">
                                        <button onClick={() => startEdit(t)} className="p-1.5 rounded-lg hover:bg-teal-50 hover:text-teal-600 text-surface-400 transition-colors"><Save className="w-4 h-4" /></button>
                                        <button onClick={() => handleDelete(t.id, t.name)} className="p-1.5 rounded-lg hover:bg-danger-50 hover:text-danger-500 text-surface-400 transition-colors"><Trash2 className="w-4 h-4" /></button>
                                    </div>
                                </div>

                                {/* Expanded view */}
                                {expandedTemplate === t.id && (
                                    <div className="mt-3 pt-3 border-t border-surface-100 space-y-2">
                                        {t.groups.map((g, gi) => (
                                            <div key={gi}>
                                                <p className="text-xs font-bold text-teal-700 mb-1">{g.name}</p>
                                                <div className="space-y-0.5 ml-3">
                                                    {g.criteria.map((c, ci) => (
                                                        <div key={ci} className="flex justify-between text-xs text-surface-600">
                                                            <span>{c.name}</span>
                                                            <span className="font-bold text-surface-800">{c.maxScore}đ</span>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        ))}
                                        {(t.assignedCounterIds?.length ?? 0) > 0 && (
                                            <div className="flex flex-wrap gap-1 pt-2 border-t border-surface-100">
                                                {t.assignedCounterIds.map(cid => {
                                                    const c = counters.find(x => x.id === cid);
                                                    return <span key={cid} className="text-[10px] bg-teal-100 text-teal-700 px-2 py-0.5 rounded-full font-medium">{c?.name ?? cid}</span>;
                                                })}
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
}
