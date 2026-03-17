'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { CustomRoleDoc, ALL_PERMISSIONS } from '@/types';
import { Shield, Plus, Trash2, Pencil, Save, X, CheckCircle2, AlertCircle, RefreshCw, Lock, ChevronDown, ChevronUp, Users, Eye, Zap } from 'lucide-react';
import { cn } from '@/lib/utils';
import { DashboardHeader } from '@/components/inventory/overview/DashboardHeader';

const COLOR_OPTIONS = [
    { value: 'red',     label: 'Đỏ',      className: 'bg-danger-100 text-danger-700 border-danger-200' },
    { value: 'purple',  label: 'Tím',      className: 'bg-accent-100 text-accent-700 border-accent-200' },
    { value: 'amber',   label: 'Vàng',     className: 'bg-warning-100 text-warning-700 border-warning-200' },
    { value: 'blue',    label: 'Xanh',     className: 'bg-primary-100 text-primary-700 border-primary-200' },
    { value: 'emerald', label: 'Xanh lá',  className: 'bg-success-100 text-success-700 border-success-200' },
    { value: 'pink',    label: 'Hồng',     className: 'bg-pink-100 text-pink-700 border-pink-200' },
    { value: 'slate',   label: 'Xám',      className: 'bg-surface-100 text-surface-700 border-surface-200' },
];

const BADGE_COLOR: Record<string, string> = {
    red:     'bg-danger-100 text-danger-700 border-danger-200',
    purple:  'bg-accent-100 text-accent-700 border-accent-200',
    amber:   'bg-warning-100 text-warning-700 border-warning-200',
    blue:    'bg-primary-100 text-primary-700 border-primary-200',
    emerald: 'bg-success-100 text-success-700 border-success-200',
    pink:    'bg-pink-100 text-pink-700 border-pink-200',
    slate:   'bg-surface-100 text-surface-700 border-surface-200',
};

const CARD_BG: Record<string, string> = {
    red:     'border-danger-200 bg-danger-50/30',
    purple:  'border-accent-200 bg-accent-50/30',
    amber:   'border-warning-200 bg-warning-50/30',
    blue:    'border-primary-200 bg-primary-50/30',
    emerald: 'border-success-200 bg-success-50/30',
    pink:    'border-pink-200 bg-pink-50/30',
    slate:   'border-surface-200 bg-surface-50/30',
};

// Group permissions by category
const permissionGroups = Array.from(new Set(ALL_PERMISSIONS.map(p => p.group)));

