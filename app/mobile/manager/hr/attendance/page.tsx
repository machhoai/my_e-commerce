'use client';

/**
 * /mobile/manager/hr/attendance
 *
 * Native-app-style mobile attendance dashboard.
 * - Card-per-employee with status badges (Vào sớm / Đúng giờ / Vào trễ / Về sớm / Tăng ca)
 * - Day & Month toggle with swipeable date navigator
 * - Permission-gated: requires page.hr.attendance
 * - Bottom-sheet detail per employee on tap
 */

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { db } from '@/lib/firebase';
import { collection, onSnapshot, doc, getDoc } from 'firebase/firestore';
import { UserDoc, DailyAttendance, ZkUserDoc, SettingsDoc } from '@/types';
import {
    ChevronLeft, ChevronRight, RefreshCw, Calendar, CalendarRange,
    LogIn, LogOut, Clock, AlertCircle, Loader2, ShieldOff,
    User, Search, X,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { calculateAttendanceStatus, PunchStatus, PunchOutStatus } from '@/lib/attendance-rules';
import EmployeeProfilePopup from '@/components/shared/EmployeeProfilePopup';

// ─────────────────────────────────────────────────────────────────────────────
// Colour tokens
// ─────────────────────────────────────────────────────────────────────────────

const IN_TOKENS: Record<PunchStatus, { pill: string; dot: string; label: string }> = {
    EARLY:   { pill: 'bg-blue-100 text-blue-700',    dot: 'bg-blue-400',   label: 'Vào sớm' },
    ON_TIME: { pill: 'bg-emerald-100 text-emerald-700', dot: 'bg-emerald-400', label: 'Đúng giờ' },
    LATE:    { pill: 'bg-red-100 text-red-700',      dot: 'bg-red-400',    label: 'Vào trễ' },
    UNKNOWN: { pill: 'bg-gray-100 text-gray-500',    dot: 'bg-gray-300',   label: '—' },
};

const OUT_TOKENS: Record<PunchOutStatus, { pill: string; label: string }> = {
    EARLY_OUT:   { pill: 'bg-amber-100 text-amber-700',   label: 'Về sớm' },
    ON_TIME_OUT: { pill: 'bg-emerald-100 text-emerald-700', label: 'Đúng giờ' },
    OVERTIME:    { pill: 'bg-purple-100 text-purple-700', label: 'Tăng ca' },
    UNKNOWN:     { pill: 'bg-gray-100 text-gray-500',     label: '—' },
};

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function todayISO() { return new Date().toISOString().slice(0, 10); }
function currentMonthISO() { return new Date().toISOString().slice(0, 7); }

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

function daysInMonth(m: string) {
    const [y, mo] = m.split('-').map(Number);
    return new Date(y, mo, 0).getDate();
}

function shiftMonth(m: string, delta: number) {
    const d = new Date(`${m}-01`);
    d.setMonth(d.getMonth() + delta);
    return d.toISOString().slice(0, 7);
}

function shiftDay(d: string, delta: number) {
    const dt = new Date(d);
    dt.setDate(dt.getDate() + delta);
    return dt.toISOString().slice(0, 10);
}

// ─────────────────────────────────────────────────────────────────────────────
// Detail Bottom-Sheet
// ─────────────────────────────────────────────────────────────────────────────

interface DetailSheetProps {
    employee: UserDoc;
    record: DailyAttendance | null;
    settings: SettingsDoc | null;
    date: string;
    onClose: () => void;
}

function DetailSheet({ employee, record, settings, date, onClose }: DetailSheetProps) {
    const st = record?.checkIn
        ? calculateAttendanceStatus(record.checkIn, record.checkOut, date, settings)
        : null;
    const inTok  = st ? IN_TOKENS[st.status]        : IN_TOKENS.UNKNOWN;
    const outTok = st ? OUT_TOKENS[st.checkOutStatus]: OUT_TOKENS.UNKNOWN;

    const initials = (name: string) => {
        const p = name.trim().split(' ').filter(Boolean);
        return p.length >= 2 ? (p[0][0] + p[p.length - 1][0]).toUpperCase() : name.slice(0, 2).toUpperCase();
    };

    return (
        <div
            className="fixed inset-0 z-50 flex flex-col justify-end"
            onClick={onClose}
        >
            {/* Backdrop */}
            <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" />

            {/* Sheet */}
            <div
                className="relative bg-white rounded-t-3xl shadow-2xl pb-10 animate-in slide-in-from-bottom duration-300"
                onClick={e => e.stopPropagation()}
            >
                {/* Handle */}
                <div className="flex justify-center pt-3 pb-1">
                    <div className="w-10 h-1 rounded-full bg-gray-200" />
                </div>

                {/* Employee header */}
                <div className="flex items-center gap-3 px-5 py-4 border-b border-gray-100">
                    <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-primary-500 to-accent-500 flex items-center justify-center text-white font-black text-lg shrink-0">
                        {employee.avatar
                            // eslint-disable-next-line @next/next/no-img-element
                            ? <img src={employee.avatar} alt="" className="w-full h-full object-cover rounded-2xl" />
                            : initials(employee.name)
                        }
                    </div>
                    <div className="flex-1 min-w-0">
                        <p className="font-bold text-gray-900 truncate">{employee.name}</p>
                        <p className="text-xs text-gray-400">{date.split('-').reverse().join('/')}</p>
                    </div>
                    <button onClick={onClose} className="w-8 h-8 rounded-xl bg-gray-100 flex items-center justify-center">
                        <X className="w-4 h-4 text-gray-500" />
                    </button>
                </div>

                {!record ? (
                    <div className="flex flex-col items-center gap-2 py-10 text-gray-400">
                        <Clock className="w-10 h-10" />
                        <p className="text-sm font-medium">Không có dữ liệu</p>
                    </div>
                ) : (
                    <div className="px-5 py-4 space-y-4">
                        {/* Status badges */}
                        <div className="flex gap-2 flex-wrap">
                            <span className={cn('px-3 py-1 rounded-xl text-xs font-bold', inTok.pill)}>
                                Vào: {inTok.label}
                            </span>
                            {record.checkOut && (
                                <span className={cn('px-3 py-1 rounded-xl text-xs font-bold', outTok.pill)}>
                                    Ra: {outTok.label}
                                </span>
                            )}
                        </div>

                        {/* Time cards */}
                        <div className="grid grid-cols-3 gap-2">
                            <div className="bg-gray-50 rounded-2xl p-3 flex flex-col items-center border border-gray-100">
                                <LogIn className="w-4 h-4 text-gray-400 mb-1" />
                                <p className="text-base font-black text-gray-800">{fmtTime(record.checkIn)}</p>
                                <p className="text-[10px] text-gray-400 font-semibold uppercase mt-0.5">Vào</p>
                            </div>
                            <div className="bg-gray-50 rounded-2xl p-3 flex flex-col items-center border border-gray-100">
                                <LogOut className="w-4 h-4 text-gray-400 mb-1" />
                                <p className={cn('text-base font-black', record.checkOut ? 'text-gray-800' : 'text-gray-300')}>
                                    {fmtTime(record.checkOut)}
                                </p>
                                <p className="text-[10px] text-gray-400 font-semibold uppercase mt-0.5">Ra</p>
                            </div>
                            <div className="bg-emerald-50 rounded-2xl p-3 flex flex-col items-center border border-emerald-100">
                                <Clock className="w-4 h-4 text-emerald-400 mb-1" />
                                <p className="text-base font-black text-emerald-700">{fmtHours(st?.workHours ?? null)}</p>
                                <p className="text-[10px] text-emerald-500 font-semibold uppercase mt-0.5">Giờ làm</p>
                            </div>
                        </div>

                        {/* Detected shift */}
                        {st?.detectedShift && (
                            <div className="flex items-center gap-2 text-xs text-gray-500 bg-gray-50 rounded-xl px-3 py-2">
                                <Calendar className="w-3.5 h-3.5 shrink-0" />
                                <span>Ca làm: <strong className="text-gray-700">{st.detectedShift}</strong></span>
                                <span className="text-gray-300">·</span>
                                <span>Quy tắc: {st.rule.startTime} → {st.rule.endTime}</span>
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}

// ─────────────────────────────────────────────────────────────────────────────
// Employee Card (Day View)
// ─────────────────────────────────────────────────────────────────────────────

interface EmpCardProps {
    employee: UserDoc;
    record: DailyAttendance | undefined;
    settings: SettingsDoc | null;
    date: string;
    onClick: () => void;
}

function EmployeeCard({ employee, record, settings, date, onClick }: EmpCardProps) {
    const st = record?.checkIn
        ? calculateAttendanceStatus(record.checkIn, record.checkOut, date, settings)
        : null;
    const inTok  = st ? IN_TOKENS[st.status]        : IN_TOKENS.UNKNOWN;
    const outTok = st ? OUT_TOKENS[st.checkOutStatus]: OUT_TOKENS.UNKNOWN;

    const initials = (name: string) => {
        const p = name.trim().split(' ').filter(Boolean);
        return p.length >= 2 ? (p[0][0] + p[p.length - 1][0]).toUpperCase() : name.slice(0, 2).toUpperCase();
    };

    return (
        <button
            onClick={onClick}
            className="w-full text-left bg-white rounded-2xl border border-gray-100 shadow-sm p-3 flex items-center gap-3 active:scale-[0.98] transition-transform"
        >
            {/* Avatar with status dot */}
            <div className="relative shrink-0">
                <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-primary-400 to-accent-500 flex items-center justify-center text-white font-black text-sm overflow-hidden">
                    {employee.avatar
                        // eslint-disable-next-line @next/next/no-img-element
                        ? <img src={employee.avatar} alt="" className="w-full h-full object-cover" />
                        : initials(employee.name)
                    }
                </div>
                {st && (
                    <span className={cn('absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-white', inTok.dot)} />
                )}
            </div>

            {/* Name + times */}
            <div className="flex-1 min-w-0">
                <p className="text-sm font-bold text-gray-900 truncate">{employee.name}</p>
                <div className="flex items-center gap-2 mt-0.5">
                    <span className="text-[11px] text-gray-500 flex items-center gap-0.5">
                        <LogIn className="w-2.5 h-2.5" /> {fmtTime(record?.checkIn)}
                    </span>
                    {record?.checkOut && (
                        <>
                            <span className="text-gray-200">·</span>
                            <span className="text-[11px] text-gray-500 flex items-center gap-0.5">
                                <LogOut className="w-2.5 h-2.5" /> {fmtTime(record.checkOut)}
                            </span>
                        </>
                    )}
                </div>
            </div>

            {/* Right badges */}
            <div className="shrink-0 flex flex-col items-end gap-1">
                {st ? (
                    <>
                        <span className={cn('text-[10px] font-bold px-2 py-0.5 rounded-lg', inTok.pill)}>
                            {inTok.label}
                        </span>
                        {record?.checkOut && (
                            <span className={cn('text-[10px] font-bold px-2 py-0.5 rounded-lg', outTok.pill)}>
                                {outTok.label}
                            </span>
                        )}
                    </>
                ) : (
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-lg bg-gray-100 text-gray-400">Vắng</span>
                )}
            </div>
        </button>
    );
}

// ─────────────────────────────────────────────────────────────────────────────
// Month Grid Cell
// ─────────────────────────────────────────────────────────────────────────────

function MonthCell({ dayNum, month, record, settings }: {
    dayNum: number; month: string; record?: DailyAttendance; settings: SettingsDoc | null;
}) {
    const date = `${month}-${String(dayNum).padStart(2, '0')}`;
    const st = record?.checkIn
        ? calculateAttendanceStatus(record.checkIn, record.checkOut, date, settings)
        : null;
    const tok = st ? IN_TOKENS[st.status] : null;
    const isToday = date === todayISO();

    return (
        <div className={cn(
            'rounded-xl p-1.5 text-center border',
            isToday ? 'border-primary-300 bg-primary-50' : 'border-gray-100 bg-white',
        )}>
            <p className={cn('text-[10px] font-bold', isToday ? 'text-primary-600' : 'text-gray-400')}>{dayNum}</p>
            {tok ? (
                <span className={cn('inline-block w-2 h-2 rounded-full mt-0.5', tok.dot)} />
            ) : (
                <span className="inline-block w-2 h-2 rounded-full mt-0.5 bg-gray-100" />
            )}
            {st && (
                <p className={cn('text-[9px] font-semibold mt-0.5 leading-tight', tok?.pill.split(' ')[1])}>
                    {fmtTime(record?.checkIn)}
                </p>
            )}
        </div>
    );
}

// ─────────────────────────────────────────────────────────────────────────────
// Main Page
// ─────────────────────────────────────────────────────────────────────────────

export default function MobileAttendancePage() {
    const router = useRouter();
    const { user, userDoc, hasPermission } = useAuth();

    const isAdmin = userDoc?.role === 'admin' || userDoc?.role === 'super_admin';
    const canView = isAdmin || hasPermission('page.hr.attendance');

    type Mode = 'day' | 'month';
    const [mode, setMode] = useState<Mode>('day');
    const [selectedDate, setSelectedDate] = useState(todayISO());
    const [selectedMonth, setSelectedMonth] = useState(currentMonthISO());
    const [search, setSearch] = useState('');
    const [showSearch, setShowSearch] = useState(false);

    const [attendance, setAttendance] = useState<DailyAttendance[]>([]);
    const [zkUsers, setZkUsers] = useState<ZkUserDoc[]>([]);
    const [allEmployees, setAllEmployees] = useState<UserDoc[]>([]);
    const [settings, setSettings] = useState<SettingsDoc | null>(null);

    const [loading, setLoading] = useState(false);
    const [syncing, setSyncing] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const [detailEmployee, setDetailEmployee] = useState<UserDoc | null>(null);
    const [detailDate, setDetailDate] = useState<string>('');
    const [popupEmployee, setPopupEmployee] = useState<UserDoc | null>(null);

    const getToken = useCallback(async () => user?.getIdToken() ?? '', [user]);

    // Real-time listeners
    useEffect(() => {
        const u1 = onSnapshot(collection(db, 'users'), snap => {
            setAllEmployees(snap.docs.map(d => d.data() as UserDoc).filter(u => u.isActive !== false && u.role !== 'admin'));
        });
        const u2 = onSnapshot(collection(db, 'zkteco_users'), snap => {
            setZkUsers(snap.docs.map(d => ({ id: d.id, ...d.data() } as ZkUserDoc)));
        });
        return () => { u1(); u2(); };
    }, []);

    // Load settings
    useEffect(() => {
        (async () => {
            const snap = await getDoc(doc(db, 'settings', 'global'));
            if (snap.exists()) setSettings(snap.data() as SettingsDoc);
        })();
    }, []);

    // Fetch attendance
    const fetchAttendance = useCallback(async () => {
        setLoading(true); setError(null);
        try {
            const token = await getToken();
            const param = mode === 'day' ? `date=${selectedDate}` : `month=${selectedMonth}`;
            const res = await fetch(`/api/hr/attendance?${param}`, {
                headers: { Authorization: `Bearer ${token}` },
            });
            if (!res.ok) throw new Error('Lỗi tải dữ liệu');
            setAttendance(await res.json());
        } catch (e) {
            setError(e instanceof Error ? e.message : 'Lỗi');
        } finally {
            setLoading(false);
        }
    }, [getToken, mode, selectedDate, selectedMonth]);

    useEffect(() => { fetchAttendance(); }, [fetchAttendance]);

    const handleSync = async () => {
        setSyncing(true);
        try {
            const token = await getToken();
            await fetch('/api/hr/sync-attendance', { method: 'POST', headers: { Authorization: `Bearer ${token}` } });
            await fetchAttendance();
        } finally { setSyncing(false); }
    };

    // Maps
    const mappedZkByUid = useMemo(() => {
        const m = new Map<string, ZkUserDoc>();
        for (const z of zkUsers) if (z.status === 'mapped' && z.mapped_system_uid) m.set(z.mapped_system_uid, z);
        return m;
    }, [zkUsers]);

    const attendanceByUidDate = useMemo(() => {
        const m = new Map<string, DailyAttendance>();
        for (const a of attendance) if (a.mapped_system_uid) m.set(`${a.mapped_system_uid}|${a.date}`, a);
        return m;
    }, [attendance]);

    const mappedEmployees = useMemo(() =>
        allEmployees.filter(e => mappedZkByUid.has(e.uid)), [allEmployees, mappedZkByUid]);

    // Day mode: only employees with punch record
    const dayEmployees = useMemo(() => {
        const base = mappedEmployees.filter(e => attendanceByUidDate.has(`${e.uid}|${selectedDate}`));
        if (!search.trim()) return base;
        const q = search.toLowerCase();
        return base.filter(e => e.name.toLowerCase().includes(q));
    }, [mappedEmployees, attendanceByUidDate, selectedDate, search]);

    // Month mode: show all mapped employees
    const monthEmployees = useMemo(() => {
        if (!search.trim()) return mappedEmployees;
        const q = search.toLowerCase();
        return mappedEmployees.filter(e => e.name.toLowerCase().includes(q));
    }, [mappedEmployees, search]);

    const monthDays = useMemo(() => daysInMonth(selectedMonth), [selectedMonth]);

    const dayStats = useMemo(() => {
        let onTime = 0, early = 0, late = 0;
        for (const e of dayEmployees) {
            const r = attendanceByUidDate.get(`${e.uid}|${selectedDate}`);
            if (!r?.checkIn) continue;
            const s = calculateAttendanceStatus(r.checkIn, r.checkOut, selectedDate, settings);
            if (s.status === 'EARLY') early++;
            else if (s.status === 'LATE') late++;
            else onTime++;
        }
        return { present: dayEmployees.length, early, onTime, late };
    }, [dayEmployees, attendanceByUidDate, selectedDate, settings]);

    // ── Access denied ─────────────────────────────────────────────────────────
    if (userDoc && !canView) {
        return (
            <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center gap-4 p-6">
                <div className="w-20 h-20 rounded-3xl bg-red-50 flex items-center justify-center">
                    <ShieldOff className="w-10 h-10 text-red-400" />
                </div>
                <h1 className="text-xl font-black text-gray-800 text-center">Không có quyền</h1>
                <p className="text-sm text-gray-500 text-center max-w-xs">
                    Trang chấm công chỉ dành cho những người được cấp quyền.
                </p>
                <button
                    onClick={() => router.back()}
                    className="mt-2 px-6 py-3 bg-primary-600 text-white font-bold rounded-2xl active:scale-95 transition-transform"
                >
                    Quay lại
                </button>
            </div>
        );
    }

    // ── Render ────────────────────────────────────────────────────────────────
    return (
        <div className="min-h-screen bg-gray-50 flex flex-col">
            {/* ── App-style header ─────────────────────────────────── */}
            <header className="bg-primary-600 pt-safe-top">
                <div className="flex items-center justify-between px-4 py-3">
                    <button
                        onClick={() => router.back()}
                        className="w-9 h-9 rounded-xl bg-white/20 flex items-center justify-center active:scale-90 transition-transform"
                    >
                        <ChevronLeft className="w-5 h-5 text-white" />
                    </button>
                    <h1 className="text-base font-black text-white">Chấm công</h1>
                    <div className="flex gap-2">
                        <button
                            onClick={() => { setShowSearch(s => !s); setSearch(''); }}
                            className="w-9 h-9 rounded-xl bg-white/20 flex items-center justify-center active:scale-90 transition-transform"
                        >
                            {showSearch ? <X className="w-4 h-4 text-white" /> : <Search className="w-4 h-4 text-white" />}
                        </button>
                        <button
                            onClick={handleSync}
                            disabled={syncing || loading}
                            className="w-9 h-9 rounded-xl bg-white/20 flex items-center justify-center active:scale-90 transition-transform disabled:opacity-50"
                        >
                            <RefreshCw className={cn('w-4 h-4 text-white', (syncing || loading) && 'animate-spin')} />
                        </button>
                    </div>
                </div>

                {/* Mode + date nav */}
                <div className="px-4 pb-4 flex flex-col gap-3">
                    {/* Mode toggle */}
                    <div className="flex bg-white/20 rounded-2xl p-1 gap-1">
                        {(['day', 'month'] as Mode[]).map(m => (
                            <button
                                key={m}
                                onClick={() => setMode(m)}
                                className={cn(
                                    'flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl text-[12px] font-bold transition-all',
                                    mode === m ? 'bg-white text-primary-700 shadow-sm' : 'text-white/80',
                                )}
                            >
                                {m === 'day' ? <Calendar className="w-3.5 h-3.5" /> : <CalendarRange className="w-3.5 h-3.5" />}
                                {m === 'day' ? 'Theo ngày' : 'Theo tháng'}
                            </button>
                        ))}
                    </div>

                    {/* Date navigator */}
                    <div className="flex items-center bg-white/20 rounded-2xl px-2 py-1">
                        <button
                            onClick={() => mode === 'day' ? setSelectedDate(shiftDay(selectedDate, -1)) : setSelectedMonth(shiftMonth(selectedMonth, -1))}
                            className="w-8 h-8 flex items-center justify-center rounded-xl active:bg-white/20 transition-colors"
                        >
                            <ChevronLeft className="w-4 h-4 text-white" />
                        </button>
                        <div className="flex-1 text-center">
                            {mode === 'day' ? (
                                <input
                                    type="date"
                                    value={selectedDate}
                                    onChange={e => setSelectedDate(e.target.value)}
                                    className="bg-transparent text-white font-bold text-sm text-center outline-none w-full"
                                />
                            ) : (
                                <input
                                    type="month"
                                    value={selectedMonth}
                                    onChange={e => setSelectedMonth(e.target.value)}
                                    className="bg-transparent text-white font-bold text-sm text-center outline-none w-full"
                                />
                            )}
                        </div>
                        <button
                            onClick={() => mode === 'day' ? setSelectedDate(shiftDay(selectedDate, 1)) : setSelectedMonth(shiftMonth(selectedMonth, 1))}
                            className="w-8 h-8 flex items-center justify-center rounded-xl active:bg-white/20 transition-colors"
                        >
                            <ChevronRight className="w-4 h-4 text-white" />
                        </button>
                    </div>
                </div>
            </header>

            {/* ── Search bar (conditional) ─────────────────────────── */}
            {showSearch && (
                <div className="px-4 py-2 bg-white border-b border-gray-100">
                    <div className="flex items-center gap-2 bg-gray-50 rounded-2xl px-3 py-2 border border-gray-200">
                        <Search className="w-4 h-4 text-gray-400 shrink-0" />
                        <input
                            autoFocus
                            type="text"
                            value={search}
                            onChange={e => setSearch(e.target.value)}
                            placeholder="Tìm nhân viên..."
                            className="flex-1 bg-transparent text-sm text-gray-700 outline-none placeholder:text-gray-400"
                        />
                        {search && (
                            <button onClick={() => setSearch('')}>
                                <X className="w-3.5 h-3.5 text-gray-400" />
                            </button>
                        )}
                    </div>
                </div>
            )}

            {/* ── Day mode — summary strip ─────────────────────────── */}
            {mode === 'day' && (
                <div className="px-4 pt-3 pb-1 grid grid-cols-4 gap-2">
                    {[
                        { label: 'Có mặt', val: dayStats.present, color: 'text-primary-700 bg-primary-50 border-primary-100' },
                        { label: 'Vào sớm', val: dayStats.early, color: 'text-blue-700 bg-blue-50 border-blue-100' },
                        { label: 'Đúng giờ', val: dayStats.onTime, color: 'text-emerald-700 bg-emerald-50 border-emerald-100' },
                        { label: 'Vào trễ', val: dayStats.late, color: 'text-red-700 bg-red-50 border-red-100' },
                    ].map(s => (
                        <div key={s.label} className={cn('rounded-2xl border p-2 text-center', s.color)}>
                            <p className="text-lg font-black leading-none">{s.val}</p>
                            <p className="text-[9px] font-bold uppercase tracking-wide mt-0.5 opacity-80">{s.label}</p>
                        </div>
                    ))}
                </div>
            )}

            {/* ── Content ──────────────────────────────────────────── */}
            <main className="flex-1 px-4 py-3 space-y-2 overflow-y-auto pb-safe-bottom">
                {/* Error */}
                {error && (
                    <div className="flex items-center gap-2 bg-red-50 border border-red-200 rounded-2xl px-3 py-2.5">
                        <AlertCircle className="w-4 h-4 text-red-500 shrink-0" />
                        <p className="text-xs text-red-700 font-medium">{error}</p>
                    </div>
                )}

                {/* Loading */}
                {loading && (
                    <div className="flex justify-center py-10">
                        <Loader2 className="w-7 h-7 animate-spin text-primary-500" />
                    </div>
                )}

                {/* Day view */}
                {!loading && mode === 'day' && (
                    <>
                        {dayEmployees.length === 0 ? (
                            <div className="flex flex-col items-center gap-2 py-12 text-gray-400">
                                <User className="w-10 h-10" />
                                <p className="text-sm font-medium">Không có chấm công trong ngày này</p>
                            </div>
                        ) : (
                            dayEmployees.map(emp => (
                                <EmployeeCard
                                    key={emp.uid}
                                    employee={emp}
                                    record={attendanceByUidDate.get(`${emp.uid}|${selectedDate}`)}
                                    settings={settings}
                                    date={selectedDate}
                                    onClick={() => { setDetailEmployee(emp); setDetailDate(selectedDate); }}
                                />
                            ))
                        )}
                    </>
                )}

                {/* Month view — per employee mini grid */}
                {!loading && mode === 'month' && (
                    monthEmployees.length === 0 ? (
                        <div className="flex flex-col items-center gap-2 py-12 text-gray-400">
                            <User className="w-10 h-10" />
                            <p className="text-sm font-medium">Không có dữ liệu</p>
                        </div>
                    ) : (
                        monthEmployees.map(emp => {
                            const empRecords = attendance.filter(a => a.mapped_system_uid === emp.uid);
                            const daySet = new Set(empRecords.map(a => a.date));
                            const totalDays = daySet.size;
                            let totalHours = 0;
                            for (const r of empRecords) {
                                if (r.checkIn) {
                                    const s = calculateAttendanceStatus(r.checkIn, r.checkOut, r.date, settings);
                                    if (s.workHours) totalHours += s.workHours;
                                }
                            }
                            const initials = (n: string) => {
                                const p = n.trim().split(' ').filter(Boolean);
                                return p.length >= 2 ? (p[0][0] + p[p.length - 1][0]).toUpperCase() : n.slice(0, 2).toUpperCase();
                            };
                            return (
                                <div key={emp.uid} className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                                    {/* Employee header — click name opens profile popup on attendance tab */}
                                    <div
                                        className="flex items-center gap-3 px-3 py-2.5 border-b border-gray-100 active:bg-gray-50 transition-colors cursor-pointer"
                                        onClick={() => setPopupEmployee(emp)}
                                    >
                                        <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-primary-400 to-accent-500 flex items-center justify-center text-white font-black text-sm shrink-0 overflow-hidden">
                                            {emp.avatar
                                                // eslint-disable-next-line @next/next/no-img-element
                                                ? <img src={emp.avatar} alt="" className="w-full h-full object-cover" />
                                                : initials(emp.name)
                                            }
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <p className="text-sm font-bold text-gray-900 truncate">{emp.name}</p>
                                        </div>
                                        <div className="flex items-center gap-3 shrink-0">
                                            <div className="text-right">
                                                <p className="text-sm font-black text-primary-700">{totalDays}</p>
                                                <p className="text-[9px] text-gray-400 font-semibold">ngày</p>
                                            </div>
                                            <div className="text-right">
                                                <p className="text-sm font-black text-emerald-700">{fmtHours(totalHours)}</p>
                                                <p className="text-[9px] text-gray-400 font-semibold">giờ</p>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Mini calendar grid */}
                                    <div className="p-2 grid grid-cols-7 gap-1">
                                        {Array.from({ length: monthDays }, (_, i) => i + 1).map(day => {
                                            const d = `${selectedMonth}-${String(day).padStart(2, '0')}`;
                                            const rec = empRecords.find(r => r.date === d);
                                            return <MonthCell key={day} dayNum={day} month={selectedMonth} record={rec} settings={settings} />;
                                        })}
                                    </div>
                                </div>
                            );
                        })
                    )
                )}
            </main>

            {/* Detail bottom sheet */}
            {detailEmployee && (
                <DetailSheet
                    employee={detailEmployee}
                    record={attendanceByUidDate.get(`${detailEmployee.uid}|${detailDate}`) ?? null}
                    settings={settings}
                    date={detailDate}
                    onClose={() => setDetailEmployee(null)}
                />
            )}

            {/* Employee profile popup — opens on month view name tap, pre-selects attendance tab */}
            {popupEmployee && (
                <EmployeeProfilePopup
                    employeeUid={popupEmployee.uid}
                    storeId={popupEmployee.storeId}
                    initialTab="attendance"
                    onClose={() => setPopupEmployee(null)}
                />
            )}
        </div>
    );
}
