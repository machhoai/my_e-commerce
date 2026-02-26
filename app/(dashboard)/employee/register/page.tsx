'use client';

import { useState, useEffect, useRef } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { StoreSettings, WeeklyRegistration, ShiftEntry } from '@/types';
import { db } from '@/lib/firebase';
import { doc, onSnapshot, getDoc, collection, query, where, getDocs } from 'firebase/firestore';
import { getWeekStart, getWeekDays, formatDate, weeklyRegId, toLocalDateString, cn } from '@/lib/utils';
import {
    Calendar as CalendarIcon, Save, AlertCircle, Info, CheckCircle2,
    ChevronLeft, ChevronRight, Trash2, Lock
} from 'lucide-react';

export default function EmployeeRegisterPage() {
    const { user, userDoc } = useAuth();

    // ─── Settings (real-time via onSnapshot) ────────────────────────────────
    const [settings, setSettings] = useState<StoreSettings | null>(null);

    // ─── Registration State ──────────────────────────────────────────────────
    const [currentWeekStart, setCurrentWeekStart] = useState<Date>(getWeekStart(new Date()));
    const weekDays = getWeekDays(currentWeekStart);

    const [selectedShifts, setSelectedShifts] = useState<string[][]>(Array(7).fill([]));
    const [existingRegId, setExistingRegId] = useState<string | null>(null);

    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');

    // ─── Global Registration Data (for quotas & manager off-days) ───────────
    const [allRegistrations, setAllRegistrations] = useState<WeeklyRegistration[]>([]);
    const [managers, setManagers] = useState<{ uid: string; name: string }[]>([]);

    // ─── REAL-TIME LISTENER: Store Settings (onSnapshot) ────────────────────
    // This replaces the one-time getDoc and reacts instantly when admin closes registration
    const storeId = userDoc?.storeId ?? '';
    const snapshotUnsubRef = useRef<(() => void) | null>(null);

    useEffect(() => {
        if (!storeId) return;

        // Subscribe to the store document for real-time settings updates
        const storeRef = doc(db, 'stores', storeId);
        const unsub = onSnapshot(storeRef, (snap) => {
            if (snap.exists()) {
                const storeData = snap.data();
                const storeSettings: StoreSettings = storeData?.settings ?? {
                    registrationOpen: false,
                    shiftTimes: [],
                };
                setSettings(storeSettings);
            }
        }, (err) => {
            console.error('onSnapshot error:', err);
        });

        snapshotUnsubRef.current = unsub;
        return () => unsub();
    }, [storeId]);

    // ─── Fetch Existing Registration + Quota Data ───────────────────────────
    useEffect(() => {
        if (!user || !storeId) return;

        const fetchData = async () => {
            setLoading(true);
            try {
                // 1. Get existing registration for this week
                const regId = weeklyRegId(user.uid, currentWeekStart);
                const regSnap = await getDoc(doc(db, 'weekly_registrations', regId));

                if (regSnap.exists()) {
                    setExistingRegId(regId);
                    const data = regSnap.data() as WeeklyRegistration;
                    const mappedSelections = weekDays.map(dateStr =>
                        data.shifts.filter(s => s.date === dateStr).map(s => s.shiftId)
                    );
                    setSelectedShifts(mappedSelections);
                } else {
                    setExistingRegId(null);
                    setSelectedShifts(Array(7).fill([]));
                }

                // 2. Fetch ALL registrations for this week for quota calculations
                const weekStr = toLocalDateString(currentWeekStart);
                const allRegsQuery = query(
                    collection(db, 'weekly_registrations'),
                    where('weekStartDate', '==', weekStr)
                );
                const allRegsSnap = await getDocs(allRegsQuery);
                const regs: WeeklyRegistration[] = [];
                allRegsSnap.forEach(d => regs.push(d.data() as WeeklyRegistration));
                setAllRegistrations(regs);

                // 3. Fetch all managers
                const managersQuery = query(collection(db, 'users'), where('role', '==', 'manager'));
                const managersSnap = await getDocs(managersQuery);
                const mgrs: { uid: string; name: string }[] = [];
                managersSnap.forEach(d => {
                    const data = d.data();
                    mgrs.push({ uid: data.uid, name: data.name });
                });
                setManagers(mgrs);
            } catch (err) {
                console.error('Lỗi khi tải dữ liệu:', err);
                setError('Không thể tải dữ liệu đăng ký');
            } finally {
                setLoading(false);
            }
        };

        fetchData();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [user, storeId, currentWeekStart]);

    // ─── Week Navigation ─────────────────────────────────────────────────────
    const handlePreviousWeek = () => {
        const d = new Date(currentWeekStart);
        d.setDate(d.getDate() - 7);
        setCurrentWeekStart(d);
        setSuccess(''); setError('');
    };

    const handleNextWeek = () => {
        const d = new Date(currentWeekStart);
        d.setDate(d.getDate() + 7);
        setCurrentWeekStart(d);
        setSuccess(''); setError('');
    };

    // ─── Business Logic Helpers ──────────────────────────────────────────────
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
            const isManager = managers.some(m => m.uid === reg.userId);
            if (!isManager && reg.shifts.some(s => s.date === dateStr && s.shiftId === shiftId)) count++;
        });
        return count;
    };

    const getManagersOff = (dateStr: string) => {
        if (managers.length === 0 || allRegistrations.length === 0) return [];
        return managers
            .filter(mgr => {
                const reg = allRegistrations.find(r => r.userId === mgr.uid);
                return reg ? !reg.shifts.some(s => s.date === dateStr) : false;
            })
            .map(mgr => mgr.name);
    };

    const toggleShift = (dayIndex: number, shiftId: string) => {
        setError(''); setSuccess('');

        if (!settings?.registrationOpen) {
            setError('Cổng đăng ký đã đóng — không thể thay đổi lịch.');
            return;
        }

        const dateStr = weekDays[dayIndex];
        const newSelections = [...selectedShifts];
        const dayShifts = [...newSelections[dayIndex]];

        if (dayShifts.includes(shiftId)) {
            newSelections[dayIndex] = dayShifts.filter(id => id !== shiftId);
        } else {
            const currentCount = getShiftCount(dateStr, shiftId);
            const maxCount = getShiftQuota(dateStr, shiftId);
            if (currentCount >= maxCount) {
                setError(`Ca này đã đầy (${currentCount}/${maxCount}). Vui lòng chọn ca khác.`);
                return;
            }
            // Only 1 shift per day
            newSelections[dayIndex] = [shiftId];
        }
        setSelectedShifts(newSelections);
    };

    const validateRegistration = (): { valid: boolean; message: string; warnings?: string[] } => {
        const type = userDoc?.type || 'PT';
        const role = userDoc?.role || 'employee';
        const warnings: string[] = [];
        let emptyDays = 0;
        let workDaysCount = 0;

        for (let i = 0; i < 7; i++) {
            const count = selectedShifts[i].length;
            if (count === 0) emptyDays++;
            else {
                workDaysCount++;
                if (count > 1)
                    return { valid: false, message: 'Mỗi ngày đi làm chỉ được chọn tối đa 1 ca.' };
            }
        }

        if (workDaysCount === 0)
            return { valid: false, message: 'Vui lòng chọn lịch làm việc trong tuần.' };

        if (type === 'FT' || role === 'manager') {
            if (emptyDays !== 1)
                return { valid: false, message: `${role === 'manager' ? 'Quản lý' : 'Nhân viên Toàn thời gian'} bắt buộc phải nghỉ đúng 1 ngày trong tuần.` };

            for (let i = 0; i < 7; i++) {
                const dateStr = weekDays[i];
                const day = new Date(dateStr + 'T00:00:00').getDay();
                const isWeekend = day === 0 || day === 6;
                if (isWeekend && selectedShifts[i].length === 0) {
                    const dayName = new Date(dateStr + 'T00:00:00').toLocaleDateString('vi-VN', { weekday: 'long' });
                    return { valid: false, message: `${role === 'manager' ? 'Quản lý' : 'Nhân viên Toàn thời gian'} không được phép nghỉ vào ngày cuối tuần (${dayName}).` };
                }
            }
        }

        if (role === 'manager') {
            for (let i = 0; i < 7; i++) {
                if (selectedShifts[i].length === 0) {
                    const dateStr = weekDays[i];
                    const managersOff = getManagersOff(dateStr).filter(name => name !== userDoc?.name);
                    if (managersOff.length > 0)
                        warnings.push(`Cảnh báo: Bạn đang nghỉ vào ${formatDate(dateStr)} trùng với quản lý khác (${managersOff.join(', ')}).`);
                }
            }
        }

        return { valid: true, message: '', warnings };
    };

    // ─── Save via secure API route ───────────────────────────────────────────
    const handleSave = async () => {
        if (!user || !userDoc) return;
        setError(''); setSuccess('');

        // Client-side pre-flight check (real-time listener already keeps this accurate)
        if (!settings?.registrationOpen) {
            setError('Cổng đăng ký đã đóng — không thể lưu lịch.');
            return;
        }

        const validation = validateRegistration();
        if (!validation.valid) { setError(validation.message); return; }

        if (validation.warnings && validation.warnings.length > 0) {
            const proceed = window.confirm(validation.warnings.join('\n\n') + '\n\nBạn có muốn tiếp tục lưu lịch không?');
            if (!proceed) return;
        }

        setSaving(true);
        try {
            const shiftsToSave: ShiftEntry[] = [];
            selectedShifts.forEach((dayShifts, i) => {
                const dateStr = weekDays[i];
                dayShifts.forEach(shiftId => shiftsToSave.push({ date: dateStr, shiftId }));
            });

            const regId = weeklyRegId(user.uid, currentWeekStart);
            const payload: WeeklyRegistration = {
                id: regId,
                userId: user.uid,
                storeId: userDoc.storeId ?? '',
                weekStartDate: toLocalDateString(currentWeekStart),
                shifts: shiftsToSave,
                submittedAt: new Date().toISOString(),
            };

            // POST to our new secure API route instead of writing directly to Firestore
            const token = await user.getIdToken();
            const res = await fetch('/api/register', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`,
                },
                body: JSON.stringify(payload),
            });

            if (!res.ok) {
                const errData = await res.json();
                throw new Error(errData.error || 'Không thể lưu đăng ký');
            }

            setExistingRegId(regId);
            setSuccess('Đã đăng ký ca làm thành công!');
        } catch (err: unknown) {
            console.error('Save error:', err);
            setError(err instanceof Error ? err.message : 'Không thể lưu đăng ký');
        } finally {
            setSaving(false);
        }
    };

    // ─── Delete via secure API route ─────────────────────────────────────────
    const handleDeleteRegistration = async () => {
        if (!existingRegId || !user) return;
        if (!window.confirm('Bạn có chắc chắn muốn xóa toàn bộ lịch đã đăng ký cho tuần này?')) return;

        setSaving(true); setError(''); setSuccess('');
        try {
            const token = await user.getIdToken();
            const res = await fetch('/api/register', {
                method: 'DELETE',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`,
                },
                body: JSON.stringify({ registrationId: existingRegId }),
            });

            if (!res.ok) {
                const errData = await res.json();
                throw new Error(errData.error || 'Không thể xóa đăng ký');
            }

            setSelectedShifts(Array(7).fill([]));
            setAllRegistrations(prev => prev.filter(r => r.id !== existingRegId));
            setExistingRegId(null);
            setSuccess('Đã xóa thành công lịch đăng ký.');
        } catch (err: unknown) {
            console.error('Delete error:', err);
            setError(err instanceof Error ? err.message : 'Không thể xóa đăng ký');
        } finally {
            setSaving(false);
        }
    };

    // ─── Loading State ────────────────────────────────────────────────────────
    if (loading) {
        return (
            <div className="flex justify-center items-center h-64">
                <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
            </div>
        );
    }

    const isClosed = !settings?.registrationOpen;
    const isFT = userDoc?.type === 'FT';

    return (
        <div className="space-y-6 max-w-5xl mx-auto">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent flex items-center gap-2">
                        <CalendarIcon className="w-7 h-7 text-blue-600" />
                        Đăng ký Lịch làm
                    </h1>
                    <p className="text-slate-500 mt-1 flex items-center gap-2">
                        Chọn thời gian bạn có thể làm việc cho tuần tới.
                        <span className="bg-slate-100 text-slate-700 px-2 py-0.5 rounded text-xs font-bold border border-slate-200 uppercase">
                            Nhân viên {isFT ? 'Toàn thời gian' : 'Bán thời gian'}
                        </span>
                    </p>
                </div>

                {/* Week Navigation */}
                <div className="flex items-center justify-center gap-4 bg-white p-2 rounded-xl shadow-sm border border-slate-200">
                    <button onClick={handlePreviousWeek} className="p-2 hover:bg-slate-100 rounded-lg transition-colors text-slate-600">
                        <ChevronLeft className="w-5 h-5" />
                    </button>
                    <div className="text-sm font-semibold text-slate-700 min-w-[140px] text-center">
                        {formatDate(weekDays[0])} - {formatDate(weekDays[6])}
                    </div>
                    <button onClick={handleNextWeek} className="p-2 hover:bg-slate-100 rounded-lg transition-colors text-slate-600">
                        <ChevronRight className="w-5 h-5" />
                    </button>
                </div>
            </div>

            {/* ★ REAL-TIME LOCK BANNER — appears instantly when admin closes registration */}
            {isClosed && (
                <div className="bg-amber-50 border border-amber-300 text-amber-800 p-4 rounded-xl flex items-start gap-3 shadow-sm animate-in fade-in slide-in-from-top-2">
                    <Lock className="w-5 h-5 shrink-0 mt-0.5 text-amber-600" />
                    <div>
                        <h3 className="font-bold text-amber-900">Cổng đăng ký đã đóng</h3>
                        <p className="text-sm mt-1">
                            Quản trị viên đã đóng cổng đăng ký ca làm. Bạn chỉ có thể xem — không thể thêm, sửa hoặc xóa lịch.
                        </p>
                    </div>
                </div>
            )}

            {/* Info Panel */}
            <div className="bg-blue-50/50 border border-blue-100 p-4 rounded-xl flex items-start gap-3 text-blue-800 text-sm">
                <Info className="w-5 h-5 shrink-0 text-blue-500 mt-0.5" />
                <div>
                    <strong className="block mb-1 text-blue-900">
                        Quy tắc đăng ký cho {userDoc?.role === 'manager' ? 'Quản lý' : `nhân viên ${isFT ? 'Toàn thời gian' : 'Bán thời gian'}`}:
                    </strong>
                    {userDoc?.role === 'manager' || isFT ? (
                        <ul className="list-disc pl-5 space-y-0.5 marker:text-blue-400 text-blue-700">
                            <li>Bạn phải chọn <strong>đúng 1 ca</strong> cho mỗi ngày đi làm.</li>
                            <li>Bạn bắt buộc phải nghỉ <strong>đúng 1 ngày</strong> mỗi tuần.</li>
                            <li>Không được chọn ngày nghỉ vào <strong>Thứ 7 hoặc Chủ nhật</strong>.</li>
                            {userDoc?.role === 'manager' && <li>Hệ thống sẽ cảnh báo nếu bạn nghỉ trùng ngày với quản lý khác.</li>}
                        </ul>
                    ) : (
                        <ul className="list-disc pl-5 space-y-0.5 marker:text-blue-400 text-blue-700">
                            <li>Bạn chỉ chọn <strong>tối đa 1 ca</strong> mỗi ngày.</li>
                            <li>Không bắt buộc ngày nghỉ, nhưng có thể nghỉ nhiều ngày nếu muốn.</li>
                        </ul>
                    )}
                </div>
            </div>

            {/* Error & Success Messages */}
            {error && (
                <div className="bg-red-50 text-red-600 p-4 rounded-xl flex items-center gap-3 border border-red-100 animate-in fade-in slide-in-from-top-2">
                    <AlertCircle className="w-5 h-5 shrink-0" />
                    <p className="text-sm font-medium">{error}</p>
                </div>
            )}
            {success && (
                <div className="bg-emerald-50 text-emerald-700 p-4 rounded-xl flex items-center gap-3 border border-emerald-200 animate-in fade-in slide-in-from-top-2">
                    <CheckCircle2 className="w-5 h-5 shrink-0 text-emerald-500" />
                    <p className="text-sm font-medium">{success}</p>
                </div>
            )}

            {/* Calendar Grid */}
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                <div className="flex flex-col lg:grid lg:grid-cols-7 lg:divide-x divide-slate-100 divide-y lg:divide-y-0">
                    {weekDays.map((dateStr, i) => {
                        const dateObj = new Date(dateStr + 'T00:00:00');
                        const isToday = new Date().toDateString() === dateObj.toDateString();
                        const dayName = dateObj.toLocaleDateString('vi-VN', { weekday: 'short' });
                        const dayNum = dateObj.getDate();
                        const monthName = dateObj.toLocaleDateString('vi-VN', { month: 'short' });

                        return (
                            <div key={dateStr} className="flex flex-col sm:flex-row lg:flex-col lg:min-h-[300px]">
                                {/* Day Header */}
                                <div className={cn(
                                    'p-3 sm:p-4 sm:w-32 lg:w-auto shrink-0 flex flex-row sm:flex-col items-center sm:justify-start justify-between border-b sm:border-b-0 sm:border-r lg:border-r-0 lg:border-b border-slate-100',
                                    isToday ? 'bg-blue-50/50' : 'bg-slate-50/50'
                                )}>
                                    <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider">{dayName}</div>
                                    <div className={cn(
                                        'text-xl font-bold sm:mt-1 inline-flex items-center justify-center w-8 h-8 sm:w-10 sm:h-10 rounded-full',
                                        isToday ? 'bg-blue-600 text-white shadow-md shadow-blue-500/20' : 'text-slate-800'
                                    )}>
                                        {dayNum}
                                    </div>
                                    <div className="text-xs text-slate-400 mt-1 sm:mt-0.5">{monthName}</div>
                                </div>

                                {/* Shift Buttons */}
                                <div className="flex-1 p-3 flex flex-row flex-wrap sm:flex-col lg:flex-col gap-2 bg-white">
                                    {settings?.shiftTimes.map(shiftId => {
                                        const isSelected = selectedShifts[i].includes(shiftId);
                                        const currentCount = getShiftCount(dateStr, shiftId);
                                        const maxCount = getShiftQuota(dateStr, shiftId);
                                        const isFull = currentCount >= maxCount && !isSelected;

                                        return (
                                            <button
                                                key={shiftId}
                                                type="button"
                                                disabled={isClosed || isFull}
                                                onClick={() => toggleShift(i, shiftId)}
                                                className={cn(
                                                    'flex-1 sm:flex-none sm:w-full min-w-[70px] px-2 py-3 sm:px-3 sm:py-3 text-xs sm:text-sm font-semibold rounded-xl border-2 text-center transition-all duration-200',
                                                    isSelected
                                                        ? 'border-blue-500 bg-blue-50 text-blue-700 shadow-sm'
                                                        : 'border-slate-100 bg-white text-slate-500 hover:border-slate-300 hover:bg-slate-50',
                                                    isClosed && !isSelected && 'opacity-50 cursor-not-allowed hover:border-slate-100 hover:bg-white',
                                                    isClosed && isSelected && 'cursor-not-allowed',
                                                    isFull && !isClosed && 'opacity-50 cursor-not-allowed hover:bg-slate-50 border-red-100 text-red-400 bg-red-50/30'
                                                )}
                                            >
                                                <div className="flex flex-col items-center">
                                                    <span>{shiftId}</span>
                                                    <span className={cn(
                                                        'text-[10px] font-bold mt-0.5',
                                                        isFull ? 'text-red-500' : isSelected ? 'text-blue-500/80' : 'text-slate-400'
                                                    )}>{currentCount}/{maxCount}</span>
                                                </div>
                                            </button>
                                        );
                                    })}

                                    {settings?.shiftTimes.length === 0 && (
                                        <div className="w-full text-xs text-slate-400 text-center mt-2 sm:mt-4">Không có ca</div>
                                    )}

                                    {/* Manager Off Display */}
                                    {userDoc?.role === 'manager' && getManagersOff(dateStr).length > 0 && (
                                        <div className="w-full text-[10px] text-fuchsia-700 bg-fuchsia-50 p-1.5 rounded-lg text-center mt-auto border border-fuchsia-100/50 shadow-sm font-medium">
                                            Nghỉ: {getManagersOff(dateStr).join(', ')}
                                        </div>
                                    )}
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>

            {/* Footer Actions */}
            <div className="flex items-center justify-between pt-4 border-t border-slate-200">
                <div className="text-sm text-slate-500">
                    {existingRegId ? (
                        <span className="flex items-center gap-1.5 text-emerald-600 font-medium">
                            <CheckCircle2 className="w-4 h-4" /> Đã nộp đăng ký cho tuần này
                        </span>
                    ) : (
                        <span>Chưa tìm thấy đăng ký nào cho tuần này.</span>
                    )}
                </div>
                <div className="flex items-center gap-3">
                    {existingRegId && (
                        <button
                            onClick={handleDeleteRegistration}
                            disabled={saving || isClosed}
                            className="flex items-center gap-2 bg-red-50 hover:bg-red-100 text-red-600 px-4 py-2.5 rounded-lg font-medium transition-all disabled:opacity-50 disabled:cursor-not-allowed focus:ring-4 focus:ring-red-500/30 border border-red-200"
                        >
                            <Trash2 className="w-4 h-4" />
                            <span className="hidden sm:inline">Xóa lịch đăng ký</span>
                        </button>
                    )}
                    <button
                        onClick={handleSave}
                        disabled={saving || isClosed}
                        className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-6 py-2.5 rounded-lg font-medium transition-all shadow-lg shadow-blue-600/20 disabled:opacity-50 disabled:cursor-not-allowed focus:ring-4 focus:ring-blue-500/30"
                    >
                        {saving ? (
                            <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                        ) : isClosed ? (
                            <Lock className="w-4 h-4" />
                        ) : (
                            <Save className="w-4 h-4" />
                        )}
                        {isClosed ? 'Đã đóng đăng ký' : 'Lưu Đăng ký'}
                    </button>
                </div>
            </div>
        </div>
    );
}
