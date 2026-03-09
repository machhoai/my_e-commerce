'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { db } from '@/lib/firebase';
import { collection, doc, getDoc, getDocs, query, where } from 'firebase/firestore';
import { UserDoc, CounterDoc, SettingsDoc, WeeklyRegistration, ScheduleDoc, StoreDoc } from '@/types';
import { getWeekStart, getWeekDays, toLocalDateString, formatDate } from '@/lib/utils';
import { useAuth } from '@/contexts/AuthContext';
import DraggableSchedule from '@/components/manager/DraggableSchedule';
import ForceAssignModal from '@/components/manager/ForceAssignModal';
import {
    Calendar, Clock, Save, AlertCircle, CheckCircle2,
    ChevronDown, ChevronLeft, ChevronRight, Building2,
    UserPlus, Undo2, FileWarning, Trash2, Layers,
} from 'lucide-react';

// ─── Draft Types ────────────────────────────────────────────────────────────

/** Inner value for each draft slot: counterId → employeeIds */
type SlotDraft = Record<string, string[]>;

/**
 * Global weekly draft stored in localStorage.
 * Key: `${date}_${shiftId}` — one entry per unique day/shift combination.
 */
type WeeklyDraft = Record<string, SlotDraft>;

// ─── Helpers ─────────────────────────────────────────────────────────────────

function getWeeklyDraftKey(storeId: string, weekStart: Date): string {
    return `weekly_draft_${storeId}_${toLocalDateString(weekStart)}`;
}

function getDayShiftKey(date: string, shiftId: string): string {
    return `${date}_${shiftId}`;
}

function readWeeklyDraft(storeId: string, weekStart: Date): WeeklyDraft {
    if (typeof window === 'undefined') return {};
    try {
        const raw = localStorage.getItem(getWeeklyDraftKey(storeId, weekStart));
        return raw ? (JSON.parse(raw) as WeeklyDraft) : {};
    } catch {
        return {};
    }
}

function saveWeeklyDraft(storeId: string, weekStart: Date, draft: WeeklyDraft): void {
    if (typeof window === 'undefined') return;
    if (Object.keys(draft).length === 0) {
        localStorage.removeItem(getWeeklyDraftKey(storeId, weekStart));
    } else {
        localStorage.setItem(getWeeklyDraftKey(storeId, weekStart), JSON.stringify(draft));
    }
}

// ─── Component ───────────────────────────────────────────────────────────────

