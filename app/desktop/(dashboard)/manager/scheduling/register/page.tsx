'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { StoreSettings, WeeklyRegistration, StoreDoc, UserRole, EmployeeType } from '@/types';
import { db } from '@/lib/firebase';
import { doc, getDoc, collection, query, where, getDocs } from 'firebase/firestore';
import { getWeekStart, getWeekDays, formatDate, toLocalDateString, cn } from '@/lib/utils';
import {
    ChevronLeft, ChevronRight, Users2, ClipboardList, Building2
} from 'lucide-react';
import { DashboardHeader } from '@/components/inventory/overview/DashboardHeader';

/** Shorten Vietnamese full name to middle + first name (e.g. "Nguyễn Văn An" → "Văn An") */
function shortenName(fullName: string): string {
    const parts = fullName.trim().split(/\s+/);
    if (parts.length <= 2) return fullName;
    return parts.slice(1).join(' ');
}

interface UserInfo { name: string; role: UserRole; type: EmployeeType; }

/** Get display color classes based on role/type */
function getRoleColor(info: UserInfo): string {
    if (info.role === 'store_manager') return 'text-danger-600';
    if (info.role === 'manager') return 'text-warning-600';
    if (info.type === 'FT') return 'text-primary-600';
    return 'text-success-600'; // PT
}

function getRoleDotColor(info: UserInfo): string {
    if (info.role === 'store_manager') return 'bg-danger-500';
    if (info.role === 'manager') return 'bg-warning-500';
    if (info.type === 'FT') return 'bg-primary-500';
    return 'bg-success-500';
}

