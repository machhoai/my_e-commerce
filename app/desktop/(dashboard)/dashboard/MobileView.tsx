'use client';

import { MobileLangProvider, useMobileLang } from './MobileLangContext';

import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { db } from '@/lib/firebase';
import { collection, query, getDocs, where, getDoc, doc, onSnapshot } from 'firebase/firestore';
import {
    QrCode, PlusSquare, ClipboardList, ClipboardCheck, LayoutGrid,
    ChevronRight, ChevronDown, ChevronLeft,
    Clock, CheckCircle2, AlertTriangle,
    Users, TrendingUp, Activity,
    ShoppingCart, DollarSign,
    Package, PackagePlus, ArrowLeftRight,
    User, Bell, Building2,
    Calendar, Loader2, Settings,
    // Revenue tab icons
    BarChart3, Banknote, ArrowUpDown, Coins, XCircle, RefreshCw,
    Wifi, WifiOff, CalendarDays, CalendarRange,
    // Extra icons for new routes
    FileText, Repeat, LayoutDashboard, Star, Ticket, Link2,
} from 'lucide-react';
import {
    AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
    XAxis, YAxis, CartesianGrid,
    Tooltip as RechartsTooltip, ResponsiveContainer,
} from 'recharts';
import { cn } from '@/lib/utils';
import Image from 'next/image';
import { CustomRoleDoc, KpiRecordDoc, UserDoc, ScheduleDoc, StoreDoc } from '@/types';
import BottomSheet from '@/components/shared/BottomSheet';
import { subscribeDocument } from '@/lib/firestore';
import { JOYWORLD_CACHE_COLLECTION, getCacheDocId, type RevenueCache } from '@/lib/revenue-cache';
import {
    fetchRevenueFromCache, triggerSyncAction,
    type RevenueRecord, type SellCategory, type DailyPanel,
} from '@/app/desktop/(dashboard)/office/revenue/actions';
import ReferralPointsWidget from '@/components/referral/ReferralPointsWidget';
import TopReferralMarquee from '@/components/referral/TopReferralMarquee';
import ReferralCelebrationModal from '@/components/referral/ReferralCelebrationModal';

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────
type ManagementTab = 'operation' | 'revenue' | 'inventory';

// ─────────────────────────────────────────────────────────────────────────────
// Sub-components
// ─────────────────────────────────────────────────────────────────────────────

/** Native-app-style icon button for Quick Access */
function QuickAccessItem({
    icon: Icon,
    label,
    colorClass,
    onClick,
}: {
    icon: React.ElementType;
    label: string;
    colorClass: string;
    onClick?: () => void;
}) {
    return (
        <button
            onClick={onClick}
            className={cn(
                'flex flex-col items-center gap-1.5 flex-1',
                'active:scale-95 transition-transform duration-100',
            )}
        >
            <span className={cn(
                'w-14 h-14 rounded-2xl flex items-center justify-center shadow-sm',
                colorClass,
            )}>
                <Icon className="w-6 h-6" strokeWidth={1.75} />
            </span>
            <span className="text-[11px] font-medium text-gray-600 leading-tight text-center truncate">
                {label}
            </span>
        </button>
    );
}

// ─────────────────────────────────────────────────────────────────────────────
// View A: Personal Schedule + KPI (for Staff / employee role) — real Firestore data
// ─────────────────────────────────────────────────────────────────────────────
function PersonalScheduleView({ onNavigate, onNavigateRegister }: { onNavigate: () => void; onNavigateRegister: () => void }) {
    const { t } = useMobileLang();
    const { user, userDoc, effectiveStoreId: contextStoreId } = useAuth();
    const storeId = contextStoreId || userDoc?.storeId || '';
    const [todayShift, setTodayShift] = useState<string | null>(null);
    const [nextShift, setNextShift] = useState<{ dayLabel: string; shiftId: string } | null>(null);
    const [monthlyShifts, setMonthlyShifts] = useState<number>(0);
    const [kpiAvg, setKpiAvg] = useState<number | null>(null);
    const [registeredCount, setRegisteredCount] = useState<number>(0);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (!user?.uid || !storeId) { setLoading(false); return; }
        let cancelled = false;
        (async () => {
            setLoading(true);
            try {
                const now = new Date();
                const todayStr = toLocalISO(now);

                // ── This week schedule ──
                const monday = getMondayOf(now);
                const sunday = new Date(monday);
                sunday.setDate(monday.getDate() + 6);

                const schedSnap = await getDocs(query(
                    collection(db, 'schedules'),
                    where('storeId', '==', storeId),
                    where('date', '>=', toLocalISO(monday)),
                    where('date', '<=', toLocalISO(sunday)),
                ));
                if (cancelled) return;

                const mySchedules = schedSnap.docs
                    .map(d => d.data() as ScheduleDoc)
                    .filter(s => s.employeeIds?.includes(user.uid))
                    .sort((a, b) => a.date.localeCompare(b.date));

                const todayEntry = mySchedules.find(s => s.date === todayStr);
                setTodayShift(todayEntry?.shiftId ?? null);

                const futureEntries = mySchedules.filter(s => s.date > todayStr);
                if (futureEntries.length > 0) {
                    const next = futureEntries[0];
                    const d = new Date(next.date + 'T00:00:00');
                    setNextShift({ dayLabel: d.toLocaleDateString('vi-VN', { weekday: 'long', day: '2-digit', month: '2-digit' }), shiftId: next.shiftId });
                } else {
                    setNextShift(null);
                }

                // ── Monthly shifts worked ──
                const monthStart = toLocalISO(new Date(now.getFullYear(), now.getMonth(), 1));
                const monthEnd = toLocalISO(new Date(now.getFullYear(), now.getMonth() + 1, 0));
                const monthSnap = await getDocs(query(
                    collection(db, 'schedules'),
                    where('employeeIds', 'array-contains', user.uid),
                    where('date', '>=', monthStart),
                    where('date', '<=', monthEnd),
                ));
                if (cancelled) return;
                const uniqueShiftKeys = new Set(
                    monthSnap.docs.map(d => d.data() as ScheduleDoc)
                        .filter(s => s.date < todayStr)
                        .map(s => `${s.date}_${s.shiftId}`)
                );
                setMonthlyShifts(uniqueShiftKeys.size);

                // ── KPI average this month ──
                const kpiSnap = await getDocs(query(
                    collection(db, 'kpi_records'),
                    where('userId', '==', user.uid),
                    where('storeId', '==', storeId),
                    where('date', '>=', monthStart),
                    where('date', '<=', monthEnd),
                ));
                if (cancelled) return;
                const officialKpis = kpiSnap.docs.map(d => d.data()).filter(k => k.status === 'OFFICIAL');
                setKpiAvg(officialKpis.length > 0 ? Math.round(officialKpis.reduce((s, k) => s + k.officialTotal, 0) / officialKpis.length) : null);

                // ── Registered shifts for next week ──
                const nextMon = getMondayOf(now);
                nextMon.setDate(nextMon.getDate() + 7);
                const nextWeekStr = toLocalISO(nextMon);
                const regSnap = await getDocs(query(
                    collection(db, 'weekly_registrations'),
                    where('userId', '==', user.uid),
                    where('weekStartDate', '==', nextWeekStr),
                ));
                if (cancelled) return;
                const regShifts = regSnap.docs.length > 0 ? (regSnap.docs[0].data().shifts?.length ?? 0) : 0;
                setRegisteredCount(regShifts);
            } catch (e) {
                console.error('[PersonalSchedule]', e);
            } finally {
                if (!cancelled) setLoading(false);
            }
        })();
        return () => { cancelled = true; };
    }, [user?.uid, userDoc?.storeId]);

    if (loading) {
        return (
            <section className="px-3 mt-4">
                <div className="flex items-center justify-center py-6">
                    <div className="w-5 h-5 border-2 border-primary-200 border-t-primary-600 rounded-full animate-spin" />
                </div>
            </section>
        );
    }

    return (
        <section className="px-3 mt-4 flex flex-col gap-3">
            <h2 className="text-sm font-bold text-gray-800">{t('personalScheduleTitle')}</h2>

            {/* Today's shift card — tappable → /employee/dashboard */}
            <button
                onClick={onNavigate}
                className={cn(
                    'w-full text-left rounded-2xl shadow-sm overflow-hidden',
                    'bg-white border border-gray-100',
                    'active:scale-[0.98] transition-transform duration-100',
                )}
            >
                <div className={cn('h-1', todayShift ? 'bg-gradient-to-r from-primary-400 to-primary-600' : 'bg-gradient-to-r from-gray-300 to-gray-400')} />
                <div className="p-4 flex items-center gap-3">
                    <span className={cn('w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0', todayShift ? 'bg-primary-50 text-primary-600' : 'bg-gray-100 text-gray-400')}>
                        <Clock className="w-6 h-6" strokeWidth={1.75} />
                    </span>
                    <div className="flex-1 min-w-0">
                        <p className="text-[11px] font-medium text-gray-400 uppercase tracking-wide">{t('today')}</p>
                        {todayShift ? (
                            <p className="text-xl font-bold text-gray-900 mt-0.5 tracking-tight">{todayShift}</p>
                        ) : (
                            <p className="text-lg font-bold text-gray-400 mt-0.5">{t('dayOff')}</p>
                        )}
                    </div>
                    <ChevronRight className="w-4 h-4 text-gray-300 flex-shrink-0" />
                </div>
            </button>

            {/* KPI stats row — 3 mini cards */}
            <div className="grid grid-cols-3 gap-2">
                {/* Shifts worked this month */}
                <button onClick={onNavigate} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-3 flex flex-col items-center gap-1 active:scale-[0.97] transition-transform">
                    <span className="w-8 h-8 rounded-lg bg-blue-50 text-blue-500 flex items-center justify-center">
                        <Calendar className="w-4 h-4" strokeWidth={2} />
                    </span>
                    <span className="text-lg font-black text-gray-900">{monthlyShifts}</span>
                    <span className="text-[9px] font-medium text-gray-400 text-center leading-tight">{t('monthlyShifts')}</span>
                </button>

                {/* KPI average */}
                <button onClick={onNavigate} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-3 flex flex-col items-center gap-1 active:scale-[0.97] transition-transform">
                    <span className="w-8 h-8 rounded-lg bg-amber-50 text-amber-500 flex items-center justify-center">
                        <TrendingUp className="w-4 h-4" strokeWidth={2} />
                    </span>
                    <span className="text-lg font-black text-gray-900">{kpiAvg !== null ? kpiAvg : '—'}</span>
                    <span className="text-[9px] font-medium text-gray-400 text-center leading-tight">{t('kpiAvg')}</span>
                </button>

                {/* Registered shifts → /employee/register */}
                <button onClick={onNavigateRegister} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-3 flex flex-col items-center gap-1 active:scale-[0.97] transition-transform">
                    <span className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-500 flex items-center justify-center">
                        <Activity className="w-4 h-4" strokeWidth={2} />
                    </span>
                    <span className="text-lg font-black text-gray-900">{registeredCount}</span>
                    <span className="text-[9px] font-medium text-gray-400 text-center leading-tight">{t('registeredNextWeek')}</span>
                </button>
            </div>

            {/* Next shift teaser */}
            {nextShift && (
                <div className="rounded-2xl bg-white border border-gray-100 shadow-sm p-4 flex items-center gap-3">
                    <span className="w-10 h-10 rounded-xl bg-amber-50 text-amber-500 flex items-center justify-center flex-shrink-0">
                        <Clock className="w-5 h-5" strokeWidth={1.75} />
                    </span>
                    <div className="flex-1 min-w-0">
                        <p className="text-[11px] text-gray-400 font-medium uppercase tracking-wide">{t('nextShift')}</p>
                        <p className="text-sm font-semibold text-gray-800">{nextShift.dayLabel} · {nextShift.shiftId}</p>
                    </div>
                </div>
            )}

            {/* Referral Points widget — only for employees */}

        </section>
    );
}

// ─────────────────────────────────────────────────────────────────────────────
// View B: Management Tabs (for Admin / Manager roles)
// ─────────────────────────────────────────────────────────────────────────────

