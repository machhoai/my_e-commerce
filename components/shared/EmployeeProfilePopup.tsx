'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import { db } from '@/lib/firebase';
import { collection, query, where, getDocs, doc, getDoc } from 'firebase/firestore';
import { useAuth } from '@/contexts/AuthContext';
import { UserDoc, KpiRecordDoc, ScheduleDoc, SettingsDoc, StoreDoc, CounterDoc } from '@/types';
import { cn, getWeekStart, toLocalDateString } from '@/lib/utils';
import Portal from '@/components/Portal';
import {
    X, User, Award, CalendarDays, Phone, Mail, CreditCard, GraduationCap,
    Briefcase, Building2, ChevronLeft, ChevronRight, CheckCircle2, Clock,
    TrendingUp, TrendingDown, Loader2,
} from 'lucide-react';

interface EmployeeProfilePopupProps {
    employeeUid: string;
    storeId?: string;
    onClose: () => void;
}

type TabKey = 'info' | 'kpi' | 'shifts';

const TABS: { key: TabKey; label: string; icon: React.ReactNode }[] = [
    { key: 'info', label: 'Cá nhân', icon: <User className="w-4 h-4" /> },
    { key: 'kpi', label: 'KPI', icon: <Award className="w-4 h-4" /> },
    { key: 'shifts', label: 'Lịch ca', icon: <CalendarDays className="w-4 h-4" /> },
];