function getRoleBadgeColor(info: UserInfo): string {
    if (info.role === 'store_manager') return 'bg-danger-100 text-danger-700 border-danger-200/50';
    if (info.role === 'manager') return 'bg-warning-100 text-warning-700 border-warning-200/50';
    if (info.type === 'FT') return 'bg-primary-100 text-primary-700 border-primary-200/50';
    return 'bg-success-100 text-success-700 border-success-200/50';
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
    const [userInfoMap, setUserInfoMap] = useState<Map<string, UserInfo>>(new Map());
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

                // 3. Build uid → user info map (active users only)
                const usersQuery = query(collection(db, 'users'), where('storeId', '==', effectiveStoreId));
                const usersSnap = await getDocs(usersQuery);
                const infoMap = new Map<string, UserInfo>();
                usersSnap.forEach(d => {
                    const data = d.data();
                    console.log(data);
                    if (data.uid && data.name && data.isActive !== false && data.role !== 'admin' && data.role !== 'super_admin') {
                        infoMap.set(data.uid, { name: data.name, role: data.role, type: data.type ?? 'PT' });
                    }
                });
                setUserInfoMap(infoMap);
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

    const getRegisteredUsers = (dateStr: string, shiftId: string): { name: string; info: UserInfo }[] => {
        const result: { name: string; info: UserInfo }[] = [];
        allRegistrations.forEach(reg => {
            if (reg.shifts.some(s => s.date === dateStr && s.shiftId === shiftId)) {
                const info = userInfoMap.get(reg.userId);
                if (info) result.push({ name: shortenName(info.name), info });
            }
        });
        // Sort: store_manager first, then manager, then employees
        const roleOrder: Record<string, number> = { store_manager: 0, manager: 1 };
        return result.sort((a, b) => {
            const oa = roleOrder[a.info.role] ?? 2;
            const ob = roleOrder[b.info.role] ?? 2;
            if (oa !== ob) return oa - ob;
            return a.name.localeCompare(b.name, 'vi');
        });
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
        userDoc?.role === 'manager' ||
        hasPermission('page.scheduling.register');

    if (!canAccess) {
        return (
            <div className="flex flex-col items-center justify-center h-64 gap-3 text-surface-500">
                <ClipboardList className="w-10 h-10 text-surface-300" />
                <p className="font-medium">Bạn không có quyền xem trang này.</p>
                <p className="text-sm">Yêu cầu quyền <strong>Quản lý Nhân sự</strong> từ quản trị viên.</p>
            </div>
        );
    }

    // Count total registrations for this week
    const totalRegistered = new Set(allRegistrations.map(r => r.userId)).size;
    const totalUsers = userInfoMap.size;

    return (
        <div className="space-y-6 mx-auto">
            {/* Admin Store Selector */}
            {isAdmin && (
                <div className="bg-white rounded-xl border border-surface-200 shadow-sm p-3 flex flex-col sm:flex-row items-start sm:items-center gap-3">
                    <div className="flex items-center gap-2 shrink-0">
                        <Building2 className="w-4 h-4 text-accent-500" />
                        <span className="text-sm font-semibold text-surface-700">Cửa hàng:</span>
                    </div>
                    <select
                        value={selectedAdminStoreId}
                        onChange={e => setSelectedAdminStoreId(e.target.value)}
                        className="flex-1 border border-surface-200 rounded-lg p-2 text-sm outline-none focus:ring-2 focus:ring-accent-300 bg-surface-50 font-medium"
                    >
                        <option value="">-- Chọn cửa hàng --</option>
                        {stores.map(s => <option key={s.id} value={s.id}>🏪 {s.name}</option>)}
                    </select>
                </div>
            )}

            {/* Prompt admin to select a store */}
            {isAdmin && !effectiveStoreId && (
                <div className="bg-surface-50 border border-surface-200 p-8 rounded-xl text-center">
                    <Building2 className="w-10 h-10 text-surface-300 mx-auto mb-3" />
                    <p className="text-surface-500 font-medium">Vui lòng chọn một cửa hàng để xem đăng ký ca.</p>
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
                                    <h1 className="text-2xl font-bold bg-gradient-to-r from-accent-600 to-accent-600 bg-clip-text text-transparent flex items-center gap-2">
                                        <ClipboardList className="w-7 h-7 text-accent-600" />
                                        Đăng ký ca làm
                                    </h1>
                                    <p className="text-surface-500 mt-1 text-sm flex items-center gap-2">
                                        Xem nhân viên đã đăng ký ca nào trong tuần.
                                        <span className="bg-accent-50 text-accent-700 px-2 py-0.5 rounded text-xs font-bold border border-accent-200">
                                            {totalRegistered}/{totalUsers} đã đăng ký
                                        </span>
                                    </p>
                                </div>

                                {/* Week Navigation */}
                                <div className="flex items-center justify-center gap-4 bg-white p-2 rounded-xl shadow-sm border border-surface-200 shrink-0">
                                    <button onClick={handlePreviousWeek} className="p-2 hover:bg-surface-100 rounded-lg transition-colors text-surface-600">
                                        <ChevronLeft className="w-5 h-5" />
                                    </button>
                                    <div className="flex-1 text-sm font-semibold text-surface-700 min-w-[140px] text-center">
                                        {formatDate(weekDays[0])} - {formatDate(weekDays[6])}
                                    </div>
                                    <button onClick={handleNextWeek} className="p-2 hover:bg-surface-100 rounded-lg transition-colors text-surface-600">
                                        <ChevronRight className="w-5 h-5" />
                                    </button>
                                </div>
                            </div>
                        }
                    />

                    {loading ? (
                        <div className="flex justify-center items-center h-64">
                            <div className="w-8 h-8 border-4 border-primary-500 border-t-transparent rounded-full animate-spin"></div>
                        </div>
                    ) : (
                        <>
                            {/* Calendar Grid */}
                            <div className="bg-white rounded-2xl border border-surface-200 shadow-sm overflow-hidden">
                                <div className="flex flex-col lg:grid lg:grid-cols-7 lg:divide-x divide-surface-100 divide-y lg:divide-y-0">
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
                                                    'p-3 flex flex-row lg:flex-col items-center justify-between lg:justify-start border-b border-surface-100',
                                                    isToday ? 'bg-primary-50/50' : 'bg-surface-50/50'
                                                )}>
                                                    <div className="text-xs font-semibold text-surface-500 uppercase tracking-wider">{dayName}</div>
                                                    <div className={cn(
                                                        'font-bold inline-flex items-center justify-center w-8 h-8 lg:w-10 lg:h-10 rounded-full lg:mt-1',
                                                        isToday ? 'bg-primary-600 text-white shadow-md shadow-primary-500/20' : 'text-surface-800'
                                                    )}>
                                                        {dayNum}
                                                    </div>
                                                    <div className="text-xs text-surface-400 lg:mt-0.5">{monthName}</div>
                                                </div>

                                                {/* Shifts */}
                                                <div className="flex-1 p-2 flex flex-col gap-2 bg-white">
                                                    {settings?.shiftTimes.map(shiftId => {
                                                        const currentCount = getShiftCount(dateStr, shiftId);
                                                        const maxCount = getShiftQuota(dateStr, shiftId);
                                                        const registeredUsers = getRegisteredUsers(dateStr, shiftId);
                                                        const isFull = currentCount >= maxCount;

                                                        return (
                                                            <div
                                                                key={shiftId}
                                                                className={cn(
                                                                    'rounded-xl border-2 p-2.5 transition-all',
                                                                    isFull
                                                                        ? 'border-success-200 bg-success-50/50'
                                                                        : currentCount > 0
                                                                            ? 'border-primary-200 bg-primary-50/30'
                                                                            : 'border-surface-100 bg-surface-50/30'
                                                                )}
                                                            >
                                                                {/* Shift header */}
                                                                <div className="flex items-center justify-between mb-1">
                                                                    <span className="text-xs font-bold text-surface-700">{shiftId}</span>
                                                                    <span className={cn(
                                                                        'text-[10px] font-bold px-1.5 py-0.5 rounded-full',
                                                                        isFull
                                                                            ? 'bg-success-100 text-success-700'
                                                                            : currentCount > 0
                                                                                ? 'bg-primary-100 text-primary-600'
                                                                                : 'bg-surface-100 text-surface-400'
                                                                    )}>
                                                                        {currentCount}/{maxCount}
                                                                    </span>
                                                                </div>

                                                                {/* Registrant names — color coded by role */}
                                                                {registeredUsers.length > 0 ? (
                                                                    <div className="space-y-0.5">
                                                                        {registeredUsers.map((u, idx) => (
                                                                            <div key={idx} className={cn('text-[11px] font-medium truncate flex items-center gap-1', getRoleColor(u.info))}>
                                                                                <span className={cn('w-1.5 h-1.5 rounded-full shrink-0', getRoleDotColor(u.info))} />
                                                                                {u.name}
                                                                            </div>
                                                                        ))}
                                                                    </div>
                                                                ) : (
                                                                    <p className="text-[10px] text-surface-300 italic">Chưa có ai</p>
                                                                )}
                                                            </div>
                                                        );
                                                    })}

                                                    {settings?.shiftTimes.length === 0 && (
                                                        <div className="text-xs text-surface-400 text-center mt-4">Không có ca</div>
                                                    )}
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>

                            {/* Color Legend */}
                            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 px-1 text-xs font-medium">
                                <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-danger-500"></span><span className="text-surface-500">Cửa hàng trưởng</span></span>
                                <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-warning-500"></span><span className="text-surface-500">Quản lý</span></span>
                                <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-primary-500"></span><span className="text-surface-500">Full-time</span></span>
                                <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-success-500"></span><span className="text-surface-500">Part-time</span></span>
                            </div>

                            {/* Summary: Who hasn't registered (active users only) */}
                            {(() => {
                                const registeredUids = new Set(allRegistrations.map(r => r.userId));
                                const unregistered = Array.from(userInfoMap.entries())
                                    .filter(([uid]) => !registeredUids.has(uid))
                                    .map(([, info]) => ({ name: shortenName(info.name), info }))
                                    .sort((a, b) => a.name.localeCompare(b.name, 'vi'));

                                return unregistered.length > 0 ? (
                                    <div className="bg-warning-50/80 border border-warning-200 p-4 rounded-xl">
                                        <div className="flex items-center gap-2 mb-2">
                                            <Users2 className="w-4 h-4 text-warning-600" />
                                            <h3 className="text-sm font-bold text-warning-800">
                                                Chưa đăng ký ({unregistered.length} người)
                                            </h3>
                                        </div>
                                        <div className="flex flex-wrap gap-1.5">
                                            {unregistered.map((u, idx) => (
                                                <span key={idx} className={cn('text-xs px-2 py-0.5 rounded-full font-medium border', getRoleBadgeColor(u.info))}>
                                                    {u.name}
                                                </span>
                                            ))}
                                        </div>
                                    </div>
                                ) : (
                                    <div className="bg-success-50/80 border border-success-200 p-4 rounded-xl flex items-center gap-2">
                                        <Users2 className="w-4 h-4 text-success-600" />
                                        <span className="text-sm font-medium text-success-700">Tất cả nhân viên đã đăng ký ca cho tuần này! 🎉</span>
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
