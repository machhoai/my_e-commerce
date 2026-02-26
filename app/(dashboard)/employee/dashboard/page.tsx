'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { db } from '@/lib/firebase';
import { collection, query, where, onSnapshot, getDocs, doc, getDoc } from 'firebase/firestore';
import { ScheduleDoc, SettingsDoc, StoreDoc } from '@/types';
import { getWeekStart, getWeekDays, formatDate, toLocalDateString, cn } from '@/lib/utils';
import { Calendar as CalendarIcon, Clock, MapPin, ChevronLeft, ChevronRight, Activity, TrendingUp } from 'lucide-react';

export default function EmployeeDashboardPage() {
    const { user, userDoc } = useAuth();
    const [currentWeekStart, setCurrentWeekStart] = useState<Date>(getWeekStart(new Date()));
    const weekDays = getWeekDays(currentWeekStart);

    const [schedules, setSchedules] = useState<ScheduleDoc[]>([]);
    const [monthlySchedules, setMonthlySchedules] = useState<ScheduleDoc[]>([]);
    const [counters, setCounters] = useState<Record<string, string>>({});
    const [settings, setSettings] = useState<SettingsDoc | null>(null);
    const [loading, setLoading] = useState(true);

    // Real-time listener for current user's schedules
    useEffect(() => {
        if (!user) return;

        setLoading(true);

        const fetchCountersAndSettings = async () => {
            if (!userDoc?.storeId) return;
            try {
                // Fetch settings embedded in store doc
                const storeRef = doc(db, 'stores', userDoc.storeId);
                const storeSnap = await getDoc(storeRef);

                if (storeSnap.exists()) {
                    const storeData = storeSnap.data() as StoreDoc;
                    const storeSettings = storeData.settings as SettingsDoc;
                    if (storeSettings) setSettings(storeSettings);

                    // Extract counters from store settings
                    const countersArray = (storeSettings as any)?.counters || [];
                    const map: Record<string, string> = {};
                    countersArray.forEach((counter: any) => {
                        map[counter.id] = counter.name;
                    });
                    setCounters(map);
                }
            } catch (err) {
                console.error("Lỗi khi tải cấu hình:", err);
            }
        };

        fetchCountersAndSettings();

        // 2. Query schedules where this employee is assigned (For current week display)
        const qWeek = query(
            collection(db, 'schedules'),
            where('employeeIds', 'array-contains', user.uid)
        );

        const unsubscribeWeek = onSnapshot(qWeek, (snapshot) => {
            const docs = snapshot.docs.map(d => ({ id: d.id, ...d.data() } as ScheduleDoc));
            setSchedules(docs);
            setLoading(false);
        });

        // 3. Fetch monthly schedules
        const fetchMonthly = async () => {
            const d = new Date();
            const year = d.getFullYear();
            const month = d.getMonth();
            const startOfMonthStr = toLocalDateString(new Date(year, month, 1));
            const endOfMonthStr = toLocalDateString(new Date(year, month + 1, 0));

            const mQuery = query(
                collection(db, 'schedules'),
                where('employeeIds', 'array-contains', user.uid),
                where('date', '>=', startOfMonthStr),
                where('date', '<=', endOfMonthStr)
            );

            const snap = await getDocs(mQuery);
            setMonthlySchedules(snap.docs.map(d => ({ id: d.id, ...d.data() } as ScheduleDoc)));
        };

        fetchMonthly();

        return () => unsubscribeWeek();
    }, [user]);

    const handlePreviousWeek = () => {
        const d = new Date(currentWeekStart);
        d.setDate(d.getDate() - 7);
        setCurrentWeekStart(d);
    };

    const handleNextWeek = () => {
        const d = new Date(currentWeekStart);
        d.setDate(d.getDate() + 7);
        setCurrentWeekStart(d);
    };

    // Group fetched schedules by date for easy rendering
    const schedulesByDate = schedules.reduce((acc, sched) => {
        if (!acc[sched.date]) {
            acc[sched.date] = [];
        }
        acc[sched.date].push(sched);
        return acc;
    }, {} as Record<string, ScheduleDoc[]>);

    const renderMonthlySummary = () => {
        if (!userDoc) return null;

        const todayStr = toLocalDateString(new Date());
        // Only count completed shifts for this month
        const completedShifts = monthlySchedules.filter(s => s.date < todayStr).length;

        // Calculate max shifts
        const d = new Date();
        const daysInMonth = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();

        let maxShifts = 0;
        let isDanger = false;
        let isWarning = false;

        if (userDoc.type === 'FT') {
            const ftDaysOff = settings?.monthlyQuotas?.ftDaysOff ?? 4;
            maxShifts = Math.max(0, daysInMonth - ftDaysOff);
        } else {
            maxShifts = settings?.monthlyQuotas?.ptMaxShifts ?? 25;
        }

        isDanger = completedShifts > maxShifts;
        isWarning = completedShifts === maxShifts || completedShifts === maxShifts - 1;
        const progress = Math.min((completedShifts / Math.max(1, maxShifts)) * 100, 100);

        return (
            <div className="bg-gradient-to-br from-indigo-50 to-blue-50 border border-indigo-100 p-5 rounded-2xl shadow-sm mb-6 flex flex-col md:flex-row md:items-center justify-between gap-6">
                <div>
                    <h3 className="text-sm font-bold text-indigo-900 uppercase tracking-wider mb-1 flex items-center gap-2">
                        <TrendingUp className="w-4 h-4 text-indigo-500" />
                        Tiến độ tháng {d.getMonth() + 1}
                    </h3>
                    <p className="text-xs text-indigo-700/80 font-medium">Chỉ tính các ca đã hoàn thành (hết ngày làm việc).</p>
                </div>

                <div className="flex-1 max-w-md w-full">
                    <div className="flex items-end justify-between mb-2">
                        <div className="flex items-baseline gap-1.5">
                            <span className={cn(
                                "text-3xl font-black w-8 tracking-tighter",
                                isDanger ? "text-red-600" : isWarning ? "text-amber-600" : "text-indigo-600"
                            )}>
                                {completedShifts}
                            </span>
                            <span className="text-sm font-bold text-indigo-400">/</span>
                            <span className="text-sm font-bold text-indigo-900">{maxShifts} ca</span>
                        </div>
                    </div>
                    {/* Progress Bar */}
                    <div className="w-full h-2.5 bg-indigo-100 rounded-full overflow-hidden">
                        <div
                            className={cn(
                                "h-full rounded-full transition-all duration-1000",
                                isDanger ? "bg-red-500" : isWarning ? "bg-amber-400" : "bg-indigo-500"
                            )}
                            style={{ width: `${progress}%` }}
                        />
                    </div>
                </div>
            </div>
        );
    };

    if (loading) {
        return (
            <div className="flex justify-center items-center h-64">
                <div className="flex flex-col items-center gap-3">
                    <div className="w-8 h-8 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin"></div>
                    <span className="text-sm font-medium text-slate-500">Đang đồng bộ lịch trực tuyến...</span>
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-6 w-full h-full min-h-0 mx-auto">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold bg-gradient-to-r from-emerald-500 to-teal-600 bg-clip-text text-transparent flex items-center gap-2">
                        <Activity className="w-7 h-7 text-emerald-500" />
                        Lịch làm việc Trực tuyến
                    </h1>
                    <p className="text-slate-500 mt-1">
                        Quầy và ca làm được phân công sẽ cập nhật theo thời gian thực tại đây.
                    </p>
                </div>

                <div className="flex items-center gap-4 bg-white p-2 rounded-xl shadow-sm border border-slate-200">
                    <button
                        onClick={handlePreviousWeek}
                        className="p-2 hover:bg-slate-100 rounded-lg transition-colors text-slate-600 focus:ring-2 focus:ring-emerald-500/20"
                    >
                        <ChevronLeft className="w-5 h-5" />
                    </button>
                    <div className="text-sm flex-1 font-semibold text-slate-700 min-w-[140px] text-center bg-slate-50 py-1.5 px-3 rounded-md">
                        {formatDate(weekDays[0])} <span className="text-slate-400 font-normal mx-1">đến</span> {formatDate(weekDays[6])}
                    </div>
                    <button
                        onClick={handleNextWeek}
                        className="p-2 hover:bg-slate-100 rounded-lg transition-colors text-slate-600 focus:ring-2 focus:ring-emerald-500/20"
                    >
                        <ChevronRight className="w-5 h-5" />
                    </button>
                </div>
            </div>

            {renderMonthlySummary()}

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {weekDays.map((dateStr) => {
                    const dateObj = new Date(dateStr + "T00:00:00");
                    const isToday = new Date().toDateString() === dateObj.toDateString();
                    const dayName = dateObj.toLocaleDateString('vi-VN', { weekday: 'long' });
                    const formattedDate = dateObj.toLocaleDateString('vi-VN', { month: 'short', day: 'numeric' });

                    const daySchedules = schedulesByDate[dateStr] || [];

                    return (
                        <div
                            key={dateStr}
                            className={`bg-white rounded-2xl border shadow-sm flex flex-col overflow-hidden transition-all duration-300 ${isToday ? 'border-emerald-500 ring-2 ring-emerald-500/20 shadow-emerald-500/10' : 'border-slate-200 hover:border-emerald-300 hover:shadow-md'}`}
                        >
                            {/* Header */}
                            <div className={`p-4 border-b flex items-center justify-between ${isToday ? 'bg-gradient-to-r from-emerald-50 to-teal-50 border-emerald-100' : 'bg-slate-50/50 border-slate-100'}`}>
                                <div className="flex items-center gap-2">
                                    <CalendarIcon className={`w-5 h-5 ${isToday ? 'text-emerald-500' : 'text-slate-400'}`} />
                                    <div>
                                        <h3 className={`font-bold ${isToday ? 'text-emerald-900' : 'text-slate-800'}`}>{dayName}</h3>
                                        <p className={`text-xs font-medium ${isToday ? 'text-emerald-600/80' : 'text-slate-500'}`}>{formattedDate}</p>
                                    </div>
                                </div>
                                {isToday && (
                                    <span className="bg-emerald-500 text-white text-[10px] uppercase font-bold px-2 py-1 rounded-full animate-pulse shadow-sm shadow-emerald-500/20">
                                        Hôm nay
                                    </span>
                                )}
                            </div>

                            {/* Shifts Body */}
                            <div className="p-4 flex-1 flex flex-col gap-3">
                                {daySchedules.length > 0 ? (
                                    daySchedules.map((sched) => (
                                        <div
                                            key={sched.id}
                                            className="group relative bg-white border border-slate-200 rounded-xl p-3 hover:border-emerald-400 hover:shadow-sm transition-all overflow-hidden"
                                        >
                                            <div className="absolute left-0 top-0 bottom-0 w-1 bg-gradient-to-b from-emerald-400 to-teal-500 group-hover:w-1.5 transition-all"></div>

                                            <div className="flex items-start justify-between mb-2 ml-1">
                                                <div className="flex items-center gap-1.5 text-sm font-semibold text-slate-800">
                                                    <Clock className="w-4 h-4 text-emerald-500" />
                                                    {sched.shiftId}
                                                </div>
                                            </div>

                                            <div className="flex items-center gap-1.5 text-sm text-slate-600 bg-slate-50 py-1.5 px-2 rounded-lg ml-1 border border-slate-100 group-hover:bg-emerald-50/50 group-hover:border-emerald-100 group-hover:text-emerald-800 transition-colors">
                                                <MapPin className="w-4 h-4 text-slate-400 group-hover:text-emerald-500 transition-colors" />
                                                <span className="font-medium">{counters[sched.counterId] || sched.counterId}</span>
                                            </div>
                                        </div>
                                    ))
                                ) : (
                                    <div className="h-full flex flex-col items-center justify-center text-slate-400 space-y-2 py-6">
                                        <div className="w-10 h-10 rounded-full bg-slate-50 flex items-center justify-center border border-slate-100">
                                            <Clock className="w-5 h-5 text-slate-300" />
                                        </div>
                                        <span className="text-sm">Không có ca làm việc</span>
                                    </div>
                                )}
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}
