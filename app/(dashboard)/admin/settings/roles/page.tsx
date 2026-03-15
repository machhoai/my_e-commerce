'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { CustomRoleDoc, AppPermission, ALL_PERMISSIONS } from '@/types';
import { Shield, Plus, Trash2, Pencil, Save, X, CheckCircle2, AlertCircle, RefreshCw, Lock, ChevronDown, ChevronUp, Users } from 'lucide-react';
import { cn } from '@/lib/utils';
import { DashboardHeader } from '@/components/inventory/overview/DashboardHeader';

const COLOR_OPTIONS = [
    { value: 'red', label: 'Đỏ', className: 'bg-danger-100 text-danger-700 border-danger-200' },
    { value: 'purple', label: 'Tím', className: 'bg-accent-100 text-accent-700 border-accent-200' },
    { value: 'amber', label: 'Vàng', className: 'bg-warning-100 text-warning-700 border-warning-200' },
    { value: 'blue', label: 'Xanh', className: 'bg-primary-100 text-primary-700 border-primary-200' },
    { value: 'emerald', label: 'Xanh lá', className: 'bg-success-100 text-success-700 border-success-200' },
    { value: 'indigo', label: 'Chàm', className: 'bg-accent-100 text-accent-700 border-accent-200' },
    { value: 'pink', label: 'Hồng', className: 'bg-pink-100 text-pink-700 border-pink-200' },
    { value: 'slate', label: 'Xám', className: 'bg-surface-100 text-surface-700 border-surface-200' },
];

const BADGE_COLOR: Record<string, string> = {
    red: 'bg-danger-100 text-danger-700 border-danger-200',
    purple: 'bg-accent-100 text-accent-700 border-accent-200',
    amber: 'bg-warning-100 text-warning-700 border-warning-200',
    blue: 'bg-primary-100 text-primary-700 border-primary-200',
    emerald: 'bg-success-100 text-success-700 border-success-200',
    indigo: 'bg-accent-100 text-accent-700 border-accent-200',
    pink: 'bg-pink-100 text-pink-700 border-pink-200',
    slate: 'bg-surface-100 text-surface-700 border-surface-200',
};

const CARD_BG: Record<string, string> = {
    red: 'border-danger-200 bg-danger-50/30',
    purple: 'border-accent-200 bg-accent-50/30',
    amber: 'border-warning-200 bg-warning-50/30',
    blue: 'border-primary-200 bg-primary-50/30',
    emerald: 'border-success-200 bg-success-50/30',
    indigo: 'border-accent-200 bg-accent-50/30',
    pink: 'border-pink-200 bg-pink-50/30',
    slate: 'border-surface-200 bg-surface-50/30',
};

