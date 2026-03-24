'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { StoreSettings, WeeklyRegistration, StoreDoc, UserRole, EmployeeType } from '@/types';
import { db } from '@/lib/firebase';
import { doc, getDoc, collection, query, where, getDocs } from 'firebase/firestore';
import { getWeekStart, getWeekDays, toLocalDateString, cn } from '@/lib/utils';
import {
    ChevronLeft, ChevronRight, Building2, Users2, AlertTriangle, CheckCircle2, ChevronDown
} from 'lucide-react';
import MobilePageShell from '@/components/mobile/MobilePageShell';
import BottomSheet from '@/components/shared/BottomSheet';

function shortenName(fullName: string): string {
    const parts = fullName.trim().split(/\s+/);
    if (parts.length <= 2) return fullName;
    return parts.slice(1).join(' ');
}

interface UserInfo { name: string; role: UserRole; type: EmployeeType; }

const roleColor = (i: UserInfo) => i.role === 'store_manager' ? 'text-red-600' : i.role === 'manager' ? 'text-amber-600' : i.type === 'FT' ? 'text-blue-600' : 'text-emerald-600';
const roleDot = (i: UserInfo) => i.role === 'store_manager' ? 'bg-red-500' : i.role === 'manager' ? 'bg-amber-500' : i.type === 'FT' ? 'bg-blue-500' : 'bg-emerald-500';
const roleBadge = (i: UserInfo) => i.role === 'store_manager' ? 'bg-red-50 text-red-700 border-red-200' : i.role === 'manager' ? 'bg-amber-50 text-amber-700 border-amber-200' : i.type === 'FT' ? 'bg-blue-50 text-blue-700 border-blue-200' : 'bg-emerald-50 text-emerald-700 border-emerald-200';

