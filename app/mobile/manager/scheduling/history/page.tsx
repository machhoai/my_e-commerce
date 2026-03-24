'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { db } from '@/lib/firebase';
import { collection, query, where, getDocs, doc, getDoc } from 'firebase/firestore';
import { UserDoc, ScheduleDoc, SettingsDoc, StoreDoc, CustomRoleDoc } from '@/types';
import { toLocalDateString, cn } from '@/lib/utils';
import { useAuth } from '@/contexts/AuthContext';
import {
    History, ChevronLeft, ChevronRight, AlertTriangle, CheckCircle2,
    Search, RefreshCw, SlidersHorizontal, X, Building2, Ban, User,
    TrendingUp, ChevronDown, Check,
} from 'lucide-react';
import BottomSheet from '@/components/shared/BottomSheet';
import EmployeeProfilePopup from '@/components/shared/EmployeeProfilePopup';
import { useRouter } from 'next/navigation';

interface EmployeeStats {
    uid: string;
    name: string;
    type: string;
    role: string;
    customRoleId?: string;
    roleFilter: string;
    totalShifts: number;
    maxShifts: number;
    storeName?: string;
    isActive: boolean;
    statusFilter: string;
}

// ── Helpers ──────────────────────────────────────────────────────────────────
function statusBadge(stat: EmployeeStats) {
    const pct = stat.maxShifts > 0 ? (stat.totalShifts / stat.maxShifts) * 100 : 0;
    if (!stat.isActive) return { label: 'Vô hiệu hóa', color: 'bg-gray-100 text-gray-600 border-gray-200', barColor: 'bg-gray-300', isDanger: false, isWarning: false };
    if (pct > 100) return { label: 'Thừa ca', color: 'bg-red-100 text-red-700 border-red-200', barColor: 'bg-red-500', isDanger: true, isWarning: false };
    if (pct >= 85) return { label: 'Sắp đầy', color: 'bg-amber-100 text-amber-700 border-amber-200', barColor: 'bg-amber-400', isDanger: false, isWarning: true };
    return { label: 'An toàn', color: 'bg-emerald-100 text-emerald-700 border-emerald-200', barColor: 'bg-emerald-400', isDanger: false, isWarning: false };
}

function initials(name: string) {
    const p = name.trim().split(' ').filter(Boolean);
    return p.length >= 2 ? (p[0][0] + p[p.length - 1][0]).toUpperCase() : name.substring(0, 2).toUpperCase();
}

