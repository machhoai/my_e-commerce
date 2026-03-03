'use client';

import { useState, useEffect, useCallback, Suspense } from 'react';
import { db } from '@/lib/firebase';
import { collection, query, where, getDocs, doc, getDoc } from 'firebase/firestore';
import { UserDoc, ScheduleDoc, SettingsDoc, StoreDoc, CustomRoleDoc } from '@/types';
import { toLocalDateString, cn } from '@/lib/utils';
import { useAuth } from '@/contexts/AuthContext';
import { History, ChevronLeft, ChevronRight, AlertTriangle, CheckCircle2, Search, ArrowUpDown, Building2 } from 'lucide-react';
import { useTableParams } from '@/hooks/useTableParams';
import { processTableData } from '@/lib/processTableData';
import DataTableToolbar, { SortableHeader } from '@/components/DataTableToolbar';
import DataTablePagination from '@/components/DataTablePagination';

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
}

function ManagerHistoryPageContent() {
    const { user, userDoc } = useAuth();
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
        ],
        sortField: (params.sort as keyof EmployeeStats) || undefined,
        sortOrder: params.order as 'asc' | 'desc',
    });

    const currentPage = Number(params.page) || 1;
    const currentPageSize = Number(params.pageSize) || 10;
    const paginatedStats = filteredAndSortedStats.slice((currentPage - 1) * currentPageSize, currentPage * currentPageSize);

    if (userDoc && !['admin', 'store_manager', 'manager'].includes(userDoc.role)) {
        return <div className="p-8 text-center text-red-500">Bạn không có quyền truy cập trang này.</div>;
    }

    const effectiveStoreId = userDoc?.role === 'admin' ? selectedAdminStoreId : userDoc?.storeId;

    return (
        <div className="space-y-4 mx-auto">
            {/* Admin Store Selector Banner */}
            {userDoc?.role === 'admin' && (
                <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-3 flex flex-col sm:flex-row items-start sm:items-center gap-3">
                    <div className="flex items-center gap-2 shrink-0">
                        <Building2 className="w-4 h-4 text-indigo-500" />
                        <span className="text-sm font-semibold text-slate-700">Cửa hàng:</span>
                    </div>
                    <select
                        value={selectedAdminStoreId}
                        onChange={e => setSelectedAdminStoreId(e.target.value)}
                        className="flex-1 border border-slate-200 rounded-lg p-2 text-sm outline-none focus:ring-2 focus:ring-indigo-300 bg-slate-50 font-medium"
                    >
                        <option value="">-- Tất cả cửa hàng --</option>
                        {stores.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                    </select>
                </div>
            )}

            {/* Main content */}
            {(() => {
                const isAdmin = userDoc?.role === 'admin';
                return (
                    <>
                        {/* Header */}
                        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                            <div>
                                <h1 className="text-2xl font-bold bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent flex items-center gap-2">
                                    <History className="w-7 h-7 text-blue-600" />
                                    Lịch sử &amp; Thống kê Ca làm
                                </h1>
                                <p className="text-slate-500 mt-1">
                                    Xem tổng số ca <strong>đã hoàn thành</strong> của nhân viên trong tháng để đối chiếu tính lương.
                                </p>
                            </div>

                            <div className="flex items-center gap-2 bg-white p-2 rounded-xl shadow-sm border border-slate-200">
                                <button onClick={handlePreviousMonth} className="p-1.5 hover:bg-slate-100 rounded-lg transition-colors text-slate-600">
                                    <ChevronLeft className="w-5 h-5" />
                                </button>
                                <div className="text-sm flex-1 font-semibold text-slate-700 min-w-[140px] text-center capitalize">
                                    Tháng {currentMonth.getMonth() + 1}/{currentMonth.getFullYear()}
                                </div>
                                <button onClick={handleNextMonth} className="p-1.5 hover:bg-slate-100 rounded-lg transition-colors text-slate-600">
                                    <ChevronRight className="w-5 h-5" />
                                </button>
                            </div>
                        </div>

                        {error && (
                            <div className="bg-red-50 text-red-600 p-4 rounded-xl text-sm font-medium border border-red-100">{error}</div>
                        )}

                        {/* Main Content */}
                        <DataTableToolbar
                            searchValue={params.q}
                            onSearchChange={(v) => setParam('q', v)}
                            searchPlaceholder="Tìm nhân viên..."
                            filters={tableFilters}
                            filterValues={{ type: params.type || '', roleFilter: params.roleFilter || '' }}
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
                        <div className="flex items-center gap-3 text-sm text-slate-500 px-4">
                            <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-full bg-emerald-100 border border-emerald-300"></span>An toàn</span>
                            <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-full bg-amber-100 border border-amber-300"></span>Cận mức</span>
                            <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-full bg-red-100 border border-red-300"></span>Vượt mức</span>
                        </div>

                        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                            <div className="overflow-x-auto">
                                <table className="w-full text-left text-sm text-slate-600">
                                    <thead className="bg-slate-50 text-slate-500 uppercase text-xs border-b border-slate-200">
                                        <tr className=''>
                                            <SortableHeader label="Nhân viên" field="name" currentSort={params.sort} currentOrder={params.order} onSort={urlToggleSort} className="px-6 text-center" />
                                            <th className="px-6 py-4 font-semibold text-center">Loại</th>
                                            {isAdmin && <th className="px-6 py-4 font-semibold text-center">Cửa hàng</th>}
                                            <SortableHeader label="Ca đã hoàn thành / Tối đa" field="totalShifts" currentSort={params.sort} currentOrder={params.order} onSort={urlToggleSort} className="px-6 text-center" />
                                            <th className="px-6 py-4 font-semibold text-center">Trạng thái</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100">
                                        {loading ? (
                                            <tr>
                                                <td colSpan={isAdmin ? 5 : 4} className="px-6 py-12 text-center text-slate-500">
                                                    <div className="flex justify-center mb-2">
                                                        <div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
                                                    </div>
                                                    Đang tải dữ liệu...
                                                </td>
                                            </tr>
                                        ) : filteredAndSortedStats.length === 0 ? (
                                            <tr>
                                                <td colSpan={isAdmin ? 5 : 4} className="px-6 py-12 text-center text-slate-500">Không tìm thấy nhân viên nào.</td>
                                            </tr>
                                        ) : (
                                            paginatedStats.map((stat) => {
                                                const isWarning = stat.totalShifts === stat.maxShifts || stat.totalShifts === stat.maxShifts - 1;
                                                const isDanger = stat.totalShifts > stat.maxShifts;
                                                return (
                                                    <tr key={stat.uid} className={cn(
                                                        "hover:bg-slate-50 transition-colors",
                                                        isDanger ? "bg-red-50/30" : isWarning ? "bg-amber-50/30" : ""
                                                    )}>
                                                        <td className="px-6 py-4 gap-1 font-medium text-slate-800 flex flex-col">
                                                            {stat.name}
                                                            {stat.role === 'manager' && <span className="text-[10px] w-fit bg-indigo-100 text-indigo-700 px-1.5 py-0.5 rounded font-bold uppercase truncate">Quản lý</span>}
                                                            {stat.role === 'store_manager' && <span className="text-[10px] w-fit bg-indigo-100 text-indigo-700 px-1.5 py-0.5 rounded font-bold uppercase truncate">Trưởng cửa hàng</span>}
                                                        </td>
                                                        <td className="px-6 py-4">
                                                            <div className="flex items-center justify-center">
                                                                <span className={cn(
                                                                    "px-2 py-1 rounded-md text-xs font-bold border",
                                                                    stat.type === 'FT' ? "bg-purple-50 text-purple-700 border-purple-200" : "bg-teal-50 text-teal-700 border-teal-200"
                                                                )}>
                                                                    {stat.type}
                                                                </span>
                                                            </div>
                                                        </td>
                                                        {isAdmin && (
                                                            <td className="px-6 py-4">
                                                                <div className='flex items-center justify-center'>
                                                                    <span className="text-xs font-medium px-2 py-1 rounded bg-slate-100 text-slate-600">
                                                                        {stat.storeName ?? <span className="italic text-slate-400">—</span>}
                                                                    </span>
                                                                </div>
                                                            </td>
                                                        )}
                                                        <td className="px-6 py-4">
                                                            <div className="flex flex-col justify-center items-center gap-2 truncate">
                                                                <div className="flex items-center gap-2">
                                                                    <span className={cn("text-lg font-bold", isDanger ? "text-red-600" : isWarning ? "text-amber-600" : "text-slate-800")}>
                                                                        {stat.totalShifts}
                                                                    </span>
                                                                    <span className="text-slate-400">/</span>
                                                                    <span className="text-slate-500 font-medium">{stat.maxShifts} ca</span>
                                                                </div>
                                                                <div className="w-full flex justify-start items-center max-w-[150px] h-1.5 bg-slate-100 rounded-full mt-2 overflow-hidden">
                                                                    <div
                                                                        className={cn("h-full rounded-full transition-all duration-500", isDanger ? "bg-red-500" : isWarning ? "bg-amber-400" : "bg-emerald-400")}
                                                                        style={{ width: `${Math.min((stat.totalShifts / stat.maxShifts) * 100, 100)}%` }}
                                                                    />
                                                                </div>
                                                            </div>
                                                        </td>
                                                        <td className="px-6 py-4 text-right">
                                                            {isDanger ? (
                                                                <span className="inline-flex items-center gap-1.5 text-red-700 bg-red-100 px-2.5 py-1 rounded-lg text-xs font-bold border border-red-200">
                                                                    <AlertTriangle className="w-3.5 h-3.5" /> Thừa ca
                                                                </span>
                                                            ) : isWarning ? (
                                                                <span className="inline-flex items-center gap-1.5 text-amber-700 bg-amber-100 px-2.5 py-1 rounded-lg text-xs font-bold border border-amber-200">
                                                                    <AlertTriangle className="w-3.5 h-3.5" /> Sắp hết Quota
                                                                </span>
                                                            ) : (
                                                                <span className="inline-flex items-center truncate gap-1.5 text-emerald-700 bg-emerald-100 px-2.5 py-1 rounded-lg text-xs font-bold border border-emerald-200">
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
        </div>
    );
}

export default function ManagerHistoryPage() {
    return (
        <Suspense fallback={
            <div className="flex justify-center py-12">
                <div className="w-8 h-8 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin" />
            </div>
        }>
            <ManagerHistoryPageContent />
        </Suspense>
    );
}
