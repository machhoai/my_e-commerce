'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { CustomRoleDoc, AppPermission, ALL_PERMISSIONS, UserRole } from '@/types';
import { Shield, Plus, Trash2, Pencil, Save, X, CheckCircle2, AlertCircle, RefreshCw, Lock, Store } from 'lucide-react';
import { cn } from '@/lib/utils';

// ─────────────────────────────────────────────
// Built-in system roles displayed as read-only
// ─────────────────────────────────────────────
interface BuiltInRole {
    role: UserRole;
    name: string;
    permissions: AppPermission[];
    color: string;
}

const BUILT_IN_ROLES: BuiltInRole[] = [
    {
        role: 'admin',
        name: 'Quản trị viên',
        permissions: ['view_overview', 'view_history', 'view_schedule', 'edit_schedule', 'view_users', 'manage_hr'],
        color: 'red',
    },
    {
        role: 'store_manager',
        name: 'Cửa hàng trưởng',
        permissions: ['view_overview', 'view_history', 'view_schedule', 'edit_schedule', 'view_users', 'manage_hr'],
        color: 'purple',
    },
    {
        role: 'manager',
        name: 'Quản lý',
        permissions: ['view_overview', 'view_history'],
        color: 'amber',
    },
    {
        role: 'employee',
        name: 'Nhân viên',
        permissions: ['register_shift'],
        color: 'blue',
    },
];

