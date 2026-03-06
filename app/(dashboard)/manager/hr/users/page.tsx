'use client';

import { useState, useEffect, useCallback, Suspense } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { db } from '@/lib/firebase';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { UserDoc, EmployeeType, UserRole, StoreDoc, CustomRoleDoc } from '@/types';
import { Users, Search, ShieldAlert, ShieldCheck, UserMinus, UserCheck, Plus, MailPlus, KeyRound, Building2, Shield, Award } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useTableParams } from '@/hooks/useTableParams';
import { processTableData } from '@/lib/processTableData';
import DataTableToolbar, { SortableHeader } from '@/components/DataTableToolbar';
import DataTablePagination from '@/components/DataTablePagination';
import Portal from '@/components/Portal';

function ManagerUsersPageContent() {
    const { user, userDoc, loading: authLoading } = useAuth();
    const { params, setParam, setParams, clearAll, toggleSort, activeFilterCount, setPage, setPageSize } = useTableParams();
    const [employees, setEmployees] = useState<UserDoc[]>([]);
    const [loading, setLoading] = useState(true);

    // Modal states
    const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
    const [editUid, setEditUid] = useState<string | null>(null);

    // Form states
    const [newName, setNewName] = useState('');
    const [newPhone, setNewPhone] = useState('');
    const [newType, setNewType] = useState<EmployeeType>('PT');
    const [newRole, setNewRole] = useState<UserRole>('employee');
    const [newCanManageHR, setNewCanManageHR] = useState(false);
    const [newCustomRoleId, setNewCustomRoleId] = useState('');
    const [newDob, setNewDob] = useState('');
    const [newJobTitle, setNewJobTitle] = useState('');
    const [newEmail, setNewEmail] = useState('');
    const [newIdCard, setNewIdCard] = useState('');
    const [newBankAccount, setNewBankAccount] = useState('');
    const [newEducation, setNewEducation] = useState('');
    const [newStoreId, setNewStoreId] = useState('');

    const [actionLoading, setActionLoading] = useState<string | null>(null);
    const [actionMessage, setActionMessage] = useState({ type: '', text: '' });
    const [customRoles, setCustomRoles] = useState<CustomRoleDoc[]>([]);
    const [kpiAverages, setKpiAverages] = useState<Record<string, { avgOfficial: number; count: number }>>({});

    // Table toolbar configuration
    const tableFilters = [
        {
            key: 'type',
            label: 'Loại HĐ',
            options: [
                { value: 'FT', label: 'Toàn thời gian' },
                { value: 'PT', label: 'Bán thời gian' },
            ],
        },
        {
            key: 'role',
            label: 'Vai trò',
            options: customRoles.length > 0
                ? customRoles.filter(r => !r.isLocked).map(r => ({ value: r.isSystem ? r.id : `custom:${r.id}`, label: r.name }))
                : [
                    { value: 'store_manager', label: 'CH Trưởng' },
                    { value: 'manager', label: 'Quản lý' },
                    { value: 'employee', label: 'Nhân viên' },
                ],
        },
        {
            key: 'status',
            label: 'Trạng thái',
            options: [
                { value: 'true', label: 'Hoạt động' },
                { value: 'false', label: 'Vô hiệu' },
            ],
        },
    ];

    const tableSortOptions = [
        { value: 'name', label: 'Họ tên' },
        { value: 'type', label: 'Loại HĐ' },
        { value: 'role', label: 'Vai trò' },
        { value: 'kpi', label: 'KPI TB' },
    ];

    // Admin store selector
    const [stores, setStores] = useState<StoreDoc[]>([]);
    const [selectedAdminStoreId, setSelectedAdminStoreId] = useState<string>(() => {
        if (typeof window !== 'undefined') {
            return localStorage.getItem('globalSelectedStoreId') || '';
        }
        return '';
    });

    useEffect(() => {
        if (typeof window !== 'undefined' && selectedAdminStoreId) {
            localStorage.setItem('globalSelectedStoreId', selectedAdminStoreId);
        }
    }, [selectedAdminStoreId]);

    const getToken = useCallback(() => user?.getIdToken(), [user]);

    // Fetch stores list for admin
    useEffect(() => {
        if (userDoc?.role !== 'admin' || !user) return;
        async function fetchStores() {
            try {
                const token = await getToken();
                const res = await fetch('/api/stores', { headers: { 'Authorization': `Bearer ${token}` } });
                const data = await res.json();
                setStores(Array.isArray(data) ? data : []);
            } catch { /* silent */ }
        }
        fetchStores();
    }, [userDoc, user, getToken]);

    // Fetch KPI averages
    useEffect(() => {
        const effectiveStoreId = userDoc?.role === 'admin' ? selectedAdminStoreId : userDoc?.storeId;
        if (!effectiveStoreId || !user) { setKpiAverages({}); return; }
        (async () => {
            try {
                const token = await getToken();
                const res = await fetch(`/api/kpi-records/averages?storeId=${effectiveStoreId}`, {
                    headers: { Authorization: `Bearer ${token}` },
                });
                if (res.ok) setKpiAverages(await res.json());
            } catch { /* silent */ }
        })();
    }, [user, userDoc, selectedAdminStoreId, getToken]);

    // Fetch custom roles for the dropdown
    useEffect(() => {
        if (!user) return;
        async function fetchRoles() {
            try {
                const token = await user?.getIdToken();
                const res = await fetch('/api/roles', { headers: { Authorization: `Bearer ${token}` } });
                const data = await res.json();
                setCustomRoles(Array.isArray(data) ? data : []);
            } catch { /* silent */ }
        }
        fetchRoles();
    }, [user]);

    useEffect(() => {
        // Wait until AuthContext has finished loading before acting
        if (authLoading) return;
        if (!user || !userDoc) return;

        // Admin: filter by selected store if chosen, otherwise show all
        const effectiveStoreId = userDoc.role === 'admin' ? selectedAdminStoreId : userDoc.storeId;

        // Build constraints based on role
        const constraints = effectiveStoreId ? [where('storeId', '==', effectiveStoreId)] : [];

        const q = userDoc.role === 'store_manager' || userDoc.role === 'admin'
            ? query(collection(db, 'users'), ...constraints)
            : query(collection(db, 'users'), where('role', '==', 'employee'), ...constraints);

        const unsubscribe = onSnapshot(q, (snapshot) => {
            let docs = snapshot.docs.map(d => d.data() as UserDoc);
            docs = docs.filter(d => d.role !== 'admin' && d.uid !== userDoc.uid);
            docs.sort((a, b) => a.name.localeCompare(b.name));
            setEmployees(docs);
            setLoading(false);
        }, (err) => {
            console.error('Error fetching employees:', err);
            setLoading(false);
        });

        return () => unsubscribe();
    }, [authLoading, user, userDoc, selectedAdminStoreId]);

    const handleCreateOrUpdateUser = async (e: React.FormEvent) => {
        e.preventDefault();
        setActionLoading(editUid ? 'update' : 'create');
        setActionMessage({ type: '', text: '' });

        try {
            const token = await user?.getIdToken();
            const endpoint = editUid ? '/api/auth/update-user' : '/api/auth/create-user';
            const bodyPayload: any = {
                name: newName,
                phone: newPhone,
                type: newType,
                dob: newDob,
                jobTitle: newJobTitle,
                email: newEmail,
                idCard: newIdCard,
                bankAccount: newBankAccount,
                education: newEducation
            };

            if (editUid) {
                bodyPayload.targetUid = editUid;
                if (userDoc?.role === 'store_manager' || userDoc?.role === 'admin') {
                    bodyPayload.role = newRole;
                    bodyPayload.customRoleId = newCustomRoleId || null;
                }
                if (userDoc?.role === 'store_manager') {
                    bodyPayload.canManageHR = newCanManageHR;
                }
                if (userDoc?.role === 'admin') {
                    // Always send storeId so admin can change or clear it
                    bodyPayload.storeId = newStoreId || null;
                }
            } else {
                bodyPayload.role = (userDoc?.role === 'store_manager' || userDoc?.role === 'admin') ? newRole : 'employee';
                if (userDoc?.role === 'store_manager' || userDoc?.role === 'admin') {
                    bodyPayload.canManageHR = newCanManageHR;
                    bodyPayload.customRoleId = newCustomRoleId || null;
                }
                if (userDoc?.role === 'admin' && newStoreId) {
                    bodyPayload.storeId = newStoreId;
                }
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
            if (!res.ok) throw new Error(data.error || `Không thể ${editUid ? 'cập nhật' : 'tạo'} nhân viên`);

            setActionMessage({ type: 'success', text: `Nhân viên ${newName} đã được ${editUid ? 'cập nhật' : 'tạo'} thành công!` });
            setIsCreateModalOpen(false);
            setEditUid(null);

            // Reset form
            resetForm();

        } catch (err: unknown) {
            if (err instanceof Error) {
                setActionMessage({ type: 'error', text: err.message });
            } else {
                setActionMessage({ type: 'error', text: 'Đã xảy ra lỗi không xác định' });
            }
        } finally {
            setActionLoading(null);
        }
    };

    const resetForm = () => {
        setNewName(''); setNewPhone(''); setNewType('PT'); setNewRole('employee'); setNewCanManageHR(false); setNewCustomRoleId('');
        setNewDob(''); setNewJobTitle(''); setNewEmail('');
        setNewIdCard(''); setNewBankAccount(''); setNewEducation('');
        setNewStoreId('');
    };

    const openEditModal = (employee: UserDoc) => {
        setNewName(employee.name);
        setNewPhone(employee.phone);
        setNewType(employee.type || 'PT');
        setNewRole(employee.role ?? 'employee');
        setNewCanManageHR(employee.canManageHR ?? false);
        setNewCustomRoleId(employee.customRoleId ?? '');
        setNewDob(employee.dob || '');
        setNewJobTitle(employee.jobTitle || '');
        setNewEmail(employee.email || '');
        setNewIdCard(employee.idCard || '');
        setNewBankAccount(employee.bankAccount || '');
        setNewEducation(employee.education || '');
        setNewStoreId(employee.storeId || '');
        setEditUid(employee.uid);
        setIsCreateModalOpen(true);
    };

    const handleToggleActive = async (targetUid: string, currentStatus: boolean, employeeName: string) => {
        const actionName = currentStatus ? 'Vô hiệu hóa' : 'Kích hoạt';
        if (!confirm(`Bạn có chắc chắn muốn ${actionName.toLowerCase()} ${employeeName}?`)) return;

        setActionLoading(targetUid);
        setActionMessage({ type: '', text: '' });

        try {
            const token = await user?.getIdToken();
            const res = await fetch('/api/auth/toggle-active', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({ targetUid, isActive: !currentStatus })
            });

            const data = await res.json();
            if (!res.ok) throw new Error(data.error || `Không thể ${actionName.toLowerCase()} người dùng`);

            setActionMessage({ type: 'success', text: `Đã ${actionName.toLowerCase()} ${employeeName} thành công.` });
        } catch (err: unknown) {
            if (err instanceof Error) {
                setActionMessage({ type: 'error', text: err.message });
            } else {
                setActionMessage({ type: 'error', text: 'Đã xảy ra lỗi không xác định' });
            }
        } finally {
            setActionLoading(null);
        }
    };

    // Build storeId → name lookup map for rendering the Store column in the table
    const storeMap = new Map(stores.map(s => [s.id, s.name]));

    const isKpiSort = params.sort === 'kpi';
    const roleFilterValue = params.role || '';
    const isCustomRoleFilter = roleFilterValue.startsWith('custom:');
    let filteredEmployees = processTableData(
        isCustomRoleFilter
            ? employees.filter(u => u.customRoleId === roleFilterValue.slice(7))
            : employees,
        {
            searchQuery: params.q,
            searchFields: ['name', 'phone'] as (keyof UserDoc)[],
            filters: [
                { field: 'type' as keyof UserDoc, value: params.type || '' },
                ...(!isCustomRoleFilter && roleFilterValue ? [{ field: 'role' as keyof UserDoc, value: roleFilterValue }] : []),
                { field: 'isActive' as keyof UserDoc, value: params.status || '' },
            ],
            sortField: isKpiSort ? undefined : (params.sort as keyof UserDoc) || undefined,
            sortOrder: params.order as 'asc' | 'desc',
        }
    );

    // Custom sort by KPI average
    if (isKpiSort) {
        const dir = params.order === 'desc' ? -1 : 1;
        filteredEmployees = [...filteredEmployees].sort((a, b) => {
            const aScore = kpiAverages[a.uid]?.avgOfficial ?? -1;
            const bScore = kpiAverages[b.uid]?.avgOfficial ?? -1;
            return (aScore - bScore) * dir;
        });
    }

    const currentPage = Number(params.page) || 1;
    const currentPageSize = Number(params.pageSize) || 10;
    const paginatedEmployees = filteredEmployees.slice((currentPage - 1) * currentPageSize, currentPage * currentPageSize);

    if (!user || (userDoc?.role !== 'admin' && userDoc?.canManageHR !== true)) {
        return (
            <div className="flex flex-col items-center justify-center h-64 space-y-4">
                <ShieldAlert className="w-12 h-12 text-red-500" />
                <h2 className="text-xl font-bold text-slate-800">Không có quyền truy cập</h2>
                <p className="text-slate-500">Bạn không được cấp quyền Quản lý Nhân sự.</p>
            </div>
        );
    }

    return (
        <div className="space-y-4 mx-auto">
            {/* Main content */}
            {(() => {
                const storeMap = new Map(stores.map(s => [s.id, s.name]));
                return (
                    <>
                        {/* Header */}
                        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                            <div>
                                <h1 className="text-2xl font-bold bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent flex items-center gap-2">
                                    <Users className="w-7 h-7 text-blue-600" />
                                    Quản lý Nhân viên
                                </h1>
                                <p className="text-slate-500 mt-1">
                                    Xem và quản lý trạng thái hoạt động của tất cả nhân viên bán thời gian và toàn thời gian.
                                </p>
                            </div>
                        </div>

                        {/* Admin Store Selector Banner */}
                        {userDoc?.role === 'admin' && (
                            <div className="bg-white rounded-xl items-center border border-slate-200 shadow-sm p-3 flex sm:flex-row sm:items-center gap-3">
                                <div className="flex items-center gap-2 shrink-0">
                                    <Building2 className="w-5 h-5 text-indigo-500" />
                                </div>
                                <select
                                    value={selectedAdminStoreId}
                                    onChange={e => setSelectedAdminStoreId(e.target.value)}
                                    className="flex-1 border border-slate-200 rounded-lg p-2 text-sm outline-none focus:ring-2 focus:ring-indigo-300 bg-white font-medium"
                                >
                                    <option value="">-- Tất cả cửa hàng --</option>
                                    {stores.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                                </select>
                            </div>
                        )}

                        {actionMessage.text && (
                            <div className={`p-4 rounded-xl flex items-center justify-between gap-3 border shadow-sm animate-in fade-in slide-in-from-top-2 ${actionMessage.type === 'error' ? 'bg-red-50 text-red-700 border-red-200' : 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                }`}>
                                <div className="flex items-center gap-2">
                                    {actionMessage.type === 'error' ? <ShieldAlert className="w-5 h-5 flex-shrink-0" /> : <ShieldCheck className="w-5 h-5 flex-shrink-0" />}
                                    <p className="text-sm font-medium">{actionMessage.text}</p>
                                </div>
                                <button onClick={() => setActionMessage({ type: '', text: '' })} className="opacity-50 hover:opacity-100 font-bold px-2">×</button>
                            </div>
                        )}

                        {/* Toolbar */}
                        <DataTableToolbar
                            searchValue={params.q}
                            onSearchChange={(v) => setParam('q', v)}
                            searchPlaceholder="Tìm theo tên hoặc số điện thoại..."
                            filters={tableFilters}
                            filterValues={{ type: params.type || '', role: params.role || '', status: params.status || '' }}
                            onFilterChange={(key, value) => setParam(key, value)}
                            sortOptions={tableSortOptions}
                            currentSort={params.sort}
                            currentOrder={params.order}
                            onSortChange={toggleSort}
                            activeFilterCount={activeFilterCount}
                            onClearAll={clearAll}
                            onMobileApply={(values) => setParams(values)}
                        />

                        {/* Stats summary */}
                        <div className="flex items-center justify-between gap-4 text-sm font-medium p-2 bg-slate-50/50 border border-slate-200 rounded-xl">
                            <div className='flex gap-3'>
                                <div className="flex items-center gap-2 text-slate-500">
                                    <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                                    Hoạt động: {employees.filter(e => e.isActive !== false).length}
                                </div>
                                <div className="flex items-center gap-2 text-slate-500">
                                    <span className="w-2 h-2 rounded-full bg-slate-300"></span>
                                    Vô hiệu: {employees.filter(e => e.isActive === false).length}
                                </div>
                                <div className="h-4 w-px bg-slate-300"></div>
                                <div className="text-slate-700 font-bold">
                                    Tổng số: {employees.length}
                                </div>
                            </div>

                            <button
                                onClick={() => {
                                    resetForm();
                                    setEditUid(null);
                                    setIsCreateModalOpen(true);
                                }}
                                className="flex items-center gap-2 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white px-5 py-2 rounded-lg font-medium shadow-md shadow-blue-500/20 transition-all"
                            >
                                <Plus className="w-4 h-4" />
                                Thêm Nhân viên
                            </button>
                        </div>

                        {/* Table Container */}
                        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden flex flex-col">

                            <div className="overflow-x-auto">
                                <table className="w-full text-sm text-left text-slate-600">
                                    <thead className="text-xs text-slate-500 uppercase bg-slate-50/50 border-b border-slate-200">
                                        <tr>
                                            <SortableHeader label="Tên & SĐT" field="name" currentSort={params.sort} currentOrder={params.order} onSort={toggleSort} className="px-6 text-center" />
                                            <SortableHeader label="Loại HĐ" field="type" currentSort={params.sort} currentOrder={params.order} onSort={toggleSort} className="px-6 text-center" />
                                            <SortableHeader label="Vai trò" field="role" currentSort={params.sort} currentOrder={params.order} onSort={toggleSort} className="px-6 text-center" />
                                            {userDoc?.role === 'admin' && <th scope="col" className="px-6 py-4 text-center font-semibold">Cửa hàng</th>}
                                            <SortableHeader label="KPI TB" field="kpi" currentSort={params.sort} currentOrder={params.order} onSort={toggleSort} className="px-6 text-center" />
                                            <th scope="col" className="px-6 py-4 text-center font-semibold truncate">Trạng thái</th>
                                            <th scope="col" className="px-6 py-4 text-center font-semibold truncate">Hành động</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100">
                                        {loading ? (
                                            <tr>
                                                <td colSpan={userDoc?.role === 'admin' ? 7 : 6} className="py-12 text-center">
                                                    <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto"></div>
                                                </td>
                                            </tr>
                                        ) : filteredEmployees.length === 0 ? (
                                            <tr>
                                                <td colSpan={userDoc?.role === 'admin' ? 7 : 6} className="py-12 text-center text-slate-400">Không tìm thấy nhân viên nào</td>
                                            </tr>
                                        ) : (
                                            paginatedEmployees.map((e) => {
                                                const isActive = e.isActive !== false; // Default true if undefined
                                                const isSubmitting = actionLoading === e.uid;

                                                return (
                                                    <tr key={e.uid} className={`hover:bg-slate-50/80 transition-colors group ${!isActive ? 'bg-slate-50/50' : ''}`}>
                                                        <td className="px-6 py-4 whitespace-nowrap">
                                                            <div className={`font-semibold transition-colors ${!isActive ? 'text-slate-400' : 'text-slate-900 group-hover:text-blue-700'}`}>
                                                                {e.name}
                                                            </div>
                                                            <div className="text-slate-500 text-xs mt-0.5">{e.phone}</div>
                                                        </td>
                                                        <td className="px-6 py-4">
                                                            <span className={`px-2 py-1 text-[10px] font-bold uppercase truncate rounded ${e.type === 'FT' ? 'bg-blue-100 text-blue-700' : 'bg-purple-100 text-purple-700'
                                                                } ${!isActive ? 'opacity-50' : ''}`}>
                                                                {e.type === 'FT' ? 'Toàn thời gian' : 'Bán thời gian'}
                                                            </span>
                                                        </td>
                                                        <td className="px-6 py-4">
                                                            {(() => {
                                                                const colorMap: Record<string, string> = {
                                                                    red: 'bg-red-100 text-red-700',
                                                                    purple: 'bg-purple-100 text-purple-700',
                                                                    amber: 'bg-amber-100 text-amber-700',
                                                                    blue: 'bg-blue-100 text-blue-700',
                                                                    emerald: 'bg-emerald-100 text-emerald-700',
                                                                    indigo: 'bg-indigo-100 text-indigo-700',
                                                                    pink: 'bg-pink-100 text-pink-700',
                                                                    slate: 'bg-slate-100 text-slate-600',
                                                                };
                                                                // Check custom role first
                                                                if (e.customRoleId) {
                                                                    const cr = customRoles.find(r => r.id === e.customRoleId);
                                                                    if (cr) {
                                                                        return (
                                                                            <span className={`px-2 truncate py-1 text-[10px] font-bold uppercase rounded ${colorMap[cr.color || 'slate'] || 'bg-slate-100 text-slate-600'} ${!isActive ? 'opacity-50' : ''}`}>
                                                                                {cr.name}
                                                                            </span>
                                                                        );
                                                                    }
                                                                }
                                                                // Fallback: find system role by user's role field
                                                                const sysRole = customRoles.find(r => r.isSystem && r.id === e.role);
                                                                const roleName = sysRole?.name ?? (e.role === 'store_manager' ? 'CH Trưởng' : e.role === 'manager' ? 'Quản lý' : e.role === 'admin' ? 'Admin' : 'Nhân viên');
                                                                const roleColor = sysRole ? colorMap[sysRole.color || 'slate'] : 'bg-slate-100 text-slate-600';
                                                                return (
                                                                    <span className={`px-2 py-1 text-[10px] font-bold uppercase truncate rounded ${roleColor} ${!isActive ? 'opacity-50' : ''}`}>
                                                                        {roleName}
                                                                    </span>
                                                                );
                                                            })()}
                                                        </td>
                                                        {userDoc?.role === 'admin' && (
                                                            <td className="px-6 py-4">
                                                                <span className={`text-xs font-medium truncate px-2 py-1 rounded bg-slate-100 text-slate-600 ${!isActive ? 'opacity-50' : ''}`}>
                                                                    {e.storeId ? (storeMap.get(e.storeId) ?? e.storeId) : <span className="italic text-slate-400">—</span>}
                                                                </span>
                                                            </td>
                                                        )}
                                                        <td className="px-6 py-4 text-center">
                                                            {(() => {
                                                                const kpi = kpiAverages[e.uid];
                                                                if (!kpi || kpi.count === 0) return <span className="text-slate-300">—</span>;
                                                                const score = kpi.avgOfficial;
                                                                const colorClass = score >= 80 ? 'bg-emerald-100 text-emerald-700' : score >= 50 ? 'bg-amber-100 text-amber-700' : 'bg-red-100 text-red-700';
                                                                return (
                                                                    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-bold ${colorClass} ${!isActive ? 'opacity-50' : ''}`} title={`${kpi.count} lượt chấm`}>
                                                                        <Award className="w-3 h-3" />
                                                                        {score}
                                                                    </span>
                                                                );
                                                            })()}
                                                        </td>
                                                        <td className="px-6 py-4">
                                                            <span className={`inline-flex truncate items-center gap-1.5 px-2 py-1 rounded-md text-xs font-semibold ${isActive ? 'bg-emerald-50 text-emerald-600 border border-emerald-100' : 'bg-slate-100 text-slate-500 border border-slate-200'}
                                                                }`}>
                                                                <span className={`w-1.5 h-1.5 rounded-full ${isActive ? 'bg-emerald-500' : 'bg-slate-400'}`}></span>
                                                                {isActive ? 'Hoạt động' : 'Vô hiệu'}
                                                            </span>
                                                        </td>
                                                        <td className="px-6 py-4 text-right">
                                                            <div className="flex items-center justify-end gap-2">
                                                                <button
                                                                    onClick={() => openEditModal(e)}
                                                                    disabled={actionLoading !== null}
                                                                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg border bg-blue-50 text-blue-600 hover:bg-blue-100 border-blue-200 transition-all focus:ring-2 focus:ring-blue-500/30 disabled:opacity-50"
                                                                    title="Sửa Nhân viên"
                                                                >
                                                                    Sửa
                                                                </button>
                                                                <button
                                                                    onClick={() => handleToggleActive(e.uid, isActive, e.name)}
                                                                    disabled={isSubmitting || actionLoading !== null}
                                                                    className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg border transition-all focus:ring-2 disabled:opacity-50 disabled:cursor-not-allowed ${isActive
                                                                        ? 'bg-red-50 text-red-600 hover:bg-red-100 border-red-200 focus:ring-red-500/30'
                                                                        : 'bg-emerald-50 text-emerald-600 hover:bg-emerald-100 border-emerald-200 focus:ring-emerald-500/30'
                                                                        }`}
                                                                    title={isActive ? 'Deactivate Employee (Soft Delete)' : 'Reactivate Employee'}
                                                                >
                                                                    {isSubmitting ? (
                                                                        <div className="w-3.5 h-3.5 border-2 border-current border-t-transparent rounded-full animate-spin"></div>
                                                                    ) : isActive ? (
                                                                        <span className="truncate flex items-center gap-1.5">
                                                                            <UserMinus className="w-3.5 h-3.5" />
                                                                            Vô hiệu hóa
                                                                        </span>
                                                                    ) : (
                                                                        <span className="truncate flex items-center gap-1.5">
                                                                            <UserCheck className="w-3.5 h-3.5" />
                                                                            Kích hoạt
                                                                        </span>
                                                                    )}
                                                                </button>
                                                            </div>
                                                        </td>
                                                    </tr>
                                                );
                                            })
                                        )}
                                    </tbody>
                                </table>
                            </div>
                            <DataTablePagination
                                totalItems={filteredEmployees.length}
                                page={currentPage}
                                pageSize={currentPageSize}
                                onPageChange={setPage}
                                onPageSizeChange={setPageSize}
                            />
                        </div>

                        {/* Create Modal */}
                        {isCreateModalOpen && (
                            <Portal>
                                <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm overflow-y-auto">
                                    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden animate-in zoom-in-95 duration-200 my-8">
                                        <div className="p-6 border-b border-slate-100 flex items-center gap-3 bg-slate-50/50">
                                            <div className="w-10 h-10 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center shrink-0">
                                                <MailPlus className="w-5 h-5" />
                                            </div>
                                            <div>
                                                <h3 className="text-lg font-bold text-slate-900">{editUid ? 'Cập nhật Nhân viên' : 'Thêm Nhân viên mới'}</h3>
                                                <p className="text-xs text-slate-500">{editUid ? 'Cập nhật thông tin nhân viên.' : 'Điền đầy đủ thông tin để thêm thành viên mới.'}</p>
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
                                                            className="w-full bg-slate-50 border border-slate-200 text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 block p-2.5"
                                                            placeholder="Nguyễn Văn A"
                                                        />
                                                    </div>
                                                    <div className="space-y-1.5">
                                                        <label className="text-sm font-medium text-slate-700">Số điện thoại (ID đăng nhập) <span className="text-red-500">*</span></label>
                                                        <input
                                                            type="tel" required
                                                            value={newPhone} onChange={e => setNewPhone(e.target.value)}
                                                            className="w-full bg-slate-50 border border-slate-200 text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 block p-2.5"
                                                            placeholder="0912345678"
                                                        />
                                                        <p className="text-[10px] text-slate-400 mt-1 flex items-center gap-1">
                                                            <KeyRound className="w-3 h-3" />
                                                            Mật khẩu mặc định là 6 số cuối.
                                                        </p>
                                                    </div>
                                                    <div className="space-y-1.5">
                                                        <label className="text-sm font-medium text-slate-700">Loại hợp đồng <span className="text-red-500">*</span></label>
                                                        <select
                                                            value={newType} onChange={e => setNewType(e.target.value as EmployeeType)}
                                                            className="w-full bg-slate-50 border border-slate-200 text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 block p-2.5 cursor-pointer"
                                                        >
                                                            <option value="PT">Bán thời gian (PT)</option>
                                                            <option value="FT">Toàn thời gian (FT)</option>
                                                        </select>
                                                    </div>
                                                    {(userDoc?.role === 'store_manager' || userDoc?.role === 'admin') && (() => {
                                                        // Filter roles this user can assign (based on creatorRoles), exclude admin and locked roles
                                                        const eligibleRoles = customRoles.filter(r =>
                                                            !r.isLocked && r.creatorRoles?.includes(userDoc?.role ?? '')
                                                        );
                                                        // Determine current value: if customRoleId is set, use custom: prefix, otherwise use the system role
                                                        const selectValue = newCustomRoleId ? `custom:${newCustomRoleId}` : newRole;
                                                        const handleRoleChange = (val: string) => {
                                                            if (val.startsWith('custom:')) {
                                                                // Non-system custom role
                                                                setNewRole('employee');
                                                                setNewCustomRoleId(val.slice(7));
                                                            } else {
                                                                // System role (employee, manager, store_manager)
                                                                setNewRole(val as UserRole);
                                                                setNewCustomRoleId('');
                                                            }
                                                        };
                                                        return (
                                                            <>
                                                                <div className="space-y-1.5">
                                                                    <label className="text-sm font-medium text-slate-700 flex items-center gap-1.5">
                                                                        <Shield className="w-3.5 h-3.5 text-violet-500" />
                                                                        Vai trò <span className="text-red-500">*</span>
                                                                    </label>
                                                                    <select
                                                                        value={selectValue}
                                                                        onChange={e => handleRoleChange(e.target.value)}
                                                                        className="w-full bg-slate-50 border border-slate-200 text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 block p-2.5 cursor-pointer"
                                                                    >
                                                                        {eligibleRoles.map(r => (
                                                                            <option key={r.id} value={r.isSystem ? r.id : `custom:${r.id}`}>
                                                                                {r.name}{r.isSystem ? '' : ' ✦'}
                                                                            </option>
                                                                        ))}
                                                                    </select>
                                                                    {eligibleRoles.length === 0 && (
                                                                        <p className="text-[10px] text-amber-600">Không có vai trò nào khả dụng cho bạn.</p>
                                                                    )}
                                                                </div>
                                                                <label className="flex items-center gap-2.5 cursor-pointer p-3 border border-slate-200 rounded-lg bg-slate-50 hover:bg-blue-50/50 hover:border-blue-200 transition-colors">
                                                                    <input
                                                                        type="checkbox"
                                                                        checked={newCanManageHR}
                                                                        onChange={e => setNewCanManageHR(e.target.checked)}
                                                                        className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500 cursor-pointer"
                                                                    />
                                                                    <div>
                                                                        <span className="text-sm font-semibold text-slate-800">Quyền Quản lý Nhân sự</span>
                                                                        <p className="text-[10px] text-slate-500 mt-0.5">Cho phép thêm, sửa, tắt hoạt động nhân viên và phân ca.</p>
                                                                    </div>
                                                                </label>
                                                                {userDoc?.role === 'admin' && (
                                                                    <div className="space-y-1.5">
                                                                        <label className="text-sm font-medium text-slate-700 flex items-center gap-1.5">
                                                                            <Building2 className="w-3.5 h-3.5 text-indigo-500" />
                                                                            Cửa hàng
                                                                        </label>
                                                                        <select
                                                                            value={newStoreId}
                                                                            onChange={e => setNewStoreId(e.target.value)}
                                                                            className="w-full bg-slate-50 border border-slate-200 text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 block p-2.5 cursor-pointer"
                                                                        >
                                                                            <option value="">-- Chưa gán cửa hàng --</option>
                                                                            {stores.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                                                                        </select>
                                                                    </div>
                                                                )}
                                                            </>
                                                        );
                                                    })()}

                                                    <div className="space-y-1.5">
                                                        <label className="text-sm font-medium text-slate-700">Ngày sinh</label>
                                                        <input
                                                            type="date"
                                                            value={newDob} onChange={e => setNewDob(e.target.value)}
                                                            className="w-full bg-slate-50 border border-slate-200 text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 block p-2.5"
                                                        />
                                                    </div>
                                                </div>

                                                {/* Extended Details */}
                                                <div className="space-y-4">
                                                    <h4 className="font-semibold text-slate-800 text-sm border-b pb-2">Thông tin chi tiết</h4>

                                                    <div className="space-y-1.5">
                                                        <label className="text-sm font-medium text-slate-700">Chức danh / Vị trí</label>
                                                        <input
                                                            type="text"
                                                            value={newJobTitle} onChange={e => setNewJobTitle(e.target.value)}
                                                            className="w-full bg-slate-50 border border-slate-200 text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 block p-2.5"
                                                            placeholder="VD: Thu ngân, Kỹ thuật..."
                                                        />
                                                    </div>
                                                    <div className="space-y-1.5">
                                                        <label className="text-sm font-medium text-slate-700">Địa chỉ Email</label>
                                                        <input
                                                            type="email"
                                                            value={newEmail} onChange={e => setNewEmail(e.target.value)}
                                                            className="w-full bg-slate-50 border border-slate-200 text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 block p-2.5"
                                                            placeholder="nhanvien@example.com"
                                                        />
                                                    </div>
                                                    <div className="space-y-1.5">
                                                        <label className="text-sm font-medium text-slate-700">Số CCCD</label>
                                                        <input
                                                            type="text"
                                                            value={newIdCard} onChange={e => setNewIdCard(e.target.value)}
                                                            className="w-full bg-slate-50 border border-slate-200 text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 block p-2.5"
                                                            placeholder="012345678910"
                                                        />
                                                    </div>
                                                    <div className="space-y-1.5">
                                                        <label className="text-sm font-medium text-slate-700">Tài khoản Ngân hàng</label>
                                                        <input
                                                            type="text"
                                                            value={newBankAccount} onChange={e => setNewBankAccount(e.target.value)}
                                                            className="w-full bg-slate-50 border border-slate-200 text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 block p-2.5"
                                                            placeholder="Tên ngân hàng - Số tài khoản"
                                                        />
                                                    </div>
                                                    <div className="space-y-1.5">
                                                        <label className="text-sm font-medium text-slate-700">Trình độ học vấn</label>
                                                        <input
                                                            type="text"
                                                            value={newEducation} onChange={e => setNewEducation(e.target.value)}
                                                            className="w-full bg-slate-50 border border-slate-200 text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 block p-2.5"
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
                                                    disabled={actionLoading === 'create' || actionLoading === 'update'}
                                                    className="w-1/2 text-white bg-blue-600 hover:bg-blue-700 focus:ring-4 focus:ring-blue-500/30 font-medium rounded-lg text-sm px-5 py-2.5 text-center disabled:opacity-50 flex justify-center items-center gap-2 transition-all shadow-md shadow-blue-600/20"
                                                >
                                                    {actionLoading === 'create' || actionLoading === 'update' ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div> : (editUid ? 'Lưu thay đổi' : 'Thêm nhân viên')}
                                                </button>
                                            </div>
                                        </form>
                                    </div>
                                </div>
                            </Portal>
                        )}
                    </>
                );
            })()}
        </div>
    );
}

export default function ManagerUsersPage() {
    return (
        <Suspense fallback={
            <div className="flex justify-center py-12">
                <div className="w-8 h-8 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin" />
            </div>
        }>
            <ManagerUsersPageContent />
        </Suspense>
    );
}
