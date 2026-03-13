'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { db } from '@/lib/firebase';
import { doc, getDoc, collection, query, where, getDocs } from 'firebase/firestore';
import { UserDoc, CounterDoc, StoreDoc, KpiRecordDoc, KpiTemplateDoc, ScheduleDoc } from '@/types';
import { toLocalDateString, getWeekStart, cn } from '@/lib/utils';
import OfficialScoringModal from '@/components/kpi/OfficialScoringModal';
import {
    ClipboardCheck, Calendar, Clock, ChevronDown, Building2,
    CheckCircle2, AlertCircle, X, User, RefreshCw,
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
                        // After reload, the record should exist — user can click again
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

    if (!userDoc || (userDoc.role !== 'admin' && userDoc.role !== 'store_manager' && !hasPermission('score_employees'))) {
        return <div className="p-8 text-center text-danger-500 font-bold">Không có quyền truy cập.</div>;
    }

    return (
        <div className="space-y-6 mx-auto">
            {/* Header */}
            <DashboardHeader
                showSelect={false}
                titleChildren={
                    <div className="flex items-center justify-between w-full">
                        <div>
                            <h1 className="text-2xl font-bold text-surface-800 flex items-center gap-2">
                                <ClipboardCheck className="w-7 h-7 text-accent-600" />
                                Chấm điểm ca trực
                            </h1>
                            <p className="text-surface-500 mt-1 text-sm">Chấm điểm KPI chính thức cho nhân viên theo ca.</p>
                        </div>
                        <button onClick={loadData} className="p-2 rounded-lg hover:bg-surface-100 text-surface-500 transition-colors"><RefreshCw className="w-4 h-4" /></button>
                    </div>
                }
            />

            {/* Admin Store Selector */}
            {userDoc.role === 'admin' && (
                <div className="bg-white rounded-xl border border-surface-200 shadow-sm p-3 flex items-center gap-3">
                    <Building2 className="w-4 h-4 text-accent-500" />
                    <select value={selectedStoreId} onChange={e => setSelectedStoreId(e.target.value)}
                        className="flex-1 border border-surface-200 rounded-lg p-2 text-sm outline-none focus:ring-2 focus:ring-accent-300">
                        <option value="">-- Chọn cửa hàng --</option>
                        {stores.map(s => <option key={s.id} value={s.id}>{(s as any).type === 'OFFICE' ? '🏢' : (s as any).type === 'CENTRAL' ? '🏭' : '🏪'} {s.name}</option>)}
                    </select>
                </div>
            )}

            {/* Controls */}
            <div className="flex flex-col sm:flex-row gap-3">
                <div className="relative bg-white p-2 rounded-xl shadow-sm border border-surface-200 flex-1">
                    <Calendar className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-surface-400" />
                    <input type="date" value={selectedDate} onChange={e => setSelectedDate(e.target.value)}
                        className="pl-9 pr-3 py-2 w-full text-sm outline-none font-medium text-surface-700" />
                </div>

                <div className="relative bg-white p-2 rounded-xl shadow-sm border border-surface-200 min-w-[180px]">
                    <Clock className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-surface-400" />
                    <select value={selectedShiftId} onChange={e => setSelectedShiftId(e.target.value)}
                        className="pl-9 pr-8 py-2 w-full text-sm outline-none font-medium text-surface-700 appearance-none cursor-pointer">
                        {shiftTimes.map(s => <option key={s} value={s}>{s}</option>)}
                    </select>
                    <ChevronDown className="w-4 h-4 absolute right-3 top-1/2 -translate-y-1/2 text-surface-400 pointer-events-none" />
                </div>
            </div>

            {/* Alerts */}
            {error && <div className="bg-danger-50 text-danger-600 p-3 rounded-xl flex items-center gap-2 border border-danger-100">
                <AlertCircle className="w-4 h-4 shrink-0" /><span className="text-sm flex-1">{error}</span>
                <button onClick={() => setError('')}><X className="w-4 h-4" /></button>
            </div>}
            {success && <div className="bg-success-50 text-success-700 p-3 rounded-xl flex items-center gap-2 border border-success-100">
                <CheckCircle2 className="w-4 h-4 shrink-0" /><span className="text-sm flex-1">{success}</span>
                <button onClick={() => setSuccess('')}><X className="w-4 h-4" /></button>
            </div>}

            {/* Employee list */}
            {loading ? (
                <div className="flex justify-center py-12"><div className="w-8 h-8 border-4 border-accent-500 border-t-transparent rounded-full animate-spin" /></div>
            ) : employees.length === 0 ? (
                <div className="bg-white border-2 border-dashed border-surface-300 rounded-2xl p-12 text-center text-surface-400">
                    <User className="w-10 h-10 mx-auto mb-3 text-surface-300" />
                    <p className="font-semibold">Không có nhân viên nào trong ca này</p>
                </div>
            ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                    {employees.map(emp => {
                        // Find which counter this employee is in
                        const empSchedule = schedules.find(s => s.employeeIds.includes(emp.uid));
                        const counterId = empSchedule?.counterId || '';
                        const counterName = counters.find(c => c.id === counterId)?.name || counterId;
                        const record = getRecordForEmployee(emp.uid, counterId);
                        const template = getTemplateForCounter(counterId);

                        return (
                            <div key={emp.uid} className="bg-white border border-surface-200 rounded-xl p-4 shadow-sm hover:shadow-md transition-shadow">
                                <div className="flex items-start justify-between mb-3">
                                    <div className="min-w-0">
                                        <p className="font-bold text-surface-800 truncate">{emp.name}</p>
                                        <p className="text-xs text-surface-400">{counterName} · {selectedShiftId}</p>
                                    </div>
                                    {record?.status === 'OFFICIAL' ? (
                                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-success-100 text-success-700 border border-success-200 shrink-0">
                                            ✓ Đã chấm
                                        </span>
                                    ) : record?.status === 'SELF_SCORED' ? (
                                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-primary-100 text-primary-700 border border-primary-200 shrink-0">
                                            NV đã chấm
                                        </span>
                                    ) : (
                                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-surface-100 text-surface-500 border border-surface-200 shrink-0">
                                            Chưa chấm
                                        </span>
                                    )}
                                </div>

                                {record && (
                                    <div className="flex items-center gap-3 mb-3 text-xs">
                                        <div className="bg-primary-50 text-primary-700 px-2 py-1 rounded-lg font-bold border border-primary-100">
                                            Tự chấm: {record.selfTotal}
                                        </div>
                                        {record.status === 'OFFICIAL' && (
                                            <div className={cn('px-2 py-1 rounded-lg font-bold border',
                                                record.officialTotal >= 80 ? 'bg-success-50 text-success-700 border-success-100' :
                                                    record.officialTotal >= 50 ? 'bg-warning-50 text-warning-700 border-warning-100' :
                                                        'bg-danger-50 text-danger-700 border-danger-100'
                                            )}>
                                                Chính thức: {record.officialTotal}
                                            </div>
                                        )}
                                    </div>
                                )}

                                <button
                                    onClick={() => openScoring(emp, counterId)}
                                    disabled={!template}
                                    className={cn(
                                        'w-full py-2 rounded-lg font-semibold text-sm flex items-center justify-center gap-2 transition-colors',
                                        record?.status === 'OFFICIAL'
                                            ? 'bg-success-50 text-success-700 hover:bg-success-100 border border-success-200'
                                            : 'bg-accent-600 text-white hover:bg-accent-700',
                                        !template && 'opacity-50 cursor-not-allowed'
                                    )}
                                >
                                    <ClipboardCheck className="w-4 h-4" />
                                    {record?.status === 'OFFICIAL' ? 'Sửa điểm' : 'Chấm điểm'}
                                </button>
                                {!template && <p className="text-[10px] text-warning-500 mt-1 text-center">Chưa có mẫu KPI cho quầy này</p>}
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
