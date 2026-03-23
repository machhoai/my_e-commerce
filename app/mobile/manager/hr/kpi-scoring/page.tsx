'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { db } from '@/lib/firebase';
import { doc, getDoc, collection, query, where, getDocs } from 'firebase/firestore';
import { UserDoc, CounterDoc, StoreDoc, KpiRecordDoc, KpiTemplateDoc, ScheduleDoc } from '@/types';
import { toLocalDateString, cn } from '@/lib/utils';
import OfficialScoringModal from '@/components/kpi/OfficialScoringModal';
import {
    Calendar, Clock, RefreshCw, CheckCircle2, AlertCircle,
    Star, Award, User, ClipboardCheck, ChevronDown, X, ChevronLeft, Building2,
} from 'lucide-react';
import { useRouter } from 'next/navigation';

export default function MobileManagerHrKpiScoringPage() {
    const router = useRouter();
    const { user, userDoc, getToken, hasPermission, effectiveStoreId: ctxStoreId, managedStoreIds } = useAuth();

    // ── Store selection (admin / multi-store manager) ─
    const isAdmin = userDoc?.role === 'admin' || userDoc?.role === 'super_admin';
    const needsStorePicker = isAdmin || managedStoreIds.length > 1;
    const [stores, setStores] = useState<{ id: string; name: string }[]>([]);
    const [selectedStoreId, setSelectedStoreId] = useState('');

    // effectiveStoreId: store-fixed users use their storeId; others use picker
    const effectiveStoreId = needsStorePicker ? selectedStoreId : (userDoc?.storeId ?? ctxStoreId ?? '');

    const [selectedDate, setSelectedDate] = useState(toLocalDateString(new Date()));
    const [selectedShiftId, setSelectedShiftId] = useState('');
    const [shiftTimes, setShiftTimes] = useState<string[]>([]);
    const [counters, setCounters] = useState<CounterDoc[]>([]);
    const [templates, setTemplates] = useState<KpiTemplateDoc[]>([]);

    const [employees, setEmployees] = useState<UserDoc[]>([]);
    const [schedules, setSchedules] = useState<ScheduleDoc[]>([]);
    const [kpiRecords, setKpiRecords] = useState<KpiRecordDoc[]>([]);
    const [monthlyRecords, setMonthlyRecords] = useState<KpiRecordDoc[]>([]);

    // Start as false — show empty/prompt state until user triggers a load
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');

    const [scoreModal, setScoreModal] = useState<{
        isOpen: boolean; recordId: string; employeeName: string;
        selfTotal: number; details: any[]; templateGroups: any[];
    }>({ isOpen: false, recordId: '', employeeName: '', selfTotal: 0, details: [], templateGroups: [] });

    // ── Load store list for picker ─────────────────────────────────────────────
    useEffect(() => {
        if (!needsStorePicker || !user) return;
        (async () => {
            try {
                const token = await getToken();
                const res = await fetch('/api/stores', { headers: { Authorization: `Bearer ${token}` } });
                const all: { id: string; name: string }[] = await res.json();
                const filtered = isAdmin ? all : all.filter(s => managedStoreIds.includes((s as any).id || s.id));
                setStores(filtered);
                // Pre-select if only one
                if (filtered.length === 1) setSelectedStoreId(filtered[0].id);
            } catch { /* silent */ }
        })();
    }, [needsStorePicker, user, isAdmin, managedStoreIds, getToken]);

    // ── Load store config (shifts, counters) ──────────────────────────────────
    useEffect(() => {
        if (!effectiveStoreId) return;
        setShiftTimes([]); setCounters([]); setSelectedShiftId('');
        (async () => {
            try {
                const snap = await getDoc(doc(db, 'stores', effectiveStoreId));
                if (snap.exists()) {
                    const data = snap.data() as StoreDoc;
                    const shifts = data.settings?.shiftTimes || [];
                    setShiftTimes(shifts);
                    setCounters((data.settings as any)?.counters || []);
                    if (shifts.length > 0) setSelectedShiftId(shifts[0]);
                }
            } catch { /* silent */ }
        })();
    }, [effectiveStoreId]);

    // ── Load KPI templates ────────────────────────────────────────────────────
    useEffect(() => {
        if (!effectiveStoreId || !user) return;
        (async () => {
            try {
                const token = await getToken();
                const res = await fetch(`/api/kpi-templates?storeId=${effectiveStoreId}`, { headers: { Authorization: `Bearer ${token}` } });
                const data = await res.json();
                setTemplates(Array.isArray(data) ? data : []);
            } catch { /* silent */ }
        })();
    }, [effectiveStoreId, user, getToken]);

    // ── Load schedules + employee list + KPI records ───────────────────────────
    const loadData = useCallback(async () => {
        if (!selectedDate || !selectedShiftId || !effectiveStoreId || !user) return;
        setLoading(true); setError('');
        try {
            const token = await getToken();
            const schedSnap = await getDocs(query(
                collection(db, 'schedules'),
                where('date', '==', selectedDate),
                where('shiftId', '==', selectedShiftId),
                where('storeId', '==', effectiveStoreId)
            ));
            const scheds = schedSnap.docs.map(d => ({ id: d.id, ...d.data() } as ScheduleDoc));
            setSchedules(scheds);

            const empIds = new Set<string>();
            scheds.forEach(s => s.employeeIds.forEach(uid => empIds.add(uid)));
            const users: UserDoc[] = [];
            const uidArr = Array.from(empIds);
            for (let i = 0; i < uidArr.length; i += 10) {
                const uSnap = await getDocs(query(collection(db, 'users'), where('uid', 'in', uidArr.slice(i, i + 10))));
                uSnap.docs.forEach(u => users.push(u.data() as UserDoc));
            }
            users.sort((a, b) => a.name.localeCompare(b.name));
            setEmployees(users);

            const res = await fetch(`/api/kpi-records?storeId=${effectiveStoreId}&date=${selectedDate}`, { headers: { Authorization: `Bearer ${token}` } });
            const records = await res.json();
            setKpiRecords(Array.isArray(records) ? records : []);

            // Fetch all OFFICIAL records for the current month (for monthly avg)
            const monthStr = selectedDate.substring(0, 7); // "YYYY-MM"
            const [yearStr, monStr] = monthStr.split('-');
            const monthStart = `${yearStr}-${monStr}-01`;
            const lastDay = new Date(Number(yearStr), Number(monStr), 0).getDate();
            const monthEnd = `${yearStr}-${monStr}-${String(lastDay).padStart(2, '0')}`;
            const monthSnap = await getDocs(query(
                collection(db, 'kpi_records'),
                where('storeId', '==', effectiveStoreId),
                where('status', '==', 'OFFICIAL'),
                where('date', '>=', monthStart),
                where('date', '<=', monthEnd)
            ));
            setMonthlyRecords(monthSnap.docs.map(d => ({ id: d.id, ...d.data() } as KpiRecordDoc)));
        } catch { setError('Không thể tải dữ liệu'); }
        finally { setLoading(false); }
    }, [selectedDate, selectedShiftId, effectiveStoreId, user, getToken]);

    // Auto-load when all required values available
    useEffect(() => {
        if (effectiveStoreId && selectedShiftId && selectedDate) loadData();
        else { setEmployees([]); setSchedules([]); setKpiRecords([]); }
    }, [loadData, effectiveStoreId, selectedShiftId, selectedDate]);

    // ── Helpers ───────────────────────────────────────────────────────────────
    const getRec = (uid: string, cId: string) =>
        kpiRecords.find(r => r.userId === uid && r.counterId === cId && r.shiftId === selectedShiftId);
    const getTpl = (cId: string) => templates.find(t => t.assignedCounterIds?.includes(cId));
    const getEmpScheds = (uid: string) => schedules.filter(s => s.employeeIds.includes(uid));
    const getAvg = (uid: string): number | null => {
        const recs = getEmpScheds(uid).map(s => getRec(uid, s.counterId)).filter((r): r is KpiRecordDoc => r?.status === 'OFFICIAL');
        return recs.length ? Math.round(recs.reduce((s, r) => s + r.officialTotal, 0) / recs.length) : null;
    };
    // Monthly average across all OFFICIAL records for this employee in the selected month
    const getMonthlyAvg = (uid: string): { avg: number; count: number } | null => {
        const monthStr = selectedDate.substring(0, 7);
        const recs = monthlyRecords.filter(r => r.userId === uid && r.date.startsWith(monthStr));
        if (recs.length === 0) return null;
        return { avg: Math.round(recs.reduce((s, r) => s + r.officialTotal, 0) / recs.length), count: recs.length };
    };
    const initials = (n: string) => {
        const p = n.trim().split(' ').filter(Boolean);
        return p.length >= 2 ? (p[0][0] + p[p.length - 1][0]).toUpperCase() : n.substring(0, 2).toUpperCase();
    };
    const scoreColor = (s: number) =>
        s >= 80 ? 'text-emerald-700 bg-emerald-50 border-emerald-200' :
            s >= 50 ? 'text-amber-700 bg-amber-50 border-amber-200' :
                'text-red-700 bg-red-50 border-red-200';

    const openScoring = (emp: UserDoc, cId: string) => {
        const record = getRec(emp.uid, cId);
        const tpl = getTpl(cId);
        if (!tpl) { setError('Chưa có mẫu KPI cho quầy này'); return; }
        if (record) {
            setScoreModal({ isOpen: true, recordId: record.id, employeeName: emp.name, selfTotal: record.selfTotal, details: record.details, templateGroups: tpl.groups });
        } else {
            const details = tpl.groups.flatMap(g => g.criteria.map((c: any) => ({ criteriaName: c.name, maxScore: c.maxScore, selfScore: 0, officialScore: c.maxScore, note: '' })));
            (async () => {
                try {
                    const token = await getToken();
                    const res = await fetch('/api/kpi-records', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
                        body: JSON.stringify({ storeId: effectiveStoreId, shiftId: selectedShiftId, date: selectedDate, counterId: cId, templateId: tpl.id, userId: emp.uid, details: details.map(d => ({ criteriaName: d.criteriaName, maxScore: d.maxScore, selfScore: 0 })) }),
                    });
                    if (res.status === 409) { await loadData(); setSuccess('Nhân viên đã tự chấm. Vui lòng bấm lại.'); return; }
                    const created = await res.json();
                    setScoreModal({ isOpen: true, recordId: created.id, employeeName: emp.name, selfTotal: 0, details: created.details || details, templateGroups: tpl.groups });
                } catch { setError('Không thể tạo bản ghi KPI'); }
            })();
        }
    };

    const totalEmp = employees.length;
    const scoredCount = employees.filter(e => { const s = getEmpScheds(e.uid); return s.length > 0 && s.every(sc => getRec(e.uid, sc.counterId)?.status === 'OFFICIAL'); }).length;
    const selfCount = employees.filter(e => getEmpScheds(e.uid).some(s => getRec(e.uid, s.counterId)?.status === 'SELF_SCORED')).length;

    if (!userDoc || !hasPermission('page.hr.kpi_scoring')) {
        return (
            <div className="min-h-screen bg-gray-50 flex items-center justify-center p-6">
                <div className="text-center"><AlertCircle className="w-12 h-12 text-red-300 mx-auto mb-3" /><p className="font-bold text-gray-700">Không có quyền truy cập</p></div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gray-50 pb-8">
            {/* ── Sticky header ── */}
            <div className="sticky top-0 z-20 bg-primary-600 text-white px-4 pt-4 pb-2 shadow-lg shadow-primary-900/20">
                <div className="flex items-center gap-3 mb-3">
                    <button onClick={() => router.back()} className="w-9 h-9 rounded-xl bg-white/15 flex items-center justify-center active:scale-95 transition-transform">
                        <ChevronLeft className="w-5 h-5" />
                    </button>
                    <div className="flex-1 min-w-0">
                        <h1 className="text-[17px] font-bold leading-tight">Chấm điểm KPI</h1>
                        <p className="text-[11px] text-primary-200 font-medium">Đánh giá ca trực nhân viên</p>
                    </div>
                    <button onClick={loadData} title="Làm mới" className="w-9 h-9 rounded-xl bg-white/15 flex items-center justify-center active:scale-95 transition-transform">
                        <RefreshCw className={cn('w-4 h-4', loading && 'animate-spin')} />
                    </button>
                </div>
            </div>

            <div className="px-4 pt-4 flex flex-col gap-3">
                {/* ── Store picker (admin / multi-store) ── */}
                {needsStorePicker && (
                    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm flex items-center gap-2 px-3 py-2.5">
                        <Building2 className="w-4 h-4 text-primary-500 shrink-0" />
                        <select
                            value={selectedStoreId}
                            onChange={e => setSelectedStoreId(e.target.value)}
                            className="flex-1 text-[13px] font-semibold text-gray-700 outline-none bg-transparent appearance-none cursor-pointer"
                        >
                            <option value="">-- Chọn cửa hàng --</option>
                            {stores.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                        </select>
                        <ChevronDown className="w-3.5 h-3.5 text-gray-400 shrink-0 pointer-events-none" />
                    </div>
                )}

                {/* ── Filters (date + shift) ── */}
                <div className="grid grid-cols-2 gap-2">
                    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm flex items-center gap-2 px-3 py-2.5">
                        <Calendar className="w-4 h-4 text-primary-500 shrink-0" />
                        <input type="date" value={selectedDate} onChange={e => setSelectedDate(e.target.value)}
                            className="flex-1 text-[13px] font-semibold text-gray-700 outline-none bg-transparent min-w-0" />
                    </div>
                    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm flex items-center gap-2 px-3 py-2.5">
                        <Clock className="w-4 h-4 text-accent-500 shrink-0" />
                        <select value={selectedShiftId} onChange={e => setSelectedShiftId(e.target.value)}
                            className="flex-1 text-[13px] font-semibold text-gray-700 outline-none bg-transparent appearance-none cursor-pointer min-w-0"
                            disabled={shiftTimes.length === 0}>
                            {shiftTimes.length === 0
                                ? <option value="">--</option>
                                : shiftTimes.map(s => <option key={s} value={s}>{s}</option>)
                            }
                        </select>
                        <ChevronDown className="w-3.5 h-3.5 text-gray-400 shrink-0 pointer-events-none" />
                    </div>
                </div>
                {!loading && totalEmp > 0 && (
                    <div className="flex items-center gap-2 flex-wrap">
                        <span className="flex items-center gap-1 text-[11px] font-semibold bg-white/15 rounded-full px-2.5 py-1"><User className="w-3 h-3" /> {totalEmp} NV</span>
                        <span className="flex items-center gap-1 text-[11px] font-semibold bg-emerald-400/30 rounded-full px-2.5 py-1"><CheckCircle2 className="w-3 h-3 text-emerald-300" /> {scoredCount} đã chấm</span>
                        {selfCount > 0 && <span className="flex items-center gap-1 text-[11px] font-semibold bg-amber-400/30 rounded-full px-2.5 py-1"><Star className="w-3 h-3 text-amber-300" /> {selfCount} tự chấm</span>}
                    </div>
                )}

                {/* Alerts */}
                {error && (
                    <div className="rounded-2xl bg-red-50 border border-red-100 px-4 py-3 flex items-center gap-2">
                        <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
                        <p className="text-xs text-red-600 flex-1">{error}</p>
                        <button onClick={() => setError('')}><X className="w-4 h-4 text-red-400" /></button>
                    </div>
                )}
                {success && (
                    <div className="rounded-2xl bg-emerald-50 border border-emerald-100 px-4 py-3 flex items-center gap-2">
                        <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                        <p className="text-xs text-emerald-600 flex-1">{success}</p>
                        <button onClick={() => setSuccess('')}><X className="w-4 h-4 text-emerald-400" /></button>
                    </div>
                )}

                {/* ── Prompt: select store first ── */}
                {!effectiveStoreId && !loading && (
                    <div className="flex flex-col items-center justify-center py-16 gap-3">
                        <div className="w-16 h-16 rounded-2xl bg-gray-100 flex items-center justify-center">
                            <Building2 className="w-7 h-7 text-gray-300" />
                        </div>
                        <p className="text-sm font-semibold text-gray-500">Chọn cửa hàng để xem dữ liệu</p>
                    </div>
                )}

                {/* ── Employee cards ── */}
                {effectiveStoreId && (
                    loading ? (
                        <div className="flex flex-col gap-2">
                            {[1, 2, 3].map(i => <div key={i} className="h-28 rounded-2xl bg-gray-100 animate-pulse" />)}
                        </div>
                    ) : employees.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-16 gap-3">
                            <div className="w-16 h-16 rounded-2xl bg-gray-100 flex items-center justify-center"><User className="w-7 h-7 text-gray-300" /></div>
                            <p className="text-sm font-semibold text-gray-500">Không có nhân viên trong ca này</p>
                            <p className="text-xs text-gray-400">Thử chọn ngày hoặc ca khác</p>
                        </div>
                    ) : (
                        <div className="flex flex-col gap-3">
                            {employees.map(emp => {
                                const empScheds = getEmpScheds(emp.uid);
                                const avg = getAvg(emp.uid);
                                const monthlyAvg = getMonthlyAvg(emp.uid);
                                const allDone = empScheds.length > 0 && empScheds.every(s => getRec(emp.uid, s.counterId)?.status === 'OFFICIAL');
                                const anySelf = empScheds.some(s => getRec(emp.uid, s.counterId)?.status === 'SELF_SCORED');
                                return (
                                    <div key={emp.uid} className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                                        <div className="flex items-center gap-3 px-4 py-3 border-b border-gray-100">
                                            <div className={cn('w-10 h-10 rounded-xl flex items-center justify-center text-sm font-bold shrink-0',
                                                allDone ? 'bg-emerald-100 text-emerald-700' : anySelf ? 'bg-primary-100 text-primary-700' : 'bg-gray-100 text-gray-500'
                                            )}>{initials(emp.name)}</div>
                                            <div className="flex-1 min-w-0">
                                                <p className="font-bold text-gray-800 leading-tight truncate">{emp.name}</p>
                                                <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                                                    <p className="text-[11px] text-gray-400">{empScheds.length} quầy · {selectedShiftId}</p>
                                                    {monthlyAvg && (
                                                        <span className="flex items-center gap-1 text-[10px] font-bold px-1.5 py-0.5 rounded-md bg-teal-50 text-teal-700 border border-teal-200">
                                                            TB tháng: {monthlyAvg.avg} ({monthlyAvg.count} ca)
                                                        </span>
                                                    )}
                                                </div>
                                            </div>
                                            {avg !== null && (
                                                <div className={cn('flex items-center gap-1 px-2.5 py-1 rounded-xl border text-[11px] font-bold', scoreColor(avg))}>
                                                    <Award className="w-3 h-3" /> {avg}
                                                </div>
                                            )}
                                            {allDone && <span className="text-[10px] font-bold px-2 py-1 rounded-lg bg-emerald-50 text-emerald-700 border border-emerald-200 whitespace-nowrap">✓ Xong</span>}
                                        </div>
                                        <div className="divide-y divide-gray-50">
                                            {empScheds.length === 0
                                                ? <p className="px-4 py-3 text-xs text-gray-400 italic">Không tìm thấy quầy.</p>
                                                : empScheds.map(sched => {
                                                    const cId = sched.counterId;
                                                    const cName = counters.find(c => c.id === cId)?.name || cId;
                                                    const rec = getRec(emp.uid, cId);
                                                    const tpl = getTpl(cId);
                                                    const isFinal = rec?.status === 'OFFICIAL';
                                                    const isSelf = rec?.status === 'SELF_SCORED';
                                                    return (
                                                        <div key={cId} className="flex items-center gap-3 px-4 py-3">
                                                            <div className="flex-1 min-w-0">
                                                                <p className="text-[13px] font-semibold text-gray-700 truncate">📍 {cName}</p>
                                                                {rec && (
                                                                    <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                                                                        <span className="flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-primary-50 border border-primary-100 text-[10px]">
                                                                            <Star className="w-2.5 h-2.5 text-primary-500" />
                                                                            <span className="font-bold text-primary-700">NV: {rec.selfTotal}</span>
                                                                        </span>
                                                                        {isFinal && (
                                                                            <span className={cn('flex items-center gap-1 px-1.5 py-0.5 rounded-md border text-[10px] font-bold', scoreColor(rec.officialTotal))}>
                                                                                <Award className="w-2.5 h-2.5" /> CK: {rec.officialTotal}
                                                                            </span>
                                                                        )}
                                                                    </div>
                                                                )}
                                                            </div>
                                                            <div className="flex items-center gap-1.5 shrink-0">
                                                                {isFinal
                                                                    ? <span className="text-[10px] font-bold px-2 py-1 rounded-lg bg-emerald-50 text-emerald-700 border border-emerald-200">✓ Đã chấm</span>
                                                                    : isSelf
                                                                        ? <span className="text-[10px] font-bold px-2 py-1 rounded-lg bg-primary-50 text-primary-700 border border-primary-200">★ Tự chấm</span>
                                                                        : <span className="text-[10px] font-bold px-2 py-1 rounded-lg bg-gray-100 text-gray-500 border border-gray-200">Chưa</span>
                                                                }
                                                                <button
                                                                    onClick={() => openScoring(emp, cId)}
                                                                    disabled={!tpl}
                                                                    className={cn(
                                                                        'px-3 py-2 rounded-xl font-semibold text-xs flex items-center gap-1 transition-all active:scale-[0.97]',
                                                                        isFinal ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-primary-600 text-white shadow-sm shadow-primary-500/20',
                                                                        !tpl && 'opacity-40 cursor-not-allowed'
                                                                    )}
                                                                >
                                                                    <ClipboardCheck className="w-3.5 h-3.5" />
                                                                    {isFinal ? 'Sửa' : 'Chấm'}
                                                                </button>
                                                            </div>
                                                        </div>
                                                    );
                                                })
                                            }
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )
                )}
            </div>

            <OfficialScoringModal
                isOpen={scoreModal.isOpen}
                onClose={() => setScoreModal(p => ({ ...p, isOpen: false }))}
                recordId={scoreModal.recordId}
                employeeName={scoreModal.employeeName}
                selfTotal={scoreModal.selfTotal}
                details={scoreModal.details}
                templateGroups={scoreModal.templateGroups}
                onSuccess={() => { setSuccess('Đã lưu điểm chính thức!'); loadData(); }}
            />
        </div>
    );
}
