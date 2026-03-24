'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { db } from '@/lib/firebase';
import { collection, query, where, getDocs, doc, getDoc } from 'firebase/firestore';
import { KpiRecordDoc, KpiTemplateDoc, ScheduleDoc, StoreDoc } from '@/types';
import { toLocalDateString, cn } from '@/lib/utils';
import {
    BarChart3, Calendar, Clock, ChevronDown, TrendingUp, TrendingDown, Award,
    Minus, ClipboardCheck, CheckCircle2, Star, MapPin, RefreshCw, AlertCircle,
} from 'lucide-react';
import { DashboardHeader } from '@/components/inventory/overview/DashboardHeader';
import SelfScoringModal from '@/components/kpi/SelfScoringModal';

export default function EmployeeKpiStatsPage() {
    const { user, userDoc, getToken, effectiveStoreId: contextStoreId } = useAuth();

    // ── Filters ──
    const [selectedDate, setSelectedDate] = useState(toLocalDateString(new Date()));
    const [selectedShiftId, setSelectedShiftId] = useState('');
    const [shiftTimes, setShiftTimes] = useState<string[]>([]);
    const [counters, setCounters] = useState<{ id: string; name: string }[]>([]);
    const [templates, setTemplates] = useState<KpiTemplateDoc[]>([]);

    // ── Data ──
    const [schedules, setSchedules] = useState<ScheduleDoc[]>([]);
    const [kpiRecords, setKpiRecords] = useState<KpiRecordDoc[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');

    // ── Monthly stats ──
    const [selectedMonth, setSelectedMonth] = useState(() => {
        const now = new Date();
        return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    });
    const [monthlyRecords, setMonthlyRecords] = useState<KpiRecordDoc[]>([]);
    const [monthlyLoading, setMonthlyLoading] = useState(true);

    // ── Self-scoring modal ──
    const [selfScoreModal, setSelfScoreModal] = useState<{
        isOpen: boolean;
        template: KpiTemplateDoc | null;
        shiftId: string;
        date: string;
        counterId: string;
    }>({ isOpen: false, template: null, shiftId: '', date: '', counterId: '' });

    const storeId = contextStoreId || userDoc?.storeId || '';

    // ── Load store config (shifts, counters) ──
    useEffect(() => {
        if (!storeId) return;
        (async () => {
            const snap = await getDoc(doc(db, 'stores', storeId));
            if (snap.exists()) {
                const data = snap.data() as StoreDoc;
                const shifts = data.settings?.shiftTimes || [];
                setShiftTimes(shifts);
                setCounters((data.settings as any)?.counters || []);
                if (shifts.length > 0 && !selectedShiftId) setSelectedShiftId(shifts[0]);
            }
        })();
    }, [storeId]);

    // ── Load KPI templates ──
    useEffect(() => {
        if (!storeId || !user) return;
        (async () => {
            const token = await getToken();
            const res = await fetch(`/api/kpi-templates?storeId=${storeId}`, { headers: { Authorization: `Bearer ${token}` } });
            const data = await res.json();
            setTemplates(Array.isArray(data) ? data : []);
        })();
    }, [storeId, user, getToken]);

    // ── Load schedules + KPI records for selected date/shift ──
    const loadData = useCallback(async () => {
        if (!selectedDate || !selectedShiftId || !storeId || !user) return;
        setLoading(true); setError('');
        try {
            const token = await getToken();

            // Fetch schedules for this employee on the selected date/shift
            const schedQuery = query(
                collection(db, 'schedules'),
                where('date', '==', selectedDate),
                where('shiftId', '==', selectedShiftId),
                where('storeId', '==', storeId),
                where('employeeIds', 'array-contains', user.uid),
            );
            const schedSnap = await getDocs(schedQuery);
            const scheds = schedSnap.docs.map(d => ({ id: d.id, ...d.data() } as ScheduleDoc));
            setSchedules(scheds);

            // Fetch KPI records for this date + user
            const res = await fetch(
                `/api/kpi-records?storeId=${storeId}&date=${selectedDate}&userId=${user.uid}`,
                { headers: { Authorization: `Bearer ${token}` } }
            );
            const records = await res.json();
            setKpiRecords(Array.isArray(records) ? records : []);
        } catch (err) {
            console.error(err);
            setError('Không thể tải dữ liệu');
        } finally { setLoading(false); }
    }, [selectedDate, selectedShiftId, storeId, user, getToken]);

    useEffect(() => { loadData(); }, [loadData]);

    // ── Load monthly stats ──
    useEffect(() => {
        if (!user || !storeId) return;
        (async () => {
            setMonthlyLoading(true);
            try {
                const token = await getToken();
                const res = await fetch(
                    `/api/kpi-records?storeId=${storeId}&userId=${user.uid}&month=${selectedMonth}`,
                    { headers: { Authorization: `Bearer ${token}` } }
                );
                const data = await res.json();
                setMonthlyRecords(Array.isArray(data) ? data : []);
            } catch { /* noop */ } finally { setMonthlyLoading(false); }
        })();
    }, [user, storeId, selectedMonth, getToken]);

    // ── Helpers ──
    const getRecordForCounter = (counterId: string): KpiRecordDoc | undefined =>
        kpiRecords.find(r => r.counterId === counterId && r.shiftId === selectedShiftId);

    const getTemplateForCounter = (counterId: string): KpiTemplateDoc | undefined =>
        templates.find(t => t.assignedCounterIds?.includes(counterId));

    const counterName = (id: string) => counters.find(c => c.id === id)?.name || id;

    const scoreColor = (score: number) =>
        score >= 80 ? 'text-success-600' : score >= 50 ? 'text-warning-600' : 'text-danger-600';

    const scoreCardColor = (score: number) =>
        score >= 80 ? 'bg-success-50 text-success-700 border-success-200' :
        score >= 50 ? 'bg-warning-50 text-warning-700 border-warning-200' :
                      'bg-danger-50 text-danger-700 border-danger-200';

    // ── Monthly Aggregates ──
    const officialMonthly = monthlyRecords.filter(r => r.status === 'OFFICIAL');
    const avgSelf = monthlyRecords.length ? Math.round(monthlyRecords.reduce((s, r) => s + r.selfTotal, 0) / monthlyRecords.length) : 0;
    const avgOfficial = officialMonthly.length ? Math.round(officialMonthly.reduce((s, r) => s + r.officialTotal, 0) / officialMonthly.length) : 0;
    const trend = avgOfficial - avgSelf;

    const formatDate = (dateStr: string) => {
        try {
            const [y, m, d] = dateStr.split('-');
            return `${d}/${m}/${y}`;
        } catch { return dateStr; }
    };

    return (
        <div className="space-y-6 mx-auto">
            {/* ── Header ── */}
            <DashboardHeader
                showSelect={false}
                titleChildren={
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 w-full">
                        <div>
                            <h1 className="text-2xl font-bold text-surface-800 flex items-center gap-2">
                                <BarChart3 className="w-7 h-7 text-teal-600" />
                                KPI cá nhân
                            </h1>
                            <p className="text-surface-500 mt-1 text-sm">Tự đánh giá KPI theo từng quầy được phân công.</p>
                        </div>
                        <button
                            onClick={loadData}
                            className="p-2.5 rounded-xl bg-teal-50 hover:bg-teal-100 text-teal-600 transition-all active:scale-95 shrink-0 border border-teal-200"
                            title="Làm mới"
                        >
                            <RefreshCw className="w-4 h-4" />
                        </button>
                    </div>
                }
            />

            {/* ── Alerts ── */}
            {error && (
                <div className="bg-danger-50 text-danger-700 p-3.5 rounded-xl flex items-center gap-2.5 border border-danger-200 shadow-sm animate-in slide-in-from-top-2 duration-200">
                    <AlertCircle className="w-5 h-5 shrink-0" />
                    <span className="text-sm flex-1 font-medium">{error}</span>
                    <button onClick={() => setError('')} className="text-lg font-bold px-2 opacity-50 hover:opacity-100">×</button>
                </div>
            )}
            {success && (
                <div className="bg-success-50 text-success-700 p-3.5 rounded-xl flex items-center gap-2.5 border border-success-200 shadow-sm animate-in slide-in-from-top-2 duration-200">
                    <CheckCircle2 className="w-5 h-5 shrink-0" />
                    <span className="text-sm flex-1 font-medium">{success}</span>
                    <button onClick={() => setSuccess('')} className="text-lg font-bold px-2 opacity-50 hover:opacity-100">×</button>
                </div>
            )}

            {/* ── Filter Controls: Date + Shift ── */}
            <div className="flex flex-col sm:flex-row gap-3">
                <div className="relative bg-white rounded-xl shadow-sm border border-surface-200 flex-1 group hover:border-teal-300 hover:shadow-md transition-all">
                    <div className="absolute left-3 top-1/2 -translate-y-1/2 w-8 h-8 rounded-lg bg-teal-50 flex items-center justify-center group-hover:bg-teal-100 transition-colors">
                        <Calendar className="w-4 h-4 text-teal-600" />
                    </div>
                    <input type="date" value={selectedDate} onChange={e => setSelectedDate(e.target.value)}
                        className="pl-14 pr-3 py-3 w-full text-sm outline-none font-semibold text-surface-700 rounded-xl" />
                </div>

                <div className="relative bg-white rounded-xl shadow-sm border border-surface-200 min-w-[180px] group hover:border-teal-300 hover:shadow-md transition-all">
                    <div className="absolute left-3 top-1/2 -translate-y-1/2 w-8 h-8 rounded-lg bg-teal-50 flex items-center justify-center group-hover:bg-teal-100 transition-colors">
                        <Clock className="w-4 h-4 text-teal-600" />
                    </div>
                    <select value={selectedShiftId} onChange={e => setSelectedShiftId(e.target.value)}
                        className="pl-14 pr-8 py-3 w-full text-sm outline-none font-semibold text-surface-700 appearance-none cursor-pointer rounded-xl">
                        {shiftTimes.map(s => <option key={s} value={s}>{s}</option>)}
                    </select>
                    <ChevronDown className="w-4 h-4 absolute right-3 top-1/2 -translate-y-1/2 text-surface-400 pointer-events-none" />
                </div>
            </div>

            {/* ── Per-Counter Cards ── */}
            {loading ? (
                <div className="flex flex-col items-center justify-center py-16 gap-3">
                    <div className="w-10 h-10 border-[3px] border-teal-400 border-t-transparent rounded-full animate-spin" />
                    <p className="text-sm text-surface-400 font-medium">Đang tải dữ liệu...</p>
                </div>
            ) : schedules.length === 0 ? (
                <div className="bg-white border-2 border-dashed border-surface-200 rounded-2xl p-16 text-center">
                    <div className="w-16 h-16 rounded-2xl bg-surface-100 flex items-center justify-center mx-auto mb-4">
                        <MapPin className="w-7 h-7 text-surface-300" />
                    </div>
                    <p className="font-bold text-surface-700 text-lg">Không có quầy nào</p>
                    <p className="text-sm text-surface-400 mt-1">Bạn không được phân công quầy nào trong ca này.</p>
                </div>
            ) : (
                <div className="space-y-3">
                    <p className="text-xs font-bold text-surface-500 uppercase tracking-wider">
                        {schedules.length} quầy được phân công · {selectedShiftId} · {formatDate(selectedDate)}
                    </p>
                    {schedules.map(sched => {
                        const cId = sched.counterId;
                        const cName = counterName(cId);
                        const record = getRecordForCounter(cId);
                        const template = getTemplateForCounter(cId);
                        const isOfficial = record?.status === 'OFFICIAL';
                        const isSelfScored = record?.status === 'SELF_SCORED';

                        return (
                            <div key={cId} className="bg-white border border-surface-200 rounded-2xl overflow-hidden shadow-sm hover:shadow-md transition-all">
                                <div className="flex items-center gap-3 px-4 py-3.5">
                                    {/* Counter icon */}
                                    <div className={cn(
                                        'w-10 h-10 rounded-xl flex items-center justify-center shrink-0',
                                        isOfficial ? 'bg-success-100 text-success-700' :
                                        isSelfScored ? 'bg-teal-100 text-teal-700' :
                                                       'bg-surface-100 text-surface-500'
                                    )}>
                                        <MapPin className="w-5 h-5" />
                                    </div>

                                    {/* Counter info */}
                                    <div className="flex-1 min-w-0">
                                        <p className="font-bold text-surface-800 leading-tight">{cName}</p>
                                        <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                                            {record ? (
                                                <>
                                                    <div className="flex items-center gap-1 px-2 py-0.5 rounded-md bg-teal-50 border border-teal-100 text-[11px]">
                                                        <Star className="w-2.5 h-2.5 text-teal-500" />
                                                        <span className="font-bold text-teal-700">Tự chấm: {record.selfTotal}</span>
                                                    </div>
                                                    {isOfficial && (
                                                        <div className={cn('flex items-center gap-1 px-2 py-0.5 rounded-md border text-[11px]', scoreCardColor(record.officialTotal))}>
                                                            <Award className="w-2.5 h-2.5" />
                                                            <span className="font-bold">Chính thức: {record.officialTotal}</span>
                                                        </div>
                                                    )}
                                                </>
                                            ) : (
                                                <span className="text-[11px] text-surface-400 italic">Chưa có điểm</span>
                                            )}
                                        </div>
                                    </div>

                                    {/* Status badge */}
                                    <div className="shrink-0">
                                        {isOfficial ? (
                                            <span className="flex items-center gap-1 text-[10px] font-bold px-2 py-1 rounded-lg bg-success-100 text-success-700 border border-success-200">
                                                <CheckCircle2 className="w-3 h-3" /> Đã chấm CK
                                            </span>
                                        ) : isSelfScored ? (
                                            <span className="flex items-center gap-1 text-[10px] font-bold px-2 py-1 rounded-lg bg-teal-100 text-teal-700 border border-teal-200">
                                                <Star className="w-3 h-3" /> Đã tự chấm
                                            </span>
                                        ) : (
                                            <span className="flex items-center gap-1 text-[10px] font-bold px-2 py-1 rounded-lg bg-surface-100 text-surface-500 border border-surface-200">
                                                Chưa chấm
                                            </span>
                                        )}
                                    </div>

                                    {/* Action button */}
                                    <button
                                        onClick={() => {
                                            if (!template) { setError('Chưa có mẫu KPI cho quầy này'); return; }
                                            setSelfScoreModal({
                                                isOpen: true,
                                                template,
                                                shiftId: sched.shiftId,
                                                date: selectedDate,
                                                counterId: cId,
                                            });
                                        }}
                                        disabled={!template || isSelfScored || isOfficial}
                                        className={cn(
                                            'shrink-0 px-3.5 py-2 rounded-xl font-semibold text-xs flex items-center gap-1.5 transition-all duration-200 active:scale-[0.98]',
                                            isSelfScored || isOfficial
                                                ? 'bg-surface-50 text-surface-400 border border-surface-200 cursor-not-allowed'
                                                : 'bg-gradient-to-r from-teal-500 to-teal-600 text-white hover:from-teal-600 hover:to-teal-700 shadow-sm shadow-teal-500/20',
                                            !template && 'opacity-40 cursor-not-allowed !shadow-none'
                                        )}
                                    >
                                        <ClipboardCheck className="w-3.5 h-3.5" />
                                        {isSelfScored || isOfficial ? 'Đã gửi' : 'Tự đánh giá'}
                                    </button>
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}

            {/* ── Monthly Stats Section ── */}
            <div className="border-t border-surface-200 pt-6 space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <h2 className="text-lg font-bold text-surface-800 flex items-center gap-2">
                        <TrendingUp className="w-5 h-5 text-teal-600" />
                        Thống kê tháng
                    </h2>
                    <div className="bg-white rounded-xl border border-surface-200 shadow-sm p-2 flex items-center gap-2 shrink-0">
                        <Calendar className="w-4 h-4 text-teal-500 ml-1" />
                        <input type="month" value={selectedMonth} onChange={e => setSelectedMonth(e.target.value)}
                            className="border border-surface-200 rounded-lg p-2 text-sm outline-none focus:ring-2 focus:ring-teal-300 font-medium" />
                    </div>
                </div>

                {/* Summary Cards */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div className="bg-gradient-to-br from-teal-50 to-white rounded-xl border border-teal-100 p-4 shadow-sm">
                        <p className="text-xs text-teal-600 font-medium uppercase tracking-wider mb-1">Số lượt chấm</p>
                        <p className="text-3xl font-black text-surface-800">{monthlyRecords.length}</p>
                    </div>
                    <div className="bg-gradient-to-br from-primary-50 to-white rounded-xl border border-primary-100 p-4 shadow-sm">
                        <p className="text-xs text-primary-600 font-medium uppercase tracking-wider mb-1">TB Tự đánh giá</p>
                        <p className={cn('text-3xl font-black', scoreColor(avgSelf))}>{avgSelf || '—'}</p>
                    </div>
                    <div className="bg-gradient-to-br from-accent-50 to-white rounded-xl border border-accent-100 p-4 shadow-sm">
                        <p className="text-xs text-accent-600 font-medium uppercase tracking-wider mb-1">TB Chính thức</p>
                        <div className="flex items-end gap-2">
                            <p className={cn('text-3xl font-black', scoreColor(avgOfficial))}>{avgOfficial || '—'}</p>
                            {trend !== 0 && officialMonthly.length > 0 && (
                                <span className={cn('text-xs font-bold pb-1 flex items-center gap-0.5',
                                    trend > 0 ? 'text-success-500' : 'text-danger-500'
                                )}>
                                    {trend > 0 ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                                    {Math.abs(trend)}
                                </span>
                            )}
                        </div>
                    </div>
                </div>

                {/* Records Table */}
                {monthlyLoading ? (
                    <div className="flex justify-center py-8"><div className="w-8 h-8 border-4 border-teal-500 border-t-transparent rounded-full animate-spin" /></div>
                ) : monthlyRecords.length === 0 ? (
                    <div className="bg-white border-2 border-dashed border-surface-300 rounded-2xl p-12 text-center text-surface-400">
                        <Award className="w-10 h-10 mx-auto mb-3 text-surface-300" />
                        <p className="font-semibold">Chưa có dữ liệu KPI cho tháng này</p>
                    </div>
                ) : (
                    <div className="bg-white rounded-xl border border-surface-200 shadow-sm overflow-hidden">
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm">
                                <thead className="bg-surface-50 border-b border-surface-200">
                                    <tr>
                                        <th className="text-left p-3 font-semibold text-surface-600">Ngày</th>
                                        <th className="text-left p-3 font-semibold text-surface-600">Ca</th>
                                        <th className="text-left p-3 font-semibold text-surface-600">Quầy</th>
                                        <th className="text-center p-3 font-semibold text-surface-600">Tự chấm</th>
                                        <th className="text-center p-3 font-semibold text-surface-600">Chính thức</th>
                                        <th className="text-center p-3 font-semibold text-surface-600">Trạng thái</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-surface-100">
                                    {monthlyRecords.sort((a, b) => b.date.localeCompare(a.date) || a.counterId.localeCompare(b.counterId)).map(r => (
                                        <tr key={r.id} className="hover:bg-surface-50/50">
                                            <td className="p-3 font-medium text-surface-700">{formatDate(r.date)}</td>
                                            <td className="p-3 text-surface-600">
                                                <span className="px-1.5 py-0.5 bg-teal-50 text-teal-600 rounded font-medium text-xs">{r.shiftId}</span>
                                            </td>
                                            <td className="p-3 text-surface-600">
                                                <span className="flex items-center gap-1 text-xs font-medium">
                                                    <MapPin className="w-3 h-3 text-surface-400" />
                                                    {counterName(r.counterId)}
                                                </span>
                                            </td>
                                            <td className="p-3 text-center">
                                                <span className={cn('font-bold', scoreColor(r.selfTotal))}>{r.selfTotal}</span>
                                            </td>
                                            <td className="p-3 text-center">
                                                {r.status === 'OFFICIAL' ? (
                                                    <span className={cn('font-bold', scoreColor(r.officialTotal))}>{r.officialTotal}</span>
                                                ) : <Minus className="w-4 h-4 mx-auto text-surface-300" />}
                                            </td>
                                            <td className="p-3 text-center">
                                                <span className={cn('text-[10px] font-bold px-2 py-0.5 rounded-full border',
                                                    r.status === 'OFFICIAL' ? 'bg-success-50 text-success-700 border-success-200' : 'bg-teal-50 text-teal-700 border-teal-200'
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

            {/* ── Self Scoring Modal ── */}
            {selfScoreModal.template && (
                <SelfScoringModal
                    isOpen={selfScoreModal.isOpen}
                    onClose={() => setSelfScoreModal(prev => ({ ...prev, isOpen: false }))}
                    template={selfScoreModal.template}
                    shiftId={selfScoreModal.shiftId}
                    date={selfScoreModal.date}
                    counterId={selfScoreModal.counterId}
                    storeId={storeId}
                    onSuccess={() => { setSuccess('Đã gửi đánh giá thành công!'); loadData(); }}
                />
            )}
        </div>
    );
}
