'use client';

import { useState, useEffect } from 'react';
import { db } from '@/lib/firebase';
import { collection, query, where, getDocs, doc, getDoc } from 'firebase/firestore';
import { UserDoc, ScheduleDoc, SettingsDoc } from '@/types';
import { toLocalDateString, cn } from '@/lib/utils';
import { useAuth } from '@/contexts/AuthContext';
import { History, ChevronLeft, ChevronRight, AlertTriangle, CheckCircle2, Search, ArrowUpDown } from 'lucide-react';

interface EmployeeStats {
    uid: string;
    name: string;
    type: string;
    role: string;
    totalShifts: number;
    maxShifts: number;
}

export default function ManagerHistoryPage() {
    const { user, userDoc } = useAuth();

    // Controls
    const [currentMonth, setCurrentMonth] = useState<Date>(() => {
        const d = new Date();
        d.setDate(1); // Start of current month
        d.setHours(0, 0, 0, 0);
        return d;
    });

    // Data State
    const [stats, setStats] = useState<EmployeeStats[]>([]);
    const [settings, setSettings] = useState<SettingsDoc | null>(null);

    // UI State
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [searchTerm, setSearchTerm] = useState('');
    const [sortField, setSortField] = useState<'name' | 'totalShifts'>('name');
    const [sortAsc, setSortAsc] = useState(true);

    useEffect(() => {
        if (!user) return;

        async function fetchHistory() {
            setLoading(true);
            setError('');
            try {
                // 1. Get Settings for Max Shifts
                const settingsRef = doc(db, 'settings', 'global');
                const settingsSnap = await getDoc(settingsRef);
                const settingsData = settingsSnap.exists() ? (settingsSnap.data() as SettingsDoc) : null;
                setSettings(settingsData);

                const ftDaysOff = settingsData?.monthlyQuotas?.ftDaysOff ?? 4;
                const maxPT = settingsData?.monthlyQuotas?.ptMaxShifts ?? 25;
                const minPT = settingsData?.monthlyQuotas?.ptMinShifts ?? 10;

                // Calculate max FT based on days in the month
                const year = currentMonth.getFullYear();
                const month = currentMonth.getMonth();
                const daysInMonth = new Date(year, month + 1, 0).getDate();
                const maxFT = Math.max(0, daysInMonth - ftDaysOff);

                // 2. Fetch all users to map names and types
                const usersRef = collection(db, 'users');
                const usersSnap = await getDocs(usersRef);
                const userMap = new Map<string, UserDoc>();
                usersSnap.docs.forEach(d => {
                    const u = d.data() as UserDoc;
                    userMap.set(u.uid, u);
                });

                // 3. Fetch Schedules for the selected month
                const startOfMonthStr = toLocalDateString(new Date(year, month, 1));
                const endOfMonthStr = toLocalDateString(new Date(year, month, daysInMonth));

                const schedulesRef = collection(db, 'schedules');
                const q = query(
                    schedulesRef,
                    where('date', '>=', startOfMonthStr),
                    where('date', '<=', endOfMonthStr)
                );
                const schedulesSnap = await getDocs(q);

                // 4. Aggregate "Completed" Shifts per User
                const todayStr = toLocalDateString(new Date());
                const shiftCounts = new Map<string, number>();

                schedulesSnap.docs.forEach(d => {
                    const schedule = d.data() as ScheduleDoc;
                    // ONLY count if the schedule date is in the past (before today)
                    if (schedule.date < todayStr) {
                        schedule.employeeIds.forEach(uid => {
                            shiftCounts.set(uid, (shiftCounts.get(uid) || 0) + 1);
                        });
                    }
                });

                // 5. Build Final Stats Array
                const finalStats: EmployeeStats[] = [];
                userMap.forEach((u, uid) => {
                    if (u.role === 'admin') return;

                    const count = shiftCounts.get(uid) || 0;

                    finalStats.push({
                        uid,
                        name: u.name,
                        type: u.type,
                        role: u.role,
                        totalShifts: count,
                        maxShifts: u.type === 'FT' ? maxFT : maxPT
                    });
                });

                setStats(finalStats);
            } catch (err) {
                console.error(err);
                setError('Không thể tải lịch sử và thống kê ca làm. Vui lòng thử lại.');
            } finally {
                setLoading(false);
            }
        }

        fetchHistory();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [user, currentMonth]);

    const handlePreviousMonth = () => {
        const d = new Date(currentMonth);
        d.setMonth(d.getMonth() - 1);
        setCurrentMonth(d);
    };

    const handleNextMonth = () => {
        const d = new Date(currentMonth);
        d.setMonth(d.getMonth() + 1);
        setCurrentMonth(d);
    };

    const toggleSort = (field: 'name' | 'totalShifts') => {
        if (sortField === field) {
            setSortAsc(!sortAsc);
        } else {
            setSortField(field);
            setSortAsc(true);
        }
    };

    const filteredAndSortedStats = stats
        .filter(s => s.name.toLowerCase().includes(searchTerm.toLowerCase()))
        .sort((a, b) => {
            if (sortField === 'name') {
                return sortAsc ? a.name.localeCompare(b.name) : b.name.localeCompare(a.name);
            } else {
                return sortAsc ? a.totalShifts - b.totalShifts : b.totalShifts - a.totalShifts;
            }
        });

    // Don't show to non-managers
    if (userDoc && !['admin', 'manager'].includes(userDoc.role)) {
        return <div className="p-8 text-center text-red-500">Bạn không có quyền truy cập trang này.</div>;
    }

    return (
        <div className="space-y-6 max-w-6xl mx-auto">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent flex items-center gap-2">
                        <History className="w-7 h-7 text-blue-600" />
                        Lịch sử & Thống kê Ca làm
                    </h1>
                    <p className="text-slate-500 mt-1">
                        Xem tổng số ca <strong>đã hoàn thành</strong> của nhân viên trong tháng để đối chiếu tính lương.
                    </p>
                </div>

                <div className="flex items-center gap-2 bg-white p-2 rounded-xl shadow-sm border border-slate-200">
                    <button
                        onClick={handlePreviousMonth}
                        className="p-1.5 hover:bg-slate-100 rounded-lg transition-colors text-slate-600"
                    >
                        <ChevronLeft className="w-5 h-5" />
                    </button>
                    <div className="text-sm font-semibold text-slate-700 min-w-[140px] text-center capitalize">
                        Tháng {currentMonth.getMonth() + 1}/{currentMonth.getFullYear()}
                    </div>
                    <button
                        onClick={handleNextMonth}
                        className="p-1.5 hover:bg-slate-100 rounded-lg transition-colors text-slate-600"
                    >
                        <ChevronRight className="w-5 h-5" />
                    </button>
                </div>
            </div>

            {error && (
                <div className="bg-red-50 text-red-600 p-4 rounded-xl text-sm font-medium border border-red-100">
                    {error}
                </div>
            )}

            {/* Main Content */}
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                <div className="p-4 border-b border-slate-100 bg-slate-50/50 flex flex-col sm:flex-row gap-4 items-center justify-between">
                    <div className="relative w-full sm:max-w-xs">
                        <Search className="w-5 h-5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                        <input
                            type="text"
                            placeholder="Tìm nhân viên..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="pl-10 pr-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 block w-full outline-none transition-all shadow-sm"
                        />
                    </div>

                    <div className="flex items-center gap-3 text-sm text-slate-500">
                        <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-full bg-emerald-100 border border-emerald-300"></span> An toàn</span>
                        <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-full bg-amber-100 border border-amber-300"></span> Cận mức</span>
                        <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-full bg-red-100 border border-red-300"></span> Vượt mức</span>
                    </div>
                </div>

                <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm text-slate-600">
                        <thead className="bg-slate-50 text-slate-500 uppercase text-xs border-b border-slate-200">
                            <tr>
                                <th className="px-6 py-4 font-semibold cursor-pointer hover:bg-slate-100 transition-colors" onClick={() => toggleSort('name')}>
                                    <div className="flex items-center gap-2">
                                        Nhân viên <ArrowUpDown className="w-3.5 h-3.5 text-slate-400" />
                                    </div>
                                </th>
                                <th className="px-6 py-4 font-semibold">Loại</th>
                                <th className="px-6 py-4 font-semibold cursor-pointer hover:bg-slate-100 transition-colors" onClick={() => toggleSort('totalShifts')}>
                                    <div className="flex items-center gap-2">
                                        Ca đã hoàn thành / Tối đa <ArrowUpDown className="w-3.5 h-3.5 text-slate-400" />
                                    </div>
                                </th>
                                <th className="px-6 py-4 font-semibold text-right">Trạng thái</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {loading ? (
                                <tr>
                                    <td colSpan={4} className="px-6 py-12 text-center text-slate-500">
                                        <div className="flex justify-center mb-2">
                                            <div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
                                        </div>
                                        Đang tải dữ liệu...
                                    </td>
                                </tr>
                            ) : filteredAndSortedStats.length === 0 ? (
                                <tr>
                                    <td colSpan={4} className="px-6 py-12 text-center text-slate-500">
                                        Không tìm thấy nhân viên nào.
                                    </td>
                                </tr>
                            ) : (
                                filteredAndSortedStats.map((stat) => {
                                    const isWarning = stat.totalShifts === stat.maxShifts || stat.totalShifts === stat.maxShifts - 1;
                                    const isDanger = stat.totalShifts > stat.maxShifts;
                                    const isSafe = stat.totalShifts < stat.maxShifts - 1;

                                    return (
                                        <tr key={stat.uid} className={cn(
                                            "hover:bg-slate-50 transition-colors",
                                            isDanger ? "bg-red-50/30" : isWarning ? "bg-amber-50/30" : ""
                                        )}>
                                            <td className="px-6 py-4 font-medium text-slate-800">
                                                {stat.name}
                                                {stat.role === 'manager' && <span className="ml-2 text-[10px] bg-indigo-100 text-indigo-700 px-1.5 py-0.5 rounded font-bold uppercase">Quản lý</span>}
                                            </td>
                                            <td className="px-6 py-4">
                                                <span className={cn(
                                                    "px-2 py-1 rounded-md text-xs font-bold border",
                                                    stat.type === 'FT' ? "bg-purple-50 text-purple-700 border-purple-200" : "bg-teal-50 text-teal-700 border-teal-200"
                                                )}>
                                                    {stat.type}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4">
                                                <div className="flex items-center gap-2">
                                                    <span className={cn(
                                                        "text-lg font-bold",
                                                        isDanger ? "text-red-600" : isWarning ? "text-amber-600" : "text-slate-800"
                                                    )}>
                                                        {stat.totalShifts}
                                                    </span>
                                                    <span className="text-slate-400">/</span>
                                                    <span className="text-slate-500 font-medium">{stat.maxShifts} ca</span>
                                                </div>
                                                {/* Visual Bar */}
                                                <div className="w-full max-w-[150px] h-1.5 bg-slate-100 rounded-full mt-2 overflow-hidden">
                                                    <div
                                                        className={cn(
                                                            "h-full rounded-full transition-all duration-500",
                                                            isDanger ? "bg-red-500" : isWarning ? "bg-amber-400" : "bg-emerald-400"
                                                        )}
                                                        style={{ width: `${Math.min((stat.totalShifts / stat.maxShifts) * 100, 100)}%` }}
                                                    />
                                                </div>
                                            </td>
                                            <td className="px-6 py-4 text-right">
                                                {isDanger ? (
                                                    <span className="inline-flex items-center gap-1.5 text-red-700 bg-red-100 px-2.5 py-1 rounded-lg text-xs font-bold border border-red-200">
                                                        <AlertTriangle className="w-3.5 h-3.5" /> Thừa ca
                                                    </span>
                                                ) : isWarning ? (
                                                    <span className="inline-flex items-center gap-1.5 text-amber-700 bg-amber-100 px-2.5 py-1 rounded-lg text-xs font-bold border border-amber-200">
                                                        <AlertTriangle className="w-3.5 h-3.5" /> Sắp hết Quota
                                                    </span>
                                                ) : (
                                                    <span className="inline-flex items-center gap-1.5 text-emerald-700 bg-emerald-100 px-2.5 py-1 rounded-lg text-xs font-bold border border-emerald-200">
                                                        <CheckCircle2 className="w-3.5 h-3.5" /> An toàn
                                                    </span>
                                                )}
                                            </td>
                                        </tr>
                                    );
                                })
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}