export default function MobileSchedulingRegisterPage() {
    const { user, userDoc, hasPermission, effectiveStoreId: contextStoreId } = useAuth();

    const [settings, setSettings] = useState<StoreSettings | null>(null);
    const [currentWeekStart, setCurrentWeekStart] = useState<Date>(() => {
        const d = getWeekStart(new Date()); d.setDate(d.getDate() + 7); return d;
    });
    const weekDays = getWeekDays(currentWeekStart);

    const [allRegistrations, setAllRegistrations] = useState<WeeklyRegistration[]>([]);
    const [userInfoMap, setUserInfoMap] = useState<Map<string, UserInfo>>(new Map());
    const [loading, setLoading] = useState(true);

    const [stores, setStores] = useState<StoreDoc[]>([]);
    const [selectedAdminStoreId, setSelectedAdminStoreId] = useState<string>(() => {
        if (typeof window !== 'undefined') return localStorage.getItem('globalSelectedStoreId') || '';
        return '';
    });
    const [storeSheetOpen, setStoreSheetOpen] = useState(false);
    const [showUnregistered, setShowUnregistered] = useState(false);
    const [expandedDays, setExpandedDays] = useState<Set<string>>(new Set());

    useEffect(() => {
        if (typeof window !== 'undefined' && selectedAdminStoreId) localStorage.setItem('globalSelectedStoreId', selectedAdminStoreId);
    }, [selectedAdminStoreId]);

    const getToken = useCallback(() => user?.getIdToken(), [user]);
    const isAdmin = userDoc?.role === 'admin' || userDoc?.role === 'super_admin';

    useEffect(() => {
        if (!isAdmin || !user) return;
        (async () => {
            try {
                const token = await getToken();
                const res = await fetch('/api/stores', { headers: { Authorization: `Bearer ${token}` } });
                const data = await res.json();
                setStores(Array.isArray(data) ? data : []);
            } catch { /* silent */ }
        })();
    }, [isAdmin, user, getToken]);

    const effectiveStoreId = isAdmin ? selectedAdminStoreId : (contextStoreId || userDoc?.storeId || '');
    const selectedStoreName = useMemo(() => {
        if (!selectedAdminStoreId) return 'Chọn cửa hàng';
        return stores.find(s => s.id === selectedAdminStoreId)?.name ?? selectedAdminStoreId;
    }, [selectedAdminStoreId, stores]);

    // Auto-expand today
    useEffect(() => {
        const todayStr = toLocalDateString(new Date());
        if (weekDays.includes(todayStr)) setExpandedDays(new Set([todayStr]));
        else setExpandedDays(new Set(weekDays.length > 0 ? [weekDays[0]] : []));
    }, [weekDays.join(',')]);

    // Fetch data
    useEffect(() => {
        if (!user || !effectiveStoreId) { setLoading(false); return; }
        (async () => {
            setLoading(true);
            try {
                const storeSnap = await getDoc(doc(db, 'stores', effectiveStoreId));
                if (storeSnap.exists()) setSettings(storeSnap.data()?.settings ?? { registrationOpen: false, shiftTimes: [] });

                const weekStr = toLocalDateString(currentWeekStart);
                const regsSnap = await getDocs(query(collection(db, 'weekly_registrations'), where('weekStartDate', '==', weekStr), where('storeId', '==', effectiveStoreId)));
                const regs: WeeklyRegistration[] = [];
                regsSnap.forEach(d => regs.push(d.data() as WeeklyRegistration));
                setAllRegistrations(regs);

                const usersSnap = await getDocs(query(collection(db, 'users'), where('storeId', '==', effectiveStoreId)));
                const infoMap = new Map<string, UserInfo>();
                usersSnap.forEach(d => {
                    const data = d.data();
                    if (data.uid && data.name && data.isActive !== false && data.role !== 'admin' && data.role !== 'super_admin')
                        infoMap.set(data.uid, { name: data.name, role: data.role, type: data.type ?? 'PT' });
                });
                setUserInfoMap(infoMap);
            } catch (err) { console.error('Error:', err); }
            finally { setLoading(false); }
        })();
    }, [user, effectiveStoreId, currentWeekStart]);

    const canAccess = isAdmin || userDoc?.role === 'store_manager' || userDoc?.role === 'manager' || hasPermission('page.scheduling.register');
    if (!canAccess) return <MobilePageShell title="Đăng ký ca"><div className="p-8 text-center text-red-500 font-bold">Không có quyền truy cập.</div></MobilePageShell>;

    const dayLabels = ['Chủ nhật', 'Thứ 2', 'Thứ 3', 'Thứ 4', 'Thứ 5', 'Thứ 6', 'Thứ 7'];
    const previousWeek = () => setCurrentWeekStart(d => { const nd = new Date(d); nd.setDate(nd.getDate() - 7); return nd; });
    const nextWeek = () => setCurrentWeekStart(d => { const nd = new Date(d); nd.setDate(nd.getDate() + 7); return nd; });

    const isToday = (dateStr: string) => new Date().toDateString() === new Date(dateStr + 'T00:00:00').toDateString();

    const getShiftQuota = (dateStr: string, shiftId: string) => {
        if (!settings?.quotas) return 5;
        if (settings.quotas.specialDates[dateStr]?.[shiftId] !== undefined) return settings.quotas.specialDates[dateStr][shiftId];
        const day = new Date(dateStr + 'T00:00:00').getDay();
        const isWeekend = day === 0 || day === 6;
        return isWeekend ? (settings.quotas.defaultWeekend[shiftId] ?? 5) : (settings.quotas.defaultWeekday[shiftId] ?? 5);
    };

    const getShiftCount = (dateStr: string, shiftId: string) => {
        let count = 0;
        allRegistrations.forEach(reg => { if (reg.shifts.some(s => s.date === dateStr && s.shiftId === shiftId)) count++; });
        return count;
    };

    const getRegisteredUsers = (dateStr: string, shiftId: string) => {
        const result: { name: string; info: UserInfo }[] = [];
        allRegistrations.forEach(reg => {
            if (reg.shifts.some(s => s.date === dateStr && s.shiftId === shiftId)) {
                const info = userInfoMap.get(reg.userId);
                if (info) result.push({ name: shortenName(info.name), info });
            }
        });
        const order: Record<string, number> = { store_manager: 0, manager: 1 };
        return result.sort((a, b) => { const oa = order[a.info.role] ?? 2, ob = order[b.info.role] ?? 2; return oa !== ob ? oa - ob : a.name.localeCompare(b.name, 'vi'); });
    };

    const getDayTotalRegistered = (dateStr: string) => {
        const uids = new Set<string>();
        allRegistrations.forEach(reg => { if (reg.shifts.some(s => s.date === dateStr)) uids.add(reg.userId); });
        return uids.size;
    };

    const totalRegistered = new Set(allRegistrations.map(r => r.userId)).size;
    const totalUsers = userInfoMap.size;
    const regPct = totalUsers > 0 ? Math.round((totalRegistered / totalUsers) * 100) : 0;

    const unregistered = useMemo(() => {
        const regUids = new Set(allRegistrations.map(r => r.userId));
        return Array.from(userInfoMap.entries())
            .filter(([uid]) => !regUids.has(uid))
            .map(([, info]) => ({ name: shortenName(info.name), info }))
            .sort((a, b) => a.name.localeCompare(b.name, 'vi'));
    }, [allRegistrations, userInfoMap]);

    const toggleDay = (dateStr: string) => {
        setExpandedDays(prev => {
            const next = new Set(prev);
            if (next.has(dateStr)) next.delete(dateStr); else next.add(dateStr);
            return next;
        });
    };

    const shifts = settings?.shiftTimes ?? [];

    // Week range label
    const weekLabel = weekDays.length > 0
        ? `${new Date(weekDays[0] + 'T00:00:00').toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit' })} — ${new Date(weekDays[6] + 'T00:00:00').toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit' })}`
        : '';

    return (
        <MobilePageShell title="Đăng ký ca">
            {/* ── Admin store pill ─────────────────────────────────────────── */}
            {isAdmin && (
                <button onClick={() => setStoreSheetOpen(true)}
                    className="w-full flex items-center gap-2 bg-white rounded-lg border border-gray-200 px-3 py-2 mb-2 active:scale-[0.99] transition-all">
                    <Building2 className="w-3.5 h-3.5 text-primary-500 shrink-0" />
                    <span className="text-xs font-bold text-gray-800 truncate flex-1 text-left">{selectedStoreName}</span>
                    <ChevronRight className="w-3 h-3 text-gray-400 shrink-0" />
                </button>
            )}

            {isAdmin && !effectiveStoreId && (
                <div className="bg-gray-50 border border-gray-200 p-6 rounded-xl text-center">
                    <Building2 className="w-8 h-8 text-gray-300 mx-auto mb-2" />
                    <p className="text-xs text-gray-500 font-medium">Vui lòng chọn cửa hàng.</p>
                </div>
            )}

            {effectiveStoreId && (
                <>
                    {/* ── Week nav ─────────────────────────────────────────── */}
                    <div className="flex items-center gap-1 mb-2">
                        <button onClick={previousWeek} className="w-7 h-7 rounded-lg bg-white border border-gray-200 flex items-center justify-center active:scale-95 transition-transform shrink-0">
                            <ChevronLeft className="w-3.5 h-3.5 text-gray-500" />
                        </button>
                        <div className="flex-1 text-center text-xs font-bold text-gray-700">{weekLabel}</div>
                        <button onClick={nextWeek} className="w-7 h-7 rounded-lg bg-white border border-gray-200 flex items-center justify-center active:scale-95 transition-transform shrink-0">
                            <ChevronRight className="w-3.5 h-3.5 text-gray-500" />
                        </button>
                    </div>

                    {/* ── Week summary card ─────────────────────────────────── */}
                    {!loading && (
                        <div className="bg-white rounded-xl border border-gray-100 shadow-sm mb-2 overflow-hidden">
                            {/* Progress header */}
                            <div className="px-3 py-2.5 border-b border-gray-50">
                                <div className="flex items-center justify-between mb-1.5">
                                    <span className="text-xs font-bold text-gray-700">Tiến độ đăng ký</span>
                                    <span className="text-[11px] font-black text-primary-600">{totalRegistered}/{totalUsers} ({regPct}%)</span>
                                </div>
                                <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                                    <div className={cn('h-full rounded-full transition-all duration-500', regPct === 100 ? 'bg-emerald-500' : regPct > 50 ? 'bg-primary-500' : 'bg-amber-500')}
                                        style={{ width: `${regPct}%` }} />
                                </div>
                            </div>
                            {/* Shift summary row */}
                            <div className="px-3 py-2 flex gap-1 overflow-x-auto scrollbar-hide">
                                {shifts.map(shiftId => {
                                    const totalForShift = weekDays.reduce((sum, d) => sum + getShiftCount(d, shiftId), 0);
                                    const totalQuota = weekDays.reduce((sum, d) => sum + getShiftQuota(d, shiftId), 0);
                                    return (
                                        <div key={shiftId} className="flex-1 min-w-[60px] bg-gray-50 rounded-lg p-2 text-center">
                                            <p className="text-[9px] font-bold text-gray-400 uppercase truncate">{shiftId}</p>
                                            <p className="text-sm font-black text-gray-800">{totalForShift}<span className="text-[10px] font-semibold text-gray-400">/{totalQuota}</span></p>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    )}

                    {/* ── Unregistered banner ──────────────────────────────── */}
                    {!loading && unregistered.length > 0 && (
                        <button onClick={() => setShowUnregistered(true)}
                            className="w-full flex items-center gap-2.5 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2.5 mb-2 active:scale-[0.99] transition-all">
                            <div className="w-8 h-8 rounded-lg bg-amber-100 flex items-center justify-center shrink-0">
                                <AlertTriangle className="w-4 h-4 text-amber-600" />
                            </div>
                            <div className="flex-1 text-left">
                                <p className="text-xs font-bold text-amber-800">Chưa đăng ký</p>
                                <p className="text-[10px] text-amber-600 font-medium">{unregistered.length} nhân viên · Nhấn để xem danh sách</p>
                            </div>
                            <ChevronRight className="w-4 h-4 text-amber-400 shrink-0" />
                        </button>
                    )}
                    {!loading && unregistered.length === 0 && totalUsers > 0 && (
                        <div className="flex items-center gap-2 bg-emerald-50 border border-emerald-200 rounded-xl px-3 py-2.5 mb-2">
                            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                            <span className="text-xs font-semibold text-emerald-700">Tất cả đã đăng ký! 🎉</span>
                        </div>
                    )}

                    {/* ── Content: Full week accordion ─────────────────────── */}
                    {loading ? (
                        <div className="flex items-center justify-center py-10">
                            <div className="w-6 h-6 border-2 border-primary-200 border-t-primary-600 rounded-full animate-spin" />
                        </div>
                    ) : (
                        <div className="space-y-1.5">
                            {weekDays.map(dateStr => {
                                const dateObj = new Date(dateStr + 'T00:00:00');
                                const today = isToday(dateStr);
                                const expanded = expandedDays.has(dateStr);
                                const dayTotal = getDayTotalRegistered(dateStr);

                                return (
                                    <div key={dateStr} className={cn('bg-white rounded-xl border overflow-hidden transition-all',
                                        today ? 'border-primary-200 shadow-sm' : 'border-gray-100')}>
                                        {/* Day header — tap to expand */}
                                        <button onClick={() => toggleDay(dateStr)}
                                            className="w-full flex items-center gap-2.5 px-3 py-2.5 active:bg-gray-50 transition-colors">
                                            <div className={cn(
                                                'w-9 h-9 rounded-lg flex flex-col items-center justify-center shrink-0',
                                                today ? 'bg-primary-600 text-white' : 'bg-gray-100 text-gray-600'
                                            )}>
                                                <span className="text-[8px] font-bold leading-none uppercase">{dateObj.toLocaleDateString('vi-VN', { weekday: 'short' })}</span>
                                                <span className="text-sm font-black leading-tight">{dateObj.getDate()}</span>
                                            </div>
                                            <div className="flex-1 text-left">
                                                <p className={cn('text-xs font-bold', today ? 'text-primary-700' : 'text-gray-700')}>
                                                    {dayLabels[dateObj.getDay()]}
                                                    {today && <span className="ml-1.5 text-[9px] bg-primary-100 text-primary-600 px-1.5 py-0.5 rounded font-bold">Hôm nay</span>}
                                                </p>
                                                <div className="flex items-center gap-1.5 mt-0.5">
                                                    <span className="text-[10px] text-gray-500 font-medium">{dayTotal} người đã ĐK</span>
                                                    {shifts.length > 0 && (
                                                        <div className="flex gap-1">
                                                            {shifts.map(s => {
                                                                const c = getShiftCount(dateStr, s);
                                                                const q = getShiftQuota(dateStr, s);
                                                                const full = c >= q;
                                                                return (
                                                                    <span key={s} className={cn('text-[8px] font-bold px-1 py-px rounded',
                                                                        full ? 'bg-emerald-100 text-emerald-700' : c > 0 ? 'bg-primary-100 text-primary-600' : 'bg-gray-100 text-gray-400')}>
                                                                        {s[0]}:{c}/{q}
                                                                    </span>
                                                                );
                                                            })}
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                            <ChevronDown className={cn('w-4 h-4 text-gray-400 transition-transform shrink-0', expanded && 'rotate-180')} />
                                        </button>

                                        {/* Expanded: shift details */}
                                        {expanded && (
                                            <div className="border-t border-gray-50 px-3 py-2 space-y-2">
                                                {shifts.map(shiftId => {
                                                    const count = getShiftCount(dateStr, shiftId);
                                                    const quota = getShiftQuota(dateStr, shiftId);
                                                    const users = getRegisteredUsers(dateStr, shiftId);
                                                    const isFull = count >= quota;
                                                    const pct = Math.min(100, quota > 0 ? (count / quota) * 100 : 0);

                                                    return (
                                                        <div key={shiftId} className={cn('rounded-lg border p-2',
                                                            isFull ? 'border-emerald-200 bg-emerald-50/30' : count > 0 ? 'border-primary-100 bg-primary-50/20' : 'border-gray-100')}>
                                                            <div className="flex items-center gap-2 mb-1">
                                                                <span className="text-[11px] font-bold text-gray-700">{shiftId}</span>
                                                                <div className="flex-1 h-1 bg-gray-100 rounded-full overflow-hidden">
                                                                    <div className={cn('h-full rounded-full transition-all',
                                                                        isFull ? 'bg-emerald-500' : count > 0 ? 'bg-primary-500' : 'bg-gray-200')}
                                                                        style={{ width: `${pct}%` }} />
                                                                </div>
                                                                <span className={cn('text-[9px] font-bold px-1.5 py-px rounded-full',
                                                                    isFull ? 'bg-emerald-100 text-emerald-700' : count > 0 ? 'bg-primary-100 text-primary-600' : 'bg-gray-100 text-gray-400')}>
                                                                    {count}/{quota}
                                                                </span>
                                                            </div>
                                                            {users.length === 0 ? (
                                                                <p className="text-[9px] text-gray-300 italic">Chưa có ai</p>
                                                            ) : (
                                                                <div className="flex flex-wrap gap-1">
                                                                    {users.map((u, idx) => (
                                                                        <span key={idx} className="inline-flex items-center gap-0.5 text-[10px] font-semibold px-1.5 py-0.5 rounded border bg-white border-gray-100">
                                                                            <span className={cn('w-1.5 h-1.5 rounded-full shrink-0', roleDot(u.info))} />
                                                                            <span className={roleColor(u.info)}>{u.name}</span>
                                                                        </span>
                                                                    ))}
                                                                </div>
                                                            )}
                                                        </div>
                                                    );
                                                })}

                                                {shifts.length === 0 && (
                                                    <p className="text-[10px] text-gray-400 text-center">Chưa cấu hình ca.</p>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    )}

                    {/* ── Legend ────────────────────────────────────────────── */}
                    <div className="flex items-center gap-3 mt-3 px-1">
                        <span className="flex items-center gap-1 text-[9px] font-bold"><span className="w-2 h-2 rounded-full bg-red-500" /> CTH</span>
                        <span className="flex items-center gap-1 text-[9px] font-bold"><span className="w-2 h-2 rounded-full bg-amber-500" /> QL</span>
                        <span className="flex items-center gap-1 text-[9px] font-bold"><span className="w-2 h-2 rounded-full bg-blue-500" /> FT</span>
                        <span className="flex items-center gap-1 text-[9px] font-bold"><span className="w-2 h-2 rounded-full bg-emerald-500" /> PT</span>
                    </div>
                </>
            )}

            {/* ── Unregistered BottomSheet ─────────────────────────────────── */}
            <BottomSheet isOpen={showUnregistered} onClose={() => setShowUnregistered(false)} title={`Chưa đăng ký (${unregistered.length})`}>
                <div className="px-4 pb-6">
                    <p className="text-xs text-gray-500 mb-3">Những nhân viên sau chưa đăng ký ca trong tuần này:</p>
                    <div className="flex flex-wrap gap-1.5">
                        {unregistered.map((u, idx) => (
                            <span key={idx} className={cn('text-xs px-2.5 py-1 rounded-lg font-semibold border', roleBadge(u.info))}>
                                {u.name}
                            </span>
                        ))}
                    </div>
                    {unregistered.length === 0 && (
                        <p className="text-xs text-gray-400 text-center py-4">Tất cả đã đăng ký.</p>
                    )}
                </div>
            </BottomSheet>

            {/* ── Store BottomSheet ────────────────────────────────────────── */}
            <BottomSheet isOpen={storeSheetOpen} onClose={() => setStoreSheetOpen(false)} title="Chọn cửa hàng">
                <div className="flex flex-col pb-6">
                    {stores.map(s => (
                        <button key={s.id} onClick={() => { setSelectedAdminStoreId(s.id); setStoreSheetOpen(false); }}
                            className={cn('flex items-center gap-3 px-5 py-3 text-left transition-colors', selectedAdminStoreId === s.id ? 'bg-primary-50' : 'active:bg-gray-50')}>
                            <span className="text-lg">🏪</span>
                            <span className={cn('text-sm font-semibold flex-1 truncate', selectedAdminStoreId === s.id ? 'text-primary-700' : 'text-gray-700')}>{s.name}</span>
                            {selectedAdminStoreId === s.id && <span className="w-2 h-2 rounded-full bg-primary-600 shrink-0" />}
                        </button>
                    ))}
                </div>
            </BottomSheet>
        </MobilePageShell>
    );
}