export default function AdminRolesPage() {
    const { user, userDoc, getToken } = useAuth();
    const [roles, setRoles] = useState<CustomRoleDoc[]>([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');

    // Create form
    const [newRoleName, setNewRoleName] = useState('');
    const [newRolePerms, setNewRolePerms] = useState<Set<AppPermission>>(new Set());
    const [newCreatorRoles, setNewCreatorRoles] = useState<Set<string>>(new Set(['admin']));
    const [newColor, setNewColor] = useState('slate');
    const [newDefaultRoute, setNewDefaultRoute] = useState('');
    const [newApplicableTo, setNewApplicableTo] = useState<Set<'STORE' | 'OFFICE' | 'CENTRAL'>>(new Set());

    // Edit state
    const [editingId, setEditingId] = useState<string | null>(null);
    const [editName, setEditName] = useState('');
    const [editPerms, setEditPerms] = useState<Set<AppPermission>>(new Set());
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
        if (type === 'error') { setError(msg); setSuccess(''); } else { setSuccess(msg); setError(''); }
    };

    const handleCreate = async () => {
        if (!newRoleName.trim()) { showMsg('error', 'Tên role không được để trống'); return; }
        if (newCreatorRoles.size === 0) { showMsg('error', 'Phải chọn ít nhất 1 role được phép tạo'); return; }
        setSaving(true); setError(''); setSuccess('');
        try {
            const token = await getToken();
            const res = await fetch('/api/roles', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
                body: JSON.stringify({
                    name: newRoleName.trim(),
                    permissions: Array.from(newRolePerms),
                    creatorRoles: Array.from(newCreatorRoles),
                    color: newColor,
                    defaultRoute: newDefaultRoute.trim() || undefined,
                    applicableTo: Array.from(newApplicableTo),
                }),
            });
            if (!res.ok) { const d = await res.json(); throw new Error(d.error); }
            setNewRoleName(''); setNewRolePerms(new Set()); setNewCreatorRoles(new Set(['admin'])); setNewColor('slate'); setNewDefaultRoute(''); setNewApplicableTo(new Set());
            showMsg('success', 'Đã tạo role mới!');
            fetchRoles();
        } catch (err) {
            showMsg('error', err instanceof Error ? err.message : 'Lỗi tạo role');
        } finally { setSaving(false); }
    };

    const handleSaveEdit = async (id: string) => {
        if (editCreatorRoles.size === 0) { showMsg('error', 'Phải chọn ít nhất 1 role được phép tạo'); return; }
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

    const togglePerm = (set: Set<AppPermission>, key: AppPermission, setter: (s: Set<AppPermission>) => void) => {
        const next = new Set(set);
        next.has(key) ? next.delete(key) : next.add(key);
        setter(next);
    };

    const toggleCreator = (set: Set<string>, roleId: string, setter: (s: Set<string>) => void) => {
        const next = new Set(set);
        next.has(roleId) ? next.delete(roleId) : next.add(roleId);
        setter(next);
    };

    // All roles that could be a "creator" (i.e., system roles that represent user roles)
    const creatorCandidates = roles.filter(r => r.isSystem);

    if (userDoc?.role !== 'admin' && userDoc?.role !== 'super_admin') {
        return <div className="p-8 text-center text-danger-500 font-bold">Không có quyền truy cập.</div>;
    }

    const APPLICABLE_OPTIONS: { key: 'STORE' | 'OFFICE' | 'CENTRAL'; label: string; icon: string; color: string }[] = [
        { key: 'STORE', label: 'Cửa hàng', icon: '🏪', color: 'bg-accent-50 border-accent-300 text-accent-700' },
        { key: 'OFFICE', label: 'Văn phòng', icon: '🏢', color: 'bg-teal-50 border-teal-300 text-teal-700' },
        { key: 'CENTRAL', label: 'Kho tổng', icon: '🏭', color: 'bg-accent-50 border-accent-300 text-accent-700' },
    ];

    // Group permissions by their `group` field
    const permissionGroups = Array.from(new Set(ALL_PERMISSIONS.map(p => p.group)));

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
                            )}
                        >
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
                Ai được phép tạo/gán role này?
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
                            onChange={() => toggleCreator(selected, r.id, setter)}
                            disabled={r.isLocked && selected.has(r.id)} // Can't uncheck admin if only one
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
                        )}
                    >
                        {c.label}
                    </button>
                ))}
            </div>
        </div>
    );

    const renderPermissions = (perms: Set<AppPermission>, setter: (s: Set<AppPermission>) => void) => (
        <div>
            <div className="flex items-center justify-between mb-2">
                <label className="text-xs font-semibold text-surface-600">Quyền hạn ({perms.size}/{ALL_PERMISSIONS.length})</label>
                <div className="flex gap-2">
                    <button type="button" onClick={() => setter(new Set(ALL_PERMISSIONS.map(p => p.key)))}
                        className="text-[10px] text-accent-600 hover:underline font-semibold">Chọn tất cả</button>
                    <button type="button" onClick={() => setter(new Set())}
                        className="text-[10px] text-surface-400 hover:underline">Bỏ hết</button>
                </div>
            </div>
            <div className="space-y-3 max-h-80 overflow-y-auto pr-1">
                {permissionGroups.map(group => (
                    <div key={group}>
                        <p className="text-[10px] font-bold text-surface-400 uppercase tracking-wide mb-1.5 px-1">{group}</p>
                        <div className="space-y-1">
                            {ALL_PERMISSIONS.filter(p => p.group === group).map(p => (
                                <label key={p.key} className={cn(
                                    'flex items-start gap-2.5 p-2 rounded-lg border cursor-pointer transition-colors',
                                    perms.has(p.key) ? 'bg-accent-50 border-accent-300' : 'bg-surface-50 border-surface-200 hover:border-accent-200'
                                )}>
                                    <input type="checkbox" className="mt-0.5 accent-accent-600"
                                        checked={perms.has(p.key)}
                                        onChange={() => togglePerm(perms, p.key, setter)}
                                    />
                                    <div>
                                        <p className="text-xs font-semibold text-surface-700">{p.label}</p>
                                        <p className="text-[10px] text-surface-400">{p.description}</p>
                                    </div>
                                </label>
                            ))}
                        </div>
                    </div>
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
                            <p className="text-surface-500 mt-1 text-sm">Quản lý tất cả vai trò (hệ thống và tùy chỉnh) cùng quyền hạn chi tiết.</p>
                        </div>
                        <button onClick={fetchRoles} className="p-2 rounded-lg hover:bg-surface-100 text-surface-500 transition-colors shrink-0">
                            <RefreshCw className="w-4 h-4" />
                        </button>
                    </div>
                }
            />

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

                        {/* Default Route */}
                        <div>
                            <label className="text-xs font-semibold text-surface-600 block mb-1">Trang mặc định sau đăng nhập (Tùy chọn)</label>
                            <input
                                value={newDefaultRoute}
                                onChange={e => setNewDefaultRoute(e.target.value)}
                                placeholder="VD: /office/revenue"
                                className="w-full border border-surface-200 rounded-lg p-2.5 text-sm focus:ring-2 focus:ring-accent-500/20 focus:border-accent-400 outline-none"
                            />
                            <p className="text-[11px] text-surface-400 mt-1">Route mặc định khi người dùng đăng nhập (để trống = dùng mặc định theo vai trò)</p>
                        </div>

                        {renderPermissions(newRolePerms, setNewRolePerms)}

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
                            Đang tải vai trò...
                        </div>
                    ) : (
                        roles.map(role => (
                            <div key={role.id} className={cn(
                                'rounded-2xl border p-4 shadow-sm transition-colors',
                                CARD_BG[role.color || 'slate'] || 'border-surface-200 bg-white'
                            )}>
                                {editingId === role.id ? (
                                    /* ─── Edit Mode ─── */
                                    <div className="space-y-3">
                                        <input
                                            value={editName}
                                            onChange={e => setEditName(e.target.value)}
                                            className="w-full border border-accent-300 rounded-lg p-2 text-sm font-semibold focus:ring-2 focus:ring-accent-500/20 outline-none"
                                        />
                                        {renderApplicableTo(editApplicableTo, setEditApplicableTo)}
                                        {renderColorPicker(editColor, setEditColor)}
                                        {renderCreatorRolePicker(editCreatorRoles, setEditCreatorRoles)}

                                        {/* Default Route */}
                                        <div>
                                            <label className="text-xs font-semibold text-surface-600 block mb-1">Trang mặc định sau đăng nhập (Tùy chọn)</label>
                                            <input
                                                value={editDefaultRoute}
                                                onChange={e => setEditDefaultRoute(e.target.value)}
                                                placeholder="VD: /office/revenue"
                                                className="w-full border border-accent-300 rounded-lg p-2 text-sm focus:ring-2 focus:ring-accent-500/20 outline-none"
                                            />
                                            <p className="text-[11px] text-surface-400 mt-1">Để trống = dùng mặc định theo vai trò</p>
                                        </div>
                                        <div className="space-y-1 max-h-56 overflow-y-auto pr-1">
                                            {permissionGroups.map(group => (
                                                <div key={group}>
                                                    <p className="text-[10px] font-bold text-surface-400 uppercase tracking-wide mb-1 px-1">{group}</p>
                                                    {ALL_PERMISSIONS.filter(p => p.group === group).map(p => (
                                                        <label key={p.key} className={cn(
                                                            'flex items-center gap-2 p-2 rounded-lg border cursor-pointer text-xs transition-colors',
                                                            editPerms.has(p.key) ? 'bg-accent-50 border-accent-300 font-semibold text-accent-800' : 'border-surface-100 text-surface-600'
                                                        )}>
                                                            <input type="checkbox" className="accent-accent-600"
                                                                checked={editPerms.has(p.key)}
                                                                onChange={() => togglePerm(editPerms, p.key, setEditPerms)}
                                                            />
                                                            {p.label}
                                                        </label>
                                                    ))}
                                                </div>
                                            ))}
                                        </div>
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
                                    /* ─── View Mode ─── */
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
                                                                loc === 'CENTRAL' ? 'bg-accent-100 text-accent-700' :
                                                                    'bg-accent-100 text-accent-700'
                                                        )}>
                                                            {loc === 'STORE' ? '🏪'
                                                                : loc === 'OFFICE' ? '🏢'
                                                                    : '🏭'} {loc}
                                                        </span>
                                                    ))}
                                                    {role.isLocked && (
                                                        <Lock className="w-3 h-3 text-surface-400" />
                                                    )}
                                                    {expandedId === role.id
                                                        ? <ChevronUp className="w-3.5 h-3.5 text-surface-400" />
                                                        : <ChevronDown className="w-3.5 h-3.5 text-surface-400" />
                                                    }
                                                </div>
                                                <p className="text-xs text-surface-500 mt-1">
                                                    {role.permissions.length} quyền
                                                    {role.creatorRoles?.length > 0 && (
                                                        <> · Được tạo bởi: {role.creatorRoles.map(cid => {
                                                            const cr = roles.find(r => r.id === cid);
                                                            return cr?.name ?? cid;
                                                        }).join(', ')}</>
                                                    )}
                                                    {role.defaultRoute && (
                                                        <> · Redirect: <span className="font-mono text-accent-600">{role.defaultRoute}</span></>
                                                    )}
                                                </p>
                                            </div>

                                            {/* Actions — hide for locked roles */}
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

                                        {/* Expanded permissions */}
                                        {expandedId === role.id && (
                                            <div className="mt-2 pt-2 border-t border-surface-200/60">
                                                <div className="flex flex-wrap gap-1.5">
                                                    {role.permissions.length === 0 ? (
                                                        <span className="text-xs text-surface-400 italic">Không có quyền nào</span>
                                                    ) : role.permissions.map(pKey => {
                                                        const pInfo = ALL_PERMISSIONS.find(p => p.key === pKey);
                                                        return (
                                                            <span key={pKey} className="text-xs bg-white/80 text-surface-700 px-2 py-0.5 rounded-full font-medium border border-surface-200">
                                                                {pInfo?.label ?? pKey}
                                                            </span>
                                                        );
                                                    })}
                                                </div>
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