/** Shared metric card */
function MetricCard({
    value,
    sub,
    icon: Icon,
    colorClass = 'bg-gray-50 text-gray-500',
    alert,
}: {
    value: string | number;
    sub?: string;
    icon?: React.ElementType;
    colorClass?: string;
    alert?: boolean;
}) {
    return (
        <div className={cn(
            'rounded-2xl bg-white border shadow-sm p-2 flex flex-col gap-1 flex-1 justify-center',
            alert ? 'border-amber-200' : 'border-gray-100',
        )}>
            {Icon && (
                <span className={cn('w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0', colorClass)}>
                    <Icon className="w-5 h-5" strokeWidth={1.75} />
                </span>
            )}
            <div className="flex-1 flex flex-col items-center min-w-0">
                <p className="text-2xl font-bold text-gray-900 mt-0.5 tracking-tight leading-tight">{value}</p>
                {sub && (
                    <p className={cn('text-xs mt-0.5', alert ? 'text-amber-500 font-medium' : 'text-gray-400')}>
                        {sub}
                    </p>
                )}
            </div>
            {alert && (
                <AlertTriangle className="w-4 h-4 text-amber-400 flex-shrink-0 mt-0.5" strokeWidth={2} />
            )}
        </div>
    );
}

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────
function toLocalISO(d: Date): string {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
}
function getMondayOf(d: Date): Date {
    const day = d.getDay(); // 0=Sun
    const diff = day === 0 ? -6 : 1 - day;
    const mon = new Date(d);
    mon.setDate(d.getDate() + diff);
    mon.setHours(0, 0, 0, 0);
    return mon;
}
const DAY_LABELS = ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'];

