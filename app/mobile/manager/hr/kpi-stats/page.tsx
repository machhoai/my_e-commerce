'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { db } from '@/lib/firebase';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { UserDoc, KpiRecordDoc, StoreDoc } from '@/types';
import { cn } from '@/lib/utils';
import { exportKpiToPdf, exportKpiToExcel, exportKpiDetailedExcel, KpiDetailedRecord } from '@/lib/kpi-export';
import {
    BarChart3, Calendar, Building2, FileSpreadsheet, FileType,
    TrendingUp, TrendingDown, Users, Award, ChevronDown, ChevronLeft, ChevronRight,
    CheckCircle2, Clock, Filter, Download, UserCheck, Search,
    AlertTriangle, Loader2, X, ChevronUp, ArrowUpDown,
} from 'lucide-react';
import MobilePageShell from '@/components/mobile/MobilePageShell';
import BottomSheet from '@/components/shared/BottomSheet';

// ── Helpers ─────────────────────────────────────────────────────────────────
function scoreColor(v: number) {
    if (v >= 80) return 'text-emerald-700';
    if (v >= 50) return 'text-amber-700';
    return 'text-red-600';
}
function scoreBg(v: number) {
    if (v >= 80) return 'bg-emerald-50 border-emerald-200';
    if (v >= 50) return 'bg-amber-50 border-amber-200';
    return 'bg-red-50 border-red-200';
}
function fmtDate(d: string) {
    try { const [y, m, day] = d.split('-'); return `${day}/${m}`; } catch { return d; }
}
function monthLabel(m: string) {
    try {
        const d = new Date(m + '-01T00:00:00');
        return d.toLocaleDateString('vi-VN', { month: 'long', year: 'numeric' });
    } catch { return m; }
}

