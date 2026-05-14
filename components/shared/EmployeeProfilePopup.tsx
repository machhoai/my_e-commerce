'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import { db } from '@/lib/firebase';
import { collection, query, where, getDocs, doc, getDoc } from 'firebase/firestore';
import { useAuth } from '@/contexts/AuthContext';
import { UserDoc, KpiRecordDoc, ScheduleDoc, SettingsDoc, StoreDoc, CounterDoc, DailyAttendance, ZkUserDoc } from '@/types';

import { cn, getWeekStart, toLocalDateString } from '@/lib/utils';
import Popup from '@/components/ui/Popup';
import {
    User, Award, CalendarDays, Phone, Mail, CreditCard, GraduationCap,
    Briefcase, Building2, ChevronLeft, ChevronRight, CheckCircle2, Clock,
    Loader2, Ban, TrendingUp, MapPin, UserCircle, Image as ImageIcon, X, Coins,
    TimerIcon, LogIn, LogOut, AlertCircle, FileText,
} from 'lucide-react';
import ReferralHistorySection from '@/components/referral/ReferralHistorySection';
import ContractSection from '@/components/shared/ContractSection';

interface EmployeeProfilePopupProps {
    employeeUid: string;
    storeId?: string;
    onClose: () => void;
    initialTab?: TabKey;
}

type TabKey = 'info' | 'kpi' | 'shifts' | 'points' | 'attendance';


// ── Helpers ───────────────────────────────────────────────────────────────────
function scoreColor(v: number) {
    return v >= 80 ? 'text-emerald-600' : v >= 50 ? 'text-amber-600' : 'text-red-600';
}
function barColor(v: number) {
    return v >= 80 ? 'bg-emerald-400' : v >= 50 ? 'bg-amber-400' : v > 0 ? 'bg-red-400' : 'bg-gray-200';
}
function formatDate(dateStr: string) {
    try { const [y, m, d] = dateStr.split('-'); return `${d}/${m}/${y}`; } catch { return dateStr; }
}
function formatMonthLabel(m: string) {
    const [y, mo] = m.split('-'); return `T${mo}/${y.slice(2)}`;
}
function initials(name: string) {
    const p = name.trim().split(' ').filter(Boolean);
    return p.length >= 2 ? (p[0][0] + p[p.length - 1][0]).toUpperCase() : name.substring(0, 2).toUpperCase();
}

import { calculateAttendanceStatus } from '@/lib/attendance-rules';
import type { User as FirebaseUser } from 'firebase/auth';

// ── Punch-status colour tokens ─────────────────────────────────────────────────
const IN_STATUS = {
    EARLY: { bg: 'bg-blue-100', text: 'text-blue-700', label: 'Vào sớm' },
    ON_TIME: { bg: 'bg-green-100', text: 'text-green-700', label: 'Đúng giờ' },
    LATE: { bg: 'bg-red-100', text: 'text-red-700', label: 'Vào trễ' },
    UNKNOWN: { bg: 'bg-gray-100', text: 'text-gray-500', label: '—' },
} as const;

const OUT_STATUS = {
    EARLY_OUT: { bg: 'bg-amber-100', text: 'text-amber-700', label: 'Về sớm' },
    ON_TIME_OUT: { bg: 'bg-green-100', text: 'text-green-700', label: 'Đúng giờ' },
    OVERTIME: { bg: 'bg-purple-100', text: 'text-purple-700', label: 'Tăng ca' },
    UNKNOWN: { bg: 'bg-gray-100', text: 'text-gray-500', label: '—' },
} as const;

function fmtTime(iso?: string | null) {
    if (!iso) return '—';
    return new Date(iso).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
}
function fmtHours(h: number | null) {
    if (h === null) return '—';
    const hrs = Math.floor(h);
    const mins = Math.round((h - hrs) * 60);
    return mins > 0 ? `${hrs}h${String(mins).padStart(2, '0')}m` : `${hrs}h`;
}

// ── AttendanceTabContent ───────────────────────────────────────────────────────
interface AttendanceTabContentProps {
    employeeUid: string;
    employee: UserDoc | null;
    storeId: string;
    user: FirebaseUser | null;
    month: string;
    onMonthChange: (m: string) => void;
}

