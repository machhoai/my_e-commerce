'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { db } from '@/lib/firebase';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { StoreDoc, UserDoc } from '@/types';
import {
    Store, Plus, Pencil, PowerOff, Power, X, CheckCircle2,
    AlertCircle, MapPin, Building2, Users, Crown, ShieldCheck, UserCheck
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface StoreStats {
    storeManagers: number;
    managers: number;
    employees: number;
    total: number;
}

interface StoreWithStats extends StoreDoc {
    stats?: StoreStats;
}

export default function AdminStoresPage() {
    const { user } = useAuth();
    const [stores, setStores] = useState<StoreWithStats[]>([]);
    const [loading, setLoading] = useState(true);
    const [statsLoading, setStatsLoading] = useState(false);

    const [isCreateOpen, setIsCreateOpen] = useState(false);
    const [editStore, setEditStore] = useState<StoreDoc | null>(null);
    const [formName, setFormName] = useState('');
    const [formAddress, setFormAddress] = useState('');

    const [actionLoading, setActionLoading] = useState(false);
    const [message, setMessage] = useState({ type: '', text: '' });

    const showMsg = (type: 'success' | 'error', text: string) => {
        setMessage({ type, text });
        setTimeout(() => setMessage({ type: '', text: '' }), 4000);
    };

    const getToken = useCallback(async () => user?.getIdToken(), [user]);

    // Fetch stores and then join stats from users collection
    const fetchStores = useCallback(async () => {
        if (!user) return;
        setLoading(true);
        try {
            const token = await getToken();
            const res = await fetch('/api/stores', { headers: { 'Authorization': `Bearer ${token}` } });
            const data: StoreDoc[] = await res.json();
            const storeList = Array.isArray(data) ? data : [];
            setStores(storeList);

            // Now fetch user stats for each store in parallel
            setStatsLoading(true);
            const statsPromises = storeList.map(async (store) => {
                const q = query(collection(db, 'users'), where('storeId', '==', store.id));
                const snap = await getDocs(q);
                const users = snap.docs.map(d => d.data() as UserDoc);
                const stats: StoreStats = {
                    storeManagers: users.filter(u => u.role === 'store_manager').length,
                    managers: users.filter(u => u.role === 'manager').length,
                    employees: users.filter(u => u.role === 'employee').length,
                    total: users.length,
                };
                return { ...store, stats };
            });

            const storesWithStats = await Promise.all(statsPromises);
            setStores(storesWithStats);
        } catch {
            showMsg('error', 'Không thể tải danh sách cửa hàng');
        } finally {
            setLoading(false);
            setStatsLoading(false);
        }
    }, [user, getToken]);

    useEffect(() => { fetchStores(); }, [fetchStores]);

    const handleCreateOrUpdate = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!formName.trim()) return;
        setActionLoading(true);
        try {
            const token = await getToken();
            if (editStore) {
                await fetch('/api/stores', {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                    body: JSON.stringify({ id: editStore.id, name: formName, address: formAddress }),
                });
                showMsg('success', 'Đã cập nhật cửa hàng!');
            } else {
                await fetch('/api/stores', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                    body: JSON.stringify({ name: formName, address: formAddress }),
                });
                showMsg('success', 'Đã tạo cửa hàng mới!');
            }
            resetForm();
            await fetchStores();
        } catch {
            showMsg('error', 'Thao tác thất bại');
        } finally {
            setActionLoading(false);
        }
    };

    const handleToggle = async (store: StoreDoc) => {
        setActionLoading(true);
        try {
            const token = await getToken();
            await fetch('/api/stores', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                body: JSON.stringify({ id: store.id, isActive: !store.isActive }),
            });
            showMsg('success', `Cửa hàng đã được ${!store.isActive ? 'mở' : 'tắt'}`);
            await fetchStores();
        } catch {
            showMsg('error', 'Thao tác thất bại');
        } finally {
            setActionLoading(false);
        }
    };

    const openEdit = (store: StoreWithStats) => {
        setEditStore(store);
        setFormName(store.name);
        setFormAddress(store.address || '');
        setIsCreateOpen(true);
    };

    const resetForm = () => {
        setIsCreateOpen(false);
        setEditStore(null);
        setFormName('');
        setFormAddress('');
    };

    const activeStores = stores.filter(s => s.isActive);
    const inactiveStores = stores.filter(s => !s.isActive);
    const totalUsers = stores.reduce((acc, s) => acc + (s.stats?.total ?? 0), 0);

    return (
        <div className="space-y-6 mx-auto">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
                        <Building2 className="w-7 h-7 text-indigo-600" />
                        Quản lý Cửa hàng
                    </h1>
                    <p className="text-slate-500 mt-1">Thêm, sửa, bật/tắt các chi nhánh trong hệ thống.</p>
                </div>
                <button
                    onClick={() => { resetForm(); setIsCreateOpen(true); }}
                    className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-5 py-2.5 rounded-xl font-medium shadow-sm transition-colors shrink-0"
                >
                    <Plus className="w-4 h-4" /> Thêm cửa hàng
                </button>
            </div>

            {/* Summary Stats */}
            {!loading && (
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                    {[
                        { label: 'Tổng Cửa hàng', value: stores.length, color: 'bg-indigo-50 text-indigo-700', icon: Building2 },
                        { label: 'Đang hoạt động', value: activeStores.length, color: 'bg-emerald-50 text-emerald-700', icon: CheckCircle2 },
                        { label: 'Tạm dừng', value: inactiveStores.length, color: 'bg-slate-100 text-slate-600', icon: PowerOff },
                        { label: 'Tổng Nhân sự', value: totalUsers, color: 'bg-amber-50 text-amber-700', icon: Users },
                    ].map(item => (
                        <div key={item.label} className={cn('rounded-2xl p-4 flex items-center gap-3', item.color)}>
                            <item.icon className="w-5 h-5 shrink-0 opacity-80" />
                            <div>
                                <p className="text-2xl font-bold leading-tight">{item.value}</p>
                                <p className="text-xs font-medium opacity-70">{item.label}</p>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* Messages */}
            {message.text && (
                <div className={cn(
                    'p-4 rounded-xl flex items-center gap-3 text-sm font-medium animate-in fade-in',
                    message.type === 'success' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-red-50 text-red-600 border border-red-100'
                )}>
                    {message.type === 'success' ? <CheckCircle2 className="w-5 h-5 shrink-0" /> : <AlertCircle className="w-5 h-5 shrink-0" />}
                    {message.text}
                </div>
            )}

            {/* Create/Edit Modal */}
            {isCreateOpen && (
                <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6 animate-in fade-in zoom-in-95">
                        <div className="flex items-center justify-between mb-6">
                            <h2 className="text-lg font-bold text-slate-800">{editStore ? 'Sửa Cửa hàng' : 'Thêm Cửa hàng Mới'}</h2>
                            <button onClick={resetForm} className="p-1.5 hover:bg-slate-100 rounded-lg transition-colors">
                                <X className="w-5 h-5 text-slate-500" />
                            </button>
                        </div>
                        <form onSubmit={handleCreateOrUpdate} className="space-y-4">
                            <div>
                                <label className="block text-sm font-semibold text-slate-700 mb-1.5">Tên cửa hàng *</label>
                                <input
                                    value={formName} onChange={e => setFormName(e.target.value)} required
                                    placeholder="VD: Chi nhánh Quận 1"
                                    className="w-full border border-slate-200 rounded-xl p-3 text-sm outline-none focus:ring-2 focus:ring-indigo-300 focus:border-indigo-400"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-semibold text-slate-700 mb-1.5">Địa chỉ</label>
                                <input
                                    value={formAddress} onChange={e => setFormAddress(e.target.value)}
                                    placeholder="VD: 123 Nguyễn Huệ, Q.1, TP.HCM"
                                    className="w-full border border-slate-200 rounded-xl p-3 text-sm outline-none focus:ring-2 focus:ring-indigo-300 focus:border-indigo-400"
                                />
                            </div>
                            <div className="flex gap-3 pt-2">
                                <button type="button" onClick={resetForm} className="flex-1 border border-slate-200 hover:bg-slate-50 text-slate-700 px-4 py-2.5 rounded-xl font-medium text-sm">Hủy</button>
                                <button type="submit" disabled={actionLoading} className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2.5 rounded-xl font-medium text-sm disabled:opacity-50">
                                    {actionLoading ? 'Đang lưu...' : (editStore ? 'Cập nhật' : 'Tạo mới')}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Stores Table */}
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
                {loading ? (
                    <div className="p-12 text-center text-slate-500">
                        <div className="w-8 h-8 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
                        Đang tải...
                    </div>
                ) : stores.length === 0 ? (
                    <div className="p-12 text-center text-slate-400">
                        <Building2 className="w-12 h-12 mx-auto mb-3 opacity-30" />
                        <p className="font-medium">Chưa có cửa hàng nào</p>
                        <p className="text-sm mt-1">Thêm cửa hàng đầu tiên ngay để bắt đầu.</p>
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm text-left">
                            <thead className="text-xs text-slate-500 bg-slate-50 border-b border-slate-200">
                                <tr>
                                    <th className="px-5 py-3.5 font-semibold">Tên Cửa hàng</th>
                                    <th className="px-4 py-3.5 font-semibold text-center">Trạng thái</th>
                                    <th className="px-4 py-3.5 font-semibold text-center">
                                        <Crown className="w-3.5 h-3.5 inline mr-1 text-purple-500" />CH Trưởng
                                    </th>
                                    <th className="px-4 py-3.5 font-semibold text-center">
                                        <ShieldCheck className="w-3.5 h-3.5 inline mr-1 text-amber-500" />Quản lý
                                    </th>
                                    <th className="px-4 py-3.5 font-semibold text-center">
                                        <UserCheck className="w-3.5 h-3.5 inline mr-1 text-blue-500" />Nhân viên
                                    </th>
                                    <th className="px-4 py-3.5 font-semibold text-right">Thao tác</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {stores.map(store => (
                                    <tr key={store.id} className="hover:bg-slate-50/60 transition-colors group">
                                        <td className="px-5 py-4">
                                            <div className="flex items-center gap-3">
                                                <div className={cn(
                                                    'w-9 h-9 rounded-xl flex items-center justify-center shrink-0',
                                                    store.isActive ? 'bg-indigo-50' : 'bg-slate-100'
                                                )}>
                                                    <Store className={cn('w-4 h-4', store.isActive ? 'text-indigo-600' : 'text-slate-400')} />
                                                </div>
                                                <div>
                                                    <p className={cn('font-semibold', !store.isActive && 'text-slate-400 line-through')}>
                                                        {store.name}
                                                    </p>
                                                    {store.address && (
                                                        <p className="text-xs text-slate-400 flex items-center gap-1 mt-0.5">
                                                            <MapPin className="w-3 h-3" />{store.address}
                                                        </p>
                                                    )}
                                                    <p className="text-[10px] text-slate-300 font-mono mt-0.5">{store.id}</p>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-4 py-4 text-center">
                                            <span className={cn(
                                                'text-xs font-bold px-2.5 py-1 rounded-full',
                                                store.isActive ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-500'
                                            )}>
                                                {store.isActive ? 'Hoạt động' : 'Tạm dừng'}
                                            </span>
                                        </td>
                                        <td className="px-4 py-4 text-center">
                                            {statsLoading ? (
                                                <div className="w-4 h-4 border-2 border-slate-300 border-t-slate-500 rounded-full animate-spin mx-auto" />
                                            ) : (
                                                <span className="font-bold text-purple-700 bg-purple-50 rounded-full w-8 h-8 flex items-center justify-center mx-auto text-sm">
                                                    {store.stats?.storeManagers ?? '—'}
                                                </span>
                                            )}
                                        </td>
                                        <td className="px-4 py-4 text-center">
                                            {statsLoading ? (
                                                <div className="w-4 h-4 border-2 border-slate-300 border-t-slate-500 rounded-full animate-spin mx-auto" />
                                            ) : (
                                                <span className="font-bold text-amber-700 bg-amber-50 rounded-full w-8 h-8 flex items-center justify-center mx-auto text-sm">
                                                    {store.stats?.managers ?? '—'}
                                                </span>
                                            )}
                                        </td>
                                        <td className="px-4 py-4 text-center">
                                            {statsLoading ? (
                                                <div className="w-4 h-4 border-2 border-slate-300 border-t-slate-500 rounded-full animate-spin mx-auto" />
                                            ) : (
                                                <span className="font-bold text-blue-700 bg-blue-50 rounded-full w-8 h-8 flex items-center justify-center mx-auto text-sm">
                                                    {store.stats?.employees ?? '—'}
                                                </span>
                                            )}
                                        </td>
                                        <td className="px-4 py-4 text-right">
                                            <div className="flex items-center justify-end gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                                                <button
                                                    title="Sửa" onClick={() => openEdit(store)}
                                                    className="p-2 hover:bg-indigo-50 text-slate-500 hover:text-indigo-600 rounded-lg transition-colors"
                                                >
                                                    <Pencil className="w-4 h-4" />
                                                </button>
                                                <button
                                                    title={store.isActive ? 'Tắt cửa hàng' : 'Mở cửa hàng'}
                                                    onClick={() => handleToggle(store)}
                                                    disabled={actionLoading}
                                                    className={cn(
                                                        'p-2 rounded-lg transition-colors disabled:opacity-50',
                                                        store.isActive ? 'hover:bg-red-50 text-slate-500 hover:text-red-600' : 'hover:bg-emerald-50 text-slate-500 hover:text-emerald-600'
                                                    )}
                                                >
                                                    {store.isActive ? <PowerOff className="w-4 h-4" /> : <Power className="w-4 h-4" />}
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
        </div>
    );
}
