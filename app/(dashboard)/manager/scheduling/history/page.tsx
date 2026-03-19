'use client';

import { useState, useEffect, useCallback, Suspense } from 'react';
import { db } from '@/lib/firebase';
import { collection, query, where, getDocs, doc, getDoc } from 'firebase/firestore';
import { UserDoc, ScheduleDoc, SettingsDoc, StoreDoc, CustomRoleDoc } from '@/types';
import { toLocalDateString, cn } from '@/lib/utils';
import { useAuth } from '@/contexts/AuthContext';
import { History, ChevronLeft, ChevronRight, AlertTriangle, CheckCircle2, Search, ArrowUpDown, Building2, Ban } from 'lucide-react';
import { useTableParams } from '@/hooks/useTableParams';
import { processTableData } from '@/lib/processTableData';
import DataTableToolbar, { SortableHeader } from '@/components/DataTableToolbar';
import DataTablePagination from '@/components/DataTablePagination';
import { DashboardHeader } from '@/components/inventory/overview/DashboardHeader';
import EmployeeProfilePopup from '@/components/shared/EmployeeProfilePopup';

interface EmployeeStats {
    uid: string;
    name: string;
    type: string;
    role: string;
    customRoleId?: string;
    roleFilter: string; // 'store_manager' | 'manager' | 'employee' | 'custom:<id>'
    totalShifts: number;
    maxShifts: number;
    storeName?: string;
    isActive: boolean;
    statusFilter: string; // 'active' | 'disabled'
}

