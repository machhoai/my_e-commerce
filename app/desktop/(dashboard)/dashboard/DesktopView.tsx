'use client';

import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { db } from '@/lib/firebase';
import { collection, query, getDocs, where, getDoc, doc } from 'firebase/firestore';
import {
    ChevronRight, ChevronDown, ChevronLeft, AlertTriangle,
    Users, TrendingUp, Activity, DollarSign, Clock,
    Package, PackagePlus, ArrowLeftRight, Building2,
    Calendar, Loader2, BarChart3, Banknote, ArrowUpDown, Coins, XCircle, RefreshCw,
    Wifi, WifiOff, CalendarDays, CalendarRange, CheckCircle2, Star,
} from 'lucide-react';
import {
    AreaChart, Area, PieChart, Pie, Cell,
    XAxis, YAxis, CartesianGrid,
    Tooltip as RechartsTooltip, ResponsiveContainer,
} from 'recharts';
import { cn } from '@/lib/utils';
import { KpiRecordDoc, UserDoc, ScheduleDoc, StoreDoc } from '@/types';
import { subscribeDocument } from '@/lib/firestore';
import { JOYWORLD_CACHE_COLLECTION, getCacheDocId, type RevenueCache } from '@/lib/revenue-cache';
import {
    fetchRevenueFromCache, triggerSyncAction,
    type RevenueRecord, type SellCategory, type DailyPanel,
} from '@/app/desktop/(dashboard)/office/revenue/actions';
import TopReferralMarquee from '@/components/referral/TopReferralMarquee';
import { useStoreSettings } from '@/hooks/useStoreSettings';

type ManagementTab = 'operation' | 'revenue' | 'inventory';

/* ── Helpers ──────────────────────────────────────────────────────────── */
function toLocalISO(d: Date): string {
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
function getMondayOf(d: Date): Date {
    const day = d.getDay();
    const diff = day === 0 ? -6 : 1 - day;
    const mon = new Date(d);
    mon.setDate(d.getDate() + diff);
    mon.setHours(0, 0, 0, 0);
    return mon;
}
const DAY_LABELS = ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'];
const fmtV = (v: number) => v.toLocaleString('vi-VN');
const fmtVND = (v: number) => v.toLocaleString('vi-VN', { style: 'currency', currency: 'VND' });
function fmtShort(v: number) {
    if (v >= 1_000_000_000) return `${(v / 1_000_000_000).toFixed(1)} tỷ`;
    if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(1)}M`;
    if (v >= 1_000) return `${(v / 1_000).toFixed(0)}K`;
    return fmtV(v);
}
function todayStr() { const d = new Date(); return toLocalISO(d); }
function monthStart() { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`; }
const REV_PALETTE = ['#FFCD00', '#FF8200', '#00A9E0', '#97D700', '#E83668', '#8b5cf6'];

/* ── Brand-aligned StatCard ───────────────────────────────────────────── */
function StatCard({ title, value, sub, icon: Icon, accentColor, alert }: {
    title: string; value: string | number; sub?: string;
    icon: React.ElementType; accentColor: string; alert?: boolean;
}) {
    return (
        <div className={cn(
            'relative rounded-2xl bg-white overflow-hidden shadow-sm border transition-all duration-200 hover:shadow-md hover:-translate-y-0.5',
            alert ? 'border-amber-200' : 'border-gray-100/80'
        )}>
            {/* Left accent bar */}
            <div className="absolute left-0 top-0 bottom-0 w-1 rounded-l-2xl" style={{ background: accentColor }} />
            <div className="pl-5 pr-5 py-5 flex items-start gap-4">
                <span className="w-11 h-11 rounded-xl flex items-center justify-center shrink-0" style={{ background: `${accentColor}18` }}>
                    <Icon className="w-5 h-5" style={{ color: accentColor }} strokeWidth={2} />
                </span>
                <div className="flex-1 min-w-0">
                    <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-widest">{title}</p>
                    <p className="text-2xl font-bold text-gray-900 mt-1 tracking-tight leading-tight" style={{ fontFamily: 'Poppins, sans-serif' }}>{value}</p>
                    {sub && <p className={cn('text-xs mt-1.5', alert ? 'text-amber-500 font-semibold' : 'text-gray-400')}>{sub}</p>}
                </div>
                {alert && <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-1" strokeWidth={2} />}
            </div>
        </div>
    );
}

/* ── Store Selector ───────────────────────────────────────────────────── */
function DesktopStoreSelector() {
    const { user, userDoc, managedStoreIds, effectiveStoreId, setEffectiveStoreId } = useAuth();
    const [stores, setStores] = useState<{ id: string; name: string }[]>([]);
    const isAdmin = userDoc?.role === 'admin' || userDoc?.role === 'super_admin';
    useEffect(() => {
        if (!user) return;
        if (!isAdmin && managedStoreIds.length === 0) return;
        (async () => {
            try {
                const token = await user.getIdToken();
                const res = await fetch('/api/stores', { headers: { Authorization: `Bearer ${token}` } });
                if (!res.ok) return;
                const all: { id: string; name: string }[] = await res.json();
                setStores(isAdmin ? all : all.filter(s => managedStoreIds.includes(s.id)));
            } catch { }
        })();
    }, [user, isAdmin, managedStoreIds]);
    if (!isAdmin && managedStoreIds.length === 0) return null;
    if (stores.length === 0) return null;
    return (
        <div className="flex items-center gap-2.5 px-4 py-2.5 rounded-xl bg-white border border-gray-200 shadow-sm hover:border-gray-300 transition-colors">
            <Building2 className="w-4 h-4 text-gray-400 shrink-0" />
            <select value={effectiveStoreId} onChange={(e) => setEffectiveStoreId(e.target.value)}
                className="appearance-none bg-transparent text-sm font-semibold text-gray-700 cursor-pointer outline-none flex-1 pr-1" title="Chọn cửa hàng">
                <option value="">Tất cả cửa hàng</option>
                {stores.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
            <ChevronDown className="w-3.5 h-3.5 text-gray-400 pointer-events-none shrink-0" />
        </div>
    );
}

/* ── Section Panel Wrapper ────────────────────────────────────────────── */
function SectionPanel({ title, icon: Icon, iconColor = '#FFCD00', rightSlot, children }: {
    title: string; icon: React.ElementType; iconColor?: string; rightSlot?: React.ReactNode; children: React.ReactNode;
}) {
    return (
        <div className="rounded-2xl bg-white border border-gray-100 shadow-sm overflow-hidden">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 bg-gray-50/50">
                <h3 className="text-sm font-bold text-gray-800 flex items-center gap-2.5">
                    <span className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: `${iconColor}20` }}>
                        <Icon className="w-4 h-4" style={{ color: iconColor }} strokeWidth={2} />
                    </span>
                    {title}
                </h3>
                {rightSlot}
            </div>
            {children}
        </div>
    );
}

