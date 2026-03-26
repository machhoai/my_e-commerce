'use client';

import { useState, useEffect, useCallback, useMemo, Suspense } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { db } from '@/lib/firebase';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { UserDoc, EmployeeType, UserRole, StoreDoc, OfficeDoc, WarehouseDoc, CustomRoleDoc } from '@/types';
import { Users, Search, ShieldAlert, ShieldCheck, UserMinus, UserCheck, Plus, MailPlus, KeyRound, Building2, Shield, Award, UserX, RotateCcw, Briefcase, TrendingUp, FileWarning, CheckCircle2, AlertTriangle } from 'lucide-react';
import ExportEmployeesExcel from '@/components/hr/ExportEmployeesExcel';
import { cn } from '@/lib/utils';
import { useTableParams } from '@/hooks/useTableParams';
import { processTableData } from '@/lib/processTableData';
import DataTableToolbar, { SortableHeader } from '@/components/DataTableToolbar';
import DataTablePagination from '@/components/DataTablePagination';
import Portal from '@/components/Portal';
import { DashboardHeader } from '@/components/inventory/overview/DashboardHeader';
import EmployeeProfilePopup from '@/components/shared/EmployeeProfilePopup';

function ManagerUsersPageContent() {
    const { user, userDoc, loading: authLoading, hasPermission, effectiveStoreId: contextStoreId, managedStoreIds } = useAuth();
    const { params, setParam, setParams, clearAll, toggleSort, activeFilterCount, setPage, setPageSize } = useTableParams();
    const [employees, setEmployees] = useState<UserDoc[]>([]);
    const [loading, setLoading] = useState(true);
    const [profileUid, setProfileUid] = useState<string | null>(null);

    // Modal states
    const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
    const [editUid, setEditUid] = useState<string | null>(null);

    // Form states
    const [newName, setNewName] = useState('');
    const [newPhone, setNewPhone] = useState('');
    const [newType, setNewType] = useState<EmployeeType>('PT');
    const [newRole, setNewRole] = useState<UserRole>('employee');
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
                { value: 'true', label: 'Đang làm việc' },
                { value: 'false', label: 'Nghỉ việc' },
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
    const [offices, setOffices] = useState<OfficeDoc[]>([]);
    const [warehouses, setWarehouses] = useState<WarehouseDoc[]>([]);
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

    // Determine location type from selected ID
    const selectedLocationType: 'STORE' | 'OFFICE' | 'CENTRAL' | null = useMemo(() => {
        if (!selectedAdminStoreId) return null;
        if (stores.some(s => s.id === selectedAdminStoreId)) return 'STORE';
        if (offices.some(o => o.id === selectedAdminStoreId)) return 'OFFICE';
        if (warehouses.some(w => w.id === selectedAdminStoreId)) return 'CENTRAL';
        return null;
    }, [selectedAdminStoreId, stores, offices, warehouses]);

    // Fetch stores, offices, warehouses for admin
    useEffect(() => {
        if (userDoc?.role !== 'admin' || !user) return;
        async function fetchLocations() {
            try {
                const token = await getToken();
                const headers = { Authorization: `Bearer ${token}` };
                const [storesRes, officesRes, warehousesRes] = await Promise.all([
                    fetch('/api/stores', { headers }),
                    fetch('/api/offices', { headers }),
                    fetch('/api/warehouses', { headers }),
                ]);
                const [storesData, officesData, warehousesData] = await Promise.all([
                    storesRes.json(), officesRes.json(), warehousesRes.json(),
                ]);
                setStores(Array.isArray(storesData) ? storesData : []);
                setOffices(Array.isArray(officesData) ? officesData : []);
                setWarehouses(Array.isArray(warehousesData) ? warehousesData : []);
            } catch { /* silent */ }
        }
        fetchLocations();
    }, [userDoc, user, getToken]);

    // Fetch KPI averages
    useEffect(() => {
        const effectiveStoreId = userDoc?.role === 'admin' ? selectedAdminStoreId : (contextStoreId || userDoc?.storeId);
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
    }, [user, userDoc, selectedAdminStoreId, contextStoreId, getToken]);

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

        // Admin: filter by selected location if chosen, otherwise show all
        // Office users: use effectiveStoreId from AuthContext (managed store selection)
        const effectiveStoreId = userDoc.role === 'admin' ? selectedAdminStoreId : (contextStoreId || userDoc.storeId);

        // Build constraints: use the correct field based on location type
        const constraints: ReturnType<typeof where>[] = [];
        if (effectiveStoreId) {
            if (userDoc.role === 'admin' && selectedLocationType) {
                const fieldName = selectedLocationType === 'OFFICE' ? 'officeId'
                    : selectedLocationType === 'CENTRAL' ? 'warehouseId'
                    : 'storeId';
                constraints.push(where(fieldName, '==', effectiveStoreId));
            } else {
                // Non-admin: assumed STORE context
                constraints.push(where('storeId', '==', effectiveStoreId));
            }
        }

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
    }, [authLoading, user, userDoc, selectedAdminStoreId, selectedLocationType]);

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
                if (userDoc?.role === 'admin') {
                    // Always send storeId so admin can change or clear it
                    bodyPayload.storeId = newStoreId || null;
                }
            } else {
                bodyPayload.role = (userDoc?.role === 'store_manager' || userDoc?.role === 'admin') ? newRole : 'employee';
                if (userDoc?.role === 'store_manager' || userDoc?.role === 'admin') {
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
        setNewName(''); setNewPhone(''); setNewType('PT'); setNewRole('employee'); setNewCustomRoleId('');
        setNewDob(''); setNewJobTitle(''); setNewEmail('');
        setNewIdCard(''); setNewBankAccount(''); setNewEducation('');
        setNewStoreId('');
    };

    const openEditModal = (employee: UserDoc) => {
        setNewName(employee.name);
        setNewPhone(employee.phone);
        setNewType(employee.type || 'PT');
        setNewRole(employee.role ?? 'employee');
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

    // Compute counts for stat cards (always from full list)
    const activeEmployees = employees.filter(e => e.isActive !== false);
    const inactiveEmployees = employees.filter(e => e.isActive === false);

    // Profile completion check
    const isProfileComplete = (e: UserDoc): boolean => {
        const hasValidEmail = !!e.email && e.email.includes('@') && !e.email.endsWith('@company.com');
        if (!hasValidEmail) return false;
        const isAdmin = e.role === 'admin' || e.role === 'super_admin';
        if (isAdmin) return true;
        return !!(e.avatar && e.idCard && e.dob && e.gender && e.permanentAddress && e.idCardFrontPhoto && e.idCardBackPhoto);
    };
    const incompleteProfiles = activeEmployees.filter(e => !isProfileComplete(e));

    // Default status filter to 'true' (active) when not set in URL
    const statusFilterValue = params.status !== undefined && params.status !== '' ? params.status : 'true';

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
                { field: 'isActive' as keyof UserDoc, value: statusFilterValue },
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

    if (!user || (
        userDoc?.role !== 'admin' &&
        userDoc?.role !== 'store_manager' &&
        userDoc?.role !== 'manager' &&
        !hasPermission('page.hr.users')
    )) {
        return (
            <div className="flex flex-col items-center justify-center h-64 space-y-4">
                <ShieldAlert className="w-12 h-12 text-danger-500" />
                <h2 className="text-xl font-bold text-surface-800">Không có quyền truy cập</h2>
                <p className="text-surface-500">Bạn chưa được cấp quyền xem danh sách nhân viên.</p>
            </div>
        );
    }

    return (
        <div className="space-y-5 mx-auto">
            {/* Main content */}
            {(() => {
                const storeMap = new Map(stores.map(s => [s.id, s.name]));
                return (
                    <>
                        {/* Header */}
                        <DashboardHeader
                            showSelect={false}
                            titleChildren={
                                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                                    <div>
                                        <h1 className="text-2xl font-bold bg-gradient-to-r from-primary-600 to-accent-600 bg-clip-text text-transparent flex items-center gap-2">
                                            <Users className="w-7 h-7 text-primary-600" />
                                            Quản lý Nhân viên
                                        </h1>
                                        <p className="text-surface-500 mt-1 text-sm">
                                            Xem và quản lý trạng thái hoạt động của nhân viên.
                                        </p>
                                    </div>
                                </div>
                            }
                        />

                        {/* Admin Store Selector Banner */}
                        {userDoc?.role === 'admin' && (
                            <div className="bg-white rounded-xl items-center border border-surface-200 shadow-sm p-3 flex sm:flex-row sm:items-center gap-3">
                                <div className="flex items-center gap-2 shrink-0">
                                    <Building2 className="w-5 h-5 text-accent-500" />
                                </div>
                                <select
                                    value={selectedAdminStoreId}
                                    onChange={e => setSelectedAdminStoreId(e.target.value)}
                                    className="flex-1 border border-surface-200 rounded-lg p-2 text-sm outline-none focus:ring-2 focus:ring-accent-300 bg-white font-medium"
                                >
                                    <option value="">-- Tất cả cửa hàng --</option>
                                    {stores.map(s => <option key={s.id} value={s.id}>{(s as any).type === 'OFFICE' ? '🏢' : (s as any).type === 'CENTRAL' ? '🏭' : '🏪'} {s.name}</option>)}
                                </select>
                            </div>
                        )}

                        {actionMessage.text && (
                            <div className={`p-4 rounded-xl flex items-center justify-between gap-3 border shadow-sm animate-in fade-in slide-in-from-top-2 ${actionMessage.type === 'error' ? 'bg-danger-50 text-danger-700 border-danger-200' : 'bg-success-50 text-success-700 border-success-200'
                                }`}>
                                <div className="flex items-center gap-2">
                                    {actionMessage.type === 'error' ? <ShieldAlert className="w-5 h-5 flex-shrink-0" /> : <ShieldCheck className="w-5 h-5 flex-shrink-0" />}
                                    <p className="text-sm font-medium">{actionMessage.text}</p>
                                </div>
                                <button onClick={() => setActionMessage({ type: '', text: '' })} className="opacity-50 hover:opacity-100 font-bold px-2">×</button>
                            </div>
                        )}

                        {/* Toolbar */}


                        {/* Stats Cards */}
                        <div className="grid grid-cols-4 gap-3">
                            <div className="group bg-gradient-to-br from-success-50 to-white rounded-xl border border-success-100 shadow-sm p-4 hover:shadow-md hover:scale-[1.02] transition-all duration-300 cursor-default">
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 rounded-xl bg-success-100 group-hover:bg-success-200 flex items-center justify-center transition-colors">
                                        <UserCheck className="w-5 h-5 text-success-600" />
                                    </div>
                                    <div>
                                        <p className="text-2xl font-black text-surface-800">{activeEmployees.length}</p>
                                        <p className="text-xs text-surface-500 font-medium">Đang làm việc</p>
                                    </div>
                                </div>
                            </div>
                            <div className="group bg-gradient-to-br from-warning-50 to-white rounded-xl border border-warning-100 shadow-sm p-4 hover:shadow-md hover:scale-[1.02] transition-all duration-300 cursor-default">
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 rounded-xl bg-warning-100 group-hover:bg-warning-200 flex items-center justify-center transition-colors">
                                        <UserX className="w-5 h-5 text-warning-600" />
                                    </div>
                                    <div>
                                        <p className="text-2xl font-black text-surface-800">{inactiveEmployees.length}</p>
                                        <p className="text-xs text-surface-500 font-medium">Nghỉ việc</p>
                                    </div>
                                </div>
                            </div>
                            <div className="group bg-gradient-to-br from-amber-50 to-white rounded-xl border border-amber-100 shadow-sm p-4 hover:shadow-md hover:scale-[1.02] transition-all duration-300 cursor-default">
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 rounded-xl bg-amber-100 group-hover:bg-amber-200 flex items-center justify-center transition-colors">
                                        <FileWarning className="w-5 h-5 text-amber-600" />
                                    </div>
                                    <div>
                                        <p className="text-2xl font-black text-surface-800">{incompleteProfiles.length}</p>
                                        <p className="text-xs text-surface-500 font-medium">Hồ sơ thiếu</p>
                                    </div>
                                </div>
                            </div>
                            <div className="group bg-gradient-to-br from-primary-50 to-white rounded-xl border border-primary-100 shadow-sm p-4 hover:shadow-md hover:scale-[1.02] transition-all duration-300 cursor-default">
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 rounded-xl bg-primary-100 group-hover:bg-primary-200 flex items-center justify-center transition-colors">
                                        <Users className="w-5 h-5 text-primary-600" />
                                    </div>
                                    <div>
                                        <p className="text-2xl font-black text-surface-800">{employees.length}</p>
                                        <p className="text-xs text-surface-500 font-medium">Tổng nhân sự</p>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div className="flex gap-2 w-full">
                            <DataTableToolbar
                                searchValue={params.q}
                                onSearchChange={(v) => setParam('q', v)}
                                searchPlaceholder="Tìm theo tên hoặc số điện thoại..."
                                filters={tableFilters}
                                filterValues={{ type: params.type || '', role: params.role || '', status: statusFilterValue }}
                                onFilterChange={(key, value) => setParam(key, value)}
                                sortOptions={tableSortOptions}
                                currentSort={params.sort}
                                currentOrder={params.order}
                                onSortChange={toggleSort}
                                activeFilterCount={activeFilterCount}
                                onClearAll={clearAll}
                                onMobileApply={(values) => setParams(values)}
                                className="flex-1"
                            />

                            {/* Action buttons */}
                            <div className="flex items-center gap-2 justify-end">
                                <ExportEmployeesExcel employees={filteredEmployees} />
                                <button
                                    onClick={() => {
                                        resetForm();
                                        setEditUid(null);
                                        setIsCreateModalOpen(true);
                                    }}
                                    className="flex items-center gap-2 bg-gradient-to-r from-primary-600 to-accent-600 hover:from-primary-700 hover:to-accent-700 text-white px-5 py-2.5 rounded-xl font-medium shadow-lg shadow-primary-500/20 transition-all active:scale-95"
                                >
                                    <Plus className="w-4 h-4" />
                                    Thêm Nhân viên
                                </button>
                            </div>
                        </div>

                        {/* Table Container */}
                        <div className="bg-white rounded-2xl border border-surface-200 shadow-sm overflow-hidden flex flex-col">

                            <div className="overflow-x-auto">
                                <table className="w-full text-sm text-left text-surface-600">
                                    <thead className="text-[11px] text-surface-500 uppercase tracking-wider bg-surface-50/80 border-b border-surface-200">
                                        <tr>
                                            <SortableHeader label="Nhân viên" field="name" currentSort={params.sort} currentOrder={params.order} onSort={toggleSort} className="px-5 text-center" />
                                            <SortableHeader label="Loại HĐ" field="type" currentSort={params.sort} currentOrder={params.order} onSort={toggleSort} className="px-4 text-center" />
                                            <SortableHeader label="Vai trò" field="role" currentSort={params.sort} currentOrder={params.order} onSort={toggleSort} className="px-4 text-center" />
                                            {userDoc?.role === 'admin' && <th scope="col" className="px-4 py-3.5 text-center font-bold">Cửa hàng</th>}
                                            <SortableHeader label="KPI TB" field="kpi" currentSort={params.sort} currentOrder={params.order} onSort={toggleSort} className="px-4 text-center" />
                                            <th scope="col" className="px-4 py-3.5 text-center font-bold">Hồ sơ</th>
                                            <th scope="col" className="px-4 py-3.5 text-center font-bold">Trạng thái</th>
                                            <th scope="col" className="px-4 py-3.5 text-right font-bold">Hành động</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-surface-100">
                                        {loading ? (
                                            <tr>
                                                <td colSpan={userDoc?.role === 'admin' ? 8 : 7} className="py-12 text-center">
                                                    <div className="w-8 h-8 border-4 border-primary-500 border-t-transparent rounded-full animate-spin mx-auto"></div>
                                                </td>
                                            </tr>
                                        ) : filteredEmployees.length === 0 ? (
                                            <tr>
                                                <td colSpan={userDoc?.role === 'admin' ? 8 : 7} className="py-16 text-center">
                                                    <div className="flex flex-col items-center gap-3">
                                                        <div className="w-16 h-16 rounded-full bg-surface-100 flex items-center justify-center">
                                                            <Users className="w-7 h-7 text-surface-400" />
                                                        </div>
                                                        <div>
                                                            <p className="text-sm font-semibold text-surface-500">Không tìm thấy nhân viên nào</p>
                                                            <p className="text-xs text-surface-400 mt-1">Thử thay đổi bộ lọc hoặc từ khóa tìm kiếm.</p>
                                                        </div>
                                                    </div>
                                                </td>
                                            </tr>
                                        ) : (
                                            paginatedEmployees.map((e) => {
                                                const isActive = e.isActive !== false; // Default true if undefined
                                                const isSubmitting = actionLoading === e.uid;

                                                return (
                                                    <tr key={e.uid} className={`group transition-all duration-200 ${!isActive ? 'bg-surface-50/50 hover:bg-surface-100/70' : 'hover:bg-primary-50/30'}`}>
                                                        <td className="px-5 py-3.5 whitespace-nowrap">
                                                            <div className="flex items-center gap-3">
                                                                {/* Avatar initials */}
                                                                <div className={cn(
                                                                    'w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold shrink-0 transition-transform group-hover:scale-110',
                                                                    isActive
                                                                        ? 'bg-gradient-to-br from-primary-400 to-accent-500 text-white shadow-sm'
                                                                        : 'bg-surface-200 text-surface-500'
                                                                )}>
                                                                    {e.name.split(' ').slice(-1)[0]?.[0]?.toUpperCase() || '?'}
                                                                </div>
                                                                <div>
                                                                    <div
                                                                        className={cn(
                                                                            `font-semibold transition-colors ${!isActive ? 'text-surface-400' : 'text-surface-900 group-hover:text-primary-700'}`,
                                                                            hasPermission('action.hr.view_employee_profile') && 'cursor-pointer hover:underline'
                                                                        )}
                                                                        onClick={() => { if (hasPermission('action.hr.view_employee_profile')) setProfileUid(e.uid); }}
                                                                    >
                                                                        {e.name}
                                                                    </div>
                                                                    <div className="text-surface-400 text-xs mt-0.5 font-medium">{e.phone}</div>
                                                                </div>
                                                            </div>
                                                        </td>
                                                        <td className="px-4 py-3.5">
                                                            <span className={`px-2.5 py-1 text-[10px] font-bold uppercase rounded-lg border ${e.type === 'FT' ? 'bg-primary-50 text-primary-700 border-primary-200' : 'bg-accent-50 text-accent-700 border-accent-200'}`}>
                                                                {e.type === 'FT' ? 'Toàn thời gian' : 'Bán thời gian'}
                                                            </span>
                                                        </td>
                                                        <td className="px-4 py-3.5">
                                                            {(() => {
                                                                const colorMap: Record<string, string> = {
                                                                    red: 'bg-danger-100 text-danger-700',
                                                                    purple: 'bg-accent-100 text-accent-700',
                                                                    amber: 'bg-warning-100 text-warning-700',
                                                                    blue: 'bg-primary-100 text-primary-700',
                                                                    emerald: 'bg-success-100 text-success-700',
                                                                    indigo: 'bg-accent-100 text-accent-700',
                                                                    pink: 'bg-pink-100 text-pink-700',
                                                                    slate: 'bg-surface-100 text-surface-600',
                                                                };
                                                                // Check custom role first
                                                                if (e.customRoleId) {
                                                                    const cr = customRoles.find(r => r.id === e.customRoleId);
                                                                    if (cr) {
                                                                        return (
                                                                            <span className={`px-2.5 truncate py-1 text-[10px] font-bold uppercase rounded-lg border border-current/10 ${colorMap[cr.color || 'slate'] || 'bg-surface-100 text-surface-600'}`}>
                                                                                {cr.name}
                                                                            </span>
                                                                        );
                                                                    }
                                                                }
                                                                // Fallback: find system role by user's role field
                                                                const sysRole = customRoles.find(r => r.isSystem && r.id === e.role);
                                                                const roleName = sysRole?.name ?? (e.role === 'store_manager' ? 'CH Trưởng' : e.role === 'manager' ? 'Quản lý' : e.role === 'admin' ? 'Admin' : 'Nhân viên');
                                                                const roleColor = sysRole ? colorMap[sysRole.color || 'slate'] : 'bg-surface-100 text-surface-600';
                                                                return (
                                                                    <span className={`px-2.5 py-1 text-[10px] font-bold uppercase truncate rounded-lg border border-current/10 ${roleColor}`}>
                                                                        {roleName}
                                                                    </span>
                                                                );
                                                            })()}
                                                        </td>
                                                        {userDoc?.role === 'admin' && (
                                                            <td className="px-4 py-3.5">
                                                                <span className="text-xs font-medium truncate px-2.5 py-1 rounded-lg bg-surface-50 text-surface-600 border border-surface-200">
                                                                    {e.storeId ? (storeMap.get(e.storeId) ?? e.storeId) : <span className="italic text-surface-400">—</span>}
                                                                </span>
                                                            </td>
                                                        )}
                                                        <td className="px-4 py-3.5 text-center">
                                                            {(() => {
                                                                const kpi = kpiAverages[e.uid];
                                                                if (!kpi || kpi.count === 0) return <span className="text-surface-300">—</span>;
                                                                const score = kpi.avgOfficial;
                                                                const colorClass = score >= 80 ? 'bg-success-50 text-success-700 border-success-200' : score >= 50 ? 'bg-warning-50 text-warning-700 border-warning-200' : 'bg-danger-50 text-danger-700 border-danger-200';
                                                                return (
                                                                    <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold border ${colorClass}`} title={`${kpi.count} lượt chấm`}>
                                                                        <Award className="w-3 h-3" />
                                                                        {score}
                                                                    </span>
                                                                );
                                                            })()}
                                                        </td>
                                                        <td className="px-4 py-3.5 text-center">
                                                            {isProfileComplete(e) ? (
                                                                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[10px] font-bold border bg-success-50 text-success-600 border-success-200">
                                                                    <CheckCircle2 className="w-3 h-3" />
                                                                    Đầy đủ
                                                                </span>
                                                            ) : (
                                                                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[10px] font-bold border bg-amber-50 text-amber-600 border-amber-200">
                                                                    <AlertTriangle className="w-3 h-3" />
                                                                    Thiếu
                                                                </span>
                                                            )}
                                                        </td>
                                                        <td className="px-4 py-3.5 text-center">
                                                            <span className={`inline-flex truncate items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold border ${isActive ? 'bg-success-50 text-success-600 border-success-200' : 'bg-surface-50 text-surface-500 border-surface-200'}`}>
                                                                <span className={`w-1.5 h-1.5 rounded-full ${isActive ? 'bg-success-500 animate-pulse' : 'bg-surface-400'}`}></span>
                                                                {isActive ? 'Đang làm việc' : 'Nghỉ việc'}
                                                            </span>
                                                        </td>
                                                        <td className="px-4 py-3.5 text-right">
                                                            <div className="flex items-center justify-end gap-1.5">
                                                                <button
                                                                    onClick={() => openEditModal(e)}
                                                                    disabled={actionLoading !== null}
                                                                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-xl border bg-primary-50 text-primary-600 hover:bg-primary-100 border-primary-200 transition-all hover:shadow-sm disabled:opacity-50"
                                                                    title="Sửa Nhân viên"
                                                                >
                                                                    Sửa
                                                                </button>
                                                                {isActive ? (
                                                                    <button
                                                                        onClick={() => handleToggleActive(e.uid, true, e.name)}
                                                                        disabled={isSubmitting || actionLoading !== null}
                                                                        className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-xl border transition-all hover:shadow-sm disabled:opacity-50 disabled:cursor-not-allowed bg-danger-50 text-danger-600 hover:bg-danger-100 border-danger-200"
                                                                        title="Cho nghỉ việc"
                                                                    >
                                                                        {isSubmitting ? (
                                                                            <div className="w-3.5 h-3.5 border-2 border-current border-t-transparent rounded-full animate-spin" />
                                                                        ) : (
                                                                            <span className="truncate flex items-center gap-1.5">
                                                                                <UserMinus className="w-3.5 h-3.5" />
                                                                                Cho nghỉ việc
                                                                            </span>
                                                                        )}
                                                                    </button>
                                                                ) : (
                                                                    <button
                                                                        onClick={() => handleToggleActive(e.uid, false, e.name)}
                                                                        disabled={isSubmitting || actionLoading !== null}
                                                                        className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-xl border transition-all hover:shadow-sm disabled:opacity-50 disabled:cursor-not-allowed bg-success-50 text-success-600 hover:bg-success-100 border-success-200"
                                                                        title="Kích hoạt lại nhân viên"
                                                                    >
                                                                        {isSubmitting ? (
                                                                            <div className="w-3.5 h-3.5 border-2 border-current border-t-transparent rounded-full animate-spin" />
                                                                        ) : (
                                                                            <span className="truncate flex items-center gap-1.5">
                                                                                <RotateCcw className="w-3.5 h-3.5" />
                                                                                Kích hoạt lại
                                                                            </span>
                                                                        )}
                                                                    </button>
                                                                )}
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
                                <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-surface-900/50 backdrop-blur-sm overflow-y-auto">
                                    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden animate-in zoom-in-95 duration-200 my-8">
                                        <div className="p-6 border-b border-surface-100 flex items-center gap-3 bg-surface-50/50">
                                            <div className="w-10 h-10 rounded-full bg-primary-100 text-primary-600 flex items-center justify-center shrink-0">
                                                <MailPlus className="w-5 h-5" />
                                            </div>
                                            <div>
                                                <h3 className="text-lg font-bold text-surface-900">{editUid ? 'Cập nhật Nhân viên' : 'Thêm Nhân viên mới'}</h3>
                                                <p className="text-xs text-surface-500">{editUid ? 'Cập nhật thông tin nhân viên.' : 'Điền đầy đủ thông tin để thêm thành viên mới.'}</p>
                                            </div>
                                        </div>

                                        <form onSubmit={handleCreateOrUpdateUser} className="p-6 space-y-5">
                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                                                {/* Base Information */}
                                                <div className="space-y-4">
                                                    <h4 className="font-semibold text-surface-800 text-sm border-b pb-2">Thông tin cơ bản</h4>

                                                    <div className="space-y-1.5">
                                                        <label className="text-sm font-medium text-surface-700">Họ và Tên <span className="text-danger-500">*</span></label>
                                                        <input
                                                            type="text" required
                                                            value={newName} onChange={e => setNewName(e.target.value)}
                                                            className="w-full bg-surface-50 border border-surface-200 text-sm rounded-lg focus:ring-primary-500 focus:border-primary-500 block p-2.5"
                                                            placeholder="Nguyễn Văn A"
                                                        />
                                                    </div>
                                                    <div className="space-y-1.5">
                                                        <label className="text-sm font-medium text-surface-700">Số điện thoại (ID đăng nhập) <span className="text-danger-500">*</span></label>
                                                        <input
                                                            type="tel" required
                                                            value={newPhone} onChange={e => setNewPhone(e.target.value)}
                                                            className="w-full bg-surface-50 border border-surface-200 text-sm rounded-lg focus:ring-primary-500 focus:border-primary-500 block p-2.5"
                                                            placeholder="0912345678"
                                                        />
                                                        <p className="text-[10px] text-surface-400 mt-1 flex items-center gap-1">
                                                            <KeyRound className="w-3 h-3" />
                                                            Mật khẩu mặc định là 6 số cuối.
                                                        </p>
                                                    </div>
                                                    <div className="space-y-1.5">
                                                        <label className="text-sm font-medium text-surface-700">Loại hợp đồng <span className="text-danger-500">*</span></label>
                                                        <select
                                                            value={newType} onChange={e => setNewType(e.target.value as EmployeeType)}
                                                            className="w-full bg-surface-50 border border-surface-200 text-sm rounded-lg focus:ring-primary-500 focus:border-primary-500 block p-2.5 cursor-pointer"
                                                        >
                                                            <option value="PT">Bán thời gian (PT)</option>
                                                            <option value="FT">Toàn thời gian (FT)</option>
                                                        </select>
                                                    </div>
                                                    {(userDoc?.role === 'store_manager' || userDoc?.role === 'admin' || hasPermission('action.hr.manage')) && (() => {
                                                        // Filter roles this user can assign (based on creatorRoles), exclude locked roles
                                                        const eligibleRoles = customRoles.filter(r =>
                                                            !r.isLocked && (
                                                                r.creatorRoles?.includes(userDoc?.role ?? '') ||
                                                                r.creatorRoles?.includes(userDoc?.customRoleId ?? '')
                                                            )
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
                                                                    <label className="text-sm font-medium text-surface-700 flex items-center gap-1.5">
                                                                        <Shield className="w-3.5 h-3.5 text-accent-500" />
                                                                        Vai trò <span className="text-danger-500">*</span>
                                                                    </label>
                                                                    <select
                                                                        value={selectValue}
                                                                        onChange={e => handleRoleChange(e.target.value)}
                                                                        className="w-full bg-surface-50 border border-surface-200 text-sm rounded-lg focus:ring-primary-500 focus:border-primary-500 block p-2.5 cursor-pointer"
                                                                    >
                                                                        {eligibleRoles.map(r => (
                                                                            <option key={r.id} value={r.isSystem ? r.id : `custom:${r.id}`}>
                                                                                {r.name}{r.isSystem ? '' : ' ✦'}
                                                                            </option>
                                                                        ))}
                                                                    </select>
                                                                    {eligibleRoles.length === 0 && (
                                                                        <p className="text-[10px] text-warning-600">Không có vai trò nào khả dụng cho bạn.</p>
                                                                    )}
                                                                </div>
                                                                {userDoc?.role === 'admin' && (
                                                                    <div className="space-y-1.5">
                                                                        <label className="text-sm font-medium text-surface-700 flex items-center gap-1.5">
                                                                            <Building2 className="w-3.5 h-3.5 text-accent-500" />
                                                                            Cửa hàng
                                                                        </label>
                                                                        <select
                                                                            value={newStoreId}
                                                                            onChange={e => setNewStoreId(e.target.value)}
                                                                            className="w-full bg-surface-50 border border-surface-200 text-sm rounded-lg focus:ring-primary-500 focus:border-primary-500 block p-2.5 cursor-pointer"
                                                                        >
                                                                            <option value="">-- Chưa gán cửa hàng --</option>
                                                                            {stores.map(s => <option key={s.id} value={s.id}>{(s as any).type === 'OFFICE' ? '🏢' : (s as any).type === 'CENTRAL' ? '🏭' : '🏪'} {s.name}</option>)}
                                                                        </select>
                                                                    </div>
                                                                )}
                                                            </>
                                                        );
                                                    })()}

                                                    <div className="space-y-1.5">
                                                        <label className="text-sm font-medium text-surface-700">Ngày sinh</label>
                                                        <input
                                                            type="date"
                                                            value={newDob} onChange={e => setNewDob(e.target.value)}
                                                            className="w-full bg-surface-50 border border-surface-200 text-sm rounded-lg focus:ring-primary-500 focus:border-primary-500 block p-2.5"
                                                        />
                                                    </div>
                                                </div>

                                                {/* Extended Details */}
                                                <div className="space-y-4">
                                                    <h4 className="font-semibold text-surface-800 text-sm border-b pb-2">Thông tin chi tiết</h4>

                                                    <div className="space-y-1.5">
                                                        <label className="text-sm font-medium text-surface-700">Chức danh / Vị trí</label>
                                                        <input
                                                            type="text"
                                                            value={newJobTitle} onChange={e => setNewJobTitle(e.target.value)}
                                                            className="w-full bg-surface-50 border border-surface-200 text-sm rounded-lg focus:ring-primary-500 focus:border-primary-500 block p-2.5"
                                                            placeholder="VD: Thu ngân, Kỹ thuật..."
                                                        />
                                                    </div>
                                                    <div className="space-y-1.5">
                                                        <label className="text-sm font-medium text-surface-700">Địa chỉ Email</label>
                                                        <input
                                                            type="email"
                                                            value={newEmail} onChange={e => setNewEmail(e.target.value)}
                                                            className="w-full bg-surface-50 border border-surface-200 text-sm rounded-lg focus:ring-primary-500 focus:border-primary-500 block p-2.5"
                                                            placeholder="nhanvien@example.com"
                                                        />
                                                    </div>
                                                    <div className="space-y-1.5">
                                                        <label className="text-sm font-medium text-surface-700">Số CCCD</label>
                                                        <input
                                                            type="text"
                                                            value={newIdCard} onChange={e => setNewIdCard(e.target.value)}
                                                            className="w-full bg-surface-50 border border-surface-200 text-sm rounded-lg focus:ring-primary-500 focus:border-primary-500 block p-2.5"
                                                            placeholder="012345678910"
                                                        />
                                                    </div>
                                                    <div className="space-y-1.5">
                                                        <label className="text-sm font-medium text-surface-700">Tài khoản Ngân hàng</label>
                                                        <input
                                                            type="text"
                                                            value={newBankAccount} onChange={e => setNewBankAccount(e.target.value)}
                                                            className="w-full bg-surface-50 border border-surface-200 text-sm rounded-lg focus:ring-primary-500 focus:border-primary-500 block p-2.5"
                                                            placeholder="Tên ngân hàng - Số tài khoản"
                                                        />
                                                    </div>
                                                    <div className="space-y-1.5">
                                                        <label className="text-sm font-medium text-surface-700">Trình độ học vấn</label>
                                                        <input
                                                            type="text"
                                                            value={newEducation} onChange={e => setNewEducation(e.target.value)}
                                                            className="w-full bg-surface-50 border border-surface-200 text-sm rounded-lg focus:ring-primary-500 focus:border-primary-500 block p-2.5"
                                                            placeholder="VD: Cử nhân, Kỹ sư..."
                                                        />
                                                    </div>
                                                </div>
                                            </div>

                                            <div className="flex gap-3 pt-4 border-t border-surface-100 mt-6">
                                                <button
                                                    type="button"
                                                    onClick={() => {
                                                        setIsCreateModalOpen(false);
                                                        setEditUid(null);
                                                    }}
                                                    className="w-1/2 bg-white border border-surface-300 text-surface-700 hover:bg-surface-50 font-medium rounded-lg text-sm px-5 py-2.5 text-center transition-colors"
                                                >
                                                    Hủy
                                                </button>
                                                <button
                                                    type="submit"
                                                    disabled={actionLoading === 'create' || actionLoading === 'update'}
                                                    className="w-1/2 text-white bg-primary-600 hover:bg-primary-700 focus:ring-4 focus:ring-primary-500/30 font-medium rounded-lg text-sm px-5 py-2.5 text-center disabled:opacity-50 flex justify-center items-center gap-2 transition-all shadow-md shadow-primary-600/20"
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

            {profileUid && (
                <EmployeeProfilePopup
                    employeeUid={profileUid}
                    storeId={contextStoreId || userDoc?.storeId}
                    onClose={() => setProfileUid(null)}
                />
            )}
        </div>
    );
}

export default function ManagerUsersPage() {
    return (
        <Suspense fallback={
            <div className="flex justify-center py-12">
                <div className="w-8 h-8 border-4 border-accent-500 border-t-transparent rounded-full animate-spin" />
            </div>
        }>
            <ManagerUsersPageContent />
        </Suspense>
    );
}
