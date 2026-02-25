'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { db } from '@/lib/firebase';
import { collection, query, orderBy, onSnapshot } from 'firebase/firestore';
import { UserDoc, UserRole, EmployeeType } from '@/types';
import { Users, Plus, ShieldAlert, KeyRound, MailPlus, Search, ShieldCheck } from 'lucide-react';

export default function AdminUsersPage() {
    const { user } = useAuth();
    const [users, setUsers] = useState<UserDoc[]>([]);
    const [loading, setLoading] = useState(true);

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

    const [actionLoading, setActionLoading] = useState(false);
    const [actionMessage, setActionMessage] = useState({ type: '', text: '' });
    const [searchTerm, setSearchTerm] = useState('');

    // 1. Real-time fetch users
    useEffect(() => {
        if (!user) return;
        const q = query(collection(db, 'users'), orderBy('name'));
        const unsubscribe = onSnapshot(q, (snapshot) => {
            const docs = snapshot.docs.map(d => d.data() as UserDoc);
            setUsers(docs);
            setLoading(false);
        });
        return () => unsubscribe();
    }, [user]);

    // 2. Create or Update User via Admin API
    const handleCreateOrUpdateUser = async (e: React.FormEvent) => {
        e.preventDefault();
        setActionLoading(true);
        setActionMessage({ type: '', text: '' });

        try {
            const token = await user?.getIdToken();
            const endpoint = editUid ? '/api/auth/update-user' : '/api/auth/create-user';

            const bodyPayload: any = {
                name: newName,
                phone: newPhone,
                role: newRole,
                type: newType,
                dob: newDob,
                jobTitle: newJobTitle,
                email: newEmail,
                idCard: newIdCard,
                bankAccount: newBankAccount,
                education: newEducation,
                canManageHR: newCanManageHR
            };

            if (editUid) {
                bodyPayload.targetUid = editUid;
            }

            const res = await fetch(endpoint, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify(bodyPayload)
            });

            const data = await res.json();
            if (!res.ok) throw new Error(data.error || `Không thể ${editUid ? 'cập nhật' : 'tạo'} người dùng`);

            setActionMessage({ type: 'success', text: `Người dùng ${newName} đã được ${editUid ? 'cập nhật' : 'tạo'} thành công!` });
            setIsCreateModalOpen(false);
            setEditUid(null);
            resetForm();
        } catch (err: unknown) {
            if (err instanceof Error) {
                setActionMessage({ type: 'error', text: err.message });
            } else {
                setActionMessage({ type: 'error', text: 'Đã xảy ra lỗi không xác định' });
            }
        } finally {
            setActionLoading(false);
        }
    };

    const resetForm = () => {
        setNewName(''); setNewPhone(''); setNewRole('employee'); setNewType('PT');
        setNewDob(''); setNewJobTitle(''); setNewEmail('');
        setNewIdCard(''); setNewBankAccount(''); setNewEducation(''); setNewCanManageHR(false);
    };

    const openEditModal = (currentUser: UserDoc) => {
        setNewName(currentUser.name);
        setNewPhone(currentUser.phone);
        setNewRole(currentUser.role || 'employee');
        setNewType(currentUser.type || 'PT');
        setNewJobTitle(currentUser.jobTitle || '');
        setNewEmail(currentUser.email || '');
        setNewDob(currentUser.dob || '');
        setNewJobTitle(currentUser.jobTitle || '');
        setNewEmail(currentUser.email || '');
        setNewIdCard(currentUser.idCard || '');
        setNewBankAccount(currentUser.bankAccount || '');
        setNewEducation(currentUser.education || '');
        setNewCanManageHR(currentUser.canManageHR || false);
        setEditUid(currentUser.uid);
        setIsCreateModalOpen(true);
    };

    // 3. Reset Password via Admin API
    const handleResetPassword = async (targetUid: string, targetName: string) => {
        if (!confirm(`Bạn có chắc chắn muốn đặt lại mật khẩu cho ${targetName} không? Mật khẩu sẽ trở thành 6 số cuối của số điện thoại.`)) return;

        setActionLoading(true);
        setActionMessage({ type: '', text: '' });

        try {
            const token = await user?.getIdToken();
            const res = await fetch('/api/auth/reset-password', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({ targetUid })
            });

            const data = await res.json();
            if (!res.ok) throw new Error(data.error || 'Đặt lại mật khẩu thất bại');

            setActionMessage({ type: 'success', text: `Mật khẩu của ${targetName} đã được đặt lại thành công.` });
        } catch (err: unknown) {
            if (err instanceof Error) {
                setActionMessage({ type: 'error', text: err.message });
            } else {
                setActionMessage({ type: 'error', text: 'Đã xảy ra lỗi không xác định' });
            }
        } finally {
            setActionLoading(false);
        }
    };

    // 4. Change Role via Admin API
    const handleChangeRole = async (targetUid: string, newRoleValue: UserRole) => {
        setActionLoading(true);
        setActionMessage({ type: '', text: '' });

        try {
            const token = await user?.getIdToken();
            const res = await fetch('/api/auth/change-role', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({ targetUid, role: newRoleValue })
            });

            const data = await res.json();
            if (!res.ok) throw new Error(data.error || 'Cập nhật vai trò thất bại');

            setActionMessage({ type: 'success', text: 'Đã cập nhật vai trò thành công.' });
        } catch (err: unknown) {
            if (err instanceof Error) {
                setActionMessage({ type: 'error', text: err.message });
            } else {
                setActionMessage({ type: 'error', text: 'Đã xảy ra lỗi không xác định' });
            }
        } finally {
            setActionLoading(false);
        }
    };

    const filteredUsers = users.filter(u =>
        u.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        u.phone.includes(searchTerm)
    );

    return (
        <div className="space-y-6 max-w-6xl mx-auto">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold bg-gradient-to-r from-red-600 to-rose-600 bg-clip-text text-transparent flex items-center gap-2">
                        <Users className="w-7 h-7 text-red-600" />
                        Quản lý người dùng
                    </h1>
                    <p className="text-slate-500 mt-1">
                        Tạo và quản lý quyền truy cập hệ thống cho tất cả nhân viên.
                    </p>
                </div>

                <button
                    onClick={() => {
                        resetForm();
                        setEditUid(null);
                        setIsCreateModalOpen(true);
                    }}
                    className="flex items-center gap-2 bg-gradient-to-r from-red-600 to-rose-600 hover:from-red-700 hover:to-rose-700 text-white px-5 py-2.5 rounded-xl font-medium shadow-md shadow-red-500/20 transition-all"
                >
                    <Plus className="w-4 h-4" />
                    Tạo người dùng mới
                </button>
            </div>

            {actionMessage.text && (
                <div className={`p-4 rounded-xl flex items-center justify-between gap-3 border shadow-sm ${actionMessage.type === 'error' ? 'bg-red-50 text-red-700 border-red-200' : 'bg-emerald-50 text-emerald-700 border-emerald-200'
                    }`}>
                    <div className="flex items-center gap-2">
                        {actionMessage.type === 'error' ? <ShieldAlert className="w-5 h-5" /> : <ShieldCheck className="w-5 h-5" />}
                        <p className="text-sm font-medium">{actionMessage.text}</p>
                    </div>
                    <button onClick={() => setActionMessage({ type: '', text: '' })} className="opacity-50 hover:opacity-100 font-bold px-2">×</button>
                </div>
            )}

            {/* Table Container */}
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden flex flex-col">
                {/* Search Bar */}
                <div className="p-4 border-b border-slate-100 bg-slate-50 flex items-center gap-2">
                    <div className="relative flex-1 max-w-sm">
                        <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                        <input
                            type="text"
                            placeholder="Tìm kiếm theo tên hoặc số điện thoại..."
                            value={searchTerm}
                            onChange={e => setSearchTerm(e.target.value)}
                            className="w-full pl-9 pr-4 py-2 bg-white border border-slate-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-red-500/50 focus:border-red-500 transition-shadow"
                        />
                    </div>
                    <div className="text-sm text-slate-500 font-medium ml-4">
                        Tổng số: {users.length}
                    </div>
                </div>

                <div className="overflow-x-auto">
                    <table className="w-full text-sm text-left text-slate-600">
                        <thead className="text-xs text-slate-500 uppercase bg-slate-50/50 border-b border-slate-200">
                            <tr>
                                <th scope="col" className="px-6 py-4 font-semibold">Tên & Số điện thoại</th>
                                <th scope="col" className="px-6 py-4 font-semibold">Loại hợp đồng</th>
                                <th scope="col" className="px-6 py-4 font-semibold">Vai trò</th>
                                <th scope="col" className="px-6 py-4 text-right font-semibold">Hành động</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {loading ? (
                                <tr>
                                    <td colSpan={4} className="py-12 text-center">
                                        <div className="w-8 h-8 border-4 border-red-500 border-t-transparent rounded-full animate-spin mx-auto"></div>
                                    </td>
                                </tr>
                            ) : filteredUsers.length === 0 ? (
                                <tr>
                                    <td colSpan={4} className="py-12 text-center text-slate-400">Không tìm thấy người dùng nào</td>
                                </tr>
                            ) : (
                                filteredUsers.map((u) => (
                                    <tr key={u.uid} className="hover:bg-slate-50/80 transition-colors group">
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <div className="font-semibold text-slate-900 group-hover:text-red-700 transition-colors">{u.name}</div>
                                            <div className="text-slate-500 text-xs mt-0.5">{u.phone}</div>
                                        </td>
                                        <td className="px-6 py-4">
                                            <span className={`px-2 py-1 text-[10px] font-bold uppercase rounded ${u.type === 'FT' ? 'bg-blue-100 text-blue-700' : 'bg-purple-100 text-purple-700'
                                                }`}>
                                                {u.type === 'FT' ? 'Toàn thời gian (FT)' : 'Bán thời gian (PT)'}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4">
                                            <select
                                                value={u.role}
                                                disabled={actionLoading || u.uid === user?.uid}
                                                onChange={(e) => handleChangeRole(u.uid, e.target.value as UserRole)}
                                                className={`bg-slate-50 border border-slate-200 text-xs rounded-lg focus:ring-red-500 focus:border-red-500 block p-2 cursor-pointer
                          ${u.role === 'admin' ? 'text-red-600 font-bold bg-red-50/50 border-red-200' : ''}
                          ${u.role === 'manager' ? 'text-amber-600 font-bold bg-amber-50/50 border-amber-200' : ''}
                          ${u.role === 'employee' ? 'text-slate-600 font-medium' : ''}
                        `}
                                            >
                                                <option value="employee">Nhân viên</option>
                                                <option value="manager">Quản lý</option>
                                                <option value="admin">Quản trị viên</option>
                                            </select>
                                        </td>
                                        <td className="px-6 py-4 text-right">
                                            <div className="flex items-center justify-end gap-2">
                                                <button
                                                    onClick={() => openEditModal(u)}
                                                    disabled={actionLoading}
                                                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-blue-50 text-blue-600 hover:bg-blue-100 border border-blue-200 transition-colors focus:ring-2 focus:ring-blue-500/50 disabled:opacity-50"
                                                    title="Chỉnh sửa người dùng"
                                                >
                                                    Sửa
                                                </button>
                                                <button
                                                    onClick={() => handleResetPassword(u.uid, u.name)}
                                                    disabled={actionLoading}
                                                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-orange-50 text-orange-600 hover:bg-orange-100 border border-orange-200 transition-colors focus:ring-2 focus:ring-orange-500/50 disabled:opacity-50"
                                                    title="Đặt lại mật khẩu mặc định (6 số cuối SĐT)"
                                                >
                                                    <KeyRound className="w-3.5 h-3.5" />
                                                    Đặt lại
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Create Modal */}
            {isCreateModalOpen && (
                <div className="fixed inset-0 z-50 -top-10 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
                    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl overflow-hidden animate-in zoom-in-95 duration-200">
                        <div className="p-6 border-b border-slate-100 flex items-center gap-3">
                            <div className="w-10 h-10 rounded-full bg-red-100 text-red-600 flex items-center justify-center">
                                <MailPlus className="w-5 h-5" />
                            </div>
                            <div>
                                <h3 className="text-lg font-bold text-slate-900">{editUid ? 'Cập nhật Người dùng' : 'Tạo Nhân viên mới'}</h3>
                                <p className="text-xs text-slate-500">Tài khoản Firebase Auth sẽ được tạo tự động.</p>
                            </div>
                        </div>

                        <form onSubmit={handleCreateOrUpdateUser} className="p-6 space-y-5">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                                {/* Base Information */}
                                <div className="space-y-4">
                                    <h4 className="font-semibold text-slate-800 text-sm border-b pb-2">Thông tin cơ bản</h4>

                                    <div className="space-y-1.5">
                                        <label className="text-sm font-medium text-slate-700">Họ và Tên <span className="text-red-500">*</span></label>
                                        <input
                                            type="text" required
                                            value={newName} onChange={e => setNewName(e.target.value)}
                                            className="w-full bg-slate-50 border border-slate-200 text-sm rounded-lg focus:ring-red-500 focus:border-red-500 block p-2.5"
                                            placeholder="Nguyễn Văn A"
                                        />
                                    </div>
                                    <div className="space-y-1.5">
                                        <label className="text-sm font-medium text-slate-700">Số điện thoại (ID đăng nhập) <span className="text-red-500">*</span></label>
                                        <input
                                            type="tel" required
                                            value={newPhone} onChange={e => setNewPhone(e.target.value)}
                                            className="w-full bg-slate-50 border border-slate-200 text-sm rounded-lg focus:ring-red-500 focus:border-red-500 block p-2.5"
                                            placeholder="0912345678"
                                        />
                                        <p className="text-[10px] text-slate-400 mt-1 flex items-center gap-1">
                                            <KeyRound className="w-3 h-3" />
                                            Mật khẩu mặc định là 6 số cuối.
                                        </p>
                                    </div>
                                    <div className="grid grid-cols-2 gap-4">
                                        <div className="space-y-1.5">
                                            <label className="text-sm font-medium text-slate-700">Loại hợp đồng <span className="text-red-500">*</span></label>
                                            <select
                                                value={newType} onChange={e => setNewType(e.target.value as EmployeeType)}
                                                className="w-full bg-slate-50 border border-slate-200 text-sm rounded-lg focus:ring-red-500 focus:border-red-500 block p-2.5 cursor-pointer"
                                            >
                                                <option value="PT">Bán thời gian (PT)</option>
                                                <option value="FT">Toàn thời gian (FT)</option>
                                            </select>
                                        </div>
                                        <div className="space-y-1.5">
                                            <label className="text-sm font-medium text-slate-700">Vai trò hệ thống <span className="text-red-500">*</span></label>
                                            <select
                                                value={newRole} onChange={e => setNewRole(e.target.value as UserRole)}
                                                className="w-full bg-slate-50 border border-slate-200 text-sm rounded-lg focus:ring-red-500 focus:border-red-500 block p-2.5 cursor-pointer"
                                            >
                                                <option value="employee">Nhân viên</option>
                                                <option value="manager">Quản lý</option>
                                                <option value="admin">Quản trị viên</option>
                                            </select>
                                        </div>
                                    </div>

                                    {newRole !== 'admin' && (
                                        <div className="space-y-1.5 mt-2">
                                            <label className="flex items-center gap-2 cursor-pointer p-3 border border-slate-200 rounded-lg bg-slate-50 hover:bg-slate-100 transition-colors">
                                                <input
                                                    type="checkbox"
                                                    checked={newCanManageHR}
                                                    onChange={(e) => setNewCanManageHR(e.target.checked)}
                                                    className="w-4 h-4 text-red-600 rounded focus:ring-red-500 cursor-pointer"
                                                />
                                                <div>
                                                    <span className="text-sm font-semibold text-slate-800">Quyền Quản lý Nhân sự & Xếp lịch</span>
                                                    <p className="text-[10px] text-slate-500 mt-0.5">Cho phép thêm, sửa, tắt hoạt động nhân viên và phân ca.</p>
                                                </div>
                                            </label>
                                        </div>
                                    )}
                                </div>

                                {/* Extended Details */}
                                <div className="space-y-4">
                                    <h4 className="font-semibold text-slate-800 text-sm border-b pb-2">Thông tin chi tiết</h4>

                                    <div className="space-y-1.5">
                                        <label className="text-sm font-medium text-slate-700">Chức danh / Vị trí</label>
                                        <input
                                            type="text"
                                            value={newJobTitle} onChange={e => setNewJobTitle(e.target.value)}
                                            className="w-full bg-slate-50 border border-slate-200 text-sm rounded-lg focus:ring-red-500 focus:border-red-500 block p-2.5"
                                            placeholder="VD: Thu ngân, Kỹ thuật..."
                                        />
                                    </div>
                                    <div className="space-y-1.5">
                                        <label className="text-sm font-medium text-slate-700">Địa chỉ Email</label>
                                        <input
                                            type="email"
                                            value={newEmail} onChange={e => setNewEmail(e.target.value)}
                                            className="w-full bg-slate-50 border border-slate-200 text-sm rounded-lg focus:ring-red-500 focus:border-red-500 block p-2.5"
                                            placeholder="employee@example.com"
                                        />
                                    </div>
                                    <div className="space-y-1.5">
                                        <label className="text-sm font-medium text-slate-700">Mã số CCCD</label>
                                        <input
                                            type="text"
                                            value={newIdCard} onChange={e => setNewIdCard(e.target.value)}
                                            className="w-full bg-slate-50 border border-slate-200 text-sm rounded-lg focus:ring-red-500 focus:border-red-500 block p-2.5"
                                            placeholder="012345678910"
                                        />
                                    </div>
                                    <div className="space-y-1.5">
                                        <label className="text-sm font-medium text-slate-700">Tài khoản Ngân hàng</label>
                                        <input
                                            type="text"
                                            value={newBankAccount} onChange={e => setNewBankAccount(e.target.value)}
                                            className="w-full bg-slate-50 border border-slate-200 text-sm rounded-lg focus:ring-red-500 focus:border-red-500 block p-2.5"
                                            placeholder="Bank Name - Account Number"
                                        />
                                    </div>
                                    <div className="space-y-1.5">
                                        <label className="text-sm font-medium text-slate-700">Trình độ học vấn</label>
                                        <input
                                            type="text"
                                            value={newEducation} onChange={e => setNewEducation(e.target.value)}
                                            className="w-full bg-slate-50 border border-slate-200 text-sm rounded-lg focus:ring-red-500 focus:border-red-500 block p-2.5"
                                            placeholder="VD: Cử nhân, Kỹ sư..."
                                        />
                                    </div>
                                </div>
                            </div>

                            <div className="flex gap-3 pt-4 border-t border-slate-100 mt-6">
                                <button
                                    type="button"
                                    onClick={() => {
                                        setIsCreateModalOpen(false);
                                        setEditUid(null);
                                    }}
                                    className="w-1/2 bg-white border border-slate-300 text-slate-700 hover:bg-slate-50 font-medium rounded-lg text-sm px-5 py-2.5 text-center transition-colors"
                                >
                                    Hủy
                                </button>
                                <button
                                    type="submit"
                                    disabled={actionLoading}
                                    className="w-1/2 text-white bg-red-600 hover:bg-red-700 focus:ring-4 focus:ring-red-500/30 font-medium rounded-lg text-sm px-5 py-2.5 text-center disabled:opacity-50 flex justify-center items-center gap-2 transition-all shadow-md shadow-red-600/20"
                                >
                                    {actionLoading ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div> : (editUid ? 'Lưu thay đổi' : 'Tạo nhân viên')}
                                </button>
                            </div>
                        </form>
                    </div>
                </div >
            )
            }
        </div >
    );
}
