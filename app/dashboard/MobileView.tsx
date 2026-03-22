'use client';

import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { db } from '@/lib/firebase';
import { collection, query, getDocs, where, getDoc, doc } from 'firebase/firestore';
import {
    QrCode, PlusSquare, ClipboardList, LayoutGrid,
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
} from '@/app/(dashboard)/office/revenue/actions';

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
// View A: Personal Schedule (for Staff / employee role)
// ─────────────────────────────────────────────────────────────────────────────
function PersonalScheduleView({ onNavigate }: { onNavigate: () => void }) {
    return (
        <section className="px-3 mt-4 flex flex-col gap-3">
            <h2 className="text-sm font-bold text-gray-800">Ca làm việc của bạn</h2>

            {/* Today's shift card — tappable, routes to /schedule */}
            <button
                onClick={onNavigate}
                className={cn(
                    'w-full text-left rounded-2xl shadow-sm overflow-hidden',
                    'bg-white border border-gray-100',
                    'active:scale-[0.98] transition-transform duration-100',
                )}
            >
                {/* Top gradient accent strip */}
                <div className="h-1 bg-gradient-to-r from-primary-400 to-primary-600" />

                <div className="p-4 flex items-center gap-3">
                    {/* Icon */}
                    <span className="w-12 h-12 rounded-xl bg-primary-50 text-primary-600 flex items-center justify-center flex-shrink-0">
                        <Clock className="w-6 h-6" strokeWidth={1.75} />
                    </span>

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                        <p className="text-[11px] font-medium text-gray-400 uppercase tracking-wide">
                            Hôm nay · Ca Sáng
                        </p>
                        <p className="text-xl font-bold text-gray-900 mt-0.5 tracking-tight">
                            08:00 – 15:00
                        </p>
                        <p className="text-xs text-gray-500 mt-0.5 truncate">
                            Quầy A · Landmark 81
                        </p>
                    </div>

                    {/* Status badge + chevron */}
                    <div className="flex flex-col items-end gap-2 flex-shrink-0">
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-green-50 text-green-600 text-[10px] font-semibold">
                            <CheckCircle2 className="w-3 h-3" />
                            Đã Check-in
                        </span>
                        <ChevronRight className="w-4 h-4 text-gray-300" />
                    </div>
                </div>
            </button>

            {/* Upcoming shift teaser */}
            <div className="rounded-2xl bg-white border border-gray-100 shadow-sm p-4 flex items-center gap-3">
                <span className="w-10 h-10 rounded-xl bg-amber-50 text-amber-500 flex items-center justify-center flex-shrink-0">
                    <Clock className="w-5 h-5" strokeWidth={1.75} />
                </span>
                <div className="flex-1 min-w-0">
                    <p className="text-[11px] text-gray-400 font-medium uppercase tracking-wide">
                        Ca tiếp theo
                    </p>
                    <p className="text-sm font-semibold text-gray-800">
                        Thứ Tư · Ca Chiều · 15:00 – 22:00
                    </p>
                </div>
            </div>
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
                    sub="Nhân sự"
                    icon={Users}
                    colorClass="bg-blue-50 text-blue-500"
                />
                <MetricCard
                    value={loading ? '…' : kpiAvg !== null ? kpiAvg : '-'}
                    sub="KPI TB/tháng"
                    icon={TrendingUp}
                    colorClass="bg-emerald-50 text-emerald-500"
                />
                <MetricCard
                    value={loading ? '…' : nextWeekCount ?? '-'}
                    sub="Đã đăng ký"
                    icon={Calendar}
                    colorClass="bg-violet-50 text-violet-500"
                />
            </div>

            <div>
                <p className="text-xs mb-1 font-semibold text-gray-700">Lịch làm việc cửa hàng</p>
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
                                : 'Tuần này'
                            }
                            {weekOffset === 0 && (
                                <span className="px-1.5 py-0.5 rounded-full bg-primary-50 text-primary-600 text-[10px] font-bold">Hiện tại</span>
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
                                <p className="text-center text-xs text-gray-400">Chọn cửa hàng để xem lịch</p>
                            </div>
                        ) : loading ? (
                            <div className="h-full flex items-center justify-center">
                                <Loader2 className="w-5 h-5 animate-spin text-gray-300" />
                            </div>
                        ) : shiftNames.length === 0 ? (
                            <div className="h-full flex items-center justify-center">
                                <p className="text-center text-xs text-gray-400">Chưa có dữ liệu ca</p>
                            </div>
                        ) : (
                            <div className="overflow-x-auto">
                                <table className="w-full text-xs border-collapse min-w-[340px]">
                                    <thead>
                                        <tr>
                                            <th className="sticky left-0 z-10 bg-gray-50 px-3 py-2.5 text-left font-semibold text-gray-400 border-b border-gray-100 w-[60px] text-[11px]">Ca</th>
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
                                <span className="w-2 h-2 rounded-sm bg-red-100 inline-block" />CTH = Cửa hàng trưởng
                            </span>
                            <span className="flex items-center gap-1.5 text-[11px] text-gray-500">
                                <span className="w-2 h-2 rounded-sm bg-amber-100 inline-block" />QL = Quản lý
                            </span>
                            <span className="flex items-center gap-1.5 text-[11px] text-gray-500">
                                <span className="w-2 h-2 rounded-sm bg-blue-100 inline-block" />NV = Nhân viên
                            </span>
                        </div>
                    )}
                </div>
            </div>

            {/* ── Employee schedule registration calendar ────────────────── */}
            <div>
                <div className="flex items-center justify-between mb-2">
                    <p className="text-xs font-semibold text-gray-700">Lịch đăng ký ca nhân viên</p>
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
                                    Hiện tại
                                </span>
                            )}
                            {calendarWeekOffset === 1 && (
                                <span className="px-1.5 py-0.5 rounded-full bg-violet-50 text-violet-600 text-[10px] font-bold">
                                    Tuần sau
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
                            <p className="text-xs text-gray-400">Chưa cấu hình ca làm việc</p>
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
                                            'snap-start flex-shrink-0 w-[138px] rounded-2xl border shadow-sm overflow-hidden text-left',
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
                                                        <p className="text-[10px] text-gray-300 italic">Chưa có NV</p>
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
                        <p className="text-center text-sm text-gray-400 py-6">Không có dữ liệu</p>
                    ) : (
                        selectedDaySchedule.map(({ shift, employees }) => (
                            <div key={shift} className="rounded-2xl border border-gray-100 overflow-hidden">
                                {/* Shift header */}
                                <div className="flex items-center gap-2 px-3 py-2 bg-gray-50 border-b border-gray-100">
                                    <Clock className="w-3.5 h-3.5 text-primary-500 flex-shrink-0" />
                                    <span className="text-xs font-bold text-gray-700">{shift}</span>
                                    <span className="ml-auto text-[10px] font-medium text-gray-400">
                                        {employees.length} người
                                    </span>
                                </div>

                                {/* Employee list */}
                                {employees.length === 0 ? (
                                    <p className="px-3 py-3 text-xs text-gray-400">Chưa có</p>
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
function fmtShort(v: number) {
    if (v >= 1_000_000_000) return `${(v / 1_000_000_000).toFixed(1)} tỷ`;
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
    const [filterMode, setFilterMode] = useState<RevFilterMode>('day');
    const [dayDate, setDayDate] = useState(todayStr());
    const [monthDate, setMonthDate] = useState(todayStr().slice(0, 7));
    const [customStart, setCustomStart] = useState(monthStart());
    const [customEnd, setCustomEnd] = useState(todayStr());

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
            if (!result.success) { setError(result.error || 'Đã xảy ra lỗi.'); setData([]); setSellData([]); setDailyPanel(null); }
            else { setData(result.data); setSellData(result.sellData); setDailyPanel(result.dailyPanel ?? null); setUpdatedAt(result.updatedAt); }
        } catch { setError('Không thể kết nối.'); setData([]); setSellData([]); setDailyPanel(null); }
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
            else setError(result.error || 'Đồng bộ thất bại.');
        } catch { setError('Đồng bộ thất bại.'); }
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
            date: d.forDate.slice(5), 'Thực thu': d.realMoney, 'Tiền mặt': d.cashRealMoney, 'Chuyển khoản': d.transferRealMoney,
        })), [data]);

    const paymentPieData = useMemo(() => {
        if (dailyPanel?.paymentStats?.length) return dailyPanel.paymentStats.map(p => ({ name: p.paymentCategoryName, value: p.totalRealMoney })).filter(d => d.value > 0);
        return [{ name: 'Tiền mặt', value: kpis.totalCash }, { name: 'Chuyển khoản', value: kpis.totalTransfer }].filter(d => d.value > 0);
    }, [data, dailyPanel, kpis]);

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
                        const labels = ['Ngày', 'Tháng', 'Tùy chọn'];
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
                    {updatedAt && <span className="text-[10px] text-gray-400">Cập nhật: {new Date(updatedAt).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}</span>}
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
                        <p className="text-[10px] font-bold uppercase tracking-widest text-primary-100">Thực thu</p>
                        <p className="text-3xl font-extrabold text-white mt-1 tracking-tight leading-tight">
                            {fmtShort(dailyPanel?.shopSummary?.shopRealMoney ?? kpis.totalReal)}
                        </p>
                        <p className="text-xs text-primary-200 mt-1">{fmtVND(dailyPanel?.shopSummary?.shopRealMoney ?? kpis.totalReal)}</p>
                    </div>

                    {/* KPI grid */}
                    <div className="grid grid-cols-2 gap-2">
                        {[
                            { label: 'Tiền mặt', value: fmtShort(kpis.totalCash), sub: `${kpis.totalReal > 0 ? ((kpis.totalCash / kpis.totalReal) * 100).toFixed(0) : 0}%`, color: 'bg-blue-50', textColor: 'text-blue-700', Icon: Banknote },
                            { label: 'Chuyển khoản', value: fmtShort(kpis.totalTransfer), sub: `${kpis.totalReal > 0 ? ((kpis.totalTransfer / kpis.totalReal) * 100).toFixed(0) : 0}%`, color: 'bg-violet-50', textColor: 'text-violet-700', Icon: ArrowUpDown },
                            { label: 'Xu bán', value: fmtV(kpis.totalCoins), sub: `Giá: ${fmtShort(data[0]?.sellCoinPrice || 0)}`, color: 'bg-amber-50', textColor: 'text-amber-700', Icon: Coins },
                            isMultiDay
                                ? { label: 'Ngày cao nhất', value: kpis.peakDay ? fmtShort(kpis.peakDay.realMoney) : '—', sub: kpis.peakDay?.forDate || '', color: 'bg-pink-50', textColor: 'text-pink-700', Icon: TrendingUp }
                                : { label: 'Đã hủy', value: fmtShort(kpis.totalRefund), sub: kpis.totalRefund > 0 ? 'Giao dịch hủy' : 'Không có', color: 'bg-red-50', textColor: 'text-red-600', Icon: XCircle },
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
                            <p className="text-xs font-bold text-gray-700 mb-2">Tổng kết ngày {data[0]?.forDate ?? dayDate}</p>
                            <div className="grid grid-cols-2 gap-1.5">
                                {[
                                    { l: 'Tổng hoá đơn', v: fmtVND(dailyPanel.shopSummary.shopMoney), c: 'text-gray-700', bg: 'bg-gray-50' },
                                    { l: 'Thực thu', v: fmtVND(dailyPanel.shopSummary.shopRealMoney), c: 'text-green-700', bg: 'bg-green-50' },
                                    { l: 'Đã hủy', v: fmtVND(dailyPanel.shopSummary.refundMoney), c: 'text-red-600', bg: 'bg-red-50' },
                                    { l: 'Tiền mặt', v: fmtVND(kpis.totalCash), c: 'text-blue-700', bg: 'bg-blue-50' },
                                    { l: 'Chuyển khoản', v: fmtVND(kpis.totalTransfer), c: 'text-violet-700', bg: 'bg-violet-50' },
                                    { l: 'Xu bán', v: fmtV(kpis.totalCoins), c: 'text-amber-700', bg: 'bg-amber-50' },
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
                            <p className="text-xs font-bold text-gray-700 mb-3">Doanh thu theo ngày</p>
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
                                        <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 9, fill: '#94a3b8' }} tickFormatter={fmtShort} width={40} />
                                        <RechartsTooltip contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 8px 24px rgb(0 0 0 / 0.1)', fontSize: '11px' }} />
                                        <Area type="monotone" dataKey="Thực thu" stroke="#10b981" strokeWidth={2} fill="url(#gR)" dot={false} activeDot={{ r: 3 }} />
                                        <Area type="monotone" dataKey="Tiền mặt" stroke="#3b82f6" strokeWidth={1.5} fill="transparent" dot={false} activeDot={{ r: 3 }} />
                                        <Area type="monotone" dataKey="Chuyển khoản" stroke="#8b5cf6" strokeWidth={1.5} fill="transparent" dot={false} activeDot={{ r: 3 }} />
                                    </AreaChart>
                                </ResponsiveContainer>
                            </div>
                        </div>
                    )}

                    {/* Payment donut */}
                    {paymentPieData.length > 0 && (
                        <div className="rounded-2xl bg-white border border-gray-100 shadow-sm p-3">
                            <p className="text-xs font-bold text-gray-700 mb-2">Phương thức thanh toán</p>
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
                                                    <span className="text-[11px] font-bold text-gray-800">{fmtShort(item.value)}</span>
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
                                <p className="text-xs font-bold text-gray-700">Top sản phẩm</p>
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
                                            <p className="text-[11px] font-bold text-gray-800">{fmtShort(item.realMoney)}</p>
                                            <p className="text-[9px] text-gray-400">SL: {item.realQty}</p>
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
                        <p className="text-sm font-semibold text-gray-600">Không có dữ liệu</p>
                        <p className="text-xs text-gray-400 mt-0.5">Nhấn sync để tải từ Joyworld</p>
                    </div>
                    <button onClick={handleSync} disabled={syncing}
                        className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-primary-600 text-white text-xs font-semibold active:scale-95 transition-transform disabled:opacity-50">
                        <RefreshCw className={cn('w-3.5 h-3.5', syncing && 'animate-spin')} />
                        {syncing ? 'Đang tải...' : 'Đồng bộ ngay'}
                    </button>
                </div>
            )}
        </div>
    );
}

