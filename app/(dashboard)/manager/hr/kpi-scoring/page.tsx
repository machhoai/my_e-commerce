'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { db } from '@/lib/firebase';
import { doc, getDoc, collection, query, where, getDocs } from 'firebase/firestore';
import { UserDoc, CounterDoc, StoreDoc, KpiRecordDoc, KpiTemplateDoc, ScheduleDoc } from '@/types';
import { toLocalDateString, cn } from '@/lib/utils';
import OfficialScoringModal from '@/components/kpi/OfficialScoringModal';
import {
    ClipboardCheck, Calendar, Clock, ChevronDown, Building2,
    CheckCircle2, AlertCircle, X, User, RefreshCw, Star, Award, TrendingUp,
} from 'lucide-react';
import { DashboardHeader } from '@/components/inventory/overview/DashboardHeader';

export default function ManagerKpiScoringPage() {
    const { user, userDoc, getToken, hasPermission } = useAuth();

    const [selectedDate, setSelectedDate] = useState(toLocalDateString(new Date()));
    const [selectedShiftId, setSelectedShiftId] = useState('');
    const [shiftTimes, setShiftTimes] = useState<string[]>([]);
    const [counters, setCounters] = useState<CounterDoc[]>([]);
    const [templates, setTemplates] = useState<KpiTemplateDoc[]>([]);

    const [employees, setEmployees] = useState<UserDoc[]>([]);
    const [schedules, setSchedules] = useState<ScheduleDoc[]>([]);
    const [kpiRecords, setKpiRecords] = useState<KpiRecordDoc[]>([]);

    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');

    // Admin store selector
    const [stores, setStores] = useState<StoreDoc[]>([]);
    const [selectedStoreId, setSelectedStoreId] = useState(() => {
        if (typeof window !== 'undefined') return localStorage.getItem('globalSelectedStoreId') || '';
        return '';
    });
    const effectiveStoreId = userDoc?.role === 'admin' ? selectedStoreId : userDoc?.storeId ?? '';

    // Official scoring modal state
    const [scoreModal, setScoreModal] = useState<{
        isOpen: boolean;
        recordId: string;
        employeeName: string;
        selfTotal: number;
        details: any[];
        templateGroups: any[];
    }>({ isOpen: false, recordId: '', employeeName: '', selfTotal: 0, details: [], templateGroups: [] });

    // Load admin stores
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

    // Load store config (shifts, counters)
    useEffect(() => {
        if (!effectiveStoreId) return;
        (async () => {
            const snap = await getDoc(doc(db, 'stores', effectiveStoreId));
            if (snap.exists()) {
                const data = snap.data() as StoreDoc;
                const shifts = data.settings?.shiftTimes || [];
                setShiftTimes(shifts);
                setCounters((data.settings as any)?.counters || []);
                if (shifts.length > 0 && !selectedShiftId) setSelectedShiftId(shifts[0]);
            }
        })();
    }, [effectiveStoreId]);

    // Load templates
    useEffect(() => {
        if (!effectiveStoreId || !user) return;
        (async () => {
            const token = await getToken();
            const res = await fetch(`/api/kpi-templates?storeId=${effectiveStoreId}`, { headers: { Authorization: `Bearer ${token}` } });
            const data = await res.json();
            setTemplates(Array.isArray(data) ? data : []);
        })();
    }, [effectiveStoreId, user, getToken]);

    // Load schedules + KPI records for date/shift
    const loadData = useCallback(async () => {
        if (!selectedDate || !selectedShiftId || !effectiveStoreId || !user) return;
        setLoading(true); setError('');
        try {
            const token = await getToken();

            // Fetch schedules for date + shift
            const schedQuery = query(
                collection(db, 'schedules'),
                where('date', '==', selectedDate),
                where('shiftId', '==', selectedShiftId),
                where('storeId', '==', effectiveStoreId)
            );
            const schedSnap = await getDocs(schedQuery);
            const scheds = schedSnap.docs.map(d => ({ id: d.id, ...d.data() } as ScheduleDoc));
            setSchedules(scheds);

            // Get unique employee IDs
            const empIds = new Set<string>();
            scheds.forEach(s => s.employeeIds.forEach(uid => empIds.add(uid)));

            // Fetch employee docs
            const users: UserDoc[] = [];
            const uidArr = Array.from(empIds);
            for (let i = 0; i < uidArr.length; i += 10) {
                const chunk = uidArr.slice(i, i + 10);
                const uQuery = query(collection(db, 'users'), where('uid', 'in', chunk));
                const uSnap = await getDocs(uQuery);
                uSnap.docs.forEach(u => users.push(u.data() as UserDoc));
            }
            users.sort((a, b) => a.name.localeCompare(b.name));
            setEmployees(users);

            // Fetch KPI records for this date
            const res = await fetch(`/api/kpi-records?storeId=${effectiveStoreId}&date=${selectedDate}`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            const records = await res.json();
            setKpiRecords(Array.isArray(records) ? records : []);
        } catch (err) {
            console.error(err);
            setError('Không thể tải dữ liệu');
        } finally { setLoading(false); }
    }, [selectedDate, selectedShiftId, effectiveStoreId, user, getToken]);

    useEffect(() => { loadData(); }, [loadData]);

    const getRecordForEmployee = (uid: string, counterId: string): KpiRecordDoc | undefined => {
        return kpiRecords.find(r => r.userId === uid && r.counterId === counterId && r.shiftId === selectedShiftId);
    };

    const getTemplateForCounter = (counterId: string): KpiTemplateDoc | undefined => {
        return templates.find(t => t.assignedCounterIds?.includes(counterId));
    };

    const openScoring = (emp: UserDoc, counterId: string) => {
        const record = getRecordForEmployee(emp.uid, counterId);
        const template = getTemplateForCounter(counterId);
        if (!template) { setError('Chưa có mẫu KPI cho quầy này'); return; }

        if (record) {
            // Existing record — edit official scores
            setScoreModal({
                isOpen: true,
                recordId: record.id,
                employeeName: emp.name,
                selfTotal: record.selfTotal,
                details: record.details,
                templateGroups: template.groups,
            });
        } else {
            // No self-score yet — create a fresh record with defaults
            const details = template.groups.flatMap(g => g.criteria.map(c => ({
                criteriaName: c.name,
                maxScore: c.maxScore,
                selfScore: 0,
                officialScore: c.maxScore,
                note: '',
            })));

            // First, create a draft record via POST, then open modal
            (async () => {
                try {
                    const token = await getToken();
                    const res = await fetch('/api/kpi-records', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
                        body: JSON.stringify({
                            storeId: effectiveStoreId,
                            shiftId: selectedShiftId,
                            date: selectedDate,
                            counterId,
                            templateId: template.id,
                            userId: emp.uid,
                            details: details.map(d => ({ criteriaName: d.criteriaName, maxScore: d.maxScore, selfScore: 0 })),
                        }),
                    });
                    // If 409 (already exists — employee self-scored in the meantime), reload and re-open
                    if (res.status === 409) {
                        await loadData();
                        setSuccess('Nhân viên đã tự chấm. Dữ liệu đã được cập nhật, vui lòng bấm lại.');
                        return;
                    }
                    const created = await res.json();
                    setScoreModal({
                        isOpen: true,
                        recordId: created.id,
                        employeeName: emp.name,
                        selfTotal: 0,
                        details: created.details || details,
                        templateGroups: template.groups,
                    });
                } catch { setError('Không thể tạo bản ghi KPI'); }
            })();
        }
    };

    // Helper: get initials
    const getInitials = (name: string) => {
        if (!name) return '?';
        const parts = name.trim().split(' ').filter(Boolean);
        if (parts.length >= 2) return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
        return name.substring(0, 2).toUpperCase();
    };

    // KPI summary stats
    const totalEmployees = employees.length;
    const scoredCount = employees.filter(emp => {
        const sched = schedules.find(s => s.employeeIds.includes(emp.uid));
        const record = sched ? getRecordForEmployee(emp.uid, sched.counterId || '') : undefined;
        return record?.status === 'OFFICIAL';
    }).length;
    const selfScoredCount = employees.filter(emp => {
        const sched = schedules.find(s => s.employeeIds.includes(emp.uid));
        const record = sched ? getRecordForEmployee(emp.uid, sched.counterId || '') : undefined;
        return record?.status === 'SELF_SCORED';
    }).length;

    if (!userDoc || (userDoc.role !== 'admin' && userDoc.role !== 'store_manager' && !hasPermission('score_employees'))) {
        return <div className="p-8 text-center text-danger-500 font-bold">Không có quyền truy cập.</div>;
    }

    return (
        <div className="space-y-5 mx-auto">
            {/* ── Premium Header ── */}
            <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-primary-400 via-primary-500 to-accent-500 p-6 shadow-lg shadow-primary-500/20">
                <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHZpZXdCb3g9IjAgMCA2MCA2MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZyBmaWxsPSJub25lIiBmaWxsLXJ1bGU9ImV2ZW5vZGQiPjxnIGZpbGw9IiNmZmYiIGZpbGwtb3BhY2l0eT0iMC4wNSI+PHBhdGggZD0iTTM2IDM0djItSDJ2LTJoMzR6bTAtMzBWMkgydjJoMzR6Ii8+PC9nPjwvZz48L3N2Zz4=')] opacity-50" />
                <div className="relative flex items-center justify-between">
                    <div>
                        <h1 className="text-2xl font-extrabold text-bduck-dark flex items-center gap-2.5 drop-shadow-sm">
                            <div className="w-10 h-10 rounded-xl bg-white/30 backdrop-blur-sm flex items-center justify-center">
                                <ClipboardCheck className="w-5 h-5 text-bduck-dark" />
                            </div>
                            Chấm điểm ca trực
                        </h1>
                        <p className="text-bduck-dark/70 mt-1.5 text-sm font-medium ml-[52px]">
                            Đánh giá KPI chính thức cho nhân viên theo ca làm việc
                        </p>
                    </div>
                    <button
                        onClick={loadData}
                        className="p-2.5 rounded-xl bg-white/20 hover:bg-white/30 text-bduck-dark backdrop-blur-sm transition-all active:scale-95"
                        title="Làm mới"
                    >
                        <RefreshCw className="w-4.5 h-4.5" />
                    </button>
                </div>

                {/* Stats bar */}
                {!loading && totalEmployees > 0 && (
                    <div className="relative flex items-center gap-4 mt-4 ml-[52px]">
                        <div className="flex items-center gap-1.5 text-xs font-bold text-bduck-dark/80">
                            <User className="w-3.5 h-3.5" />
                            {totalEmployees} nhân viên
                        </div>
                        <div className="w-px h-4 bg-bduck-dark/20" />
                        <div className="flex items-center gap-1.5 text-xs font-bold text-bduck-dark/80">
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            {scoredCount} đã chấm
                        </div>
                        {selfScoredCount > 0 && (
                            <>
                                <div className="w-px h-4 bg-bduck-dark/20" />
                                <div className="flex items-center gap-1.5 text-xs font-bold text-bduck-dark/80">
                                    <Star className="w-3.5 h-3.5" />
                                    {selfScoredCount} NV tự chấm
                                </div>
                            </>
                        )}
                    </div>
                )}
            </div>

            {/* ── Admin Store Selector ── */}
            {userDoc.role === 'admin' && (
                <div className="bg-white rounded-xl border border-surface-200 shadow-sm p-3 flex items-center gap-3">
                    <div className="w-9 h-9 rounded-lg bg-accent-50 flex items-center justify-center shrink-0">
                        <Building2 className="w-4 h-4 text-accent-600" />
                    </div>
                    <select value={selectedStoreId} onChange={e => setSelectedStoreId(e.target.value)}
                        className="flex-1 border border-surface-200 rounded-lg p-2 text-sm outline-none focus:ring-2 focus:ring-accent-300 font-medium text-surface-700">
                        <option value="">-- Chọn cửa hàng --</option>
                        {stores.map(s => <option key={s.id} value={s.id}>{(s as any).type === 'OFFICE' ? '🏢' : (s as any).type === 'CENTRAL' ? '🏭' : '🏪'} {s.name}</option>)}
                    </select>
                </div>
            )}

            {/* ── Filter Controls ── */}
            <div className="flex flex-col sm:flex-row gap-3">
                <div className="relative bg-white rounded-xl shadow-sm border border-surface-200 flex-1 group hover:border-primary-300 hover:shadow-md transition-all">
                    <div className="absolute left-3 top-1/2 -translate-y-1/2 w-8 h-8 rounded-lg bg-primary-50 flex items-center justify-center group-hover:bg-primary-100 transition-colors">
                        <Calendar className="w-4 h-4 text-primary-600" />
                    </div>
                    <input type="date" value={selectedDate} onChange={e => setSelectedDate(e.target.value)}
                        className="pl-14 pr-3 py-3 w-full text-sm outline-none font-semibold text-surface-700 rounded-xl" />
                </div>

                <div className="relative bg-white rounded-xl shadow-sm border border-surface-200 min-w-[180px] group hover:border-accent-300 hover:shadow-md transition-all">
                    <div className="absolute left-3 top-1/2 -translate-y-1/2 w-8 h-8 rounded-lg bg-accent-50 flex items-center justify-center group-hover:bg-accent-100 transition-colors">
                        <Clock className="w-4 h-4 text-accent-600" />
                    </div>
                    <select value={selectedShiftId} onChange={e => setSelectedShiftId(e.target.value)}
                        className="pl-14 pr-8 py-3 w-full text-sm outline-none font-semibold text-surface-700 appearance-none cursor-pointer rounded-xl">
                        {shiftTimes.map(s => <option key={s} value={s}>{s}</option>)}
                    </select>
                    <ChevronDown className="w-4 h-4 absolute right-3 top-1/2 -translate-y-1/2 text-surface-400 pointer-events-none" />
                </div>
            </div>

            {/* ── Alerts ── */}
            {error && (
                <div className="bg-danger-50 text-danger-700 p-3.5 rounded-xl flex items-center gap-2.5 border border-danger-200 shadow-sm animate-in slide-in-from-top-2 duration-200">
                    <div className="w-8 h-8 rounded-lg bg-danger-100 flex items-center justify-center shrink-0">
                        <AlertCircle className="w-4 h-4 text-danger-600" />
                    </div>
                    <span className="text-sm flex-1 font-medium">{error}</span>
                    <button onClick={() => setError('')} className="p-1 rounded-lg hover:bg-danger-100 transition-colors"><X className="w-4 h-4" /></button>
                </div>
            )}
            {success && (
                <div className="bg-success-50 text-success-700 p-3.5 rounded-xl flex items-center gap-2.5 border border-success-200 shadow-sm animate-in slide-in-from-top-2 duration-200">
                    <div className="w-8 h-8 rounded-lg bg-success-100 flex items-center justify-center shrink-0">
                        <CheckCircle2 className="w-4 h-4 text-success-600" />
                    </div>
                    <span className="text-sm flex-1 font-medium">{success}</span>
                    <button onClick={() => setSuccess('')} className="p-1 rounded-lg hover:bg-success-100 transition-colors"><X className="w-4 h-4" /></button>
                </div>
            )}

            {/* ── Employee Cards ── */}
            {loading ? (
                <div className="flex flex-col items-center justify-center py-16 gap-3">
                    <div className="w-10 h-10 border-[3px] border-primary-400 border-t-transparent rounded-full animate-spin" />
                    <p className="text-sm text-surface-400 font-medium">Đang tải dữ liệu...</p>
                </div>
            ) : employees.length === 0 ? (
                <div className="bg-white border-2 border-dashed border-surface-200 rounded-2xl p-16 text-center">
                    <div className="w-16 h-16 rounded-2xl bg-surface-100 flex items-center justify-center mx-auto mb-4">
                        <User className="w-7 h-7 text-surface-300" />
                    </div>
                    <p className="font-bold text-surface-700 text-lg">Không có nhân viên</p>
                    <p className="text-sm text-surface-400 mt-1">Không tìm thấy nhân viên nào trong ca này</p>
                </div>
            ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    {employees.map(emp => {
                        const empSchedule = schedules.find(s => s.employeeIds.includes(emp.uid));
                        const counterId = empSchedule?.counterId || '';
                        const counterName = counters.find(c => c.id === counterId)?.name || counterId;
                        const record = getRecordForEmployee(emp.uid, counterId);
                        const template = getTemplateForCounter(counterId);

                        const isOfficial = record?.status === 'OFFICIAL';
                        const isSelfScored = record?.status === 'SELF_SCORED';

                        // Score color
                        const scoreColor = (score: number) =>
                            score >= 80 ? 'text-success-700 bg-success-50 border-success-200' :
                            score >= 50 ? 'text-warning-700 bg-warning-50 border-warning-200' :
                                          'text-danger-700 bg-danger-50 border-danger-200';

                        // Accent bar color
                        const accentColor = isOfficial ? 'bg-success-500' : isSelfScored ? 'bg-primary-400' : 'bg-surface-200';

                        return (
                            <div
                                key={emp.uid}
                                className={cn(
                                    "relative bg-white border rounded-2xl overflow-hidden shadow-sm hover:shadow-lg transition-all duration-300 group",
                                    isOfficial ? "border-success-200" : isSelfScored ? "border-primary-200" : "border-surface-200"
                                )}
                            >
                                {/* Left accent bar */}
                                <div className={cn("absolute left-0 top-0 bottom-0 w-1 rounded-l-2xl", accentColor)} />

                                <div className="p-4 pl-5">
                                    {/* Top row: Avatar + Info + Badge */}
                                    <div className="flex items-start gap-3 mb-3">
                                        <div className={cn(
                                            "w-11 h-11 rounded-xl flex items-center justify-center text-sm font-bold shrink-0 transition-transform group-hover:scale-105",
                                            isOfficial ? "bg-success-100 text-success-700" :
                                            isSelfScored ? "bg-primary-100 text-primary-700" :
                                                           "bg-surface-100 text-surface-600"
                                        )}>
                                            {getInitials(emp.name)}
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <p className="font-bold text-surface-800 truncate leading-tight">{emp.name}</p>
                                            <p className="text-xs text-surface-400 mt-0.5 flex items-center gap-1">
                                                <span className="truncate">{counterName}</span>
                                                <span className="text-surface-300">·</span>
                                                <span>{selectedShiftId}</span>
                                            </p>
                                        </div>
                                        {isOfficial ? (
                                            <span className="flex items-center gap-1 text-[10px] font-bold px-2 py-1 rounded-lg bg-success-100 text-success-700 border border-success-200 shrink-0 whitespace-nowrap">
                                                <CheckCircle2 className="w-3 h-3" /> Đã chấm
                                            </span>
                                        ) : isSelfScored ? (
                                            <span className="flex items-center gap-1 text-[10px] font-bold px-2 py-1 rounded-lg bg-primary-100 text-primary-700 border border-primary-200 shrink-0 whitespace-nowrap">
                                                <Star className="w-3 h-3" /> NV tự chấm
                                            </span>
                                        ) : (
                                            <span className="flex items-center gap-1 text-[10px] font-bold px-2 py-1 rounded-lg bg-surface-100 text-surface-500 border border-surface-200 shrink-0 whitespace-nowrap">
                                                Chưa chấm
                                            </span>
                                        )}
                                    </div>

                                    {/* Score display */}
                                    {record && (
                                        <div className="flex items-center gap-2 mb-3">
                                            <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-primary-50 border border-primary-100 text-xs">
                                                <Star className="w-3 h-3 text-primary-500" />
                                                <span className="font-bold text-primary-700">NV: {record.selfTotal}</span>
                                            </div>
                                            {isOfficial && (
                                                <div className={cn("flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-xs", scoreColor(record.officialTotal))}>
                                                    <Award className="w-3 h-3" />
                                                    <span className="font-bold">CK: {record.officialTotal}</span>
                                                </div>
                                            )}
                                            {isOfficial && record.officialTotal >= 80 && (
                                                <div className="flex items-center gap-1 px-2 py-1.5 rounded-lg bg-success-50 text-success-600 text-xs border border-success-100">
                                                    <TrendingUp className="w-3 h-3" />
                                                </div>
                                            )}
                                        </div>
                                    )}

                                    {/* Action button */}
                                    <button
                                        onClick={() => openScoring(emp, counterId)}
                                        disabled={!template}
                                        className={cn(
                                            'w-full py-2.5 rounded-xl font-semibold text-sm flex items-center justify-center gap-2 transition-all duration-200 active:scale-[0.98]',
                                            isOfficial
                                                ? 'bg-success-50 text-success-700 hover:bg-success-100 border border-success-200'
                                                : 'bg-gradient-to-r from-accent-500 to-accent-600 text-white hover:from-accent-600 hover:to-accent-700 shadow-sm shadow-accent-500/20',
                                            !template && 'opacity-50 cursor-not-allowed !shadow-none'
                                        )}
                                    >
                                        <ClipboardCheck className="w-4 h-4" />
                                        {isOfficial ? 'Xem & sửa điểm' : 'Chấm điểm'}
                                    </button>
                                    {!template && <p className="text-[10px] text-warning-500 mt-1.5 text-center font-medium">⚠ Chưa có mẫu KPI cho quầy này</p>}
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}

            {/* Official Scoring Modal */}
            <OfficialScoringModal
                isOpen={scoreModal.isOpen}
                onClose={() => setScoreModal(prev => ({ ...prev, isOpen: false }))}
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
