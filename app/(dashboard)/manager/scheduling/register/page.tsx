'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { StoreSettings, WeeklyRegistration, StoreDoc } from '@/types';
import { db } from '@/lib/firebase';
import { doc, getDoc, collection, query, where, getDocs } from 'firebase/firestore';
import { getWeekStart, getWeekDays, formatDate, toLocalDateString, cn } from '@/lib/utils';
import {
    ChevronLeft, ChevronRight, Users2, ClipboardList, Building2
} from 'lucide-react';
import { DashboardHeader } from '@/components/inventory/overview/DashboardHeader';

/** Shorten Vietnamese full name to middle + first name */
function shortenName(fullName: string): string {
    const parts = fullName.trim().split(/\s+/);
    if (parts.length <= 2) return fullName;
    return parts.slice(1).join(' ');
}

export default function ManagerRegistrationOverviewPage() {
    const { user, userDoc, hasPermission } = useAuth();

    const [settings, setSettings] = useState<StoreSettings | null>(null);

    // Default to NEXT week (same as employee page)
    const [currentWeekStart, setCurrentWeekStart] = useState<Date>(() => {
        const d = getWeekStart(new Date());
        d.setDate(d.getDate() + 7);
        return d;
    });
    const weekDays = getWeekDays(currentWeekStart);

    const [allRegistrations, setAllRegistrations] = useState<WeeklyRegistration[]>([]);
    const [userNameMap, setUserNameMap] = useState<Map<string, string>>(new Map());
    const [loading, setLoading] = useState(true);

    // ─── Admin store selector (same pattern as overview page) ─────────────────
    const [stores, setStores] = useState<StoreDoc[]>([]);
    const [selectedAdminStoreId, setSelectedAdminStoreId] = useState<string>(() => {
        if (typeof window !== 'undefined') {
            return localStorage.getItem('globalSelectedStoreId') || '';
        }
        return '';
    });

    useEffect(() => {
        if (typeof window !== 'undefined' && selectedAdminStoreId) {
            localStorage.setItem('globalSelectedStoreId', selectedAdminStoreId);
        }
    }, [selectedAdminStoreId]);

    const getToken = useCallback(() => user?.getIdToken(), [user]);

    const isAdmin = userDoc?.role === 'admin' || userDoc?.role === 'super_admin';

    // Fetch stores list for admin
    useEffect(() => {
        if (!isAdmin || !user) return;
        async function fetchStores() {
            try {
                const token = await getToken();
                const res = await fetch('/api/stores', { headers: { 'Authorization': `Bearer ${token}` } });
                const data = await res.json();
                setStores(Array.isArray(data) ? data : []);
            } catch { /* silent */ }
        }
        fetchStores();
    }, [isAdmin, user, getToken]);

    // Effective storeId: admin uses selected store, others use their own
    const effectiveStoreId = isAdmin ? selectedAdminStoreId : (userDoc?.storeId ?? '');

    // ─── Fetch Settings + Registrations + Users ──────────────────────────────
    useEffect(() => {
        if (!user || !effectiveStoreId) {
            setLoading(false);
            return;
        }

        const fetchData = async () => {
            setLoading(true);
            try {
                // 1. Store settings
                const storeSnap = await getDoc(doc(db, 'stores', effectiveStoreId));
                if (storeSnap.exists()) {
                    const storeData = storeSnap.data();
                    setSettings(storeData?.settings ?? { registrationOpen: false, shiftTimes: [] });
                }

                // 2. All registrations for the week
                const weekStr = toLocalDateString(currentWeekStart);
                const allRegsQuery = query(
                    collection(db, 'weekly_registrations'),
                    where('weekStartDate', '==', weekStr),
                    where('storeId', '==', effectiveStoreId)
                );
                const allRegsSnap = await getDocs(allRegsQuery);
                const regs: WeeklyRegistration[] = [];
                allRegsSnap.forEach(d => regs.push(d.data() as WeeklyRegistration));
                setAllRegistrations(regs);

                // 3. Build uid → name map
                const usersQuery = query(collection(db, 'users'), where('storeId', '==', effectiveStoreId));
                const usersSnap = await getDocs(usersQuery);
                const nameMap = new Map<string, string>();
                usersSnap.forEach(d => {
                    const data = d.data();
                    if (data.uid && data.name && data.active !== false) {
                        nameMap.set(data.uid, data.name);
                    }
                });
                setUserNameMap(nameMap);
            } catch (err) {
                console.error('Lỗi khi tải dữ liệu:', err);
            } finally {
                setLoading(false);
            }
        };

        fetchData();
    }, [user, effectiveStoreId, currentWeekStart]);

    // ─── Helpers ──────────────────────────────────────────────────────────────
    const getShiftQuota = (dateStr: string, shiftId: string) => {
        if (!settings?.quotas) return 5;
        if (settings.quotas.specialDates[dateStr]?.[shiftId] !== undefined)
            return settings.quotas.specialDates[dateStr][shiftId];
        const day = new Date(dateStr + 'T00:00:00').getDay();
        const isWeekend = day === 0 || day === 6;
        return isWeekend
            ? (settings.quotas.defaultWeekend[shiftId] ?? 5)
            : (settings.quotas.defaultWeekday[shiftId] ?? 5);
    };

    const getShiftCount = (dateStr: string, shiftId: string) => {
        let count = 0;
        allRegistrations.forEach(reg => {
            if (reg.shifts.some(s => s.date === dateStr && s.shiftId === shiftId)) {
                count++;
            }
        });
        return count;
    };

    const getRegisteredNames = (dateStr: string, shiftId: string): string[] => {
        const names: string[] = [];
        allRegistrations.forEach(reg => {
            if (reg.shifts.some(s => s.date === dateStr && s.shiftId === shiftId)) {
                const name = userNameMap.get(reg.userId);
                if (name) names.push(shortenName(name));
            }
        });
        return names.sort((a, b) => a.localeCompare(b, 'vi'));
    };

    // ─── Week Navigation ─────────────────────────────────────────────────────
    const handlePreviousWeek = () => {
        setCurrentWeekStart(d => {
            const nd = new Date(d);
            nd.setDate(nd.getDate() - 7);
            return nd;
        });
    };
    const handleNextWeek = () => {
        setCurrentWeekStart(d => {
            const nd = new Date(d);
            nd.setDate(nd.getDate() + 7);
            return nd;
        });
    };

    // ─── Access Control ──────────────────────────────────────────────────────
    const canAccess =
        isAdmin ||
        userDoc?.role === 'store_manager' ||
        hasPermission('manage_hr');

    if (!canAccess) {
        return (
            <div className="flex flex-col items-center justify-center h-64 gap-3 text-slate-500">
                <ClipboardList className="w-10 h-10 text-slate-300" />
                <p className="font-medium">Bạn không có quyền xem trang này.</p>
                <p className="text-sm">Yêu cầu quyền <strong>Quản lý Nhân sự</strong> từ quản trị viên.</p>
            </div>
        );
    }

    // Count total registrations for this week
    const totalRegistered = new Set(allRegistrations.map(r => r.userId)).size;
    const totalUsers = userNameMap.size;

    return (
        <div className="space-y-6 mx-auto">
            {/* Admin Store Selector */}
            {isAdmin && (
                <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-3 flex flex-col sm:flex-row items-start sm:items-center gap-3">
                    <div className="flex items-center gap-2 shrink-0">
                        <Building2 className="w-4 h-4 text-indigo-500" />
                        <span className="text-sm font-semibold text-slate-700">Cửa hàng:</span>
                    </div>
                    <select
                        value={selectedAdminStoreId}
                        onChange={e => setSelectedAdminStoreId(e.target.value)}
                        className="flex-1 border border-slate-200 rounded-lg p-2 text-sm outline-none focus:ring-2 focus:ring-indigo-300 bg-slate-50 font-medium"
                    >
                        <option value="">-- Chọn cửa hàng --</option>
                        {stores.map(s => <option key={s.id} value={s.id}>🏪 {s.name}</option>)}
                    </select>
                </div>
            )}

            {/* Prompt admin to select a store */}
            {isAdmin && !effectiveStoreId && (
                <div className="bg-slate-50 border border-slate-200 p-8 rounded-xl text-center">
                    <Building2 className="w-10 h-10 text-slate-300 mx-auto mb-3" />
                    <p className="text-slate-500 font-medium">Vui lòng chọn một cửa hàng để xem đăng ký ca.</p>
                </div>
            )}

            {/* Main content: only show when we have a storeId */}
            {effectiveStoreId && (
                <>
                    {/* Header */}
                    <DashboardHeader
                        showSelect={false}
                        titleChildren={
                            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 w-full">
                                <div>
                                    <h1 className="text-2xl font-bold bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent flex items-center gap-2">
                                        <ClipboardList className="w-7 h-7 text-indigo-600" />
                                        Đăng ký ca làm
                                    </h1>
                                    <p className="text-slate-500 mt-1 text-sm flex items-center gap-2">
                                        Xem nhân viên đã đăng ký ca nào trong tuần.
                                        <span className="bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded text-xs font-bold border border-indigo-200">
                                            {totalRegistered}/{totalUsers} đã đăng ký
                                        </span>
                                    </p>
                                </div>

                                {/* Week Navigation */}
                                <div className="flex items-center justify-center gap-4 bg-white p-2 rounded-xl shadow-sm border border-slate-200 shrink-0">
                                    <button onClick={handlePreviousWeek} className="p-2 hover:bg-slate-100 rounded-lg transition-colors text-slate-600">
                                        <ChevronLeft className="w-5 h-5" />
                                    </button>
                                    <div className="flex-1 text-sm font-semibold text-slate-700 min-w-[140px] text-center">
                                        {formatDate(weekDays[0])} - {formatDate(weekDays[6])}
                                    </div>
                                    <button onClick={handleNextWeek} className="p-2 hover:bg-slate-100 rounded-lg transition-colors text-slate-600">
                                        <ChevronRight className="w-5 h-5" />
                                    </button>
                                </div>
                            </div>
                        }
                    />

                    {loading ? (
                        <div className="flex justify-center items-center h-64">
                            <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
                        </div>
                    ) : (
                        <>
                            {/* Calendar Grid */}
                            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                                <div className="flex flex-col lg:grid lg:grid-cols-7 lg:divide-x divide-slate-100 divide-y lg:divide-y-0">
                                    {weekDays.map((dateStr) => {
                                        const dateObj = new Date(dateStr + 'T00:00:00');
                                        const isToday = new Date().toDateString() === dateObj.toDateString();
                                        const dayName = dateObj.toLocaleDateString('vi-VN', { weekday: 'short' });
                                        const dayNum = dateObj.getDate();
                                        const monthName = dateObj.toLocaleDateString('vi-VN', { month: 'short' });

                                        return (
                                            <div key={dateStr} className="flex flex-col">
                                                {/* Day Header */}
                                                <div className={cn(
                                                    'p-3 flex flex-row lg:flex-col items-center justify-between lg:justify-start border-b border-slate-100',
                                                    isToday ? 'bg-blue-50/50' : 'bg-slate-50/50'
                                                )}>
                                                    <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider">{dayName}</div>
                                                    <div className={cn(
                                                        'font-bold inline-flex items-center justify-center w-8 h-8 lg:w-10 lg:h-10 rounded-full lg:mt-1',
                                                        isToday ? 'bg-blue-600 text-white shadow-md shadow-blue-500/20' : 'text-slate-800'
                                                    )}>
                                                        {dayNum}
                                                    </div>
                                                    <div className="text-xs text-slate-400 lg:mt-0.5">{monthName}</div>
                                                </div>

                                                {/* Shifts */}
                                                <div className="flex-1 p-2 flex flex-col gap-2 bg-white">
                                                    {settings?.shiftTimes.map(shiftId => {
                                                        const currentCount = getShiftCount(dateStr, shiftId);
                                                        const maxCount = getShiftQuota(dateStr, shiftId);
                                                        const names = getRegisteredNames(dateStr, shiftId);
                                                        const isFull = currentCount >= maxCount;

                                                        return (
                                                            <div
                                                                key={shiftId}
                                                                className={cn(
                                                                    'rounded-xl border-2 p-2.5 transition-all',
                                                                    isFull
                                                                        ? 'border-emerald-200 bg-emerald-50/50'
                                                                        : currentCount > 0
                                                                            ? 'border-blue-200 bg-blue-50/30'
                                                                            : 'border-slate-100 bg-slate-50/30'
                                                                )}
                                                            >
                                                                {/* Shift header */}
                                                                <div className="flex items-center justify-between mb-1">
                                                                    <span className="text-xs font-bold text-slate-700">{shiftId}</span>
                                                                    <span className={cn(
                                                                        'text-[10px] font-bold px-1.5 py-0.5 rounded-full',
                                                                        isFull
                                                                            ? 'bg-emerald-100 text-emerald-700'
                                                                            : currentCount > 0
                                                                                ? 'bg-blue-100 text-blue-600'
                                                                                : 'bg-slate-100 text-slate-400'
                                                                    )}>
                                                                        {currentCount}/{maxCount}
                                                                    </span>
                                                                </div>

                                                                {/* Registrant names */}
                                                                {names.length > 0 ? (
                                                                    <div className="space-y-0.5">
                                                                        {names.map((name, idx) => (
                                                                            <div key={idx} className="text-[11px] text-slate-600 font-medium truncate flex items-center gap-1">
                                                                                <span className={cn(
                                                                                    'w-1.5 h-1.5 rounded-full shrink-0',
                                                                                    isFull ? 'bg-emerald-400' : 'bg-blue-400'
                                                                                )} />
                                                                                {name}
                                                                            </div>
                                                                        ))}
                                                                    </div>
                                                                ) : (
                                                                    <p className="text-[10px] text-slate-300 italic">Chưa có ai</p>
                                                                )}
                                                            </div>
                                                        );
                                                    })}

                                                    {settings?.shiftTimes.length === 0 && (
                                                        <div className="text-xs text-slate-400 text-center mt-4">Không có ca</div>
                                                    )}
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>

                            {/* Summary: Who hasn't registered */}
                            {(() => {
                                const registeredUids = new Set(allRegistrations.map(r => r.userId));
                                const unregistered = Array.from(userNameMap.entries())
                                    .filter(([uid]) => !registeredUids.has(uid))
                                    .map(([, name]) => shortenName(name))
                                    .sort((a, b) => a.localeCompare(b, 'vi'));

                                return unregistered.length > 0 ? (
                                    <div className="bg-amber-50/80 border border-amber-200 p-4 rounded-xl">
                                        <div className="flex items-center gap-2 mb-2">
                                            <Users2 className="w-4 h-4 text-amber-600" />
                                            <h3 className="text-sm font-bold text-amber-800">
                                                Chưa đăng ký ({unregistered.length} người)
                                            </h3>
                                        </div>
                                        <div className="flex flex-wrap gap-1.5">
                                            {unregistered.map((name, idx) => (
                                                <span key={idx} className="text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full font-medium border border-amber-200/50">
                                                    {name}
                                                </span>
                                            ))}
                                        </div>
                                    </div>
                                ) : (
                                    <div className="bg-emerald-50/80 border border-emerald-200 p-4 rounded-xl flex items-center gap-2">
                                        <Users2 className="w-4 h-4 text-emerald-600" />
                                        <span className="text-sm font-medium text-emerald-700">Tất cả nhân viên đã đăng ký ca cho tuần này! 🎉</span>
                                    </div>
                                );
                            })()}
                        </>
                    )}
                </>
            )}
        </div>
    );
}
