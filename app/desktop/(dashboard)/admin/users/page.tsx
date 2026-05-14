'use client';

import { useState, useEffect, useCallback, Suspense } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { db } from '@/lib/firebase';
import { collection, query, where, orderBy, onSnapshot } from 'firebase/firestore';
import { UserDoc, UserRole, EmployeeType, StoreDoc, OfficeDoc, WarehouseDoc, CustomRoleDoc } from '@/types';
import { Users, Plus, ShieldAlert, KeyRound, MailPlus, Search, ShieldCheck, Building2, Shield, ScanLine, ImageIcon } from 'lucide-react';
import { showToast } from '@/lib/utils/toast';
import { cn } from '@/lib/utils';
import { useTableParams } from '@/hooks/useTableParams';
import { processTableData } from '@/lib/processTableData';
import DataTableToolbar, { SortableHeader } from '@/components/DataTableToolbar';
import DataTablePagination from '@/components/DataTablePagination';
import Portal from '@/components/Portal';
import { DashboardHeader } from '@/components/inventory/overview/DashboardHeader';
import CCCDCamera, { CCCDScanResult } from '@/components/hr/CCCDCamera';
import UserInfoEditor from '@/components/shared/UserInfoEditor';

const ROLE_LABELS: Record<string, string> = {
    admin: 'Quản trị viên',
    store_manager: 'CH Trưởng',
    manager: 'Quản lý',
    employee: 'Nhân viên',
    office: 'Văn phòng',
};

const ROLE_BADGE_CLASS: Record<string, string> = {
    admin: 'bg-danger-50 text-danger-700 border-danger-100',
    store_manager: 'bg-accent-50 text-accent-700 border-accent-100',
    manager: 'bg-warning-50 text-warning-700 border-warning-100',
    employee: 'bg-primary-50 text-primary-700 border-primary-100',
    office: 'bg-teal-50 text-teal-700 border-teal-100',
};