// ── Page ─────────────────────────────────────────────────────────────────────
export default function MobileManagerSchedulingHistoryPage() {
    const router = useRouter();
    const { user, userDoc, hasPermission, effectiveStoreId: contextStoreId } = useAuth();
    const isAdmin = userDoc?.role === 'admin' || userDoc?.role === 'super_admin';

    // ── Month navigation ──────────────────────────────────────────────────────
    const [currentMonth, setCurrentMonth] = useState<Date>(() => {
        const d = new Date(); d.setDate(1); d.setHours(0, 0, 0, 0); return d;
    });
    const monthLabel = `Tháng ${currentMonth.getMonth() + 1}/${currentMonth.getFullYear()}`;

    // ── Store selector (admin) ────────────────────────────────────────────────
    const [stores, setStores] = useState<{ id: string; name: string }[]>([]);
    const [selectedStoreId, setSelectedStoreId] = useState('');

    // ── Data state ────────────────────────────────────────────────────────────
    const [stats, setStats] = useState<EmployeeStats[]>([]);
    const [customRoles, setCustomRoles] = useState<CustomRoleDoc[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [profileUid, setProfileUid] = useState<string | null>(null);

    // ── Filter/search state ───────────────────────────────────────────────────
    const [searchQuery, setSearchQuery] = useState('');
    const [filterSheet, setFilterSheet] = useState(false);
    const [pendingType, setPendingType] = useState('');
    const [pendingRole, setPendingRole] = useState('');
    const [pendingStatus, setPendingStatus] = useState('active');
    const [appliedType, setAppliedType] = useState('');
    const [appliedRole, setAppliedRole] = useState('');
    const [appliedStatus, setAppliedStatus] = useState('active');
    const [sortBy, setSortBy] = useState<'name' | 'totalShifts'>('name');
    const [sortAsc, setSortAsc] = useState(true);
    const activeFilterCount = [appliedType, appliedRole, appliedStatus].filter(Boolean).length;

    const getToken = useCallback(() => user?.getIdToken(), [user]);

    // ── Fetch custom roles ────────────────────────────────────────────────────
    useEffect(() => {
        if (!user) return;
        (async () => {
            try {
                const token = await getToken();
                const res = await fetch('/api/roles', { headers: { Authorization: `Bearer ${token}` } });
                const data = await res.json();
                setCustomRoles(Array.isArray(data) ? data : []);
            } catch { /* silent */ }
        })();
    }, [user, getToken]);

    // ── Fetch stores ──────────────────────────────────────────────────────────
    useEffect(() => {
        if (!user) return;
        (async () => {
            try {
                const token = await getToken();
                const res = await fetch('/api/stores', { headers: { Authorization: `Bearer ${token}` } });
                const data = await res.json();
                setStores(Array.isArray(data) ? data.map((s: any) => ({ id: s.id, name: s.name })) : []);
            } catch { /* silent */ }
        })();
    }, [user, getToken]);

    // ── Fetch schedule history ────────────────────────────────────────────────
    const fetchHistory = useCallback(async () => {
        if (!user || !userDoc) return;
        setLoading(true); setError('');
        const effectiveStoreId = isAdmin ? selectedStoreId : (contextStoreId || userDoc?.storeId || '');
        try {
            let settingsData: SettingsDoc | null = null;
            if (effectiveStoreId) {
                const storeSnap = await getDoc(doc(db, 'stores', effectiveStoreId));
                if (storeSnap.exists()) {
                    settingsData = ((storeSnap.data() as StoreDoc).settings as SettingsDoc) || null;
                }
            }
            const ftDaysOff = settingsData?.monthlyQuotas?.ftDaysOff ?? 4;
            const maxPT = settingsData?.monthlyQuotas?.ptMaxShifts ?? 25;
            const year = currentMonth.getFullYear();
            const month = currentMonth.getMonth();
            const daysInMonth = new Date(year, month + 1, 0).getDate();
            const maxFT = Math.max(0, daysInMonth - ftDaysOff);

            let usersQ = query(collection(db, 'users'));
            if (effectiveStoreId) usersQ = query(collection(db, 'users'), where('storeId', '==', effectiveStoreId));
            const usersSnap = await getDocs(usersQ);
            const userMap = new Map<string, UserDoc>();
            usersSnap.docs.forEach(d => { const u = d.data() as UserDoc; userMap.set(u.uid, u); });
            const storeNameMap = new Map(stores.map(s => [s.id, s.name]));

            const startStr = toLocalDateString(new Date(year, month, 1));
            const endStr = toLocalDateString(new Date(year, month, daysInMonth));
            const schedQ = query(collection(db, 'schedules'), where('date', '>=', startStr), where('date', '<=', endStr));
            const schedSnap = await getDocs(schedQ);
            const todayStr = toLocalDateString(new Date());

            const shiftSets = new Map<string, Set<string>>();
            schedSnap.docs.forEach(d => {
                const sc = d.data() as ScheduleDoc;
                const belongsToStore = !effectiveStoreId || sc.storeId === effectiveStoreId || sc.storeId === undefined;
                if (sc.date < todayStr && belongsToStore) {
                    const key = `${sc.date}_${sc.shiftId}`;
                    sc.employeeIds.forEach(uid => {
                        if (!shiftSets.has(uid)) shiftSets.set(uid, new Set());
                        shiftSets.get(uid)!.add(key);
                    });
                }
            });

            const finalStats: EmployeeStats[] = [];
            userMap.forEach(u => {
                if (u.role === 'admin' || u.role === 'super_admin') return;
                finalStats.push({
                    uid: u.uid, name: u.name, type: u.type, role: u.role,
                    customRoleId: u.customRoleId,
                    roleFilter: u.customRoleId ? `custom:${u.customRoleId}` : u.role,
                    totalShifts: shiftSets.get(u.uid)?.size ?? 0,
                    maxShifts: u.type === 'FT' ? maxFT : maxPT,
                    storeName: u.storeId ? (storeNameMap.get(u.storeId) ?? u.storeId) : undefined,
                    isActive: u.isActive !== false,
                    statusFilter: u.isActive !== false ? 'active' : 'disabled',
                });
            });
            setStats(finalStats);
        } catch { setError('Không thể tải dữ liệu. Vui lòng thử lại.'); }
        finally { setLoading(false); }
    }, [user, userDoc, currentMonth, selectedStoreId, stores, isAdmin]);

    useEffect(() => { fetchHistory(); }, [fetchHistory]);

    // ── Filtered + sorted ─────────────────────────────────────────────────────
    const displayed = useMemo(() => {
        let list = [...stats];
        if (searchQuery.trim()) {
            const q = searchQuery.toLowerCase();
            list = list.filter(s => s.name.toLowerCase().includes(q));
        }
        if (appliedType) list = list.filter(s => s.type === appliedType);
        if (appliedRole) list = list.filter(s => s.roleFilter === appliedRole);
        if (appliedStatus) list = list.filter(s => s.statusFilter === appliedStatus);
        list.sort((a, b) => {
            const v = sortBy === 'name' ? a.name.localeCompare(b.name) : a.totalShifts - b.totalShifts;
            return sortAsc ? v : -v;
        });
        return list;
    }, [stats, searchQuery, appliedType, appliedRole, appliedStatus, sortBy, sortAsc]);

    // ── Permission guard ──────────────────────────────────────────────────────
    if (userDoc && !isAdmin && !hasPermission('page.scheduling.history')) {
        return (
            <div className="min-h-screen bg-gray-50 flex items-center justify-center p-6">
                <div className="text-center"><Ban className="w-12 h-12 text-red-300 mx-auto mb-3" /><p className="font-bold text-gray-700">Không có quyền truy cập</p></div>
            </div>
        );
    }

    const applyFilters = () => {
        setAppliedType(pendingType);
        setAppliedRole(pendingRole);
        setAppliedStatus(pendingStatus);
        setFilterSheet(false);
    };
    const clearFilters = () => {
        setPendingType(''); setPendingRole(''); setPendingStatus('');
        setAppliedType(''); setAppliedRole(''); setAppliedStatus('');
        setFilterSheet(false);
    };
    const openFilterSheet = () => {
        setPendingType(appliedType); setPendingRole(appliedRole); setPendingStatus(appliedStatus);
        setFilterSheet(true);
    };

    const roleOptions = [
        { value: 'store_manager', label: 'CH Trưởng' },
        { value: 'manager', label: 'Quản lý' },
        { value: 'employee', label: 'Nhân viên' },
        ...customRoles.map(r => ({ value: `custom:${r.id}`, label: r.name })),
    ];

    return (
        <div className="min-h-screen bg-gray-50 pb-8">
            {/* ── Sticky header ── */}
            <div className="sticky top-0 z-20 bg-primary-600 text-white px-4 py-4 shadow-lg shadow-primary-900/20">
                <div className="flex items-center gap-3">
                    <button onClick={() => router.back()} className="w-9 h-9 rounded-xl bg-white/15 flex items-center justify-center active:scale-95 transition-transform">
                        <ChevronLeft className="w-5 h-5" />
                    </button>
                    <div className="flex-1 min-w-0">
                        <h1 className="text-[17px] font-bold leading-tight">Lịch sử ca làm</h1>
                        <p className="text-[11px] text-primary-200 font-medium">Thống kê ca hoàn thành theo tháng</p>
                    </div>
                    <button onClick={fetchHistory} className="w-9 h-9 rounded-xl bg-white/15 flex items-center justify-center active:scale-95 transition-transform">
                        <RefreshCw className={cn('w-4 h-4', loading && 'animate-spin')} />
                    </button>
                </div>
            </div>

            <div className="px-4 pt-4 flex flex-col gap-3">
                {/* Store picker for admin */}
                {isAdmin && (
                    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm flex items-center gap-2 px-3 py-2.5">
                        <Building2 className="w-4 h-4 text-primary-500 shrink-0" />
                        <select value={selectedStoreId} onChange={e => setSelectedStoreId(e.target.value)}
                            className="flex-1 text-[13px] font-semibold text-gray-700 outline-none bg-transparent appearance-none cursor-pointer">
                            <option value="">-- Tất cả cửa hàng --</option>
                            {stores.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                        </select>
                        <ChevronDown className="w-3.5 h-3.5 text-gray-400 shrink-0 pointer-events-none" />
                    </div>
                )}

                {/* Month navigation */}
                <div className="flex items-center justify-between bg-white rounded-2xl border border-gray-100 shadow-sm px-2 py-1">
                    <button onClick={() => { const d = new Date(currentMonth); d.setMonth(d.getMonth() - 1); setCurrentMonth(d); }}
                        className="w-8 h-8 rounded-xl bg-white/15 flex items-center justify-center active:scale-90 transition-transform">
                        <ChevronLeft className="w-4 h-4" />
                    </button>
                    <span className="font-bold text-[14px]">{monthLabel}</span>
                    <button onClick={() => { const d = new Date(currentMonth); d.setMonth(d.getMonth() + 1); setCurrentMonth(d); }}
                        className="w-8 h-8 rounded-xl bg-white/15 flex items-center justify-center active:scale-90 transition-transform">
                        <ChevronRight className="w-4 h-4" />
                    </button>
                </div>

                {/* Search + filter bar */}
                <div className="flex gap-2">
                    <div className="flex-1 bg-white rounded-2xl border border-gray-100 shadow-sm flex items-center gap-2 px-3 py-2.5">
                        <Search className="w-4 h-4 text-gray-400 shrink-0" />
                        <input value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
                            placeholder="Tìm nhân viên..."
                            className="flex-1 text-[13px] text-gray-700 outline-none bg-transparent placeholder:text-gray-400" />
                        {searchQuery && <button onClick={() => setSearchQuery('')}><X className="w-4 h-4 text-gray-400" /></button>}
                    </div>
                    <button onClick={openFilterSheet}
                        className={cn('relative w-11 h-11 rounded-2xl flex items-center justify-center shadow-sm border transition-colors shrink-0',
                            activeFilterCount > 0 ? 'bg-primary-600 border-primary-500 text-white' : 'bg-white border-gray-100 text-gray-500'
                        )}>
                        <SlidersHorizontal className="w-4 h-4" />
                        {activeFilterCount > 0 && (
                            <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-red-500 text-white text-[9px] font-bold flex items-center justify-center">{activeFilterCount}</span>
                        )}
                    </button>
                    {/* Sort toggle */}
                    <button onClick={() => { if (sortBy === 'name') { setSortBy('totalShifts'); setSortAsc(false); } else if (!sortAsc) { setSortAsc(true); } else { setSortBy('name'); setSortAsc(true); } }}
                        title="Sắp xếp"
                        className="w-11 h-11 rounded-2xl bg-white border border-gray-100 shadow-sm flex items-center justify-center text-gray-500 shrink-0">
                        <TrendingUp className="w-4 h-4" />
                    </button>
                </div>

                {/* Stats summary pills */}
                {!loading && stats.length > 0 && (
                    <div className="flex gap-2 flex-wrap">
                        <span className="flex items-center gap-1 text-[11px] font-semibold bg-white/15 rounded-full pr-2.5 py-1"><User className="w-3 h-3" /> {displayed.length} Nhân sự    </span>
                        <span className="flex items-center gap-1 text-[11px] font-semibold bg-emerald-400/30 rounded-full px-2.5 py-1"><CheckCircle2 className="w-3 h-3 text-emerald-300" /> {displayed.filter(s => { const p = s.totalShifts / s.maxShifts; return p <= 0.85 && s.isActive; }).length} an toàn</span>
                        {displayed.filter(s => { const p = s.totalShifts / s.maxShifts; return p > 1; }).length > 0 && (
                            <span className="flex items-center gap-1 text-[11px] font-semibold bg-red-400/30 rounded-full px-2.5 py-1"><AlertTriangle className="w-3 h-3 text-red-300" /> {displayed.filter(s => s.totalShifts > s.maxShifts).length} thừa ca</span>
                        )}
                    </div>
                )}

                {/* Sort label */}
                <p className="text-[11px] text-gray-400 font-medium px-1">
                    Sắp theo: <span className="text-primary-600 font-bold">{sortBy === 'name' ? 'Tên' : 'Số ca'} {sortAsc ? '↑' : '↓'}</span>
                    {activeFilterCount > 0 && <> · <span className="text-primary-600 font-bold">{activeFilterCount} lọc đang áp dụng</span></>}
                </p>

                {/* Error */}
                {error && (
                    <div className="rounded-2xl bg-red-50 border border-red-100 px-4 py-3 flex items-center gap-2">
                        <AlertTriangle className="w-4 h-4 text-red-400 shrink-0" />
                        <p className="text-xs text-red-600 flex-1">{error}</p>
                        <button onClick={() => setError('')}><X className="w-4 h-4 text-red-400" /></button>
                    </div>
                )}

                {/* Employee cards */}
                {loading ? (
                    <div className="flex flex-col gap-2">
                        {[1, 2, 3, 4].map(i => <div key={i} className="h-24 rounded-2xl bg-gray-100 animate-pulse" />)}
                    </div>
                ) : displayed.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-16 gap-3">
                        <div className="w-16 h-16 rounded-2xl bg-gray-100 flex items-center justify-center"><History className="w-7 h-7 text-gray-300" /></div>
                        <p className="text-sm font-semibold text-gray-500">Không có dữ liệu</p>
                        <p className="text-xs text-gray-400">Thử thay đổi bộ lọc hoặc tháng</p>
                    </div>
                ) : (
                    <div className="flex flex-col gap-2">
                        {displayed.map(stat => {
                            const badge = statusBadge(stat);
                            const pct = Math.min((stat.totalShifts / Math.max(stat.maxShifts, 1)) * 100, 100);
                            return (
                                <div key={stat.uid}
                                    className={cn('bg-white rounded-2xl border shadow-sm overflow-hidden transition-all active:scale-[0.99]',
                                        badge.isDanger ? 'border-red-100' : badge.isWarning ? 'border-amber-100' : 'border-gray-100'
                                    )}
                                    onClick={() => { if (hasPermission('action.hr.view_employee_profile')) setProfileUid(stat.uid); }}>
                                    <div className="flex items-center gap-3 px-4 py-3">
                                        {/* Avatar */}
                                        <div className={cn('w-11 h-11 rounded-xl flex items-center justify-center text-sm font-bold shrink-0',
                                            !stat.isActive ? 'bg-gray-100 text-gray-400' :
                                                badge.isDanger ? 'bg-red-100 text-red-700' :
                                                    badge.isWarning ? 'bg-amber-100 text-amber-700' :
                                                        'bg-primary-100 text-primary-700'
                                        )}>
                                            {initials(stat.name)}
                                        </div>

                                        {/* Info */}
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-1.5 flex-wrap">
                                                <p className={cn('font-bold text-[14px] leading-tight truncate', !stat.isActive && 'opacity-50')}>{stat.name}</p>
                                                <span className={cn('text-[10px] font-bold px-1.5 py-0.5 rounded-md border',
                                                    stat.type === 'FT' ? 'bg-accent-50 text-accent-700 border-accent-200' : 'bg-teal-50 text-teal-700 border-teal-200'
                                                )}>{stat.type}</span>
                                                {!stat.isActive && <span className="flex items-center gap-0.5 text-[10px] font-bold px-1.5 py-0.5 rounded-md bg-gray-100 text-gray-500 border border-gray-200"><Ban className="w-2.5 h-2.5" />Khóa</span>}
                                            </div>
                                            {isAdmin && stat.storeName && (
                                                <p className="text-[11px] text-gray-400 mt-0.5 truncate">{stat.storeName}</p>
                                            )}

                                            {/* Progress bar */}
                                            <div className="mt-2 flex items-center gap-2">
                                                <div className="flex-1 h-2 rounded-full bg-gray-100 overflow-hidden">
                                                    <div className={cn('h-full rounded-full transition-all duration-500', badge.barColor)}
                                                        style={{ width: `${pct}%` }} />
                                                </div>
                                                <span className={cn('text-[12px] font-black shrink-0',
                                                    badge.isDanger ? 'text-red-600' : badge.isWarning ? 'text-amber-600' : 'text-gray-700'
                                                )}>{stat.totalShifts}<span className="text-gray-400 font-normal">/{stat.maxShifts}</span></span>
                                            </div>
                                        </div>

                                        {/* Status badge */}
                                        <span className={cn('text-[10px] font-bold px-2 py-1.5 rounded-xl border whitespace-nowrap shrink-0', badge.color)}>
                                            {badge.isDanger ? '⚠ ' : badge.isWarning ? '• ' : '✓ '}{badge.label}
                                        </span>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>

            {/* ── Filter BottomSheet ── */}
            <BottomSheet isOpen={filterSheet} onClose={() => setFilterSheet(false)} title="Bộ lọc">
                <div className="px-5 py-4 flex flex-col gap-5 pb-8">
                    {/* Type filter */}
                    <div>
                        <p className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Loại hợp đồng</p>
                        <div className="flex gap-2 flex-wrap">
                            {[{ value: '', label: 'Tất cả' }, { value: 'FT', label: 'Toàn thời gian (FT)' }, { value: 'PT', label: 'Bán thời gian (PT)' }].map(o => (
                                <button key={o.value} onClick={() => setPendingType(o.value)}
                                    className={cn('flex items-center gap-1.5 px-3 py-2 rounded-xl text-[13px] font-semibold border transition-all',
                                        pendingType === o.value ? 'bg-primary-600 text-white border-primary-600' : 'bg-gray-50 text-gray-700 border-gray-200'
                                    )}>
                                    {pendingType === o.value && <Check className="w-3 h-3" />}{o.label}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Role filter */}
                    <div>
                        <p className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Vai trò</p>
                        <div className="flex gap-2 flex-wrap">
                            {[{ value: '', label: 'Tất cả' }, ...roleOptions].map(o => (
                                <button key={o.value} onClick={() => setPendingRole(o.value)}
                                    className={cn('flex items-center gap-1.5 px-3 py-2 rounded-xl text-[13px] font-semibold border transition-all',
                                        pendingRole === o.value ? 'bg-primary-600 text-white border-primary-600' : 'bg-gray-50 text-gray-700 border-gray-200'
                                    )}>
                                    {pendingRole === o.value && <Check className="w-3 h-3" />}{o.label}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Status filter */}
                    <div>
                        <p className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Trạng thái tài khoản</p>
                        <div className="flex gap-2 flex-wrap">
                            {[{ value: 'active', label: 'Đang hoạt động' }, { value: 'disabled', label: 'Vô hiệu hóa' }].map(o => (
                                <button key={o.value} onClick={() => setPendingStatus(o.value)}
                                    className={cn('flex items-center gap-1.5 px-3 py-2 rounded-xl text-[13px] font-semibold border transition-all',
                                        pendingStatus === o.value ? 'bg-primary-600 text-white border-primary-600' : 'bg-gray-50 text-gray-700 border-gray-200'
                                    )}>
                                    {pendingStatus === o.value && <Check className="w-3 h-3" />}{o.label}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Actions */}
                    <div className="flex gap-2 pt-2">
                        <button onClick={clearFilters}
                            className="flex-1 py-3 rounded-2xl border border-gray-200 font-bold text-sm text-gray-600 active:scale-[0.98] transition-transform">
                            Xoá bộ lọc
                        </button>
                        <button onClick={applyFilters}
                            className="flex-1 py-3 rounded-2xl bg-primary-600 text-white font-bold text-sm shadow-lg shadow-primary-500/25 active:scale-[0.98] transition-transform">
                            Áp dụng {(pendingType || pendingRole || pendingStatus) ? `(${[pendingType, pendingRole, pendingStatus].filter(Boolean).length})` : ''}
                        </button>
                    </div>
                </div>
            </BottomSheet>

            {/* Employee profile popup */}
            {profileUid && (
                <EmployeeProfilePopup
                    employeeUid={profileUid}
                    storeId={isAdmin ? selectedStoreId : (contextStoreId || userDoc?.storeId)}
                    onClose={() => setProfileUid(null)}
                />
            )}
        </div>
    );
}
