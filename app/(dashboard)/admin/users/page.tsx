'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { db } from '@/lib/firebase';
import { collection, query, where, orderBy, onSnapshot } from 'firebase/firestore';
import { UserDoc, UserRole, EmployeeType, StoreDoc, CustomRoleDoc } from '@/types';
import { Users, Plus, ShieldAlert, KeyRound, MailPlus, Search, ShieldCheck, Building2, AlertCircle, CheckCircle2, Shield } from 'lucide-react';
import { cn } from '@/lib/utils';

const ROLE_LABELS: Record<string, string> = {
    admin: 'Quản trị viên',
    store_manager: 'CH Trưởng',
    manager: 'Quản lý',
    employee: 'Nhân viên',
};

const ROLE_BADGE_CLASS: Record<string, string> = {
    admin: 'bg-red-50 text-red-700 border-red-100',
    store_manager: 'bg-purple-50 text-purple-700 border-purple-100',
    manager: 'bg-amber-50 text-amber-700 border-amber-100',
    employee: 'bg-blue-50 text-blue-700 border-blue-100',
};

export default function AdminUsersPage() {
    const { user } = useAuth();

    // Store selector state
    const [stores, setStores] = useState<StoreDoc[]>([]);
    const [selectedStoreId, setSelectedStoreId] = useState('');

    // User list state
    const [users, setUsers] = useState<UserDoc[]>([]);
    const [loading, setLoading] = useState(false);

    // Modal states
    const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
    const [editUid, setEditUid] = useState<string | null>(null);

    // Form states
    const [newName, setNewName] = useState('');
    const [newPhone, setNewPhone] = useState('');
    const [newRole, setNewRole] = useState<UserRole>('employee');
    const [newType, setNewType] = useState<EmployeeType>('PT');
    const [newDob, setNewDob] = useState('');
    const [newJobTitle, setNewJobTitle] = useState('');
    const [newEmail, setNewEmail] = useState('');
    const [newIdCard, setNewIdCard] = useState('');
    const [newBankAccount, setNewBankAccount] = useState('');
    const [newEducation, setNewEducation] = useState('');
    const [newCanManageHR, setNewCanManageHR] = useState(false);
    const [newStoreId, setNewStoreId] = useState('');
    const [newCustomRoleId, setNewCustomRoleId] = useState('');

    const [actionLoading, setActionLoading] = useState(false);
    const [actionMessage, setActionMessage] = useState({ type: '', text: '' });
    const [searchTerm, setSearchTerm] = useState('');
    const [customRoles, setCustomRoles] = useState<CustomRoleDoc[]>([]);

    const getToken = useCallback(() => user?.getIdToken(), [user]);

    // Fetch stores once
    useEffect(() => {
        if (!user) return;
        async function fetchStores() {
            try {
                const token = await getToken();
                const res = await fetch('/api/stores', { headers: { 'Authorization': `Bearer ${token}` } });
                const data = await res.json();
                setStores(Array.isArray(data) ? data : []);
            } catch { console.error('Failed to load stores'); }
        }
        fetchStores();
    }, [user, getToken]);

    // Fetch custom roles for dropdown
    useEffect(() => {
        if (!user) return;
        async function fetchRoles() {
            try {
                const token = await getToken();
                const res = await fetch('/api/roles', { headers: { Authorization: `Bearer ${token}` } });
                const data = await res.json();
                setCustomRoles(Array.isArray(data) ? data : []);
            } catch { /* silent */ }
        }
        fetchRoles();
    }, [user, getToken]);

    // Subscribe to users filtered by selected store (or all if none selected)
    useEffect(() => {
        if (!user) return;
        setLoading(true);
        const q = selectedStoreId
            ? query(collection(db, 'users'), where('storeId', '==', selectedStoreId), orderBy('name'))
            : query(collection(db, 'users'), orderBy('name'));
        const unsubscribe = onSnapshot(q, (snap) => {
            setUsers(snap.docs.map(d => d.data() as UserDoc));
            setLoading(false);
        }, () => setLoading(false));
        return () => unsubscribe();
    }, [user, selectedStoreId]);

    const resetForm = () => {
        setNewName(''); setNewPhone(''); setNewRole('employee'); setNewType('PT');
        setNewDob(''); setNewJobTitle(''); setNewEmail(''); setNewIdCard('');
        setNewBankAccount(''); setNewEducation(''); setNewCanManageHR(false); setNewCustomRoleId('');
        setNewStoreId(selectedStoreId);
        setEditUid(null);
        setIsCreateModalOpen(false);
    };

    const openCreateModal = () => {
        resetForm();
        setNewStoreId(selectedStoreId);
        setIsCreateModalOpen(true);
    };

    const openEditModal = (u: UserDoc) => {
        setEditUid(u.uid);
        setNewName(u.name); setNewPhone(u.phone); setNewRole(u.role); setNewType(u.type);
        setNewDob(u.dob || ''); setNewJobTitle(u.jobTitle || ''); setNewEmail(u.email || '');
        setNewIdCard(u.idCard || ''); setNewBankAccount(u.bankAccount || ''); setNewEducation(u.education || '');
        setNewCanManageHR(u.canManageHR || false); setNewStoreId(u.storeId || '');
        setNewCustomRoleId(u.customRoleId || '');
        setIsCreateModalOpen(true);
    };

    const showMsg = (type: 'success' | 'error', text: string) => {
        setActionMessage({ type, text });
        setTimeout(() => setActionMessage({ type: '', text: '' }), 4000);
    };

    const handleCreateOrUpdateUser = async (e: React.FormEvent) => {
        e.preventDefault();
        setActionLoading(true);
        try {
            const token = await getToken();
            const endpoint = editUid ? '/api/auth/update-user' : '/api/auth/create-user';
            const bodyPayload: Record<string, unknown> = {
                name: newName, phone: newPhone, role: newRole, type: newType,
                dob: newDob, jobTitle: newJobTitle, email: newEmail,
                idCard: newIdCard, bankAccount: newBankAccount, education: newEducation,
                canManageHR: newCanManageHR, storeId: newStoreId || undefined,
                customRoleId: newCustomRoleId || null,
                ...(editUid ? { targetUid: editUid } : {}),
            };
            const res = await fetch(endpoint, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                body: JSON.stringify(bodyPayload),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || 'Thao tác thất bại');
            showMsg('success', `Người dùng ${newName} đã được ${editUid ? 'cập nhật' : 'tạo'} thành công!`);
            resetForm();
        } catch (err: unknown) {
            showMsg('error', err instanceof Error ? err.message : 'Đã xảy ra lỗi');
        } finally {
            setActionLoading(false);
        }
    };

    const handleToggleActive = async (u: UserDoc) => {
        setActionLoading(true);
        try {
            const token = await getToken();
            const res = await fetch('/api/auth/toggle-active', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                body: JSON.stringify({ targetUid: u.uid, isActive: !u.isActive }),
            });
            if (!res.ok) { const d = await res.json(); throw new Error(d.error); }
            showMsg('success', `Tài khoản ${u.name} đã được ${!u.isActive ? 'kích hoạt' : 'vô hiệu hóa'}`);
        } catch (err: unknown) {
            showMsg('error', err instanceof Error ? err.message : 'Thao tác thất bại');
        } finally {
            setActionLoading(false);
        }
    };

    const handleResetPassword = async (uid: string, name: string) => {
        if (!confirm(`Đặt lại mật khẩu cho ${name} về mặc định (6 số cuối SĐT)?`)) return;
        setActionLoading(true);
        try {
            const token = await getToken();
            const targetUser = users.find(u => u.uid === uid);
            if (!targetUser) throw new Error('Không tìm thấy người dùng');
            const defaultPwd = targetUser.phone.slice(-6);
            await fetch('/api/auth/reset-password', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                body: JSON.stringify({ targetUid: uid, newPassword: defaultPwd }),
            });
            showMsg('success', `Đặt lại mật khẩu thành công cho ${name}`);
        } catch (err: unknown) {
            showMsg('error', err instanceof Error ? err.message : 'Thao tác thất bại');
        } finally {
            setActionLoading(false);
        }
    };

    const selectedStoreName = stores.find(s => s.id === selectedStoreId)?.name;
    const filtered = users.filter(u =>
        u.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        u.phone.includes(searchTerm)
    );

    return (
        <div className="space-y-6 max-w-6xl mx-auto">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
                        <Users className="w-7 h-7 text-slate-700" />
                        Quản lý Người dùng
                    </h1>
                    <p className="text-slate-500 mt-1">Xem và quản lý nhân sự theo từng cửa hàng.</p>
                </div>
                <button
                    onClick={openCreateModal}
                    className="flex items-center gap-2 bg-slate-800 hover:bg-slate-900 text-white px-5 py-2.5 rounded-xl font-medium shadow-sm transition-colors shrink-0"
                >
                    <Plus className="w-4 h-4" /> Thêm nhân viên
                </button>
            </div>

            {/* Store Selector */}
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4 flex flex-col sm:flex-row items-start sm:items-center gap-4">
                <div className="flex items-center gap-2 shrink-0">
                    <Building2 className="w-5 h-5 text-indigo-500" />
                    <span className="text-sm font-semibold text-slate-700">Chọn Cửa hàng:</span>
                </div>
                <select
                    value={selectedStoreId}
                    onChange={e => { setSelectedStoreId(e.target.value); setSearchTerm(''); }}
                    className="flex-1 border border-slate-200 rounded-xl p-2.5 text-sm outline-none focus:ring-2 focus:ring-indigo-300 focus:border-indigo-400 bg-slate-50 font-medium min-w-[200px]"
                >
                    <option value="">-- Tất cả cửa hàng --</option>
                    {stores.map(s => (
                        <option key={s.id} value={s.id}>{s.name}{!s.isActive ? ' (Đã tắt)' : ''}</option>
                    ))}
                </select>
                <span className="text-sm text-slate-500 shrink-0">
                    {selectedStoreId
                        ? <><strong className="text-indigo-700">{stores.find(s => s.id === selectedStoreId)?.name}</strong> &middot; {users.length} người</>
                        : <>{users.length} người (tất cả)</>
                    }
                </span>
            </div>

            {/* Messages */}
            {actionMessage.text && (
                <div className={cn(
                    'p-4 rounded-xl flex items-center gap-3 text-sm font-medium animate-in fade-in',
                    actionMessage.type === 'success' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-red-50 text-red-600 border border-red-100'
                )}>
                    {actionMessage.type === 'success' ? <CheckCircle2 className="w-5 h-5 shrink-0" /> : <AlertCircle className="w-5 h-5 shrink-0" />}
                    {actionMessage.text}
                </div>
            )}

            {/* User table - always shown */}
            {(() => {
                const storeMap = new Map(stores.map(s => [s.id, s.name]));
                return (
                    <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
                        {/* Search bar */}
                        <div className="p-4 border-b border-slate-100 flex items-center gap-3">
                            <Search className="w-4 h-4 text-slate-400 shrink-0" />
                            <input
                                value={searchTerm}
                                onChange={e => setSearchTerm(e.target.value)}
                                placeholder="Tìm theo tên hoặc số điện thoại..."
                                className="flex-1 text-sm outline-none bg-transparent text-slate-700 placeholder-slate-400"
                            />
                            {searchTerm && (
                                <button onClick={() => setSearchTerm('')} className="text-xs text-slate-400 hover:text-slate-600">Xóa</button>
                            )}
                        </div>

                        {loading ? (
                            <div className="p-12 text-center text-slate-400">
                                <div className="w-8 h-8 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
                                Đang tải nhân sự...
                            </div>
                        ) : filtered.length === 0 ? (
                            <div className="p-12 text-center text-slate-400">
                                <Users className="w-12 h-12 mx-auto mb-3 opacity-30" />
                                <p className="font-medium">{searchTerm ? 'Không tìm thấy kết quả' : 'Không có nhân sự nào'}</p>
                            </div>
                        ) : (
                            <div className="overflow-x-auto">
                                <table className="w-full text-sm text-left">
                                    <thead className="text-xs text-slate-500 bg-slate-50/80 border-b border-slate-100">
                                        <tr>
                                            <th className="px-5 py-3.5 font-semibold">Họ tên</th>
                                            <th className="px-4 py-3.5 font-semibold">SĐT</th>
                                            <th className="px-4 py-3.5 font-semibold text-center">Vai trò</th>
                                            <th className="px-4 py-3.5 font-semibold text-center">Loại</th>
                                            <th className="px-4 py-3.5 font-semibold">Cửa hàng</th>
                                            <th className="px-4 py-3.5 font-semibold text-center">Trạng thái</th>
                                            <th className="px-4 py-3.5 font-semibold text-right">Thao tác</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100">
                                        {filtered.map(u => (
                                            <tr key={u.uid} className={cn('hover:bg-slate-50/60 transition-colors group', !u.isActive && 'opacity-50')}>
                                                <td className="px-5 py-3.5 font-medium text-slate-800">
                                                    {u.name}
                                                    {u.canManageHR && <span title="Có quyền quản lý HR"><ShieldCheck className="w-3.5 h-3.5 inline ml-1.5 text-indigo-500" /></span>}
                                                </td>
                                                <td className="px-4 py-3.5 text-slate-500 font-mono text-xs">{u.phone}</td>
                                                <td className="px-4 py-3.5 text-center">
                                                    <span className={cn('text-[11px] font-bold px-2 py-0.5 rounded border', ROLE_BADGE_CLASS[u.role] ?? 'bg-slate-100 text-slate-600')}>
                                                        {ROLE_LABELS[u.role] ?? u.role}
                                                    </span>
                                                </td>
                                                <td className="px-4 py-3.5 text-center">
                                                    <span className={cn('text-[11px] font-bold px-2 py-0.5 rounded border',
                                                        u.type === 'FT' ? 'bg-blue-50 text-blue-700 border-blue-100' : 'bg-purple-50 text-purple-700 border-purple-100'
                                                    )}>
                                                        {u.type === 'FT' ? 'Toàn thời gian' : 'Bán thời gian'}
                                                    </span>
                                                </td>
                                                <td className="px-4 py-3.5">
                                                    <span className="text-xs font-medium px-2 py-0.5 rounded bg-slate-100 text-slate-600">
                                                        {u.storeId ? (storeMap.get(u.storeId) ?? u.storeId) : <span className="italic text-slate-400">— Admin —</span>}
                                                    </span>
                                                </td>
                                                <td className="px-4 py-3.5 text-center">
                                                    <button
                                                        onClick={() => handleToggleActive(u)}
                                                        disabled={actionLoading}
                                                        className={cn(
                                                            'text-[11px] font-bold px-2 py-0.5 rounded border cursor-pointer transition-opacity hover:opacity-70 disabled:cursor-not-allowed',
                                                            u.isActive ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-slate-100 text-slate-500 border-slate-200'
                                                        )}
                                                    >
                                                        {u.isActive ? 'Đang làm' : 'Đã nghỉ'}
                                                    </button>
                                                </td>
                                                <td className="px-4 py-3.5 text-right">
                                                    <div className="flex items-center justify-end gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                                                        <button
                                                            onClick={() => openEditModal(u)}
                                                            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-blue-50 text-blue-600 hover:bg-blue-100 border border-blue-200 transition-colors"
                                                        >
                                                            Sửa
                                                        </button>
                                                        <button
                                                            onClick={() => handleResetPassword(u.uid, u.name)}
                                                            disabled={actionLoading}
                                                            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-orange-50 text-orange-600 hover:bg-orange-100 border border-orange-200 transition-colors disabled:opacity-50"
                                                        >
                                                            <KeyRound className="w-3.5 h-3.5" /> Đặt lại
                                                        </button>
                                                    </div>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </div>
                );
            })()}

            {/* Create / Edit Modal */}
            {isCreateModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
                    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl overflow-hidden animate-in zoom-in-95 duration-200 max-h-[90vh] overflow-y-auto">
                        <div className="p-6 border-b border-slate-100 flex items-center gap-3 sticky top-0 bg-white z-10">
                            <div className="w-10 h-10 rounded-full bg-slate-100 text-slate-600 flex items-center justify-center">
                                <MailPlus className="w-5 h-5" />
                            </div>
                            <div>
                                <h3 className="text-lg font-bold text-slate-900">{editUid ? 'Cập nhật Người dùng' : 'Tạo Người dùng mới'}</h3>
                                <p className="text-xs text-slate-500">Tài khoản Firebase Auth sẽ được tạo tự động khi thêm mới.</p>
                            </div>
                        </div>

                        <form onSubmit={handleCreateOrUpdateUser} className="p-6 space-y-5">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                                {/* Left col - Basic info */}
                                <div className="space-y-4">
                                    <h4 className="font-semibold text-slate-800 text-sm border-b pb-2">Thông tin cơ bản</h4>
                                    {[
                                        { label: 'Họ và Tên *', value: newName, setter: setNewName, placeholder: 'Nguyễn Văn A', required: true },
                                        { label: 'Số điện thoại *', value: newPhone, setter: setNewPhone, placeholder: '0901234567', required: true, disabled: !!editUid },
                                    ].map(f => (
                                        <div key={f.label} className="space-y-1.5">
                                            <label className="text-sm font-medium text-slate-700">{f.label}</label>
                                            <input
                                                required={f.required} disabled={f.disabled} placeholder={f.placeholder}
                                                value={f.value} onChange={e => f.setter(e.target.value)}
                                                className="w-full bg-slate-50 border border-slate-200 text-sm rounded-lg focus:ring-indigo-500 focus:border-indigo-400 block p-2.5 disabled:bg-slate-100 disabled:text-slate-400"
                                            />
                                        </div>
                                    ))}
                                    <div className="space-y-1.5">
                                        <label className="text-sm font-medium text-slate-700">Loại hợp đồng *</label>
                                        <select value={newType} onChange={e => setNewType(e.target.value as EmployeeType)}
                                            className="w-full bg-slate-50 border border-slate-200 text-sm rounded-lg focus:ring-indigo-500 focus:border-indigo-400 block p-2.5">
                                            <option value="PT">Bán thời gian (PT)</option>
                                            <option value="FT">Toàn thời gian (FT)</option>
                                        </select>
                                    </div>
                                    <div className="space-y-1.5">
                                        <label className="text-sm font-medium text-slate-700 flex items-center gap-1.5">
                                            <Shield className="w-3.5 h-3.5 text-violet-500" />
                                            Vai trò *
                                        </label>
                                        <select
                                            value={newCustomRoleId ? `custom:${newCustomRoleId}` : newRole}
                                            onChange={e => {
                                                const val = e.target.value;
                                                if (val.startsWith('custom:')) {
                                                    setNewRole('employee');
                                                    setNewCustomRoleId(val.slice(7));
                                                } else {
                                                    setNewRole(val as UserRole);
                                                    setNewCustomRoleId('');
                                                }
                                            }}
                                            className="w-full bg-slate-50 border border-slate-200 text-sm rounded-lg focus:ring-indigo-500 focus:border-indigo-400 block p-2.5"
                                        >
                                            <option value="employee">Nhân viên</option>
                                            <option value="manager">Quản lý</option>
                                            <option value="store_manager">Cửa hàng trưởng</option>
                                            <option value="admin">Quản trị viên</option>
                                            {customRoles.map(r => (
                                                <option key={r.id} value={`custom:${r.id}`}>{r.name}</option>
                                            ))}
                                        </select>
                                    </div>
                                    <div className="space-y-1.5">
                                        <label className="text-sm font-medium text-slate-700">Cửa hàng</label>
                                        <select value={newStoreId} onChange={e => setNewStoreId(e.target.value)}
                                            className="w-full bg-slate-50 border border-slate-200 text-sm rounded-lg focus:ring-indigo-500 focus:border-indigo-400 block p-2.5">
                                            <option value="">(Không thuộc cửa hàng)</option>
                                            {stores.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                                        </select>
                                    </div>
                                    {newRole !== 'admin' && (
                                        <label className="flex items-center gap-2 cursor-pointer p-3 border border-slate-200 rounded-lg bg-slate-50 hover:bg-slate-100 transition-colors">
                                            <input type="checkbox" checked={newCanManageHR} onChange={e => setNewCanManageHR(e.target.checked)}
                                                className="w-4 h-4 text-indigo-600 rounded focus:ring-indigo-500 cursor-pointer" />
                                            <div>
                                                <span className="text-sm font-semibold text-slate-800">Quyền Quản lý Nhân sự &amp; Xếp lịch</span>
                                                <p className="text-[10px] text-slate-500 mt-0.5">Cho phép thêm, sửa, tắt hoạt động nhân viên và phân ca.</p>
                                            </div>
                                        </label>
                                    )}
                                </div>


                                {/* Right col - Extended details */}
                                <div className="space-y-4">
                                    <h4 className="font-semibold text-slate-800 text-sm border-b pb-2">Thông tin bổ sung</h4>
                                    {[
                                        { label: 'Ngày sinh', value: newDob, setter: setNewDob, type: 'date' },
                                        { label: 'Chức danh', value: newJobTitle, setter: setNewJobTitle, placeholder: 'VD: Nhân viên phục vụ' },
                                        { label: 'Email thực', value: newEmail, setter: setNewEmail, placeholder: 'email@example.com', type: 'email' },
                                        { label: 'CCCD/CMND', value: newIdCard, setter: setNewIdCard, placeholder: '0123456789' },
                                        { label: 'Tài khoản ngân hàng', value: newBankAccount, setter: setNewBankAccount, placeholder: '123456789' },
                                        { label: 'Học vấn', value: newEducation, setter: setNewEducation, placeholder: 'Đại học, Cao đẳng...' },
                                    ].map(f => (
                                        <div key={f.label} className="space-y-1.5">
                                            <label className="text-sm font-medium text-slate-700">{f.label}</label>
                                            <input
                                                type={f.type || 'text'} placeholder={f.placeholder}
                                                value={f.value} onChange={e => f.setter(e.target.value)}
                                                className="w-full bg-slate-50 border border-slate-200 text-sm rounded-lg focus:ring-indigo-500 focus:border-indigo-400 block p-2.5"
                                            />
                                        </div>
                                    ))}
                                </div>
                            </div>

                            {actionMessage.text && isCreateModalOpen && (
                                <div className={cn('p-3 rounded-lg text-sm', actionMessage.type === 'error' ? 'bg-red-50 text-red-600' : 'bg-emerald-50 text-emerald-700')}>
                                    {actionMessage.text}
                                </div>
                            )}

                            <div className="flex gap-3 pt-2">
                                <button type="button" onClick={resetForm}
                                    className="flex-1 border border-slate-200 hover:bg-slate-50 text-slate-700 px-4 py-2.5 rounded-xl font-medium text-sm">Hủy</button>
                                <button type="submit" disabled={actionLoading}
                                    className="flex-1 bg-slate-800 hover:bg-slate-900 text-white px-4 py-2.5 rounded-xl font-medium text-sm disabled:opacity-50">
                                    {actionLoading ? 'Đang lưu...' : (editUid ? 'Cập nhật' : 'Tạo mới')}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