export default function MobileKpiStatsPage() {
    const { user, userDoc, getToken, hasPermission } = useAuth();

    // ── Month navigation ─────────────────────────────────────────────────────
    const [selectedMonth, setSelectedMonth] = useState(() => {
        const now = new Date();
        return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    });
    const navigateMonth = (dir: number) => {
        const [y, m] = selectedMonth.split('-').map(Number);
        const d = new Date(y, m - 1 + dir, 1);
        setSelectedMonth(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
    };

    // ── Store selector ───────────────────────────────────────────────────────
    const [stores, setStores] = useState<StoreDoc[]>([]);
    const [selectedStoreId, setSelectedStoreId] = useState(() => {
        if (typeof window !== 'undefined') return localStorage.getItem('globalSelectedStoreId') || '';
        return '';
    });
    const [storeSheetOpen, setStoreSheetOpen] = useState(false);
    const effectiveStoreId = userDoc?.role === 'admin' ? selectedStoreId : userDoc?.storeId ?? '';

    // ── Data ─────────────────────────────────────────────────────────────────
    const [records, setRecords] = useState<KpiRecordDoc[]>([]);
    const [allEmployees, setAllEmployees] = useState<UserDoc[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [exporting, setExporting] = useState('');

    // ── UI states ────────────────────────────────────────────────────────────
    const [statusFilter, setStatusFilter] = useState<'' | 'SELF_SCORED' | 'OFFICIAL'>('');
    const [sortBy, setSortBy] = useState<'official_desc' | 'official_asc' | 'self_desc' | 'self_asc' | 'name_asc' | 'count_desc'>('official_desc');
    const [search, setSearch] = useState('');
    const [expandedUid, setExpandedUid] = useState<string | null>(null);
    const [filterSheetOpen, setFilterSheetOpen] = useState(false);
    const [exportSheetOpen, setExportSheetOpen] = useState(false);

    // ── Export state ─────────────────────────────────────────────────────────
    const [exportDateMode, setExportDateMode] = useState<'month' | 'range'>('month');
    const [exportMonth, setExportMonth] = useState(selectedMonth);
    const [exportDateFrom, setExportDateFrom] = useState('');
    const [exportDateTo, setExportDateTo] = useState('');
    const [exportSelectedUids, setExportSelectedUids] = useState<Set<string>>(new Set());
    const [exportSelectAll, setExportSelectAll] = useState(true);
    const [exportLoading, setExportLoading] = useState(false);

    // ── Fetch admin stores ───────────────────────────────────────────────────
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

    // ── Fetch employees + KPI records ────────────────────────────────────────
    useEffect(() => {
        if (!effectiveStoreId || !user) return;
        (async () => {
            setLoading(true); setError('');
            try {
                const token = await getToken();
                const recRes = await fetch(`/api/kpi-records?storeId=${effectiveStoreId}&month=${selectedMonth}`, { headers: { Authorization: `Bearer ${token}` } });
                const recData = await recRes.json();
                if (!recRes.ok) { setError(recData?.error || `Lỗi ${recRes.status}`); setRecords([]); return; }
                setRecords(Array.isArray(recData) ? recData : []);
                const empQuery = query(collection(db, 'users'), where('storeId', '==', effectiveStoreId), where('isActive', '==', true));
                const empSnap = await getDocs(empQuery);
                setAllEmployees(empSnap.docs.map(d => d.data() as UserDoc).filter(u => u.role !== 'admin').sort((a, b) => a.name.localeCompare(b.name)));
            } catch { setError('Không thể tải dữ liệu KPI.'); }
            finally { setLoading(false); }
        })();
    }, [effectiveStoreId, selectedMonth, user, getToken]);

    // ── Computed ──────────────────────────────────────────────────────────────
    const filteredRecords = statusFilter ? records.filter(r => r.status === statusFilter) : records;

    const getEmpStats = useCallback((uid: string) => {
        const empRecs = filteredRecords.filter(r => r.userId === uid);
        const official = empRecs.filter(r => r.status === 'OFFICIAL');
        return {
            count: empRecs.length,
            avgSelf: empRecs.length ? Math.round(empRecs.reduce((s, r) => s + r.selfTotal, 0) / empRecs.length) : 0,
            avgOfficial: official.length ? Math.round(official.reduce((s, r) => s + r.officialTotal, 0) / official.length) : 0,
            officialCount: official.length,
        };
    }, [filteredRecords]);

    const filteredEmployees = useMemo(() => {
        let list = allEmployees;
        if (search.trim()) { const q = search.trim().toLowerCase(); list = list.filter(e => e.name.toLowerCase().includes(q)); }
        // Sort
        return [...list].sort((a, b) => {
            const sa = getEmpStats(a.uid);
            const sb = getEmpStats(b.uid);
            switch (sortBy) {
                case 'official_desc': return sb.avgOfficial - sa.avgOfficial || sb.avgSelf - sa.avgSelf;
                case 'official_asc': return sa.avgOfficial - sb.avgOfficial || sa.avgSelf - sb.avgSelf;
                case 'self_desc': return sb.avgSelf - sa.avgSelf;
                case 'self_asc': return sa.avgSelf - sb.avgSelf;
                case 'name_asc': return a.name.localeCompare(b.name);
                case 'count_desc': return sb.count - sa.count;
                default: return 0;
            }
        });
    }, [allEmployees, search, sortBy, getEmpStats]);

    const totalRecords = filteredRecords.length;
    const officialRecords = filteredRecords.filter(r => r.status === 'OFFICIAL');
    const avgAll = officialRecords.length ? Math.round(officialRecords.reduce((s, r) => s + r.officialTotal, 0) / officialRecords.length) : 0;
    const activeFilterCount = (statusFilter ? 1 : 0) + (sortBy !== 'official_desc' ? 1 : 0);

    // ── Export handlers ──────────────────────────────────────────────────────
    const handleExportPdf = async () => {
        setExporting('pdf');
        try {
            const rows = allEmployees.map(emp => { const s = getEmpStats(emp.uid); return { name: emp.name, count: s.count, avgSelf: s.avgSelf, avgOfficial: s.avgOfficial }; });
            exportKpiToPdf(rows, selectedMonth);
        } finally { setExporting(''); }
    };
    const handleExportExcel = async () => {
        setExporting('excel');
        try {
            const rows = allEmployees.map(emp => { const s = getEmpStats(emp.uid); return { name: emp.name, count: s.count, avgSelf: s.avgSelf, avgOfficial: s.avgOfficial }; });
            exportKpiToExcel(rows, selectedMonth);
        } finally { setExporting(''); }
    };

    const handleOpenExportDialog = () => {
        setExportMonth(selectedMonth); setExportDateMode('month');
        setExportDateFrom(''); setExportDateTo('');
        setExportSelectAll(true); setExportSelectedUids(new Set(allEmployees.map(e => e.uid)));
        setExportSheetOpen(true);
    };

    const handleDetailedExport = async () => {
        setExportLoading(true);
        try {
            const token = await getToken();
            let fetchUrl = `/api/kpi-records?storeId=${effectiveStoreId}`;
            let label = '';
            if (exportDateMode === 'month') { fetchUrl += `&month=${exportMonth}`; label = exportMonth; }
            else { if (!exportDateFrom || !exportDateTo) { alert('Chọn ngày'); return; } fetchUrl += `&dateFrom=${exportDateFrom}&dateTo=${exportDateTo}`; label = `${exportDateFrom}_${exportDateTo}`; }
            const res = await fetch(fetchUrl, { headers: { Authorization: `Bearer ${token}` } });
            const data: KpiRecordDoc[] = await res.json();
            if (!res.ok) { alert('Lỗi tải dữ liệu'); return; }
            const officialRecs = data.filter(r => r.status === 'OFFICIAL' && exportSelectedUids.has(r.userId));
            if (!officialRecs.length) { alert('Không có bản ghi chính thức nào.'); return; }
            const scorerUids = [...new Set(officialRecs.map(r => r.scoredByUserId).filter(Boolean) as string[])];
            const scorerMap = new Map<string, string>(); allEmployees.forEach(e => scorerMap.set(e.uid, e.name));
            const missing = scorerUids.filter(uid => !scorerMap.has(uid));
            for (let i = 0; i < missing.length; i += 10) {
                const chunk = missing.slice(i, i + 10); if (!chunk.length) break;
                const uSnap = await getDocs(query(collection(db, 'users'), where('uid', 'in', chunk)));
                uSnap.docs.forEach(d => { const u = d.data() as UserDoc; scorerMap.set(u.uid, u.name); });
            }
            const empMap = new Map(allEmployees.map(e => [e.uid, e.name]));
            const detailed: KpiDetailedRecord[] = officialRecs
                .sort((a, b) => a.userId.localeCompare(b.userId) || a.date.localeCompare(b.date))
                .map(r => ({ employeeName: empMap.get(r.userId) || r.userId, date: r.date, shiftId: r.shiftId, criteriaScores: r.details.map(d => ({ name: d.criteriaName, officialScore: d.officialScore, maxScore: d.maxScore })), officialTotal: r.officialTotal, scorerName: r.scoredByUserId ? (scorerMap.get(r.scoredByUserId) || r.scoredByUserId) : '' }));
            exportKpiDetailedExcel(detailed, label);
            setExportSheetOpen(false);
        } catch { alert('Xuất file thất bại'); }
        finally { setExportLoading(false); }
    };

    // ── Guards ────────────────────────────────────────────────────────────────
    if (userDoc && !hasPermission('page.hr.kpi_stats')) {
        return (
            <MobilePageShell title="KPI thống kê">
                <div className="p-8 text-center"><AlertTriangle className="w-8 h-8 text-red-400 mx-auto mb-2" /><p className="text-sm text-red-600 font-bold">Không có quyền truy cập</p></div>
            </MobilePageShell>
        );
    }

    const selectedStore = stores.find(s => s.id === selectedStoreId);

    return (
        <MobilePageShell title="KPI thống kê" headerRight={
            (hasPermission('action.export.kpi') || userDoc?.role === 'admin' || userDoc?.role === 'store_manager') ? (
                <button onClick={handleOpenExportDialog} className="w-8 h-8 rounded-lg bg-gray-100 flex items-center justify-center active:scale-95 transition-transform">
                    <Download className="w-4 h-4 text-gray-600" />
                </button>
            ) : undefined
        }>
            {/* ── Admin store selector ─────────────────────────────────── */}
            {userDoc?.role === 'admin' && (
                <button onClick={() => setStoreSheetOpen(true)}
                    className="w-full flex items-center gap-2 px-3 py-2 bg-white rounded-lg border border-gray-200 shadow-sm mb-3 active:scale-[0.99] transition-all">
                    <Building2 className="w-3.5 h-3.5 text-primary-500 shrink-0" />
                    <span className="flex-1 text-left text-xs font-bold text-gray-700 truncate">{selectedStore?.name || 'Chọn cửa hàng'}</span>
                    <ChevronDown className="w-3.5 h-3.5 text-gray-400" />
                </button>
            )}

            {/* ── Month navigation ─────────────────────────────────────── */}
            <div className="flex items-center gap-1 mb-3">
                <button onClick={() => navigateMonth(-1)} className="w-8 h-8 rounded-lg bg-white border border-gray-200 flex items-center justify-center active:scale-95">
                    <ChevronLeft className="w-4 h-4 text-gray-500" />
                </button>
                <div className="flex-1 text-center">
                    <p className="text-xs font-bold text-gray-700 capitalize">{monthLabel(selectedMonth)}</p>
                </div>
                <button onClick={() => navigateMonth(1)} className="w-8 h-8 rounded-lg bg-white border border-gray-200 flex items-center justify-center active:scale-95">
                    <ChevronRight className="w-4 h-4 text-gray-500" />
                </button>
            </div>

            {/* ── Summary cards ────────────────────────────────────────── */}
            <div className="grid grid-cols-3 gap-2 mb-3">
                <div className="bg-gradient-to-br from-primary-50 to-blue-50 rounded-xl border border-primary-100 p-3">
                    <Users className="w-3.5 h-3.5 text-primary-500 mb-1" />
                    <p className="text-xl font-black text-primary-800">{allEmployees.length}</p>
                    <p className="text-[8px] font-bold text-primary-400 uppercase">Nhân viên</p>
                </div>
                <div className="bg-gradient-to-br from-teal-50 to-emerald-50 rounded-xl border border-teal-100 p-3">
                    <Award className="w-3.5 h-3.5 text-teal-500 mb-1" />
                    <p className="text-xl font-black text-teal-800">{totalRecords}</p>
                    <p className="text-[8px] font-bold text-teal-400 uppercase">Lượt chấm</p>
                </div>
                <div className={cn('rounded-xl border p-3', scoreBg(avgAll))}>
                    <TrendingUp className="w-3.5 h-3.5 text-gray-400 mb-1" />
                    <p className={cn('text-xl font-black', scoreColor(avgAll))}>{avgAll || '—'}</p>
                    <p className="text-[8px] font-bold text-gray-400 uppercase">TB Chính thức</p>
                </div>
            </div>

            {/* ── Search + Filter ──────────────────────────────────────── */}
            <div className="flex items-center gap-2 mb-3">
                <div className="relative flex h-full flex-1">
                    <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400 pointer-events-none" />
                    <input value={search} onChange={e => setSearch(e.target.value)}
                        placeholder="Tìm nhân viên..."
                        className="w-full pl-8 pr-3 py-2 border border-gray-200 rounded-lg bg-white text-[11px] text-gray-700 outline-none focus:border-primary-400" />
                    {search && <button onClick={() => setSearch('')} className="absolute right-2 top-1/2 -translate-y-1/2"><X className="w-3 h-3 text-gray-400" /></button>}
                </div>
                <button onClick={() => setFilterSheetOpen(true)}
                    className={cn('relative w-9 h-9 rounded-lg border flex items-center justify-center shrink-0',
                        activeFilterCount > 0 ? 'bg-primary-50 border-primary-200 text-primary-600' : 'bg-white border-gray-200 text-gray-500')}>
                    <Filter className="w-4 h-4" />
                    {activeFilterCount > 0 && <span className="absolute -top-1 -right-1 w-4 h-4 bg-primary-600 text-white text-[8px] font-bold rounded-full flex items-center justify-center">{activeFilterCount}</span>}
                </button>
                {/* Quick export buttons */}
                {(hasPermission('action.export.kpi') || userDoc?.role === 'admin' || userDoc?.role === 'store_manager') && filteredRecords.length > 0 && (
                    <div className="flex gap-1">
                        <button onClick={handleExportPdf} disabled={!!exporting}
                            className="w-9 h-9 rounded-lg border border-red-200 bg-red-50 flex items-center justify-center disabled:opacity-40 active:scale-95">
                            {exporting === 'pdf' ? <Loader2 className="w-3.5 h-3.5 animate-spin text-red-500" /> : <FileType className="w-3.5 h-3.5 text-red-600" />}
                        </button>
                        <button onClick={handleExportExcel} disabled={!!exporting}
                            className="w-9 h-9 rounded-lg border border-emerald-200 bg-emerald-50 flex items-center justify-center disabled:opacity-40 active:scale-95">
                            {exporting === 'excel' ? <Loader2 className="w-3.5 h-3.5 animate-spin text-emerald-500" /> : <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600" />}
                        </button>
                    </div>
                )}
            </div>

            {/* ── Loading ──────────────────────────────────────────────── */}
            {loading && (
                <div className="flex flex-col items-center py-16">
                    <div className="w-6 h-6 border-2 border-primary-200 border-t-primary-600 rounded-full animate-spin mb-2" />
                    <p className="text-[11px] text-gray-500">Đang tải dữ liệu KPI...</p>
                </div>
            )}

            {/* ── Error ───────────────────────────────────────────────── */}
            {error && (
                <div className="flex items-center gap-2 bg-red-50 border border-red-200 rounded-lg px-3 py-2 mb-3">
                    <AlertTriangle className="w-3.5 h-3.5 text-red-500 shrink-0" />
                    <p className="text-[11px] font-medium text-red-700">{error}</p>
                </div>
            )}

            {/* ── Empty ───────────────────────────────────────────────── */}
            {!loading && !error && allEmployees.length === 0 && (
                <div className="text-center py-16">
                    <Users className="w-8 h-8 text-gray-300 mx-auto mb-2" />
                    <p className="text-xs font-semibold text-gray-500">Không có nhân viên</p>
                </div>
            )}

            {/* ═══ EMPLOYEE LIST ═══ */}
            {!loading && !error && filteredEmployees.length > 0 && (
                <div className="space-y-2">
                    {filteredEmployees.map((emp, i) => {
                        const stats = getEmpStats(emp.uid);
                        const hasRecs = stats.count > 0;
                        const diff = stats.avgOfficial - stats.avgSelf;
                        const isExpanded = expandedUid === emp.uid;
                        const empRecords = filteredRecords.filter(r => r.userId === emp.uid).sort((a, b) => b.date.localeCompare(a.date));

                        return (
                            <div key={emp.uid} className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
                                {/* Employee row */}
                                <button
                                    onClick={() => hasRecs && setExpandedUid(isExpanded ? null : emp.uid)}
                                    className="w-full flex items-center gap-2.5 px-3 py-2.5 active:bg-gray-50 transition-colors"
                                >
                                    {/* Rank */}
                                    <span className={cn('w-6 h-6 rounded-md flex items-center justify-center text-[9px] font-black text-white shrink-0',
                                        i < 3 && hasRecs ? 'bg-primary-500' : 'bg-gray-300')}>
                                        {i + 1}
                                    </span>

                                    {/* Name + role */}
                                    <div className="flex-1 min-w-0 text-left">
                                        <p className="text-[11px] font-bold text-gray-800 truncate">{emp.name}</p>
                                        <p className="text-[9px] text-gray-400">{emp.type === 'FT' ? 'Toàn thời gian' : 'Bán thời gian'}</p>
                                    </div>

                                    {/* Scores */}
                                    {hasRecs ? (
                                        <div className="flex items-center gap-2 shrink-0">
                                            <div className="text-right">
                                                <p className={cn('text-xs font-black', scoreColor(stats.avgOfficial || stats.avgSelf))}>{stats.avgOfficial || stats.avgSelf}</p>
                                                <p className="text-[8px] text-gray-400">{stats.officialCount > 0 ? 'Chính thức' : 'Tự chấm'}</p>
                                            </div>
                                            {stats.officialCount > 0 && diff !== 0 && (
                                                <span className={cn('flex items-center gap-0.5 text-[9px] font-bold px-1 py-0.5 rounded',
                                                    diff > 0 ? 'text-emerald-600 bg-emerald-50' : 'text-red-600 bg-red-50')}>
                                                    {diff > 0 ? <TrendingUp className="w-2.5 h-2.5" /> : <TrendingDown className="w-2.5 h-2.5" />}
                                                    {diff > 0 ? '+' : ''}{diff}
                                                </span>
                                            )}
                                            <span className="text-[9px] font-bold text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded-full">{stats.count}</span>
                                            {isExpanded ? <ChevronUp className="w-3.5 h-3.5 text-gray-400" /> : <ChevronDown className="w-3.5 h-3.5 text-gray-400" />}
                                        </div>
                                    ) : (
                                        <span className="text-[9px] text-gray-400 italic bg-gray-50 px-2 py-0.5 rounded-full">Chưa có điểm</span>
                                    )}
                                </button>

                                {/* Expanded history */}
                                {isExpanded && hasRecs && (
                                    <div className="border-t border-gray-100 bg-gray-50/50 px-3 py-2 space-y-1.5">
                                        <p className="text-[9px] font-bold text-gray-400 uppercase">Lịch sử chấm điểm</p>
                                        {empRecords.map(rec => (
                                            <div key={rec.id} className="flex items-center gap-2 bg-white rounded-lg border border-gray-100 px-2.5 py-2">
                                                {rec.status === 'OFFICIAL'
                                                    ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                                                    : <Clock className="w-3.5 h-3.5 text-amber-500 shrink-0" />}
                                                <span className="text-[10px] font-bold text-gray-700 min-w-[35px]">{fmtDate(rec.date)}</span>
                                                <span className="text-[9px] font-medium text-primary-600 bg-primary-50 px-1.5 py-0.5 rounded truncate max-w-[60px]">{rec.shiftId}</span>
                                                <div className="flex items-center gap-1.5 ml-auto shrink-0">
                                                    <div className="text-right">
                                                        <span className="text-[8px] text-gray-400">Tự: </span>
                                                        <span className={cn('text-[10px] font-bold', scoreColor(rec.selfTotal))}>{rec.selfTotal}</span>
                                                    </div>
                                                    {rec.status === 'OFFICIAL' && (
                                                        <div className="text-right">
                                                            <span className="text-[8px] text-gray-400">CT: </span>
                                                            <span className={cn('text-[10px] font-bold', scoreColor(rec.officialTotal))}>{rec.officialTotal}</span>
                                                        </div>
                                                    )}
                                                    <span className={cn('px-1 py-0.5 rounded text-[7px] font-black uppercase',
                                                        rec.status === 'OFFICIAL' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700')}>
                                                        {rec.status === 'OFFICIAL' ? 'CT' : 'TC'}
                                                    </span>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
            )}

            {/* ═══ FILTER BOTTOMSHEET ═══ */}
            <BottomSheet isOpen={filterSheetOpen} onClose={() => setFilterSheetOpen(false)} title="Bộ lọc">
                <div className="space-y-4 px-4 pb-6">
                    {/* Sort */}
                    <div>
                        <label className="text-[10px] font-bold text-gray-500 uppercase mb-2 flex items-center gap-1"><ArrowUpDown className="w-3 h-3" />Sắp xếp</label>
                        <div className="flex flex-wrap gap-1.5">
                            {([['official_desc', 'CT cao → thấp'], ['official_asc', 'CT thấp → cao'], ['self_desc', 'Tự chấm cao → thấp'], ['self_asc', 'Tự chấm thấp → cao'], ['name_asc', 'Tên A → Z'], ['count_desc', 'Nhiều lượt nhất']] as [typeof sortBy, string][]).map(([val, label]) => (
                                <button key={val} onClick={() => setSortBy(val)}
                                    className={cn('px-2.5 py-1.5 rounded-lg text-[10px] font-bold border transition-all',
                                        sortBy === val ? 'bg-primary-600 text-white border-primary-600' : 'bg-white border-gray-200 text-gray-600')}>
                                    {label}
                                </button>
                            ))}
                        </div>
                    </div>
                    {/* Status filter */}
                    <div>
                        <label className="text-[10px] font-bold text-gray-500 uppercase mb-2 block">Trạng thái</label>
                        <div className="flex flex-wrap gap-1.5">
                            {([['', 'Tất cả'], ['SELF_SCORED', 'Tự chấm'], ['OFFICIAL', 'Chính thức']] as ['' | 'SELF_SCORED' | 'OFFICIAL', string][]).map(([val, label]) => (
                                <button key={val} onClick={() => setStatusFilter(val)}
                                    className={cn('px-3 py-2 rounded-lg text-[11px] font-bold border transition-all',
                                        statusFilter === val ? 'bg-primary-600 text-white border-primary-600' : 'bg-white border-gray-200 text-gray-600')}>
                                    {label}
                                </button>
                            ))}
                        </div>
                    </div>
                    <div className="flex gap-2 pt-2">
                        {activeFilterCount > 0 && (
                            <button onClick={() => { setStatusFilter(''); setSortBy('official_desc'); setFilterSheetOpen(false); }}
                                className="flex-1 py-2.5 rounded-lg border border-gray-200 text-xs font-bold text-gray-600">Xóa lọc</button>
                        )}
                        <button onClick={() => setFilterSheetOpen(false)}
                            className="flex-1 py-2.5 rounded-lg bg-primary-600 text-white text-xs font-bold shadow-sm">Áp dụng</button>
                    </div>
                </div>
            </BottomSheet>

            {/* ═══ STORE SELECTOR BOTTOMSHEET ═══ */}
            <BottomSheet isOpen={storeSheetOpen} onClose={() => setStoreSheetOpen(false)} title="Chọn cửa hàng">
                <div className="px-4 pb-6 space-y-1.5">
                    {stores.map(s => (
                        <button key={s.id} onClick={() => { setSelectedStoreId(s.id); setStoreSheetOpen(false); }}
                            className={cn('w-full text-left px-3 py-2.5 rounded-lg border transition-all',
                                selectedStoreId === s.id ? 'bg-primary-50 border-primary-200 text-primary-700' : 'bg-white border-gray-100 text-gray-700')}>
                            <p className="text-xs font-bold">{(s as any).type === 'OFFICE' ? '🏢' : (s as any).type === 'CENTRAL' ? '🏭' : '🏪'} {s.name}</p>
                        </button>
                    ))}
                </div>
            </BottomSheet>

            {/* ═══ EXPORT BOTTOMSHEET ═══ */}
            <BottomSheet isOpen={exportSheetOpen} onClose={() => setExportSheetOpen(false)} title="Xuất Excel chi tiết">
                <div className="px-4 pb-6 space-y-4">
                    {/* Date mode */}
                    <div>
                        <label className="text-[10px] font-bold text-gray-500 uppercase mb-2 block">Phạm vi</label>
                        <div className="flex gap-1.5 mb-2">
                            <button onClick={() => setExportDateMode('month')}
                                className={cn('flex-1 py-2 rounded-lg text-[11px] font-bold border',
                                    exportDateMode === 'month' ? 'bg-primary-50 border-primary-200 text-primary-700' : 'bg-white border-gray-200 text-gray-600')}>
                                Theo tháng
                            </button>
                            <button onClick={() => setExportDateMode('range')}
                                className={cn('flex-1 py-2 rounded-lg text-[11px] font-bold border',
                                    exportDateMode === 'range' ? 'bg-primary-50 border-primary-200 text-primary-700' : 'bg-white border-gray-200 text-gray-600')}>
                                Tuỳ chỉnh
                            </button>
                        </div>
                        {exportDateMode === 'month' ? (
                            <input type="month" value={exportMonth} onChange={e => setExportMonth(e.target.value)}
                                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-xs outline-none bg-gray-50" />
                        ) : (
                            <div className="flex gap-1.5">
                                <input type="date" value={exportDateFrom} onChange={e => setExportDateFrom(e.target.value)}
                                    className="flex-1 border border-gray-200 rounded-lg px-2 py-2 text-[11px] outline-none bg-gray-50" />
                                <span className="text-gray-300 self-center text-xs">→</span>
                                <input type="date" value={exportDateTo} onChange={e => setExportDateTo(e.target.value)}
                                    className="flex-1 border border-gray-200 rounded-lg px-2 py-2 text-[11px] outline-none bg-gray-50" />
                            </div>
                        )}
                    </div>

                    {/* Employee selection */}
                    <div>
                        <div className="flex items-center justify-between mb-2">
                            <label className="text-[10px] font-bold text-gray-500 uppercase">Nhân viên</label>
                            <button onClick={() => {
                                if (exportSelectAll) { setExportSelectedUids(new Set()); setExportSelectAll(false); }
                                else { setExportSelectedUids(new Set(allEmployees.map(e => e.uid))); setExportSelectAll(true); }
                            }} className="text-[10px] font-bold text-primary-600 flex items-center gap-0.5">
                                <UserCheck className="w-3 h-3" />{exportSelectAll ? 'Bỏ tất cả' : 'Chọn tất cả'}
                            </button>
                        </div>
                        <div className="border border-gray-200 rounded-lg max-h-[180px] overflow-y-auto divide-y divide-gray-50">
                            {allEmployees.map(emp => (
                                <label key={emp.uid} className="flex items-center gap-2.5 px-3 py-2 active:bg-gray-50 cursor-pointer">
                                    <input type="checkbox" checked={exportSelectedUids.has(emp.uid)}
                                        onChange={() => { setExportSelectedUids(prev => { const n = new Set(prev); if (n.has(emp.uid)) n.delete(emp.uid); else n.add(emp.uid); return n; }); setExportSelectAll(false); }}
                                        className="w-3.5 h-3.5 rounded accent-primary-600" />
                                    <span className="text-[11px] font-medium text-gray-700">{emp.name}</span>
                                </label>
                            ))}
                        </div>
                        <p className="text-[9px] text-gray-400 mt-1">{exportSelectedUids.size}/{allEmployees.length} đã chọn · Chỉ xuất bản ghi chính thức</p>
                    </div>

                    <button onClick={handleDetailedExport}
                        disabled={exportLoading || exportSelectedUids.size === 0}
                        className="w-full py-2.5 rounded-lg bg-primary-600 text-white text-xs font-bold shadow-sm flex items-center justify-center gap-1.5 disabled:opacity-50 active:scale-[0.98] transition-all">
                        {exportLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <FileSpreadsheet className="w-3.5 h-3.5" />}
                        Xuất Excel ({exportSelectedUids.size} NV)
                    </button>
                </div>
            </BottomSheet>
        </MobilePageShell>
    );
}