/* ── Week Nav Row ─────────────────────────────────────────────────────── */
function WeekNav({ offset, days, onPrev, onNext, badge }: {
    offset: number; days: Date[]; onPrev: () => void; onNext: () => void; badge?: React.ReactNode;
}) {
    return (
        <div className="flex items-center gap-1">
            <button onClick={onPrev} className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors text-gray-500 hover:text-gray-700">
                <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="text-sm font-semibold text-gray-600 min-w-[150px] text-center select-none">
                {days.length > 0
                    ? `${days[0].toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit' })} – ${days[6].toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit' })}`
                    : '…'}
            </span>
            {badge}
            <button onClick={onNext} className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors text-gray-500 hover:text-gray-700">
                <ChevronRight className="w-4 h-4" />
            </button>
        </div>
    );
}

/* ── Operation Section ────────────────────────────────────────────────── */
function OperationSection({ effectiveStoreId }: { effectiveStoreId: string }) {
    const [loading, setLoading] = useState(true);
    const [staffCount, setStaffCount] = useState<number | null>(null);
    const [kpiAvg, setKpiAvg] = useState<number | null>(null);
    const [weekSchedules, setWeekSchedules] = useState<ScheduleDoc[]>([]);
    const [weekDays, setWeekDays] = useState<Date[]>([]);
    const [weekOffset, setWeekOffset] = useState(0);
    const [shiftNames, setShiftNames] = useState<string[]>([]);
    const [userMap, setUserMap] = useState<Map<string, UserDoc>>(new Map());
    const [nextWeekCount, setNextWeekCount] = useState<number | null>(null);
    const [calendarWeekOffset, setCalendarWeekOffset] = useState(0);
    const [calendarWeekDays, setCalendarWeekDays] = useState<Date[]>([]);
    const [calendarWeekSchedules, setCalendarWeekSchedules] = useState<ScheduleDoc[]>([]);
    const [calendarLoading, setCalendarLoading] = useState(true);

    useEffect(() => {
        if (!effectiveStoreId) {
            setStaffCount(null); setKpiAvg(null); setWeekSchedules([]); setWeekDays([]);
            setShiftNames([]); setUserMap(new Map()); setNextWeekCount(null); setLoading(false);
            return;
        }
        let cancelled = false;
        (async () => {
            setLoading(true);
            try {
                const base = getMondayOf(new Date());
                base.setDate(base.getDate() + weekOffset * 7);
                const days: Date[] = Array.from({ length: 7 }, (_, i) => { const d = new Date(base); d.setDate(base.getDate() + i); return d; });
                const minDate = toLocalISO(days[0]);
                const maxDate = toLocalISO(days[6]);
                const now = new Date();
                const mStart = toLocalISO(new Date(now.getFullYear(), now.getMonth(), 1));
                const mEnd = toLocalISO(new Date(now.getFullYear(), now.getMonth() + 1, 0));
                const nextMon = getMondayOf(new Date()); nextMon.setDate(nextMon.getDate() + 7);
                const nextSun = new Date(nextMon); nextSun.setDate(nextMon.getDate() + 6);

                const [usersSnap, kpiSnap, schedSnap, storeSnap, nextWeekSnap] = await Promise.all([
                    getDocs(query(collection(db, 'users'), where('storeId', '==', effectiveStoreId))),
                    getDocs(query(collection(db, 'kpi_records'), where('storeId', '==', effectiveStoreId))),
                    getDocs(query(collection(db, 'schedules'), where('date', '>=', minDate), where('date', '<=', maxDate))),
                    getDoc(doc(db, 'stores', effectiveStoreId)),
                    getDocs(query(collection(db, 'schedules'), where('date', '>=', toLocalISO(nextMon)), where('date', '<=', toLocalISO(nextSun)))),
                ]);
                if (cancelled) return;
                const storeData = storeSnap.exists() ? storeSnap.data() as StoreDoc : null;
                setShiftNames(storeData?.settings?.shiftTimes ?? []);
                const uMap = new Map<string, UserDoc>();
                usersSnap.docs.map(d => d.data() as UserDoc).forEach(u => uMap.set(u.uid, u));
                setUserMap(uMap);
                const staff = Array.from(uMap.values()).filter(u => u.isActive && u.role !== 'admin' && u.role !== 'super_admin');
                setStaffCount(staff.length);
                const kpiDocs = kpiSnap.docs.map(d => d.data() as KpiRecordDoc).filter(r => r.status === 'OFFICIAL' && r.date >= mStart && r.date <= mEnd);
                setKpiAvg(kpiDocs.length > 0 ? Math.round(kpiDocs.reduce((s, r) => s + r.officialTotal, 0) / kpiDocs.length) : null);
                setWeekSchedules(schedSnap.docs.map(d => d.data() as ScheduleDoc).filter(s => s.storeId === effectiveStoreId));
                setWeekDays(days);
                const nwUids = new Set<string>();
                nextWeekSnap.docs.map(d => d.data() as ScheduleDoc).filter(s => s.storeId === effectiveStoreId).forEach(s => s.employeeIds?.forEach(uid => nwUids.add(uid)));
                setNextWeekCount(nwUids.size);
            } catch (e) { console.error('[OperationSection]', e); }
            finally { if (!cancelled) setLoading(false); }
        })();
        return () => { cancelled = true; };
    }, [effectiveStoreId, weekOffset]);

    useEffect(() => {
        if (!effectiveStoreId) { setCalendarWeekDays([]); setCalendarWeekSchedules([]); setCalendarLoading(false); return; }
        let cancelled = false;
        (async () => {
            setCalendarLoading(true);
            try {
                const base = getMondayOf(new Date()); base.setDate(base.getDate() + calendarWeekOffset * 7);
                const days: Date[] = Array.from({ length: 7 }, (_, i) => { const d = new Date(base); d.setDate(base.getDate() + i); return d; });
                const schedSnap = await getDocs(query(collection(db, 'schedules'), where('date', '>=', toLocalISO(days[0])), where('date', '<=', toLocalISO(days[6]))));
                if (cancelled) return;
                setCalendarWeekDays(days);
                setCalendarWeekSchedules(schedSnap.docs.map(d => d.data() as ScheduleDoc).filter(s => s.storeId === effectiveStoreId));
            } catch (e) { console.error('[Calendar]', e); }
            finally { if (!cancelled) setCalendarLoading(false); }
        })();
        return () => { cancelled = true; };
    }, [effectiveStoreId, calendarWeekOffset]);

    const today = toLocalISO(new Date());

    type EmpInfo = { uid: string; name: string; role: string; type?: string };
    const matrix: EmpInfo[][][] = shiftNames.map(shift =>
        weekDays.map(d => {
            const iso = toLocalISO(d);
            const matching = weekSchedules.filter(s => s.date === iso && s.shiftId === shift);
            const uids = new Set<string>();
            matching.forEach(s => s.employeeIds?.forEach(u => uids.add(u)));
            return Array.from(uids).map(uid => {
                const u = userMap.get(uid);
                return { uid, name: u?.name ?? uid, role: u?.role ?? 'employee', type: u?.type };
            });
        })
    );

    const shortName = (name: string) => { const p = name.trim().split(' '); return p.length >= 2 ? `${p[p.length - 2]} ${p[p.length - 1]}` : name; };

    const getBadgeStyle = (role: string, type?: string) => {
        if (role === 'store_manager') return 'bg-rose-50 text-rose-700 border border-rose-100';
        if (role === 'manager') return 'bg-amber-50 text-amber-700 border border-amber-100';
        if (type === 'FT') return 'bg-sky-50 text-sky-700 border border-sky-100';
        return 'bg-emerald-50 text-emerald-700 border border-emerald-100';
    };
    const getRoleLabel = (role: string) => {
        if (role === 'store_manager') return 'CTH';
        if (role === 'manager') return 'QL';
        return '';
    };

    const calendarDays = calendarWeekDays.map(d => {
        const iso = toLocalISO(d);
        const dayShifts = shiftNames.map(shift => {
            const matching = calendarWeekSchedules.filter(s => s.date === iso && s.shiftId === shift);
            const uids = new Set<string>();
            matching.forEach(s => s.employeeIds?.forEach(u => uids.add(u)));
            return {
                shift,
                employees: Array.from(uids).map(uid => {
                    const u = userMap.get(uid);
                    return { uid, name: u?.name ?? uid, role: u?.role ?? 'employee', type: u?.type };
                }),
            };
        });
        const total = new Set(dayShifts.flatMap(ds => ds.employees.map(e => e.uid))).size;
        return { iso, date: d, dayShifts, total };
    });

    return (
        <div className="flex flex-col gap-6">
            {/* Stats */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <StatCard title="Nhân sự hoạt động" value={loading ? '…' : staffCount ?? '-'} sub="Nhân viên đang làm việc" icon={Users} accentColor="#00A9E0" />
                <StatCard title="KPI trung bình / tháng" value={loading ? '…' : kpiAvg !== null ? kpiAvg : '-'} sub="Điểm trung bình tháng này" icon={TrendingUp} accentColor="#97D700" />
                <StatCard title="Đăng ký tuần sau" value={loading ? '…' : nextWeekCount ?? '-'} sub="Nhân viên đã đăng ký ca" icon={Calendar} accentColor="#FF8200" />
            </div>

            {/* Schedule Table */}
            <SectionPanel
                title="Lịch làm việc cửa hàng"
                icon={Calendar}
                iconColor="#FFCD00"
                rightSlot={
                    <WeekNav
                        offset={weekOffset}
                        days={weekDays}
                        onPrev={() => setWeekOffset(w => w - 1)}
                        onNext={() => setWeekOffset(w => w + 1)}
                        badge={weekOffset === 0 && (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold" style={{ background: '#FFCD0025', color: '#B8890A' }}>
                                Hiện tại
                            </span>
                        )}
                    />
                }
            >
                {!effectiveStoreId ? (
                    <div className="h-44 flex items-center justify-center"><p className="text-sm text-gray-400">Chọn cửa hàng để xem lịch</p></div>
                ) : loading ? (
                    <div className="h-44 flex items-center justify-center"><Loader2 className="w-6 h-6 animate-spin text-gray-300" /></div>
                ) : shiftNames.length === 0 ? (
                    <div className="h-44 flex items-center justify-center"><p className="text-sm text-gray-400">Chưa có dữ liệu ca</p></div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm border-collapse">
                            <thead>
                                <tr className="bg-gray-50">
                                    <th className="sticky left-0 z-10 bg-gray-50 px-4 py-3 text-left font-semibold text-gray-500 text-[11px] uppercase tracking-widest w-[100px] border-r border-gray-100">Ca</th>
                                    {weekDays.map(d => {
                                        const iso = toLocalISO(d);
                                        const isToday = iso === today;
                                        return (
                                            <th key={iso} className="px-2 py-3 font-semibold text-center min-w-[140px]"
                                                style={isToday ? { background: '#FFCD0015', color: '#B8890A' } : { color: '#6b7280' }}>
                                                <div className="text-[10px] font-bold uppercase tracking-widest">{DAY_LABELS[d.getDay()]}</div>
                                                <div className={cn('text-base font-bold leading-tight mt-0.5', isToday ? '' : 'text-gray-700')}>{d.getDate()}</div>
                                            </th>
                                        );
                                    })}
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-50">
                                {shiftNames.map((shift, si) => (
                                    <tr key={shift} className={si % 2 === 0 ? 'bg-white' : 'bg-gray-50/40'}>
                                        <td className="sticky left-0 z-10 px-4 py-3 text-xs font-bold text-gray-700 border-r border-gray-100 align-top" style={{ background: 'inherit' }}>{shift}</td>
                                        {weekDays.map((d, di) => {
                                            const iso = toLocalISO(d);
                                            const isToday = iso === today;
                                            const emps = matrix[si]?.[di] ?? [];
                                            return (
                                                <td key={iso} className="px-2 py-3 align-top" style={isToday ? { background: '#FFCD0008' } : {}}>
                                                    {emps.length === 0 ? (
                                                        <span className="text-gray-200 text-sm block text-center">—</span>
                                                    ) : (
                                                        <div className="flex flex-col gap-1">
                                                            {emps.map(emp => (
                                                                <span key={emp.uid} className={cn('inline-flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-medium', getBadgeStyle(emp.role, emp.type))}>
                                                                    {getRoleLabel(emp.role) && <span className="font-bold text-[10px] opacity-60">{getRoleLabel(emp.role)}</span>}
                                                                    <span className="truncate max-w-[100px]">{shortName(emp.name)}</span>
                                                                </span>
                                                            ))}
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
                {!loading && shiftNames.length > 0 && (
                    <div className="flex items-center gap-5 px-6 py-3 border-t border-gray-100 bg-gray-50/30">
                        {[
                            { dot: 'bg-rose-400', label: 'CTH = Cửa hàng trưởng' },
                            { dot: 'bg-amber-400', label: 'QL = Quản lý' },
                            { dot: 'bg-sky-400', label: 'FT = Full-time' },
                            { dot: 'bg-emerald-400', label: 'PT = Part-time' },
                        ].map(({ dot, label }) => (
                            <span key={label} className="flex items-center gap-1.5 text-xs text-gray-400">
                                <span className={cn('w-2.5 h-2.5 rounded-full', dot)} />
                                {label}
                            </span>
                        ))}
                    </div>
                )}
            </SectionPanel>

            {/* Registration Calendar */}
            <SectionPanel
                title="Lịch đăng ký ca nhân viên"
                icon={CalendarDays}
                iconColor="#8b5cf6"
                rightSlot={
                    <WeekNav
                        offset={calendarWeekOffset}
                        days={calendarWeekDays}
                        onPrev={() => setCalendarWeekOffset(w => w - 1)}
                        onNext={() => setCalendarWeekOffset(w => w + 1)}
                        badge={
                            calendarWeekOffset === 0
                                ? <span className="px-2 py-0.5 rounded-full text-[10px] font-bold" style={{ background: '#FFCD0025', color: '#B8890A' }}>Hiện tại</span>
                                : calendarWeekOffset === 1
                                    ? <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-violet-50 text-violet-600">Tuần sau</span>
                                    : null
                        }
                    />
                }
            >
                {!effectiveStoreId ? (
                    <div className="h-44 flex items-center justify-center"><p className="text-sm text-gray-400">Chọn cửa hàng để xem lịch đăng ký</p></div>
                ) : calendarLoading ? (
                    <div className="h-44 flex items-center justify-center"><Loader2 className="w-6 h-6 animate-spin text-gray-300" /></div>
                ) : shiftNames.length === 0 ? (
                    <div className="h-44 flex items-center justify-center"><p className="text-sm text-gray-400">Chưa cấu hình ca</p></div>
                ) : (
                    <div className="grid grid-cols-7 divide-x divide-gray-100">
                        {calendarDays.map(({ iso, date, dayShifts, total }) => {
                            const isToday = iso === today;
                            const isPast = iso < today;
                            return (
                                <div key={iso} className={cn('min-h-[200px] flex flex-col', isPast && 'opacity-55')}>
                                    {/* Day header */}
                                    <div className={cn('px-3 py-2.5 border-b flex items-center justify-between', isToday ? 'border-amber-200' : 'bg-gray-50 border-gray-100')}
                                        style={isToday ? { background: 'linear-gradient(135deg, #FFCD00 0%, #FF8200 100%)' } : {}}>
                                        <div>
                                            <p className={cn('text-[10px] font-bold uppercase tracking-widest', isToday ? 'text-amber-900/70' : 'text-gray-400')}>{DAY_LABELS[date.getDay()]}</p>
                                            <p className={cn('text-lg font-extrabold leading-tight', isToday ? 'text-gray-900' : 'text-gray-700')}>{date.getDate()}</p>
                                        </div>
                                        <span className={cn('flex items-center justify-center w-7 h-7 rounded-full text-xs font-bold',
                                            total > 0
                                                ? isToday ? 'bg-white/40 text-gray-900' : 'bg-sky-50 text-sky-600'
                                                : isToday ? 'bg-black/10 text-amber-800/60' : 'bg-gray-100 text-gray-300'
                                        )}>
                                            {total > 0 ? total : '—'}
                                        </span>
                                    </div>
                                    {/* Per-shift employee list */}
                                    <div className="flex-1 flex flex-col p-2 gap-2">
                                        {dayShifts.map(({ shift, employees }) => (
                                            <div key={shift}>
                                                <p className={cn('text-[10px] font-bold uppercase tracking-wider mb-1', employees.length > 0 ? 'text-gray-500' : 'text-gray-300')}>{shift}</p>
                                                {employees.length === 0 ? (
                                                    <p className="text-[10px] text-gray-300 italic">Chưa có</p>
                                                ) : (
                                                    <div className="flex flex-col gap-0.5">
                                                        {employees.map(emp => (
                                                            <span key={emp.uid} className={cn('inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[11px] font-medium w-fit', getBadgeStyle(emp.role, emp.type))}>
                                                                {getRoleLabel(emp.role) && <span className="font-bold text-[9px] opacity-60">{getRoleLabel(emp.role)}</span>}
                                                                {shortName(emp.name)}
                                                            </span>
                                                        ))}
                                                    </div>
                                                )}
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </SectionPanel>
        </div>
    );
}


/* ── Revenue Section ──────────────────────────────────────────────────── */
type RevFilterMode = 'day' | 'month' | 'custom';

function RevenueSection() {
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
            if (!result.success) { setError(result.error || 'Lỗi'); setData([]); setSellData([]); setDailyPanel(null); }
            else { setData(result.data); setSellData(result.sellData); setDailyPanel(result.dailyPanel ?? null); setUpdatedAt(result.updatedAt); }
        } catch { setError('Không thể kết nối.'); }
        finally { setLoading(false); setHasFetched(true); }
    }, [getRange]);

    useEffect(() => {
        if (unsubRef.current) { unsubRef.current(); unsubRef.current = null; }
        const { start, end } = getRange();
        fetchInitial();
        const unsub = subscribeDocument<RevenueCache>(JOYWORLD_CACHE_COLLECTION, getCacheDocId(start, end), (cached) => {
            if (cached?.revenue) { setData(cached.revenue); setSellData(cached.sellData || []); setDailyPanel(cached.dailyPanel ?? null); setUpdatedAt(cached.updatedAt || null); setError(null); setHasFetched(true); setLoading(false); }
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
            else setError(result.error || 'Thất bại.');
        } catch { setError('Thất bại.'); }
        finally { setSyncing(false); }
    }, [getRange]);

    const kpis = useMemo(() => {
        let totalReal = data.reduce((s, d) => s + d.realMoney, 0);
        let totalCash = data.reduce((s, d) => s + d.cashRealMoney, 0);
        let totalTransfer = data.reduce((s, d) => s + d.transferRealMoney, 0);
        let totalSys = data.reduce((s, d) => s + d.sysMoney, 0);
        const totalCoins = data.reduce((s, d) => s + d.sellCoinAmount, 0);
        const totalRefund = dailyPanel?.shopSummary?.refundMoney ?? data.reduce((s, d) => s + d.cashErrorMoney, 0);
        const peakDay = data.length > 0 ? data.reduce((max, d) => d.realMoney > max.realMoney ? d : max, data[0]) : null;
        if (dailyPanel?.shopSummary) totalReal = dailyPanel.shopSummary.shopRealMoney;
        if (dailyPanel?.paymentStats?.length) {
            const pmCash = dailyPanel.paymentStats.find(p => p.paymentCategoryName.toLowerCase().includes('tiền mặt'));
            const pmTrans = dailyPanel.paymentStats.find(p => p.paymentCategoryName.toLowerCase().includes('chuyển khoản'));
            if (pmCash) totalCash = pmCash.totalRealMoney;
            if (pmTrans) totalTransfer = pmTrans.totalRealMoney;
        }
        return { totalReal, totalSys, totalCash, totalTransfer, totalCoins, totalRefund, peakDay };
    }, [data, dailyPanel]);

    const isMultiDay = data.length > 1;
    const chartData = useMemo(() => [...data].sort((a, b) => a.forDate.localeCompare(b.forDate)).map(d => ({ date: d.forDate.slice(5), 'Thực thu': d.sysMoney, 'Tiền mặt': d.cashRealMoney, 'Chuyển khoản': d.transferRealMoney })), [data]);
    const paymentPieData = useMemo(() => {
        if (dailyPanel?.paymentStats?.length) return dailyPanel.paymentStats.map(p => ({ name: p.paymentCategoryName, value: p.totalRealMoney })).filter(d => d.value > 0);
        return [{ name: 'Tiền mặt', value: kpis.totalCash }, { name: 'Chuyển khoản', value: kpis.totalTransfer }].filter(d => d.value > 0);
    }, [data, dailyPanel, kpis]);
    const topProducts = useMemo(() => {
        if (dailyPanel?.goodsTypeStats?.length) return dailyPanel.goodsTypeStats.flatMap(g => g.goodsItems).filter(i => i.realMoney > 0).sort((a, b) => b.realMoney - a.realMoney).slice(0, 10);
        return sellData.flatMap(c => c.items).sort((a, b) => b.realMoney - a.realMoney).slice(0, 10);
    }, [sellData, dailyPanel]);

    const filterLabels = ['Ngày', 'Tháng', 'Tùy chọn'];
    const filterIcons = [Calendar, CalendarDays, CalendarRange];
    const filterModes: RevFilterMode[] = ['day', 'month', 'custom'];

    return (
        <div className="flex flex-col gap-6">
            {/* Filter Bar */}
            <div className="rounded-2xl bg-white border border-gray-100 shadow-sm p-4">
                <div className="flex items-center gap-4 flex-wrap">
                    {/* Mode selector */}
                    <div className="flex gap-1 bg-gray-100/80 rounded-xl p-1">
                        {filterModes.map((m, i) => {
                            const Ic = filterIcons[i];
                            return (
                                <button key={m} onClick={() => setFilterMode(m)}
                                    className={cn('flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-semibold transition-all duration-200',
                                        filterMode === m ? 'bg-white text-gray-800 shadow-sm' : 'text-gray-500 hover:text-gray-700')}>
                                    <Ic className="w-3.5 h-3.5" />{filterLabels[i]}
                                </button>
                            );
                        })}
                    </div>
                    <div className="flex items-center gap-3 flex-1">
                        {filterMode === 'day' && <input type="date" value={dayDate} onChange={e => setDayDate(e.target.value)} className="rounded-xl bg-gray-50 px-4 py-2 text-sm text-gray-700 border border-gray-200 outline-none focus:ring-2 focus:ring-amber-200 focus:border-amber-300" />}
                        {filterMode === 'month' && <input type="month" value={monthDate} onChange={e => setMonthDate(e.target.value)} className="rounded-xl bg-gray-50 px-4 py-2 text-sm text-gray-700 border border-gray-200 outline-none focus:ring-2 focus:ring-amber-200 focus:border-amber-300" />}
                        {filterMode === 'custom' && (<>
                            <input type="date" value={customStart} onChange={e => setCustomStart(e.target.value)} className="rounded-xl bg-gray-50 px-3 py-2 text-sm border border-gray-200 outline-none focus:ring-2 focus:ring-amber-200 focus:border-amber-300" />
                            <span className="text-gray-300 font-semibold">→</span>
                            <input type="date" value={customEnd} onChange={e => setCustomEnd(e.target.value)} className="rounded-xl bg-gray-50 px-3 py-2 text-sm border border-gray-200 outline-none focus:ring-2 focus:ring-amber-200 focus:border-amber-300" />
                        </>)}
                        <button onClick={handleSync} disabled={syncing || loading}
                            className="p-2.5 rounded-xl transition-colors disabled:opacity-40"
                            style={{ background: syncing || loading ? '#F3F4F6' : '#FFCD0020' }}>
                            <RefreshCw className={cn('w-4 h-4', (syncing || loading) ? 'text-gray-400 animate-spin' : 'text-amber-700')} />
                        </button>
                    </div>
                    <div className="flex items-center gap-2">
                        {isListening
                            ? <span className="flex items-center gap-1.5 text-xs font-bold text-emerald-600 bg-emerald-50 px-3 py-1.5 rounded-full"><Wifi className="w-3 h-3" />Live</span>
                            : <WifiOff className="w-3.5 h-3.5 text-gray-300" />}
                        {updatedAt && <span className="text-xs text-gray-400">Cập nhật: {new Date(updatedAt).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}</span>}
                    </div>
                </div>
            </div>

            {error && (
                <div className="rounded-2xl border border-red-200 bg-red-50 p-4 flex items-center gap-3">
                    <AlertTriangle className="w-5 h-5 text-red-500 shrink-0" />
                    <p className="text-sm text-red-700 flex-1">{error}</p>
                </div>
            )}
            {loading && !hasFetched && (
                <div className="rounded-2xl bg-white border shadow-sm h-48 flex items-center justify-center">
                    <Loader2 className="w-8 h-8 animate-spin text-gray-200" />
                </div>
            )}

            {hasFetched && !error && data.length > 0 && (
                <div className={cn('flex flex-col gap-6 transition-opacity duration-300', (loading || syncing) && 'opacity-50 pointer-events-none')}>
                    {/* Hero revenue card + mini KPIs */}
                    <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
                        {/* Hero card */}
                        <div className="lg:col-span-2 relative rounded-2xl overflow-hidden shadow-lg" style={{ background: 'linear-gradient(135deg, #FFCD00 0%, #FF8200 100%)' }}>
                            <div className="absolute inset-0 opacity-[0.06]" style={{ backgroundImage: 'radial-gradient(circle at 75% 15%, white 1.5px, transparent 1.5px)', backgroundSize: '20px 20px' }} />
                            <div className="relative p-6">
                                <p className="text-[11px] font-black uppercase tracking-[0.2em] text-amber-900/60">Thực thu</p>
                                <p className="text-5xl font-black text-gray-900 mt-2 tracking-tight leading-none" style={{ fontFamily: 'Poppins, sans-serif' }}>{fmtShort(kpis.totalSys)}</p>
                                <p className="text-sm text-amber-900/60 mt-3 font-medium">{fmtVND(kpis.totalSys)}</p>
                            </div>
                        </div>
                        {/* Mini KPI grid */}
                        <div className="lg:col-span-3 grid grid-cols-2 gap-4">
                            {[
                                { l: 'Tiền mặt', v: fmtShort(kpis.totalCash), s: `${kpis.totalSys > 0 ? ((kpis.totalCash / kpis.totalSys) * 100).toFixed(0) : 0}%`, ic: Banknote, accent: '#00A9E0' },
                                { l: 'Chuyển khoản', v: fmtShort(kpis.totalTransfer), s: `${kpis.totalSys > 0 ? ((kpis.totalTransfer / kpis.totalReal) * 100).toFixed(0) : 0}%`, ic: ArrowUpDown, accent: '#8b5cf6' },
                                { l: 'Xu bán', v: fmtV(kpis.totalCoins), s: `${fmtShort(data[0]?.sellCoinPrice || 0)}/xu`, ic: Coins, accent: '#FFCD00' },
                                isMultiDay
                                    ? { l: 'Ngày cao nhất', v: kpis.peakDay ? fmtShort(kpis.peakDay.realMoney) : '—', s: kpis.peakDay?.forDate || '', ic: TrendingUp, accent: '#E83668' }
                                    : { l: 'Đã hủy', v: fmtShort(kpis.totalRefund), s: kpis.totalRefund > 0 ? 'Giao dịch hủy' : 'Không có', ic: XCircle, accent: '#fc4c02' },
                            ].map(({ l, v, s, ic: Ic, accent }) => (
                                <div key={l} className="relative rounded-2xl bg-white border border-gray-100 shadow-sm p-4 flex items-start gap-3 overflow-hidden hover:shadow-md transition-shadow">
                                    <div className="absolute bottom-0 right-0 w-16 h-16 rounded-tl-[40px] opacity-[0.06]" style={{ background: accent }} />
                                    <span className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0" style={{ background: `${accent}18` }}>
                                        <Ic className="w-5 h-5" style={{ color: accent }} strokeWidth={1.75} />
                                    </span>
                                    <div>
                                        <p className="text-[10px] uppercase tracking-widest text-gray-400 font-semibold">{l}</p>
                                        <p className="text-lg font-bold mt-0.5 leading-tight" style={{ color: accent, fontFamily: 'Poppins, sans-serif' }}>{v}</p>
                                        <p className="text-[11px] text-gray-400 mt-0.5">{s}</p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Chart + Pie */}
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                        <div className="lg:col-span-2 rounded-2xl bg-white border border-gray-100 shadow-sm p-5">
                            {isMultiDay ? (
                                <>
                                    <p className="text-sm font-bold text-gray-700 mb-4">Doanh thu theo ngày</p>
                                    <div className="h-[240px]">
                                        <ResponsiveContainer width="100%" height="100%">
                                            <AreaChart data={chartData} margin={{ top: 5, right: 15, left: 0, bottom: 0 }}>
                                                <defs>
                                                    <linearGradient id="gRevenue" x1="0" y1="0" x2="0" y2="1">
                                                        <stop offset="0%" stopColor="#FFCD00" stopOpacity={0.3} />
                                                        <stop offset="100%" stopColor="#FFCD00" stopOpacity={0.02} />
                                                    </linearGradient>
                                                </defs>
                                                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                                                <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#94a3b8' }} />
                                                <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#94a3b8' }} tickFormatter={fmtShort} width={50} />
                                                <RechartsTooltip contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 8px 24px rgb(0 0 0 / 0.1)', fontSize: '12px' }} />
                                                <Area type="monotone" dataKey="Thực thu" stroke="#FF8200" strokeWidth={2.5} fill="url(#gRevenue)" dot={false} activeDot={{ r: 5, fill: '#FF8200' }} />
                                                <Area type="monotone" dataKey="Tiền mặt" stroke="#00A9E0" strokeWidth={1.5} fill="transparent" dot={false} />
                                                <Area type="monotone" dataKey="Chuyển khoản" stroke="#8b5cf6" strokeWidth={1.5} fill="transparent" dot={false} />
                                            </AreaChart>
                                        </ResponsiveContainer>
                                    </div>
                                </>
                            ) : dailyPanel?.shopSummary ? (
                                <>
                                    <p className="text-sm font-bold text-gray-700 mb-4">Tổng kết ngày</p>
                                    <div className="grid grid-cols-3 gap-3">
                                        {[
                                            { l: 'Tổng hoá đơn', v: fmtVND(dailyPanel.shopSummary.shopMoney), accent: '#6b7280', bg: '#f3f4f6' },
                                            { l: 'Thực thu', v: fmtVND(dailyPanel.shopSummary.shopRealMoney), accent: '#16a34a', bg: '#f0fdf4' },
                                            { l: 'Đã hủy', v: fmtVND(dailyPanel.shopSummary.refundMoney), accent: '#dc2626', bg: '#fef2f2' },
                                            { l: 'Tiền mặt', v: fmtVND(kpis.totalCash), accent: '#00A9E0', bg: '#e0f7ff' },
                                            { l: 'Chuyển khoản', v: fmtVND(kpis.totalTransfer), accent: '#8b5cf6', bg: '#f5f3ff' },
                                            { l: 'Xu bán', v: fmtV(kpis.totalCoins), accent: '#B8890A', bg: '#FFCD0015' },
                                        ].map(item => (
                                            <div key={item.l} className="rounded-xl p-4" style={{ background: item.bg }}>
                                                <p className="text-[10px] uppercase tracking-widest text-gray-400 font-semibold">{item.l}</p>
                                                <p className="text-sm font-bold mt-1" style={{ color: item.accent }}>{item.v}</p>
                                            </div>
                                        ))}
                                    </div>
                                </>
                            ) : (
                                <div className="h-[240px] flex items-center justify-center text-sm text-gray-400">Không có dữ liệu</div>
                            )}
                        </div>

                        {/* Payment Pie */}
                        <div className="rounded-2xl bg-white border border-gray-100 shadow-sm p-5">
                            <p className="text-sm font-bold text-gray-700 mb-4">Phương thức thanh toán</p>
                            {paymentPieData.length > 0 ? (
                                <div className="flex flex-col items-center gap-4">
                                    <div className="h-[160px] w-[160px]">
                                        <ResponsiveContainer width="100%" height="100%">
                                            <PieChart>
                                                <Pie data={paymentPieData} cx="50%" cy="50%" innerRadius={42} outerRadius={72} paddingAngle={3} dataKey="value" labelLine={false}>
                                                    {paymentPieData.map((_, i) => <Cell key={i} fill={REV_PALETTE[i % REV_PALETTE.length]} />)}
                                                </Pie>
                                                <RechartsTooltip contentStyle={{ borderRadius: '10px', border: 'none', boxShadow: '0 4px 16px rgb(0 0 0 / 0.1)', fontSize: '12px' }} />
                                            </PieChart>
                                        </ResponsiveContainer>
                                    </div>
                                    <div className="flex flex-col gap-2.5 w-full">
                                        {paymentPieData.map((item, i) => {
                                            const t = paymentPieData.reduce((s, d) => s + d.value, 0);
                                            return (
                                                <div key={item.name} className="flex items-center justify-between px-1">
                                                    <div className="flex items-center gap-2">
                                                        <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: REV_PALETTE[i % REV_PALETTE.length] }} />
                                                        <span className="text-xs text-gray-600 font-medium">{item.name}</span>
                                                    </div>
                                                    <span className="text-xs font-bold text-gray-800">{fmtShort(item.value)} <span className="text-gray-400 font-normal">{t > 0 ? ((item.value / t) * 100).toFixed(0) : 0}%</span></span>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            ) : <div className="h-[200px] flex items-center justify-center text-sm text-gray-400">Không có dữ liệu</div>}
                        </div>
                    </div>

                    {/* Top Products */}
                    {topProducts.length > 0 && (
                        <div className="rounded-2xl bg-white border border-gray-100 shadow-sm overflow-hidden">
                            <div className="px-6 py-4 border-b border-gray-100 bg-gray-50/50 flex items-center gap-2.5">
                                <span className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: '#FFCD0020' }}>
                                    <Star className="w-4 h-4" style={{ color: '#B8890A' }} strokeWidth={2} />
                                </span>
                                <p className="text-sm font-bold text-gray-700">Top sản phẩm bán chạy</p>
                            </div>
                            <table className="w-full text-sm">
                                <thead>
                                    <tr className="bg-gray-50 text-[11px] text-gray-500 uppercase tracking-widest">
                                        <th className="px-6 py-3 text-left w-10">#</th>
                                        <th className="px-6 py-3 text-left">Sản phẩm</th>
                                        <th className="px-6 py-3 text-right">SL</th>
                                        <th className="px-6 py-3 text-right">Doanh thu</th>
                                        <th className="px-6 py-3 text-left w-[200px]">Tỉ lệ</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-50">
                                    {topProducts.map((item, i) => {
                                        const maxV = topProducts[0]?.realMoney || 1;
                                        const pct = (item.realMoney / maxV) * 100;
                                        return (
                                            <tr key={item.goodsName} className="hover:bg-gray-50/50 transition-colors">
                                                <td className="px-6 py-3">
                                                    <span className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold"
                                                        style={i === 0 ? { background: '#FFCD00', color: '#78600A' } : i === 1 ? { background: '#FF820020', color: '#FF8200' } : { background: '#f3f4f6', color: '#6b7280' }}>
                                                        {i + 1}
                                                    </span>
                                                </td>
                                                <td className="px-6 py-3 font-semibold text-gray-800">{item.goodsName}</td>
                                                <td className="px-6 py-3 text-right text-gray-500 font-medium">{item.realQty}</td>
                                                <td className="px-6 py-3 text-right font-bold text-gray-800">{fmtShort(item.realMoney)}</td>
                                                <td className="px-6 py-3">
                                                    <div className="h-1.5 rounded-full bg-gray-100 overflow-hidden">
                                                        <div className="h-full rounded-full transition-all duration-500" style={{ width: `${pct}%`, background: 'linear-gradient(90deg, #FFCD00, #FF8200)' }} />
                                                    </div>
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            )}

            {hasFetched && !error && data.length === 0 && !loading && (
                <div className="rounded-2xl bg-white border shadow-sm flex flex-col items-center justify-center gap-4 py-16">
                    <div className="w-14 h-14 rounded-2xl flex items-center justify-center" style={{ background: '#FFCD0018' }}>
                        <BarChart3 className="w-7 h-7" style={{ color: '#B8890A' }} />
                    </div>
                    <p className="text-base font-semibold text-gray-600">Không có dữ liệu</p>
                    <button onClick={handleSync} disabled={syncing}
                        className="flex items-center gap-2 px-6 py-2.5 rounded-xl text-white text-sm font-bold disabled:opacity-50 transition-opacity"
                        style={{ background: 'linear-gradient(135deg, #FFCD00, #FF8200)', color: '#5c3d00' }}>
                        <RefreshCw className={cn('w-4 h-4', syncing && 'animate-spin')} />
                        {syncing ? 'Đang tải...' : 'Đồng bộ ngay'}
                    </button>
                </div>
            )}
        </div>
    );
}

/* ── Inventory Section ────────────────────────────────────────────────── */
function InventorySection() {
    return (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <StatCard title="Tổng SKU theo dõi" value="1,204" sub="Đang theo dõi trong kho" icon={Package} accentColor="#00A9E0" />
            <StatCard title="Dưới tồn tối thiểu" value="18 SKU" sub="Cần bổ sung sớm" icon={PackagePlus} accentColor="#fc4c02" alert />
            <StatCard title="Chờ xác nhận" value="3" sub="Chờ xác nhận từ kho tổng" icon={ArrowLeftRight} accentColor="#FF8200" />
        </div>
    );
}

/* ── Personal Schedule Section ────────────────────────────────────────── */
function PersonalScheduleSection() {
    const { user, userDoc, effectiveStoreId: contextStoreId } = useAuth();
    const storeId = contextStoreId || userDoc?.storeId || '';
    const [todayShifts, setTodayShifts] = useState<{ shiftId: string; counterId: string }[]>([]);
    const [nextShift, setNextShift] = useState<{ date: string; shiftId: string } | null>(null);
    const [loading, setLoading] = useState(true);
    const router = useRouter();

    useEffect(() => {
        if (!user || !storeId) { setLoading(false); return; }
        let cancelled = false;
        (async () => {
            setLoading(true);
            try {
                const today = toLocalISO(new Date());
                const nextWeek = new Date(); nextWeek.setDate(nextWeek.getDate() + 7);
                const schedSnap = await getDocs(query(
                    collection(db, 'schedules'),
                    where('date', '>=', today),
                    where('date', '<=', toLocalISO(nextWeek)),
                ));
                if (cancelled) return;
                const myScheds = schedSnap.docs
                    .map(d => d.data() as ScheduleDoc)
                    .filter(s => s.storeId === storeId && s.employeeIds?.includes(userDoc?.uid ?? ''));
                const today2 = toLocalISO(new Date());
                const todayS = myScheds.filter(s => s.date === today2).map(s => ({ shiftId: s.shiftId, counterId: s.counterId }));
                setTodayShifts(todayS);
                const future = myScheds.filter(s => s.date > today2).sort((a, b) => a.date.localeCompare(b.date) || a.shiftId.localeCompare(b.shiftId));
                setNextShift(future.length > 0 ? { date: future[0].date, shiftId: future[0].shiftId } : null);
            } catch (e) { console.error('[PersonalSchedule]', e); }
            finally { if (!cancelled) setLoading(false); }
        })();
        return () => { cancelled = true; };
    }, [user, userDoc]);

    const formatDate = (iso: string) => {
        const d = new Date(iso + 'T00:00:00');
        return d.toLocaleDateString('vi-VN', { weekday: 'long', day: '2-digit', month: '2-digit' });
    };

    return (
        <div className="mb-8">
            <h2 className="text-sm font-bold text-gray-500 uppercase tracking-widest mb-4 flex items-center gap-2">
                <Clock className="w-4 h-4" style={{ color: '#FF8200' }} />
                Lịch làm việc của tôi
            </h2>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {/* Today */}
                <button onClick={() => router.push('/employee/dashboard')}
                    className="text-left rounded-2xl bg-white border border-gray-100 shadow-sm overflow-hidden hover:shadow-md hover:-translate-y-0.5 transition-all duration-200">
                    <div className="h-1" style={{ background: 'linear-gradient(90deg, #FFCD00, #FF8200)' }} />
                    <div className="p-5 flex items-center gap-4">
                        <span className="w-12 h-12 rounded-xl flex items-center justify-center shrink-0" style={{ background: '#FFCD0018' }}>
                            <Clock className="w-6 h-6" style={{ color: '#B8890A' }} strokeWidth={1.75} />
                        </span>
                        <div className="flex-1 min-w-0">
                            <p className="text-[11px] font-bold text-gray-400 uppercase tracking-widest">Hôm nay</p>
                            {loading ? (
                                <p className="text-lg font-bold text-gray-200 mt-1">Đang tải...</p>
                            ) : todayShifts.length > 0 ? (
                                <>
                                    <p className="text-xl font-bold text-gray-900 mt-0.5 tracking-tight" style={{ fontFamily: 'Poppins, sans-serif' }}>
                                        {todayShifts.map(s => s.shiftId).join(', ')}
                                    </p>
                                    <p className="text-xs text-gray-400 mt-0.5">{todayShifts.length} ca · {todayShifts.map(s => s.counterId).filter(Boolean).join(', ')}</p>
                                </>
                            ) : (
                                <p className="text-base font-semibold text-gray-400 mt-1">Không có ca hôm nay</p>
                            )}
                        </div>
                        {todayShifts.length > 0 && (
                            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold shrink-0" style={{ background: '#97D70020', color: '#4a7c00' }}>
                                <CheckCircle2 className="w-3.5 h-3.5" />Có ca
                            </span>
                        )}
                        <ChevronRight className="w-5 h-5 text-gray-300 shrink-0" />
                    </div>
                </button>

                {/* Next shift */}
                <div className="rounded-2xl bg-white border border-gray-100 shadow-sm p-5 flex items-center gap-4">
                    <span className="w-12 h-12 rounded-xl flex items-center justify-center shrink-0" style={{ background: '#FF820018' }}>
                        <CalendarDays className="w-6 h-6" style={{ color: '#FF8200' }} strokeWidth={1.75} />
                    </span>
                    <div className="flex-1 min-w-0">
                        <p className="text-[11px] font-bold text-gray-400 uppercase tracking-widest">Ca tiếp theo</p>
                        {loading ? (
                            <p className="text-lg font-bold text-gray-200 mt-1">Đang tải...</p>
                        ) : nextShift ? (
                            <>
                                <p className="text-lg font-bold text-gray-900 mt-0.5" style={{ fontFamily: 'Poppins, sans-serif' }}>{nextShift.shiftId}</p>
                                <p className="text-xs text-gray-400 mt-0.5">{formatDate(nextShift.date)}</p>
                            </>
                        ) : (
                            <p className="text-sm font-medium text-gray-400 mt-1">Chưa có ca nào sắp tới</p>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}

/* ── Tab config ───────────────────────────────────────────────────────── */
const ALL_TABS: { key: ManagementTab; label: string; icon: React.ElementType; permKeys: string[] }[] = [
    { key: 'operation', label: 'Vận hành', icon: Activity, permKeys: ['page.scheduling.overview', 'page.scheduling.register', 'page.scheduling.builder'] },
    { key: 'revenue', label: 'Doanh thu', icon: DollarSign, permKeys: ['page.office.revenue'] },
    { key: 'inventory', label: 'Kho bãi', icon: Package, permKeys: ['page.manager.inventory', 'page.admin.inventory'] },
];

/* ── Main DesktopView ─────────────────────────────────────────────────── */
export default function DesktopView({ topReferralData }: { topReferralData?: { uid: string; name: string; points: number }[] }) {
    const { userDoc, effectiveStoreId, hasPermission } = useAuth();
    const { referralEnabled } = useStoreSettings();
    const isAdmin = userDoc?.role === 'admin' || userDoc?.role === 'super_admin';
    const isStoreEmployee = !!userDoc?.storeId;

    const visibleTabs = useMemo(() =>
        ALL_TABS.filter(tab => isAdmin || tab.permKeys.some(k => hasPermission(k))),
        [isAdmin, hasPermission]
    );

    const [activeTab, setActiveTab] = useState<ManagementTab | null>(null);

    useEffect(() => {
        if (visibleTabs.length > 0 && (!activeTab || !visibleTabs.find(t => t.key === activeTab))) {
            setActiveTab(visibleTabs[0].key);
        }
    }, [visibleTabs]); // eslint-disable-line react-hooks/exhaustive-deps

    /* Get greeting based on time */
    const greeting = useMemo(() => {
        const h = new Date().getHours();
        if (h < 12) return 'Chào buổi sáng';
        if (h < 18) return 'Chào buổi chiều';
        return 'Chào buổi tối';
    }, []);

    return (
        <div className="max-w-[1400px] mx-auto" style={{ fontFamily: 'Poppins, sans-serif' }}>
            {/* Dashboard Header */}
            <div className="flex items-start justify-between mb-8 gap-4">
                <div>
                    {/* Greeting line */}
                    <p className="text-sm font-semibold text-gray-400 mb-1">{greeting} 👋</p>
                    <h1 className="text-3xl font-black tracking-tight leading-none" style={{ fontFamily: 'Poppins, sans-serif' }}>
                        <span className="text-gray-900">{userDoc?.name?.split(' ').pop() ?? 'Người dùng'}</span>
                        <span className="inline-block ml-3 text-transparent bg-clip-text" style={{ backgroundImage: 'linear-gradient(135deg, #FFCD00, #FF8200)' }}>Dashboard</span>
                    </h1>
                    <p className="text-sm text-gray-400 mt-1.5 font-medium">Tổng quan hoạt động cửa hàng</p>
                </div>
                <DesktopStoreSelector />
            </div>

            {/* Top Referral Marquee — hidden when referral program is disabled */}
            {referralEnabled && <TopReferralMarquee className="mb-6" initialData={topReferralData} />}

            {/* Personal Schedule */}
            {isStoreEmployee && <PersonalScheduleSection />}

            {/* Management Tabs */}
            {visibleTabs.length > 0 && (
                <>
                    {/* Tab pills */}
                    <div className="flex items-center gap-1.5 mb-6 bg-gray-100/70 rounded-2xl p-1.5 w-fit">
                        {visibleTabs.map((tab) => {
                            const Ic = tab.icon;
                            const isActive = activeTab === tab.key;
                            return (
                                <button key={tab.key} onClick={() => setActiveTab(tab.key)}
                                    className={cn(
                                        'flex items-center gap-2 px-5 py-2.5 text-sm rounded-xl font-semibold transition-all duration-200',
                                        isActive ? 'text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
                                    )}
                                    style={isActive ? { background: 'linear-gradient(135deg, #FFCD00 0%, #FF8200 100%)' } : {}}>
                                    <Ic className="w-4 h-4" />
                                    {tab.label}
                                </button>
                            );
                        })}
                    </div>

                    <div>
                        {activeTab === 'operation' && <OperationSection effectiveStoreId={effectiveStoreId} />}
                        {activeTab === 'revenue' && <RevenueSection />}
                        {activeTab === 'inventory' && <InventorySection />}
                    </div>
                </>
            )}
        </div>
    );
}
