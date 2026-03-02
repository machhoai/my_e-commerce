'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { db } from '@/lib/firebase';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { UserDoc, KpiRecordDoc, StoreDoc } from '@/types';
import { cn } from '@/lib/utils';
import { exportKpiToPdf, exportKpiToExcel } from '@/lib/kpi-export';
import {
    BarChart3, Calendar, Building2, FileSpreadsheet, FileText,
    TrendingUp, TrendingDown, Users, Award, Download, ChevronDown,
} from 'lucide-react';

export default function ManagerKpiStatsPage() {
    const { user, userDoc, getToken, hasPermission } = useAuth();
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
    const [exporting, setExporting] = useState('');

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
            try {
                const token = await getToken();
                const res = await fetch(
                    `/api/kpi-records?storeId=${effectiveStoreId}&month=${selectedMonth}`,
                    { headers: { Authorization: `Bearer ${token}` } }
                );
                const data = await res.json();
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
            } catch { /* noop */ } finally { setLoading(false); }
        })();
    }, [effectiveStoreId, selectedMonth, user, getToken]);

    // Aggregate stats per employee
    const getEmpStats = (uid: string) => {
        const empRecs = records.filter(r => r.userId === uid);
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

    if (!userDoc || (userDoc.role !== 'admin' && userDoc.role !== 'store_manager' && !hasPermission('view_all_kpi'))) {
        return <div className="p-8 text-center text-red-500 font-bold">Không có quyền truy cập.</div>;
    }

    const totalRecords = records.length;
    const avgAll = totalRecords ? Math.round(records.filter(r => r.status === 'OFFICIAL').reduce((s, r) => s + r.officialTotal, 0) / Math.max(1, records.filter(r => r.status === 'OFFICIAL').length)) : 0;

    return (
        <div className="space-y-6 mx-auto">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
                        <BarChart3 className="w-7 h-7 text-indigo-600" />
                        Thống kê KPI
                    </h1>
                    <p className="text-slate-500 mt-1 text-sm">Tổng quan điểm KPI nhân viên theo tháng.</p>
                </div>
                {/* Export buttons */}
                {hasPermission('export_kpi') && (
                    <div className="flex items-center gap-2">
                        <button onClick={handleExportPdf} disabled={!!exporting || !records.length}
                            className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-red-50 text-red-700 border border-red-200 hover:bg-red-100 font-semibold text-xs disabled:opacity-50 transition-colors">
                            {exporting === 'pdf' ? <div className="w-3.5 h-3.5 border-2 border-red-500 border-t-transparent rounded-full animate-spin" /> : <FileText className="w-3.5 h-3.5" />}
                            PDF
                        </button>
                        <button onClick={handleExportExcel} disabled={!!exporting || !records.length}
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
            </div>

            {/* Summary */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="bg-gradient-to-br from-indigo-50 to-blue-50 rounded-xl border border-indigo-100 p-4 shadow-sm">
                    <p className="text-xs text-indigo-600 font-medium uppercase tracking-wider mb-1 flex items-center gap-1"><Users className="w-3.5 h-3.5" /> Nhân viên</p>
                    <p className="text-3xl font-black text-indigo-800">{employees.length}</p>
                </div>
                <div className="bg-gradient-to-br from-teal-50 to-emerald-50 rounded-xl border border-teal-100 p-4 shadow-sm">
                    <p className="text-xs text-teal-600 font-medium uppercase tracking-wider mb-1 flex items-center gap-1"><Award className="w-3.5 h-3.5" /> Tổng lượt chấm</p>
                    <p className="text-3xl font-black text-teal-800">{totalRecords}</p>
                </div>
                <div className="bg-gradient-to-br from-purple-50 to-fuchsia-50 rounded-xl border border-purple-100 p-4 shadow-sm">
                    <p className="text-xs text-purple-600 font-medium uppercase tracking-wider mb-1 flex items-center gap-1"><TrendingUp className="w-3.5 h-3.5" /> TB Chính thức</p>
                    <p className={cn('text-3xl font-black', avgAll >= 80 ? 'text-emerald-700' : avgAll >= 50 ? 'text-amber-700' : 'text-red-700')}>
                        {avgAll}
                    </p>
                </div>
            </div>

            {/* Employee Table */}
            {loading ? (
                <div className="flex justify-center py-12"><div className="w-8 h-8 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin" /></div>
            ) : employees.length === 0 ? (
                <div className="bg-white border-2 border-dashed border-slate-300 rounded-2xl p-12 text-center text-slate-400">
                    <Users className="w-10 h-10 mx-auto mb-3 text-slate-300" />
                    <p className="font-semibold">Không có dữ liệu</p>
                </div>
            ) : (
                <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead className="bg-slate-50 border-b border-slate-200">
                                <tr>
                                    <th className="text-left p-3 font-semibold text-slate-600">#</th>
                                    <th className="text-left p-3 font-semibold text-slate-600">Nhân viên</th>
                                    <th className="text-center p-3 font-semibold text-slate-600">Số ca</th>
                                    <th className="text-center p-3 font-semibold text-slate-600">TB Tự chấm</th>
                                    <th className="text-center p-3 font-semibold text-slate-600">TB Chính thức</th>
                                    <th className="text-center p-3 font-semibold text-slate-600">Chênh lệch</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {employees.map((emp, i) => {
                                    const stats = getEmpStats(emp.uid);
                                    const diff = stats.avgOfficial - stats.avgSelf;
                                    return (
                                        <tr key={emp.uid} className="hover:bg-slate-50/50">
                                            <td className="p-3 text-slate-400 font-bold">{i + 1}</td>
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
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}
        </div>
    );
}
