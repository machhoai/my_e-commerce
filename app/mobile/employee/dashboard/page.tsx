'use client';

import { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { db } from '@/lib/firebase';
import { collection, query, where, getDocs, doc, getDoc, onSnapshot } from 'firebase/firestore';
import { ScheduleDoc, StoreDoc, SettingsDoc, KpiTemplateDoc } from '@/types';
import { getWeekStart, getWeekDays, toLocalDateString, cn } from '@/lib/utils';
import { getReferralPoints } from '@/actions/referral';
import { useStoreSettings } from '@/hooks/useStoreSettings';
import {
    ChevronLeft, ChevronRight, Clock, MapPin, TrendingUp,
    ChevronDown, ClipboardCheck, Loader2, Star,
} from 'lucide-react';
import MobilePageShell from '@/components/mobile/MobilePageShell';
import SelfScoringModal from '@/components/kpi/SelfScoringModal';
import { useMobileTranslation } from '@/lib/i18n';

function shortenName(fullName: string): string {
    const parts = fullName.trim().split(/\s+/);
    if (parts.length <= 2) return fullName;
    return parts.slice(1).join(' ');
}

export default function MobileEmployeeDashboardPage() {
    const router = useRouter();
    const { user, userDoc, loading: authLoading, hasPermission, getToken, effectiveStoreId: contextStoreId } = useAuth();
    const { t, locale } = useMobileTranslation();
    const { referralEnabled } = useStoreSettings();
    const [currentWeekStart, setCurrentWeekStart] = useState<Date>(getWeekStart(new Date()));
    const weekDays = getWeekDays(currentWeekStart);

    const [schedules, setSchedules] = useState<ScheduleDoc[]>([]);
    const [monthlySchedules, setMonthlySchedules] = useState<ScheduleDoc[]>([]);
    const [counters, setCounters] = useState<Record<string, string>>({});
    const [settings, setSettings] = useState<SettingsDoc | null>(null);
    const [loading, setLoading] = useState(true);
    const [expandedDays, setExpandedDays] = useState<Set<string>>(new Set());

    // KPI
    const [kpiTemplates, setKpiTemplates] = useState<KpiTemplateDoc[]>([]);
    const [selfScoreModal, setSelfScoreModal] = useState<{
        isOpen: boolean; template: KpiTemplateDoc | null; shiftId: string; date: string; counterId: string;
    }>({ isOpen: false, template: null, shiftId: '', date: '', counterId: '' });
    const [referralPoints, setReferralPoints] = useState(0);

    const storeId = contextStoreId || userDoc?.storeId || '';

    // Translated day labels
    const dayLabels = useMemo(() => [
        t('employee.daySunday'), t('employee.dayMonday'), t('employee.dayTuesday'),
        t('employee.dayWednesday'), t('employee.dayThursday'), t('employee.dayFriday'),
        t('employee.daySaturday'),
    ], [t]);

    useEffect(() => {
        if (!user) return;
        setLoading(true);

        // Fetch store settings + counters
        const fetchStore = async () => {
            if (!storeId) return;
            try {
                const storeSnap = await getDoc(doc(db, 'stores', storeId));
                if (storeSnap.exists()) {
                    const storeData = storeSnap.data() as StoreDoc;
                    const s = storeData.settings as SettingsDoc;
                    if (s) setSettings(s);
                    const arr = (s as any)?.counters || [];
                    const map: Record<string, string> = {};
                    arr.forEach((c: any) => { map[c.id] = c.name; });
                    setCounters(map);
                }
            } catch { /* silent */ }
        };
        fetchStore();

        // KPI templates
        const fetchKpi = async () => {
            if (!storeId) return;
            try {
                const token = await getToken();
                const res = await fetch(`/api/kpi-templates?storeId=${storeId}`, { headers: { Authorization: `Bearer ${token}` } });
                const data = await res.json();
                setKpiTemplates(Array.isArray(data) ? data : []);
            } catch { /* */ }
        };
        fetchKpi();

        // Real-time schedules
        const q = query(collection(db, 'schedules'), where('employeeIds', 'array-contains', user.uid));
        const unsub = onSnapshot(q, (snapshot) => {
            setSchedules(snapshot.docs.map(d => ({ id: d.id, ...d.data() } as ScheduleDoc)));
            setLoading(false);
        });

        // Monthly schedules
        const fetchMonthly = async () => {
            const d = new Date();
            const startStr = toLocalDateString(new Date(d.getFullYear(), d.getMonth(), 1));
            const endStr = toLocalDateString(new Date(d.getFullYear(), d.getMonth() + 1, 0));
            const snap = await getDocs(query(
                collection(db, 'schedules'),
                where('employeeIds', 'array-contains', user.uid),
                where('date', '>=', startStr),
                where('date', '<=', endStr),
            ));
            setMonthlySchedules(snap.docs.map(d => ({ id: d.id, ...d.data() } as ScheduleDoc)));
        };
        fetchMonthly();

        return () => unsub();
    }, [user]); // eslint-disable-line react-hooks/exhaustive-deps

    // Fetch referral points (only when program is enabled)
    useEffect(() => {
        if (!user || !referralEnabled) return;
        getReferralPoints(user.uid).then(p => setReferralPoints(p)).catch(() => {});
    }, [user, referralEnabled]);

    // Auto-expand today
    useEffect(() => {
        const todayStr = toLocalDateString(new Date());
        if (weekDays.includes(todayStr)) setExpandedDays(new Set([todayStr]));
        else setExpandedDays(new Set(weekDays.length > 0 ? [weekDays[0]] : []));
    }, [weekDays.join(',')]); // eslint-disable-line react-hooks/exhaustive-deps

    const todayStr = toLocalDateString(new Date());
    const schedulesByDate = schedules.reduce((acc, s) => {
        if (!acc[s.date]) acc[s.date] = [];
        acc[s.date].push(s);
        return acc;
    }, {} as Record<string, ScheduleDoc[]>);

    const getTemplateForCounter = (counterId: string) => kpiTemplates.find(t => t.assignedCounterIds?.includes(counterId));

    // Monthly summary
    const now = new Date();
    const uniqueShiftKeys = new Set(
        monthlySchedules.filter(s => s.date < todayStr).map(s => `${s.date}_${s.shiftId}`)
    );
    const completedShifts = uniqueShiftKeys.size;
    const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
    const isFT = userDoc?.type === 'FT';
    const maxShifts = isFT
        ? Math.max(0, daysInMonth - (settings?.monthlyQuotas?.ftDaysOff ?? 4))
        : (settings?.monthlyQuotas?.ptMaxShifts ?? 25);
    const progress = Math.min((completedShifts / Math.max(1, maxShifts)) * 100, 100);

    const previousWeek = () => setCurrentWeekStart(d => { const nd = new Date(d); nd.setDate(nd.getDate() - 7); return nd; });
    const nextWeek = () => setCurrentWeekStart(d => { const nd = new Date(d); nd.setDate(nd.getDate() + 7); return nd; });
    const toggleDay = (dateStr: string) => setExpandedDays(prev => { const next = new Set(prev); if (next.has(dateStr)) next.delete(dateStr); else next.add(dateStr); return next; });
    const isToday = (dateStr: string) => new Date().toDateString() === new Date(dateStr + 'T00:00:00').toDateString();

    const dateLocaleCode = locale === 'zh' ? 'zh-CN' : 'vi-VN';
    const weekLabel = weekDays.length > 0
        ? `${new Date(weekDays[0] + 'T00:00:00').toLocaleDateString(dateLocaleCode, { day: '2-digit', month: '2-digit' })} — ${new Date(weekDays[6] + 'T00:00:00').toLocaleDateString(dateLocaleCode, { day: '2-digit', month: '2-digit' })}`
        : '';

    return (
        <MobilePageShell title={t('employee.scheduleTitle')}>
            {/* Monthly summary card */}
            {!loading && (
                <div className="bg-gradient-to-br from-primary-50 to-blue-50 border border-primary-100 rounded-2xl p-3 mb-3">
                    <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                            <TrendingUp className="w-4 h-4 text-primary-500" />
                            <span className="text-xs font-bold text-primary-900">{t('employee.monthProgress', { month: now.getMonth() + 1 })}</span>
                        </div>
                        <span className="text-xs font-black text-primary-600">{t('employee.shiftsCompleted', { completed: completedShifts, max: maxShifts })}</span>
                    </div>
                    <div className="h-2 bg-primary-100 rounded-full overflow-hidden">
                        <div
                            className={cn('h-full rounded-full transition-all duration-700',
                                completedShifts > maxShifts ? 'bg-red-500' : completedShifts >= maxShifts - 1 ? 'bg-amber-400' : 'bg-primary-500')}
                            style={{ width: `${progress}%` }}
                        />
                    </div>
                    <p className="text-[10px] text-primary-700/70 mt-1.5">
                        {t('employee.shiftsCountedNote')} · {isFT ? t('employee.fullTime') : t('employee.partTime')}
                    </p>
                </div>
            )}

            {/* Referral Points Card — hidden when referral program is disabled */}
            {!loading && referralEnabled && (
                <button
                    onClick={() => router.push('/employee/referral-history')}
                    className="bg-gradient-to-br from-amber-50 via-yellow-50 to-amber-100 border border-amber-200 rounded-2xl p-3 mb-3 flex items-center gap-3 w-full text-left active:scale-[0.98] transition-transform"
                >
                    <span className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-400 to-yellow-500 flex items-center justify-center shadow-md shadow-amber-200/50 shrink-0">
                        <Star className="w-5 h-5 text-white" />
                    </span>
                    <div className="flex-1">
                        <p className="text-[10px] text-amber-600 font-semibold uppercase tracking-wider">{t('employee.referralPoints')}</p>
                        <p className="text-xl font-black text-amber-800 leading-tight">{referralPoints.toLocaleString(dateLocaleCode)}</p>
                    </div>
                    <ChevronRight className="w-4 h-4 text-amber-400" />
                </button>
            )}

            {/* Week nav */}
            <div className="flex items-center gap-1 mb-2">
                <button onClick={previousWeek} className="w-7 h-7 rounded-lg bg-white border border-gray-200 flex items-center justify-center active:scale-95 transition-transform shrink-0">
                    <ChevronLeft className="w-3.5 h-3.5 text-gray-500" />
                </button>
                <div className="flex-1 text-center text-xs font-bold text-gray-700">{weekLabel}</div>
                <button onClick={nextWeek} className="w-7 h-7 rounded-lg bg-white border border-gray-200 flex items-center justify-center active:scale-95 transition-transform shrink-0">
                    <ChevronRight className="w-3.5 h-3.5 text-gray-500" />
                </button>
            </div>

            {/* Days accordion */}
            {loading ? (
                <div className="flex items-center justify-center py-10">
                    <Loader2 className="w-6 h-6 text-primary-400 animate-spin" />
                </div>
            ) : (
                <div className="space-y-1.5">
                    {weekDays.map(dateStr => {
                        const dateObj = new Date(dateStr + 'T00:00:00');
                        const today = isToday(dateStr);
                        const expanded = expandedDays.has(dateStr);
                        const dayScheds = schedulesByDate[dateStr] || [];

                        return (
                            <div key={dateStr} className={cn('bg-white rounded-xl border overflow-hidden transition-all', today ? 'border-primary-200 shadow-sm' : 'border-gray-100')}>
                                <button onClick={() => toggleDay(dateStr)} className="w-full flex items-center gap-2.5 px-3 py-2.5 active:bg-gray-50 transition-colors">
                                    <div className={cn('w-9 h-9 rounded-lg flex flex-col items-center justify-center shrink-0', today ? 'bg-primary-600 text-white' : 'bg-gray-100 text-gray-600')}>
                                        <span className="text-[8px] font-bold leading-none uppercase">{dateObj.toLocaleDateString(dateLocaleCode, { weekday: 'short' })}</span>
                                        <span className="text-sm font-black leading-tight">{dateObj.getDate()}</span>
                                    </div>
                                    <div className="flex-1 text-left">
                                        <p className={cn('text-xs font-bold', today ? 'text-primary-700' : 'text-gray-700')}>
                                            {dayLabels[dateObj.getDay()]}
                                            {today && <span className="ml-1.5 text-[9px] bg-primary-100 text-primary-600 px-1.5 py-0.5 rounded font-bold">{t('common.today')}</span>}
                                        </p>
                                        <p className="text-[10px] text-gray-500 font-medium">
                                            {dayScheds.length > 0 ? t('employee.shiftsAssigned', { count: dayScheds.length }) : t('employee.noShift')}
                                        </p>
                                    </div>
                                    {dayScheds.length > 0 && <span className="text-[9px] font-bold text-primary-500 bg-primary-50 px-1.5 py-0.5 rounded">{dayScheds.length}</span>}
                                    <ChevronDown className={cn('w-4 h-4 text-gray-400 transition-transform shrink-0', expanded && 'rotate-180')} />
                                </button>

                                {expanded && (
                                    <div className="border-t border-gray-50 px-3 py-2 space-y-2">
                                        {dayScheds.length > 0 ? dayScheds.map(sched => {
                                            const isForceAssigned = sched.assignedByManagerUids?.includes(user!.uid) ?? false;
                                            const template = getTemplateForCounter(sched.counterId);

                                            return (
                                                <div key={sched.id} className={cn('rounded-lg border p-3 transition-all',
                                                    isForceAssigned ? 'border-amber-200 bg-amber-50/30' : 'border-gray-100 bg-white')}>
                                                    <div className="flex items-center justify-between mb-1.5">
                                                        <div className="flex items-center gap-1.5">
                                                            <Clock className={cn('w-3.5 h-3.5', isForceAssigned ? 'text-amber-500' : 'text-primary-500')} />
                                                            <span className="text-sm font-bold text-gray-800">{sched.shiftId}</span>
                                                        </div>
                                                        {isForceAssigned && (
                                                            <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-amber-100 text-amber-700 border border-amber-200">{t('employee.managerAssigned')}</span>
                                                        )}
                                                    </div>
                                                    <div className="flex items-center gap-1.5 text-xs text-gray-600 bg-gray-50 rounded-lg px-2 py-1.5 border border-gray-100">
                                                        <MapPin className="w-3 h-3 text-gray-400" />
                                                        <span className="font-medium">{counters[sched.counterId] || sched.counterId}</span>
                                                    </div>

                                                    {/* KPI self-score button for today */}
                                                    {today && template && (
                                                        <button
                                                            onClick={() => setSelfScoreModal({
                                                                isOpen: true, template, shiftId: sched.shiftId, date: dateStr, counterId: sched.counterId,
                                                            })}
                                                            className="mt-2 w-full py-2 rounded-lg bg-teal-50 border border-teal-200 text-teal-700 text-xs font-bold flex items-center justify-center gap-1.5 active:scale-[0.98] transition-transform"
                                                        >
                                                            <ClipboardCheck className="w-3.5 h-3.5" />
                                                            {t('employee.selfScoreKPI')}
                                                        </button>
                                                    )}
                                                </div>
                                            );
                                        }) : (
                                            <div className="flex flex-col items-center justify-center py-4 text-gray-400">
                                                <Clock className="w-5 h-5 text-gray-300 mb-1" />
                                                <span className="text-xs">{t('employee.noShiftToday')}</span>
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
            )}

            {/* CTA to register */}
            <button
                onClick={() => router.push('/employee/register')}
                className="mt-3 w-full py-3 rounded-xl bg-primary-600 text-white text-xs font-bold active:scale-[0.98] transition-transform shadow-md shadow-primary-200"
            >
                {t('employee.registerNextWeek')}
            </button>

            {/* Self Scoring Modal */}
            {selfScoreModal.template && (
                <SelfScoringModal
                    isOpen={selfScoreModal.isOpen}
                    onClose={() => setSelfScoreModal(prev => ({ ...prev, isOpen: false }))}
                    template={selfScoreModal.template}
                    shiftId={selfScoreModal.shiftId}
                    date={selfScoreModal.date}
                    counterId={selfScoreModal.counterId}
                    storeId={storeId}
                    onSuccess={() => { }}
                />
            )}
        </MobilePageShell>
    );
}