// ─── Permission Picker Component ──────────────────────────────────────────────
function PermissionPicker({
    selected,
    onChange,
}: {
    selected: Set<string>;
    onChange: (s: Set<string>) => void;
}) {
    const toggle = (key: string) => {
        const next = new Set(selected);
        next.has(key) ? next.delete(key) : next.add(key);
        onChange(next);
    };

    const selectAll = () => onChange(new Set(ALL_PERMISSIONS.map(p => p.key)));
    const clearAll = () => onChange(new Set());

    const selectGroup = (group: string, value: boolean) => {
        const next = new Set(selected);
        ALL_PERMISSIONS.filter(p => p.group === group).forEach(p => {
            value ? next.add(p.key) : next.delete(p.key);
        });
        onChange(next);
    };

    return (
        <div className="space-y-3">
            <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-surface-600">
                    Danh sách quyền ({selected.size}/{ALL_PERMISSIONS.length})
                </span>
                <div className="flex gap-2">
                    <button type="button" onClick={selectAll}
                        className="text-[10px] text-accent-600 hover:underline font-semibold">Chọn tất cả</button>
                    <button type="button" onClick={clearAll}
                        className="text-[10px] text-surface-400 hover:underline">Bỏ hết</button>
                </div>
            </div>

            <div className="space-y-4 max-h-80 overflow-y-auto pr-1 rounded-xl">
                {permissionGroups.map(group => {
                    const groupPerms = ALL_PERMISSIONS.filter(p => p.group === group);
                    const allSelected = groupPerms.every(p => selected.has(p.key));
                    const someSelected = groupPerms.some(p => selected.has(p.key));

                    return (
                        <div key={group} className="border border-surface-200 rounded-xl overflow-hidden">
                            {/* Group header */}
                            <div className="flex items-center justify-between bg-surface-50 px-3 py-2 border-b border-surface-200">
                                <span className="text-xs font-bold text-surface-700">{group}</span>
                                <button type="button"
                                    onClick={() => selectGroup(group, !allSelected)}
                                    className={cn(
                                        'text-[10px] font-semibold px-2 py-0.5 rounded-full border transition-colors',
                                        allSelected
                                            ? 'bg-accent-100 text-accent-700 border-accent-300'
                                            : someSelected
                                                ? 'bg-warning-100 text-warning-700 border-warning-300'
                                                : 'bg-surface-100 text-surface-500 border-surface-200 hover:border-accent-300'
                                    )}>
                                    {allSelected ? '✓ Tất cả' : someSelected ? '~ Một phần' : 'Chọn nhóm'}
                                </button>
                            </div>

                            {/* Permission items */}
                            <div className="divide-y divide-surface-100">
                                {groupPerms.map(p => {
                                    const checked = selected.has(p.key);
                                    return (
                                        <label key={p.key}
                                            className={cn(
                                                'flex items-center gap-3 px-3 py-2.5 cursor-pointer transition-colors',
                                                checked ? 'bg-accent-50' : 'bg-white hover:bg-surface-50'
                                            )}>
                                            <input
                                                type="checkbox"
                                                className="accent-accent-600 shrink-0"
                                                checked={checked}
                                                onChange={() => toggle(p.key)}
                                            />
                                            <div className="flex-1 min-w-0">
                                                <div className="flex items-center gap-1.5 flex-wrap">
                                                    {p.type === 'page' ? (
                                                        <Eye className="w-3 h-3 text-primary-500 shrink-0" />
                                                    ) : (
                                                        <Zap className="w-3 h-3 text-warning-500 shrink-0" />
                                                    )}
                                                    <span className="text-xs font-semibold text-surface-800">{p.label}</span>
                                                    <span className={cn(
                                                        'text-[9px] font-bold px-1.5 py-0.5 rounded-full uppercase',
                                                        p.type === 'page'
                                                            ? 'bg-primary-100 text-primary-600'
                                                            : 'bg-warning-100 text-warning-600'
                                                    )}>
                                                        {p.type === 'page' ? 'Trang' : 'Ghi'}
                                                    </span>
                                                </div>
                                                <p className="text-[10px] text-surface-400 mt-0.5">{p.description}</p>
                                            </div>
                                        </label>
                                    );
                                })}
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function AdminRolesPage() {
    const { user, userDoc, getToken } = useAuth();
    const [roles, setRoles] = useState<CustomRoleDoc[]>([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');

    // Create form state
    const [newRoleName, setNewRoleName] = useState('');
    const [newPerms, setNewPerms] = useState<Set<string>>(new Set());
    const [newCreatorRoles, setNewCreatorRoles] = useState<Set<string>>(new Set(['admin']));
    const [newColor, setNewColor] = useState('slate');
    const [newDefaultRoute, setNewDefaultRoute] = useState('');
    const [newApplicableTo, setNewApplicableTo] = useState<Set<'STORE' | 'OFFICE' | 'CENTRAL'>>(new Set());

    // Edit state
    const [editingId, setEditingId] = useState<string | null>(null);
    const [editName, setEditName] = useState('');
    const [editPerms, setEditPerms] = useState<Set<string>>(new Set());
    const [editCreatorRoles, setEditCreatorRoles] = useState<Set<string>>(new Set());
    const [editColor, setEditColor] = useState('slate');
    const [editDefaultRoute, setEditDefaultRoute] = useState('');
    const [editApplicableTo, setEditApplicableTo] = useState<Set<'STORE' | 'OFFICE' | 'CENTRAL'>>(new Set());

    // Expansion
    const [expandedId, setExpandedId] = useState<string | null>(null);

    const fetchRoles = useCallback(async () => {
        if (!user) return;
        setLoading(true);
        try {
            const token = await getToken();
            const res = await fetch('/api/roles', { headers: { Authorization: `Bearer ${token}` } });
            const data = await res.json();
            setRoles(Array.isArray(data) ? data : []);
        } catch {
            setError('Không thể tải danh sách role');
        } finally {
            setLoading(false);
        }
    }, [user, getToken]);

    useEffect(() => { fetchRoles(); }, [fetchRoles]);

    const showMsg = (type: 'success' | 'error', msg: string) => {
        if (type === 'error') { setError(msg); setSuccess(''); }
        else { setSuccess(msg); setError(''); }
    };

    const handleCreate = async () => {
        if (!newRoleName.trim()) { showMsg('error', 'Tên role không được để trống'); return; }
        setSaving(true); setError(''); setSuccess('');
        try {
            const token = await getToken();
            const res = await fetch('/api/roles', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
                body: JSON.stringify({
                    name: newRoleName.trim(),
                    permissions: Array.from(newPerms),
                    creatorRoles: Array.from(newCreatorRoles),
                    color: newColor,
                    defaultRoute: newDefaultRoute.trim() || undefined,
                    applicableTo: Array.from(newApplicableTo),
                }),
            });
            if (!res.ok) { const d = await res.json(); throw new Error(d.error); }
            setNewRoleName(''); setNewPerms(new Set());
            setNewCreatorRoles(new Set(['admin'])); setNewColor('slate');
            setNewDefaultRoute(''); setNewApplicableTo(new Set());
            showMsg('success', 'Đã tạo role mới!');
            fetchRoles();
        } catch (err) {
            showMsg('error', err instanceof Error ? err.message : 'Lỗi tạo role');
        } finally { setSaving(false); }
    };

    const handleSaveEdit = async (id: string) => {
        setSaving(true); setError(''); setSuccess('');
        try {
            const token = await getToken();
            const res = await fetch(`/api/roles/${id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
                body: JSON.stringify({
                    name: editName,
                    permissions: Array.from(editPerms),
                    creatorRoles: Array.from(editCreatorRoles),
                    color: editColor,
                    defaultRoute: editDefaultRoute.trim() || '',
                    applicableTo: Array.from(editApplicableTo),
                }),
            });
            if (!res.ok) { const d = await res.json(); throw new Error(d.error); }
            setEditingId(null);
            showMsg('success', 'Đã cập nhật role!');
            fetchRoles();
        } catch (err) {
            showMsg('error', err instanceof Error ? err.message : 'Lỗi cập nhật role');
        } finally { setSaving(false); }
    };

    const handleDelete = async (id: string, name: string) => {
        if (!confirm(`Xóa role "${name}"?`)) return;
        setError(''); setSuccess('');
        try {
            const token = await getToken();
            const res = await fetch(`/api/roles/${id}`, { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } });
            const d = await res.json();
            if (!res.ok) throw new Error(d.error);
            showMsg('success', `Đã xóa role "${name}"`);
            fetchRoles();
        } catch (err) {
            showMsg('error', err instanceof Error ? err.message : 'Lỗi xóa role');
        }
    };

    const startEdit = (role: CustomRoleDoc) => {
        setEditingId(role.id);
        setEditName(role.name);
        setEditPerms(new Set(role.permissions));
        setEditCreatorRoles(new Set(role.creatorRoles || ['admin']));
        setEditColor(role.color || 'slate');
        setEditDefaultRoute(role.defaultRoute || '');
        setEditApplicableTo(new Set(role.applicableTo || []));
    };

    if (userDoc?.role !== 'admin' && userDoc?.role !== 'super_admin') {
        return <div className="p-8 text-center text-danger-500 font-bold">Không có quyền truy cập.</div>;
    }

    const creatorCandidates = roles.filter(r => r.isSystem);

    const APPLICABLE_OPTIONS: { key: 'STORE' | 'OFFICE' | 'CENTRAL'; label: string; icon: string; color: string }[] = [
        { key: 'STORE',   label: 'Cửa hàng', icon: '🏪', color: 'bg-accent-50 border-accent-300 text-accent-700' },
        { key: 'OFFICE',  label: 'Văn phòng', icon: '🏢', color: 'bg-teal-50 border-teal-300 text-teal-700' },
        { key: 'CENTRAL', label: 'Kho tổng',  icon: '🏭', color: 'bg-warning-50 border-warning-300 text-warning-700' },
    ];

    const renderApplicableTo = (
        selected: Set<'STORE' | 'OFFICE' | 'CENTRAL'>,
        setter: (s: Set<'STORE' | 'OFFICE' | 'CENTRAL'>) => void,
    ) => (
        <div>
            <label className="text-xs font-semibold text-surface-600 block mb-2">Loại hình áp dụng</label>
            <div className="flex gap-2 flex-wrap">
                {APPLICABLE_OPTIONS.map(opt => {
                    const active = selected.has(opt.key);
                    return (
                        <button key={opt.key} type="button"
                            onClick={() => {
                                const next = new Set(selected);
                                active ? next.delete(opt.key) : next.add(opt.key);
                                setter(next);
                            }}
                            className={cn(
                                'flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-bold transition-all',
                                active ? opt.color + ' ring-2 ring-offset-1 ring-accent-300' : 'border-surface-200 text-surface-500 hover:border-surface-300'
                            )}>
                            {opt.icon} {opt.label}
                            {active && <span className="ml-0.5">✓</span>}
                        </button>
                    );
                })}
            </div>
            <p className="text-[11px] text-surface-400 mt-1">Chọn rỗng = áp dụng cho mọi loại</p>
        </div>
    );

    const renderCreatorRolePicker = (
        selected: Set<string>,
        setter: (s: Set<string>) => void,
    ) => (
        <div>
            <label className="text-xs font-semibold text-surface-600 mb-2 flex items-center gap-1.5">
                <Users className="w-3.5 h-3.5 text-accent-500" />
                Ai được phép gán role này?
            </label>
            <div className="flex flex-wrap gap-1.5">
                {creatorCandidates.map(r => (
                    <label key={r.id} className={cn(
                        'flex items-center gap-1.5 px-3 py-1.5 rounded-lg border cursor-pointer text-sm transition-colors',
                        selected.has(r.id)
                            ? 'bg-accent-50 border-accent-300 text-accent-700 font-semibold'
                            : 'border-surface-200 hover:border-accent-200 text-surface-600'
                    )}>
                        <input type="checkbox" className="accent-accent-600"
                            checked={selected.has(r.id)}
                            onChange={() => {
                                const next = new Set(selected);
                                next.has(r.id) ? next.delete(r.id) : next.add(r.id);
                                setter(next);
                            }}
                        />
                        {r.name}
                    </label>
                ))}
            </div>
        </div>
    );

    const renderColorPicker = (value: string, setter: (c: string) => void) => (
        <div>
            <label className="text-xs font-semibold text-surface-600 block mb-2">Màu hiển thị</label>
            <div className="flex flex-wrap gap-1.5">
                {COLOR_OPTIONS.map(c => (
                    <button key={c.value} type="button"
                        onClick={() => setter(c.value)}
                        className={cn(
                            'px-2.5 py-1 rounded-full text-xs font-medium border transition-all',
                            c.className,
                            value === c.value ? 'ring-2 ring-offset-1 ring-accent-400 scale-105' : 'opacity-70 hover:opacity-100'
                        )}>
                        {c.label}
                    </button>
                ))}
            </div>
        </div>
    );

    return (
        <div className="space-y-8 mx-auto">
            {/* Header */}
            <DashboardHeader
                showSelect={false}
                titleChildren={
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 w-full">
                        <div>
                            <h1 className="text-2xl font-bold bg-gradient-to-r from-accent-600 to-accent-600 bg-clip-text text-transparent flex items-center gap-2">
                                <Shield className="w-7 h-7 text-accent-600" />
                                Quản lý Phân Quyền
                            </h1>
                            <p className="text-surface-500 mt-1 text-sm">Tạo vai trò tùy chỉnh và phân quyền chi tiết cho từng tính năng.</p>
                        </div>
                        <button onClick={fetchRoles} className="p-2 rounded-lg hover:bg-surface-100 text-surface-500 transition-colors shrink-0">
                            <RefreshCw className="w-4 h-4" />
                        </button>
                    </div>
                }
            />

            {/* Legend */}
            <div className="flex items-center gap-4 text-xs text-surface-500 bg-surface-50 border border-surface-200 rounded-xl px-4 py-3">
                <div className="flex items-center gap-1.5">
                    <Eye className="w-3.5 h-3.5 text-primary-500" />
                    <span><strong className="text-surface-700">Trang</strong> — cho phép truy cập vào route/trang</span>
                </div>
                <div className="flex items-center gap-1.5">
                    <Zap className="w-3.5 h-3.5 text-warning-500" />
                    <span><strong className="text-surface-700">Ghi</strong> — cho phép thêm/sửa/xóa dữ liệu</span>
                </div>
            </div>

            {/* Alerts */}
            {error && (
                <div className="bg-danger-50 text-danger-600 p-3 rounded-xl flex items-start gap-2 border border-danger-100">
                    <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                    <span className="text-sm flex-1">{error}</span>
                    <button onClick={() => setError('')}><X className="w-4 h-4" /></button>
                </div>
            )}
            {success && (
                <div className="bg-success-50 text-success-700 p-3 rounded-xl flex items-center gap-2 border border-success-100">
                    <CheckCircle2 className="w-4 h-4 shrink-0" />
                    <span className="text-sm flex-1">{success}</span>
                    <button onClick={() => setSuccess('')}><X className="w-4 h-4" /></button>
                </div>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* ─── Left: Create Form ─── */}
                <div className="bg-white border border-surface-200 rounded-2xl p-6 shadow-sm">
                    <h2 className="text-base font-bold text-surface-800 mb-4 flex items-center gap-2">
                        <Plus className="w-4 h-4 text-accent-500" /> Tạo Role Mới
                    </h2>
                    <div className="space-y-4">
                        <div>
                            <label className="text-xs font-semibold text-surface-600 block mb-1">Tên Role</label>
                            <input
                                value={newRoleName}
                                onChange={e => setNewRoleName(e.target.value)}
                                placeholder="VD: Kế toán, Quản lý kho..."
                                className="w-full border border-surface-200 rounded-lg p-2.5 text-sm focus:ring-2 focus:ring-accent-500/20 focus:border-accent-400 outline-none"
                            />
                        </div>

                        {renderApplicableTo(newApplicableTo, setNewApplicableTo)}
                        {renderColorPicker(newColor, setNewColor)}
                        {renderCreatorRolePicker(newCreatorRoles, setNewCreatorRoles)}

                        <div>
                            <label className="text-xs font-semibold text-surface-600 block mb-1">Trang mặc định sau đăng nhập (Tùy chọn)</label>
                            <input
                                value={newDefaultRoute}
                                onChange={e => setNewDefaultRoute(e.target.value)}
                                placeholder="VD: /office/revenue"
                                className="w-full border border-surface-200 rounded-lg p-2.5 text-sm focus:ring-2 focus:ring-accent-500/20 focus:border-accent-400 outline-none font-mono"
                            />
                        </div>

                        <PermissionPicker selected={newPerms} onChange={setNewPerms} />

                        <button
                            onClick={handleCreate}
                            disabled={saving || !newRoleName.trim()}
                            className="w-full bg-accent-600 hover:bg-accent-700 disabled:opacity-50 text-white py-2.5 rounded-xl font-semibold text-sm flex items-center justify-center gap-2 transition-colors"
                        >
                            {saving ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> : <Plus className="w-4 h-4" />}
                            Tạo Role
                        </button>
                    </div>
                </div>

                {/* ─── Right: All Roles ─── */}
                <div className="space-y-3">
                    <h2 className="text-base font-bold text-surface-800 flex items-center gap-2">
                        <Shield className="w-4 h-4 text-accent-500" /> Tất cả vai trò
                        <span className="ml-auto text-xs text-surface-400 font-normal">{roles.length} role</span>
                    </h2>

                    {loading ? (
                        <div className="flex justify-center py-8">
                            <div className="w-6 h-6 border-4 border-accent-500 border-t-transparent rounded-full animate-spin" />
                        </div>
                    ) : roles.length === 0 ? (
                        <div className="bg-surface-50 border border-dashed border-surface-300 rounded-2xl p-8 text-center text-surface-400 text-sm">
                            Chưa có role nào
                        </div>
                    ) : (
                        roles.map(role => (
                            <div key={role.id} className={cn(
                                'rounded-2xl border p-4 shadow-sm transition-colors',
                                CARD_BG[role.color || 'slate'] || 'border-surface-200 bg-white'
                            )}>
                                {editingId === role.id ? (
                                    /* Edit Mode */
                                    <div className="space-y-3">
                                        <input
                                            value={editName}
                                            onChange={e => setEditName(e.target.value)}
                                            className="w-full border border-accent-300 rounded-lg p-2 text-sm font-semibold focus:ring-2 focus:ring-accent-500/20 outline-none"
                                        />
                                        {renderApplicableTo(editApplicableTo, setEditApplicableTo)}
                                        {renderColorPicker(editColor, setEditColor)}
                                        {renderCreatorRolePicker(editCreatorRoles, setEditCreatorRoles)}
                                        <div>
                                            <label className="text-xs font-semibold text-surface-600 block mb-1">Trang mặc định sau đăng nhập</label>
                                            <input
                                                value={editDefaultRoute}
                                                onChange={e => setEditDefaultRoute(e.target.value)}
                                                placeholder="VD: /office/revenue"
                                                className="w-full border border-accent-300 rounded-lg p-2 text-sm focus:ring-2 focus:ring-accent-500/20 outline-none font-mono"
                                            />
                                        </div>

                                        <PermissionPicker selected={editPerms} onChange={setEditPerms} />

                                        <div className="flex gap-2">
                                            <button onClick={() => handleSaveEdit(role.id)} disabled={saving}
                                                className="flex-1 bg-accent-600 hover:bg-accent-700 text-white py-2 rounded-lg text-sm font-semibold flex items-center justify-center gap-1.5 transition-colors">
                                                <Save className="w-3.5 h-3.5" /> Lưu
                                            </button>
                                            <button onClick={() => setEditingId(null)}
                                                className="px-3 py-2 rounded-lg border border-surface-200 hover:bg-surface-50 text-surface-500 transition-colors">
                                                <X className="w-4 h-4" />
                                            </button>
                                        </div>
                                    </div>
                                ) : (
                                    /* View Mode */
                                    <>
                                        <div className="flex items-start justify-between mb-2">
                                            <div
                                                className="flex-1 cursor-pointer"
                                                onClick={() => setExpandedId(expandedId === role.id ? null : role.id)}
                                            >
                                                <div className="flex items-center gap-2 flex-wrap">
                                                    <span className={cn(
                                                        'text-xs font-bold px-2 py-0.5 rounded-full border',
                                                        BADGE_COLOR[role.color || 'slate'] || 'bg-surface-100 text-surface-700 border-surface-200'
                                                    )}>
                                                        {role.name}
                                                    </span>
                                                    {role.isSystem && (
                                                        <span className="text-[9px] bg-surface-200 text-surface-600 px-1.5 py-0.5 rounded-full font-semibold uppercase">
                                                            Hệ thống
                                                        </span>
                                                    )}
                                                    {role.applicableTo && role.applicableTo.length > 0 && role.applicableTo.map(loc => (
                                                        <span key={loc} className={cn(
                                                            'text-[9px] font-bold px-1.5 py-0.5 rounded-full',
                                                            loc === 'OFFICE' ? 'bg-teal-100 text-teal-700' :
                                                                loc === 'CENTRAL' ? 'bg-warning-100 text-warning-700' :
                                                                    'bg-accent-100 text-accent-700'
                                                        )}>
                                                            {loc === 'STORE' ? '🏪 Cửa hàng'
                                                                : loc === 'OFFICE' ? '🏢 Văn phòng'
                                                                    : '🏭 Kho tổng'}
                                                        </span>
                                                    ))}
                                                    {role.isLocked && <Lock className="w-3 h-3 text-surface-400" />}
                                                    {expandedId === role.id
                                                        ? <ChevronUp className="w-3.5 h-3.5 text-surface-400" />
                                                        : <ChevronDown className="w-3.5 h-3.5 text-surface-400" />
                                                    }
                                                </div>
                                                <p className="text-xs text-surface-500 mt-1">
                                                    {role.permissions.length} quyền
                                                    {role.defaultRoute && (
                                                        <> · Redirect: <span className="font-mono text-accent-600">{role.defaultRoute}</span></>
                                                    )}
                                                </p>
                                            </div>

                                            {!role.isLocked && (
                                                <div className="flex gap-1 shrink-0 ml-2">
                                                    <button onClick={() => startEdit(role)}
                                                        className="p-1.5 rounded-lg hover:bg-accent-50 hover:text-accent-600 text-surface-400 transition-colors">
                                                        <Pencil className="w-4 h-4" />
                                                    </button>
                                                    {!role.isSystem && (
                                                        <button onClick={() => handleDelete(role.id, role.name)}
                                                            className="p-1.5 rounded-lg hover:bg-danger-50 hover:text-danger-500 text-surface-400 transition-colors">
                                                            <Trash2 className="w-4 h-4" />
                                                        </button>
                                                    )}
                                                </div>
                                            )}
                                        </div>

                                        {/* Expanded: show permission list */}
                                        {expandedId === role.id && (
                                            <div className="mt-2 pt-2 border-t border-surface-200/60">
                                                {role.permissions.length === 0 ? (
                                                    <span className="text-xs text-surface-400 italic">Không có quyền nào</span>
                                                ) : (
                                                    <div className="space-y-2">
                                                        {permissionGroups.map(group => {
                                                            const groupPerms = ALL_PERMISSIONS.filter(
                                                                p => p.group === group && role.permissions.includes(p.key)
                                                            );
                                                            if (groupPerms.length === 0) return null;
                                                            return (
                                                                <div key={group}>
                                                                    <p className="text-[10px] font-bold text-surface-400 uppercase tracking-wide mb-1">{group}</p>
                                                                    <div className="flex flex-wrap gap-1">
                                                                        {groupPerms.map(p => (
                                                                            <span key={p.key} className={cn(
                                                                                'text-[10px] font-medium px-2 py-0.5 rounded-full border flex items-center gap-1',
                                                                                p.type === 'page'
                                                                                    ? 'bg-primary-50 text-primary-700 border-primary-200'
                                                                                    : 'bg-warning-50 text-warning-700 border-warning-200'
                                                                            )}>
                                                                                {p.type === 'page' ? <Eye className="w-2.5 h-2.5" /> : <Zap className="w-2.5 h-2.5" />}
                                                                                {p.label}
                                                                            </span>
                                                                        ))}
                                                                    </div>
                                                                </div>
                                                            );
                                                        })}
                                                    </div>
                                                )}
                                            </div>
                                        )}
                                    </>
                                )}
                            </div>
                        ))
                    )}
                </div>
            </div>
        </div>
    );
}
