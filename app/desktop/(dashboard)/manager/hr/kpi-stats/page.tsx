'use client';

import { useState, useEffect, Suspense, useMemo } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { db } from '@/lib/firebase';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { UserDoc, KpiRecordDoc, StoreDoc, CounterDoc } from '@/types';
import { cn } from '@/lib/utils';
import { exportKpiToPdf, exportKpiToExcel, exportKpiDetailedExcel, KpiDetailedRecord } from '@/lib/kpi-export';
import {
    BarChart3, Calendar, Building2, FileSpreadsheet, FileText,
    TrendingUp, TrendingDown, Users, Award, ChevronDown, ChevronRight,
    CheckCircle2, Clock, Filter, X, Download, UserCheck, MapPin,
} from 'lucide-react';
import { useTableParams } from '@/hooks/useTableParams';
import { processTableData } from '@/lib/processTableData';
import DataTableToolbar, { SortableHeader } from '@/components/DataTableToolbar';
import DataTablePagination from '@/components/DataTablePagination';
import Portal from '@/components/Portal';
import { DashboardHeader } from '@/components/inventory/overview/DashboardHeader';
import EmployeeProfilePopup from '@/components/shared/EmployeeProfilePopup';

function ManagerKpiStatsPageContent() {
    const { user, userDoc, getToken, hasPermission, effectiveStoreId: contextStoreId } = useAuth();
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
    const effectiveStoreId = userDoc?.role === 'admin' ? selectedStoreId : (contextStoreId || userDoc?.storeId || '');

    const [records, setRecords] = useState<KpiRecordDoc[]>([]);
    const [allEmployees, setAllEmployees] = useState<UserDoc[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [exporting, setExporting] = useState('');
    const [expandedUid, setExpandedUid] = useState<string | null>(null);
    const [profileUid, setProfileUid] = useState<string | null>(null);
    const [statusFilter, setStatusFilter] = useState<'' | 'SELF_SCORED' | 'OFFICIAL'>('');
    const [counters, setCounters] = useState<CounterDoc[]>([]);
    const [expandedRecordId, setExpandedRecordId] = useState<string | null>(null);

    // Export dialog state
    const [showExportDialog, setShowExportDialog] = useState(false);
    const [exportDateMode, setExportDateMode] = useState<'month' | 'range'>('month');
    const [exportMonth, setExportMonth] = useState(selectedMonth);
    const [exportDateFrom, setExportDateFrom] = useState('');
    const [exportDateTo, setExportDateTo] = useState('');
    const [exportSelectedUids, setExportSelectedUids] = useState<Set<string>>(new Set());
    const [exportSelectAll, setExportSelectAll] = useState(true);
    const [exportLoading, setExportLoading] = useState(false);

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

    // Fetch ALL active employees for the store + KPI records for selected month
    useEffect(() => {
        if (!effectiveStoreId || !user) return;
        (async () => {
            setLoading(true);
            setError('');
            try {
                const token = await getToken();

                // Fetch KPI records for the selected month
                const recRes = await fetch(
                    `/api/kpi-records?storeId=${effectiveStoreId}&month=${selectedMonth}`,
                    { headers: { Authorization: `Bearer ${token}` } }
                );
                const recData = await recRes.json();
                if (!recRes.ok) {
                    setError(recData?.error || `Lỗi ${recRes.status}`);
                    setRecords([]);
                    return;
                }
                setRecords(Array.isArray(recData) ? recData : []);

                // Fetch ALL active employees for this store
                const empQuery = query(
                    collection(db, 'users'),
                    where('storeId', '==', effectiveStoreId),
                    where('isActive', '==', true)
                );
                const empSnap = await getDocs(empQuery);
                const emps: UserDoc[] = empSnap.docs
                    .map(d => d.data() as UserDoc)
                    .filter(u => u.role !== 'admin')
                    .sort((a, b) => a.name.localeCompare(b.name));
                setAllEmployees(emps);

                // Fetch counters from store settings
                try {
                    const storeDoc = await getDocs(query(collection(db, 'stores'), where('__name__', '==', effectiveStoreId)));
                    if (!storeDoc.empty) {
                        const storeData = storeDoc.docs[0].data() as StoreDoc;
                        setCounters((storeData as any).settings?.counters || []);
                    }
                } catch { /* ignore */ }
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
            const rows = allEmployees.map(emp => {
                const stats = getEmpStats(emp.uid);
                return { name: emp.name, count: stats.count, avgSelf: stats.avgSelf, avgOfficial: stats.avgOfficial };
            });
            exportKpiToPdf(rows, selectedMonth);
        } finally { setExporting(''); }
    };

    const handleExportExcel = async () => {
        setExporting('excel');
        try {
            const rows = allEmployees.map(emp => {
                const stats = getEmpStats(emp.uid);
                return { name: emp.name, count: stats.count, avgSelf: stats.avgSelf, avgOfficial: stats.avgOfficial };
            });
            exportKpiToExcel(rows, selectedMonth);
        } finally { setExporting(''); }
    };

    // --- Detailed export dialog ---
    const handleOpenExportDialog = () => {
        setExportMonth(selectedMonth);
        setExportDateMode('month');
        setExportDateFrom('');
        setExportDateTo('');
        setExportSelectAll(true);
        setExportSelectedUids(new Set(allEmployees.map(e => e.uid)));
        setShowExportDialog(true);
    };

    const handleToggleEmployee = (uid: string) => {
        setExportSelectedUids(prev => {
            const next = new Set(prev);
            if (next.has(uid)) next.delete(uid); else next.add(uid);
            return next;
        });
        setExportSelectAll(false);
    };

    const handleToggleSelectAll = () => {
        if (exportSelectAll) {
            setExportSelectedUids(new Set());
            setExportSelectAll(false);
        } else {
            setExportSelectedUids(new Set(allEmployees.map(e => e.uid)));
            setExportSelectAll(true);
        }
    };

    const handleDetailedExport = async () => {
        setExportLoading(true);
        try {
            const token = await getToken();
            let fetchUrl = `/api/kpi-records?storeId=${effectiveStoreId}`;
            let label = '';

            if (exportDateMode === 'month') {
                fetchUrl += `&month=${exportMonth}`;
                label = exportMonth;
            } else {
                if (!exportDateFrom || !exportDateTo) {
                    alert('Vui lòng chọn ngày bắt đầu và kết thúc');
                    return;
                }
                fetchUrl += `&dateFrom=${exportDateFrom}&dateTo=${exportDateTo}`;
                label = `${exportDateFrom}_${exportDateTo}`;
            }

            const res = await fetch(fetchUrl, { headers: { Authorization: `Bearer ${token}` } });
            const data: KpiRecordDoc[] = await res.json();
            if (!res.ok) { alert('Lỗi tải dữ liệu'); return; }

            // Filter to OFFICIAL only + selected employees
            const officialRecs = data.filter(r =>
                r.status === 'OFFICIAL' && exportSelectedUids.has(r.userId)
            );

            if (officialRecs.length === 0) {
                alert('Không có bản ghi chính thức nào cho phạm vi đã chọn.');
                return;
            }

            // Resolve scorer names — first from allEmployees, then fetch missing ones
            const scorerUids = [...new Set(officialRecs.map(r => r.scoredByUserId).filter(Boolean) as string[])];
            const scorerMap = new Map<string, string>();
            // Pre-fill from already loaded employees
            allEmployees.forEach(e => scorerMap.set(e.uid, e.name));
            // Find UIDs not yet resolved
            const missingUids = scorerUids.filter(uid => !scorerMap.has(uid));
            for (let i = 0; i < missingUids.length; i += 10) {
                const chunk = missingUids.slice(i, i + 10);
                if (chunk.length === 0) break;
                const uQuery = query(collection(db, 'users'), where('uid', 'in', chunk));
                const uSnap = await getDocs(uQuery);
                uSnap.docs.forEach(d => {
                    const u = d.data() as UserDoc;
                    scorerMap.set(u.uid, u.name);
                });
            }

            // Build employee name map
            const empMap = new Map(allEmployees.map(e => [e.uid, e.name]));

            // Build detailed records sorted by employee then date
            const detailedRecords: KpiDetailedRecord[] = officialRecs
                .sort((a, b) => a.userId.localeCompare(b.userId) || a.date.localeCompare(b.date))
                .map(r => ({
                    employeeName: empMap.get(r.userId) || r.userId,
                    date: r.date,
                    shiftId: r.shiftId,
                    criteriaScores: r.details.map(d => ({
                        name: d.criteriaName,
                        officialScore: d.officialScore,
                        maxScore: d.maxScore,
                    })),
                    officialTotal: r.officialTotal,
                    scorerName: r.scoredByUserId ? (scorerMap.get(r.scoredByUserId) || r.scoredByUserId) : '',
                }));

            exportKpiDetailedExcel(detailedRecords, label);
            setShowExportDialog(false);
        } catch (err) {
            console.error('[KPI Export]', err);
            alert('Xuất file thất bại');
        } finally { setExportLoading(false); }
    };

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
            options: [
                { value: 'store_manager', label: 'CH Trưởng' },
                { value: 'manager', label: 'Quản lý' },
                { value: 'employee', label: 'Nhân viên' },
            ],
        },
    ];

    const tableSortOptions = [
        { value: 'name', label: 'Nhân viên' },
    ];

    // Process ALL employees through toolbar search/sort/filter
    const processedEmployees = processTableData(allEmployees, {
        searchQuery: params.q,
        searchFields: ['name'] as (keyof UserDoc)[],
        filters: [
            { field: 'type' as keyof UserDoc, value: params.type || '' },
            { field: 'role' as keyof UserDoc, value: params.role || '' },
        ],
        sortField: (params.sort as keyof UserDoc) || undefined,
        sortOrder: params.order as 'asc' | 'desc',
    });

    const currentPage = Number(params.page) || 1;
    const currentPageSize = Number(params.pageSize) || 10;
    const paginatedEmployees = processedEmployees.slice((currentPage - 1) * currentPageSize, currentPage * currentPageSize);

    if (!userDoc || !hasPermission('page.hr.kpi_stats')) {
        return <div className="p-8 text-center text-danger-500 font-bold">Không có quyền truy cập.</div>;
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
            {/* Header */}
            <DashboardHeader
                showSelect={false}
                titleChildren={
                    <div className="flex items-center justify-between w-full gap-4 flex-wrap">
                        <div>
                            <h1 className="text-2xl font-bold text-surface-800 flex items-center gap-2">
                                <BarChart3 className="w-7 h-7 text-accent-600" />
                                Thống kê KPI
                            </h1>
                            <p className="text-surface-500 mt-1 text-sm">Lịch sử chấm điểm và thống kê KPI nhân viên theo tháng.</p>
                        </div>
                        {/* Export buttons */}
                        {(hasPermission('action.export.kpi') || userDoc.role === 'admin' || userDoc.role === 'store_manager') && (
                            <div className="flex items-center gap-2">
                                <button onClick={handleExportPdf} disabled={!!exporting || !filteredRecords.length}
                                    className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-danger-50 text-danger-700 border border-danger-200 hover:bg-danger-100 font-semibold text-xs disabled:opacity-50 transition-colors">
                                    {exporting === 'pdf' ? <div className="w-3.5 h-3.5 border-2 border-danger-500 border-t-transparent rounded-full animate-spin" /> : <FileText className="w-3.5 h-3.5" />}
                                    PDF
                                </button>
                                <button onClick={handleExportExcel} disabled={!!exporting || !filteredRecords.length}
                                    className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-success-50 text-success-700 border border-success-200 hover:bg-success-100 font-semibold text-xs disabled:opacity-50 transition-colors">
                                    {exporting === 'excel' ? <div className="w-3.5 h-3.5 border-2 border-success-500 border-t-transparent rounded-full animate-spin" /> : <FileSpreadsheet className="w-3.5 h-3.5" />}
                                    Excel
                                </button>
                                <button onClick={handleOpenExportDialog}
                                    className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-accent-50 text-accent-700 border border-accent-200 hover:bg-accent-100 font-semibold text-xs transition-colors">
                                    <Download className="w-3.5 h-3.5" />
                                    Xuất chi tiết
                                </button>
                            </div>
                        )}
                    </div>
                }
            />

            {/* Filters */}
            <div className="flex flex-col sm:flex-row gap-3">
                {userDoc.role === 'admin' && (
                    <div className="bg-white rounded-xl border border-surface-200 shadow-sm p-2 flex items-center gap-2 flex-1">
                        <Building2 className="w-4 h-4 text-accent-500 ml-1" />
                        <select value={selectedStoreId} onChange={e => setSelectedStoreId(e.target.value)}
                            className="flex-1 border border-surface-200 rounded-lg p-2 text-sm outline-none focus:ring-2 focus:ring-accent-300">
                            <option value="">-- Chọn cửa hàng --</option>
                            {stores.map(s => <option key={s.id} value={s.id}>{(s as any).type === 'OFFICE' ? '🏢' : (s as any).type === 'CENTRAL' ? '🏭' : '🏪'} {s.name}</option>)}
                        </select>
                    </div>
                )}
                <div className="bg-white rounded-xl border border-surface-200 shadow-sm p-2 flex items-center gap-2">
                    <Calendar className="w-4 h-4 text-accent-500 ml-1" />
                    <input type="month" value={selectedMonth} onChange={e => setSelectedMonth(e.target.value)}
                        className="border border-surface-200 rounded-lg p-2 text-sm outline-none focus:ring-2 focus:ring-accent-300 font-medium" />
                </div>
                <div className="bg-white rounded-xl border border-surface-200 shadow-sm p-2 flex items-center gap-2">
                    <Filter className="w-4 h-4 text-accent-500 ml-1" />
                    <select value={statusFilter} onChange={e => setStatusFilter(e.target.value as '' | 'SELF_SCORED' | 'OFFICIAL')}
                        className="border border-surface-200 rounded-lg p-2 text-sm outline-none focus:ring-2 focus:ring-accent-300 font-medium">
                        <option value="">Tất cả trạng thái</option>
                        <option value="SELF_SCORED">Tự chấm</option>
                        <option value="OFFICIAL">Chính thức</option>
                    </select>
                </div>
            </div>

            {/* Summary */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="bg-gradient-to-br from-accent-50 to-primary-50 rounded-xl border border-accent-100 p-4 shadow-sm">
                    <p className="text-xs text-accent-600 font-medium uppercase tracking-wider mb-1 flex items-center gap-1"><Users className="w-3.5 h-3.5" /> Nhân viên</p>
                    <p className="text-3xl font-black text-accent-800">{allEmployees.length}</p>
                </div>
                <div className="bg-gradient-to-br from-teal-50 to-success-50 rounded-xl border border-teal-100 p-4 shadow-sm">
                    <p className="text-xs text-teal-600 font-medium uppercase tracking-wider mb-1 flex items-center gap-1"><Award className="w-3.5 h-3.5" /> Tổng lượt chấm</p>
                    <p className="text-3xl font-black text-teal-800">{totalRecords}</p>
                </div>
                <div className="bg-gradient-to-br from-accent-50 to-fuchsia-50 rounded-xl border border-accent-100 p-4 shadow-sm">
                    <p className="text-xs text-accent-600 font-medium uppercase tracking-wider mb-1 flex items-center gap-1"><TrendingUp className="w-3.5 h-3.5" /> TB Chính thức</p>
                    <p className={cn('text-3xl font-black', avgAll >= 80 ? 'text-success-700' : avgAll >= 50 ? 'text-warning-700' : 'text-danger-700')}>
                        {avgAll || '—'}
                    </p>
                </div>
            </div>

            {/* Employee Table */}
            {loading ? (
                <div className="flex justify-center py-12"><div className="w-8 h-8 border-4 border-accent-500 border-t-transparent rounded-full animate-spin" /></div>
            ) : error ? (
                <div className="bg-danger-50 border-2 border-dashed border-danger-300 rounded-2xl p-12 text-center text-danger-500">
                    <Users className="w-10 h-10 mx-auto mb-3 text-danger-300" />
                    <p className="font-semibold">{error}</p>
                    <p className="text-xs mt-2 text-danger-400">Kiểm tra console để xem chi tiết lỗi.</p>
                </div>
            ) : allEmployees.length === 0 ? (
                <div className="bg-white border-2 border-dashed border-surface-300 rounded-2xl p-12 text-center text-surface-400">
                    <Users className="w-10 h-10 mx-auto mb-3 text-surface-300" />
                    <p className="font-semibold">Không có nhân viên</p>
                    <p className="text-xs mt-2">Cửa hàng chưa có nhân viên nào.</p>
                </div>
            ) : (
                <>
                    <DataTableToolbar
                        searchValue={params.q}
                        onSearchChange={(v) => setParam('q', v)}
                        searchPlaceholder="Tìm nhân viên..."
                        filters={tableFilters}
                        filterValues={{ type: params.type || '', role: params.role || '' }}
                        onFilterChange={(key, value) => setParam(key, value)}
                        sortOptions={tableSortOptions}
                        currentSort={params.sort}
                        currentOrder={params.order}
                        onSortChange={toggleSort}
                        activeFilterCount={activeFilterCount}
                        onClearAll={clearAll}
                        onMobileApply={(values) => setParams(values)}
                    />

                    <div className="bg-white rounded-xl border border-surface-200 shadow-sm overflow-hidden">
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm">
                                <thead className="bg-surface-50 border-b border-surface-200">
                                    <tr>
                                        <th className="text-left p-3 font-semibold text-surface-600 w-8"></th>
                                        <th className="text-left p-3 font-semibold text-surface-600">#</th>
                                        <SortableHeader label="Nhân viên" field="name" currentSort={params.sort} currentOrder={params.order} onSort={toggleSort} className="text-left" />
                                        <th className="text-center p-3 font-semibold text-surface-600">Số lượt</th>
                                        <th className="text-center p-3 font-semibold text-surface-600">TB Tự chấm</th>
                                        <th className="text-center p-3 font-semibold text-surface-600">TB Chính thức</th>
                                        <th className="text-center p-3 font-semibold text-surface-600">Chênh lệch</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-surface-100">
                                    {paginatedEmployees.map((emp, i) => {
                                        const stats = getEmpStats(emp.uid);
                                        const hasRecords = stats.count > 0;
                                        const diff = stats.avgOfficial - stats.avgSelf;
                                        const isExpanded = expandedUid === emp.uid;
                                        const empRecords = filteredRecords
                                            .filter(r => r.userId === emp.uid)
                                            .sort((a, b) => b.date.localeCompare(a.date));

                                        return (
                                            <>
                                                <tr
                                                    key={emp.uid}
                                                    className={cn('hover:bg-surface-50/50 cursor-pointer transition-colors', isExpanded && 'bg-accent-50/30')}
                                                    onClick={() => hasRecords && setExpandedUid(isExpanded ? null : emp.uid)}
                                                >
                                                    <td className="p-3 text-surface-400">
                                                        {hasRecords ? (
                                                            isExpanded ? <ChevronDown className="w-4 h-4 text-accent-500" /> : <ChevronRight className="w-4 h-4" />
                                                        ) : null}
                                                    </td>
                                                    <td className="p-3 text-surface-400 font-bold">{(currentPage - 1) * currentPageSize + i + 1}</td>
                                                    <td className="p-3 font-medium text-surface-800">
                                                        <div className="flex items-center gap-2.5">
                                                            <div className={cn(
                                                                'w-8 h-8 rounded-full flex items-center justify-center text-[11px] font-bold shrink-0 overflow-hidden',
                                                                !emp.avatar && 'bg-gradient-to-br from-primary-400 to-accent-500 text-white'
                                                            )}>
                                                                {emp.avatar ? (
                                                                    // eslint-disable-next-line @next/next/no-img-element
                                                                    <img src={emp.avatar} alt={emp.name} className="w-full h-full object-cover" />
                                                                ) : (
                                                                    emp.name.split(' ').slice(-1)[0]?.[0]?.toUpperCase() || '?'
                                                                )}
                                                            </div>
                                                            <span
                                                                className={cn(
                                                                    hasPermission('action.hr.view_employee_profile') && 'cursor-pointer hover:underline'
                                                                )}
                                                                onClick={(e) => { if (hasPermission('action.hr.view_employee_profile')) { e.stopPropagation(); setProfileUid(emp.uid); } }}
                                                            >
                                                                {emp.name}
                                                            </span>
                                                        </div>
                                                    </td>
                                                    {hasRecords ? (
                                                        <>
                                                            <td className="p-3 text-center font-bold text-surface-600">{stats.count}</td>
                                                            <td className="p-3 text-center">
                                                                <span className={cn('font-bold', stats.avgSelf >= 80 ? 'text-success-600' : stats.avgSelf >= 50 ? 'text-warning-600' : 'text-danger-600')}>
                                                                    {stats.avgSelf}
                                                                </span>
                                                            </td>
                                                            <td className="p-3 text-center">
                                                                <span className={cn('font-bold', stats.avgOfficial >= 80 ? 'text-success-600' : stats.avgOfficial >= 50 ? 'text-warning-600' : 'text-danger-600')}>
                                                                    {stats.avgOfficial || '—'}
                                                                </span>
                                                            </td>
                                                            <td className="p-3 text-center">
                                                                {stats.officialCount > 0 ? (
                                                                    <span className={cn('text-xs font-bold flex items-center justify-center gap-0.5',
                                                                        diff > 0 ? 'text-success-500' : diff < 0 ? 'text-danger-500' : 'text-surface-400'
                                                                    )}>
                                                                        {diff > 0 ? <TrendingUp className="w-3 h-3" /> : diff < 0 ? <TrendingDown className="w-3 h-3" /> : null}
                                                                        {diff > 0 ? '+' : ''}{diff}
                                                                    </span>
                                                                ) : <span className="text-surface-300">—</span>}
                                                            </td>
                                                        </>
                                                    ) : (
                                                        <td colSpan={4} className="p-3 text-center">
                                                            <span className="text-surface-400 text-xs italic bg-surface-50 px-3 py-1 rounded-full">Chưa có điểm</span>
                                                        </td>
                                                    )}
                                                </tr>

                                                {/* Expanded detail rows */}
                                                {isExpanded && hasRecords && (
                                                    <tr key={`${emp.uid}-detail`}>
                                                        <td colSpan={7} className="p-0">
                                                            <div className="bg-surface-50/80 border-t border-b border-surface-200">
                                                                <div className="px-6 py-3">
                                                                    <p className="text-xs font-semibold text-surface-500 uppercase tracking-wider mb-2">
                                                                        Lịch sử chấm điểm — {emp.name}
                                                                    </p>
                                                                    {empRecords.length === 0 ? (
                                                                        <p className="text-sm text-surface-400 py-2">Không có bản ghi nào.</p>
                                                                    ) : (
                                                                        <div className="space-y-1.5">
                                                                            {empRecords.map((rec) => (
                                                                                <div
                                                                                    key={rec.id}
                                                                                    className="space-y-0"
                                                                                >
                                                                                    <button
                                                                                        onClick={() => setExpandedRecordId(expandedRecordId === rec.id ? null : rec.id)}
                                                                                        className={cn(
                                                                                            'w-full flex items-center gap-3 px-3 py-2 bg-white rounded-lg border text-xs transition-colors hover:bg-surface-50/70',
                                                                                            expandedRecordId === rec.id ? 'border-accent-200 bg-accent-50/30' : 'border-surface-100'
                                                                                        )}
                                                                                    >
                                                                                    {/* Status icon */}
                                                                                    {rec.status === 'OFFICIAL' ? (
                                                                                        <CheckCircle2 className="w-4 h-4 text-success-500 shrink-0" />
                                                                                    ) : (
                                                                                        <Clock className="w-4 h-4 text-warning-500 shrink-0" />
                                                                                    )}

                                                                                    {/* Date */}
                                                                                    <span className="font-semibold text-surface-700 min-w-[70px]">
                                                                                        {formatDate(rec.date)}
                                                                                    </span>

                                                                                    {/* Shift */}
                                                                                    <span className="px-1.5 py-0.5 bg-accent-50 text-accent-600 rounded font-medium truncate max-w-[80px]">
                                                                                        {rec.shiftId}
                                                                                    </span>

                                                                                    {/* Counter / Position */}
                                                                                    {rec.counterId && (
                                                                                        <span className="flex items-center gap-0.5 px-1.5 py-0.5 bg-violet-50 text-violet-600 rounded font-medium truncate max-w-[120px]">
                                                                                            <MapPin className="w-3 h-3 shrink-0" />
                                                                                            {counters.find(c => c.id === rec.counterId)?.name || rec.counterId}
                                                                                        </span>
                                                                                    )}

                                                                                    {/* Self score */}
                                                                                    <div className="flex items-center gap-1 ml-auto">
                                                                                        <span className="text-surface-400">Tự:</span>
                                                                                        <span className={cn('font-bold', rec.selfTotal >= 80 ? 'text-success-600' : rec.selfTotal >= 50 ? 'text-warning-600' : 'text-danger-600')}>
                                                                                            {rec.selfTotal}
                                                                                        </span>
                                                                                    </div>

                                                                                    {/* Official score */}
                                                                                    <div className="flex items-center gap-1">
                                                                                        <span className="text-surface-400">CT:</span>
                                                                                        {rec.status === 'OFFICIAL' ? (
                                                                                            <span className={cn('font-bold', rec.officialTotal >= 80 ? 'text-success-600' : rec.officialTotal >= 50 ? 'text-warning-600' : 'text-danger-600')}>
                                                                                                {rec.officialTotal}
                                                                                            </span>
                                                                                        ) : (
                                                                                            <span className="text-surface-300">—</span>
                                                                                        )}
                                                                                    </div>

                                                                                    {/* Status badge */}
                                                                                    <span className={cn(
                                                                                        'px-1.5 py-0.5 rounded text-[10px] font-bold uppercase shrink-0',
                                                                                        rec.status === 'OFFICIAL' ? 'bg-success-100 text-success-700' : 'bg-warning-100 text-warning-700'
                                                                                    )}>
                                                                                        {rec.status === 'OFFICIAL' ? 'Chính thức' : 'Tự chấm'}
                                                                                    </span>

                                                                                    <ChevronDown className={cn('w-3.5 h-3.5 text-surface-400 shrink-0 transition-transform', expandedRecordId === rec.id && 'rotate-180')} />
                                                                                    </button>

                                                                                    {/* Scorecard detail */}
                                                                                    {expandedRecordId === rec.id && rec.details && rec.details.length > 0 && (
                                                                                        <div className="ml-7 mt-1 mb-1 bg-white rounded-lg border border-surface-200 overflow-hidden">
                                                                                            <table className="w-full text-[11px]">
                                                                                                <thead className="bg-surface-50">
                                                                                                    <tr>
                                                                                                        <th className="text-left px-3 py-1.5 font-semibold text-surface-500">Tiêu chí</th>
                                                                                                        <th className="text-center px-2 py-1.5 font-semibold text-surface-500 w-16">Tự chấm</th>
                                                                                                        <th className="text-center px-2 py-1.5 font-semibold text-surface-500 w-16">CT</th>
                                                                                                        <th className="text-center px-2 py-1.5 font-semibold text-surface-500 w-12">Max</th>
                                                                                                    </tr>
                                                                                                </thead>
                                                                                                <tbody className="divide-y divide-surface-100">
                                                                                                    {rec.details.map((d, idx) => (
                                                                                                        <tr key={idx} className="hover:bg-surface-50/50">
                                                                                                            <td className="px-3 py-1.5 font-medium text-surface-700">{d.criteriaName}</td>
                                                                                                            <td className={cn('text-center px-2 py-1.5 font-bold', d.selfScore >= d.maxScore * 0.8 ? 'text-success-600' : d.selfScore >= d.maxScore * 0.5 ? 'text-warning-600' : 'text-danger-600')}>{d.selfScore}</td>
                                                                                                            <td className={cn('text-center px-2 py-1.5 font-bold', rec.status === 'OFFICIAL' ? (d.officialScore >= d.maxScore * 0.8 ? 'text-success-600' : d.officialScore >= d.maxScore * 0.5 ? 'text-warning-600' : 'text-danger-600') : 'text-surface-300')}>{rec.status === 'OFFICIAL' ? d.officialScore : '—'}</td>
                                                                                                            <td className="text-center px-2 py-1.5 text-surface-400 font-medium">{d.maxScore}</td>
                                                                                                        </tr>
                                                                                                    ))}
                                                                                                    <tr className="bg-surface-50 font-bold">
                                                                                                        <td className="px-3 py-1.5 text-surface-700">Tổng</td>
                                                                                                        <td className="text-center px-2 py-1.5 text-surface-700">{rec.selfTotal}</td>
                                                                                                        <td className="text-center px-2 py-1.5 text-surface-700">{rec.status === 'OFFICIAL' ? rec.officialTotal : '—'}</td>
                                                                                                        <td className="text-center px-2 py-1.5 text-surface-400">{rec.details.reduce((s, d) => s + d.maxScore, 0)}</td>
                                                                                                    </tr>
                                                                                                </tbody>
                                                                                            </table>
                                                                                        </div>
                                                                                    )}
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
                        totalItems={processedEmployees.length}
                        page={currentPage}
                        pageSize={currentPageSize}
                        onPageChange={setPage}
                        onPageSizeChange={setPageSize}
                    />
                </>
            )}

            {/* Export Dialog Modal */}
            {showExportDialog && (
                <Portal>
                    <div className="fixed inset-0 z-[110] flex items-center justify-center bg-black/40 backdrop-blur-sm" onClick={() => setShowExportDialog(false)}>
                        <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[85vh] overflow-hidden" onClick={e => e.stopPropagation()}>
                            {/* Header */}
                            <div className="flex items-center justify-between px-6 py-4 border-b border-surface-200">
                                <h3 className="text-lg font-bold text-surface-800 flex items-center gap-2">
                                    <Download className="w-5 h-5 text-accent-600" />
                                    Xuất Excel chi tiết
                                </h3>
                                <button onClick={() => setShowExportDialog(false)} className="p-1 rounded-lg hover:bg-surface-100 transition-colors">
                                    <X className="w-5 h-5 text-surface-400" />
                                </button>
                            </div>

                            <div className="px-6 py-4 space-y-5 overflow-y-auto max-h-[calc(85vh-130px)]">
                                {/* Date Mode */}
                                <div>
                                    <label className="text-xs font-bold text-surface-500 uppercase tracking-wider mb-2 block">Phạm vi thời gian</label>
                                    <div className="flex gap-2 mb-3">
                                        <button
                                            onClick={() => setExportDateMode('month')}
                                            className={cn('flex-1 px-3 py-2 rounded-lg text-sm font-semibold border transition-colors',
                                                exportDateMode === 'month' ? 'bg-accent-50 border-accent-300 text-accent-700' : 'bg-white border-surface-200 text-surface-600 hover:bg-surface-50'
                                            )}
                                        >
                                            <Calendar className="w-4 h-4 inline mr-1" />Theo tháng
                                        </button>
                                        <button
                                            onClick={() => setExportDateMode('range')}
                                            className={cn('flex-1 px-3 py-2 rounded-lg text-sm font-semibold border transition-colors',
                                                exportDateMode === 'range' ? 'bg-accent-50 border-accent-300 text-accent-700' : 'bg-white border-surface-200 text-surface-600 hover:bg-surface-50'
                                            )}
                                        >
                                            <Calendar className="w-4 h-4 inline mr-1" />Tùy chỉnh
                                        </button>
                                    </div>
                                    {exportDateMode === 'month' ? (
                                        <input type="month" value={exportMonth} onChange={e => setExportMonth(e.target.value)}
                                            className="w-full border border-surface-200 rounded-lg p-2.5 text-sm outline-none focus:ring-2 focus:ring-accent-300" />
                                    ) : (
                                        <div className="flex gap-2">
                                            <div className="flex-1">
                                                <label className="text-[10px] text-surface-400 font-medium">Từ ngày</label>
                                                <input type="date" value={exportDateFrom} onChange={e => setExportDateFrom(e.target.value)}
                                                    className="w-full border border-surface-200 rounded-lg p-2.5 text-sm outline-none focus:ring-2 focus:ring-accent-300" />
                                            </div>
                                            <div className="flex-1">
                                                <label className="text-[10px] text-surface-400 font-medium">Đến ngày</label>
                                                <input type="date" value={exportDateTo} onChange={e => setExportDateTo(e.target.value)}
                                                    className="w-full border border-surface-200 rounded-lg p-2.5 text-sm outline-none focus:ring-2 focus:ring-accent-300" />
                                            </div>
                                        </div>
                                    )}
                                </div>

                                {/* Employee Selection */}
                                <div>
                                    <div className="flex items-center justify-between mb-2">
                                        <label className="text-xs font-bold text-surface-500 uppercase tracking-wider">Chọn nhân viên</label>
                                        <button onClick={handleToggleSelectAll}
                                            className="text-xs font-semibold text-accent-600 hover:text-accent-800 flex items-center gap-1">
                                            <UserCheck className="w-3.5 h-3.5" />
                                            {exportSelectAll ? 'Bỏ chọn tất cả' : 'Chọn tất cả'}
                                        </button>
                                    </div>
                                    <div className="border border-surface-200 rounded-xl max-h-[200px] overflow-y-auto divide-y divide-surface-100">
                                        {allEmployees.map(emp => (
                                            <label key={emp.uid} className="flex items-center gap-3 px-3 py-2.5 hover:bg-surface-50 cursor-pointer transition-colors">
                                                <input
                                                    type="checkbox"
                                                    checked={exportSelectedUids.has(emp.uid)}
                                                    onChange={() => handleToggleEmployee(emp.uid)}
                                                    className="w-4 h-4 rounded border-surface-300 text-accent-600 focus:ring-accent-500"
                                                />
                                                <span className="text-sm font-medium text-surface-700">{emp.name}</span>
                                            </label>
                                        ))}
                                    </div>
                                    <p className="text-[10px] text-surface-400 mt-1.5">
                                        Đã chọn {exportSelectedUids.size}/{allEmployees.length} nhân viên
                                    </p>
                                </div>

                                {/* Info */}
                                <div className="bg-accent-50 rounded-lg p-3 text-xs text-accent-700">
                                    <p className="font-semibold mb-0.5">Lưu ý:</p>
                                    <p>Chỉ xuất các bản ghi đã chấm <strong>chính thức</strong>. Mỗi dòng là một lượt chấm điểm với từng cột tiêu chí và người chấm.</p>
                                </div>
                            </div>

                            {/* Footer */}
                            <div className="px-6 py-4 border-t border-surface-200 flex justify-end gap-2">
                                <button onClick={() => setShowExportDialog(false)}
                                    className="px-4 py-2 rounded-lg text-sm font-semibold text-surface-600 hover:bg-surface-100 transition-colors">
                                    Hủy
                                </button>
                                <button
                                    onClick={handleDetailedExport}
                                    disabled={exportLoading || exportSelectedUids.size === 0}
                                    className="px-4 py-2 rounded-lg text-sm font-bold bg-accent-600 text-white hover:bg-accent-700 disabled:opacity-50 transition-colors flex items-center gap-1.5"
                                >
                                    {exportLoading ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> : <FileSpreadsheet className="w-4 h-4" />}
                                    Xuất Excel
                                </button>
                            </div>
                        </div>
                    </div>
                </Portal>
            )}

            {profileUid && (
                <EmployeeProfilePopup
                    employeeUid={profileUid}
                    storeId={effectiveStoreId}
                    onClose={() => setProfileUid(null)}
                />
            )}
        </div>
    );
}

export default function ManagerKpiStatsPage() {
    return (
        <Suspense fallback={
            <div className="flex justify-center py-12">
                <div className="w-8 h-8 border-4 border-accent-500 border-t-transparent rounded-full animate-spin" />
            </div>
        }>
            <ManagerKpiStatsPageContent />
        </Suspense>
    );
}
