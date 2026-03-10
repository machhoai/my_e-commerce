'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { KpiRecordDoc } from '@/types';
import { toLocalDateString, cn } from '@/lib/utils';
import { BarChart3, Calendar, TrendingUp, TrendingDown, Award, Minus } from 'lucide-react';
import { DashboardHeader } from '@/components/inventory/overview/DashboardHeader';

export default function EmployeeKpiStatsPage() {
    const { user, userDoc, getToken } = useAuth();
    const [records, setRecords] = useState<KpiRecordDoc[]>([]);
    const [loading, setLoading] = useState(true);
    const [selectedMonth, setSelectedMonth] = useState(() => {
        const now = new Date();
        return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    });

    useEffect(() => {
        if (!user || !userDoc?.storeId) return;
        (async () => {
            setLoading(true);
            try {
                const token = await getToken();
                const res = await fetch(
                    `/api/kpi-records?storeId=${userDoc.storeId}&userId=${user.uid}&month=${selectedMonth}`,
                    { headers: { Authorization: `Bearer ${token}` } }
                );
                const data = await res.json();
                setRecords(Array.isArray(data) ? data : []);
            } catch { /* noop */ } finally { setLoading(false); }
        })();
    }, [user, userDoc, selectedMonth, getToken]);

    const officialRecords = records.filter(r => r.status === 'OFFICIAL');
    const avgSelf = records.length ? Math.round(records.reduce((s, r) => s + r.selfTotal, 0) / records.length) : 0;
    const avgOfficial = officialRecords.length ? Math.round(officialRecords.reduce((s, r) => s + r.officialTotal, 0) / officialRecords.length) : 0;
    const trend = avgOfficial - avgSelf;

    return (
        <div className="space-y-6 mx-auto">
            <DashboardHeader
                showSelect={false}
                titleChildren={
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 w-full">
                        <div>
                            <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
                                <BarChart3 className="w-7 h-7 text-teal-600" />
                                Thống kê KPI cá nhân
                            </h1>
                            <p className="text-slate-500 mt-1 text-sm">Xem điểm KPI của bạn theo tháng.</p>
                        </div>
                        {/* Month Picker */}
                        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-3 flex items-center gap-3 shrink-0">
                            <Calendar className="w-4 h-4 text-teal-500" />
                            <input type="month" value={selectedMonth} onChange={e => setSelectedMonth(e.target.value)}
                                className="border border-slate-200 rounded-lg p-2 text-sm outline-none focus:ring-2 focus:ring-teal-300 font-medium" />
                        </div>
                    </div>
                }
            />

            {/* Summary Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm">
                    <p className="text-xs text-slate-500 font-medium uppercase tracking-wider mb-1">Số ca đã chấm</p>
                    <p className="text-3xl font-black text-slate-800">{records.length}</p>
                </div>
                <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm">
                    <p className="text-xs text-slate-500 font-medium uppercase tracking-wider mb-1">TB Tự đánh giá</p>
                    <p className={cn('text-3xl font-black', avgSelf >= 80 ? 'text-emerald-600' : avgSelf >= 50 ? 'text-amber-600' : 'text-red-600')}>
                        {avgSelf}
                    </p>
                </div>
                <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm">
                    <p className="text-xs text-slate-500 font-medium uppercase tracking-wider mb-1">TB Chính thức</p>
                    <div className="flex items-end gap-2">
                        <p className={cn('text-3xl font-black', avgOfficial >= 80 ? 'text-emerald-600' : avgOfficial >= 50 ? 'text-amber-600' : 'text-red-600')}>
                            {avgOfficial}
                        </p>
                        {trend !== 0 && (
                            <span className={cn('text-xs font-bold pb-1 flex items-center gap-0.5',
                                trend > 0 ? 'text-emerald-500' : 'text-red-500'
                            )}>
                                {trend > 0 ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                                {Math.abs(trend)}
                            </span>
                        )}
                    </div>
                </div>
            </div>

            {/* Records Table */}
            {loading ? (
                <div className="flex justify-center py-12"><div className="w-8 h-8 border-4 border-teal-500 border-t-transparent rounded-full animate-spin" /></div>
            ) : records.length === 0 ? (
                <div className="bg-white border-2 border-dashed border-slate-300 rounded-2xl p-12 text-center text-slate-400">
                    <Award className="w-10 h-10 mx-auto mb-3 text-slate-300" />
                    <p className="font-semibold">Chưa có dữ liệu KPI cho tháng này</p>
                </div>
            ) : (
                <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead className="bg-slate-50 border-b border-slate-200">
                                <tr>
                                    <th className="text-left p-3 font-semibold text-slate-600">Ngày</th>
                                    <th className="text-left p-3 font-semibold text-slate-600">Ca</th>
                                    <th className="text-center p-3 font-semibold text-slate-600">Tự chấm</th>
                                    <th className="text-center p-3 font-semibold text-slate-600">Chính thức</th>
                                    <th className="text-center p-3 font-semibold text-slate-600">Trạng thái</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {records.sort((a, b) => b.date.localeCompare(a.date)).map(r => (
                                    <tr key={r.id} className="hover:bg-slate-50/50">
                                        <td className="p-3 font-medium text-slate-700">{r.date}</td>
                                        <td className="p-3 text-slate-600">{r.shiftId}</td>
                                        <td className="p-3 text-center">
                                            <span className={cn('font-bold', r.selfTotal >= 80 ? 'text-emerald-600' : r.selfTotal >= 50 ? 'text-amber-600' : 'text-red-600')}>
                                                {r.selfTotal}
                                            </span>
                                        </td>
                                        <td className="p-3 text-center">
                                            {r.status === 'OFFICIAL' ? (
                                                <span className={cn('font-bold', r.officialTotal >= 80 ? 'text-emerald-600' : r.officialTotal >= 50 ? 'text-amber-600' : 'text-red-600')}>
                                                    {r.officialTotal}
                                                </span>
                                            ) : <Minus className="w-4 h-4 mx-auto text-slate-300" />}
                                        </td>
                                        <td className="p-3 text-center">
                                            <span className={cn('text-[10px] font-bold px-2 py-0.5 rounded-full border',
                                                r.status === 'OFFICIAL' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-blue-50 text-blue-700 border-blue-200'
                                            )}>
                                                {r.status === 'OFFICIAL' ? '✓ Đã chấm' : 'Chờ chấm'}
                                            </span>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}
        </div>
    );
}
