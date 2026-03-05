'use client';

import { useState, useEffect, Suspense } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { db } from '@/lib/firebase';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { UserDoc, KpiRecordDoc, StoreDoc } from '@/types';
import { cn } from '@/lib/utils';
import { exportKpiToPdf, exportKpiToExcel } from '@/lib/kpi-export';
import {
    BarChart3, Calendar, Building2, FileSpreadsheet, FileText,
    TrendingUp, TrendingDown, Users, Award, ChevronDown, ChevronRight,
    CheckCircle2, Clock, Filter,
} from 'lucide-react';
import { useTableParams } from '@/hooks/useTableParams';
import { processTableData } from '@/lib/processTableData';
import DataTableToolbar, { SortableHeader } from '@/components/DataTableToolbar';
import DataTablePagination from '@/components/DataTablePagination';

function ManagerKpiStatsPageContent() {
    const { user, userDoc, getToken, hasPermission } = useAuth();
    const { params, setParam, setParams, clearAll, toggleSort, activeFilterCount, setPage, setPageSize } = useTableParams();
    const [selectedMonth, setSelectedMonth] = useState(() => {
        const now = new Date();
        return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    });

    const [stores, setStores] = useState<StoreDoc[]>([]);
    const [selectedStoreId, setSelectedStoreId] = useState(() => {
        if (typeof window !== 'undefined') return localStorage.getItem('globalSelectedStoreId') || '';
        return '';
    });
    const effectiveStoreId = userDoc?.role === 'admin' ? selectedStoreId : userDoc?.storeId ?? '';

    const [records, setRecords] = useState<KpiRecordDoc[]>([]);
    const [employees, setEmployees] = useState<UserDoc[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [exporting, setExporting] = useState('');
    const [expandedUid, setExpandedUid] = useState<string | null>(null);
    const [statusFilter, setStatusFilter] = useState<'' | 'SELF_SCORED' | 'OFFICIAL'>('');

    // Fetch admin stores
    useEffect(() => {
        if (userDoc?.role !== 'admin' || !user) return;
        (async () => {
            try {
                const token = await getToken();
                const res = await fetch('/api/stores', { headers: { Authorization: `Bearer ${token}` } });
                setStores(await res.json());
            } catch { /* noop */ }
        })();
    }, [user, userDoc, getToken]);

    // Fetch records + employees
    useEffect(() => {
        if (!effectiveStoreId || !user) return;
        (async () => {
            setLoading(true);
            setError('');
            try {
                const token = await getToken();
                const res = await fetch(
                    `/api/kpi-records?storeId=${effectiveStoreId}&month=${selectedMonth}`,
                    { headers: { Authorization: `Bearer ${token}` } }
                );
                const data = await res.json();
                if (!res.ok) {
                    console.error('[KPI Stats] API error:', data);
                    setError(data?.error || `Lỗi ${res.status}`);
                    setRecords([]);
                    setEmployees([]);
                    return;
                }
                const recs: KpiRecordDoc[] = Array.isArray(data) ? data : [];
                setRecords(recs);

                // Fetch unique users
                const uids = [...new Set(recs.map(r => r.userId))];
                const users: UserDoc[] = [];
                for (let i = 0; i < uids.length; i += 10) {
                    const chunk = uids.slice(i, i + 10);
                    if (chunk.length === 0) break;
                    const uQuery = query(collection(db, 'users'), where('uid', 'in', chunk));
                    const uSnap = await getDocs(uQuery);
                    uSnap.docs.forEach(d => users.push(d.data() as UserDoc));
                }
                users.sort((a, b) => a.name.localeCompare(b.name));
                setEmployees(users);
            } catch (err) {
                console.error('[KPI Stats] Fetch error:', err);
                setError('Không thể tải dữ liệu KPI. Vui lòng thử lại.');
            } finally { setLoading(false); }
        })();
    }, [effectiveStoreId, selectedMonth, user, getToken]);

    // Filter records by status
    const filteredRecords = statusFilter ? records.filter(r => r.status === statusFilter) : records;

    // Aggregate stats per employee (using filtered records)
    const getEmpStats = (uid: string) => {
        const empRecs = filteredRecords.filter(r => r.userId === uid);
        const official = empRecs.filter(r => r.status === 'OFFICIAL');
        return {
            count: empRecs.length,
            avgSelf: empRecs.length ? Math.round(empRecs.reduce((s, r) => s + r.selfTotal, 0) / empRecs.length) : 0,
            avgOfficial: official.length ? Math.round(official.reduce((s, r) => s + r.officialTotal, 0) / official.length) : 0,
            officialCount: official.length,
        };
    };

    const handleExportPdf = async () => {
        setExporting('pdf');
        try {
            const rows = employees.map(emp => {
                const stats = getEmpStats(emp.uid);
                return { name: emp.name, count: stats.count, avgSelf: stats.avgSelf, avgOfficial: stats.avgOfficial };
            });
            exportKpiToPdf(rows, selectedMonth);
        } finally { setExporting(''); }
    };

    const handleExportExcel = async () => {
        setExporting('excel');
        try {
            const rows = employees.map(emp => {
                const stats = getEmpStats(emp.uid);
                return { name: emp.name, count: stats.count, avgSelf: stats.avgSelf, avgOfficial: stats.avgOfficial };
            });
            exportKpiToExcel(rows, selectedMonth);
        } finally { setExporting(''); }
    };

    const tableSortOptions = [
        { value: 'name', label: 'Nhân viên' },
    ];

    // Process employees through toolbar search/sort
    const processedEmployees = processTableData(employees, {
        searchQuery: params.q,
        searchFields: ['name'] as (keyof UserDoc)[],
        sortField: (params.sort as keyof UserDoc) || undefined,
        sortOrder: params.order as 'asc' | 'desc',
    });

    // Only show employees that have records matching the filter
    const visibleEmployees = processedEmployees.filter(emp =>
        filteredRecords.some(r => r.userId === emp.uid)
    );

    const currentPage = Number(params.page) || 1;
    const currentPageSize = Number(params.pageSize) || 10;
    const paginatedEmployees = visibleEmployees.slice((currentPage - 1) * currentPageSize, currentPage * currentPageSize);

    if (!userDoc || (userDoc.role !== 'admin' && userDoc.role !== 'store_manager' && !hasPermission('view_all_kpi'))) {
        return <div className="p-8 text-center text-red-500 font-bold">Không có quyền truy cập.</div>;
    }

    const totalRecords = filteredRecords.length;
    const officialRecords = filteredRecords.filter(r => r.status === 'OFFICIAL');
    const avgAll = officialRecords.length ? Math.round(officialRecords.reduce((s, r) => s + r.officialTotal, 0) / officialRecords.length) : 0;

    const formatDate = (dateStr: string) => {
        try {
            const [y, m, d] = dateStr.split('-');
            return `${d}/${m}/${y}`;
        } catch { return dateStr; }
    };

    return (
        <div className="space-y-6 mx-auto">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
                        <BarChart3 className="w-7 h-7 text-indigo-600" />
                        Thống kê KPI
                    </h1>
                    <p className="text-slate-500 mt-1 text-sm">Lịch sử chấm điểm và thống kê KPI nhân viên theo tháng.</p>
                </div>
                {/* Export buttons */}
                {hasPermission('export_kpi') && (
                    <div className="flex items-center gap-2">
                        <button onClick={handleExportPdf} disabled={!!exporting || !filteredRecords.length}
                            className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-red-50 text-red-700 border border-red-200 hover:bg-red-100 font-semibold text-xs disabled:opacity-50 transition-colors">
                            {exporting === 'pdf' ? <div className="w-3.5 h-3.5 border-2 border-red-500 border-t-transparent rounded-full animate-spin" /> : <FileText className="w-3.5 h-3.5" />}
                            PDF
                        </button>
                        <button onClick={handleExportExcel} disabled={!!exporting || !filteredRecords.length}
                            className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100 font-semibold text-xs disabled:opacity-50 transition-colors">
                            {exporting === 'excel' ? <div className="w-3.5 h-3.5 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" /> : <FileSpreadsheet className="w-3.5 h-3.5" />}
                            Excel
                        </button>
                    </div>
                )}
            </div>

            {/* Filters */}
            <div className="flex flex-col sm:flex-row gap-3">
                {userDoc.role === 'admin' && (
                    <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-2 flex items-center gap-2 flex-1">
                        <Building2 className="w-4 h-4 text-indigo-500 ml-1" />
                        <select value={selectedStoreId} onChange={e => setSelectedStoreId(e.target.value)}
                            className="flex-1 border border-slate-200 rounded-lg p-2 text-sm outline-none focus:ring-2 focus:ring-indigo-300">
                            <option value="">-- Chọn cửa hàng --</option>
                            {stores.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                        </select>
                    </div>
                )}
                <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-2 flex items-center gap-2">
                    <Calendar className="w-4 h-4 text-indigo-500 ml-1" />
                    <input type="month" value={selectedMonth} onChange={e => setSelectedMonth(e.target.value)}
                        className="border border-slate-200 rounded-lg p-2 text-sm outline-none focus:ring-2 focus:ring-indigo-300 font-medium" />
                </div>
                <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-2 flex items-center gap-2">
                    <Filter className="w-4 h-4 text-indigo-500 ml-1" />
                    <select value={statusFilter} onChange={e => setStatusFilter(e.target.value as '' | 'SELF_SCORED' | 'OFFICIAL')}
                        className="border border-slate-200 rounded-lg p-2 text-sm outline-none focus:ring-2 focus:ring-indigo-300 font-medium">
                        <option value="">Tất cả trạng thái</option>
                        <option value="SELF_SCORED">Tự chấm</option>
                        <option value="OFFICIAL">Chính thức</option>
                    </select>
                </div>
            </div>

            {/* Summary */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="bg-gradient-to-br from-indigo-50 to-blue-50 rounded-xl border border-indigo-100 p-4 shadow-sm">
                    <p className="text-xs text-indigo-600 font-medium uppercase tracking-wider mb-1 flex items-center gap-1"><Users className="w-3.5 h-3.5" /> Nhân viên</p>
                    <p className="text-3xl font-black text-indigo-800">{visibleEmployees.length}</p>
                </div>
                <div className="bg-gradient-to-br from-teal-50 to-emerald-50 rounded-xl border border-teal-100 p-4 shadow-sm">
                    <p className="text-xs text-teal-600 font-medium uppercase tracking-wider mb-1 flex items-center gap-1"><Award className="w-3.5 h-3.5" /> Tổng lượt chấm</p>
                    <p className="text-3xl font-black text-teal-800">{totalRecords}</p>
                </div>
                <div className="bg-gradient-to-br from-purple-50 to-fuchsia-50 rounded-xl border border-purple-100 p-4 shadow-sm">
                    <p className="text-xs text-purple-600 font-medium uppercase tracking-wider mb-1 flex items-center gap-1"><TrendingUp className="w-3.5 h-3.5" /> TB Chính thức</p>
                    <p className={cn('text-3xl font-black', avgAll >= 80 ? 'text-emerald-700' : avgAll >= 50 ? 'text-amber-700' : 'text-red-700')}>
                        {avgAll || '—'}
                    </p>
                </div>
            </div>

            {/* Employee Table */}
            {loading ? (
                <div className="flex justify-center py-12"><div className="w-8 h-8 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin" /></div>
            ) : error ? (
                <div className="bg-red-50 border-2 border-dashed border-red-300 rounded-2xl p-12 text-center text-red-500">
                    <Users className="w-10 h-10 mx-auto mb-3 text-red-300" />
                    <p className="font-semibold">{error}</p>
                    <p className="text-xs mt-2 text-red-400">Kiểm tra console để xem chi tiết lỗi.</p>
                </div>
            ) : visibleEmployees.length === 0 ? (
                <div className="bg-white border-2 border-dashed border-slate-300 rounded-2xl p-12 text-center text-slate-400">
                    <Users className="w-10 h-10 mx-auto mb-3 text-slate-300" />
                    <p className="font-semibold">Không có dữ liệu</p>
                    <p className="text-xs mt-2">Chưa có lượt chấm điểm KPI nào trong tháng này.</p>
                </div>
            ) : (
                <>
                    <DataTableToolbar
                        searchValue={params.q}
                        onSearchChange={(v) => setParam('q', v)}
                        searchPlaceholder="Tìm nhân viên..."
                        filters={[]}
                        filterValues={{}}
                        onFilterChange={() => { }}
                        sortOptions={tableSortOptions}
                        currentSort={params.sort}
                        currentOrder={params.order}
                        onSortChange={toggleSort}
                        activeFilterCount={activeFilterCount}
                        onClearAll={clearAll}
                        onMobileApply={(values) => setParams(values)}
                    />

                    <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm">
                                <thead className="bg-slate-50 border-b border-slate-200">
                                    <tr>
                                        <th className="text-left p-3 font-semibold text-slate-600 w-8"></th>
                                        <th className="text-left p-3 font-semibold text-slate-600">#</th>
                                        <SortableHeader label="Nhân viên" field="name" currentSort={params.sort} currentOrder={params.order} onSort={toggleSort} className="text-left" />
                                        <th className="text-center p-3 font-semibold text-slate-600">Số lượt</th>
                                        <th className="text-center p-3 font-semibold text-slate-600">TB Tự chấm</th>
                                        <th className="text-center p-3 font-semibold text-slate-600">TB Chính thức</th>
                                        <th className="text-center p-3 font-semibold text-slate-600">Chênh lệch</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                    {paginatedEmployees.map((emp, i) => {
                                        const stats = getEmpStats(emp.uid);
                                        const diff = stats.avgOfficial - stats.avgSelf;
                                        const isExpanded = expandedUid === emp.uid;
                                        const empRecords = filteredRecords
                                            .filter(r => r.userId === emp.uid)
                                            .sort((a, b) => b.date.localeCompare(a.date));

                                        return (
                                            <>
                                                <tr
                                                    key={emp.uid}
                                                    className={cn('hover:bg-slate-50/50 cursor-pointer transition-colors', isExpanded && 'bg-indigo-50/30')}
                                                    onClick={() => setExpandedUid(isExpanded ? null : emp.uid)}
                                                >
                                                    <td className="p-3 text-slate-400">
                                                        {isExpanded ? <ChevronDown className="w-4 h-4 text-indigo-500" /> : <ChevronRight className="w-4 h-4" />}
                                                    </td>
                                                    <td className="p-3 text-slate-400 font-bold">{(currentPage - 1) * currentPageSize + i + 1}</td>
                                                    <td className="p-3 font-medium text-slate-800">{emp.name}</td>
                                                    <td className="p-3 text-center font-bold text-slate-600">{stats.count}</td>
                                                    <td className="p-3 text-center">
                                                        <span className={cn('font-bold', stats.avgSelf >= 80 ? 'text-emerald-600' : stats.avgSelf >= 50 ? 'text-amber-600' : 'text-red-600')}>
                                                            {stats.avgSelf}
                                                        </span>
                                                    </td>
                                                    <td className="p-3 text-center">
                                                        <span className={cn('font-bold', stats.avgOfficial >= 80 ? 'text-emerald-600' : stats.avgOfficial >= 50 ? 'text-amber-600' : 'text-red-600')}>
                                                            {stats.avgOfficial || '—'}
                                                        </span>
                                                    </td>
                                                    <td className="p-3 text-center">
                                                        {stats.officialCount > 0 ? (
                                                            <span className={cn('text-xs font-bold flex items-center justify-center gap-0.5',
                                                                diff > 0 ? 'text-emerald-500' : diff < 0 ? 'text-red-500' : 'text-slate-400'
                                                            )}>
                                                                {diff > 0 ? <TrendingUp className="w-3 h-3" /> : diff < 0 ? <TrendingDown className="w-3 h-3" /> : null}
                                                                {diff > 0 ? '+' : ''}{diff}
                                                            </span>
                                                        ) : <span className="text-slate-300">—</span>}
                                                    </td>
                                                </tr>

                                                {/* Expanded detail rows */}
                                                {isExpanded && (
                                                    <tr key={`${emp.uid}-detail`}>
                                                        <td colSpan={7} className="p-0">
                                                            <div className="bg-slate-50/80 border-t border-b border-slate-200">
                                                                <div className="px-6 py-3">
                                                                    <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">
                                                                        Lịch sử chấm điểm — {emp.name}
                                                                    </p>
                                                                    {empRecords.length === 0 ? (
                                                                        <p className="text-sm text-slate-400 py-2">Không có bản ghi nào.</p>
                                                                    ) : (
                                                                        <div className="space-y-1.5">
                                                                            {empRecords.map((rec) => (
                                                                                <div
                                                                                    key={rec.id}
                                                                                    className="flex items-center gap-3 px-3 py-2 bg-white rounded-lg border border-slate-100 text-xs"
                                                                                >
                                                                                    {/* Status icon */}
                                                                                    {rec.status === 'OFFICIAL' ? (
                                                                                        <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                                                                                    ) : (
                                                                                        <Clock className="w-4 h-4 text-amber-500 shrink-0" />
                                                                                    )}

                                                                                    {/* Date */}
                                                                                    <span className="font-semibold text-slate-700 min-w-[70px]">
                                                                                        {formatDate(rec.date)}
                                                                                    </span>

                                                                                    {/* Shift */}
                                                                                    <span className="px-1.5 py-0.5 bg-indigo-50 text-indigo-600 rounded font-medium truncate max-w-[80px]">
                                                                                        {rec.shiftId}
                                                                                    </span>

                                                                                    {/* Self score */}
                                                                                    <div className="flex items-center gap-1 ml-auto">
                                                                                        <span className="text-slate-400">Tự:</span>
                                                                                        <span className={cn('font-bold', rec.selfTotal >= 80 ? 'text-emerald-600' : rec.selfTotal >= 50 ? 'text-amber-600' : 'text-red-600')}>
                                                                                            {rec.selfTotal}
                                                                                        </span>
                                                                                    </div>

                                                                                    {/* Official score */}
                                                                                    <div className="flex items-center gap-1">
                                                                                        <span className="text-slate-400">CT:</span>
                                                                                        {rec.status === 'OFFICIAL' ? (
                                                                                            <span className={cn('font-bold', rec.officialTotal >= 80 ? 'text-emerald-600' : rec.officialTotal >= 50 ? 'text-amber-600' : 'text-red-600')}>
                                                                                                {rec.officialTotal}
                                                                                            </span>
                                                                                        ) : (
                                                                                            <span className="text-slate-300">—</span>
                                                                                        )}
                                                                                    </div>

                                                                                    {/* Status badge */}
                                                                                    <span className={cn(
                                                                                        'px-1.5 py-0.5 rounded text-[10px] font-bold uppercase shrink-0',
                                                                                        rec.status === 'OFFICIAL' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'
                                                                                    )}>
                                                                                        {rec.status === 'OFFICIAL' ? 'Chính thức' : 'Tự chấm'}
                                                                                    </span>
                                                                                </div>
                                                                            ))}
                                                                        </div>
                                                                    )}
                                                                </div>
                                                            </div>
                                                        </td>
                                                    </tr>
                                                )}
                                            </>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    </div>
                    <DataTablePagination
                        totalItems={visibleEmployees.length}
                        page={currentPage}
                        pageSize={currentPageSize}
                        onPageChange={setPage}
                        onPageSizeChange={setPageSize}
                    />
                </>
            )}
        </div>
    );
}

export default function ManagerKpiStatsPage() {
    return (
        <Suspense fallback={
            <div className="flex justify-center py-12">
                <div className="w-8 h-8 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin" />
            </div>
        }>
            <ManagerKpiStatsPageContent />
        </Suspense>
    );
}