export default function ManagerSchedulePage() {
    const { user, userDoc } = useAuth();

    const [currentWeekStart, setCurrentWeekStart] = useState<Date>(getWeekStart(new Date(new Date().getTime() + 7 * 24 * 60 * 60 * 1000)));
    const weekDays = getWeekDays(currentWeekStart);
    const [selectedDate, setSelectedDate] = useState(toLocalDateString(getWeekStart(new Date(new Date().getTime() + 7 * 24 * 60 * 60 * 1000))));
    const [selectedShiftId, setSelectedShiftId] = useState<string>('');

    const [shiftTimes, setShiftTimes] = useState<string[]>([]);
    const [counters, setCounters] = useState<CounterDoc[]>([]);
    const [registeredEmployees, setRegisteredEmployees] = useState<UserDoc[]>([]);
    const [managerAssignedUids, setManagerAssignedUids] = useState<Set<string>>(new Set());
    const [inactiveUids, setInactiveUids] = useState<Set<string>>(new Set());
    const [assignments, setAssignments] = useState<Record<string, string[]>>({});
    const [showForceAssignModal, setShowForceAssignModal] = useState(false);

    const [loadingConfig, setLoadingConfig] = useState(true);
    const [loadingData, setLoadingData] = useState(false);
    const [saving, setSaving] = useState(false);
    const isInitialLoad = useRef(true);

    /**
     * serverAssignments: snapshot of what Firestore has for the CURRENT view (date+shift).
     * Used to diff against current `assignments` to determine if there are local changes.
     */
    const serverAssignments = useRef<Record<string, string[]>>({});

    /**
     * weeklyDraftRef: in-memory mirror of the full weekly draft (all days/shifts).
     * Updated whenever assignments change, and persisted to localStorage.
     */
    const weeklyDraftRef = useRef<WeeklyDraft>({});

    const [totalDraftSlots, setTotalDraftSlots] = useState(0); // # of day/shift slots with draft changes
    const [hasDraftChanges, setHasDraftChanges] = useState(false);
    const [draftLoaded, setDraftLoaded] = useState(false);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');

    // Admin-only: store selector
    const [stores, setStores] = useState<StoreDoc[]>([]);
    const [selectedAdminStoreId, setSelectedAdminStoreId] = useState<string>(() => {
        if (typeof window !== 'undefined') {
            return localStorage.getItem('globalSelectedStoreId') || '';
        }
        return '';
    });

    const effectiveStoreId = userDoc?.role === 'admin' ? selectedAdminStoreId : userDoc?.storeId ?? '';

    useEffect(() => {
        if (typeof window !== 'undefined' && selectedAdminStoreId) {
            localStorage.setItem('globalSelectedStoreId', selectedAdminStoreId);
        }
    }, [selectedAdminStoreId]);

    // ── 1. Load admin stores list / manager counters ──────────────────────────
    useEffect(() => {
        if (userDoc === undefined) return;
        async function loadConfig() {
            try {
                if (userDoc?.role === 'admin' && user) {
                    const token = await user.getIdToken();
                    const res = await fetch('/api/stores', { headers: { 'Authorization': `Bearer ${token}` } });
                    const storeData = await res.json();
                    setStores(Array.isArray(storeData) ? storeData : []);
                } else if (userDoc?.storeId) {
                    const storeSnap = await getDoc(doc(db, 'stores', userDoc.storeId));
                    if (storeSnap.exists()) {
                        const sData = storeSnap.data() as StoreDoc;
                        const countersData = (sData.settings as any)?.counters || [];
                        setCounters(countersData);
                        const shifts = sData.settings?.shiftTimes || [];
                        setShiftTimes(shifts);
                        if (shifts.length > 0) setSelectedShiftId(shifts[0]);
                    } else {
                        setCounters([]);
                        setShiftTimes([]);
                    }
                }
            } catch (err) {
                console.error(err);
                setError('Không thể tải cài đặt hệ thống');
            } finally {
                setLoadingConfig(false);
            }
        }
        loadConfig();
    }, [userDoc, user]);

    // ── 2. When admin picks a store, load its counters ────────────────────────
    useEffect(() => {
        if (userDoc?.role !== 'admin' || !selectedAdminStoreId) return;
        async function loadAdminCounters() {
            const storeSnap = await getDoc(doc(db, 'stores', selectedAdminStoreId));
            if (storeSnap.exists()) {
                const sData = storeSnap.data() as StoreDoc;
                const countersData = (sData.settings as any)?.counters || [];
                setCounters(countersData);
                const shifts = sData.settings?.shiftTimes || [];
                setShiftTimes(shifts);
                setSelectedShiftId(shifts.length > 0 ? shifts[0] : '');
            } else {
                setCounters([]);
                setShiftTimes([]);
                setSelectedShiftId('');
            }
        }
        loadAdminCounters();
    }, [selectedAdminStoreId, userDoc]);

    // ── 3. Load employees + server schedule when date/shift changes ───────────
    useEffect(() => {
        if (!selectedDate || !selectedShiftId || !effectiveStoreId) return;

        async function loadData() {
            isInitialLoad.current = true;
            setLoadingData(true);
            setError('');
            setSuccess('');
            try {
                const requestWeekStart = getWeekStart(new Date(selectedDate + 'T00:00:00'));

                // --- Registrations ---
                const regQuery = query(
                    collection(db, 'weekly_registrations'),
                    where('weekStartDate', '==', toLocalDateString(requestWeekStart)),
                    where('storeId', '==', effectiveStoreId)
                );
                const regSnap = await getDocs(regQuery);

                const uidsForShift = new Set<string>();
                const forceAssignedUids = new Set<string>();
                regSnap.docs.forEach(d => {
                    const reg = d.data() as WeeklyRegistration;
                    const matchingShift = reg.shifts.find(s => s.date === selectedDate && s.shiftId === selectedShiftId);
                    if (matchingShift) {
                        uidsForShift.add(reg.userId);
                        if (matchingShift.isAssignedByManager) forceAssignedUids.add(reg.userId);
                    }
                });

                const users: UserDoc[] = [];
                if (uidsForShift.size > 0) {
                    const uidsArray = Array.from(uidsForShift);
                    for (let i = 0; i < uidsArray.length; i += 10) {
                        const chunk = uidsArray.slice(i, i + 10);
                        const qUsers = query(collection(db, 'users'), where('uid', 'in', chunk));
                        const uSnap = await getDocs(qUsers);
                        uSnap.docs.forEach(u => users.push(u.data() as UserDoc));
                    }
                }
                users.sort((a, b) => a.name.localeCompare(b.name));

                const inactive = new Set(users.filter(u => u.isActive === false).map(u => u.uid));
                setInactiveUids(inactive);
                setRegisteredEmployees(users.filter(u => u.isActive !== false));
                setManagerAssignedUids(forceAssignedUids);

                // --- Server schedule for this day/shift ---
                const qScheds = query(
                    collection(db, 'schedules'),
                    where('date', '==', selectedDate),
                    where('shiftId', '==', selectedShiftId)
                );
                const schedsMulti = await getDocs(qScheds);
                const serverSlot: Record<string, string[]> = {};
                counters.forEach(c => (serverSlot[c.id] = []));
                schedsMulti.docs.forEach(docSnap => {
                    const sData = docSnap.data() as ScheduleDoc;
                    if (serverSlot[sData.counterId] !== undefined) {
                        serverSlot[sData.counterId] = sData.employeeIds || [];
                    }
                });

                // Snapshot clean server state for this slot
                serverAssignments.current = JSON.parse(JSON.stringify(serverSlot));

                // --- Hydrate weekly draft from localStorage ---
                const weeklyDraft = readWeeklyDraft(effectiveStoreId, requestWeekStart);
                weeklyDraftRef.current = weeklyDraft;

                const dayShiftKey = getDayShiftKey(selectedDate, selectedShiftId);
                const draftSlot = weeklyDraft[dayShiftKey];

                if (draftSlot) {
                    setAssignments(draftSlot);
                    setDraftLoaded(true);
                    setHasDraftChanges(true);
                } else {
                    setAssignments(serverSlot);
                    setDraftLoaded(false);
                    setHasDraftChanges(false);
                }

                // Recount how many slots have draft changes
                setTotalDraftSlots(Object.keys(weeklyDraft).length);

                setTimeout(() => { isInitialLoad.current = false; }, 300);
            } catch (err) {
                console.error(err);
                setError('Không thể tải danh sách nhân viên đã đăng ký');
            } finally {
                setLoadingData(false);
            }
        }
        loadData();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [selectedDate, selectedShiftId, counters, effectiveStoreId]);

    // ── 4. Persist draft slice when assignments change ────────────────────────
    useEffect(() => {
        if (isInitialLoad.current || typeof window === 'undefined') return;
        if (!selectedDate || !selectedShiftId || !effectiveStoreId) return;

        const requestWeekStart = getWeekStart(new Date(selectedDate + 'T00:00:00'));
        const dayShiftKey = getDayShiftKey(selectedDate, selectedShiftId);
        const isDifferent = JSON.stringify(assignments) !== JSON.stringify(serverAssignments.current);

        setHasDraftChanges(isDifferent);

        // Update the in-memory weekly draft
        const weeklyDraft = { ...weeklyDraftRef.current };
        if (isDifferent) {
            weeklyDraft[dayShiftKey] = assignments;
        } else {
            delete weeklyDraft[dayShiftKey];
        }
        weeklyDraftRef.current = weeklyDraft;
        saveWeeklyDraft(effectiveStoreId, requestWeekStart, weeklyDraft);
        setTotalDraftSlots(Object.keys(weeklyDraft).length);
    }, [assignments, selectedDate, selectedShiftId, effectiveStoreId]);

    // ── Reload data after force-assign add/remove ─────────────────────────────
    const triggerReload = useCallback(() => {
        if (!effectiveStoreId || !selectedDate || !selectedShiftId) return;

        setLoadingData(true);
        (async () => {
            try {
                const requestWeekStart = getWeekStart(new Date(selectedDate + 'T00:00:00'));
                const regQuery = query(
                    collection(db, 'weekly_registrations'),
                    where('weekStartDate', '==', toLocalDateString(requestWeekStart)),
                    where('storeId', '==', effectiveStoreId)
                );
                const regSnap = await getDocs(regQuery);

                const uidsForShift = new Set<string>();
                const forceAssignedUids = new Set<string>();
                regSnap.docs.forEach(d => {
                    const reg = d.data() as WeeklyRegistration;
                    const matchingShift = reg.shifts.find(s => s.date === selectedDate && s.shiftId === selectedShiftId);
                    if (matchingShift) {
                        uidsForShift.add(reg.userId);
                        if (matchingShift.isAssignedByManager) forceAssignedUids.add(reg.userId);
                    }
                });

                const users: UserDoc[] = [];
                if (uidsForShift.size > 0) {
                    const uidsArray = Array.from(uidsForShift);
                    for (let i = 0; i < uidsArray.length; i += 10) {
                        const chunk = uidsArray.slice(i, i + 10);
                        const qUsers = query(collection(db, 'users'), where('uid', 'in', chunk));
                        const uSnap = await getDocs(qUsers);
                        uSnap.docs.forEach(u => users.push(u.data() as UserDoc));
                    }
                }
                users.sort((a, b) => a.name.localeCompare(b.name));

                const inactive = new Set(users.filter(u => u.isActive === false).map(u => u.uid));
                setInactiveUids(inactive);
                setRegisteredEmployees(users.filter(u => u.isActive !== false));
                setManagerAssignedUids(forceAssignedUids);
            } catch (err) {
                console.error(err);
            } finally {
                setLoadingData(false);
            }
        })();
    }, [effectiveStoreId, selectedDate, selectedShiftId]);

    const handleRemoveRegistration = async (uid: string) => {
        if (!user) return;
        try {
            const token = await user.getIdToken();
            const weekStartDate = toLocalDateString(getWeekStart(new Date(selectedDate + 'T00:00:00')));
            const res = await fetch('/api/register/force-assign', {
                method: 'DELETE',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                body: JSON.stringify({ targetUserId: uid, weekStartDate, date: selectedDate, shiftId: selectedShiftId }),
            });
            if (!res.ok) {
                const errData = await res.json();
                throw new Error(errData.error || 'Không thể hủy gán ca');
            }
            const newAssignments = { ...assignments };
            for (const counterId of Object.keys(newAssignments)) {
                newAssignments[counterId] = newAssignments[counterId].filter(id => id !== uid);
            }
            setAssignments(newAssignments);
            triggerReload();
        } catch (err) {
            console.error(err);
            setError(err instanceof Error ? err.message : 'Không thể hủy gán ca');
        }
    };

    // ── Discard current day/shift draft only ──────────────────────────────────
    const handleDiscardDraft = () => {
        if (!effectiveStoreId || !selectedDate || !selectedShiftId) return;
        const requestWeekStart = getWeekStart(new Date(selectedDate + 'T00:00:00'));
        const dayShiftKey = getDayShiftKey(selectedDate, selectedShiftId);

        const weeklyDraft = { ...weeklyDraftRef.current };
        delete weeklyDraft[dayShiftKey];
        weeklyDraftRef.current = weeklyDraft;
        saveWeeklyDraft(effectiveStoreId, requestWeekStart, weeklyDraft);

        setAssignments(JSON.parse(JSON.stringify(serverAssignments.current)));
        setHasDraftChanges(false);
        setDraftLoaded(false);
        setTotalDraftSlots(Object.keys(weeklyDraft).length);
        setSuccess('');
        setError('');
    };

    // ── Discard ENTIRE weekly draft ───────────────────────────────────────────
    const handleDiscardAllDrafts = () => {
        if (!effectiveStoreId) return;
        const requestWeekStart = getWeekStart(new Date(selectedDate + 'T00:00:00'));
        weeklyDraftRef.current = {};
        saveWeeklyDraft(effectiveStoreId, requestWeekStart, {});

        setAssignments(JSON.parse(JSON.stringify(serverAssignments.current)));
        setHasDraftChanges(false);
        setDraftLoaded(false);
        setTotalDraftSlots(0);
        setSuccess('');
        setError('');
    };

    // ── Save & Publish ALL drafts ─────────────────────────────────────────────
    const handleSaveAndPublish = async () => {
        if (!user || !effectiveStoreId) return;

        setSaving(true);
        setError('');
        setSuccess('');
        try {
            const token = await user.getIdToken();

            // Build multi-day payload from the full weekly draft
            // Always include the CURRENT view even if no draft key yet (may be fresh assignments)
            const allDrafts = { ...weeklyDraftRef.current };
            const currentKey = getDayShiftKey(selectedDate, selectedShiftId);

            // Ensure the currently-visible assignments are included
            if (JSON.stringify(assignments) !== JSON.stringify(serverAssignments.current)) {
                allDrafts[currentKey] = assignments;
            }

            if (Object.keys(allDrafts).length === 0) {
                // Nothing to save
                setSaving(false);
                return;
            }

            const days = Object.entries(allDrafts).map(([key, slotDraft]) => {
                const [date, ...shiftParts] = key.split('_');
                const shiftId = shiftParts.join('_'); // handles shift IDs with underscores
                return {
                    date,
                    shiftId,
                    assignments: Object.fromEntries(
                        Object.entries(slotDraft).map(([counterId, uids]) => [
                            counterId,
                            {
                                employeeIds: uids,
                                assignedByManagerUids: uids.filter(uid => managerAssignedUids.has(uid)),
                            },
                        ])
                    ),
                };
            });

            const payload = { storeId: effectiveStoreId, days };

            const res = await fetch('/api/schedules/bulk', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                body: JSON.stringify(payload),
            });

            if (!res.ok) {
                const errorData = await res.json();
                throw new Error(errorData.error || 'Lỗi hệ thống');
            }

            const result = await res.json();

            // Clear all drafts after successful save
            const requestWeekStart = getWeekStart(new Date(selectedDate + 'T00:00:00'));
            weeklyDraftRef.current = {};
            saveWeeklyDraft(effectiveStoreId, requestWeekStart, {});

            serverAssignments.current = JSON.parse(JSON.stringify(assignments));
            setHasDraftChanges(false);
            setDraftLoaded(false);
            setTotalDraftSlots(0);

            setSuccess(`Đã lưu và công khai ${result.savedDays ?? days.length} ca làm việc thành công!`);
        } catch (err) {
            console.error(err);
            setError(err instanceof Error ? err.message : 'Không thể công khai lịch làm việc');
        } finally {
            setSaving(false);
        }
    };

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

    // ── Guards ────────────────────────────────────────────────────────────────

    if (loadingConfig) {
        return (
            <div className="flex justify-center items-center h-64">
                <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
            </div>
        );
    }

    if (!userDoc || (userDoc.role !== 'admin' && userDoc.role !== 'store_manager' && !userDoc.canManageHR)) {
        return (
            <div className="flex flex-col items-center justify-center h-64 space-y-4">
                <AlertCircle className="w-12 h-12 text-red-500" />
                <h2 className="text-xl font-bold text-slate-800">Không có quyền truy cập</h2>
                <p className="text-slate-500">Bạn không được cấp quyền để xếp lịch nhân viên.</p>
            </div>
        );
    }

    const showDraftBar = hasDraftChanges || draftLoaded || totalDraftSlots > 0;

    return (
        <div className="h-full flex flex-col gap-4">
            {/* Admin Store Selector Banner */}
            {userDoc?.role === 'admin' && (
                <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-3 flex flex-col sm:flex-row items-start sm:items-center gap-3">
                    <div className="flex items-center gap-2 shrink-0">
                        <Building2 className="w-4 h-4 text-indigo-500" />
                        <span className="text-sm font-semibold text-slate-700">Cửa hàng:</span>
                    </div>
                    <select
                        value={selectedAdminStoreId}
                        onChange={e => setSelectedAdminStoreId(e.target.value)}
                        className="flex-1 border border-slate-200 rounded-lg p-2 text-sm outline-none focus:ring-2 focus:ring-indigo-300 focus:border-indigo-400 bg-slate-50 font-medium"
                    >
                        <option value="">-- Chọn cửa hàng để xem lịch --</option>
                        {stores.map(s => <option key={s.id} value={s.id}>{(s as any).type === 'OFFICE' ? '🏢' : (s as any).type === 'CENTRAL' ? '🏭' : '🏪'} {s.name}</option>)}
                    </select>
                    {!effectiveStoreId && (
                        <p className="text-xs text-amber-600 font-medium shrink-0">⚠️ Chọn cửa hàng để tiếp tục</p>
                    )}
                </div>
            )}

            {/* Show empty state for admin who hasn't picked a store */}
            {userDoc?.role === 'admin' && !effectiveStoreId ? (
                <div className="flex-1 flex flex-col items-center justify-center bg-white rounded-2xl border border-dashed border-slate-300 p-16 text-center">
                    <Building2 className="w-14 h-14 mx-auto mb-4 text-slate-300" />
                    <h3 className="text-lg font-semibold text-slate-600 mb-2">Vui lòng chọn cửa hàng</h3>
                    <p className="text-slate-400 text-sm max-w-sm mx-auto">
                        Chọn một cửa hàng từ thanh trên để xem và phân công lịch làm việc.
                    </p>
                </div>
            ) : (
                <>
                    {/* Header + Controls */}
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                        <div>
                            <h1 className="text-2xl font-bold bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent flex items-center gap-2">
                                <Calendar className="w-7 h-7 text-blue-600" />
                                Quản lý Lịch làm việc
                            </h1>
                            <p className="text-slate-500 mt-1">Kéo hoặc nhấn chọn nhân viên rồi nhấn vào quầy để phân công ca làm.</p>
                        </div>

                        <div className="flex items-stretch flex-col md:flex-row gap-4">
                            <div className="flex items-center justify-center w-full gap-2 bg-white p-2 rounded-xl shadow-sm border border-slate-200">
                                <button onClick={handlePreviousWeek} className="p-1.5 hover:bg-slate-100 rounded-lg transition-colors text-slate-600">
                                    <ChevronLeft className="w-5 h-5" />
                                </button>
                                <div className="text-sm font-semibold text-slate-700 min-w-[140px] text-center flex-1 truncate">
                                    {formatDate(weekDays[0])} - {formatDate(weekDays[6])}
                                </div>
                                <button onClick={handleNextWeek} className="p-1.5 hover:bg-slate-100 rounded-lg transition-colors text-slate-600">
                                    <ChevronRight className="w-5 h-5" />
                                </button>
                            </div>

                            <div className="w-px items-stretch bg-slate-200 hidden md:block" />

                            <div className="relative w-full h-full bg-white p-2 rounded-xl shadow-sm border border-slate-200">
                                <Clock className="size-5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                                <select
                                    value={selectedShiftId}
                                    onChange={e => setSelectedShiftId(e.target.value)}
                                    className="pl-10 pr-8 py-2 w-full h-full text-sm font-medium text-slate-700 outline-none focus:ring-2 focus:ring-blue-500 appearance-none cursor-pointer min-w-[140px]"
                                >
                                    {shiftTimes.length === 0 && <option value="">Không có ca làm nào</option>}
                                    {shiftTimes.map(shift => <option key={shift} value={shift}>{shift}</option>)}
                                </select>
                                <ChevronDown className="w-4 h-4 absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                            </div>
                        </div>
                    </div>

                    {/* 7-Day Date Picker */}
                    <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-2 overflow-x-auto">
                        <div className="flex gap-2 min-w-max">
                            {weekDays.map(dateStr => {
                                const d = new Date(dateStr + 'T00:00:00');
                                const isSelected = dateStr === selectedDate;
                                const isToday = dateStr === toLocalDateString(new Date());
                                // Check if this day has any draft changes
                                const hasDraftForDay = Object.keys(weeklyDraftRef.current).some(k => k.startsWith(dateStr));
                                const dayName = d.toLocaleDateString('vi-VN', { weekday: 'short' });
                                const dateNum = d.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit' });
                                return (
                                    <button
                                        key={dateStr}
                                        onClick={() => setSelectedDate(dateStr)}
                                        className={`relative flex flex-col items-center justify-center flex-1 p-2 rounded-lg border-2 transition-all ${isSelected
                                            ? 'border-blue-500 bg-blue-50 text-blue-700 shadow-sm'
                                            : 'border-transparent hover:border-slate-200 hover:bg-slate-50 text-slate-500'
                                            }`}
                                    >
                                        <span className={`text-xs font-semibold uppercase ${isSelected ? 'text-blue-600' : 'text-slate-400'}`}>{dayName}</span>
                                        <span className={`text-lg font-bold mt-0.5 truncate ${isSelected ? 'text-blue-800' : 'text-slate-700'}`}>{dateNum}</span>
                                        {isToday && !isSelected && <span className="w-1.5 h-1.5 rounded-full bg-blue-500 mt-1"></span>}
                                        {/* Draft indicator dot */}
                                        {hasDraftForDay && !isSelected && (
                                            <span className="absolute top-1 right-1 w-2 h-2 rounded-full bg-amber-400 border border-white" title="Có thay đổi chưa lưu" />
                                        )}
                                        {hasDraftForDay && isSelected && (
                                            <span className="absolute top-1 right-1 w-2 h-2 rounded-full bg-amber-400 border border-blue-200" title="Có thay đổi chưa lưu" />
                                        )}
                                    </button>
                                );
                            })}
                        </div>
                    </div>

                    {error && (
                        <div className="bg-red-50 text-red-600 p-4 rounded-xl flex items-center gap-3 border border-red-100 shadow-sm">
                            <AlertCircle className="w-5 h-5 shrink-0" />
                            <p className="text-sm font-medium">{error}</p>
                        </div>
                    )}

                    {success && (
                        <div className="bg-emerald-50 text-emerald-700 p-4 rounded-xl flex items-center gap-3 border border-emerald-200 shadow-sm">
                            <CheckCircle2 className="w-5 h-5 shrink-0 text-emerald-500" />
                            <div className="flex-1 flex items-center justify-between">
                                <p className="text-sm font-medium">{success}</p>
                                <button onClick={() => setSuccess('')} className="text-emerald-600 hover:text-emerald-800 text-xs font-semibold px-2 py-1 bg-emerald-100/50 rounded-md">Đóng</button>
                            </div>
                        </div>
                    )}

                    <DraggableSchedule
                        employees={registeredEmployees}
                        counters={counters}
                        assignments={assignments}
                        onAssignmentChange={setAssignments}
                        isLoading={loadingData}
                        inactiveUids={inactiveUids}
                        managerAssignedUids={managerAssignedUids}
                        onRemoveRegistration={handleRemoveRegistration}
                        selectedShiftId={selectedShiftId}
                        setShowForceAssignModal={setShowForceAssignModal}
                    />

                    <ForceAssignModal
                        isOpen={showForceAssignModal}
                        onClose={() => setShowForceAssignModal(false)}
                        storeId={effectiveStoreId || ''}
                        selectedDate={selectedDate}
                        selectedShiftId={selectedShiftId}
                        registeredUids={new Set(registeredEmployees.map(e => e.uid))}
                        onSuccess={triggerReload}
                    />

                    {/* Draft Action Bar */}
                    {showDraftBar && (
                        <div className="sticky bottom-2 z-30 mt-4">
                            <div className="bg-white/95 backdrop-blur-md border-2 border-amber-300 rounded-2xl shadow-xl shadow-amber-500/10 p-4">
                                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                                    <div className="flex items-center gap-3">
                                        <div className="w-10 h-10 bg-amber-100 rounded-xl flex items-center justify-center shrink-0">
                                            <FileWarning className="w-5 h-5 text-amber-600" />
                                        </div>
                                        <div>
                                            <p className="text-sm font-bold text-slate-800 flex items-center gap-2">
                                                Có thay đổi chưa lưu
                                                {totalDraftSlots > 1 && (
                                                    <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 bg-amber-100 text-amber-700 rounded-full border border-amber-200">
                                                        <Layers className="w-3 h-3" />
                                                        {totalDraftSlots} ca
                                                    </span>
                                                )}
                                            </p>
                                            <p className="text-xs text-slate-500">
                                                {totalDraftSlots > 1
                                                    ? `${totalDraftSlots} ca làm trên nhiều ngày chưa được lưu. Nhấn "Lưu và Công khai" để lưu tất cả.`
                                                    : draftLoaded
                                                        ? 'Đang hiển thị bản nháp chưa lưu. Nhấn "Lưu và Công khai" để áp dụng.'
                                                        : 'Lịch làm việc đã được chỉnh sửa nhưng chưa công khai cho nhân viên.'}
                                            </p>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-2 w-full sm:w-auto flex-wrap">
                                        {/* Discard current slot */}
                                        <button
                                            onClick={handleDiscardDraft}
                                            disabled={saving || !hasDraftChanges}
                                            className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-4 py-2.5 border-2 border-slate-200 text-slate-600 hover:bg-slate-50 hover:border-slate-300 rounded-xl font-semibold text-sm transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                                            title="Hủy bản nháp ca hiện tại"
                                        >
                                            <Undo2 className="w-4 h-4" />
                                            Hủy ca này
                                        </button>
                                        {/* Discard all drafts */}
                                        {totalDraftSlots > 0 && (
                                            <button
                                                onClick={handleDiscardAllDrafts}
                                                disabled={saving}
                                                className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-4 py-2.5 border-2 border-red-200 text-red-600 hover:bg-red-50 hover:border-red-300 rounded-xl font-semibold text-sm transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                                                title="Hủy tất cả bản nháp cả tuần"
                                            >
                                                <Trash2 className="w-4 h-4" />
                                                Hủy toàn bộ
                                            </button>
                                        )}
                                        {/* Save & Publish */}
                                        <button
                                            onClick={handleSaveAndPublish}
                                            disabled={saving || loadingData}
                                            className="flex-1 sm:flex-none flex items-center justify-center gap-2 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white px-6 py-2.5 rounded-xl font-semibold text-sm transition-all shadow-lg shadow-blue-600/20 disabled:opacity-50 disabled:cursor-not-allowed"
                                        >
                                            {saving ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> : <Save className="w-4 h-4" />}
                                            {totalDraftSlots > 1 ? `Lưu ${totalDraftSlots} ca` : 'Lưu và Công khai'}
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}
                </>
            )}
        </div>
    );
}