function InventoryTab() {
    return (
        <div className="flex flex-col gap-3">
            <MetricCard
                value="1,204"
                sub="Đang theo dõi trong kho"
                icon={Package}
                colorClass="bg-sky-50 text-sky-500"
            />
            <MetricCard
                value="18 SKU"
                sub="Dưới ngưỡng tồn tối thiểu"
                icon={PackagePlus}
                colorClass="bg-rose-50 text-rose-500"
                alert
            />
            <MetricCard
                value="3"
                sub="Chờ xác nhận từ kho tổng"
                icon={ArrowLeftRight}
                colorClass="bg-orange-50 text-orange-500"
            />
        </div>
    );
}

const TABS: { key: ManagementTab; label: string }[] = [
    { key: 'operation', label: 'Vận hành' },
    { key: 'revenue', label: 'Doanh thu' },
    { key: 'inventory', label: 'Kho bãi' },
];

function ManagementView() {
    const [activeTab, setActiveTab] = useState<ManagementTab>('operation');
    const { effectiveStoreId } = useAuth();

    return (
        <section className="mt-4 flex flex-col gap-3">
            {/* Tab bar — horizontally scrollable, pill-shaped */}
            <div className="px-3">
                <div className="flex gap-2 overflow-x-auto no-scrollbar snap-x pb-1 justify-center">
                    {TABS.map((tab) => (
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
                    title="Chọn cửa hàng để xem"
                >
                    <option value="" className="text-gray-900">Tất cả cửa hàng</option>
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
export default function MobileView() {
    const router = useRouter();
    // useAuth() provides the authenticated user document.
    // Replace mock below with real data once API is wired.
    const { userDoc, user } = useAuth();

    // ── Sticky header detection ───────────────────────────────────────────────
    const [isSticky, setIsSticky] = useState(false);
    const sentinelRef = useRef<HTMLDivElement>(null);
    const [showAllSheet, setShowAllSheet] = useState(false);
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
        super_admin: 'Siêu Quản Trị',
        admin: 'Quản Trị Viên',
        store_manager: 'Cửa Hàng Trưởng',
        manager: 'Quản Lý',
        employee: 'Nhân Viên',
        office: 'Văn Phòng',
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
    // Employees (role === 'employee') always see their personal schedule.
    // Store managers, office staff, managers, and admins see management tabs.
    // Adjust this condition as business rules evolve.
    const showPersonalSchedule =
        userDoc?.role === 'employee';

    const quickAccessItems = [
        {
            icon: Calendar,
            label: 'Lịch làm',
            colorClass: 'bg-blue-300 text-blue-900',
            route: '/manager/scheduling/overview',
        },
        {
            icon: User,
            label: 'Nhân sự',
            colorClass: 'bg-violet-300 text-violet-900',
            route: '/manager/hr/users',
        },
        {
            icon: Package,
            label: 'Kho cửa hàng',
            colorClass: 'bg-violet-300 text-violet-900',
            route: '/manager/inventory/order',
        },
        {
            icon: DollarSign,
            label: 'Doanh thu',
            colorClass: 'bg-amber-300 text-amber-900',
            route: '/office/revenue',
        },
        {
            icon: LayoutGrid,
            label: 'Tất cả',
            colorClass: 'bg-gray-200 text-gray-700',
            route: '',
        },
    ];

    // ── All navigation groups ─────────────────────────────────────────────────
    const allNavGroups = [
        {
            group: 'Vận hành',
            items: [
                { icon: Calendar, label: 'Lịch làm việc', route: '/manager/scheduling/overview', color: 'bg-blue-50 text-blue-600' },
                { icon: ClipboardList, label: 'Đăng ký ca', route: '/manager/scheduling/register', color: 'bg-blue-50 text-blue-600' },
                { icon: PlusSquare, label: 'Xây dựng lịch', route: '/manager/scheduling/builder', color: 'bg-blue-50 text-blue-600' },
                { icon: Activity, label: 'Lịch sử ca', route: '/manager/scheduling/history', color: 'bg-blue-50 text-blue-600' },
            ],
        },
        {
            group: 'Nhân sự',
            items: [
                { icon: Users, label: 'Danh sách NV', route: '/manager/hr/users', color: 'bg-violet-50 text-violet-600' },
                { icon: TrendingUp, label: 'KPI Thống kê', route: '/manager/hr/kpi-stats', color: 'bg-violet-50 text-violet-600' },
                { icon: QrCode, label: 'Chấm công QR', route: '/scan', color: 'bg-violet-50 text-violet-600' },
            ],
        },
        {
            group: 'Kho bãi',
            items: [
                { icon: Package, label: 'Kho cửa hàng', route: '/manager/inventory/order', color: 'bg-emerald-50 text-emerald-600' },
                { icon: ArrowLeftRight, label: 'Chuyển kho', route: '/manager/inventory/transfer', color: 'bg-emerald-50 text-emerald-600' },
                { icon: PackagePlus, label: 'Nhập hàng', route: '/manager/inventory/receive', color: 'bg-emerald-50 text-emerald-600' },
                { icon: ClipboardList, label: 'Sổ kho', route: '/manager/inventory/ledger', color: 'bg-emerald-50 text-emerald-600' },
            ],
        },
        {
            group: 'Doanh thu',
            items: [
                { icon: DollarSign, label: 'Báo cáo', route: '/office/revenue', color: 'bg-amber-50 text-amber-600' },
            ],
        },
        {
            group: 'Cá nhân',
            items: [
                { icon: User, label: 'Hồ sơ', route: '/profile', color: 'bg-gray-100 text-gray-600' },
                { icon: Bell, label: 'Thông báo', route: '/notifications', color: 'bg-gray-100 text-gray-600' },
                { icon: Settings, label: 'Cài đặt', route: '/manager/settings', color: 'bg-gray-100 text-gray-600' },
            ],
        },
    ];

    return (
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
                        <span className="text-primary-100 text-xs mb-1">Xin chào,</span>
                        <span className="text-lg text-white font-bold leading-tight">
                            {userDoc?.name ?? 'Người dùng'}
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
                    <div className="flex gap-2">
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
                            className={cn(
                                'w-10 h-10 rounded-full flex items-center justify-center',
                                'bg-white/20 text-white active:scale-95 transition-transform',
                            )}
                        >
                            <Bell className="w-5 h-5" strokeWidth={1.75} />
                        </button>
                    </div>
                </div>

                {/* Store selector — admin gets all stores, office users get managed stores */}
                <MobileStoreSelector />

                {/* Spacer so wave doesn't clip content */}
                <div className="relative z-0 h-0" />
            </header>

            {/* ── Quick Access ─────────────────────────────────────────────── */}
            <section className="px-3 mt-12">
                <p className="text-sm font-bold text-gray-800 mb-2">Truy cập nhanh</p>
                <div className="flex items-center justify-between gap-1">
                    {quickAccessItems.map((item) => (
                        <QuickAccessItem
                            key={item.label}
                            icon={item.icon}
                            label={item.label}
                            colorClass={item.colorClass}
                            onClick={item.label === 'Tất cả' ? () => setShowAllSheet(true) : () => router.push(item.route)}
                        />
                    ))}
                </div>
            </section>

            {/* ── Role-based content ───────────────────────────────────────── */}
            {showPersonalSchedule ? (
                <PersonalScheduleView onNavigate={() => router.push('/schedule')} />
            ) : (
                <ManagementView />
            )}

            {/* ── All Navigation BottomSheet ──────────────────────────────── */}
            <BottomSheet
                isOpen={showAllSheet}
                onClose={() => setShowAllSheet(false)}
                title="Tất cả chức năng"
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
    );
}