function AdminUsersPageContent() {
    const { user, loading: authLoading } = useAuth();
    const { params, setParam, setParams, clearAll, toggleSort, activeFilterCount, setPage, setPageSize } = useTableParams();

    // Location data for all 3 collections
    const [stores, setStores] = useState<StoreDoc[]>([]);
    const [offices, setOffices] = useState<OfficeDoc[]>([]);
    const [warehouses, setWarehouses] = useState<WarehouseDoc[]>([]);
    // Unified location selector state — tracks which location to filter by
    const [selectedLocationId, setSelectedLocationId] = useState<string>(() => {
        if (typeof window !== 'undefined') {
            return localStorage.getItem('adminUsersSelectedLocation') || '';
        }
        return '';
    });
    // Derive the type from selected location ID across all 3 collections
    const selectedLocationType = (() => {
        if (!selectedLocationId) return null;
        if (stores.find(s => s.id === selectedLocationId)) return 'STORE';
        if (offices.find(o => o.id === selectedLocationId)) return 'OFFICE';
        if (warehouses.find(w => w.id === selectedLocationId)) return 'CENTRAL';
        return null;
    })();

    useEffect(() => {
        if (typeof window !== 'undefined' && selectedLocationId) {
            localStorage.setItem('adminUsersSelectedLocation', selectedLocationId);
        } else if (typeof window !== 'undefined' && !selectedLocationId) {
            localStorage.removeItem('adminUsersSelectedLocation');
        }
    }, [selectedLocationId]);

    // User list state
    const [users, setUsers] = useState<UserDoc[]>([]);
    const [loading, setLoading] = useState(true);

    // Modal states
    const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
    const [editUid, setEditUid] = useState<string | null>(null);
    const [editEmployee, setEditEmployee] = useState<UserDoc | null>(null);

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
    const [newWorkplaceType, setNewWorkplaceType] = useState<'STORE' | 'OFFICE' | 'CENTRAL'>('STORE');
    const [newStoreId, setNewStoreId] = useState('');
    const [newOfficeId, setNewOfficeId] = useState('');
    const [newWarehouseId, setNewWarehouseId] = useState('');
    const [newCustomRoleId, setNewCustomRoleId] = useState('');

    // CCCD Scanner states
    const [isCCCDOpen, setIsCCCDOpen] = useState(false);
    const [cccdScanned, setCccdScanned] = useState(false);
    const [newGender, setNewGender] = useState('');
    const [newPermanentAddress, setNewPermanentAddress] = useState('');
    const [newIdCardFrontPhoto, setNewIdCardFrontPhoto] = useState('');
    const [newIdCardBackPhoto, setNewIdCardBackPhoto] = useState('');

    // Derive the location type for the FORM's workplace selector (based on newWorkplaceType)
    const formLocationType = newWorkplaceType;

    const LOCATION_ICON: Record<string, string> = { STORE: '🏪', OFFICE: '🏢', CENTRAL: '🏭' };

    const [actionLoading, setActionLoading] = useState(false);
    const [customRoles, setCustomRoles] = useState<CustomRoleDoc[]>([]);

    // Table toolbar configuration — role options built dynamically from customRoles
    const roleFilterOptions = customRoles.length > 0
        ? customRoles.map(r => ({ value: r.isSystem ? r.id : `custom:${r.id}`, label: r.name }))
        : [
            { value: 'admin', label: 'Quản trị viên' },
            { value: 'store_manager', label: 'CH Trưởng' },
            { value: 'manager', label: 'Quản lý' },
            { value: 'employee', label: 'Nhân viên' },
            { value: 'office', label: 'Văn phòng' },
        ];
    const tableFilters = [
        {
            key: 'role',
            label: 'Vai trò',
            options: roleFilterOptions,
        },
        {
            key: 'type',
            label: 'Loại HĐ',
            options: [
                { value: 'FT', label: 'Toàn thời gian' },
                { value: 'PT', label: 'Bán thời gian' },
            ],
        },
        {
            key: 'status',
            label: 'Trạng thái',
            options: [
                { value: 'true', label: 'Đang làm' },
                { value: 'false', label: 'Đã nghỉ' },
            ],
        },
    ];

    const tableSortOptions = [
        { value: 'name', label: 'Họ tên' },
        { value: 'phone', label: 'Số điện thoại' },
        { value: 'role', label: 'Vai trò' },
        { value: 'type', label: 'Loại HĐ' },
    ];

    const getToken = useCallback(() => user?.getIdToken(), [user]);

    // Fetch all location collections at once
    useEffect(() => {
        if (!user) return;
        async function fetchLocations() {
            try {
                const token = await getToken();
                const [r1, r2, r3] = await Promise.all([
                    fetch('/api/stores', { headers: { Authorization: `Bearer ${token}` } }),
                    fetch('/api/offices', { headers: { Authorization: `Bearer ${token}` } }),
                    fetch('/api/warehouses', { headers: { Authorization: `Bearer ${token}` } }),
                ]);
                const [d1, d2, d3] = await Promise.all([r1.json(), r2.json(), r3.json()]);
                setStores(Array.isArray(d1) ? d1 : []);
                setOffices(Array.isArray(d2) ? d2 : []);
                setWarehouses(Array.isArray(d3) ? d3 : []);
            } catch { console.error('Failed to load locations'); }
        }
        fetchLocations();
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
        if (authLoading || !user) return;
        setLoading(true);

        let q;
        if (!selectedLocationId) {
            q = query(collection(db, 'users'), orderBy('name'));
        } else if (selectedLocationType === 'STORE') {
            q = query(collection(db, 'users'), where('storeId', '==', selectedLocationId), orderBy('name'));
        } else if (selectedLocationType === 'OFFICE') {
            q = query(collection(db, 'users'), where('officeId', '==', selectedLocationId), orderBy('name'));
        } else {
            q = query(collection(db, 'users'), where('warehouseId', '==', selectedLocationId), orderBy('name'));
        }

        const unsubscribe = onSnapshot(q, (snap) => {
            setUsers(snap.docs.map(d => d.data() as UserDoc));
            setLoading(false);
        }, (err) => {
            console.error('Error fetching users:', err);
            setLoading(false);
        });
        return () => unsubscribe();
    }, [authLoading, user, selectedLocationId, selectedLocationType]);

    const resetForm = () => {
        setNewName(''); setNewPhone(''); setNewRole('employee'); setNewType('PT');
        setNewDob(''); setNewJobTitle(''); setNewEmail(''); setNewIdCard('');
        setNewBankAccount(''); setNewEducation(''); setNewCanManageHR(false); setNewCustomRoleId('');
        setNewGender(''); setNewPermanentAddress(''); setNewIdCardFrontPhoto(''); setNewIdCardBackPhoto('');
        setCccdScanned(false);
        setNewStoreId(selectedLocationType === 'STORE' ? selectedLocationId : '');
        setNewOfficeId(selectedLocationType === 'OFFICE' ? selectedLocationId : '');
        setNewWarehouseId(selectedLocationType === 'CENTRAL' ? selectedLocationId : '');
        setNewWorkplaceType(
            selectedLocationType === 'OFFICE' ? 'OFFICE'
            : selectedLocationType === 'CENTRAL' ? 'CENTRAL'
            : 'STORE'
        );
        setEditUid(null);
        setIsCreateModalOpen(false);
    };

    // ── CCCD Scan handler ─────────────────────────────────────────────────────
    const handleCCCDScanComplete = (result: CCCDScanResult) => {
        setIsCCCDOpen(false);
        setCccdScanned(true);
        setNewName(result.parsedData.name);
        setNewIdCard(result.parsedData.idCard);
        setNewDob(result.parsedData.dob);
        setNewGender(result.parsedData.gender);
        setNewPermanentAddress(result.parsedData.permanentAddress);
        setNewIdCardFrontPhoto(result.frontPhotoWebP);
        setNewIdCardBackPhoto(result.backPhotoWebP);
    };

    const openCreateModal = () => {
        resetForm();
        setIsCreateModalOpen(true);
    };

    const openEditModal = (u: UserDoc) => {
        setEditEmployee(u);
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
                gender: newGender || undefined,
                permanentAddress: newPermanentAddress || undefined,
                idCardFrontPhoto: newIdCardFrontPhoto || undefined,
                idCardBackPhoto: newIdCardBackPhoto || undefined,
                canManageHR: newCanManageHR,
                workplaceType: newWorkplaceType,
                storeId: newWorkplaceType === 'STORE' ? (newStoreId || undefined) : undefined,
                officeId: newWorkplaceType === 'OFFICE' ? (newOfficeId || undefined) : undefined,
                warehouseId: newWorkplaceType === 'CENTRAL' ? (newWarehouseId || undefined) : undefined,
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
            showToast.success('Thành công', `Người dùng ${newName} đã được ${editUid ? 'cập nhật' : 'tạo'} thành công!`);
            resetForm();
        } catch (err: unknown) {
            showToast.error('Lỗi', err instanceof Error ? err.message : 'Đã xảy ra lỗi');
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
            showToast.success('Đã cập nhật', `Tài khoản ${u.name} đã được ${!u.isActive ? 'kích hoạt' : 'vô hiệu hóa'}`);
        } catch (err: unknown) {
            showToast.error('Lỗi', err instanceof Error ? err.message : 'Thao tác thất bại');
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
            showToast.success('Đặt lại mật khẩu', `Đặt lại mật khẩu thành công cho ${name}`);
        } catch (err: unknown) {
            showToast.error('Lỗi', err instanceof Error ? err.message : 'Thao tác thất bại');
        } finally {
            setActionLoading(false);
        }
    };

    const selectedLocationName = [
        ...stores.map(s => ({ id: s.id, name: s.name, icon: '🏪' })),
        ...offices.map(o => ({ id: o.id, name: o.name, icon: '🏢' })),
        ...warehouses.map(w => ({ id: w.id, name: w.name, icon: '🏭' })),
    ].find(l => l.id === selectedLocationId);
    const roleFilterValue = params.role || '';
    const isCustomRoleFilter = roleFilterValue.startsWith('custom:');

    // Unified location label lookup across all 3 collections
    const locationLabelMap = new Map<string, { name: string; type: string }>(
        [
            ...stores.map(s => [s.id, { name: s.name, type: 'STORE' }] as [string, { name: string; type: string }]),
            ...offices.map(o => [o.id, { name: o.name, type: 'OFFICE' }] as [string, { name: string; type: string }]),
            ...warehouses.map(w => [w.id, { name: w.name, type: 'CENTRAL' }] as [string, { name: string; type: string }]),
        ]
    );
    const getLocationLabel = (u: UserDoc) => {
        const id = u.storeId || u.officeId || u.warehouseId;
        if (!id) return null;
        const loc = locationLabelMap.get(id);
        if (!loc) return id;
        const icon = loc.type === 'OFFICE' ? '🏢' : loc.type === 'CENTRAL' ? '🏭' : '🏪';
        return `${icon} ${loc.name}`;
    };

    const filtered = processTableData(
        isCustomRoleFilter
            ? users.filter(u => u.customRoleId === roleFilterValue.slice(7))
            : users,
        {
            searchQuery: params.q,
            searchFields: ['name', 'phone'] as (keyof UserDoc)[],
            filters: [
                ...(!isCustomRoleFilter && roleFilterValue ? [{ field: 'role' as keyof UserDoc, value: roleFilterValue }] : []),
                { field: 'type' as keyof UserDoc, value: params.type || '' },
                { field: 'isActive' as keyof UserDoc, value: params.status || '' },
            ],
            sortField: (params.sort as keyof UserDoc) || undefined,
            sortOrder: params.order as 'asc' | 'desc',
        }
    );

    const currentPage = Number(params.page) || 1;
    const currentPageSize = Number(params.pageSize) || 10;
    const paginatedUsers = filtered.slice((currentPage - 1) * currentPageSize, currentPage * currentPageSize);

    return (
        <div className="space-y-6 mx-auto">
            {/* Header */}
            <DashboardHeader
                showSelect={false}
                titleChildren={
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 w-full mt-4">
                        <div>
                            <h1 className="text-2xl font-bold text-surface-800 flex items-center gap-2">
                                <Users className="w-7 h-7 text-surface-700" />
                                Quản lý Người dùng
                            </h1>
                            <p className="text-surface-500 mt-1">Xem và quản lý nhân sự theo cửa hàng, văn phòng hoặc kho tổng.</p>
                        </div>
                        <button
                            onClick={openCreateModal}
                            className="flex items-center gap-2 bg-surface-800 hover:bg-surface-900 text-white px-5 py-2.5 rounded-xl font-medium shadow-sm transition-colors shrink-0"
                        >
                            <Plus className="w-4 h-4" /> Thêm nhân viên
                        </button>
                    </div>
                }
            />

            {/* Unified Location Selector */}
            <div className="bg-white items-center rounded-2xl border border-surface-200 shadow-sm p-4 flex flex-col gap-4">
                <div className='flex gap-2 items-center justify-start w-full'>
                    <div className="flex items-center gap-2 shrink-0">
                        <Building2 className="w-5 h-5 text-accent-500" />
                        <span className="text-sm font-semibold text-surface-700 hidden sm:block">Lọc theo:</span>
                    </div>
                    <select
                        value={selectedLocationId}
                        onChange={e => { setSelectedLocationId(e.target.value); clearAll(); }}
                        className="flex-1 border border-surface-200 rounded-xl p-2.5 text-sm outline-none focus:ring-2 focus:ring-accent-300 focus:border-accent-400 bg-white font-medium min-w-[200px]"
                    >
                        <option value="">-- Tất cả --</option>
                        {stores.length > 0 && (
                            <optgroup label="🏪 Cửa hàng">
                                {stores.map(s => (
                                    <option key={s.id} value={s.id}>{s.name}{!s.isActive ? ' (Đã tắt)' : ''}</option>
                                ))}
                            </optgroup>
                        )}
                        {offices.length > 0 && (
                            <optgroup label="🏢 Văn phòng">
                                {offices.map(o => (
                                    <option key={o.id} value={o.id}>{o.name}{!o.isActive ? ' (Đã tắt)' : ''}</option>
                                ))}
                            </optgroup>
                        )}
                        {warehouses.length > 0 && (
                            <optgroup label="🏭 Kho tổng">
                                {warehouses.map(w => (
                                    <option key={w.id} value={w.id}>{w.name}{!w.isActive ? ' (Đã tắt)' : ''}</option>
                                ))}
                            </optgroup>
                        )}
                    </select>
                </div>
                <span className="text-sm text-surface-500 shrink-0">
                    {selectedLocationName
                        ? <><strong className="text-accent-700">{selectedLocationName.icon} {selectedLocationName.name}</strong> &middot; {users.length} người</>
                        : <>{users.length} người (tất cả)</>
                    }
                </span>
            </div>



            {/* User table - always shown */}
            {(() => {
                const storeMap = new Map(stores.map(s => [s.id, s.name]));
                return (
                    <>
                        <DataTableToolbar
                            searchValue={params.q}
                            onSearchChange={(v) => setParam('q', v)}
                            searchPlaceholder="Tìm theo tên hoặc số điện thoại..."
                            filters={tableFilters}
                            filterValues={{ role: params.role || '', type: params.type || '', status: params.status || '' }}
                            onFilterChange={(key, value) => setParam(key, value)}
                            sortOptions={tableSortOptions}
                            currentSort={params.sort}
                            currentOrder={params.order}
                            onSortChange={toggleSort}
                            activeFilterCount={activeFilterCount}
                            onClearAll={clearAll}
                            onMobileApply={(values) => setParams(values)}
                        />

                        <div className="bg-white rounded-2xl shadow-sm border border-surface-200 overflow-hidden">

                            {loading ? (
                                <div className="p-12 text-center text-surface-400">
                                    <div className="w-8 h-8 border-4 border-accent-500 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
                                    Đang tải nhân sự...
                                </div>
                            ) : filtered.length === 0 ? (
                                <div className="p-12 text-center text-surface-400">
                                    <Users className="w-12 h-12 mx-auto mb-3 opacity-30" />
                                    <p className="font-medium">{params.q || activeFilterCount > 0 ? 'Không tìm thấy kết quả' : 'Không có nhân sự nào'}</p>
                                </div>
                            ) : (
                                <div className="overflow-x-auto">
                                    <table className="w-full text-sm text-left">
                                        <thead className="text-xs text-surface-500 bg-surface-50/80 border-b border-surface-100">
                                            <tr>
                                                <SortableHeader label="Họ tên" field="name" currentSort={params.sort} currentOrder={params.order} onSort={toggleSort} className="px-5" />
                                                <SortableHeader label="SĐT" field="phone" currentSort={params.sort} currentOrder={params.order} onSort={toggleSort} />
                                                <SortableHeader label="Vai trò" field="role" currentSort={params.sort} currentOrder={params.order} onSort={toggleSort} className="text-center" />
                                                <SortableHeader label="Loại" field="type" currentSort={params.sort} currentOrder={params.order} onSort={toggleSort} className="text-center" />
                                                <th className="px-4 py-3.5 font-semibold">Cửa hàng</th>
                                                <th className="px-4 py-3.5 font-semibold text-center">Trạng thái</th>
                                                <th className="px-4 py-3.5 font-semibold text-right">Thao tác</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-surface-100">
                                            {paginatedUsers.map(u => (
                                                <tr key={u.uid} className={cn('hover:bg-surface-50/60 transition-colors group', !u.isActive && 'opacity-50')}>
                                                    <td className="px-5 py-3.5 font-medium text-surface-800">
                                                        {u.name}
                                                        {u.canManageHR && <span title="Có quyền quản lý HR"><ShieldCheck className="w-3.5 h-3.5 inline ml-1.5 text-accent-500" /></span>}
                                                    </td>
                                                    <td className="px-4 py-3.5 text-surface-500 font-mono text-xs">{u.phone}</td>
                                                    <td className="px-4 py-3.5 text-center">
                                                        {(() => {
                                                            const colorMap: Record<string, string> = {
                                                                red: 'bg-danger-50 text-danger-700 border-danger-100',
                                                                purple: 'bg-accent-50 text-accent-700 border-accent-100',
                                                                amber: 'bg-warning-50 text-warning-700 border-warning-100',
                                                                blue: 'bg-primary-50 text-primary-700 border-primary-100',
                                                                emerald: 'bg-success-50 text-success-700 border-success-100',
                                                                indigo: 'bg-accent-50 text-accent-700 border-accent-100',
                                                                pink: 'bg-pink-50 text-pink-700 border-pink-100',
                                                                slate: 'bg-surface-100 text-surface-600 border-surface-200',
                                                            };
                                                            // Check custom role first
                                                            if (u.customRoleId) {
                                                                const cr = customRoles.find(r => r.id === u.customRoleId);
                                                                if (cr) {
                                                                    return (
                                                                        <span className={cn('text-[11px] font-bold px-2 py-0.5 rounded border', colorMap[cr.color || 'slate'])}>
                                                                            {cr.name}
                                                                        </span>
                                                                    );
                                                                }
                                                            }
                                                            // Fallback: find system role
                                                            const sysRole = customRoles.find(r => r.isSystem && r.id === u.role);
                                                            return (
                                                                <span className={cn('text-[11px] font-bold px-2 py-0.5 rounded border', sysRole ? colorMap[sysRole.color || 'slate'] : (ROLE_BADGE_CLASS[u.role] ?? 'bg-surface-100 text-surface-600'))}>
                                                                    {sysRole?.name ?? ROLE_LABELS[u.role] ?? u.role}
                                                                </span>
                                                            );
                                                        })()}
                                                    </td>
                                                    <td className="px-4 py-3.5 text-center">
                                                        <span className={cn('text-[11px] font-bold px-2 py-0.5 rounded border',
                                                            u.type === 'FT' ? 'bg-primary-50 text-primary-700 border-primary-100' : 'bg-accent-50 text-accent-700 border-accent-100'
                                                        )}>
                                                            {u.type === 'FT' ? 'Toàn thời gian' : 'Bán thời gian'}
                                                        </span>
                                                    </td>
                                                    <td className="px-4 py-3.5">
                                                        <span className="text-xs font-medium px-2 py-0.5 rounded bg-surface-100 text-surface-600">
                                                            {getLocationLabel(u) ?? <span className="italic text-surface-400">— Admin —</span>}
                                                        </span>
                                                    </td>
                                                    <td className="px-4 py-3.5 text-center">
                                                        <button
                                                            onClick={() => handleToggleActive(u)}
                                                            disabled={actionLoading}
                                                            className={cn(
                                                                'text-[11px] font-bold px-2 py-0.5 rounded border cursor-pointer transition-opacity hover:opacity-70 disabled:cursor-not-allowed',
                                                                u.isActive ? 'bg-success-50 text-success-700 border-success-200' : 'bg-surface-100 text-surface-500 border-surface-200'
                                                            )}
                                                        >
                                                            {u.isActive ? 'Đang làm' : 'Đã nghỉ'}
                                                        </button>
                                                    </td>
                                                    <td className="px-4 py-3.5 text-right">
                                                        <div className="flex items-center justify-end gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                                                            <button
                                                                onClick={() => openEditModal(u)}
                                                                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-primary-50 text-primary-600 hover:bg-primary-100 border border-primary-200 transition-colors"
                                                            >
                                                                Sửa
                                                            </button>
                                                            <button
                                                                onClick={() => handleResetPassword(u.uid, u.name)}
                                                                disabled={actionLoading}
                                                                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-accent-50 text-accent-600 hover:bg-accent-100 border border-accent-200 transition-colors disabled:opacity-50"
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
                            {!loading && filtered.length > 0 && (
                                <DataTablePagination
                                    totalItems={filtered.length}
                                    page={currentPage}
                                    pageSize={currentPageSize}
                                    onPageChange={setPage}
                                    onPageSizeChange={setPageSize}
                                />
                            )}
                        </div>
                    </>
                );
            })()}

            {/* Create / Edit Modal */}
            {isCreateModalOpen && (
                <Portal>
                    <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-surface-900/50 backdrop-blur-sm">
                        <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl overflow-hidden animate-in zoom-in-95 duration-200 max-h-[90vh] overflow-y-auto">
                            <div className="p-6 border-b border-surface-100 flex items-center gap-3 sticky top-0 bg-white z-10">
                                <div className="w-10 h-10 rounded-full bg-surface-100 text-surface-600 flex items-center justify-center">
                                    <MailPlus className="w-5 h-5" />
                                </div>
                                <div>
                                    <h3 className="text-lg font-bold text-surface-900">{editUid ? 'Cập nhật Người dùng' : 'Tạo Người dùng mới'}</h3>
                                    <p className="text-xs text-surface-500">Tài khoản Firebase Auth sẽ được tạo tự động khi thêm mới.</p>
                                </div>
                            </div>

                            <form onSubmit={handleCreateOrUpdateUser} className="p-6 space-y-5">
                                {/* CCCD Scanner Button */}
                                {!editUid && (
                                    <button
                                        type="button"
                                        onClick={() => setIsCCCDOpen(true)}
                                        className={cn(
                                            'w-full flex items-center justify-center gap-3 py-3.5 rounded-xl border-2 border-dashed font-semibold text-sm transition-all',
                                            cccdScanned
                                                ? 'bg-success-50 border-success-300 text-success-700 hover:bg-success-100'
                                                : 'bg-accent-50 border-accent-300 text-accent-700 hover:bg-accent-100 animate-pulse'
                                        )}
                                    >
                                        <ScanLine className="w-5 h-5" />
                                        {cccdScanned ? '✓ Đã quét CCCD — Bấm để quét lại' : 'Quét CCCD để nhập liệu tự động'}
                                    </button>
                                )}

                                {/* CCCD Photo previews */}
                                {(newIdCardFrontPhoto || newIdCardBackPhoto) && (
                                    <div className="flex gap-3">
                                        {newIdCardFrontPhoto && (
                                            <div className="flex-1 rounded-xl border border-surface-200 overflow-hidden bg-surface-50">
                                                <div className="text-[10px] font-bold text-surface-500 uppercase tracking-wider px-3 py-1.5 bg-surface-100 flex items-center gap-1.5">
                                                    <ImageIcon className="w-3 h-3" /> Mặt trước
                                                </div>
                                                {/* eslint-disable-next-line @next/next/no-img-element */}
                                                <img src={newIdCardFrontPhoto} alt="CCCD Front" className="w-full h-28 object-cover" />
                                            </div>
                                        )}
                                        {newIdCardBackPhoto && (
                                            <div className="flex-1 rounded-xl border border-surface-200 overflow-hidden bg-surface-50">
                                                <div className="text-[10px] font-bold text-surface-500 uppercase tracking-wider px-3 py-1.5 bg-surface-100 flex items-center gap-1.5">
                                                    <ImageIcon className="w-3 h-3" /> Mặt sau
                                                </div>
                                                {/* eslint-disable-next-line @next/next/no-img-element */}
                                                <img src={newIdCardBackPhoto} alt="CCCD Back" className="w-full h-28 object-cover" />
                                            </div>
                                        )}
                                    </div>
                                )}

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                                    {/* Left col - Basic info */}
                                    <div className="space-y-4">
                                        <h4 className="font-semibold text-surface-800 text-sm border-b pb-2">Thông tin cơ bản</h4>
                                        {[
                                            { label: 'Họ và Tên *', value: newName, setter: setNewName, placeholder: 'Nguyễn Văn A', required: true, readOnly: cccdScanned },
                                            { label: 'Số điện thoại *', value: newPhone, setter: setNewPhone, placeholder: '0901234567', required: true, disabled: !!editUid },
                                        ].map(f => (
                                            <div key={f.label} className="space-y-1.5">
                                                <label className={cn('text-sm font-medium', (f as any).readOnly ? 'text-success-600' : 'text-surface-700')}>
                                                    {f.label}
                                                    {(f as any).readOnly && <span className="text-[10px] ml-1 text-success-500">(từ CCCD)</span>}
                                                </label>
                                                <input
                                                    required={f.required} disabled={f.disabled} placeholder={f.placeholder}
                                                    value={f.value} onChange={e => f.setter(e.target.value)}
                                                    readOnly={(f as any).readOnly}
                                                    className={cn(
                                                        'w-full border text-sm rounded-lg block p-2.5',
                                                        (f as any).readOnly
                                                            ? 'bg-success-50 border-success-200 text-success-800 cursor-not-allowed'
                                                            : 'bg-surface-50 border-surface-200 focus:ring-accent-500 focus:border-accent-400 disabled:bg-surface-100 disabled:text-surface-400'
                                                    )}
                                                />
                                            </div>
                                        ))}
                                        <div className="space-y-1.5">
                                            <label className="text-sm font-medium text-surface-700">Loại hợp đồng *</label>
                                            <select value={newType} onChange={e => setNewType(e.target.value as EmployeeType)}
                                                className="w-full bg-surface-50 border border-surface-200 text-sm rounded-lg focus:ring-accent-500 focus:border-accent-400 block p-2.5">
                                                <option value="PT">Bán thời gian (PT)</option>
                                                <option value="FT">Toàn thời gian (FT)</option>
                                            </select>
                                        </div>
                                        <div className="space-y-1.5">
                                            <label className="text-sm font-medium text-surface-700 flex items-center gap-1.5">
                                                <Shield className="w-3.5 h-3.5 text-accent-500" />
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
                                                className="w-full bg-surface-50 border border-surface-200 text-sm rounded-lg focus:ring-accent-500 focus:border-accent-400 block p-2.5"
                                            >
                                                {/* Roles shown based on location context */}
                                                {formLocationType === 'OFFICE' ? (
                                                    // OFFICE context: office-relevant roles + custom roles
                                                    <>
                                                        <optgroup label="Văn phòng">
                                                            <option value="office">🏢 Văn phòng (VP)</option>
                                                            <option value="admin">Quản trị viên</option>
                                                        </optgroup>
                                                        {customRoles.filter(r => !r.isSystem).length > 0 && (
                                                            <optgroup label="Vai trò tuỳ chỉnh">
                                                                {customRoles.filter(r => !r.isSystem).map(r => (
                                                                    <option key={r.id} value={`custom:${r.id}`}>
                                                                        {r.name} ❆
                                                                    </option>
                                                                ))}
                                                            </optgroup>
                                                        )}
                                                    </>
                                                ) : formLocationType === 'CENTRAL' ? (
                                                    // CENTRAL context: warehouse roles + custom roles
                                                    <>
                                                        <optgroup label="Kho tổng">
                                                            <option value="manager">Quản lý kho</option>
                                                            <option value="employee">Nhân viên kho</option>
                                                            <option value="admin">Quản trị viên</option>
                                                        </optgroup>
                                                        {customRoles.filter(r => !r.isSystem).length > 0 && (
                                                            <optgroup label="Vai trò tuỳ chỉnh">
                                                                {customRoles.filter(r => !r.isSystem).map(r => (
                                                                    <option key={r.id} value={`custom:${r.id}`}>
                                                                        {r.name} ❆
                                                                    </option>
                                                                ))}
                                                            </optgroup>
                                                        )}
                                                    </>
                                                ) : (
                                                    // STORE or no location: all store roles + custom roles
                                                    <>
                                                        <optgroup label="Vai trò hệ thống">
                                                            <option value="admin">Quản trị viên</option>
                                                            <option value="store_manager">CH Trưởng</option>
                                                            <option value="manager">Quản lý</option>
                                                            <option value="employee">Nhân viên</option>
                                                        </optgroup>
                                                        {customRoles.filter(r => !r.isSystem).length > 0 && (
                                                            <optgroup label="Vai trò tuỳ chỉnh">
                                                                {customRoles.filter(r => !r.isSystem).map(r => (
                                                                    <option key={r.id} value={`custom:${r.id}`}>
                                                                        {r.name} ❆
                                                                    </option>
                                                                ))}
                                                            </optgroup>
                                                        )}
                                                    </>
                                                )}
                                            </select>
                                        </div>
                                        <div className="space-y-1.5">
                                            <label className="text-sm font-medium text-surface-700">Loại nơi làm việc</label>
                                            <div className="flex gap-2">
                                                {(['STORE', 'OFFICE', 'CENTRAL'] as const).map(wt => (
                                                    <button
                                                        key={wt}
                                                        type="button"
                                                        onClick={() => {
                                                            setNewWorkplaceType(wt);
                                                            setNewStoreId(''); setNewOfficeId(''); setNewWarehouseId('');
                                                            if (wt === 'OFFICE') setNewRole('office');
                                                            else if (wt === 'CENTRAL') setNewRole('manager');
                                                            else setNewRole('employee');
                                                        }}
                                                        className={cn(
                                                            'flex-1 py-2 rounded-lg text-sm font-semibold border transition-all',
                                                            newWorkplaceType === wt
                                                                ? wt === 'STORE' ? 'bg-accent-600 text-white border-accent-600'
                                                                    : wt === 'OFFICE' ? 'bg-teal-600 text-white border-teal-600'
                                                                        : 'bg-accent-600 text-white border-accent-600'
                                                                : 'bg-surface-50 text-surface-600 border-surface-200 hover:bg-surface-100'
                                                        )}
                                                    >
                                                        {wt === 'STORE' ? '🏥 Cửa hàng' : wt === 'OFFICE' ? '🏢 Văn phòng' : '🏭 Kho tổng'}
                                                    </button>
                                                ))}
                                            </div>
                                        </div>
                                        <div className="space-y-1.5">
                                            <label className="text-sm font-medium text-surface-700">
                                                {newWorkplaceType === 'STORE' ? '🏥 Chọn Cửa hàng' : newWorkplaceType === 'OFFICE' ? '🏢 Chọn Văn phòng' : '🏭 Chọn Kho tổng'}
                                            </label>
                                            {newWorkplaceType === 'STORE' && (
                                                <select value={newStoreId} onChange={e => setNewStoreId(e.target.value)}
                                                    className="w-full bg-surface-50 border border-surface-200 text-sm rounded-lg focus:ring-accent-500 focus:border-accent-400 block p-2.5">
                                                    <option value="">(Không thuộc cửa hàng nào)</option>
                                                    {stores.map(s => <option key={s.id} value={s.id}>{s.name}{!s.isActive ? ' (Đã tắt)' : ''}</option>)}
                                                </select>
                                            )}
                                            {newWorkplaceType === 'OFFICE' && (
                                                <select value={newOfficeId} onChange={e => setNewOfficeId(e.target.value)}
                                                    className="w-full bg-surface-50 border border-surface-200 text-sm rounded-lg focus:ring-teal-500 focus:border-teal-400 block p-2.5">
                                                    <option value="">(Không thuộc văn phòng nào)</option>
                                                    {offices.map(o => <option key={o.id} value={o.id}>{o.name}{!o.isActive ? ' (Đã tắt)' : ''}</option>)}
                                                </select>
                                            )}
                                            {newWorkplaceType === 'CENTRAL' && (
                                                <select value={newWarehouseId} onChange={e => setNewWarehouseId(e.target.value)}
                                                    className="w-full bg-surface-50 border border-surface-200 text-sm rounded-lg focus:ring-accent-500 focus:border-accent-400 block p-2.5">
                                                    <option value="">(Không thuộc kho nào)</option>
                                                    {warehouses.map(w => <option key={w.id} value={w.id}>{w.name}{!w.isActive ? ' (Đã tắt)' : ''}</option>)}
                                                </select>
                                            )}
                                        </div>
                                        {/* canManageHR is STORE-specific */}
                                        {newRole !== 'admin' && newWorkplaceType === 'STORE' && (
                                            <label className="flex items-center gap-2 cursor-pointer p-3 border border-surface-200 rounded-lg bg-surface-50 hover:bg-surface-100 transition-colors">
                                                <input type="checkbox" checked={newCanManageHR} onChange={e => setNewCanManageHR(e.target.checked)}
                                                    className="w-4 h-4 text-accent-600 rounded focus:ring-accent-500 cursor-pointer" />
                                                <div>
                                                    <span className="text-sm font-semibold text-surface-800">Quyền Quản lý Nhân sự &amp; Xếp lịch</span>
                                                    <p className="text-[10px] text-surface-500 mt-0.5">Cho phép thêm, sửa, tắt hoạt động nhân viên và phân ca.</p>
                                                </div>
                                            </label>
                                        )}
                                    </div>


                                    {/* Right col - Extended details */}
                                    <div className="space-y-4">
                                        <h4 className="font-semibold text-surface-800 text-sm border-b pb-2">Thông tin bổ sung</h4>
                                        {[
                                            { label: 'Ngày sinh', value: newDob, setter: setNewDob, type: 'date', readOnly: cccdScanned },
                                            { label: 'Giới tính', value: newGender, setter: setNewGender, placeholder: 'Nam / Nữ', readOnly: cccdScanned },
                                            { label: 'Địa chỉ thường trú', value: newPermanentAddress, setter: setNewPermanentAddress, placeholder: 'Tỉnh, Huyện...', readOnly: cccdScanned },
                                            { label: 'Chức danh', value: newJobTitle, setter: setNewJobTitle, placeholder: 'VD: Nhân viên phục vụ' },
                                            { label: 'Email thực', value: newEmail, setter: setNewEmail, placeholder: 'email@example.com', type: 'email' },
                                            { label: 'CCCD/CMND', value: newIdCard, setter: setNewIdCard, placeholder: '0123456789', readOnly: cccdScanned },
                                            { label: 'Tài khoản ngân hàng', value: newBankAccount, setter: setNewBankAccount, placeholder: '123456789' },
                                            { label: 'Học vấn', value: newEducation, setter: setNewEducation, placeholder: 'Đại học, Cao đẳng...' },
                                        ].map(f => (
                                            <div key={f.label} className="space-y-1.5">
                                                <label className={cn('text-sm font-medium', (f as any).readOnly ? 'text-success-600' : 'text-surface-700')}>
                                                    {f.label}
                                                    {(f as any).readOnly && <span className="text-[10px] ml-1 text-success-500">(từ CCCD)</span>}
                                                </label>
                                                <input
                                                    type={(f as any).type || 'text'} placeholder={(f as any).placeholder}
                                                    value={f.value} onChange={e => f.setter(e.target.value)}
                                                    readOnly={(f as any).readOnly}
                                                    className={cn(
                                                        'w-full border text-sm rounded-lg block p-2.5',
                                                        (f as any).readOnly
                                                            ? 'bg-success-50 border-success-200 text-success-800 cursor-not-allowed'
                                                            : 'bg-surface-50 border-surface-200 focus:ring-accent-500 focus:border-accent-400'
                                                    )}
                                                />
                                            </div>
                                        ))}
                                    </div>
                                </div>



                                <div className="flex gap-3 pt-2">
                                    <button type="button" onClick={resetForm}
                                        className="flex-1 border border-surface-200 hover:bg-surface-50 text-surface-700 px-4 py-2.5 rounded-xl font-medium text-sm">Hủy</button>
                                    <button type="submit" disabled={actionLoading}
                                        className="flex-1 bg-surface-800 hover:bg-surface-900 text-white px-4 py-2.5 rounded-xl font-medium text-sm disabled:opacity-50">
                                        {actionLoading ? 'Đang lưu...' : (editUid ? 'Cập nhật' : 'Tạo mới')}
                                    </button>
                                </div>
                            </form>
                        </div>
                    </div>
                </Portal>
            )}

            {/* Edit User Modal — uses UserInfoEditor */}
            {editEmployee && (
                <Portal>
                    <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-surface-900/50 backdrop-blur-sm">
                        <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden animate-in zoom-in-95 duration-200 max-h-[90vh] overflow-y-auto">
                            <div className="p-6 border-b border-surface-100 flex items-center justify-between sticky top-0 bg-white z-10">
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 rounded-full bg-surface-100 text-surface-600 flex items-center justify-center">
                                        <Users className="w-5 h-5" />
                                    </div>
                                    <div>
                                        <h3 className="text-lg font-bold text-surface-900">Cập nhật Người dùng</h3>
                                        <p className="text-xs text-surface-500">{editEmployee.name} — {editEmployee.phone}</p>
                                    </div>
                                </div>
                                <button
                                    onClick={() => setEditEmployee(null)}
                                    className="w-8 h-8 rounded-lg bg-surface-100 hover:bg-surface-200 flex items-center justify-center transition-colors"
                                >
                                    <span className="text-surface-500 text-lg">×</span>
                                </button>
                            </div>
                            <div className="p-6">
                                <UserInfoEditor
                                    employee={editEmployee}
                                    onUpdated={() => setEditEmployee(null)}
                                    variant="full"
                                />
                            </div>
                        </div>
                    </div>
                </Portal>
            )}

            {/* CCCD Camera Modal */}
            {isCCCDOpen && (
                <CCCDCamera
                    onScanComplete={handleCCCDScanComplete}
                    onClose={() => setIsCCCDOpen(false)}
                />
            )}
        </div >
    );
}

export default function AdminUsersPage() {
    return (
        <Suspense fallback={
            <div className="flex justify-center py-12">
                <div className="w-8 h-8 border-4 border-accent-500 border-t-transparent rounded-full animate-spin" />
            </div>
        }>
            <AdminUsersPageContent />
        </Suspense>
    );
}
