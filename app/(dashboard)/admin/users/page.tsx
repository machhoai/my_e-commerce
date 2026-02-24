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

    // Form states
    const [newName, setNewName] = useState('');
    const [newPhone, setNewPhone] = useState('');
    const [newRole, setNewRole] = useState<UserRole>('employee');
    const [newType, setNewType] = useState<EmployeeType>('PT');

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

    // 2. Create User via Admin API
    const handleCreateUser = async (e: React.FormEvent) => {
        e.preventDefault();
        setActionLoading(true);
        setActionMessage({ type: '', text: '' });

        try {
            const token = await user?.getIdToken();
            const res = await fetch('/api/auth/create-user', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({ name: newName, phone: newPhone, role: newRole, type: newType })
            });

            const data = await res.json();
            if (!res.ok) throw new Error(data.error || 'Failed to create user');

            setActionMessage({ type: 'success', text: `User ${newName} created successfully!` });
            setIsCreateModalOpen(false);
            setNewName(''); setNewPhone(''); setNewRole('employee'); setNewType('PT');
        } catch (err: unknown) {
            if (err instanceof Error) {
                setActionMessage({ type: 'error', text: err.message });
            } else {
                setActionMessage({ type: 'error', text: 'An unknown error occurred' });
            }
        } finally {
            setActionLoading(false);
        }
    };

    // 3. Reset Password via Admin API
    const handleResetPassword = async (targetUid: string, targetName: string) => {
        if (!confirm(`Are you sure you want to reset password for ${targetName}? It will become the last 6 digits of their phone number.`)) return;

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
            if (!res.ok) throw new Error(data.error || 'Failed to reset password');

            setActionMessage({ type: 'success', text: `Password for ${targetName} reset successfully.` });
        } catch (err: unknown) {
            if (err instanceof Error) {
                setActionMessage({ type: 'error', text: err.message });
            } else {
                setActionMessage({ type: 'error', text: 'An unknown error occurred' });
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
            if (!res.ok) throw new Error(data.error || 'Failed to change role');

            setActionMessage({ type: 'success', text: 'Role updated successfully.' });
        } catch (err: unknown) {
            if (err instanceof Error) {
                setActionMessage({ type: 'error', text: err.message });
            } else {
                setActionMessage({ type: 'error', text: 'An unknown error occurred' });
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
                        User Management
                    </h1>
                    <p className="text-slate-500 mt-1">
                        Create and manage system access for all staff members.
                    </p>
                </div>

                <button
                    onClick={() => setIsCreateModalOpen(true)}
                    className="flex items-center gap-2 bg-gradient-to-r from-red-600 to-rose-600 hover:from-red-700 hover:to-rose-700 text-white px-5 py-2.5 rounded-xl font-medium shadow-md shadow-red-500/20 transition-all"
                >
                    <Plus className="w-4 h-4" />
                    Create New User
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
                            placeholder="Search by name or phone..."
                            value={searchTerm}
                            onChange={e => setSearchTerm(e.target.value)}
                            className="w-full pl-9 pr-4 py-2 bg-white border border-slate-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-red-500/50 focus:border-red-500 transition-shadow"
                        />
                    </div>
                    <div className="text-sm text-slate-500 font-medium ml-4">
                        Total Users: {users.length}
                    </div>
                </div>

                <div className="overflow-x-auto">
                    <table className="w-full text-sm text-left text-slate-600">
                        <thead className="text-xs text-slate-500 uppercase bg-slate-50/50 border-b border-slate-200">
                            <tr>
                                <th scope="col" className="px-6 py-4 font-semibold">Name & Phone</th>
                                <th scope="col" className="px-6 py-4 font-semibold">Type</th>
                                <th scope="col" className="px-6 py-4 font-semibold">Role</th>
                                <th scope="col" className="px-6 py-4 text-right font-semibold">Actions</th>
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
                                    <td colSpan={4} className="py-12 text-center text-slate-400">No users found</td>
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
                                                {u.type === 'FT' ? 'Full-Time' : 'Part-Time'}
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
                                                <option value="employee">Employee</option>
                                                <option value="manager">Manager</option>
                                                <option value="admin">Admin</option>
                                            </select>
                                        </td>
                                        <td className="px-6 py-4 text-right">
                                            <button
                                                onClick={() => handleResetPassword(u.uid, u.name)}
                                                disabled={actionLoading}
                                                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-orange-50 text-orange-600 hover:bg-orange-100 border border-orange-200 transition-colors focus:ring-2 focus:ring-orange-500/50 disabled:opacity-50"
                                                title="Reset to default password (last 6 digits of phone)"
                                            >
                                                <KeyRound className="w-3.5 h-3.5" />
                                                Reset PW
                                            </button>
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
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
                    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-200">
                        <div className="p-6 border-b border-slate-100 flex items-center gap-3">
                            <div className="w-10 h-10 rounded-full bg-red-100 text-red-600 flex items-center justify-center">
                                <MailPlus className="w-5 h-5" />
                            </div>
                            <div>
                                <h3 className="text-lg font-bold text-slate-900">Create New Staff User</h3>
                                <p className="text-xs text-slate-500">Firebase Auth profile will be generated automatically.</p>
                            </div>
                        </div>

                        <form onSubmit={handleCreateUser} className="p-6 space-y-4">
                            <div className="space-y-1.5">
                                <label className="text-sm font-medium text-slate-700">Full Name</label>
                                <input
                                    type="text" required
                                    value={newName} onChange={e => setNewName(e.target.value)}
                                    className="w-full bg-slate-50 border border-slate-200 text-sm rounded-lg focus:ring-red-500 focus:border-red-500 block p-2.5"
                                    placeholder="Nguyen Van A"
                                />
                            </div>
                            <div className="space-y-1.5">
                                <label className="text-sm font-medium text-slate-700">Phone Number (Login ID)</label>
                                <input
                                    type="text" required
                                    value={newPhone} onChange={e => setNewPhone(e.target.value)}
                                    className="w-full bg-slate-50 border border-slate-200 text-sm rounded-lg focus:ring-red-500 focus:border-red-500 block p-2.5"
                                    placeholder="0912345678"
                                />
                                <p className="text-[10px] text-slate-400 mt-1 flex items-center gap-1">
                                    <KeyRound className="w-3 h-3" />
                                    Password defaults to the last 6 digits of this number.
                                </p>
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-1.5">
                                    <label className="text-sm font-medium text-slate-700">Contract Type</label>
                                    <select
                                        value={newType} onChange={e => setNewType(e.target.value as EmployeeType)}
                                        className="w-full bg-slate-50 border border-slate-200 text-sm rounded-lg focus:ring-red-500 focus:border-red-500 block p-2.5 cursor-pointer"
                                    >
                                        <option value="PT">Part-Time (PT)</option>
                                        <option value="FT">Full-Time (FT)</option>
                                    </select>
                                </div>
                                <div className="space-y-1.5">
                                    <label className="text-sm font-medium text-slate-700">System Role</label>
                                    <select
                                        value={newRole} onChange={e => setNewRole(e.target.value as UserRole)}
                                        className="w-full bg-slate-50 border border-slate-200 text-sm rounded-lg focus:ring-red-500 focus:border-red-500 block p-2.5 cursor-pointer"
                                    >
                                        <option value="employee">Employee</option>
                                        <option value="manager">Manager</option>
                                        <option value="admin">Admin</option>
                                    </select>
                                </div>
                            </div>

                            <div className="flex gap-3 pt-4 border-t border-slate-100 mt-6">
                                <button
                                    type="button"
                                    onClick={() => setIsCreateModalOpen(false)}
                                    className="w-1/2 bg-white border border-slate-300 text-slate-700 hover:bg-slate-50 font-medium rounded-lg text-sm px-5 py-2.5 text-center transition-colors"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    disabled={actionLoading}
                                    className="w-1/2 text-white bg-red-600 hover:bg-red-700 focus:ring-4 focus:ring-red-500/30 font-medium rounded-lg text-sm px-5 py-2.5 text-center disabled:opacity-50 flex justify-center items-center gap-2 transition-all shadow-md shadow-red-600/20"
                                >
                                    {actionLoading ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div> : 'Create Staff'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
