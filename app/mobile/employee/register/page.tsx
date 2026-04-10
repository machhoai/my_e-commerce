'use client';

import { useState, useEffect, useRef, useMemo } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { StoreSettings, WeeklyRegistration, ShiftEntry } from '@/types';
import { db } from '@/lib/firebase';
import { doc, onSnapshot, getDoc, collection, query, where, getDocs } from 'firebase/firestore';
import { getWeekStart, getWeekDays, weeklyRegId, toLocalDateString, cn } from '@/lib/utils';
import {
    ChevronLeft, ChevronRight, Save, AlertCircle, CheckCircle2,
    Lock, ChevronDown, Loader2, Trash2, Users2, Info,
} from 'lucide-react';
import MobilePageShell from '@/components/mobile/MobilePageShell';

export default function MobileEmployeeRegisterPage() {
    const { user, userDoc, effectiveStoreId: contextStoreId } = useAuth();

    const [settings, setSettings] = useState<StoreSettings | null>(null);
    const strictShiftLimit = settings?.strictShiftLimit ?? true;

    const [currentWeekStart, setCurrentWeekStart] = useState<Date>(() => {
        const d = getWeekStart(new Date()); d.setDate(d.getDate() + 7); return d;
    });
    const weekDays = getWeekDays(currentWeekStart);

    const [selectedShifts, setSelectedShifts] = useState<string[][]>(Array(7).fill([]));
    const [existingRegId, setExistingRegId] = useState<string | null>(null);

    const currentWeekStartOfToday = getWeekStart(new Date());
    const minEditableWeekStart = new Date(currentWeekStartOfToday);
    minEditableWeekStart.setDate(minEditableWeekStart.getDate() + 7);
    const isWeekEditable = currentWeekStart.getTime() === minEditableWeekStart.getTime();

    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');
    const [allRegistrations, setAllRegistrations] = useState<WeeklyRegistration[]>([]);
    const [managers, setManagers] = useState<{ uid: string; name: string }[]>([]);
    const [activeEmployeeList, setActiveEmployeeList] = useState<Set<string>>(new Set());
    const [expandedDays, setExpandedDays] = useState<Set<string>>(new Set());

    const storeId = contextStoreId || userDoc?.storeId || '';

    // Real-time store settings
    useEffect(() => {
        if (!storeId) return;
        const unsub = onSnapshot(doc(db, 'stores', storeId), (snap) => {
            if (snap.exists()) {
                setSettings(snap.data()?.settings ?? { registrationOpen: false, shiftTimes: [] });
            }
        });
        return () => unsub();
    }, [storeId]);

    // Fetch data
    useEffect(() => {
        if (!user || !storeId) return;
        (async () => {
            setLoading(true);
            try {
                const regId = weeklyRegId(user.uid, currentWeekStart);
                const regSnap = await getDoc(doc(db, 'weekly_registrations', regId));
                if (regSnap.exists()) {
                    setExistingRegId(regId);
                    const data = regSnap.data() as WeeklyRegistration;
                    setSelectedShifts(weekDays.map(dateStr =>
                        data.shifts.filter(s => s.date === dateStr).map(s => s.shiftId)
                    ));
                } else {
                    setExistingRegId(null);
                    setSelectedShifts(Array(7).fill([]));
                }

                const weekStr = toLocalDateString(currentWeekStart);
                const regsSnap = await getDocs(query(collection(db, 'weekly_registrations'), where('weekStartDate', '==', weekStr)));
                const regs: WeeklyRegistration[] = [];
                regsSnap.forEach(d => regs.push(d.data() as WeeklyRegistration));
                setAllRegistrations(regs);

                const usersSnap = await getDocs(query(collection(db, 'users'), where('storeId', '==', storeId)));
                const mgrs: { uid: string; name: string }[] = [];
                const validUids = new Set<string>();
                usersSnap.forEach(d => {
                    const data = d.data();
                    if (data.role === 'manager') mgrs.push({ uid: data.uid, name: data.name });
                    if (data.active !== false && data.role !== 'admin' && data.role !== 'super_admin' && data.role !== 'manager' && data.role !== 'store_manager')
                        validUids.add(data.uid);
                });
                setManagers(mgrs);
                setActiveEmployeeList(validUids);
            } catch (err) { console.error('Error:', err); setError('Không thể tải dữ liệu'); }
            finally { setLoading(false); }
        })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [user, storeId, currentWeekStart]);

    // Auto-expand today
    useEffect(() => {
        const todayStr = toLocalDateString(new Date());
        if (weekDays.includes(todayStr)) setExpandedDays(new Set([todayStr]));
        else setExpandedDays(new Set(weekDays.length > 0 ? [weekDays[0]] : []));
    }, [weekDays.join(',')]); // eslint-disable-line react-hooks/exhaustive-deps

    const shifts = settings?.shiftTimes ?? [];
    const isClosed = !settings?.registrationOpen || !isWeekEditable;
    const isFT = userDoc?.type === 'FT';

    const getShiftQuota = (dateStr: string, shiftId: string) => {
        if (!settings?.quotas) return 5;
        if (settings.quotas.specialDates[dateStr]?.[shiftId] !== undefined) return settings.quotas.specialDates[dateStr][shiftId];
        const day = new Date(dateStr + 'T00:00:00').getDay();
        const isWeekend = day === 0 || day === 6;
        return isWeekend ? (settings.quotas.defaultWeekend[shiftId] ?? 5) : (settings.quotas.defaultWeekday[shiftId] ?? 5);
    };

    const getShiftCount = (dateStr: string, shiftId: string) => {
        let count = 0;
        allRegistrations.forEach(reg => {
            if (activeEmployeeList.has(reg.userId) && reg.shifts.some(s => s.date === dateStr && s.shiftId === shiftId)) count++;
        });
        return count;
    };

    const getManagersOff = (dateStr: string) => {
        if (managers.length === 0) return [];
        return managers.filter(mgr => {
            const reg = allRegistrations.find(r => r.userId === mgr.uid);
            return reg ? !reg.shifts.some(s => s.date === dateStr) : false;
        }).map(m => m.name);
    };

    const toggleShift = (dayIndex: number, shiftId: string) => {
        setError(''); setSuccess('');
        if (!settings?.registrationOpen) { setError('Cổng đăng ký đã đóng.'); return; }
        if (!isWeekEditable) { setError('Chỉ đăng ký được cho tuần tiếp theo.'); return; }

        const dateStr = weekDays[dayIndex];
        const newSelections = [...selectedShifts];
        const dayShifts = [...newSelections[dayIndex]];

        if (dayShifts.includes(shiftId)) {
            newSelections[dayIndex] = dayShifts.filter(id => id !== shiftId);
        } else {
            const count = getShiftCount(dateStr, shiftId);
            const max = getShiftQuota(dateStr, shiftId);
            const isManager = userDoc?.role === 'manager' || userDoc?.role === 'store_manager';
            if (strictShiftLimit && count >= max && !isManager) { setError(`Ca đã đầy (${count}/${max}).`); return; }

            // Enforce max shifts per day
            const maxShiftsPerDay = settings?.maxShiftsPerDay ?? 1;
            if (dayShifts.length >= maxShiftsPerDay) {
                if (maxShiftsPerDay === 1) {
                    newSelections[dayIndex] = [shiftId]; // Replace (original behavior)
                } else {
                    setError(`Tối đa ${maxShiftsPerDay} ca/ngày.`);
                    return;
                }
            } else {
                newSelections[dayIndex] = [...dayShifts, shiftId];
            }
        }
        setSelectedShifts(newSelections);
    };

    const validateRegistration = () => {
        const type = userDoc?.type || 'PT';
        const role = userDoc?.role || 'employee';
        const warnings: string[] = [];
        let emptyDays = 0; let workDays = 0;
        for (let i = 0; i < 7; i++) {
            const maxPerDay = settings?.maxShiftsPerDay ?? 1;
            if (selectedShifts[i].length === 0) emptyDays++; else { workDays++; if (selectedShifts[i].length > maxPerDay) return { valid: false, message: `Mỗi ngày chỉ được chọn ${maxPerDay} ca.` }; }
        }
        if (workDays === 0) return { valid: false, message: 'Vui lòng chọn lịch làm việc.' };
        if (type === 'FT' || role === 'manager') {
            if (emptyDays > 1) return { valid: false, message: `${role === 'manager' ? 'Quản lý' : 'NV Toàn thời gian'} chỉ nghỉ tối đa 1 ngày/tuần.` };
            for (let i = 0; i < 7; i++) {
                const d = new Date(weekDays[i] + 'T00:00:00').getDay();
                if ((d === 0 || d === 6) && selectedShifts[i].length === 0)
                    return { valid: false, message: `Không được nghỉ cuối tuần.` };
            }
        }
        if (role === 'manager') {
            for (let i = 0; i < 7; i++) {
                if (selectedShifts[i].length === 0) {
                    const off = getManagersOff(weekDays[i]).filter(n => n !== userDoc?.name);
                    if (off.length > 0) warnings.push(`Trùng ngày nghỉ với QL: ${off.join(', ')}`);
                }
            }
        }
        return { valid: true, message: '', warnings };
    };

    const handleSave = async () => {
        if (!user || !userDoc) return;
        setError(''); setSuccess('');
        if (isClosed) { setError('Đã đóng đăng ký.'); return; }
        const v = validateRegistration();
        if (!v.valid) { setError(v.message); return; }
        if (v.warnings?.length && !window.confirm(v.warnings.join('\n') + '\n\nTiếp tục?')) return;

        setSaving(true);
        try {
            const shiftsToSave: ShiftEntry[] = [];
            selectedShifts.forEach((ds, i) => ds.forEach(sid => shiftsToSave.push({ date: weekDays[i], shiftId: sid })));
            const regId = weeklyRegId(user.uid, currentWeekStart);
            const payload: WeeklyRegistration = {
                id: regId, userId: user.uid, storeId: userDoc.storeId ?? '',
                weekStartDate: toLocalDateString(currentWeekStart), shifts: shiftsToSave, submittedAt: new Date().toISOString(),
            };
            const token = await user.getIdToken();
            const res = await fetch('/api/register', { method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` }, body: JSON.stringify(payload) });
            if (!res.ok) { const e = await res.json(); throw new Error(e.error || 'Lỗi'); }
            setExistingRegId(regId);
            setSuccess('Đăng ký thành công!');
        } catch (err: unknown) { setError(err instanceof Error ? err.message : 'Lỗi'); }
        finally { setSaving(false); }
    };

    const handleDelete = async () => {
        if (!existingRegId || !user) return;
        if (!window.confirm('Xóa toàn bộ lịch đã đăng ký?')) return;
        setSaving(true); setError(''); setSuccess('');
        try {
            const token = await user.getIdToken();
            const res = await fetch('/api/register', { method: 'DELETE', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` }, body: JSON.stringify({ registrationId: existingRegId }) });
            if (!res.ok) { const e = await res.json(); throw new Error(e.error || 'Lỗi'); }
            setSelectedShifts(Array(7).fill([]));
            setAllRegistrations(prev => prev.filter(r => r.id !== existingRegId));
            setExistingRegId(null);
            setSuccess('Đã xóa đăng ký.');
        } catch (err: unknown) { setError(err instanceof Error ? err.message : 'Lỗi'); }
        finally { setSaving(false); }
    };

    const previousWeek = () => { setCurrentWeekStart(d => { const nd = new Date(d); nd.setDate(nd.getDate() - 7); return nd; }); setError(''); setSuccess(''); };
    const nextWeek = () => { setCurrentWeekStart(d => { const nd = new Date(d); nd.setDate(nd.getDate() + 7); return nd; }); setError(''); setSuccess(''); };
    const toggleDay = (dateStr: string) => setExpandedDays(prev => { const next = new Set(prev); if (next.has(dateStr)) next.delete(dateStr); else next.add(dateStr); return next; });
    const isToday = (dateStr: string) => new Date().toDateString() === new Date(dateStr + 'T00:00:00').toDateString();
    const dayLabels = ['Chủ nhật', 'Thứ 2', 'Thứ 3', 'Thứ 4', 'Thứ 5', 'Thứ 6', 'Thứ 7'];

    const weekLabel = weekDays.length > 0
        ? `${new Date(weekDays[0] + 'T00:00:00').toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit' })} — ${new Date(weekDays[6] + 'T00:00:00').toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit' })}`
        : '';

    const totalSelected = selectedShifts.reduce((s, d) => s + d.length, 0);

    return (
        <MobilePageShell title="Đăng ký ca làm">
            {/* Week nav */}
            <div className="flex items-center gap-1 mb-2">
                <button onClick={previousWeek} className="w-7 h-7 rounded-lg bg-white border border-gray-200 flex items-center justify-center active:scale-95 transition-transform shrink-0">
                    <ChevronLeft className="w-3.5 h-3.5 text-gray-500" />
                </button>
                <div className="flex-1 text-center text-xs font-bold text-gray-700">{weekLabel}</div>
                <button onClick={nextWeek} className="w-7 h-7 rounded-lg bg-white border border-gray-200 flex items-center justify-center active:scale-95 transition-transform shrink-0">
                    <ChevronRight className="w-3.5 h-3.5 text-gray-500" />
                </button>
            </div>

            {/* Lock banner */}
            {isClosed && (
                <div className="flex items-start gap-2 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2.5 mb-2">
                    <Lock className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                    <p className="text-xs text-amber-800 font-medium">
                        {!isWeekEditable ? 'Chỉ đăng ký được cho tuần tiếp theo.' : 'Cổng đăng ký đã đóng.'}
                    </p>
                </div>
            )}

            {/* Info banner */}
            <div className="flex items-start gap-2 bg-primary-50 border border-primary-100 rounded-xl px-3 py-2 mb-2">
                <Info className="w-3.5 h-3.5 text-primary-500 shrink-0 mt-0.5" />
                <p className="text-[10px] text-primary-700">
                    {userDoc?.role === 'manager' || isFT
                        ? 'FT/QL: Nghỉ tối đa 1 ngày, không nghỉ cuối tuần.'
                        : `Chọn tối đa ${settings?.maxShiftsPerDay ?? 1} ca/ngày, nghỉ tùy ý.`
                    }
                </p>
            </div>

            {/* Error/Success */}
            {error && (
                <div className="flex items-start gap-2 bg-red-50 border border-red-200 rounded-xl px-3 py-2 mb-2">
                    <AlertCircle className="w-3.5 h-3.5 text-red-500 shrink-0 mt-0.5" />
                    <p className="text-xs text-red-700 font-medium">{error}</p>
                </div>
            )}
            {success && (
                <div className="flex items-start gap-2 bg-emerald-50 border border-emerald-200 rounded-xl px-3 py-2 mb-2">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0 mt-0.5" />
                    <p className="text-xs text-emerald-700 font-medium">{success}</p>
                </div>
            )}

            {/* Days accordion */}
            {loading ? (
                <div className="flex items-center justify-center py-10">
                    <div className="w-6 h-6 border-2 border-primary-200 border-t-primary-600 rounded-full animate-spin" />
                </div>
            ) : (
                <div className="space-y-1.5">
                    {weekDays.map((dateStr, dayIndex) => {
                        const dateObj = new Date(dateStr + 'T00:00:00');
                        const today = isToday(dateStr);
                        const expanded = expandedDays.has(dateStr);
                        const daySelected = selectedShifts[dayIndex];

                        return (
                            <div key={dateStr} className={cn('bg-white rounded-xl border overflow-hidden transition-all', today ? 'border-primary-200 shadow-sm' : 'border-gray-100')}>
                                <button onClick={() => toggleDay(dateStr)} className="w-full flex items-center gap-2.5 px-3 py-2.5 active:bg-gray-50 transition-colors">
                                    <div className={cn('w-9 h-9 rounded-lg flex flex-col items-center justify-center shrink-0', today ? 'bg-primary-600 text-white' : 'bg-gray-100 text-gray-600')}>
                                        <span className="text-[8px] font-bold leading-none uppercase">{dateObj.toLocaleDateString('vi-VN', { weekday: 'short' })}</span>
                                        <span className="text-sm font-black leading-tight">{dateObj.getDate()}</span>
                                    </div>
                                    <div className="flex-1 text-left">
                                        <p className={cn('text-xs font-bold', today ? 'text-primary-700' : 'text-gray-700')}>
                                            {dayLabels[dateObj.getDay()]}
                                            {today && <span className="ml-1.5 text-[9px] bg-primary-100 text-primary-600 px-1.5 py-0.5 rounded font-bold">Hôm nay</span>}
                                        </p>
                                        <p className="text-[10px] text-gray-500 font-medium">
                                            {daySelected.length > 0 ? `Đã chọn: ${daySelected.join(', ')}` : 'Nghỉ'}
                                        </p>
                                    </div>
                                    {daySelected.length > 0 && <CheckCircle2 className="w-4 h-4 text-primary-500 shrink-0" />}
                                    <ChevronDown className={cn('w-4 h-4 text-gray-400 transition-transform shrink-0', expanded && 'rotate-180')} />
                                </button>

                                {expanded && (
                                    <div className="border-t border-gray-50 px-3 py-2 space-y-1.5">
                                        {shifts.map(shiftId => {
                                            const isSelected = daySelected.includes(shiftId);
                                            const count = getShiftCount(dateStr, shiftId);
                                            const max = getShiftQuota(dateStr, shiftId);
                                            const isManager = userDoc?.role === 'manager' || userDoc?.role === 'store_manager';
                                            const isFull = strictShiftLimit && count >= max && !isSelected && !isManager;

                                            return (
                                                <button
                                                    key={shiftId}
                                                    disabled={isClosed || isFull}
                                                    onClick={() => toggleShift(dayIndex, shiftId)}
                                                    className={cn(
                                                        'w-full flex items-center gap-3 px-3 py-3 rounded-lg border-2 transition-all active:scale-[0.98]',
                                                        isSelected ? 'border-primary-500 bg-primary-50' : 'border-gray-100 bg-white',
                                                        (isClosed || isFull) && !isSelected && 'opacity-50 cursor-not-allowed',
                                                        isFull && !isClosed && 'border-red-100 bg-red-50/30',
                                                    )}
                                                >
                                                    <div className={cn('w-8 h-8 rounded-lg flex items-center justify-center shrink-0',
                                                        isSelected ? 'bg-primary-500 text-white' : 'bg-gray-100 text-gray-500')}>
                                                        {isSelected ? <CheckCircle2 className="w-4 h-4" /> : <span className="text-xs font-bold">{shiftId[0]}</span>}
                                                    </div>
                                                    <div className="flex-1 text-left">
                                                        <p className={cn('text-sm font-bold', isSelected ? 'text-primary-700' : 'text-gray-700')}>{shiftId}</p>
                                                        <p className={cn('text-[10px] font-medium', count >= max ? 'text-red-500' : 'text-gray-400')}>
                                                            {count}/{max} nhân viên
                                                            {isFull && ' · Đã đủ'}
                                                        </p>
                                                    </div>
                                                </button>
                                            );
                                        })}
                                        {shifts.length === 0 && <p className="text-[10px] text-gray-400 text-center py-2">Chưa cấu hình ca.</p>}

                                        {/* Manager off warning */}
                                        {userDoc?.role === 'manager' && getManagersOff(dateStr).length > 0 && (
                                            <div className="text-[10px] text-fuchsia-700 bg-fuchsia-50 p-2 rounded-lg text-center border border-fuchsia-100 font-medium">
                                                QL nghỉ: {getManagersOff(dateStr).join(', ')}
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
            )}

            {/* Footer actions */}
            {!loading && (
                <div className="mt-3 space-y-2">
                    {/* Status */}
                    <div className="text-center">
                        {existingRegId ? (
                            <p className="text-xs text-emerald-600 font-medium flex items-center justify-center gap-1">
                                <CheckCircle2 className="w-3 h-3" /> Đã lưu đăng ký · {totalSelected} ca
                            </p>
                        ) : (
                            <p className="text-xs text-gray-400">{totalSelected > 0 ? `Đã chọn ${totalSelected} ca` : 'Chưa chọn ca nào'}</p>
                        )}
                    </div>

                    {/* Buttons */}
                    <div className="flex gap-2">
                        {existingRegId && (
                            <button onClick={handleDelete} disabled={saving || isClosed}
                                className="flex-1 flex items-center justify-center gap-1.5 bg-red-50 border border-red-200 text-red-600 rounded-xl py-3 text-xs font-bold active:scale-[0.98] disabled:opacity-50">
                                <Trash2 className="w-3.5 h-3.5" /> Xóa
                            </button>
                        )}
                        <button onClick={handleSave} disabled={saving || isClosed}
                            className={cn('flex-1 flex items-center justify-center gap-1.5 rounded-xl py-3 text-xs font-bold active:scale-[0.98] disabled:opacity-50 transition-all',
                                isClosed ? 'bg-gray-200 text-gray-500' : 'bg-primary-600 text-white shadow-md shadow-primary-200')}>
                            {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : isClosed ? <Lock className="w-3.5 h-3.5" /> : <Save className="w-3.5 h-3.5" />}
                            {isClosed ? 'Đã đóng' : 'Lưu đăng ký'}
                        </button>
                    </div>
                </div>
            )}
        </MobilePageShell>
    );
}
