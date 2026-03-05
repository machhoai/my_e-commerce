'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { CustomRoleDoc, AppPermission, ALL_PERMISSIONS } from '@/types';
import { Shield, Plus, Trash2, Pencil, Save, X, CheckCircle2, AlertCircle, RefreshCw, Lock, ChevronDown, ChevronUp, Users } from 'lucide-react';
import { cn } from '@/lib/utils';

const COLOR_OPTIONS = [
    { value: 'red', label: 'Đỏ', className: 'bg-red-100 text-red-700 border-red-200' },
    { value: 'purple', label: 'Tím', className: 'bg-purple-100 text-purple-700 border-purple-200' },
    { value: 'amber', label: 'Vàng', className: 'bg-amber-100 text-amber-700 border-amber-200' },
    { value: 'blue', label: 'Xanh', className: 'bg-blue-100 text-blue-700 border-blue-200' },
    { value: 'emerald', label: 'Xanh lá', className: 'bg-emerald-100 text-emerald-700 border-emerald-200' },
    { value: 'indigo', label: 'Chàm', className: 'bg-indigo-100 text-indigo-700 border-indigo-200' },
    { value: 'pink', label: 'Hồng', className: 'bg-pink-100 text-pink-700 border-pink-200' },
    { value: 'slate', label: 'Xám', className: 'bg-slate-100 text-slate-700 border-slate-200' },
];

const BADGE_COLOR: Record<string, string> = {
    red: 'bg-red-100 text-red-700 border-red-200',
    purple: 'bg-purple-100 text-purple-700 border-purple-200',
    amber: 'bg-amber-100 text-amber-700 border-amber-200',
    blue: 'bg-blue-100 text-blue-700 border-blue-200',
    emerald: 'bg-emerald-100 text-emerald-700 border-emerald-200',
    indigo: 'bg-indigo-100 text-indigo-700 border-indigo-200',
    pink: 'bg-pink-100 text-pink-700 border-pink-200',
    slate: 'bg-slate-100 text-slate-700 border-slate-200',
};