// ─────────────────────────────────────────────────────────────────────────────
// Operation Tab — real data
// ─────────────────────────────────────────────────────────────────────────────
function OperationTab({ effectiveStoreId }: { effectiveStoreId: string }) {
    const { t } = useMobileLang();
    const [loading, setLoading] = useState(true);
    const [staffCount, setStaffCount] = useState<number | null>(null);
    const [kpiAvg, setKpiAvg] = useState<number | null>(null);
    const [weekSchedules, setWeekSchedules] = useState<ScheduleDoc[]>([]);
    const [weekDays, setWeekDays] = useState<Date[]>([]);
    const [weekOffset, setWeekOffset] = useState(0);
    const [shiftNames, setShiftNames] = useState<string[]>([]);
    // uid -> full UserDoc (for names + role)
    const [userMap, setUserMap] = useState<Map<string, UserDoc>>(new Map());
    // selected day for the bottom sheet (ISO string)
    const [selectedDay, setSelectedDay] = useState<string | null>(null);
    // staff registered for next Mon-Sun
    const [nextWeekCount, setNextWeekCount] = useState<number | null>(null);

    // ── Calendar section — independent week navigation ────────────────────────
    const [calendarWeekOffset, setCalendarWeekOffset] = useState(0);
    const [calendarWeekDays, setCalendarWeekDays] = useState<Date[]>([]);
    const [calendarWeekSchedules, setCalendarWeekSchedules] = useState<ScheduleDoc[]>([]);
    const [calendarLoading, setCalendarLoading] = useState(true);

    useEffect(() => {
        if (!effectiveStoreId) {
            setStaffCount(null);
            setKpiAvg(null);
            setWeekSchedules([]);
            setWeekDays([]);
            setShiftNames([]);
            setUserMap(new Map());
            setSelectedDay(null);
            setNextWeekCount(null);
            setLoading(false);
            return;
        }
        let cancelled = false;
        (async () => {
            setLoading(true);
            try {
                const base = getMondayOf(new Date());
                base.setDate(base.getDate() + weekOffset * 7);
                const days: Date[] = Array.from({ length: 7 }, (_, i) => {
                    const d = new Date(base);
                    d.setDate(base.getDate() + i);
                    return d;
                });
                const minDate = toLocalISO(days[0]);
                const maxDate = toLocalISO(days[6]);
                const now = new Date();
                const monthStart = toLocalISO(new Date(now.getFullYear(), now.getMonth(), 1));
                const monthEnd = toLocalISO(new Date(now.getFullYear(), now.getMonth() + 1, 0));

                // Next week range (always Mon–Sun of next week, independent of weekOffset)
                const nextMon = getMondayOf(new Date());
                nextMon.setDate(nextMon.getDate() + 7);
                const nextSun = new Date(nextMon);
                nextSun.setDate(nextMon.getDate() + 6);
                const nextWeekMin = toLocalISO(nextMon);
                const nextWeekMax = toLocalISO(nextSun);

                const [usersSnap, kpiSnap, schedSnap, storeSnap, nextWeekSnap] = await Promise.all([
                    getDocs(query(collection(db, 'users'), where('storeId', '==', effectiveStoreId))),
                    getDocs(query(collection(db, 'kpi_records'), where('storeId', '==', effectiveStoreId))),
                    getDocs(query(collection(db, 'schedules'), where('date', '>=', minDate), where('date', '<=', maxDate))),
                    getDoc(doc(db, 'stores', effectiveStoreId)),
                    getDocs(query(collection(db, 'schedules'), where('date', '>=', nextWeekMin), where('date', '<=', nextWeekMax))),
                ]);

                if (cancelled) return;

                // Shift names from store settings
                const storeData = storeSnap.exists() ? storeSnap.data() as StoreDoc : null;
                const shifts: string[] = storeData?.settings?.shiftTimes ?? [];
                setShiftNames(shifts);

                // Full user map: uid -> UserDoc
                const uMap = new Map<string, UserDoc>();
                const users = usersSnap.docs.map(d => d.data() as UserDoc);
                users.forEach(u => uMap.set(u.uid, u));
                setUserMap(uMap);

                const staff = users.filter(u => u.isActive && u.role !== 'admin' && u.role !== 'super_admin');
                setStaffCount(staff.length);

                const kpiDocs = kpiSnap.docs
                    .map(d => d.data() as KpiRecordDoc)
                    .filter(r => r.status === 'OFFICIAL' && r.date >= monthStart && r.date <= monthEnd);
                setKpiAvg(kpiDocs.length > 0
                    ? Math.round(kpiDocs.reduce((s, r) => s + r.officialTotal, 0) / kpiDocs.length)
                    : null);

                const allScheds = schedSnap.docs.map(d => d.data() as ScheduleDoc);
                setWeekSchedules(allScheds.filter(s => s.storeId === effectiveStoreId));
                setWeekDays(days);

                // Count unique staff registered for next week
                const nextWeekUids = new Set<string>();
                nextWeekSnap.docs
                    .map(d => d.data() as ScheduleDoc)
                    .filter(s => s.storeId === effectiveStoreId)
                    .forEach(s => s.employeeIds?.forEach(uid => nextWeekUids.add(uid)));
                setNextWeekCount(nextWeekUids.size);
            } catch (e) {
                console.error('[OperationTab]', e);
            } finally {
                if (!cancelled) setLoading(false);
            }
        })();
        return () => { cancelled = true; };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [effectiveStoreId, weekOffset]);

    // ── Separate fetch for calendar section ───────────────────────────────────
    useEffect(() => {
        if (!effectiveStoreId) {
            setCalendarWeekDays([]);
            setCalendarWeekSchedules([]);
            setCalendarLoading(false);
            return;
        }
        let cancelled = false;
        (async () => {
            setCalendarLoading(true);
            try {
                const base = getMondayOf(new Date());
                base.setDate(base.getDate() + calendarWeekOffset * 7);
                const days: Date[] = Array.from({ length: 7 }, (_, i) => {
                    const d = new Date(base);
                    d.setDate(base.getDate() + i);
                    return d;
                });
                const minDate = toLocalISO(days[0]);
                const maxDate = toLocalISO(days[6]);
                const schedSnap = await getDocs(
                    query(collection(db, 'schedules'), where('date', '>=', minDate), where('date', '<=', maxDate))
                );
                if (cancelled) return;
                setCalendarWeekDays(days);
                setCalendarWeekSchedules(
                    schedSnap.docs.map(d => d.data() as ScheduleDoc).filter(s => s.storeId === effectiveStoreId)
                );
            } catch (e) {
                console.error('[CalendarSection]', e);
            } finally {
                if (!cancelled) setCalendarLoading(false);
            }
        })();
        return () => { cancelled = true; };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [effectiveStoreId, calendarWeekOffset]);

    const today = toLocalISO(new Date());

    // Build shift × day matrix: { nv, ql, cth }
    type Cell = { nv: number; ql: number; cth: number };
    const matrix: Cell[][] = shiftNames.map(shift =>
        weekDays.map(d => {
            const iso = toLocalISO(d);
            const matching = weekSchedules.filter(s => s.date === iso && s.shiftId === shift);
            const uids = new Set<string>();
            matching.forEach(s => s.employeeIds?.forEach(u => uids.add(u)));
            let nv = 0; let ql = 0; let cth = 0;
            uids.forEach(uid => {
                const u = userMap.get(uid);
                if (u?.role === 'store_manager') cth++;
                else if (u?.role === 'manager') ql++;
                else nv++;
            });
            return { nv, ql, cth };
        })
    );

    // Helper: get short display name
    const shortName = (name: string) => {
        const parts = name.trim().split(' ');
        return parts.length >= 2 ? parts[parts.length - 1] : name;
    };

    // Day schedule detail for bottom sheet — merge both week sources
    const allFetchedSchedules = [...weekSchedules, ...calendarWeekSchedules];
    const selectedDaySchedule = selectedDay
        ? shiftNames.map(shift => {
            const matching = allFetchedSchedules.filter(s => s.date === selectedDay && s.shiftId === shift);
            const uids = new Set<string>();
            matching.forEach(s => s.employeeIds?.forEach(u => uids.add(u)));
            return {
                shift,
                employees: Array.from(uids).map(uid => {
                    const u = userMap.get(uid);
                    return {
                        uid,
                        name: u?.name ?? uid,
                        isManager: u?.role === 'store_manager' || u?.role === 'manager',
                        isFT: u?.type === 'FT',
                    };
                }),
            };
        })
        : [];

    const selectedDateLabel = selectedDay
        ? (() => {
            const d = new Date(selectedDay + 'T00:00:00');
            return d.toLocaleDateString('vi-VN', { weekday: 'long', day: '2-digit', month: '2-digit', year: 'numeric' });
        })()
        : '';

    // ── Calendar view: per-day employee list (uses calendarWeekDays/Schedules) ─
    const calendarDays = calendarWeekDays.map(d => {
        const iso = toLocalISO(d);
        const dayShifts = shiftNames.map(shift => {
            const matching = calendarWeekSchedules.filter(s => s.date === iso && s.shiftId === shift);
            const uids = new Set<string>();
            matching.forEach(s => s.employeeIds?.forEach(u => uids.add(u)));
            const employees = Array.from(uids).map(uid => {
                const u = userMap.get(uid);
                return {
                    uid,
                    name: u?.name ?? uid,
                    isManager: u?.role === 'store_manager' || u?.role === 'manager',
                    isFT: u?.type === 'FT',
                };
            });
            return { shift, employees };
        });
        const totalRegistered = new Set(
            dayShifts.flatMap(ds => ds.employees.map(e => e.uid))
        ).size;
        return { iso, date: d, dayShifts, totalRegistered };
    });

    return (
        <div className="flex flex-col gap-3">
            {/* Metric cards */}
            <div className="flex gap-3">
                <MetricCard
                    value={loading ? '…' : staffCount ?? '-'}
                    sub={t('metric_staff')}
                    icon={Users}
                    colorClass="bg-blue-50 text-blue-500"
                />
                <MetricCard
                    value={loading ? '…' : kpiAvg !== null ? kpiAvg : '-'}
                    sub={t('metric_kpiAvg')}
                    icon={TrendingUp}
                    colorClass="bg-emerald-50 text-emerald-500"
                />
                <MetricCard
                    value={loading ? '…' : nextWeekCount ?? '-'}
                    sub={t('metric_registered')}
                    icon={Calendar}
                    colorClass="bg-violet-50 text-violet-500"
                />
            </div>

            <div>
                <p className="text-xs mb-1 font-semibold text-gray-700">{t('storeSchedule')}</p>
                {/* Weekly schedule — shift breakdown */}
                <div className="rounded-2xl bg-white border border-gray-100 shadow-sm overflow-hidden">
                    {/* Week nav */}
                    <div className="flex items-center justify-between px-3 py-2 border-b border-gray-100">
                        <button
                            onClick={() => setWeekOffset(w => w - 1)}
                            className="p-1 rounded-lg hover:bg-gray-100 active:scale-95 transition-transform"
                        >
                            <ChevronLeft className="w-4 h-4 text-gray-400" />
                        </button>
                        <span className="text-xs font-semibold text-gray-700 flex items-center gap-1.5">
                            <Calendar className="w-3.5 h-3.5 text-primary-500" />
                            {weekDays.length > 0
                                ? `${weekDays[0].toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit' })} – ${weekDays[6].toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit' })}`
                                : t('thisWeek')
                            }
                            {weekOffset === 0 && (
                                <span className="px-1.5 py-0.5 rounded-full bg-primary-50 text-primary-600 text-[10px] font-bold">{t('current')}</span>
                            )}
                        </span>
                        <button
                            onClick={() => setWeekOffset(w => w + 1)}
                            className="p-1 rounded-lg hover:bg-gray-100 active:scale-95 transition-transform"
                        >
                            <ChevronRight className="w-4 h-4 text-gray-400" />
                        </button>
                    </div>

                    <div className="h-[200px] overflow-auto">
                        {!effectiveStoreId ? (
                            <div className="h-full flex items-center justify-center">
                                <p className="text-center text-xs text-gray-400">{t('noStore')}</p>
                            </div>
                        ) : loading ? (
                            <div className="h-full flex items-center justify-center">
                                <Loader2 className="w-5 h-5 animate-spin text-gray-300" />
                            </div>
                        ) : shiftNames.length === 0 ? (
                            <div className="h-full flex items-center justify-center">
                                <p className="text-center text-xs text-gray-400">{t('noShiftData')}</p>
                            </div>
                        ) : (
                            <div className="overflow-x-auto">
                                <table className="w-full text-xs border-collapse min-w-[340px]">
                                    <thead>
                                        <tr>
                                            <th className="sticky left-0 z-10 bg-gray-50 px-3 py-2.5 text-left font-semibold text-gray-400 border-b border-gray-100 w-[60px] text-[11px]">{t('shiftColHeader')}</th>
                                            {weekDays.map(d => {
                                                const iso = toLocalISO(d);
                                                const isToday = iso === today;
                                                return (
                                                    <th
                                                        key={iso}
                                                        onClick={() => setSelectedDay(iso)}
                                                        className={cn(
                                                            'px-1 py-2 font-semibold border-b border-gray-100 text-center cursor-pointer select-none',
                                                            'active:opacity-70 transition-opacity',
                                                            isToday ? 'bg-primary-50 text-primary-600' : 'bg-gray-50 text-gray-400',
                                                        )}
                                                    >
                                                        <div className="text-[10px]">{DAY_LABELS[d.getDay()]}</div>
                                                        <div className={cn('text-[13px] font-bold leading-tight', isToday ? 'text-primary-500' : 'text-gray-600')}>{d.getDate()}</div>
                                                    </th>
                                                );
                                            })}
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {shiftNames.map((shift, si) => (
                                            <tr key={shift} className={si % 2 === 0 ? 'bg-white' : 'bg-gray-50/40'}>
                                                <td
                                                    className="sticky left-0 z-10 px-3 py-3 text-[11px] font-bold text-gray-600 border-r border-gray-100 whitespace-nowrap"
                                                    style={{ background: 'inherit' }}
                                                >
                                                    {shift}
                                                </td>
                                                {weekDays.map((d, di) => {
                                                    const iso = toLocalISO(d);
                                                    const isToday = iso === today;
                                                    const cell = matrix[si]?.[di] ?? { nv: 0, ql: 0, cth: 0 };
                                                    const isEmpty = cell.nv === 0 && cell.ql === 0 && cell.cth === 0;
                                                    return (
                                                        <td
                                                            key={iso}
                                                            onClick={() => setSelectedDay(iso)}
                                                            className={cn(
                                                                'px-1 py-2.5 text-center align-middle cursor-pointer active:opacity-60 transition-opacity',
                                                                isToday ? 'bg-primary-50/50' : '',
                                                            )}
                                                        >
                                                            {isEmpty ? (
                                                                <span className="text-gray-200 text-sm">—</span>
                                                            ) : (
                                                                <div className="flex flex-col items-center gap-[3px]">
                                                                    {cell.cth > 0 && (
                                                                        <span className="inline-flex items-center justify-center gap-[1px] px-1.5 h-[18px] rounded-md bg-red-50 text-red-600 font-bold text-[11px] leading-none">
                                                                            {cell.cth}<span className="font-normal opacity-70">CTH</span>
                                                                        </span>
                                                                    )}
                                                                    {cell.ql > 0 && (
                                                                        <span className="inline-flex items-center justify-center gap-[1px] px-1.5 h-[18px] rounded-md bg-amber-50 text-amber-600 font-bold text-[11px] leading-none">
                                                                            {cell.ql}<span className="font-normal opacity-70">QL</span>
                                                                        </span>
                                                                    )}
                                                                    {cell.nv > 0 && (
                                                                        <span className="inline-flex items-center justify-center gap-[1px] px-1.5 h-[18px] rounded-md bg-blue-50 text-blue-600 font-bold text-[11px] leading-none">
                                                                            {cell.nv}<span className="font-normal opacity-70">NV</span>
                                                                        </span>
                                                                    )}
                                                                </div>
                                                            )}
                                                        </td>
                                                    );
                                                })}
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </div>{/* end h-[200px] wrapper */}

                    {/* Legend */}
                    {!loading && shiftNames.length > 0 && (
                        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 px-3 py-2.5 border-t border-gray-100">
                            <span className="flex items-center gap-1.5 text-[11px] text-gray-500">
                                <span className="w-2 h-2 rounded-sm bg-red-100 inline-block" />{t('legend_cth')}
                            </span>
                            <span className="flex items-center gap-1.5 text-[11px] text-gray-500">
                                <span className="w-2 h-2 rounded-sm bg-amber-100 inline-block" />{t('legend_ql')}
                            </span>
                            <span className="flex items-center gap-1.5 text-[11px] text-gray-500">
                                <span className="w-2 h-2 rounded-sm bg-blue-100 inline-block" />{t('legend_nv')}
                            </span>
                        </div>
                    )}
                </div>
            </div>

            {/* ── Employee schedule registration calendar ────────────────── */}
            <div>
                <div className="flex items-center justify-between mb-2">
                    <p className="text-xs font-semibold text-gray-700">{t('staffRegCalendar')}</p>
                    <div className="flex items-center gap-0.5">
                        <button
                            onClick={() => setCalendarWeekOffset(w => w - 1)}
                            className="p-1 rounded-lg hover:bg-gray-100 active:scale-95 transition-transform"
                        >
                            <ChevronLeft className="w-4 h-4 text-gray-400" />
                        </button>
                        <span className="text-[11px] font-semibold text-gray-500 flex items-center gap-1 px-0.5">
                            {calendarWeekDays.length > 0
                                ? `${calendarWeekDays[0].toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit' })} – ${calendarWeekDays[6].toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit' })}`
                                : '…'
                            }
                            {calendarWeekOffset === 0 && (
                                <span className="px-1.5 py-0.5 rounded-full bg-primary-50 text-primary-600 text-[10px] font-bold">
                                    {t('current')}
                                </span>
                            )}
                            {calendarWeekOffset === 1 && (
                                <span className="px-1.5 py-0.5 rounded-full bg-violet-50 text-violet-600 text-[10px] font-bold">
                                    {t('nextWeekLabel')}
                                </span>
                            )}
                        </span>
                        <button
                            onClick={() => setCalendarWeekOffset(w => w + 1)}
                            className="p-1 rounded-lg hover:bg-gray-100 active:scale-95 transition-transform"
                        >
                            <ChevronRight className="w-4 h-4 text-gray-400" />
                        </button>
                    </div>
                </div>
                <div className="h-[210px] relative">
                    {!effectiveStoreId ? (
                        <div className="h-full rounded-2xl bg-white border border-gray-100 shadow-sm flex flex-col items-center justify-center gap-1.5">
                            <Calendar className="w-7 h-7 text-gray-200" />
                            <p className="text-xs text-gray-400">Chọn cửa hàng để xem lịch</p>
                        </div>
                    ) : calendarLoading ? (
                        <div className="h-full rounded-2xl bg-white border border-gray-100 shadow-sm flex items-center justify-center">
                            <Loader2 className="w-5 h-5 animate-spin text-gray-300" />
                        </div>
                    ) : shiftNames.length === 0 ? (
                        <div className="h-full rounded-2xl bg-white border border-gray-100 shadow-sm flex flex-col items-center justify-center gap-1.5">
                            <Calendar className="w-7 h-7 text-gray-200" />
                            <p className="text-xs text-gray-400">{t('noShiftConfig')}</p>
                        </div>
                    ) : (
                        <div className="h-full flex gap-2.5 overflow-x-auto no-scrollbar pb-1 snap-x snap-mandatory">
                            {calendarDays.map(({ iso, date, dayShifts, totalRegistered }) => {
                                const isToday = iso === today;
                                const isPast = iso < today;
                                const hasAny = totalRegistered > 0;
                                return (
                                    <button
                                        key={iso}
                                        onClick={() => setSelectedDay(iso)}
                                        className={cn(
                                            'snap-start flex-shrink-0 w-[138px] rounded-2xl border shadow-sm flex flex-col overflow-hidden text-left',
                                            'active:scale-[0.97] transition-transform duration-100',
                                            isToday
                                                ? 'border-primary-200 bg-primary-50/40'
                                                : isPast
                                                    ? 'border-gray-100 bg-gray-50/50'
                                                    : 'border-gray-100 bg-white',
                                        )}
                                    >
                                        {/* Day header */}
                                        <div className={cn(
                                            'px-3 py-2 flex items-center justify-between border-b',
                                            isToday ? 'bg-primary-500 border-primary-400' : 'bg-gray-50 border-gray-100',
                                        )}>
                                            <div>
                                                <p className={cn('text-[10px] font-semibold uppercase tracking-wide', isToday ? 'text-primary-100' : 'text-gray-400')}>
                                                    {DAY_LABELS[date.getDay()]}
                                                </p>
                                                <p className={cn('text-[18px] font-bold leading-tight', isToday ? 'text-white' : 'text-gray-700')}>
                                                    {date.getDate()}
                                                </p>
                                                <p className={cn('text-[10px]', isToday ? 'text-primary-100' : 'text-gray-400')}>
                                                    {date.toLocaleDateString('vi-VN', { month: '2-digit' })}/{date.getFullYear()}
                                                </p>
                                            </div>
                                            <span className={cn(
                                                'flex items-center justify-center w-7 h-7 rounded-full text-xs font-bold',
                                                hasAny
                                                    ? isToday ? 'bg-white/25 text-white' : 'bg-blue-50 text-blue-600'
                                                    : isToday ? 'bg-white/10 text-primary-200' : 'bg-gray-100 text-gray-300',
                                            )}>
                                                {hasAny ? totalRegistered : '—'}
                                            </span>
                                        </div>

                                        {/* Per-shift employee pills */}
                                        <div className="px-2.5 py-2 flex flex-col gap-2">
                                            {dayShifts.map(({ shift, employees }) => (
                                                <div key={shift} className="flex flex-col gap-0.5">
                                                    <p className={cn(
                                                        'text-[10px] font-semibold truncate',
                                                        employees.length > 0 ? 'text-gray-500' : 'text-gray-300',
                                                    )}>
                                                        {shift}
                                                    </p>
                                                    {employees.length === 0 ? (
                                                        <p className="text-[10px] text-gray-300 italic">{t('noStaff')}</p>
                                                    ) : (
                                                        <div className="flex flex-wrap gap-1">
                                                            {employees.slice(0, 3).map(emp => (
                                                                <span
                                                                    key={emp.uid}
                                                                    className={cn(
                                                                        'inline-flex items-center px-1.5 py-0.5 rounded-md text-[10px] font-medium leading-tight max-w-full truncate',
                                                                        emp.isManager
                                                                            ? 'bg-amber-50 text-amber-700'
                                                                            : emp.isFT
                                                                                ? 'bg-blue-50 text-blue-700'
                                                                                : 'bg-green-50 text-green-700',
                                                                    )}
                                                                >
                                                                    {shortName(emp.name)}
                                                                </span>
                                                            ))}
                                                            {employees.length > 3 && (
                                                                <span className="inline-flex items-center px-1.5 py-0.5 rounded-md text-[10px] font-medium bg-gray-100 text-gray-500">
                                                                    +{employees.length - 3}
                                                                </span>
                                                            )}
                                                        </div>
                                                    )}
                                                </div>
                                            ))}
                                        </div>
                                    </button>
                                );
                            })}
                        </div>
                    )}
                </div>{/* end h-[210px] wrapper */}
            </div>



            {/* Day Detail Bottom Sheet */}
            <BottomSheet
                isOpen={!!selectedDay}
                onClose={() => setSelectedDay(null)}
                title={selectedDateLabel}
                maxHeightClass="max-h-[80vh]"
            >
                <div className="px-4 pb-6 pt-3 flex flex-col gap-3">
                    {selectedDaySchedule.length === 0 ? (
                        <p className="text-center text-sm text-gray-400 py-6">{t('noData')}</p>
                    ) : (
                        selectedDaySchedule.map(({ shift, employees }) => (
                            <div key={shift} className="rounded-2xl border border-gray-100 overflow-hidden">
                                {/* Shift header */}
                                <div className="flex items-center gap-2 px-3 py-2 bg-gray-50 border-b border-gray-100">
                                    <Clock className="w-3.5 h-3.5 text-primary-500 flex-shrink-0" />
                                    <span className="text-xs font-bold text-gray-700">{shift}</span>
                                    <span className="ml-auto text-[10px] font-medium text-gray-400">
                                        {employees.length} {t('personCount')}
                                    </span>
                                </div>

                                {/* Employee list */}
                                {employees.length === 0 ? (
                                    <p className="px-3 py-3 text-xs text-gray-400">{t('noPerson')}</p>
                                ) : (
                                    <ul className="divide-y divide-gray-50">
                                        {employees.map(emp => (
                                            <li key={emp.uid} className="flex items-center gap-2.5 px-3 py-2">
                                                {/* Role badge */}
                                                <span className={cn(
                                                    'flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold',
                                                    emp.isManager
                                                        ? 'bg-amber-100 text-amber-700'
                                                        : emp.isFT
                                                            ? 'bg-blue-100 text-blue-700'
                                                            : 'bg-green-100 text-green-700',
                                                )}>
                                                    {emp.isManager ? 'QL' : emp.isFT ? 'FT' : 'PT'}
                                                </span>
                                                {/* Name */}
                                                <span className="text-sm font-medium text-gray-800 truncate">{emp.name}</span>
                                            </li>
                                        ))}
                                    </ul>
                                )}
                            </div>
                        ))
                    )}
                </div>
            </BottomSheet>
        </div>
    );
}

// ── Revenue helpers ───────────────────────────────────────────────────────────
const fmtV = (v: number) => v.toLocaleString('vi-VN');
const fmtVND = (v: number) => v.toLocaleString('vi-VN', { style: 'currency', currency: 'VND' });
function fmtShort(v: number, billion = 'tỷ') {
    if (v >= 1_000_000_000) return `${(v / 1_000_000_000).toFixed(1)} ${billion}`;
    if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(1)}M`;
    if (v >= 1_000) return `${(v / 1_000).toFixed(0)}K`;
    return fmtV(v);
}
function todayStr() {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
function monthStart() {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`;
}
const REV_PALETTE = ['#6366f1', '#10b981', '#f59e0b', '#06b6d4', '#ec4899', '#8b5cf6'];

type RevFilterMode = 'day' | 'month' | 'custom';

function RevenueTab() {
    const { t } = useMobileLang();
    const [filterMode, setFilterMode] = useState<RevFilterMode>('day');
    const [dayDate, setDayDate] = useState(todayStr());
    const [monthDate, setMonthDate] = useState(todayStr().slice(0, 7));
    const [customStart, setCustomStart] = useState(monthStart());
    const [customEnd, setCustomEnd] = useState(todayStr());

    /** Language-aware short formatter — passes the billion unit from the dictionary */
    const fmt = (v: number) => fmtShort(v, t('rev_billion'));

    const [data, setData] = useState<RevenueRecord[]>([]);
    const [sellData, setSellData] = useState<SellCategory[]>([]);
    const [dailyPanel, setDailyPanel] = useState<DailyPanel | null>(null);
    const [loading, setLoading] = useState(false);
    const [syncing, setSyncing] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [hasFetched, setHasFetched] = useState(false);
    const [updatedAt, setUpdatedAt] = useState<string | null>(null);
    const [isListening, setIsListening] = useState(false);
    const unsubRef = useRef<(() => void) | null>(null);

    const getRange = useCallback(() => {
        if (filterMode === 'day') return { start: dayDate, end: dayDate };
        if (filterMode === 'month') {
            const [y, m] = monthDate.split('-').map(Number);
            const last = new Date(y, m, 0).getDate();
            return { start: `${monthDate}-01`, end: `${monthDate}-${String(last).padStart(2, '0')}` };
        }
        return { start: customStart, end: customEnd };
    }, [filterMode, dayDate, monthDate, customStart, customEnd]);

    const fetchInitial = useCallback(async () => {
        const { start, end } = getRange();
        setLoading(true); setError(null);
        try {
            const result = await fetchRevenueFromCache(start, end);
            if (!result.success) { setError(result.error || t('rev_errDefault')); setData([]); setSellData([]); setDailyPanel(null); }
            else { setData(result.data); setSellData(result.sellData); setDailyPanel(result.dailyPanel ?? null); setUpdatedAt(result.updatedAt); }
        } catch { setError(t('rev_errConnect')); setData([]); setSellData([]); setDailyPanel(null); }
        finally { setLoading(false); setHasFetched(true); }
    }, [getRange]);

    useEffect(() => {
        if (unsubRef.current) { unsubRef.current(); unsubRef.current = null; }
        const { start, end } = getRange();
        fetchInitial();
        const unsub = subscribeDocument<RevenueCache>(JOYWORLD_CACHE_COLLECTION, getCacheDocId(start, end), (cached) => {
            if (cached?.revenue) {
                setData(cached.revenue); setSellData(cached.sellData || []);
                setDailyPanel(cached.dailyPanel ?? null); setUpdatedAt(cached.updatedAt || null);
                setError(null); setHasFetched(true); setLoading(false);
            }
            setIsListening(true);
        });
        unsubRef.current = unsub;
        return () => { unsub(); setIsListening(false); };
    }, [getRange]); // eslint-disable-line react-hooks/exhaustive-deps

    const handleSync = useCallback(async () => {
        const { start, end } = getRange();
        setSyncing(true);
        try {
            const result = await triggerSyncAction(start, end);
            if (result.success) { setData(result.data); setSellData(result.sellData); setDailyPanel(result.dailyPanel ?? null); setUpdatedAt(result.updatedAt); setError(null); }
            else setError(result.error || t('rev_errSync'));
        } catch { setError(t('rev_errSync')); }
        finally { setSyncing(false); }
    }, [getRange]);

    const kpis = useMemo(() => {
        let totalReal = data.reduce((s, d) => s + d.realMoney, 0);
        let totalSys = data.reduce((s, d) => s + d.sysMoney, 0);
        let totalCash = data.reduce((s, d) => s + d.cashRealMoney, 0);
        let totalTransfer = data.reduce((s, d) => s + d.transferRealMoney, 0);
        const totalCoins = data.reduce((s, d) => s + d.sellCoinAmount, 0);
        const totalRefund = dailyPanel?.shopSummary?.refundMoney ?? data.reduce((s, d) => s + d.cashErrorMoney, 0);
        const peakDay = data.length > 0 ? data.reduce((max, d) => d.realMoney > max.realMoney ? d : max, data[0]) : null;
        if (dailyPanel?.shopSummary) { totalReal = dailyPanel.shopSummary.shopRealMoney; totalSys = dailyPanel.shopSummary.totalMoney; }
        if (dailyPanel?.paymentStats?.length) {
            const pmCash = dailyPanel.paymentStats.find(p => p.paymentCategoryName.toLowerCase().includes('tiền mặt'));
            const pmTrans = dailyPanel.paymentStats.find(p => p.paymentCategoryName.toLowerCase().includes('chuyển khoản'));
            if (pmCash) totalCash = pmCash.totalRealMoney;
            if (pmTrans) totalTransfer = pmTrans.totalRealMoney;
        }
        return { totalReal, totalSys, totalCash, totalTransfer, totalCoins, totalRefund, peakDay };
    }, [data, dailyPanel]);

    const isMultiDay = data.length > 1;

    const chartData = useMemo(() =>
        [...data].sort((a, b) => a.forDate.localeCompare(b.forDate)).map(d => ({
            date: d.forDate.slice(5), [t('rev_realRevenue')]: d.sysMoney, [t('rev_cash')]: d.cashRealMoney, [t('rev_transfer')]: d.transferRealMoney,
            // eslint-disable-next-line react-hooks/exhaustive-deps
        })), [data, t]);

    const paymentPieData = useMemo(() => {
        if (dailyPanel?.paymentStats?.length) return dailyPanel.paymentStats.map(p => ({ name: p.paymentCategoryName, value: p.totalRealMoney })).filter(d => d.value > 0);
        return [{ name: t('rev_cash'), value: kpis.totalCash }, { name: t('rev_transfer'), value: kpis.totalTransfer }].filter(d => d.value > 0);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [data, dailyPanel, kpis, t]);

    const topProducts = useMemo(() => {
        if (dailyPanel?.goodsTypeStats?.length) return dailyPanel.goodsTypeStats.flatMap(g => g.goodsItems).filter(i => i.realMoney > 0).sort((a, b) => b.realMoney - a.realMoney).slice(0, 8);
        return sellData.flatMap(c => c.items).sort((a, b) => b.realMoney - a.realMoney).slice(0, 8);
    }, [sellData, dailyPanel]);

    return (
        <div className="flex flex-col gap-3">
            {/* ── Filter bar ── */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-2 flex flex-col gap-2">
                <div className="flex gap-1.5">
                    {(['day', 'month', 'custom'] as RevFilterMode[]).map((m, i) => {
                        const labels = [t('rev_day'), t('rev_month'), t('rev_custom')];
                        const Icons = [Calendar, CalendarDays, CalendarRange];
                        const Ic = Icons[i];
                        return (
                            <button key={m} onClick={() => setFilterMode(m)}
                                className={cn('flex-1 flex items-center justify-center gap-1 py-1.5 rounded-xl text-[11px] font-semibold transition-all',
                                    filterMode === m ? 'bg-primary-600 text-white shadow-sm' : 'text-gray-500 bg-gray-50')}>
                                <Ic className="w-3 h-3" />{labels[i]}
                            </button>
                        );
                    })}
                </div>
                <div className="flex items-center gap-2">
                    {filterMode === 'day' && <input type="date" value={dayDate} onChange={e => setDayDate(e.target.value)} className="flex-1 rounded-xl bg-gray-50 px-3 py-1.5 text-xs text-gray-700 border border-gray-200 outline-none" />}
                    {filterMode === 'month' && <input type="month" value={monthDate} onChange={e => setMonthDate(e.target.value)} className="flex-1 rounded-xl bg-gray-50 px-3 py-1.5 text-xs text-gray-700 border border-gray-200 outline-none" />}
                    {filterMode === 'custom' && (<>
                        <input type="date" value={customStart} onChange={e => setCustomStart(e.target.value)} className="flex-1 rounded-xl bg-gray-50 px-2 py-1.5 text-xs text-gray-700 border border-gray-200 outline-none" />
                        <span className="text-gray-300 text-xs">→</span>
                        <input type="date" value={customEnd} onChange={e => setCustomEnd(e.target.value)} className="flex-1 rounded-xl bg-gray-50 px-2 py-1.5 text-xs text-gray-700 border border-gray-200 outline-none" />
                    </>)}
                    <button onClick={handleSync} disabled={syncing || loading}
                        className="w-8 h-8 rounded-xl bg-primary-50 flex items-center justify-center active:scale-95 transition-transform disabled:opacity-40">
                        <RefreshCw className={cn('w-4 h-4 text-primary-600', (syncing || loading) && 'animate-spin')} />
                    </button>
                </div>
                <div className="flex items-center gap-1.5">
                    {isListening
                        ? <span className="flex items-center gap-1 text-[10px] font-semibold text-green-500 bg-green-50 px-1.5 py-0.5 rounded-full"><Wifi className="w-2.5 h-2.5" />Live</span>
                        : <WifiOff className="w-3 h-3 text-gray-300" />}
                    {updatedAt && <span className="text-[10px] text-gray-400">{t('rev_updatedAt')}: {new Date(updatedAt).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}</span>}
                </div>
            </div>

            {/* ── Error ── */}
            {error && (
                <div className="rounded-2xl border border-red-200 bg-red-50 p-3 flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 text-red-500 shrink-0" />
                    <p className="text-xs text-red-700 flex-1 leading-snug">{error}</p>
                </div>
            )}

            {/* ── Loading skeleton ── */}
            {loading && !hasFetched && (
                <div className="rounded-2xl bg-white border border-gray-100 shadow-sm h-32 flex items-center justify-center">
                    <Loader2 className="w-6 h-6 animate-spin text-gray-300" />
                </div>
            )}

            {/* ── Main content ── */}
            {hasFetched && !error && data.length > 0 && (
                <div className={cn('flex flex-col gap-3 transition-opacity duration-300', (loading || syncing) && 'opacity-50 pointer-events-none')}>

                    {/* Hero KPI — Thực thu */}
                    <div className="relative rounded-2xl overflow-hidden bg-gradient-to-br from-primary-600 to-primary-800 p-4 shadow-lg">
                        <div className="absolute inset-0 opacity-[0.07]" style={{ backgroundImage: 'radial-gradient(circle at 80% 20%, white 1px, transparent 1px)', backgroundSize: '18px 18px' }} />
                        <p className="text-[10px] font-bold uppercase tracking-widest text-primary-100">{t('rev_realRevenue')}</p>
                        <p className="text-3xl font-extrabold text-white mt-1 tracking-tight leading-tight">
                            {fmt(dailyPanel?.shopSummary?.shopRealMoney ?? kpis.totalSys)}
                        </p>
                        <p className="text-xs text-primary-200 mt-1">{fmtVND(dailyPanel?.shopSummary?.shopRealMoney ?? kpis.totalSys)}</p>
                    </div>

                    {/* KPI grid */}
                    <div className="grid grid-cols-2 gap-2">
                        {[
                            { label: t('rev_cash'), value: fmt(kpis.totalCash), sub: `${kpis.totalReal > 0 ? ((kpis.totalCash / kpis.totalReal) * 100).toFixed(0) : 0}%`, color: 'bg-blue-50', textColor: 'text-blue-700', Icon: Banknote },
                            { label: t('rev_transfer'), value: fmt(kpis.totalTransfer), sub: `${kpis.totalReal > 0 ? ((kpis.totalTransfer / kpis.totalReal) * 100).toFixed(0) : 0}%`, color: 'bg-violet-50', textColor: 'text-violet-700', Icon: ArrowUpDown },
                            { label: t('rev_coins'), value: fmtV(kpis.totalCoins), sub: `${t('rev_coinPrice')}: ${fmt(data[0]?.sellCoinPrice || 0)}`, color: 'bg-amber-50', textColor: 'text-amber-700', Icon: Coins },
                            isMultiDay
                                ? { label: t('rev_peakDay'), value: kpis.peakDay ? fmt(kpis.peakDay.realMoney) : '—', sub: kpis.peakDay?.forDate || '', color: 'bg-pink-50', textColor: 'text-pink-700', Icon: TrendingUp }
                                : { label: t('rev_cancelled'), value: fmt(kpis.totalRefund), sub: kpis.totalRefund > 0 ? t('rev_cancelledSub') : t('rev_noCancelled'), color: 'bg-red-50', textColor: 'text-red-600', Icon: XCircle },
                        ].map(({ label, value, sub, color, textColor, Icon }) => (
                            <div key={label} className="rounded-2xl bg-white border border-gray-100 shadow-sm p-3">
                                <div className={cn('w-8 h-8 rounded-xl flex items-center justify-center mb-2', color)}>
                                    <Icon className={cn('w-4 h-4', textColor)} strokeWidth={1.75} />
                                </div>
                                <p className="text-[10px] uppercase tracking-widest text-gray-400 font-semibold">{label}</p>
                                <p className={cn('text-base font-bold mt-0.5 leading-tight', textColor)}>{value}</p>
                                <p className="text-[10px] text-gray-400 mt-0.5">{sub}</p>
                            </div>
                        ))}
                    </div>

                    {/* Single-day detail panel */}
                    {!isMultiDay && dailyPanel?.shopSummary && (
                        <div className="rounded-2xl bg-white border border-gray-100 shadow-sm p-3">
                            <p className="text-xs font-bold text-gray-700 mb-2">{t('rev_dailySummary')} {data[0]?.forDate ?? dayDate}</p>
                            <div className="grid grid-cols-2 gap-1.5">
                                {[
                                    { l: t('rev_totalBill'), v: fmtVND(dailyPanel.shopSummary.shopMoney), c: 'text-gray-700', bg: 'bg-gray-50' },
                                    { l: t('rev_realRevenue'), v: fmtVND(dailyPanel.shopSummary.shopRealMoney), c: 'text-green-700', bg: 'bg-green-50' },
                                    { l: t('rev_refunded'), v: fmtVND(dailyPanel.shopSummary.refundMoney), c: 'text-red-600', bg: 'bg-red-50' },
                                    { l: t('rev_cash'), v: fmtVND(kpis.totalCash), c: 'text-blue-700', bg: 'bg-blue-50' },
                                    { l: t('rev_transfer'), v: fmtVND(kpis.totalTransfer), c: 'text-violet-700', bg: 'bg-violet-50' },
                                    { l: t('rev_coins'), v: fmtV(kpis.totalCoins), c: 'text-amber-700', bg: 'bg-amber-50' },
                                ].map(item => (
                                    <div key={item.l} className={cn('rounded-xl p-2', item.bg)}>
                                        <p className="text-[9px] uppercase tracking-widest text-gray-400 font-semibold">{item.l}</p>
                                        <p className={cn('text-xs font-bold mt-0.5 leading-snug break-all', item.c)}>{item.v}</p>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Multi-day area chart */}
                    {isMultiDay && (
                        <div className="rounded-2xl bg-white border border-gray-100 shadow-sm p-3">
                            <p className="text-xs font-bold text-gray-700 mb-3">{t('rev_revenueByDay')}</p>
                            <div className="h-[160px]">
                                <ResponsiveContainer width="100%" height="100%">
                                    <AreaChart data={chartData} margin={{ top: 5, right: 5, left: 0, bottom: 0 }}>
                                        <defs>
                                            <linearGradient id="gR" x1="0" y1="0" x2="0" y2="1">
                                                <stop offset="0%" stopColor="#10b981" stopOpacity={0.25} />
                                                <stop offset="100%" stopColor="#10b981" stopOpacity={0.01} />
                                            </linearGradient>
                                        </defs>
                                        <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                                        <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{ fontSize: 9, fill: '#94a3b8' }} />
                                        <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 9, fill: '#94a3b8' }} tickFormatter={fmt} width={40} />
                                        <RechartsTooltip contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 8px 24px rgb(0 0 0 / 0.1)', fontSize: '11px' }} />
                                        <Area type="monotone" dataKey={t('rev_realRevenue')} stroke="#10b981" strokeWidth={2} fill="url(#gR)" dot={false} activeDot={{ r: 3 }} />
                                        <Area type="monotone" dataKey={t('rev_cash')} stroke="#3b82f6" strokeWidth={1.5} fill="transparent" dot={false} activeDot={{ r: 3 }} />
                                        <Area type="monotone" dataKey={t('rev_transfer')} stroke="#8b5cf6" strokeWidth={1.5} fill="transparent" dot={false} activeDot={{ r: 3 }} />
                                    </AreaChart>
                                </ResponsiveContainer>
                            </div>
                        </div>
                    )}

                    {/* Payment donut */}
                    {paymentPieData.length > 0 && (
                        <div className="rounded-2xl bg-white border border-gray-100 shadow-sm p-3">
                            <p className="text-xs font-bold text-gray-700 mb-2">{t('rev_paymentMethod')}</p>
                            <div className="flex items-center gap-3">
                                <div className="h-[100px] w-[100px] shrink-0">
                                    <ResponsiveContainer width="100%" height="100%">
                                        <PieChart>
                                            <Pie data={paymentPieData} cx="50%" cy="50%" innerRadius={28} outerRadius={46} paddingAngle={3} dataKey="value" labelLine={false}>
                                                {paymentPieData.map((_, i) => <Cell key={i} fill={REV_PALETTE[i % REV_PALETTE.length]} />)}
                                            </Pie>
                                            <RechartsTooltip contentStyle={{ borderRadius: '10px', border: 'none', boxShadow: '0 4px 16px rgb(0 0 0 / 0.1)', fontSize: '11px' }} />
                                        </PieChart>
                                    </ResponsiveContainer>
                                </div>
                                <div className="flex flex-col gap-2 flex-1">
                                    {paymentPieData.map((item, i) => {
                                        const total = paymentPieData.reduce((s, d) => s + d.value, 0);
                                        const pct = total > 0 ? ((item.value / total) * 100).toFixed(0) : '0';
                                        return (
                                            <div key={item.name} className="flex items-center justify-between">
                                                <div className="flex items-center gap-1.5">
                                                    <div className="w-2 h-2 rounded-full" style={{ backgroundColor: REV_PALETTE[i % REV_PALETTE.length] }} />
                                                    <span className="text-[11px] text-gray-600 truncate max-w-[100px]">{item.name}</span>
                                                </div>
                                                <div className="text-right">
                                                    <span className="text-[11px] font-bold text-gray-800">{fmt(item.value)}</span>
                                                    <span className="ml-1 text-[10px] text-gray-400">{pct}%</span>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Top products */}
                    {topProducts.length > 0 && (
                        <div className="rounded-2xl bg-white border border-gray-100 shadow-sm overflow-hidden">
                            <div className="px-3 py-2.5 border-b border-gray-50">
                                <p className="text-xs font-bold text-gray-700">{t('rev_topProducts')}</p>
                            </div>
                            {topProducts.map((item, i) => {
                                const maxV = topProducts[0]?.realMoney || 1;
                                return (
                                    <div key={item.goodsName} className="px-3 py-2 flex items-center gap-2 border-b border-gray-50 last:border-0">
                                        <span className="w-5 h-5 rounded-full bg-gray-100 flex items-center justify-center text-[10px] font-bold text-gray-500 shrink-0">{i + 1}</span>
                                        <div className="flex-1 min-w-0">
                                            <p className="text-[11px] font-medium text-gray-800 truncate">{item.goodsName}</p>
                                            <div className="h-1 rounded-full bg-gray-100 mt-1 overflow-hidden">
                                                <div className="h-full rounded-full bg-primary-500" style={{ width: `${(item.realMoney / maxV) * 100}%` }} />
                                            </div>
                                        </div>
                                        <div className="text-right shrink-0">
                                            <p className="text-[11px] font-bold text-gray-800">{fmt(item.realMoney)}</p>
                                            <p className="text-[9px] text-gray-400">{t('rev_qty')}: {item.realQty}</p>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>
            )}

            {/* ── Empty state ── */}
            {hasFetched && !error && data.length === 0 && !loading && (
                <div className="rounded-2xl bg-white border border-gray-100 shadow-sm flex flex-col items-center justify-center gap-3 py-10">
                    <div className="w-12 h-12 rounded-2xl bg-gray-100 flex items-center justify-center">
                        <BarChart3 className="w-6 h-6 text-gray-300" />
                    </div>
                    <div className="text-center">
                        <p className="text-sm font-semibold text-gray-600">{t('rev_noData')}</p>
                        <p className="text-xs text-gray-400 mt-0.5">{t('rev_syncPrompt')}</p>
                    </div>
                    <button onClick={handleSync} disabled={syncing}
                        className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-primary-600 text-white text-xs font-semibold active:scale-95 transition-transform disabled:opacity-50">
                        <RefreshCw className={cn('w-3.5 h-3.5', syncing && 'animate-spin')} />
                        {syncing ? t('rev_syncing') : t('rev_syncNow')}
                    </button>
                </div>
            )}
        </div>
    );
}

function InventoryTab() {
    const { t } = useMobileLang();
    const { user, userDoc, effectiveStoreId } = useAuth();

    type MergedProd = { id: string; name: string; companyCode: string; category: string; currentStock: number; minStock: number; stockStatus: 'safe' | 'low' | 'out'; image: string; unit: string };
    type Order = { id: string; status: string; timestamp: string; items: { productName: string; requestedQty: number; unit: string }[]; createdByName: string };

    const [products, setProducts] = useState<MergedProd[]>([]);
    const [orders, setOrders] = useState<Order[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const storeId = effectiveStoreId || userDoc?.storeId || '';

    const fetchAll = useCallback(async () => {
        if (!user || !storeId) { setLoading(false); return; }
        setLoading(true); setError(null);
        try {
            const token = await user.getIdToken();
            const h = { Authorization: `Bearer ${token}` };
            const [prodRes, balRes, ordRes] = await Promise.all([
                fetch('/api/inventory/products', { headers: h }),
                fetch(`/api/inventory/balances?locationType=STORE&locationId=${storeId}`, { headers: h }),
                fetch(`/api/inventory/orders?storeId=${storeId}`, { headers: h }),
            ]);
            const [prodData, balData, ordData] = await Promise.all([prodRes.json(), balRes.json(), ordRes.json()]);

            const prods = Array.isArray(prodData) ? prodData.filter((p: { isActive?: boolean }) => p.isActive !== false) : [];
            const bals: { productId: string; currentStock: number }[] = Array.isArray(balData) ? balData : [];

            const merged: MergedProd[] = prods.map((p: { id: string; name: string; companyCode?: string; category?: string; minStock?: number; image?: string; unit?: string }) => {
                const bal = bals.find(b => b.productId === p.id);
                const stock = bal?.currentStock ?? 0;
                const min = p.minStock ?? 0;
                return {
                    id: p.id, name: p.name, companyCode: p.companyCode || '',
                    category: p.category || '', currentStock: stock, minStock: min,
                    stockStatus: stock === 0 ? 'out' : stock <= min ? 'low' : 'safe',
                    image: p.image || '', unit: p.unit || '',
                };
            });
            setProducts(merged);
            setOrders(Array.isArray(ordData) ? ordData : []);
        } catch (e) {
            setError(t('inv_errLoad'));
            console.error('[InventoryTab]', e);
        } finally { setLoading(false); }
    }, [user, storeId]);

    useEffect(() => { fetchAll(); }, [fetchAll]);

    const outProds = products.filter(p => p.stockStatus === 'out');
    const lowProds = products.filter(p => p.stockStatus === 'low');
    const pendingOrders = orders.filter(o => o.status === 'PENDING_OFFICE' || o.status === 'PENDING' || o.status === 'APPROVED_BY_OFFICE' || o.status === 'IN_TRANSIT');

    const STATUS_LABEL: Record<string, string> = {
        PENDING_OFFICE: t('status_pendingOffice'), APPROVED_BY_OFFICE: t('status_approvedOffice'),
        IN_TRANSIT: t('status_inTransit'), COMPLETED: t('status_completed'), REJECTED: t('status_rejected'),
        CANCELED: t('status_canceled'), PENDING: t('status_pending'), DISPATCHED: t('status_dispatched'),
    };
    const STATUS_COLOR: Record<string, string> = {
        PENDING_OFFICE: 'bg-amber-50 text-amber-700', APPROVED_BY_OFFICE: 'bg-sky-50 text-sky-700',
        IN_TRANSIT: 'bg-violet-50 text-violet-700', COMPLETED: 'bg-emerald-50 text-emerald-700',
        REJECTED: 'bg-red-50 text-red-700', CANCELED: 'bg-gray-100 text-gray-400',
        PENDING: 'bg-amber-50 text-amber-700', DISPATCHED: 'bg-emerald-50 text-emerald-700',
    };

    if (!storeId && !loading) {
        return (
            <div className="flex flex-col items-center justify-center py-12 gap-2">
                <Package className="w-10 h-10 text-gray-200" />
                <p className="text-sm text-gray-400">{t('inv_noStore')}</p>
            </div>
        );
    }

    return (
        <div className="flex flex-col gap-3">
            {/* KPI row */}
            <div className="grid grid-cols-3 gap-2">
                <div className="rounded-2xl bg-white border border-gray-100 shadow-sm p-3 flex flex-col items-center gap-1">
                    <span className="w-9 h-9 rounded-xl bg-sky-50 text-sky-500 flex items-center justify-center">
                        <Package className="w-5 h-5" strokeWidth={1.75} />
                    </span>
                    <p className="text-2xl font-bold text-gray-900 leading-tight">
                        {loading ? '…' : products.length}
                    </p>
                    <p className="text-[10px] text-gray-400 font-medium text-center">{t('inv_sku')}</p>
                </div>
                <div className={cn('rounded-2xl border shadow-sm p-3 flex flex-col items-center gap-1', (outProds.length + lowProds.length) > 0 ? 'bg-amber-50 border-amber-100' : 'bg-white border-gray-100')}>
                    <span className="w-9 h-9 rounded-xl bg-rose-50 text-rose-500 flex items-center justify-center">
                        <PackagePlus className="w-5 h-5" strokeWidth={1.75} />
                    </span>
                    <p className="text-2xl font-bold text-gray-900 leading-tight">
                        {loading ? '…' : outProds.length + lowProds.length}
                    </p>
                    <p className="text-[10px] text-gray-400 font-medium text-center">{t('inv_needRestock')}</p>
                </div>
                <div className={cn('rounded-2xl border shadow-sm p-3 flex flex-col items-center gap-1', pendingOrders.length > 0 ? 'bg-violet-50 border-violet-100' : 'bg-white border-gray-100')}>
                    <span className="w-9 h-9 rounded-xl bg-orange-50 text-orange-500 flex items-center justify-center">
                        <ArrowLeftRight className="w-5 h-5" strokeWidth={1.75} />
                    </span>
                    <p className="text-2xl font-bold text-gray-900 leading-tight">
                        {loading ? '…' : pendingOrders.length}
                    </p>
                    <p className="text-[10px] text-gray-400 font-medium text-center">{t('inv_pendingOrders')}</p>
                </div>
            </div>

            {error && (
                <div className="rounded-2xl bg-rose-50 border border-rose-100 px-4 py-3 flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
                    <p className="text-xs text-rose-600">{error}</p>
                    <button onClick={fetchAll} className="ml-auto text-xs font-semibold text-rose-600 underline">{t('inv_retry')}</button>
                </div>
            )}

            {/* Low / Out stock alert list */}
            {!loading && (outProds.length > 0 || lowProds.length > 0) && (
                <div className="rounded-2xl bg-white border border-gray-100 shadow-sm overflow-hidden">
                    <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
                        <p className="text-xs font-bold text-gray-700 flex items-center gap-1.5">
                            <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />
                            {t('inv_lowStockTitle')}
                        </p>
                        <span className="text-[10px] font-bold text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full">
                            {outProds.length + lowProds.length} {t('inv_products')}
                        </span>
                    </div>
                    <div className="divide-y divide-gray-50 max-h-[200px] overflow-y-auto">
                        {[...outProds, ...lowProds].slice(0, 15).map(p => (
                            <div key={p.id} className="flex items-center gap-3 px-4 py-2.5">
                                <span className={cn(
                                    'w-2 h-2 rounded-full flex-shrink-0',
                                    p.stockStatus === 'out' ? 'bg-red-500' : 'bg-amber-400',
                                )} />
                                <div className="flex-1 min-w-0">
                                    <p className="text-[12px] font-semibold text-gray-800 truncate">{p.name}</p>
                                    <p className="text-[10px] text-gray-400">
                                        {t('inv_stock')}: <span className={cn('font-bold', p.stockStatus === 'out' ? 'text-red-500' : 'text-amber-500')}>{p.currentStock}</span>
                                        {' '}/ {t('inv_min')}: {p.minStock} {p.unit}
                                    </p>
                                </div>
                                <span className={cn(
                                    'text-[10px] font-bold px-1.5 py-0.5 rounded-md flex-shrink-0',
                                    p.stockStatus === 'out' ? 'bg-red-50 text-red-600' : 'bg-amber-50 text-amber-600',
                                )}>
                                    {p.stockStatus === 'out' ? t('inv_outOfStock') : t('inv_lowStock')}
                                </span>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Pending orders */}
            {!loading && pendingOrders.length > 0 && (
                <div className="rounded-2xl bg-white border border-gray-100 shadow-sm overflow-hidden">
                    <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
                        <p className="text-xs font-bold text-gray-700">{t('inv_pendingOrdersTitle')}</p>
                        <span className="text-[10px] font-bold text-violet-600 bg-violet-50 px-2 py-0.5 rounded-full">
                            {pendingOrders.length} {t('inv_orders')}
                        </span>
                    </div>
                    <div className="divide-y divide-gray-50">
                        {pendingOrders.slice(0, 5).map(order => (
                            <div key={order.id} className="px-4 py-3 flex items-start gap-3">
                                <div className="flex-1 min-w-0">
                                    <div className="flex flex-wrap items-center gap-1.5 mb-0.5">
                                        <span className={cn('text-[10px] font-bold px-1.5 py-0.5 rounded-md', STATUS_COLOR[order.status] || 'bg-gray-100 text-gray-500')}>
                                            {STATUS_LABEL[order.status] || order.status}
                                        </span>
                                        <span className="text-[10px] text-gray-400">
                                            {new Date(order.timestamp).toLocaleDateString('vi-VN')}
                                        </span>
                                    </div>
                                    <p className="text-[11px] text-gray-600">
                                        <span className="font-semibold text-gray-800">{order.items.length}</span> {t('inv_items')}
                                        {' · '}
                                        <span className="font-semibold text-gray-800">{order.items.reduce((s, i) => s + i.requestedQty, 0)}</span> {t('inv_units')}
                                    </p>
                                </div>
                                <ClipboardList className="w-4 h-4 text-gray-300 flex-shrink-0 mt-0.5" />
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Empty state when all is good */}
            {!loading && outProds.length === 0 && lowProds.length === 0 && pendingOrders.length === 0 && products.length > 0 && (
                <div className="rounded-2xl bg-emerald-50 border border-emerald-100 px-4 py-6 flex flex-col items-center gap-2">
                    <CheckCircle2 className="w-8 h-8 text-emerald-400" />
                    <p className="text-sm font-semibold text-emerald-700">{t('inv_allGood')}</p>
                    <p className="text-xs text-emerald-500">{products.length} {t('inv_allGoodSub')}</p>
                </div>
            )}

            {/* Loading skeleton */}
            {loading && (
                <div className="flex flex-col gap-2">
                    {[1, 2, 3].map(i => (
                        <div key={i} className="h-16 rounded-2xl bg-gray-100 animate-pulse" />
                    ))}
                </div>
            )}

            {/* Quick link to full inventory page */}
            <button
                onClick={() => window.location.href = '/manager/inventory/order'}
                className="flex items-center justify-between px-4 py-3 rounded-2xl bg-white border border-gray-100 shadow-sm active:scale-[0.98] transition-transform"
            >
                <div className="flex items-center gap-2.5">
                    <span className="w-8 h-8 rounded-xl bg-sky-50 text-sky-500 flex items-center justify-center">
                        <Package className="w-4 h-4" strokeWidth={1.75} />
                    </span>
                    <span className="text-sm font-semibold text-gray-800">{t('inv_viewAll')}</span>
                </div>
                <ChevronRight className="w-4 h-4 text-gray-300" />
            </button>
        </div>
    );
}

const ALL_MOBILE_TAB_KEYS: { key: ManagementTab; labelKey: string; permKeys: string[] }[] = [
    { key: 'operation', labelKey: 'tab_operation', permKeys: ['page.scheduling.overview', 'page.scheduling.register', 'page.scheduling.builder'] },
    { key: 'revenue', labelKey: 'tab_revenue', permKeys: ['page.office.revenue'] },
    { key: 'inventory', labelKey: 'tab_inventory', permKeys: ['page.manager.inventory', 'page.admin.inventory'] },
];

function ManagementView() {
    const { t } = useMobileLang();
    const { effectiveStoreId, userDoc, hasPermission } = useAuth();
    const isAdmin = userDoc?.role === 'admin' || userDoc?.role === 'super_admin';

    const ALL_MOBILE_TABS = ALL_MOBILE_TAB_KEYS.map(tab => ({ ...tab, label: t(tab.labelKey) }));
    const visibleTabs = useMemo(() =>
        ALL_MOBILE_TABS.filter(tab => isAdmin || tab.permKeys.some(k => hasPermission(k))),
        // eslint-disable-next-line react-hooks/exhaustive-deps
        [isAdmin, hasPermission]
    );

    const [activeTab, setActiveTab] = useState<ManagementTab | null>(null);

    useEffect(() => {
        if (visibleTabs.length > 0 && (!activeTab || !visibleTabs.find(t => t.key === activeTab))) {
            setActiveTab(visibleTabs[0].key);
        }
    }, [visibleTabs]); // eslint-disable-line react-hooks/exhaustive-deps

    if (visibleTabs.length === 0) return null;

    return (
        <section className="mt-4 flex flex-col gap-3">
            {/* Tab bar — horizontally scrollable, pill-shaped */}
            <div className="px-3">
                <div className="flex gap-2 overflow-x-auto no-scrollbar snap-x pb-1 justify-center">
                    {visibleTabs.map((tab) => (
                        <button
                            key={tab.key}
                            onClick={() => setActiveTab(tab.key)}
                            className={cn(
                                'flex-shrink-0 flex-1 snap-start px-4 py-1 text-xs rounded-full font-semibold transition-all duration-200',
                                'active:scale-95',
                                activeTab === tab.key
                                    ? 'bg-primary-600 text-white shadow-sm'
                                    : 'bg-white text-gray-500 border border-gray-200',
                            )}
                        >
                            {tab.label}
                        </button>
                    ))}
                </div>
            </div>

            {/* Tab content */}
            <div className="px-3">
                {activeTab === 'operation' && <OperationTab effectiveStoreId={effectiveStoreId} />}
                {activeTab === 'revenue' && <RevenueTab />}
                {activeTab === 'inventory' && <InventoryTab />}
            </div>
        </section>
    );
}

// ─────────────────────────────────────────────────────────────────────────────
// Store Selector (inline in header)
// ─────────────────────────────────────────────────────────────────────────────
function MobileStoreSelector() {
    const { t } = useMobileLang();
    const { user, userDoc, managedStoreIds, effectiveStoreId, setEffectiveStoreId } = useAuth();
    const [stores, setStores] = useState<{ id: string; name: string }[]>([]);

    const isAdmin = userDoc?.role === 'admin' || userDoc?.role === 'super_admin';
    const isOfficeMulti = !isAdmin && managedStoreIds.length >= 1;

    useEffect(() => {
        if (!user) return;
        if (!isAdmin && managedStoreIds.length === 0) return;

        (async () => {
            try {
                const token = await user.getIdToken();
                const res = await fetch('/api/stores', { headers: { Authorization: `Bearer ${token}` } });
                if (!res.ok) return;
                const all: { id: string; name: string }[] = await res.json();
                if (isAdmin) {
                    setStores(all);
                } else {
                    // Office user — filter to only their managed stores
                    setStores(all.filter(s => managedStoreIds.includes(s.id)));
                }
            } catch { /* silent */ }
        })();
    }, [user, isAdmin, managedStoreIds]);

    // Store-fixed users (employee / store_manager) — no selector
    if (!isAdmin && managedStoreIds.length === 0) return null;
    // Still loading stores
    if (stores.length === 0) return null;

    // Office user with exactly 1 managed store — show static label, no dropdown
    if (isOfficeMulti && stores.length === 1) {
        return (
            <div className="relative z-10 flex items-center px-3 gap-1.5">
                <Building2 className="w-4 h-4 text-primary-100 flex-shrink-0" />
                <span className="text-sm font-medium text-white">{stores[0].name}</span>
            </div>
        );
    }

    // Admin or office user with ≥ 2 stores — full dropdown with "Tất cả" option
    return (
        <div className="relative z-10 flex items-center px-3">
            <Building2 className="w-4 h-4 text-primary-100 mr-1.5 flex-shrink-0" />
            <div className="flex items-center">
                <select
                    value={effectiveStoreId}
                    onChange={(e) => setEffectiveStoreId(e.target.value)}
                    className="appearance-none bg-transparent text-left text-sm font-medium text-white cursor-pointer pr-5 outline-none"
                    title={t('selectStore')}
                >
                    <option value="" className="text-gray-900">{t('allStores')}</option>
                    {stores.map((s) => (
                        <option key={s.id} value={s.id} className="text-gray-900">
                            {s.name}
                        </option>
                    ))}
                </select>
                <ChevronDown className="w-3.5 h-3.5 text-primary-200 pointer-events-none -ml-4" />
            </div>
        </div>
    );
}

// ─────────────────────────────────────────────────────────────────────────────
// Root component
// ─────────────────────────────────────────────────────────────────────────────
function MobileViewInner({ topReferralData }: { topReferralData?: { uid: string; name: string; points: number }[] }) {
    const { lang, setLang, t } = useMobileLang();
    const router = useRouter();
    const { userDoc, user, hasPermission } = useAuth();
    const isAdmin = userDoc?.role === 'admin' || userDoc?.role === 'super_admin';

    // ── Sticky header detection ───────────────────────────────────────────────
    const [isSticky, setIsSticky] = useState(false);
    const sentinelRef = useRef<HTMLDivElement>(null);
    const [showAllSheet, setShowAllSheet] = useState(false);
    const [unreadCount, setUnreadCount] = useState(0);
    const [showScrollModal, setShowScrollModal] = useState(false);
    useEffect(() => {
        const el = sentinelRef.current;
        if (!el) return;
        const observer = new IntersectionObserver(
            ([entry]) => setIsSticky(!entry.isIntersecting),
            { threshold: 0, rootMargin: '0px' }
        );
        observer.observe(el);
        return () => observer.disconnect();
    }, []);

    // ── Real-time unread notification count ────────────────────────────────
    useEffect(() => {
        if (!user) return;
        const q = query(
            collection(db, 'notifications'),
            where('userId', '==', user.uid),
            where('isRead', '==', false)
        );
        const unsub = onSnapshot(q, (snap) => setUnreadCount(snap.size));
        return () => unsub();
    }, [user]);

    // ── Custom roles (for badge display) ─────────────────────────────────────
    const [customRoles, setCustomRoles] = useState<CustomRoleDoc[]>([]);
    useEffect(() => {
        if (!user) return;
        (async () => {
            try {
                const token = await user.getIdToken();
                const res = await fetch('/api/roles', { headers: { Authorization: `Bearer ${token}` } });
                if (res.ok) setCustomRoles(await res.json());
            } catch { /* silent */ }
        })();
    }, [user]);

    // ── Role display maps ─────────────────────────────────────────────────────
    const roleLabelMap: Record<string, string> = {
        super_admin: t('role_super_admin'),
        admin: t('role_admin'),
        store_manager: t('role_store_manager'),
        manager: t('role_manager'),
        employee: t('role_employee'),
        office: t('role_office'),
    };
    const roleBadgeClass: Record<string, string> = {
        super_admin: 'bg-bduck-yellow/20 text-bduck-yellow border border-bduck-yellow/30',
        admin: 'bg-success-500/20 text-success-400 border border-success-500/30',
        store_manager: 'bg-accent-500/20 text-accent-300 border border-accent-500/30',
        manager: 'bg-warning-500/20 text-warning-300 border border-warning-500/30',
        employee: 'bg-primary-500/20 text-primary-300 border border-primary-500/30',
        office: 'bg-teal-500/20 text-teal-300 border border-teal-500/30',
    };
    const roleDotClass: Record<string, string> = {
        super_admin: 'bg-bduck-yellow',
        admin: 'bg-success-400',
        store_manager: 'bg-accent-400',
        manager: 'bg-warning-400',
        employee: 'bg-primary-400',
        office: 'bg-teal-400',
    };

    // ── Role-based rendering logic ───────────────────────────────────────────
    // Personal schedule shows for employees and anyone with scheduling permissions
    const showPersonalSchedule =
        userDoc?.role === 'employee' || (!isAdmin && hasPermission('page.scheduling.overview'));

    // Quick access items with permission keys — items without permKey are always visible
    // Employee-specific items (visible when role is 'employee')
    const isEmployee = userDoc?.role === 'employee';

    const employeeQuickAccessItems = [
        {
            icon: LayoutDashboard,
            label: t('qa_mySchedule'),
            colorClass: 'bg-blue-300 text-blue-900',
            route: '/employee/dashboard',
        },
        {
            icon: PlusSquare,
            label: t('qa_registerShift'),
            colorClass: 'bg-emerald-300 text-emerald-900',
            route: '/employee/register',
        },
        {
            icon: TrendingUp,
            label: t('qa_myKpi'),
            colorClass: 'bg-amber-300 text-amber-900',
            route: '/employee/kpi-stats',
        },
        {
            icon: Repeat,
            label: t('qa_handover'),
            colorClass: 'bg-violet-300 text-violet-900',
            route: '/employee/inventory/handover',
        },
    ];

    // Manager/Admin quick access items
    const managerQuickAccessItems = [
        {
            icon: Calendar,
            label: t('qa_scheduling'),
            colorClass: 'bg-blue-300 text-blue-900',
            route: '/manager/scheduling/overview',
            permKeys: ['page.scheduling.overview'],
        },
        {
            icon: User,
            label: t('qa_hr'),
            colorClass: 'bg-violet-300 text-violet-900',
            route: '/manager/hr/users',
            permKeys: ['page.hr.users'],
        },
        {
            icon: Clock,
            label: t('qa_attendance'),
            route: '/manager/hr/attendance',
            colorClass: 'bg-teal-300 text-teal-900',
            permKey: 'page.hr.attendance'
        },

        {
            icon: DollarSign,
            label: t('qa_revenue'),
            colorClass: 'bg-amber-300 text-amber-900',
            route: '/office/revenue',
            permKeys: ['page.office.revenue'],
        },
    ];

    // Choose which quick access items to show based on role
    const allQuickAccessItems = isEmployee
        ? employeeQuickAccessItems
        : managerQuickAccessItems.filter(item =>
            isAdmin || !item.permKeys || item.permKeys.some(k => hasPermission(k))
        );

    // Filter quick access by permissions (admin sees all), always append 'Tất cả'
    const quickAccessItems = [
        ...allQuickAccessItems,
        {
            icon: LayoutGrid,
            label: t('qa_all'),
            colorClass: 'bg-gray-200 text-gray-700',
            route: '',
        },
    ];

    // ── All navigation groups — filtered by permission ────────────────────────
    const rawNavGroups = [
        // ── Employee-specific section ──────────────────────────────────
        ...(isEmployee ? [{
            group: t('group_employee'),
            items: [
                { icon: LayoutDashboard, label: t('nav_mySchedule'), route: '/employee/dashboard', color: 'bg-blue-50 text-blue-600' },
                { icon: PlusSquare, label: t('nav_registerShift'), route: '/employee/register', color: 'bg-blue-50 text-blue-600' },
                { icon: TrendingUp, label: t('nav_myKpi'), route: '/employee/kpi-stats', color: 'bg-amber-50 text-amber-600' },
                { icon: Star, label: t('nav_referralPoints'), route: '/employee/referral-history', color: 'bg-amber-50 text-amber-600' },
                { icon: Repeat, label: t('nav_handover'), route: '/employee/inventory/handover', color: 'bg-emerald-50 text-emerald-600' },
                { icon: FileText, label: t('nav_usageReport'), route: '/employee/inventory/usage', color: 'bg-emerald-50 text-emerald-600' },
            ],
        }] : []),
        // ── Scheduling (manager+) ───────────────────────────────────────
        {
            group: t('group_operation'),
            items: [
                { icon: Calendar, label: t('nav_scheduling'), route: '/manager/scheduling/overview', color: 'bg-blue-50 text-blue-600', permKey: 'page.scheduling.overview' },
                { icon: ClipboardList, label: t('nav_shiftRegister'), route: '/manager/scheduling/register', color: 'bg-blue-50 text-blue-600', permKey: 'page.scheduling.register' },
                { icon: PlusSquare, label: t('nav_shiftBuilder'), route: '/manager/scheduling/builder', color: 'bg-blue-50 text-blue-600', permKey: 'page.scheduling.builder' },
                { icon: Activity, label: t('nav_shiftHistory'), route: '/manager/scheduling/history', color: 'bg-blue-50 text-blue-600', permKey: 'page.scheduling.history' },
            ],
        },
        // ── HR (manager+) ──────────────────────────────────────────────
        {
            group: t('group_hr'),
            items: [
                { icon: Users, label: t('nav_staffList'), route: '/manager/hr/users', color: 'bg-violet-50 text-violet-600', permKey: 'page.hr.users' },
                { icon: TrendingUp, label: t('nav_kpiStats'), route: '/manager/hr/kpi-stats', color: 'bg-violet-50 text-violet-600', permKey: 'page.hr.kpi_stats' },
                { icon: ClipboardCheck, label: t('nav_kpiScoring'), route: '/manager/hr/kpi-scoring', color: 'bg-violet-50 text-violet-600', permKey: 'page.hr.kpi_scoring' },
                { icon: Settings, label: t('nav_kpiTemplates'), route: '/manager/settings/kpi-templates', color: 'bg-violet-50 text-violet-600', permKey: 'page.hr.kpi_templates' },
                { icon: Star, label: t('nav_referralHistory'), route: '/employee/referral-history', color: 'bg-amber-50 text-amber-600', permKey: 'page.referral.history' },
                { icon: Clock, label: t('nav_attendanceCheck'), route: '/manager/hr/attendance', color: 'bg-teal-50 text-teal-600', permKey: 'page.hr.attendance' },
            ],
        },
        // ── Store Inventory (manager+) ─────────────────────────────────
        {
            group: t('group_storeInventory'),
            items: [
                { icon: Package, label: t('nav_orderGoods'), route: '/manager/inventory/order', color: 'bg-emerald-50 text-emerald-600', permKey: 'page.manager.inventory' },
                { icon: PackagePlus, label: t('nav_receiveGoods'), route: '/manager/inventory/receive', color: 'bg-emerald-50 text-emerald-600', permKey: 'page.manager.inventory' },
                { icon: ArrowLeftRight, label: t('nav_transferGoods'), route: '/manager/inventory/transfer', color: 'bg-emerald-50 text-emerald-600', permKey: 'page.manager.inventory' },
                { icon: ClipboardList, label: t('nav_stockLedger'), route: '/manager/inventory/ledger', color: 'bg-emerald-50 text-emerald-600', permKey: 'page.manager.inventory' },
                { icon: LayoutGrid, label: t('nav_counters'), route: '/manager/inventory/counters', color: 'bg-emerald-50 text-emerald-600', permKey: 'page.manager.inventory' },
                { icon: Repeat, label: t('nav_handoverInv'), route: '/manager/inventory/handover', color: 'bg-emerald-50 text-emerald-600', permKey: 'page.manager.inventory' },
                { icon: FileText, label: t('nav_usage'), route: '/manager/inventory/usage', color: 'bg-emerald-50 text-emerald-600', permKey: 'page.manager.inventory' },
                { icon: Package, label: t('nav_dispatchGoods'), route: '/manager/inventory/dispatch', color: 'bg-emerald-50 text-emerald-600', permKey: 'page.manager.inventory' },
            ],
        },
        // ── Revenue (office+) ─────────────────────────────────────────
        {
            group: t('group_revenue'),
            items: [
                { icon: DollarSign, label: t('nav_revenueReport'), route: '/office/revenue', color: 'bg-amber-50 text-amber-600', permKey: 'page.office.revenue' },
            ],
        },
        // ── Marketing ─────────────────────────────────────────
        {
            group: t('group_marketing'),
            items: [
                { icon: Link2, label: t('nav_trackingLinks'), route: '/office/tracking', color: 'bg-pink-50 text-pink-600', permKey: 'page.office.tracking' },
                { icon: Ticket, label: t('nav_voucherMgmt'), route: '/admin/vouchers', color: 'bg-pink-50 text-pink-600', permKey: 'page.admin.vouchers' },
                { icon: CalendarDays, label: t('nav_eventMgmt'), route: '/admin/events', color: 'bg-pink-50 text-pink-600', permKey: 'page.admin.events' },
            ],
        },
        // ── Admin (admin only) ─────────────────────────────────────────
        {
            group: t('group_admin'),
            items: [
                { icon: BarChart3, label: t('nav_dailyReport'), route: '/admin/daily-report', color: 'bg-rose-50 text-rose-600', permKey: 'page.admin.daily_report' },
            ],
        },
        // ── Cá nhân  (always visible) ─────────────────────────────────
        {
            group: t('group_personal'),
            items: [
                { icon: User, label: t('nav_profile'), route: '/profile', color: 'bg-gray-100 text-gray-600' },
                { icon: Bell, label: t('nav_notifications'), route: '/mobile/notifications', color: 'bg-gray-100 text-gray-600' },
                { icon: Settings, label: t('nav_storeSettings'), route: '/manager/settings', color: 'bg-gray-100 text-gray-600', permKey: 'page.manager.settings' },
            ],
        },
    ];

    // Filter items by permission — admin sees all, items without permKey are always visible
    const allNavGroups = rawNavGroups
        .map(group => ({
            ...group,
            items: group.items.filter(item =>
                isAdmin || !('permKey' in item) || !(item as { permKey?: string }).permKey || hasPermission((item as { permKey: string }).permKey)
            ),
        }))
        .filter(group => group.items.length > 0);

    return (
        <>
            <div className="min-h-screen bg-gray-50 pb-6">
                {/* ── Header ──────────────────────────────────────────────────── */}
                <header className="relative">
                    {/* Background wave */}
                    <div className="absolute inset-0 z-0 pointer-events-none">
                        <div className="bg-primary-600 h-full" />
                        <svg
                            viewBox="0 90 1440 150"
                            preserveAspectRatio="none"
                            className="w-full h-12 block"
                        >
                            <path
                                className='fill-primary-600'
                                fill-opacity="1"
                                d="M0,224L80,202.7C160,181,320,139,480,149.3C640,160,800,224,960,229.3C1120,235,1280,181,1360,154.7L1440,128L1440,0L1360,0C1280,0,1120,0,960,0C800,0,640,0,480,0C320,0,160,0,80,0L0,0Z"></path>
                        </svg>
                    </div>

                    {/* Logo */}
                    <div className="relative z-10 flex justify-center pt-2">
                        <Image
                            src="/logo.png"
                            alt="Logo"
                            height={84}
                            width={84}
                            className="object-contain drop-shadow"
                        />
                    </div>

                    {/* Sentinel — observed to detect sticky state */}
                    <div ref={sentinelRef} className="h-0" />

                    {/* User info row */}
                    <div className={cn(
                        'z-20 flex justify-between items-center px-3 -mt-4 pb-2 sticky top-0',
                        'transition-all duration-200',
                    )}>

                        <div className="flex flex-col flex-1">
                            <span className="text-primary-100 text-xs mb-1">{t('greeting')}</span>
                            <span className="text-lg text-white font-bold leading-tight">
                                {userDoc?.name ?? t('defaultUser')}
                            </span>
                            <span className="text-xs text-white">
                                {userDoc && (
                                    <>
                                        <span className={cn("size-1.5 rounded-full shrink-0", roleDotClass[userDoc.role] ?? 'bg-surface-400')} />
                                        {(() => {
                                            if (userDoc.customRoleId) {
                                                const cr = customRoles.find(r => r.id === userDoc.customRoleId);
                                                return cr?.name ?? roleLabelMap[userDoc.role] ?? userDoc.role;
                                            }
                                            return roleLabelMap[userDoc.role] ?? userDoc.role;
                                        })()}
                                    </>
                                )}
                            </span>
                        </div>
                        <div className="flex gap-2 items-center">
                            {/* Language toggle — VI / ZH */}

                            <button
                                onClick={() => router.push('/profile')}
                                className={cn(
                                    'w-10 h-10 rounded-full flex items-center justify-center',
                                    'bg-white/20 text-white active:scale-95 transition-transform',
                                )}
                            >
                                <User className="w-5 h-5" strokeWidth={1.75} />
                            </button>
                            <button
                                onClick={() => router.push('/mobile/notifications')}
                                className={cn(
                                    'w-10 h-10 rounded-full flex items-center justify-center relative',
                                    'bg-white/20 text-white active:scale-95 transition-transform',
                                )}
                            >
                                <Bell className="w-5 h-5" strokeWidth={1.75} />
                                {unreadCount > 0 && (
                                    <span className="absolute -top-0.5 -right-0.5 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-red-500 text-[9px] font-bold text-white px-0.5 ring-2 ring-primary-600">
                                        {unreadCount > 99 ? '99+' : unreadCount}
                                    </span>
                                )}
                            </button>
                            <button
                                onClick={() => setLang(lang === 'vi' ? 'zh' : 'vi')}
                                className={cn(
                                    'w-10 h-10 p-2 relative rounded-full flex items-center justify-center',
                                    'bg-white/20 text-white active:scale-95 transition-transform',
                                    'text-[11px] font-bold tracking-wide leading-none',
                                )}
                                title={lang === 'vi' ? 'Switch to Chinese' : '切换为越南语'}
                            >
                                <Image src={lang === 'vi' ? '/flag-icons/vietnam.png' : '/flag-icons/china.png'} alt="Language" fill className='object-contain size-8 ,auto' />
                            </button>
                        </div>
                    </div>

                    {/* Store selector — admin gets all stores, office users get managed stores */}
                    <MobileStoreSelector />

                    {/* Spacer so wave doesn't clip content */}
                    <div className="relative z-0 h-0" />
                </header>

                {/* ── Top Referral Employees Marquee ──────────────────────────── */}
                <TopReferralMarquee
                    className="mx-3 mt-12"
                    initialData={topReferralData}
                    onClick={() => setShowScrollModal(true)}
                    lang={lang}
                />

                {/* ── Quick Access ─────────────────────────────────────────────── */}
                <section className="px-3 mt-3">
                    <p className="text-sm font-bold text-gray-800 mb-2">{t('quickAccess')}</p>
                    <div className="flex items-center justify-between gap-1">
                        {quickAccessItems.map((item) => (
                            <QuickAccessItem
                                key={item.label}
                                icon={item.icon}
                                label={item.label}
                                colorClass={item.colorClass}
                                onClick={item.route === '' ? () => setShowAllSheet(true) : () => router.push(item.route)}
                            />
                        ))}
                    </div>
                </section>

                <div className='mt-3 px-3'>
                    <ReferralPointsWidget />
                </div>

                {/* ── Role-based content ───────────────────────────────────────── */}
                {showPersonalSchedule && (
                    <PersonalScheduleView onNavigate={() => router.push('/employee/dashboard')} onNavigateRegister={() => router.push('/employee/register')} />
                )}
                <ManagementView />

                {/* ── All Navigation BottomSheet ──────────────────────────────── */}
                <BottomSheet
                    isOpen={showAllSheet}
                    onClose={() => setShowAllSheet(false)}
                    title={t('allFunctions')}
                >
                    <div className="flex flex-col gap-4 px-4 pt-4 pb-6">
                        {allNavGroups.map((group) => (
                            <div key={group.group}>
                                <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 px-1 mb-2">{group.group}</p>
                                <div className="grid grid-cols-3 gap-2">
                                    {group.items.map((item) => {
                                        const Icon = item.icon;
                                        return (
                                            <button
                                                key={item.label}
                                                onClick={() => { setShowAllSheet(false); router.push(item.route); }}
                                                className="flex flex-col items-center gap-1.5 p-3 rounded-2xl bg-white border border-gray-100 shadow-sm active:scale-95 transition-transform"
                                            >
                                                <span className={cn('w-10 h-10 rounded-xl flex items-center justify-center', item.color)}>
                                                    <Icon className="w-5 h-5" strokeWidth={1.75} />
                                                </span>
                                                <span className="text-[11px] font-medium text-gray-700 text-center leading-tight">{item.label}</span>
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>
                        ))}
                    </div>
                </BottomSheet>
            </div>

            {/* Imperial Scroll Modal — always fetches fresh Firestore data */}
            {showScrollModal && (
                <ReferralCelebrationModal
                    forceOpen
                    onClose={() => setShowScrollModal(false)}
                    lang={lang}
                />
            )}
        </>
    );
}

export default function MobileView({ topReferralData }: { topReferralData?: { uid: string; name: string; points: number }[] }) {
    return (
        <MobileLangProvider>
            <MobileViewInner topReferralData={topReferralData} />
        </MobileLangProvider>
    );
}