function ManagerHistoryPageContent() {
    const { user, userDoc, hasPermission } = useAuth();
    const [profileUid, setProfileUid] = useState<string | null>(null);
    const { params, setParam, setParams, clearAll, toggleSort: urlToggleSort, activeFilterCount, setPage, setPageSize } = useTableParams();

    const [currentMonth, setCurrentMonth] = useState<Date>(() => {
        const d = new Date();
        d.setDate(1);
        d.setHours(0, 0, 0, 0);
        return d;
    });

    const [stats, setStats] = useState<EmployeeStats[]>([]);
    const [settings, setSettings] = useState<SettingsDoc | null>(null);

    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    const [customRoles, setCustomRoles] = useState<CustomRoleDoc[]>([]);

    // Fetch custom roles
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

    // Table toolbar config — dynamically include custom roles
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
            key: 'roleFilter',
            label: 'Vai trò',
            options: [
                { value: 'store_manager', label: 'CH Trưởng' },
                { value: 'manager', label: 'Quản lý' },
                { value: 'employee', label: 'Nhân viên' },
                ...customRoles.map(r => ({ value: `custom:${r.id}`, label: r.name })),
            ],
        },
        {
            key: 'statusFilter',
            label: 'Trạng thái TK',
            options: [
                { value: 'active', label: 'Đang hoạt động' },
                { value: 'disabled', label: 'Vô hiệu hóa' },
            ],
        },
    ];

    const tableSortOptions = [
        { value: 'name', label: 'Nhân viên' },
        { value: 'totalShifts', label: 'Số ca' },
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

    // Fetch stores — needed for all roles to resolve storeId → name
    useEffect(() => {
        if (!user) return;
        async function fetchStores() {
            try {
                const token = await getToken();
                const res = await fetch('/api/stores', { headers: { 'Authorization': `Bearer ${token}` } });
                const data = await res.json();
                setStores(Array.isArray(data) ? data : []);
            } catch { /* silent */ }
        }
        fetchStores();
    }, [user, getToken]);

    useEffect(() => {
        if (!user || !userDoc) return;

        // Admin: filter by selected store if chosen, otherwise show all
        const effectiveStoreId = userDoc.role === 'admin' ? selectedAdminStoreId : userDoc.storeId;

        async function fetchHistory() {
            setLoading(true);
            setError('');
            try {
                let settingsData: SettingsDoc | null = null;
                if (effectiveStoreId) {
                    const storeSnap = await getDoc(doc(db, 'stores', effectiveStoreId));
                    if (storeSnap.exists()) {
                        const storeData = storeSnap.data() as StoreDoc;
                        settingsData = (storeData.settings as SettingsDoc) || null;
                    }
                }
                setSettings(settingsData);

                const ftDaysOff = settingsData?.monthlyQuotas?.ftDaysOff ?? 4;
                const maxPT = settingsData?.monthlyQuotas?.ptMaxShifts ?? 25;

                const year = currentMonth.getFullYear();
                const month = currentMonth.getMonth();
                const daysInMonth = new Date(year, month + 1, 0).getDate();
                const maxFT = Math.max(0, daysInMonth - ftDaysOff);

                // Fetch users filtered by storeId
                let usersQuery = query(collection(db, 'users'));
                if (effectiveStoreId) {
                    usersQuery = query(collection(db, 'users'), where('storeId', '==', effectiveStoreId));
                }
                const usersSnap = await getDocs(usersQuery);
                const userMap = new Map<string, UserDoc>();
                usersSnap.docs.forEach(d => {
                    const u = d.data() as UserDoc;
                    userMap.set(u.uid, u);
                });
                const storeNameMap = new Map(stores.map(s => [s.id, s.name]));

                const startOfMonthStr = toLocalDateString(new Date(year, month, 1));
                const endOfMonthStr = toLocalDateString(new Date(year, month, daysInMonth));

                const q = query(
                    collection(db, 'schedules'),
                    where('date', '>=', startOfMonthStr),
                    where('date', '<=', endOfMonthStr)
                );
                const schedulesSnap = await getDocs(q);

                const todayStr = toLocalDateString(new Date());
                // Use a Set per employee to track unique shifts (date_shiftId),
                // so working at multiple counters in the same shift is only counted once.
                const shiftSets = new Map<string, Set<string>>();

                schedulesSnap.docs.forEach(d => {
                    const schedule = d.data() as ScheduleDoc;
                    // Only count if the schedule belongs to the chosen store (or no filter)
                    const belongsToStore = !effectiveStoreId || schedule.storeId === effectiveStoreId || schedule.storeId === undefined;
                    if (schedule.date < todayStr && belongsToStore) {
                        const shiftKey = `${schedule.date}_${schedule.shiftId}`;
                        schedule.employeeIds.forEach(uid => {
                            if (!shiftSets.has(uid)) shiftSets.set(uid, new Set());
                            shiftSets.get(uid)!.add(shiftKey);
                        });
                    }
                });

                const shiftCounts = new Map<string, number>();
                shiftSets.forEach((shifts, uid) => {
                    shiftCounts.set(uid, shifts.size);
                });

                const finalStats: EmployeeStats[] = [];
                userMap.forEach((u) => {
                    if (u.role === 'admin') return;
                    finalStats.push({
                        uid: u.uid,
                        name: u.name,
                        type: u.type,
                        role: u.role,
                        customRoleId: u.customRoleId,
                        roleFilter: u.customRoleId ? `custom:${u.customRoleId}` : u.role,
                        totalShifts: shiftCounts.get(u.uid) || 0,
                        maxShifts: u.type === 'FT' ? maxFT : maxPT,
                        storeName: u.storeId ? (storeNameMap.get(u.storeId) ?? u.storeId) : undefined,
                        isActive: u.isActive !== false,
                        statusFilter: u.isActive !== false ? 'active' : 'disabled',
                    });
                });

                setStats(finalStats);
            } catch (err) {
                console.error(err);
                setError('Không thể tải lịch sử và thống kê ca làm. Vui lòng thử lại.');
            } finally {
                setLoading(false);
            }
        }

        fetchHistory();
    }, [user, userDoc, currentMonth, selectedAdminStoreId, stores]);

    const handlePreviousMonth = () => {
        const d = new Date(currentMonth);
        d.setMonth(d.getMonth() - 1);
        setCurrentMonth(d);
    };

    const handleNextMonth = () => {
        const d = new Date(currentMonth);
        d.setMonth(d.getMonth() + 1);
        setCurrentMonth(d);
    };

    const filteredAndSortedStats = processTableData(stats, {
        searchQuery: params.q,
        searchFields: ['name'] as (keyof EmployeeStats)[],
        filters: [
            { field: 'type' as keyof EmployeeStats, value: params.type || '' },
            { field: 'roleFilter' as keyof EmployeeStats, value: params.roleFilter || '' },
            { field: 'statusFilter' as keyof EmployeeStats, value: params.statusFilter || '' },
        ],
        sortField: (params.sort as keyof EmployeeStats) || undefined,
        sortOrder: params.order as 'asc' | 'desc',
    });

    const currentPage = Number(params.page) || 1;
    const currentPageSize = Number(params.pageSize) || 10;
    const paginatedStats = filteredAndSortedStats.slice((currentPage - 1) * currentPageSize, currentPage * currentPageSize);

    if (userDoc && (
        !['admin', 'store_manager', 'manager'].includes(userDoc.role) &&
        !hasPermission('page.scheduling.history')
    )) {
        return <div className="p-8 text-center text-danger-500">Bạn không có quyền truy cập trang này.</div>;
    }

    const effectiveStoreId = userDoc?.role === 'admin' ? selectedAdminStoreId : userDoc?.storeId;

    return (
        <div className="space-y-4 mx-auto">
            {/* Admin Store Selector Banner */}
            {userDoc?.role === 'admin' && (
                <div className="bg-white rounded-xl border border-surface-200 shadow-sm p-3 flex flex-col sm:flex-row items-start sm:items-center gap-3">
                    <div className="flex items-center gap-2 shrink-0">
                        <Building2 className="w-4 h-4 text-accent-500" />
                        <span className="text-sm font-semibold text-surface-700">Cửa hàng:</span>
                    </div>
                    <select
                        value={selectedAdminStoreId}
                        onChange={e => setSelectedAdminStoreId(e.target.value)}
                        className="flex-1 border border-surface-200 rounded-lg p-2 text-sm outline-none focus:ring-2 focus:ring-accent-300 bg-surface-50 font-medium"
                    >
                        <option value="">-- Tất cả cửa hàng --</option>
                        {stores.map(s => <option key={s.id} value={s.id}>{(s as any).type === 'OFFICE' ? '🏢' : (s as any).type === 'CENTRAL' ? '🏭' : '🏪'} {s.name}</option>)}
                    </select>
                </div>
            )}

            {/* Main content */}
            {(() => {
                const isAdmin = userDoc?.role === 'admin';
                return (
                    <>
                        {/* Header */}
                        <DashboardHeader
                            showSelect={false}
                            titleChildren={
                                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 w-full">
                                    <div>
                                        <h1 className="text-2xl font-bold bg-gradient-to-r from-primary-600 to-accent-600 bg-clip-text text-transparent flex items-center gap-2">
                                            <History className="w-7 h-7 text-primary-600" />
                                            Lịch sử &amp; Thống kê Ca làm
                                        </h1>
                                        <p className="text-surface-500 mt-1 text-sm">
                                            Xem tổng số ca <strong className="font-semibold text-surface-700">đã hoàn thành</strong> của nhân viên trong tháng để đối chiếu tính lương.
                                        </p>
                                    </div>

                                    <div className="flex items-center justify-center shrink-0 gap-2 bg-white p-2 rounded-xl shadow-sm border border-surface-200">
                                        <button onClick={handlePreviousMonth} className="p-1.5 hover:bg-surface-100 rounded-lg transition-colors text-surface-600">
                                            <ChevronLeft className="w-5 h-5" />
                                        </button>
                                        <div className="text-sm flex-1 font-semibold text-surface-700 min-w-[140px] text-center capitalize">
                                            Tháng {currentMonth.getMonth() + 1}/{currentMonth.getFullYear()}
                                        </div>
                                        <button onClick={handleNextMonth} className="p-1.5 hover:bg-surface-100 rounded-lg transition-colors text-surface-600">
                                            <ChevronRight className="w-5 h-5" />
                                        </button>
                                    </div>
                                </div>
                            }
                        />

                        {error && (
                            <div className="bg-danger-50 text-danger-600 p-4 rounded-xl text-sm font-medium border border-danger-100">{error}</div>
                        )}

                        {/* Main Content */}
                        <DataTableToolbar
                            searchValue={params.q}
                            onSearchChange={(v) => setParam('q', v)}
                            searchPlaceholder="Tìm nhân viên..."
                            filters={tableFilters}
                            filterValues={{ type: params.type || '', roleFilter: params.roleFilter || '', statusFilter: params.statusFilter || '' }}
                            onFilterChange={(key, value) => setParam(key, value)}
                            sortOptions={tableSortOptions}
                            currentSort={params.sort}
                            currentOrder={params.order}
                            onSortChange={urlToggleSort}
                            activeFilterCount={activeFilterCount}
                            onClearAll={clearAll}
                            onMobileApply={(values) => setParams(values)}
                        />

                        {/* Legend */}
                        <div className="flex items-center gap-3 text-sm text-surface-500 px-4">
                            <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-full bg-success-100 border border-success-300"></span>An toàn</span>
                            <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-full bg-warning-100 border border-warning-300"></span>Cận mức</span>
                            <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-full bg-danger-100 border border-danger-300"></span>Vượt mức</span>
                        </div>

                        <div className="bg-white rounded-2xl border border-surface-200 shadow-sm overflow-hidden">
                            <div className="overflow-x-auto">
                                <table className="w-full text-left text-sm text-surface-600">
                                    <thead className="bg-surface-50 text-surface-500 uppercase text-xs border-b border-surface-200">
                                        <tr className=''>
                                            <SortableHeader label="Nhân viên" field="name" currentSort={params.sort} currentOrder={params.order} onSort={urlToggleSort} className="px-6 text-center" />
                                            <th className="px-6 py-4 font-semibold text-center">Loại</th>
                                            {isAdmin && <th className="px-6 py-4 font-semibold text-center">Cửa hàng</th>}
                                            <SortableHeader label="Ca đã hoàn thành / Tối đa" field="totalShifts" currentSort={params.sort} currentOrder={params.order} onSort={urlToggleSort} className="px-6 text-center" />
                                            <th className="px-6 py-4 font-semibold text-center">Trạng thái</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-surface-100">
                                        {loading ? (
                                            <tr>
                                                <td colSpan={isAdmin ? 5 : 4} className="px-6 py-12 text-center text-surface-500">
                                                    <div className="flex justify-center mb-2">
                                                        <div className="w-6 h-6 border-2 border-primary-500 border-t-transparent rounded-full animate-spin"></div>
                                                    </div>
                                                    Đang tải dữ liệu...
                                                </td>
                                            </tr>
                                        ) : filteredAndSortedStats.length === 0 ? (
                                            <tr>
                                                <td colSpan={isAdmin ? 5 : 4} className="px-6 py-12 text-center text-surface-500">Không tìm thấy nhân viên nào.</td>
                                            </tr>
                                        ) : (
                                            paginatedStats.map((stat) => {
                                                const isWarning = stat.totalShifts === stat.maxShifts || stat.totalShifts === stat.maxShifts - 1;
                                                const isDanger = stat.totalShifts > stat.maxShifts;
                                                return (
                                                    <tr key={stat.uid} className={cn(
                                                        "hover:bg-surface-50 transition-colors",
                                                        !stat.isActive && 'opacity-50',
                                                        isDanger ? "bg-danger-50/30" : isWarning ? "bg-warning-50/30" : ""
                                                    )}>
                                                        <td className="px-6 py-4 gap-1 font-medium text-surface-800 flex flex-col">
                                                            <span
                                                                className={cn(
                                                                    hasPermission('action.hr.view_employee_profile') && 'cursor-pointer hover:underline'
                                                                )}
                                                                onClick={() => { if (hasPermission('action.hr.view_employee_profile')) setProfileUid(stat.uid); }}
                                                            >
                                                                {stat.name}
                                                            </span>
                                                            <div className="flex flex-wrap gap-1">
                                                                {stat.role === 'manager' && <span className="text-[10px] w-fit bg-accent-100 text-accent-700 px-1.5 py-0.5 rounded font-bold uppercase truncate">Quản lý</span>}
                                                                {stat.role === 'store_manager' && <span className="text-[10px] w-fit bg-accent-100 text-accent-700 px-1.5 py-0.5 rounded font-bold uppercase truncate">Trưởng cửa hàng</span>}
                                                                {!stat.isActive && <span className="text-[10px] w-fit bg-danger-100 text-danger-700 px-1.5 py-0.5 rounded font-bold uppercase truncate flex items-center gap-0.5"><Ban className="w-2.5 h-2.5" />Vô hiệu hóa</span>}
                                                            </div>
                                                        </td>
                                                        <td className="px-6 py-4">
                                                            <div className="flex items-center justify-center">
                                                                <span className={cn(
                                                                    "px-2 py-1 rounded-md text-xs font-bold border",
                                                                    stat.type === 'FT' ? "bg-accent-50 text-accent-700 border-accent-200" : "bg-teal-50 text-teal-700 border-teal-200"
                                                                )}>
                                                                    {stat.type}
                                                                </span>
                                                            </div>
                                                        </td>
                                                        {isAdmin && (
                                                            <td className="px-6 py-4">
                                                                <div className='flex items-center justify-center'>
                                                                    <span className="text-xs font-medium px-2 py-1 rounded bg-surface-100 text-surface-600">
                                                                        {stat.storeName ?? <span className="italic text-surface-400">—</span>}
                                                                    </span>
                                                                </div>
                                                            </td>
                                                        )}
                                                        <td className="px-6 py-4">
                                                            <div className="flex flex-col justify-center items-center gap-2 truncate">
                                                                <div className="flex items-center gap-2">
                                                                    <span className={cn("text-lg font-bold", isDanger ? "text-danger-600" : isWarning ? "text-warning-600" : "text-surface-800")}>
                                                                        {stat.totalShifts}
                                                                    </span>
                                                                    <span className="text-surface-400">/</span>
                                                                    <span className="text-surface-500 font-medium">{stat.maxShifts} ca</span>
                                                                </div>
                                                                <div className="w-full flex justify-start items-center max-w-[150px] h-1.5 bg-surface-100 rounded-full mt-2 overflow-hidden">
                                                                    <div
                                                                        className={cn("h-full rounded-full transition-all duration-500", isDanger ? "bg-danger-500" : isWarning ? "bg-warning-400" : "bg-success-400")}
                                                                        style={{ width: `${Math.min((stat.totalShifts / stat.maxShifts) * 100, 100)}%` }}
                                                                    />
                                                                </div>
                                                            </div>
                                                        </td>
                                                        <td className="px-6 py-4 text-right">
                                                            {!stat.isActive ? (
                                                                <span className="inline-flex items-center gap-1.5 text-surface-500 bg-surface-100 px-2.5 py-1 rounded-lg text-xs font-bold border border-surface-200">
                                                                    <Ban className="w-3.5 h-3.5" /> Vô hiệu hóa
                                                                </span>
                                                            ) : isDanger ? (
                                                                <span className="inline-flex items-center gap-1.5 text-danger-700 bg-danger-100 px-2.5 py-1 rounded-lg text-xs font-bold border border-danger-200">
                                                                    <AlertTriangle className="w-3.5 h-3.5" /> Thừa ca
                                                                </span>
                                                            ) : isWarning ? (
                                                                <span className="inline-flex items-center gap-1.5 text-warning-700 bg-warning-100 px-2.5 py-1 rounded-lg text-xs font-bold border border-warning-200">
                                                                    <AlertTriangle className="w-3.5 h-3.5" /> Sắp hết Quota
                                                                </span>
                                                            ) : (
                                                                <span className="inline-flex items-center truncate gap-1.5 text-success-700 bg-success-100 px-2.5 py-1 rounded-lg text-xs font-bold border border-success-200">
                                                                    <CheckCircle2 className="w-3.5 h-3.5" /> An toàn
                                                                </span>
                                                            )}
                                                        </td>
                                                    </tr>
                                                );
                                            })
                                        )}
                                    </tbody>
                                </table>
                            </div>
                            <DataTablePagination
                                totalItems={filteredAndSortedStats.length}
                                page={currentPage}
                                pageSize={currentPageSize}
                                onPageChange={setPage}
                                onPageSizeChange={setPageSize}
                            />
                        </div>
                    </>
                );
            })()}

            {profileUid && (
                <EmployeeProfilePopup
                    employeeUid={profileUid}
                    storeId={userDoc?.role === 'admin' ? selectedAdminStoreId : userDoc?.storeId}
                    onClose={() => setProfileUid(null)}
                />
            )}
        </div>
    );
}

export default function ManagerHistoryPage() {
    return (
        <Suspense fallback={
            <div className="flex justify-center py-12">
                <div className="w-8 h-8 border-4 border-accent-500 border-t-transparent rounded-full animate-spin" />
            </div>
        }>
            <ManagerHistoryPageContent />
        </Suspense>
    );
}