function AttendanceTabContent({ employeeUid, storeId, user, month, onMonthChange }: AttendanceTabContentProps) {
    const [records, setRecords] = useState<DailyAttendance[]>([]);
    const [settings, setSettings] = useState<SettingsDoc | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const prevMonth = () => {
        const d = new Date(`${month}-01`); d.setMonth(d.getMonth() - 1);
        onMonthChange(d.toISOString().slice(0, 7));
    };
    const nextMonth = () => {
        const d = new Date(`${month}-01`); d.setMonth(d.getMonth() + 1);
        onMonthChange(d.toISOString().slice(0, 7));
    };

    useEffect(() => {
        if (!user) return;
        setLoading(true); setError(null);
        (async () => {
            try {
                const token = await user.getIdToken();
                const res = await fetch(`/api/hr/attendance?month=${month}`, {
                    headers: { Authorization: `Bearer ${token}` },
                });
                if (!res.ok) throw new Error('Lỗi tải dữ liệu');
                const all: DailyAttendance[] = await res.json();
                setRecords(all.filter(r => r.mapped_system_uid === employeeUid));
            } catch (e) {
                setError(e instanceof Error ? e.message : 'Lỗi');
            } finally {
                setLoading(false);
            }
        })();
    }, [month, employeeUid, user]);

    // Load global settings for attendance rules
    useEffect(() => {
        if (!storeId) return;
        (async () => {
            try {
                const snap = await getDoc(doc(db, 'settings', 'global'));
                if (snap.exists()) setSettings(snap.data() as SettingsDoc);
            } catch { /* silent */ }
        })();
    }, [storeId]);

    const rows = useMemo(() => records.sort((a, b) => a.date.localeCompare(b.date)), [records]);

    const totals = useMemo(() => {
        let hrs = 0;
        for (const r of rows) {
            if (r.checkIn) {
                const s = calculateAttendanceStatus(r.checkIn, r.checkOut, r.date, settings);
                if (s.workHours) hrs += s.workHours;
            }
        }
        return { days: rows.length, hours: hrs };
    }, [rows, settings]);

    return (
        <div className="space-y-3">
            {/* Month navigator */}
            <div className="flex items-center justify-between bg-gray-50 rounded-2xl p-3">
                <button onClick={prevMonth} className="w-8 h-8 rounded-xl bg-white border border-gray-200 flex items-center justify-center hover:bg-gray-100 transition-colors">
                    <ChevronLeft className="w-4 h-4 text-gray-500" />
                </button>
                <span className="text-sm font-bold text-gray-700">
                    {new Date(`${month}-01`).toLocaleDateString('vi-VN', { month: 'long', year: 'numeric' })}
                </span>
                <button onClick={nextMonth} className="w-8 h-8 rounded-xl bg-white border border-gray-200 flex items-center justify-center hover:bg-gray-100 transition-colors">
                    <ChevronRight className="w-4 h-4 text-gray-500" />
                </button>
            </div>

            {/* Totals */}
            <div className="grid grid-cols-2 gap-2">
                <div className="bg-primary-50 rounded-2xl p-3 text-center border border-primary-100">
                    <p className="text-2xl font-black text-primary-700">{totals.days}</p>
                    <p className="text-[10px] font-semibold text-primary-500 uppercase tracking-wide mt-0.5">Ngày có mặt</p>
                </div>
                <div className="bg-emerald-50 rounded-2xl p-3 text-center border border-emerald-100">
                    <p className="text-2xl font-black text-emerald-700">{fmtHours(totals.hours)}</p>
                    <p className="text-[10px] font-semibold text-emerald-500 uppercase tracking-wide mt-0.5">Tổng giờ làm</p>
                </div>
            </div>

            {/* Table */}
            {loading ? (
                <div className="flex items-center justify-center py-10">
                    <Loader2 className="w-6 h-6 animate-spin text-primary-500" />
                </div>
            ) : error ? (
                <div className="flex items-center gap-2 p-3 bg-red-50 rounded-2xl border border-red-100">
                    <AlertCircle className="w-4 h-4 text-red-500 shrink-0" />
                    <p className="text-xs text-red-700">{error}</p>
                </div>
            ) : rows.length === 0 ? (
                <div className="flex flex-col items-center gap-2 py-8 text-gray-400">
                    <TimerIcon className="w-8 h-8" />
                    <p className="text-sm">Không có dữ liệu chấm công</p>
                </div>
            ) : (
                <div className="space-y-2">
                    {rows.map(r => {
                        const s = r.checkIn ? calculateAttendanceStatus(r.checkIn, r.checkOut, r.date, settings) : null;
                        const inToken = s ? IN_STATUS[s.status] : IN_STATUS.UNKNOWN;
                        const outToken = s ? OUT_STATUS[s.checkOutStatus] : OUT_STATUS.UNKNOWN;
                        const [, mm, dd] = r.date.split('-');
                        return (
                            <div key={r.date} className="bg-gray-50 rounded-2xl border border-gray-100 overflow-hidden">
                                <div className="px-3 py-1.5 bg-gray-100 border-b border-gray-200 flex items-center gap-2">
                                    <span className="text-[11px] font-black text-gray-600">{dd}/{mm}</span>
                                    {s && (
                                        <span className={cn('ml-auto text-[10px] font-bold px-1.5 py-0.5 rounded-lg', inToken.bg, inToken.text)}>
                                            {inToken.label}
                                        </span>
                                    )}
                                </div>
                                <div className="grid grid-cols-3 divide-x divide-gray-100">
                                    <div className="flex flex-col items-center py-2 px-1">
                                        <LogIn className="w-3 h-3 text-gray-400 mb-0.5" />
                                        <span className="text-[12px] font-bold text-gray-800">{fmtTime(r.checkIn)}</span>
                                        <span className="text-[9px] text-gray-400">Vào</span>
                                    </div>
                                    <div className="flex flex-col items-center py-2 px-1">
                                        <LogOut className="w-3 h-3 text-gray-400 mb-0.5" />
                                        <span className={cn('text-[12px] font-bold', r.checkOut ? 'text-gray-800' : 'text-gray-300')}>
                                            {fmtTime(r.checkOut)}
                                        </span>
                                        {s && r.checkOut && (
                                            <span className={cn('text-[9px] font-bold', outToken.text)}>{outToken.label}</span>
                                        )}
                                        {!r.checkOut && <span className="text-[9px] text-gray-400">Ra</span>}
                                    </div>
                                    <div className="flex flex-col items-center py-2 px-1">
                                        <Clock className="w-3 h-3 text-gray-400 mb-0.5" />
                                        <span className="text-[12px] font-bold text-emerald-700">{s ? fmtHours(s.workHours) : '—'}</span>
                                        <span className="text-[9px] text-gray-400">Giờ làm</span>
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
}


export default function EmployeeProfilePopup({ employeeUid, storeId, onClose, initialTab }: EmployeeProfilePopupProps) {
    const { user, userDoc: currentUserDoc, hasPermission } = useAuth();
    const isAdmin = currentUserDoc?.role === 'admin' || currentUserDoc?.role === 'super_admin';
    const canViewAttendance = isAdmin || hasPermission('page.hr.attendance');

    const [activeTab, setActiveTab] = useState<TabKey>(initialTab ?? 'info');
    const [employee, setEmployee] = useState<UserDoc | null>(null);
    const [loadingUser, setLoadingUser] = useState(true);

    // KPI
    const [kpiMonth, setKpiMonth] = useState(() => {
        const n = new Date();
        return `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, '0')}`;
    });
    const [kpiRecords, setKpiRecords] = useState<KpiRecordDoc[]>([]);
    const [kpiMonthlyAvgs, setKpiMonthlyAvgs] = useState<{ month: string; avg: number; count: number }[]>([]);
    const [kpiYearlyAvgs, setKpiYearlyAvgs] = useState<{ month: string; avg: number; count: number }[]>([]);
    const [chartView, setChartView] = useState<'monthly' | 'yearly'>('monthly');
    const [loadingKpi, setLoadingKpi] = useState(false);
    const [loadingYearly, setLoadingYearly] = useState(false);

    // Shifts
    const [weekStart, setWeekStart] = useState<Date>(getWeekStart(new Date()));
    const [schedules, setSchedules] = useState<ScheduleDoc[]>([]);
    const [settings, setSettings] = useState<SettingsDoc | null>(null);
    const [counters, setCounters] = useState<CounterDoc[]>([]);
    const [loadingShifts, setLoadingShifts] = useState(false);
    const [monthlyShiftCount, setMonthlyShiftCount] = useState(0);
    const [expandedPhoto, setExpandedPhoto] = useState<string | null>(null);

    const getToken = useCallback(() => user?.getIdToken(), [user]);

    // Attendance tab state
    const [attendanceMonth, setAttendanceMonth] = useState(() => {
        const n = new Date();
        return `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, '0')}`;
    });

    // ── Fetch employee ────────────────────────────────────────────────────────
    useEffect(() => {
        setLoadingUser(true);
        getDoc(doc(db, 'users', employeeUid))
            .then(s => { if (s.exists()) setEmployee(s.data() as UserDoc); })
            .finally(() => setLoadingUser(false));
    }, [employeeUid]);

    // Refresh employee data (e.g. after contract update)
    const refreshEmployee = useCallback(() => {
        getDoc(doc(db, 'users', employeeUid))
            .then(s => { if (s.exists()) setEmployee(s.data() as UserDoc); });
    }, [employeeUid]);

    // Use storeId prop if provided, otherwise fall back to the employee's own storeId
    const effectiveStoreId = storeId || employee?.storeId || '';

    // ── Fetch KPI records ─────────────────────────────────────────────────────
    useEffect(() => {
        if (activeTab !== 'kpi' || !user || !effectiveStoreId) return;
        setLoadingKpi(true);
        (async () => {
            try {
                const token = await getToken();
                const res = await fetch(`/api/kpi-records?storeId=${effectiveStoreId}&month=${kpiMonth}&userId=${employeeUid}`, { headers: { Authorization: `Bearer ${token}` } });
                if (res.ok) { const d: KpiRecordDoc[] = await res.json(); setKpiRecords(Array.isArray(d) ? d.filter(r => r.userId === employeeUid) : []); }
            } catch { /* silent */ } finally { setLoadingKpi(false); }
        })();
    }, [activeTab, kpiMonth, employeeUid, effectiveStoreId, user, getToken]);

    // ── Fetch KPI 12-month averages (yearly chart) ────────────────────────────
    useEffect(() => {
        if (activeTab !== 'kpi' || !user || !effectiveStoreId) return;
        if (chartView !== 'yearly' || kpiYearlyAvgs.length > 0) return; // lazy-load
        setLoadingYearly(true);
        (async () => {
            try {
                const token = await getToken();
                const months: { month: string; avg: number; count: number }[] = [];
                const now = new Date();
                for (let i = 0; i < 12; i++) {
                    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
                    const m = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
                    const res = await fetch(`/api/kpi-records?storeId=${effectiveStoreId}&month=${m}&userId=${employeeUid}`, { headers: { Authorization: `Bearer ${token}` } });
                    if (res.ok) {
                        const data: KpiRecordDoc[] = await res.json();
                        const recs = data.filter(r => r.userId === employeeUid && r.status === 'OFFICIAL');
                        const avg = recs.length ? Math.round(recs.reduce((s, r) => s + r.officialTotal, 0) / recs.length) : 0;
                        months.push({ month: m, avg, count: recs.length });
                    }
                }
                setKpiYearlyAvgs(months);
            } catch { /* silent */ } finally { setLoadingYearly(false); }
        })();
    }, [activeTab, chartView, employeeUid, effectiveStoreId, user, getToken, kpiYearlyAvgs.length]);

    // ── Fetch KPI 6-month averages ────────────────────────────────────────────
    useEffect(() => {
        if (activeTab !== 'kpi' || !user || !storeId) return;
        (async () => {
            try {
                const token = await getToken();
                const months: { month: string; avg: number; count: number }[] = [];
                const now = new Date();
                for (let i = 0; i < 6; i++) {
                    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
                    const m = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
                    const res = await fetch(`/api/kpi-records?storeId=${storeId}&month=${m}&userId=${employeeUid}`, { headers: { Authorization: `Bearer ${token}` } });
                    if (res.ok) {
                        const data: KpiRecordDoc[] = await res.json();
                        const recs = data.filter(r => r.userId === employeeUid && r.status === 'OFFICIAL');
                        const avg = recs.length ? Math.round(recs.reduce((s, r) => s + r.officialTotal, 0) / recs.length) : 0;
                        months.push({ month: m, avg, count: recs.length });
                    }
                }
                setKpiMonthlyAvgs(months);
            } catch { /* silent */ }
        })();
    }, [activeTab, employeeUid, effectiveStoreId, user, getToken]);

    // ── Fetch shifts ──────────────────────────────────────────────────────────
    useEffect(() => {
        if (activeTab !== 'shifts' || !effectiveStoreId) return;
        setLoadingShifts(true);
        (async () => {
            try {
                // Store settings (shift names) + counters (embedded in store.settings)
                const storeSnap = await getDoc(doc(db, 'stores', effectiveStoreId));
                if (storeSnap.exists()) {
                    const sd = storeSnap.data() as StoreDoc;
                    const storeSettings = (sd.settings as SettingsDoc) || null;
                    setSettings(storeSettings);
                    // Counters are embedded in store.settings.counters (array), NOT a separate collection
                    setCounters((storeSettings as any)?.counters || []);
                }

                const days = Array.from({ length: 7 }, (_, i) => { const d = new Date(weekStart); d.setDate(weekStart.getDate() + i); return d; });
                const schedQ = query(
                    collection(db, 'schedules'),
                    where('date', '>=', toLocalDateString(days[0])),
                    where('date', '<=', toLocalDateString(days[6])),
                    where('storeId', '==', effectiveStoreId),
                );
                const snap = await getDocs(schedQ);
                setSchedules(snap.docs.map(d => d.data() as ScheduleDoc).filter(s => s.employeeIds?.includes(employeeUid)));

                const now = new Date();
                const monthQ = query(
                    collection(db, 'schedules'),
                    where('date', '>=', toLocalDateString(new Date(now.getFullYear(), now.getMonth(), 1))),
                    where('date', '<=', toLocalDateString(new Date(now.getFullYear(), now.getMonth() + 1, 0))),
                    where('storeId', '==', effectiveStoreId),
                );
                const mSnap = await getDocs(monthQ);
                const todayStr = toLocalDateString(new Date());
                const uniqueShifts = new Set<string>();
                mSnap.docs.forEach(d => { const s = d.data() as ScheduleDoc; if (s.date < todayStr && s.employeeIds?.includes(employeeUid)) uniqueShifts.add(`${s.date}_${s.shiftId}`); });
                setMonthlyShiftCount(uniqueShifts.size);
            } catch (err) { console.error('fetchShifts', err); } finally { setLoadingShifts(false); }
        })();
    }, [activeTab, weekStart, employeeUid, effectiveStoreId]);

    const weekDays = useMemo(() => {
        return Array.from({ length: 7 }, (_, i) => { const d = new Date(weekStart); d.setDate(weekStart.getDate() + i); return d; });
    }, [weekStart]);

    const shiftTimes: string[] = settings?.shiftTimes ?? ['Sáng', 'Chiều', 'Tối'];

    const infoItems = employee ? [
        { icon: <Phone className="w-4 h-4" />, label: 'Số điện thoại', value: employee.phone },
        { icon: <Mail className="w-4 h-4" />, label: 'Email', value: employee.email || '—' },
        { icon: <CalendarDays className="w-4 h-4" />, label: 'Ngày sinh', value: employee.dob ? formatDate(employee.dob) : '—' },
        { icon: <UserCircle className="w-4 h-4" />, label: 'Giới tính', value: employee.gender || '—' },
        { icon: <Briefcase className="w-4 h-4" />, label: 'Chức danh', value: employee.jobTitle || '—' },
        { icon: <CreditCard className="w-4 h-4" />, label: 'CCCD', value: employee.idCard || '—' },
        { icon: <MapPin className="w-4 h-4" />, label: 'Thường trú', value: employee.permanentAddress || '—' },
        { icon: <Building2 className="w-4 h-4" />, label: 'Tài khoản ngân hàng', value: employee.bankAccount || '—' },
        { icon: <GraduationCap className="w-4 h-4" />, label: 'Học vấn', value: employee.education || '—' },
    ] : [];

    const TABS: { key: TabKey; label: string; icon: React.ReactNode }[] = [
        { key: 'info', label: 'Cá nhân', icon: <User className="w-5 h-5" /> },
        { key: 'kpi', label: 'KPI', icon: <Award className="w-5 h-5" /> },
        { key: 'shifts', label: 'Lịch ca', icon: <CalendarDays className="w-5 h-5" /> },
        { key: 'points', label: 'Tích điểm', icon: <Coins className="w-5 h-5" /> },
        ...(canViewAttendance ? [{ key: 'attendance' as TabKey, label: 'Chấm công', icon: <TimerIcon className="w-5 h-5" /> }] : []),
    ];


    // ── Popup header ──────────────────────────────────────────────────────────
    const popupHeaderLeft = loadingUser ? (
        <div className="flex items-center gap-3">
            <div className="w-14 h-14 rounded-2xl bg-gray-200 animate-pulse shrink-0" />
            <div className="space-y-2">
                <div className="h-4 w-32 bg-gray-200 rounded animate-pulse" />
                <div className="h-3 w-20 bg-gray-200 rounded animate-pulse" />
            </div>
        </div>
    ) : employee ? (
        <div className="flex items-center gap-3.5">
            {/* Avatar — clickable to view fullscreen */}
            <button
                onClick={() => employee.avatar && setExpandedPhoto(employee.avatar)}
                className={cn('w-[72px] h-[72px] rounded-2xl overflow-hidden flex items-center justify-center shadow-lg shrink-0 ring-2 ring-white transition-transform', employee.avatar && 'cursor-pointer hover:scale-105 active:scale-95')}
            >
                {employee.avatar ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={employee.avatar} alt={employee.name} className="w-full h-full object-cover" />
                ) : (
                    <div className="w-full h-full bg-gradient-to-br from-primary-500 to-accent-500 flex items-center justify-center text-white text-2xl font-black">
                        {initials(employee.name)}
                    </div>
                )}
            </button>
            <div className="min-w-0">
                <h3 className="text-[17px] font-bold text-gray-900 leading-tight truncate">{employee.name}</h3>
                <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                    <span className={cn('text-[10px] font-bold px-2 py-0.5 rounded-lg border',
                        employee.type === 'FT' ? 'bg-primary-50 text-primary-700 border-primary-200' : 'bg-teal-50 text-teal-700 border-teal-200'
                    )}>{employee.type === 'FT' ? 'Full-time' : 'Part-time'}</span>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-lg bg-gray-100 text-gray-600 border border-gray-200">
                        {employee.role === 'store_manager' ? 'CH Trưởng' : employee.role === 'manager' ? 'Quản lý' : 'Nhân viên'}
                    </span>
                    {employee.isActive === false && (
                        <span className="flex items-center gap-0.5 text-[10px] font-bold px-2 py-0.5 rounded-lg bg-red-100 text-red-600 border border-red-200">
                            <Ban className="w-2.5 h-2.5" />Vô hiệu
                        </span>
                    )}
                </div>
            </div>
        </div>
    ) : (
        <p className="text-sm text-red-500 font-medium">Không tìm thấy nhân viên.</p>
    );

    return (
        <>
            <Popup
                isOpen={true}
                onClose={onClose}
                title={popupHeaderLeft}
                maxWidth="max-w-3xl"
                fixedHeight="h-[88vh]"
            >
                {/* ── Pill Tabs ── */}
                <div className="px-4 pt-3 pb-0 border-b border-gray-100">
                    <div className="flex gap-1 bg-gray-100 rounded-2xl p-1">
                        {TABS.map(tab => (
                            <button
                                key={tab.key}
                                onClick={() => setActiveTab(tab.key)}
                                className={cn(
                                    'flex-1 flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl text-[16px] font-bold transition-all duration-200',
                                    activeTab === tab.key
                                        ? 'bg-white text-primary-700 shadow-sm'
                                        : 'text-gray-500 hover:text-gray-700'
                                )}
                            >
                                {tab.icon}
                                <div className="md:block hidden text-[14px] truncate">
                                    {tab.label}
                                </div>
                            </button>
                        ))}
                    </div>
                </div>

                {/* ── Tab Content ── */}
                <div className="p-4 space-y-3">

                    {/* ── Info Tab ── */}
                    {activeTab === 'info' && (
                        <>
                            <div className="space-y-2">
                                {infoItems.map((item, i) => (
                                    <div key={i} className="flex items-center gap-3 px-4 py-3 bg-gray-50 rounded-2xl border border-gray-100">
                                        <div className="w-9 h-9 rounded-xl bg-white flex items-center justify-center text-primary-500 shadow-sm border border-gray-100 shrink-0">
                                            {item.icon}
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <p className="text-[10px] text-gray-400 font-semibold uppercase tracking-wider">{item.label}</p>
                                            <p className="text-sm font-bold text-gray-800 truncate mt-0.5">{item.value}</p>
                                        </div>
                                    </div>
                                ))}
                            </div>

                            {/* CCCD Photo Previews */}
                            {employee && (employee.idCardFrontPhoto || employee.idCardBackPhoto) && (
                                <div className="space-y-2 pt-2">
                                    <p className="text-[10px] text-gray-400 font-semibold uppercase tracking-wider flex items-center gap-1.5 px-1">
                                        <ImageIcon className="w-3 h-3" /> Ảnh CCCD
                                    </p>
                                    <div className="grid grid-cols-2 gap-2">
                                        {employee.idCardFrontPhoto && (
                                            <button
                                                onClick={() => setExpandedPhoto(employee.idCardFrontPhoto!)}
                                                className="relative rounded-xl overflow-hidden border border-gray-100 hover:border-primary-300 transition-colors group cursor-pointer"
                                            >
                                                {/* eslint-disable-next-line @next/next/no-img-element */}
                                                <img src={employee.idCardFrontPhoto} alt="CCCD Mặt trước" className="w-full h-24 object-cover" />
                                                <span className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/60 to-transparent text-white text-[9px] font-bold px-2 py-1 text-center">Mặt trước</span>
                                            </button>
                                        )}
                                        {employee.idCardBackPhoto && (
                                            <button
                                                onClick={() => setExpandedPhoto(employee.idCardBackPhoto!)}
                                                className="relative rounded-xl overflow-hidden border border-gray-100 hover:border-primary-300 transition-colors group cursor-pointer"
                                            >
                                                {/* eslint-disable-next-line @next/next/no-img-element */}
                                                <img src={employee.idCardBackPhoto} alt="CCCD Mặt sau" className="w-full h-24 object-cover" />
                                                <span className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/60 to-transparent text-white text-[9px] font-bold px-2 py-1 text-center">Mặt sau</span>
                                            </button>
                                        )}
                                    </div>
                                </div>
                            )}

                            {/* Contract & Employment Dates Section */}
                            {employee && (
                                <ContractSection employee={employee} onUpdated={refreshEmployee} />
                            )}
                        </>
                    )}

                    {/* ── KPI Tab ── */}
                    {activeTab === 'kpi' && (
                        <div className="space-y-4">
                            {/* Toggle: Tháng / Năm */}
                            <div className="flex gap-1 bg-gray-100 rounded-2xl p-1">
                                <button
                                    onClick={() => setChartView('monthly')}
                                    className={cn('flex-1 py-2 rounded-xl text-[12px] font-bold transition-all',
                                        chartView === 'monthly' ? 'bg-white text-primary-700 shadow-sm' : 'text-gray-500'
                                    )}
                                >Theo tháng</button>
                                <button
                                    onClick={() => setChartView('yearly')}
                                    className={cn('flex-1 py-2 rounded-xl text-[12px] font-bold transition-all',
                                        chartView === 'yearly' ? 'bg-white text-primary-700 shadow-sm' : 'text-gray-500'
                                    )}
                                >Theo năm</button>
                            </div>

                            {/* ── Monthly view: month picker + records list ── */}
                            {chartView === 'monthly' && (
                                <>
                                    {/* Month picker */}
                                    <div className="flex items-center justify-between">
                                        <p className="text-xs font-bold text-gray-500 uppercase tracking-wider">Chi tiết tháng</p>
                                        <input
                                            type="month"
                                            value={kpiMonth}
                                            onChange={e => setKpiMonth(e.target.value)}
                                            className="border border-gray-200 rounded-xl px-3 py-1.5 text-xs font-semibold outline-none focus:ring-2 focus:ring-primary-300 bg-gray-50"
                                        />
                                    </div>

                                    {/* Records */}
                                    {loadingKpi ? (
                                        <div className="flex justify-center py-10"><Loader2 className="w-5 h-5 text-primary-500 animate-spin" /></div>
                                    ) : kpiRecords.length === 0 ? (
                                        <div className="flex flex-col items-center py-10 gap-2">
                                            <Award className="w-10 h-10 text-gray-200" />
                                            <p className="text-sm text-gray-400 font-medium">Không có dữ liệu KPI tháng này</p>
                                        </div>
                                    ) : (
                                        <div className="space-y-2">
                                            {[...kpiRecords].sort((a, b) => b.date.localeCompare(a.date)).map(rec => {
                                                const isOfficial = rec.status === 'OFFICIAL';
                                                const pct = isOfficial ? rec.officialTotal : rec.selfTotal;
                                                return (
                                                    <div key={rec.id} className="bg-gray-50 rounded-2xl border border-gray-100 px-4 py-3">
                                                        <div className="flex items-center gap-3">
                                                            <div className={cn('w-9 h-9 rounded-xl flex items-center justify-center shrink-0',
                                                                isOfficial ? 'bg-emerald-100' : 'bg-amber-100'
                                                            )}>
                                                                {isOfficial
                                                                    ? <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                                                                    : <Clock className="w-4 h-4 text-amber-600" />
                                                                }
                                                            </div>
                                                            <div className="flex-1 min-w-0">
                                                                <div className="flex items-center gap-2">
                                                                    <span className="text-[13px] font-bold text-gray-800">{formatDate(rec.date)}</span>
                                                                    <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-md bg-primary-50 text-primary-600 border border-primary-100">{rec.shiftId}</span>
                                                                    <span className={cn('ml-auto text-[10px] font-bold px-2 py-0.5 rounded-lg border',
                                                                        isOfficial ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-amber-50 text-amber-700 border-amber-200'
                                                                    )}>{isOfficial ? 'Chính thức' : 'Tự chấm'}</span>
                                                                </div>
                                                                <div className="flex items-center gap-3 mt-1.5">
                                                                    <div className="flex-1 h-1.5 bg-gray-200 rounded-full overflow-hidden">
                                                                        <div className={cn('h-full rounded-full transition-all duration-500', barColor(pct))} style={{ width: `${pct}%` }} />
                                                                    </div>
                                                                    <div className="flex items-center gap-1.5 shrink-0">
                                                                        <span className="text-[11px] text-gray-400">NV: <span className={cn('font-black', scoreColor(rec.selfTotal))}>{rec.selfTotal}</span></span>
                                                                        {isOfficial && <span className="text-[11px] text-gray-400">CT: <span className={cn('font-black', scoreColor(rec.officialTotal))}>{rec.officialTotal}</span></span>}
                                                                    </div>
                                                                </div>
                                                            </div>
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    )}
                                </>
                            )}

                            {/* ── Yearly view: 6-month chart + monthly avg list ── */}
                            {chartView === 'yearly' && (
                                <>
                                    <p className="text-xs font-bold text-gray-500 uppercase tracking-wider flex items-center gap-1.5">
                                        <TrendingUp className="w-3.5 h-3.5" /> Trung bình 6 tháng gần nhất
                                    </p>

                                    {/* 6-bar chart */}
                                    <div className="bg-gray-50 rounded-2xl border border-gray-100 p-4">
                                        {loadingYearly ? (
                                            <div className="flex justify-center items-center h-24"><Loader2 className="w-5 h-5 text-primary-400 animate-spin" /></div>
                                        ) : kpiYearlyAvgs.length === 0 ? (
                                            <div className="flex flex-col items-center justify-center h-24 gap-2">
                                                <Award className="w-8 h-8 text-gray-200" />
                                                <p className="text-xs text-gray-400">Chưa có dữ liệu</p>
                                            </div>
                                        ) : (
                                            <div className="flex items-end gap-2 h-24">
                                                {[...kpiYearlyAvgs].slice(0, 6).reverse().map(m => {
                                                    const h = m.avg > 0 ? Math.max((m.avg / 100) * 80, 8) : 4;
                                                    return (
                                                        <div key={m.month} className="flex-1 flex flex-col items-center gap-1 min-w-0">
                                                            <span className={cn('text-[10px] font-black leading-none', m.avg > 0 ? scoreColor(m.avg) : 'text-gray-300')}>
                                                                {m.avg || '—'}
                                                            </span>
                                                            <div className="w-full flex items-end">
                                                                <div
                                                                    className={cn('w-full rounded-t-lg transition-all duration-700', barColor(m.avg))}
                                                                    style={{ height: `${h}px` }}
                                                                />
                                                            </div>
                                                            <span className="text-[9px] text-gray-400 font-medium truncate w-full text-center">{formatMonthLabel(m.month)}</span>
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        )}
                                    </div>

                                    {/* Monthly avg list */}
                                    {!loadingYearly && kpiYearlyAvgs.length > 0 && (
                                        <div className="space-y-2">
                                            {[...kpiYearlyAvgs].slice(0, 6).map(m => (
                                                <div key={m.month} className="flex items-center gap-3 px-4 py-2.5 bg-gray-50 rounded-2xl border border-gray-100">
                                                    <span className="text-[12px] font-bold text-gray-700 min-w-[52px]">{formatMonthLabel(m.month)}</span>
                                                    <div className="flex-1 h-2 bg-gray-200 rounded-full overflow-hidden">
                                                        <div
                                                            className={cn('h-full rounded-full transition-all duration-500', barColor(m.avg))}
                                                            style={{ width: `${m.avg}%` }}
                                                        />
                                                    </div>
                                                    <span className={cn('text-[13px] font-black min-w-[28px] text-right', m.avg > 0 ? scoreColor(m.avg) : 'text-gray-300')}>
                                                        {m.avg || '—'}
                                                    </span>
                                                    {m.count > 0 && (
                                                        <span className="text-[10px] text-gray-400 font-medium">{m.count} ca</span>
                                                    )}
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </>
                            )}

                        </div>
                    )}


                    {/* ── Shifts Tab ── */}
                    {activeTab === 'shifts' && (
                        <div className="space-y-4">
                            {/* Monthly summary card */}
                            <div className="flex items-center gap-4 bg-gradient-to-r from-primary-50 to-accent-50 border border-primary-100 rounded-2xl px-5 py-4">
                                <div className="w-12 h-12 rounded-2xl bg-white shadow-sm border border-primary-100 flex items-center justify-center shrink-0">
                                    <CalendarDays className="w-6 h-6 text-primary-600" />
                                </div>
                                <div>
                                    <p className="text-[11px] text-primary-600 font-semibold uppercase tracking-wider">Ca đã hoàn thành tháng này</p>
                                    <p className="text-3xl font-black text-primary-800 leading-tight">{monthlyShiftCount}</p>
                                </div>
                            </div>

                            {/* Week navigation */}
                            <div className="flex items-center justify-between">
                                <p className="text-xs font-bold text-gray-500 uppercase tracking-wider">Lịch tuần</p>
                                <div className="flex items-center gap-1 bg-gray-100 rounded-2xl p-1">
                                    <button onClick={() => { const d = new Date(weekStart); d.setDate(d.getDate() - 7); setWeekStart(d); }}
                                        className="w-8 h-8 rounded-xl flex items-center justify-center hover:bg-white transition-colors active:scale-90">
                                        <ChevronLeft className="w-4 h-4 text-gray-600" />
                                    </button>
                                    <span className="text-xs font-bold text-gray-700 min-w-[110px] text-center">
                                        {weekDays.length > 0 && `${formatDate(toLocalDateString(weekDays[0]))} — ${formatDate(toLocalDateString(weekDays[6]))}`}
                                    </span>
                                    <button onClick={() => { const d = new Date(weekStart); d.setDate(d.getDate() + 7); setWeekStart(d); }}
                                        className="w-8 h-8 rounded-xl flex items-center justify-center hover:bg-white transition-colors active:scale-90">
                                        <ChevronRight className="w-4 h-4 text-gray-600" />
                                    </button>
                                </div>
                            </div>

                            {/* Shift card list (replaces dense table) */}
                            {loadingShifts ? (
                                <div className="flex justify-center py-10"><Loader2 className="w-5 h-5 text-primary-500 animate-spin" /></div>
                            ) : schedules.length === 0 ? (
                                <div className="flex flex-col items-center py-10 gap-2">
                                    <CalendarDays className="w-10 h-10 text-gray-200" />
                                    <p className="text-sm text-gray-400 font-medium">Không có ca trong tuần này</p>
                                </div>
                            ) : (
                                <div className="space-y-2">
                                    {/* Group by the actual dates in schedule data (not weekDays iterator) */}
                                    {Array.from(new Set(schedules.map(s => s.date))).sort().map(dateStr => {
                                        const dayScheds = schedules.filter(s => s.date === dateStr);
                                        const dateObj = new Date(dateStr + 'T00:00:00');
                                        const isToday = dateStr === toLocalDateString(new Date());
                                        const dayLabel = dateObj.toLocaleDateString('vi-VN', { weekday: 'short' });
                                        return (
                                            <div key={dateStr} className={cn('rounded-2xl border overflow-hidden',
                                                isToday ? 'border-primary-200 bg-primary-50/30' : 'border-gray-100 bg-gray-50'
                                            )}>
                                                {/* Date header */}
                                                <div className={cn('flex items-center gap-2 px-4 py-2 border-b',
                                                    isToday ? 'border-primary-100 bg-primary-100/40' : 'border-gray-100 bg-gray-100/60'
                                                )}>
                                                    <span className={cn('text-[11px] font-black uppercase', isToday ? 'text-primary-700' : 'text-gray-500')}>{dayLabel}</span>
                                                    <span className={cn('text-[13px] font-bold', isToday ? 'text-primary-800' : 'text-gray-700')}>{formatDate(dateStr)}</span>
                                                    {isToday && <span className="ml-auto text-[9px] font-black px-2 py-0.5 rounded-full bg-primary-600 text-white">HÔM NAY</span>}
                                                </div>
                                                {/* Shifts for this day */}
                                                {dayScheds.map(sched => {
                                                    const counter = counters.find(c => c.id === sched.counterId);
                                                    return (
                                                        <div key={sched.id || `${sched.date}-${sched.shiftId}-${sched.counterId}`} className="flex items-center gap-3 px-4 py-2.5">
                                                            <Clock className="w-3.5 h-3.5 text-gray-400 shrink-0" />
                                                            <span className={cn('text-[12px] font-bold', isToday ? 'text-primary-700' : 'text-gray-700')}>{sched.shiftId}</span>
                                                            {counter?.name && (
                                                                <span className="ml-auto text-[11px] font-semibold px-2.5 py-1 rounded-lg bg-accent-50 text-accent-700 border border-accent-100">
                                                                    {counter.name}
                                                                </span>
                                                            )}
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </div>
                    )}

                    {/* ── Points Tab ── */}
                    {activeTab === 'points' && (
                        <ReferralHistorySection
                            employeeId={employeeUid}
                            compact
                            isAdmin={currentUserDoc?.role === 'admin'}
                            adminId={user?.uid}
                        />
                    )}

                    {/* ── Attendance Tab ── */}
                    {activeTab === 'attendance' && canViewAttendance && (
                        <AttendanceTabContent
                            employeeUid={employeeUid}
                            employee={employee}
                            storeId={effectiveStoreId}
                            user={user}
                            month={attendanceMonth}
                            onMonthChange={setAttendanceMonth}
                        />
                    )}

                </div>
            </Popup>

            {/* Fullscreen photo viewer */}
            {expandedPhoto && (
                <div
                    className="fixed inset-0 z-[200] bg-black/90 flex items-center justify-center p-4"
                    onClick={() => setExpandedPhoto(null)}
                >
                    <button
                        onClick={() => setExpandedPhoto(null)}
                        className="absolute top-4 right-4 w-10 h-10 rounded-full bg-white/20 hover:bg-white/30 flex items-center justify-center text-white transition-colors"
                    >
                        <X className="w-5 h-5" />
                    </button>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                        src={expandedPhoto}
                        alt="CCCD"
                        className="max-w-full max-h-[90vh] object-contain rounded-lg"
                        onClick={e => e.stopPropagation()}
                    />
                </div>
            )}
        </>
    );
}