const COLOR_MAP: Record<string, string> = {
    red: 'border-red-200 bg-red-50/40',
    purple: 'border-purple-200 bg-purple-50/40',
    amber: 'border-amber-200 bg-amber-50/40',
    blue: 'border-blue-200 bg-blue-50/40',
};
const BADGE_COLOR: Record<string, string> = {
    red: 'bg-red-100 text-red-700',
    purple: 'bg-purple-100 text-purple-700',
    amber: 'bg-amber-100 text-amber-700',
    blue: 'bg-blue-100 text-blue-700',
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
    const [newAllowStoreManager, setNewAllowStoreManager] = useState(false);

    // Edit state
    const [editingId, setEditingId] = useState<string | null>(null);
    const [editName, setEditName] = useState('');
    const [editPerms, setEditPerms] = useState<Set<AppPermission>>(new Set());
    const [editAllowStoreManager, setEditAllowStoreManager] = useState(false);

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
        if (type === 'error') setError(msg); else setSuccess(msg);
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
                    permissions: Array.from(newRolePerms),
                    allowStoreManager: newAllowStoreManager,
                }),
            });
            if (!res.ok) { const d = await res.json(); throw new Error(d.error); }
            setNewRoleName(''); setNewRolePerms(new Set()); setNewAllowStoreManager(false);
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
                body: JSON.stringify({ name: editName, permissions: Array.from(editPerms), allowStoreManager: editAllowStoreManager }),
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
        setEditAllowStoreManager(role.allowStoreManager ?? false);
    };

    const togglePerm = (set: Set<AppPermission>, key: AppPermission, setter: (s: Set<AppPermission>) => void) => {
        const next = new Set(set);
        next.has(key) ? next.delete(key) : next.add(key);
        setter(next);
    };

    if (userDoc?.role !== 'admin') {
        return <div className="p-8 text-center text-red-500 font-bold">Không có quyền truy cập.</div>;
    }

    return (
        <div className="space-y-8 mx-auto max-w-5xl">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
                        <Shield className="w-7 h-7 text-violet-600" />
                        Quản lý Role &amp; Quyền
                    </h1>
                    <p className="text-slate-500 mt-1 text-sm">Xem role hệ thống và tạo role tùy chỉnh với quyền chi tiết.</p>
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

            {/* ─── Built-in Roles ─── */}
            <section>
                <h2 className="text-sm font-bold text-slate-500 uppercase tracking-wider mb-3 flex items-center gap-2">
                    <Lock className="w-3.5 h-3.5" /> Role Hệ thống (không thể xóa)
                </h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                    {BUILT_IN_ROLES.map(r => (
                        <div key={r.role} className={cn('rounded-2xl border p-4 shadow-sm', COLOR_MAP[r.color])}>
                            <div className="flex items-center justify-between mb-2">
                                <span className={cn('text-xs font-bold px-2 py-0.5 rounded-full', BADGE_COLOR[r.color])}>{r.name}</span>
                                <Lock className="w-3.5 h-3.5 text-slate-300" />
                            </div>
                            <p className="text-[11px] text-slate-500 mb-2">{r.permissions.length} quyền</p>
                            <div className="flex flex-wrap gap-1">
                                {r.permissions.map(pk => {
                                    const info = ALL_PERMISSIONS.find(p => p.key === pk);
                                    return (
                                        <span key={pk} className="text-[10px] bg-white/70 text-slate-600 px-1.5 py-0.5 rounded border border-slate-200 font-medium">
                                            {info?.label ?? pk}
                                        </span>
                                    );
                                })}
                            </div>
                        </div>
                    ))}
                </div>
            </section>

            {/* ─── Custom Roles ─── */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Create Card */}
                <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
                    <h2 className="text-base font-bold text-slate-800 mb-4 flex items-center gap-2">
                        <Plus className="w-4 h-4 text-violet-500" /> Tạo Role Tùy chỉnh
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

                        {/* allowStoreManager toggle */}
                        <label className={cn(
                            'flex items-start gap-3 p-3 rounded-xl border cursor-pointer transition-colors',
                            newAllowStoreManager ? 'bg-indigo-50 border-indigo-300' : 'bg-slate-50 border-slate-200 hover:border-indigo-200'
                        )}>
                            <input type="checkbox" className="mt-0.5 accent-indigo-600 w-4 h-4"
                                checked={newAllowStoreManager}
                                onChange={e => setNewAllowStoreManager(e.target.checked)}
                            />
                            <div>
                                <p className="text-sm font-semibold text-slate-700 flex items-center gap-1.5">
                                    <Store className="w-3.5 h-3.5 text-indigo-500" /> Cho phép Cửa hàng trưởng dùng
                                </p>
                                <p className="text-[10px] text-slate-400 mt-0.5">Cửa hàng trưởng có thể gán role này khi tạo tài khoản mới.</p>
                            </div>
                        </label>

                        <div>
                            <label className="text-xs font-semibold text-slate-600 block mb-2">Quyền</label>
                            <div className="space-y-1.5 max-h-72 overflow-y-auto pr-1">
                                {ALL_PERMISSIONS.map(p => (
                                    <label key={p.key} className={cn(
                                        'flex items-start gap-3 p-2.5 rounded-lg border cursor-pointer transition-colors',
                                        newRolePerms.has(p.key) ? 'bg-violet-50 border-violet-300' : 'bg-slate-50 border-slate-200 hover:border-violet-200'
                                    )}>
                                        <input type="checkbox" className="mt-0.5 accent-violet-600"
                                            checked={newRolePerms.has(p.key)}
                                            onChange={() => togglePerm(newRolePerms, p.key, setNewRolePerms)}
                                        />
                                        <div>
                                            <p className="text-sm font-semibold text-slate-700">{p.label}</p>
                                            <p className="text-xs text-slate-500">{p.description}</p>
                                        </div>
                                    </label>
                                ))}
                            </div>
                        </div>
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

                {/* Existing Custom Roles */}
                <div className="space-y-3">
                    <h2 className="text-base font-bold text-slate-800 flex items-center gap-2">
                        <Shield className="w-4 h-4 text-violet-500" /> Role Tùy chỉnh
                        <span className="ml-auto text-xs text-slate-400 font-normal">{roles.length} role</span>
                    </h2>

                    {loading ? (
                        <div className="flex justify-center py-8">
                            <div className="w-6 h-6 border-4 border-violet-500 border-t-transparent rounded-full animate-spin" />
                        </div>
                    ) : roles.length === 0 ? (
                        <div className="bg-slate-50 border border-dashed border-slate-300 rounded-2xl p-8 text-center text-slate-400 text-sm">
                            Chưa có role tùy chỉnh. Tạo role đầu tiên →
                        </div>
                    ) : (
                        roles.map(role => (
                            <div key={role.id} className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm">
                                {editingId === role.id ? (
                                    <div className="space-y-3">
                                        <input
                                            value={editName}
                                            onChange={e => setEditName(e.target.value)}
                                            className="w-full border border-violet-300 rounded-lg p-2 text-sm font-semibold focus:ring-2 focus:ring-violet-500/20 outline-none"
                                        />
                                        <label className={cn(
                                            'flex items-center gap-2 p-2.5 rounded-lg border cursor-pointer text-sm transition-colors',
                                            editAllowStoreManager ? 'bg-indigo-50 border-indigo-300 text-indigo-800 font-semibold' : 'border-slate-100 text-slate-600'
                                        )}>
                                            <input type="checkbox" className="accent-indigo-600"
                                                checked={editAllowStoreManager}
                                                onChange={e => setEditAllowStoreManager(e.target.checked)}
                                            />
                                            <Store className="w-3.5 h-3.5 text-indigo-500" />
                                            Cho phép Cửa hàng trưởng dùng
                                        </label>
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
                                    <>
                                        <div className="flex items-start justify-between mb-2.5">
                                            <div>
                                                <div className="flex items-center gap-2">
                                                    <h3 className="font-bold text-slate-800">{role.name}</h3>
                                                    {role.allowStoreManager && (
                                                        <span className="text-[10px] bg-indigo-100 text-indigo-700 px-1.5 py-0.5 rounded-full font-semibold flex items-center gap-0.5">
                                                            <Store className="w-2.5 h-2.5" /> CH Trưởng
                                                        </span>
                                                    )}
                                                </div>
                                                <p className="text-xs text-slate-400 mt-0.5">{role.permissions.length} quyền</p>
                                            </div>
                                            <div className="flex gap-1">
                                                <button onClick={() => startEdit(role)}
                                                    className="p-1.5 rounded-lg hover:bg-violet-50 hover:text-violet-600 text-slate-400 transition-colors">
                                                    <Pencil className="w-4 h-4" />
                                                </button>
                                                <button onClick={() => handleDelete(role.id, role.name)}
                                                    className="p-1.5 rounded-lg hover:bg-red-50 hover:text-red-500 text-slate-400 transition-colors">
                                                    <Trash2 className="w-4 h-4" />
                                                </button>
                                            </div>
                                        </div>
                                        <div className="flex flex-wrap gap-1.5">
                                            {role.permissions.length === 0 ? (
                                                <span className="text-xs text-slate-400 italic">Không có quyền nào</span>
                                            ) : role.permissions.map(pKey => {
                                                const pInfo = ALL_PERMISSIONS.find(p => p.key === pKey);
                                                return (
                                                    <span key={pKey} className="text-xs bg-violet-100 text-violet-700 px-2 py-0.5 rounded-full font-medium">
                                                        {pInfo?.label ?? pKey}
                                                    </span>
                                                );
                                            })}
                                        </div>
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