export default function EmployeeProfilePopup({ employeeUid, storeId, onClose }: EmployeeProfilePopupProps) {
    const { user } = useAuth();
    const [activeTab, setActiveTab] = useState<TabKey>('info');
    const [employee, setEmployee] = useState<UserDoc | null>(null);
    const [loadingUser, setLoadingUser] = useState(true);

    // KPI state
    const [kpiMonth, setKpiMonth] = useState(() => {
        const now = new Date();
        return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    });
    const [kpiRecords, setKpiRecords] = useState<KpiRecordDoc[]>([]);
    const [kpiMonthlyAvgs, setKpiMonthlyAvgs] = useState<{ month: string; avg: number; count: number }[]>([]);
    const [loadingKpi, setLoadingKpi] = useState(false);

    // Shifts state
    const [weekStart, setWeekStart] = useState<Date>(getWeekStart(new Date()));
    const [schedules, setSchedules] = useState<ScheduleDoc[]>([]);
    const [settings, setSettings] = useState<SettingsDoc | null>(null);
    const [counters, setCounters] = useState<CounterDoc[]>([]);
    const [loadingShifts, setLoadingShifts] = useState(false);
    const [monthlyShiftCount, setMonthlyShiftCount] = useState(0);

    const getToken = useCallback(() => user?.getIdToken(), [user]);

    // Fetch employee doc
    useEffect(() => {
        async function fetchEmployee() {
            setLoadingUser(true);
            try {
                const snap = await getDoc(doc(db, 'users', employeeUid));
                if (snap.exists()) setEmployee(snap.data() as UserDoc);
            } catch (err) {
                console.error('Failed to fetch employee:', err);
            } finally {
                setLoadingUser(false);
            }
        }
        fetchEmployee();
    }, [employeeUid]);

    // Fetch KPI records for selected month
    useEffect(() => {
        if (activeTab !== 'kpi' || !user || !storeId) return;
        async function fetchKpi() {
            setLoadingKpi(true);
            try {
                const token = await getToken();
                const res = await fetch(
                    `/api/kpi-records?storeId=${storeId}&month=${kpiMonth}&userId=${employeeUid}`,
                    { headers: { Authorization: `Bearer ${token}` } }
                );
                if (res.ok) {
                    const data: KpiRecordDoc[] = await res.json();
                    setKpiRecords(Array.isArray(data) ? data.filter(r => r.userId === employeeUid) : []);
                }
            } catch { /* silent */ } finally {
                setLoadingKpi(false);
            }
        }
        fetchKpi();
    }, [activeTab, kpiMonth, employeeUid, storeId, user, getToken]);

    // Fetch KPI monthly averages (last 6 months)
    useEffect(() => {
        if (activeTab !== 'kpi' || !user || !storeId) return;
        async function fetchMonthlyAvgs() {
            try {
                const token = await getToken();
                const months: { month: string; avg: number; count: number }[] = [];
                const now = new Date();
                for (let i = 0; i < 6; i++) {
                    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
                    const m = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
                    const res = await fetch(
                        `/api/kpi-records?storeId=${storeId}&month=${m}&userId=${employeeUid}`,
                        { headers: { Authorization: `Bearer ${token}` } }
                    );
                    if (res.ok) {
                        const data: KpiRecordDoc[] = await res.json();
                        const empRecs = data.filter(r => r.userId === employeeUid && r.status === 'OFFICIAL');
                        const avg = empRecs.length ? Math.round(empRecs.reduce((s, r) => s + r.officialTotal, 0) / empRecs.length) : 0;
                        months.push({ month: m, avg, count: empRecs.length });
                    }
                }
                setKpiMonthlyAvgs(months);
            } catch { /* silent */ }
        }
        fetchMonthlyAvgs();
    }, [activeTab, employeeUid, storeId, user, getToken]);

    // Fetch schedules for the selected week
    useEffect(() => {
        if (activeTab !== 'shifts' || !storeId) return;
        async function fetchShifts() {
            setLoadingShifts(true);
            try {
                // Fetch store settings (shifts, counters)
                const storeSnap = await getDoc(doc(db, 'stores', storeId!));
                if (storeSnap.exists()) {
                    const storeData = storeSnap.data() as StoreDoc;
                    const storeSettings = storeData.settings as SettingsDoc;
                    setSettings(storeSettings || null);
                    const countersData = (storeSettings as any)?.counters || [];
                    setCounters(countersData);
                }

                // Fetch week schedules
                const days = [];
                for (let i = 0; i < 7; i++) {
                    const d = new Date(weekStart);
                    d.setDate(weekStart.getDate() + i);
                    days.push(d);
                }
                const minDate = toLocalDateString(days[0]);
                const maxDate = toLocalDateString(days[6]);

                const schedulesQuery = query(
                    collection(db, 'schedules'),
                    where('date', '>=', minDate),
                    where('date', '<=', maxDate),
                    where('storeId', '==', storeId),
                );
                const schedulesSnap = await getDocs(schedulesQuery);
                const allSchedules = schedulesSnap.docs.map(d => d.data() as ScheduleDoc);
                // Filter only those that include this employee
                setSchedules(allSchedules.filter(s => s.employeeIds?.includes(employeeUid)));

                // Monthly shift count: count unique date_shift for this month
                const now = new Date();
                const monthStart = toLocalDateString(new Date(now.getFullYear(), now.getMonth(), 1));
                const monthEnd = toLocalDateString(new Date(now.getFullYear(), now.getMonth() + 1, 0));
                const monthQuery = query(
                    collection(db, 'schedules'),
                    where('date', '>=', monthStart),
                    where('date', '<=', monthEnd),
                    where('storeId', '==', storeId),
                );
                const monthSnap = await getDocs(monthQuery);
                const uniqueShifts = new Set<string>();
                const todayStr = toLocalDateString(new Date());
                monthSnap.docs.forEach(d => {
                    const s = d.data() as ScheduleDoc;
                    if (s.date < todayStr && s.employeeIds?.includes(employeeUid)) {
                        uniqueShifts.add(`${s.date}_${s.shiftId}`);
                    }
                });
                setMonthlyShiftCount(uniqueShifts.size);
            } catch (err) {
                console.error('Failed to fetch schedules:', err);
            } finally {
                setLoadingShifts(false);
            }
        }
        fetchShifts();
    }, [activeTab, weekStart, employeeUid, storeId]);

    const weekDays = useMemo(() => {
        const days: Date[] = [];
        for (let i = 0; i < 7; i++) {
            const d = new Date(weekStart);
            d.setDate(weekStart.getDate() + i);
            days.push(d);
        }
        return days;
    }, [weekStart]);

    const shifts: string[] = settings?.shiftTimes ?? ['Sáng', 'Chiều', 'Tối'];

    const formatDate = (dateStr: string) => {
        try {
            const [y, m, d] = dateStr.split('-');
            return `${d}/${m}`;
        } catch { return dateStr; }
    };

    const formatMonthLabel = (m: string) => {
        const [y, mo] = m.split('-');
        return `T${mo}/${y}`;
    };

    // Personal info items
    const infoItems = employee ? [
        { icon: <Phone className="w-4 h-4" />, label: 'Số điện thoại', value: employee.phone },
        { icon: <Mail className="w-4 h-4" />, label: 'Email', value: employee.email || '—' },
        { icon: <CalendarDays className="w-4 h-4" />, label: 'Ngày sinh', value: employee.dob ? formatDate(employee.dob) : '—' },
        { icon: <Briefcase className="w-4 h-4" />, label: 'Chức danh', value: employee.jobTitle || '—' },
        { icon: <CreditCard className="w-4 h-4" />, label: 'CCCD', value: employee.idCard || '—' },
        { icon: <Building2 className="w-4 h-4" />, label: 'Ngân hàng', value: employee.bankAccount || '—' },
        { icon: <GraduationCap className="w-4 h-4" />, label: 'Học vấn', value: employee.education || '—' },
    ] : [];

    return (
        <Portal>
            <div className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-surface-900/50 backdrop-blur-sm" onClick={onClose}>
                <div
                    className="bg-white rounded-2xl h-full shadow-2xl w-full max-w-xl max-h-[85vh] overflow-hidden animate-in zoom-in-95 duration-200 flex flex-col"
                    onClick={e => e.stopPropagation()}
                >
                    {/* Header */}
                    <div className="p-5 border-b border-surface-100 bg-gradient-to-r from-primary-50 to-accent-50">
                        {loadingUser ? (
                            <div className="flex items-center gap-3">
                                <div className="w-12 h-12 rounded-full bg-surface-200 animate-pulse" />
                                <div className="flex-1 space-y-2">
                                    <div className="h-5 w-40 bg-surface-200 rounded animate-pulse" />
                                    <div className="h-3 w-24 bg-surface-200 rounded animate-pulse" />
                                </div>
                            </div>
                        ) : employee ? (
                            <div className="flex items-center gap-3">
                                <div className="w-12 h-12 rounded-full bg-gradient-to-br from-primary-500 to-accent-500 flex items-center justify-center text-white font-bold text-lg shadow-lg">
                                    {employee.name.charAt(0)}
                                </div>
                                <div className="flex-1 min-w-0">
                                    <h3 className="text-lg font-bold text-surface-900 truncate">{employee.name}</h3>
                                    <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                                        <span className={cn(
                                            'px-2 py-0.5 text-[10px] font-bold uppercase rounded-md border',
                                            employee.type === 'FT' ? 'bg-primary-50 text-primary-700 border-primary-200' : 'bg-accent-50 text-accent-700 border-accent-200'
                                        )}>
                                            {employee.type === 'FT' ? 'Full-time' : 'Part-time'}
                                        </span>
                                        <span className="px-2 py-0.5 text-[10px] font-bold uppercase rounded-md bg-surface-100 text-surface-600 border border-surface-200">
                                            {employee.role === 'store_manager' ? 'CH Trưởng' : employee.role === 'manager' ? 'Quản lý' : 'Nhân viên'}
                                        </span>
                                        {employee.isActive === false && (
                                            <span className="px-2 py-0.5 text-[10px] font-bold uppercase rounded-md bg-danger-100 text-danger-600 border border-danger-200">
                                                Vô hiệu
                                            </span>
                                        )}
                                    </div>
                                </div>
                                <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-white/60 transition-colors shrink-0">
                                    <X className="w-5 h-5 text-surface-500" />
                                </button>
                            </div>
                        ) : (
                            <div className="flex items-center justify-between">
                                <p className="text-danger-500 text-sm font-medium">Không tìm thấy nhân viên.</p>
                                <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-white/60 transition-colors">
                                    <X className="w-5 h-5 text-surface-500" />
                                </button>
                            </div>
                        )}
                    </div>

                    {/* Tabs */}
                    <div className="flex border-b border-surface-200 px-2 bg-surface-50/50">
                        {TABS.map(tab => (
                            <button
                                key={tab.key}
                                onClick={() => setActiveTab(tab.key)}
                                className={cn(
                                    'flex items-center gap-1.5 px-4 py-2.5 text-sm font-semibold transition-all border-b-2 -mb-px',
                                    activeTab === tab.key
                                        ? 'text-primary-700 border-primary-500'
                                        : 'text-surface-500 border-transparent hover:text-surface-700 hover:border-surface-300'
                                )}
                            >
                                {tab.icon}
                                {tab.label}
                            </button>
                        ))}
                    </div>

                    {/* Content */}
                    <div className="flex-1 overflow-y-auto p-5">
                        {activeTab === 'info' && (
                            <div className="space-y-3">
                                {infoItems.map((item, i) => (
                                    <div key={i} className="flex items-center gap-3 p-3 rounded-xl bg-surface-50 border border-surface-100">
                                        <div className="w-8 h-8 rounded-lg bg-white flex items-center justify-center text-primary-500 shadow-sm border border-surface-100">
                                            {item.icon}
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <p className="text-[11px] text-surface-400 font-medium uppercase tracking-wider">{item.label}</p>
                                            <p className="text-sm font-semibold text-surface-800 truncate">{item.value}</p>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}

                        {activeTab === 'kpi' && (
                            <div className="space-y-5">
                                {/* Monthly averages chart */}
                                {kpiMonthlyAvgs.length > 0 && (
                                    <div>
                                        <h4 className="text-xs font-bold text-surface-500 uppercase tracking-wider mb-3">Trung bình KPI 6 tháng</h4>
                                        <div className="flex items-end gap-2 h-28">
                                            {[...kpiMonthlyAvgs].reverse().map(m => {
                                                const maxH = 96; // px
                                                const h = m.avg > 0 ? Math.max((m.avg / 100) * maxH, 8) : 4;
                                                return (
                                                    <div key={m.month} className="flex-1 flex flex-col items-center gap-1">
                                                        <span className={cn(
                                                            'text-[10px] font-bold',
                                                            m.avg >= 80 ? 'text-success-600' : m.avg >= 50 ? 'text-warning-600' : m.avg > 0 ? 'text-danger-600' : 'text-surface-300'
                                                        )}>
                                                            {m.avg || '—'}
                                                        </span>
                                                        <div
                                                            className={cn(
                                                                'w-full rounded-t-md transition-all',
                                                                m.avg >= 80 ? 'bg-success-400' : m.avg >= 50 ? 'bg-warning-400' : m.avg > 0 ? 'bg-danger-400' : 'bg-surface-200'
                                                            )}
                                                            style={{ height: `${h}px` }}
                                                        />
                                                        <span className="text-[9px] text-surface-400 font-medium">{formatMonthLabel(m.month)}</span>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </div>
                                )}

                                {/* Month picker + records */}
                                <div>
                                    <div className="flex items-center justify-between mb-3">
                                        <h4 className="text-xs font-bold text-surface-500 uppercase tracking-wider">Lịch sử KPI</h4>
                                        <input
                                            type="month"
                                            value={kpiMonth}
                                            onChange={e => setKpiMonth(e.target.value)}
                                            className="border border-surface-200 rounded-lg px-2 py-1 text-xs outline-none focus:ring-2 focus:ring-primary-300 font-medium"
                                        />
                                    </div>

                                    {loadingKpi ? (
                                        <div className="flex justify-center py-8">
                                            <Loader2 className="w-6 h-6 text-primary-500 animate-spin" />
                                        </div>
                                    ) : kpiRecords.length === 0 ? (
                                        <p className="text-sm text-surface-400 text-center py-6 bg-surface-50 rounded-xl border border-dashed border-surface-200">
                                            Không có dữ liệu KPI tháng này.
                                        </p>
                                    ) : (
                                        <div className="space-y-1.5 max-h-[280px] overflow-y-auto">
                                            {kpiRecords
                                                .sort((a, b) => b.date.localeCompare(a.date))
                                                .map(rec => (
                                                    <div key={rec.id} className="flex items-center gap-3 px-3 py-2 bg-surface-50 rounded-lg border border-surface-100 text-xs">
                                                        {rec.status === 'OFFICIAL' ? (
                                                            <CheckCircle2 className="w-4 h-4 text-success-500 shrink-0" />
                                                        ) : (
                                                            <Clock className="w-4 h-4 text-warning-500 shrink-0" />
                                                        )}
                                                        <span className="font-semibold text-surface-700 min-w-[45px]">
                                                            {formatDate(rec.date)}
                                                        </span>
                                                        <span className="px-1.5 py-0.5 bg-accent-50 text-accent-600 rounded font-medium truncate max-w-[60px]">
                                                            {rec.shiftId}
                                                        </span>
                                                        <div className="flex items-center gap-1 ml-auto">
                                                            <span className="text-surface-400">Tự:</span>
                                                            <span className={cn('font-bold', rec.selfTotal >= 80 ? 'text-success-600' : rec.selfTotal >= 50 ? 'text-warning-600' : 'text-danger-600')}>
                                                                {rec.selfTotal}
                                                            </span>
                                                        </div>
                                                        <div className="flex items-center gap-1">
                                                            <span className="text-surface-400">CT:</span>
                                                            {rec.status === 'OFFICIAL' ? (
                                                                <span className={cn('font-bold', rec.officialTotal >= 80 ? 'text-success-600' : rec.officialTotal >= 50 ? 'text-warning-600' : 'text-danger-600')}>
                                                                    {rec.officialTotal}
                                                                </span>
                                                            ) : (
                                                                <span className="text-surface-300">—</span>
                                                            )}
                                                        </div>
                                                        <span className={cn(
                                                            'px-1.5 py-0.5 rounded text-[10px] font-bold uppercase shrink-0',
                                                            rec.status === 'OFFICIAL' ? 'bg-success-100 text-success-700' : 'bg-warning-100 text-warning-700'
                                                        )}>
                                                            {rec.status === 'OFFICIAL' ? 'CT' : 'TC'}
                                                        </span>
                                                    </div>
                                                ))}
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}

                        {activeTab === 'shifts' && (
                            <div className="space-y-4">
                                {/* Monthly summary */}
                                <div className="flex items-center gap-3 p-3 rounded-xl bg-gradient-to-r from-accent-50 to-primary-50 border border-accent-100">
                                    <div className="w-10 h-10 rounded-lg bg-white flex items-center justify-center shadow-sm border border-accent-100">
                                        <CalendarDays className="w-5 h-5 text-accent-600" />
                                    </div>
                                    <div>
                                        <p className="text-[11px] text-accent-600 font-medium uppercase tracking-wider">Tổng ca tháng này</p>
                                        <p className="text-2xl font-black text-accent-800">{monthlyShiftCount}</p>
                                    </div>
                                </div>

                                {/* Week picker */}
                                <div className="flex items-center justify-between">
                                    <h4 className="text-xs font-bold text-surface-500 uppercase tracking-wider">Lịch làm tuần</h4>
                                    <div className="flex items-center gap-1.5">
                                        <button
                                            onClick={() => {
                                                const d = new Date(weekStart);
                                                d.setDate(d.getDate() - 7);
                                                setWeekStart(d);
                                            }}
                                            className="p-1 hover:bg-surface-100 rounded-md transition-colors"
                                        >
                                            <ChevronLeft className="w-4 h-4 text-surface-500" />
                                        </button>
                                        <span className="text-xs font-semibold text-surface-700 min-w-[130px] text-center">
                                            {weekDays.length > 0 && `${formatDate(toLocalDateString(weekDays[0]))} — ${formatDate(toLocalDateString(weekDays[6]))}`}
                                        </span>
                                        <button
                                            onClick={() => {
                                                const d = new Date(weekStart);
                                                d.setDate(d.getDate() + 7);
                                                setWeekStart(d);
                                            }}
                                            className="p-1 hover:bg-surface-100 rounded-md transition-colors"
                                        >
                                            <ChevronRight className="w-4 h-4 text-surface-500" />
                                        </button>
                                    </div>
                                </div>

                                {/* Weekly schedule table */}
                                {loadingShifts ? (
                                    <div className="flex justify-center py-8">
                                        <Loader2 className="w-6 h-6 text-primary-500 animate-spin" />
                                    </div>
                                ) : (
                                    <div className="overflow-x-auto rounded-xl border border-surface-200">
                                        <table className="w-full text-xs text-left border-collapse">
                                            <thead>
                                                <tr className="bg-surface-50">
                                                    <th className="p-2 border-b border-r border-surface-200 font-bold text-surface-600 text-center min-w-[50px]">Ca</th>
                                                    {weekDays.map((date, i) => {
                                                        const isToday = toLocalDateString(new Date()) === toLocalDateString(date);
                                                        return (
                                                            <th key={i} className={cn(
                                                                'p-2 border-b border-surface-200 font-semibold text-center min-w-[55px]',
                                                                isToday ? 'bg-primary-50 text-primary-700' : 'text-surface-600'
                                                            )}>
                                                                <div className="text-[10px] uppercase opacity-70">
                                                                    {date.toLocaleDateString('vi-VN', { weekday: 'short' })}
                                                                </div>
                                                                <div>{formatDate(toLocalDateString(date))}</div>
                                                            </th>
                                                        );
                                                    })}
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {shifts.map(shift => (
                                                    <tr key={shift}>
                                                        <td className="p-2 border-b border-r border-surface-200 font-bold text-surface-700 text-center bg-surface-50/50">
                                                            {shift}
                                                        </td>
                                                        {weekDays.map((date, dayIdx) => {
                                                            const dateStr = toLocalDateString(date);
                                                            const isToday = toLocalDateString(new Date()) === dateStr;
                                                            const matchingSchedules = schedules.filter(
                                                                s => s.date === dateStr && s.shiftId === shift
                                                            );
                                                            const counterNames = matchingSchedules
                                                                .map(s => {
                                                                    const c = counters.find(ct => ct.id === s.counterId);
                                                                    return c?.name || 'Đã phân';
                                                                });
                                                            return (
                                                                <td key={dayIdx} className={cn(
                                                                    'p-1.5 border-b border-surface-100 text-center align-middle',
                                                                    isToday ? 'bg-primary-50/30' : ''
                                                                )}>
                                                                    {counterNames.length > 0 ? (
                                                                        <div className="space-y-0.5">
                                                                            {counterNames.map((name, ci) => (
                                                                                <span
                                                                                    key={ci}
                                                                                    className="block px-1 py-0.5 text-[10px] font-semibold bg-accent-50 text-accent-700 rounded border border-accent-100 truncate"
                                                                                >
                                                                                    {name}
                                                                                </span>
                                                                            ))}
                                                                        </div>
                                                                    ) : (
                                                                        <span className="text-surface-300 text-[10px]">—</span>
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
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </Portal>
    );
}