const CARD_BG: Record<string, string> = {
    red: 'border-red-200 bg-red-50/30',
    purple: 'border-purple-200 bg-purple-50/30',
    amber: 'border-amber-200 bg-amber-50/30',
    blue: 'border-blue-200 bg-blue-50/30',
    emerald: 'border-emerald-200 bg-emerald-50/30',
    indigo: 'border-indigo-200 bg-indigo-50/30',
    pink: 'border-pink-200 bg-pink-50/30',
    slate: 'border-slate-200 bg-slate-50/30',
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

    // Edit state
    const [editingId, setEditingId] = useState<string | null>(null);
    const [editName, setEditName] = useState('');
    const [editPerms, setEditPerms] = useState<Set<AppPermission>>(new Set());
    const [editCreatorRoles, setEditCreatorRoles] = useState<Set<string>>(new Set());
    const [editColor, setEditColor] = useState('slate');

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
                }),
            });
            if (!res.ok) { const d = await res.json(); throw new Error(d.error); }
            setNewRoleName(''); setNewRolePerms(new Set()); setNewCreatorRoles(new Set(['admin'])); setNewColor('slate');
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

    if (userDoc?.role !== 'admin') {
        return <div className="p-8 text-center text-red-500 font-bold">Không có quyền truy cập.</div>;
    }

    const renderCreatorRolePicker = (
        selected: Set<string>,
        setter: (s: Set<string>) => void,
    ) => (
        <div>
            <label className="text-xs font-semibold text-slate-600 block mb-2 flex items-center gap-1.5">
                <Users className="w-3.5 h-3.5 text-violet-500" />
                Ai được phép tạo/gán role này?
            </label>
            <div className="flex flex-wrap gap-1.5">
                {creatorCandidates.map(r => (
                    <label key={r.id} className={cn(
                        'flex items-center gap-1.5 px-3 py-1.5 rounded-lg border cursor-pointer text-sm transition-colors',
                        selected.has(r.id)
                            ? 'bg-violet-50 border-violet-300 text-violet-700 font-semibold'
                            : 'border-slate-200 hover:border-violet-200 text-slate-600'
                    )}>
                        <input type="checkbox" className="accent-violet-600"
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
            <label className="text-xs font-semibold text-slate-600 block mb-2">Màu hiển thị</label>
            <div className="flex flex-wrap gap-1.5">
                {COLOR_OPTIONS.map(c => (
                    <button key={c.value} type="button"
                        onClick={() => setter(c.value)}
                        className={cn(
                            'px-2.5 py-1 rounded-full text-xs font-medium border transition-all',
                            c.className,
                            value === c.value ? 'ring-2 ring-offset-1 ring-violet-400 scale-105' : 'opacity-70 hover:opacity-100'
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
            <label className="text-xs font-semibold text-slate-600 block mb-2">Quyền hạn</label>
            <div className="space-y-1.5 max-h-72 overflow-y-auto pr-1">
                {ALL_PERMISSIONS.map(p => (
                    <label key={p.key} className={cn(
                        'flex items-start gap-3 p-2.5 rounded-lg border cursor-pointer transition-colors',
                        perms.has(p.key) ? 'bg-violet-50 border-violet-300' : 'bg-slate-50 border-slate-200 hover:border-violet-200'
                    )}>
                        <input type="checkbox" className="mt-0.5 accent-violet-600"
                            checked={perms.has(p.key)}
                            onChange={() => togglePerm(perms, p.key, setter)}
                        />
                        <div>
                            <p className="text-sm font-semibold text-slate-700">{p.label}</p>
                            <p className="text-xs text-slate-500">{p.description}</p>
                        </div>
                    </label>
                ))}
            </div>
        </div>
    );

    return (
        <div className="space-y-8 mx-auto">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
                        <Shield className="w-7 h-7 text-violet-600" />
                        Quản lý Phân Quyền
                    </h1>
                    <p className="text-slate-500 mt-1 text-sm">Quản lý tất cả vai trò (hệ thống và tùy chỉnh) cùng quyền hạn chi tiết.</p>
                </div>
                <button onClick={fetchRoles} className="p-2 rounded-lg hover:bg-slate-100 text-slate-500 transition-colors">
                    <RefreshCw className="w-4 h-4" />
                </button>
            </div>

            {/* Alerts */}
            {error && (
                <div className="bg-red-50 text-red-600 p-3 rounded-xl flex items-start gap-2 border border-red-100">
                    <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                    <span className="text-sm flex-1">{error}</span>
                    <button onClick={() => setError('')}><X className="w-4 h-4" /></button>
                </div>
            )}
            {success && (
                <div className="bg-emerald-50 text-emerald-700 p-3 rounded-xl flex items-center gap-2 border border-emerald-100">
                    <CheckCircle2 className="w-4 h-4 shrink-0" />
                    <span className="text-sm flex-1">{success}</span>
                    <button onClick={() => setSuccess('')}><X className="w-4 h-4" /></button>
                </div>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* ─── Left: Create Form ─── */}
                <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
                    <h2 className="text-base font-bold text-slate-800 mb-4 flex items-center gap-2">
                        <Plus className="w-4 h-4 text-violet-500" /> Tạo Role Mới
                    </h2>
                    <div className="space-y-4">
                        <div>
                            <label className="text-xs font-semibold text-slate-600 block mb-1">Tên Role</label>
                            <input
                                value={newRoleName}
                                onChange={e => setNewRoleName(e.target.value)}
                                placeholder="VD: Kế toán, Quản lý kho..."
                                className="w-full border border-slate-200 rounded-lg p-2.5 text-sm focus:ring-2 focus:ring-violet-500/20 focus:border-violet-400 outline-none"
                            />
                        </div>

                        {renderColorPicker(newColor, setNewColor)}
                        {renderCreatorRolePicker(newCreatorRoles, setNewCreatorRoles)}
                        {renderPermissions(newRolePerms, setNewRolePerms)}

                        <button
                            onClick={handleCreate}
                            disabled={saving || !newRoleName.trim()}
                            className="w-full bg-violet-600 hover:bg-violet-700 disabled:opacity-50 text-white py-2.5 rounded-xl font-semibold text-sm flex items-center justify-center gap-2 transition-colors"
                        >
                            {saving ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> : <Plus className="w-4 h-4" />}
                            Tạo Role
                        </button>
                    </div>
                </div>

                {/* ─── Right: All Roles ─── */}
                <div className="space-y-3">
                    <h2 className="text-base font-bold text-slate-800 flex items-center gap-2">
                        <Shield className="w-4 h-4 text-violet-500" /> Tất cả vai trò
                        <span className="ml-auto text-xs text-slate-400 font-normal">{roles.length} role</span>
                    </h2>

                    {loading ? (
                        <div className="flex justify-center py-8">
                            <div className="w-6 h-6 border-4 border-violet-500 border-t-transparent rounded-full animate-spin" />
                        </div>
                    ) : roles.length === 0 ? (
                        <div className="bg-slate-50 border border-dashed border-slate-300 rounded-2xl p-8 text-center text-slate-400 text-sm">
                            Đang tải vai trò...
                        </div>
                    ) : (
                        roles.map(role => (
                            <div key={role.id} className={cn(
                                'rounded-2xl border p-4 shadow-sm transition-colors',
                                CARD_BG[role.color || 'slate'] || 'border-slate-200 bg-white'
                            )}>
                                {editingId === role.id ? (
                                    /* ─── Edit Mode ─── */
                                    <div className="space-y-3">
                                        <input
                                            value={editName}
                                            onChange={e => setEditName(e.target.value)}
                                            className="w-full border border-violet-300 rounded-lg p-2 text-sm font-semibold focus:ring-2 focus:ring-violet-500/20 outline-none"
                                        />
                                        {renderColorPicker(editColor, setEditColor)}
                                        {renderCreatorRolePicker(editCreatorRoles, setEditCreatorRoles)}
                                        <div className="space-y-1.5 max-h-56 overflow-y-auto pr-1">
                                            {ALL_PERMISSIONS.map(p => (
                                                <label key={p.key} className={cn(
                                                    'flex items-center gap-2 p-2 rounded-lg border cursor-pointer text-sm transition-colors',
                                                    editPerms.has(p.key) ? 'bg-violet-50 border-violet-300 font-semibold text-violet-800' : 'border-slate-100 text-slate-600'
                                                )}>
                                                    <input type="checkbox" className="accent-violet-600"
                                                        checked={editPerms.has(p.key)}
                                                        onChange={() => togglePerm(editPerms, p.key, setEditPerms)}
                                                    />
                                                    {p.label}
                                                </label>
                                            ))}
                                        </div>
                                        <div className="flex gap-2">
                                            <button onClick={() => handleSaveEdit(role.id)} disabled={saving}
                                                className="flex-1 bg-violet-600 hover:bg-violet-700 text-white py-2 rounded-lg text-sm font-semibold flex items-center justify-center gap-1.5 transition-colors">
                                                <Save className="w-3.5 h-3.5" /> Lưu
                                            </button>
                                            <button onClick={() => setEditingId(null)}
                                                className="px-3 py-2 rounded-lg border border-slate-200 hover:bg-slate-50 text-slate-500 transition-colors">
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
                                                        BADGE_COLOR[role.color || 'slate'] || 'bg-slate-100 text-slate-700 border-slate-200'
                                                    )}>
                                                        {role.name}
                                                    </span>
                                                    {role.isSystem && (
                                                        <span className="text-[9px] bg-slate-200 text-slate-600 px-1.5 py-0.5 rounded-full font-semibold uppercase">
                                                            Hệ thống
                                                        </span>
                                                    )}
                                                    {role.isLocked && (
                                                        <Lock className="w-3 h-3 text-slate-400" />
                                                    )}
                                                    {expandedId === role.id
                                                        ? <ChevronUp className="w-3.5 h-3.5 text-slate-400" />
                                                        : <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
                                                    }
                                                </div>
                                                <p className="text-xs text-slate-500 mt-1">
                                                    {role.permissions.length} quyền
                                                    {role.creatorRoles?.length > 0 && (
                                                        <> · Được tạo bởi: {role.creatorRoles.map(cid => {
                                                            const cr = roles.find(r => r.id === cid);
                                                            return cr?.name ?? cid;
                                                        }).join(', ')}</>
                                                    )}
                                                </p>
                                            </div>

                                            {/* Actions — hide for locked roles */}
                                            {!role.isLocked && (
                                                <div className="flex gap-1 shrink-0 ml-2">
                                                    <button onClick={() => startEdit(role)}
                                                        className="p-1.5 rounded-lg hover:bg-violet-50 hover:text-violet-600 text-slate-400 transition-colors">
                                                        <Pencil className="w-4 h-4" />
                                                    </button>
                                                    {!role.isSystem && (
                                                        <button onClick={() => handleDelete(role.id, role.name)}
                                                            className="p-1.5 rounded-lg hover:bg-red-50 hover:text-red-500 text-slate-400 transition-colors">
                                                            <Trash2 className="w-4 h-4" />
                                                        </button>
                                                    )}
                                                </div>
                                            )}
                                        </div>

                                        {/* Expanded permissions */}
                                        {expandedId === role.id && (
                                            <div className="mt-2 pt-2 border-t border-slate-200/60">
                                                <div className="flex flex-wrap gap-1.5">
                                                    {role.permissions.length === 0 ? (
                                                        <span className="text-xs text-slate-400 italic">Không có quyền nào</span>
                                                    ) : role.permissions.map(pKey => {
                                                        const pInfo = ALL_PERMISSIONS.find(p => p.key === pKey);
                                                        return (
                                                            <span key={pKey} className="text-xs bg-white/80 text-slate-700 px-2 py-0.5 rounded-full font-medium border border-slate-200">
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
