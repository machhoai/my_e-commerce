'use client';

import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { db } from '@/lib/firebase';
import { collection, doc, getDoc, getDocs, query, where } from 'firebase/firestore';
import { UserDoc, CounterDoc, ScheduleDoc, WeeklyRegistration, StoreDoc } from '@/types';
import { getWeekStart, getWeekDays, toLocalDateString, cn } from '@/lib/utils';
import { useAuth } from '@/contexts/AuthContext';
import DraggableSchedule from '@/components/manager/DraggableSchedule';
import ForceAssignModal from '@/components/manager/ForceAssignModal';
import {
    ChevronLeft, ChevronRight, Building2, Save,
    AlertCircle, CheckCircle2, FileWarning, Trash2, Layers, Undo2,
} from 'lucide-react';
import MobilePageShell from '@/components/mobile/MobilePageShell';
import BottomSheet from '@/components/shared/BottomSheet';

// ─── Draft helpers (same as desktop) ─────────────────────────────────────────
type SlotDraft = Record<string, string[]>;
type WeeklyDraft = Record<string, SlotDraft>;

function getWeeklyDraftKey(storeId: string, weekStart: Date) { return `weekly_draft_${storeId}_${toLocalDateString(weekStart)}`; }
function getDayShiftKey(date: string, shiftId: string) { return `${date}_${shiftId}`; }
function readWeeklyDraft(storeId: string, weekStart: Date): WeeklyDraft {
    if (typeof window === 'undefined') return {};
    try { const raw = localStorage.getItem(getWeeklyDraftKey(storeId, weekStart)); return raw ? JSON.parse(raw) : {}; } catch { return {}; }
}
function saveWeeklyDraft(storeId: string, weekStart: Date, draft: WeeklyDraft) {
    if (typeof window === 'undefined') return;
    if (Object.keys(draft).length === 0) localStorage.removeItem(getWeeklyDraftKey(storeId, weekStart));
    else localStorage.setItem(getWeeklyDraftKey(storeId, weekStart), JSON.stringify(draft));
}

export default function MobileSchedulingBuilderPage() {
    const { user, userDoc, hasPermission } = useAuth();

    const [currentWeekStart, setCurrentWeekStart] = useState<Date>(getWeekStart(new Date(Date.now() + 7 * 86400000)));
    const weekDays = getWeekDays(currentWeekStart);
    const [selectedDayIdx, setSelectedDayIdx] = useState(0);
    const selectedDate = weekDays[selectedDayIdx] ?? '';

    const [shiftTimes, setShiftTimes] = useState<string[]>([]);
    const [selectedShiftId, setSelectedShiftId] = useState('');
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
    const serverAssignments = useRef<Record<string, string[]>>({});
    const weeklyDraftRef = useRef<WeeklyDraft>({});

    const [totalDraftSlots, setTotalDraftSlots] = useState(0);
    const [hasDraftChanges, setHasDraftChanges] = useState(false);
    const [draftLoaded, setDraftLoaded] = useState(false);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');

    const [stores, setStores] = useState<StoreDoc[]>([]);
    const [selectedAdminStoreId, setSelectedAdminStoreId] = useState<string>(() => {
        if (typeof window !== 'undefined') return localStorage.getItem('globalSelectedStoreId') || '';
        return '';
    });
    const [storeSheetOpen, setStoreSheetOpen] = useState(false);

    const isAdmin = userDoc?.role === 'admin';
    const effectiveStoreId = isAdmin ? selectedAdminStoreId : userDoc?.storeId ?? '';

    useEffect(() => {
        if (typeof window !== 'undefined' && selectedAdminStoreId) localStorage.setItem('globalSelectedStoreId', selectedAdminStoreId);
    }, [selectedAdminStoreId]);

    const selectedStoreName = useMemo(() => {
        if (!selectedAdminStoreId) return 'Chọn cửa hàng';
        return stores.find(s => s.id === selectedAdminStoreId)?.name ?? selectedAdminStoreId;
    }, [selectedAdminStoreId, stores]);

    const dayNames = ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'];
    const previousWeek = () => setCurrentWeekStart(d => { const nd = new Date(d); nd.setDate(nd.getDate() - 7); return nd; });
    const nextWeek = () => setCurrentWeekStart(d => { const nd = new Date(d); nd.setDate(nd.getDate() + 7); return nd; });
    const isToday = (dateStr: string) => new Date().toDateString() === new Date(dateStr + 'T00:00:00').toDateString();

    // ── 1. Load admin stores / config ────────────────────────────────────────
    useEffect(() => {
        if (userDoc === undefined) return;
        (async () => {
            try {
                if (isAdmin && user) {
                    const token = await user.getIdToken();
                    const res = await fetch('/api/stores', { headers: { Authorization: `Bearer ${token}` } });
                    const data = await res.json();
                    setStores(Array.isArray(data) ? data : []);
                } else if (userDoc?.storeId) {
                    const snap = await getDoc(doc(db, 'stores', userDoc.storeId));
                    if (snap.exists()) {
                        const s = snap.data() as StoreDoc;
                        setCounters((s.settings as any)?.counters || []);
                        const shifts = s.settings?.shiftTimes || [];
                        setShiftTimes(shifts);
                        if (shifts.length > 0) setSelectedShiftId(shifts[0]);
                    }
                }
            } catch { setError('Không thể tải cài đặt'); }
            finally { setLoadingConfig(false); }
        })();
    }, [userDoc, user, isAdmin]);

    // ── 2. Admin picks store → load counters ──────────────────────────────────
    useEffect(() => {
        if (!isAdmin || !selectedAdminStoreId) return;
        (async () => {
            const snap = await getDoc(doc(db, 'stores', selectedAdminStoreId));
            if (snap.exists()) {
                const s = snap.data() as StoreDoc;
                setCounters((s.settings as any)?.counters || []);
                const shifts = s.settings?.shiftTimes || [];
                setShiftTimes(shifts);
                setSelectedShiftId(shifts.length > 0 ? shifts[0] : '');
            } else { setCounters([]); setShiftTimes([]); setSelectedShiftId(''); }
        })();
    }, [selectedAdminStoreId, isAdmin]);

    // ── 3. Load employees + server schedule ───────────────────────────────────
    useEffect(() => {
        if (!selectedDate || !selectedShiftId || !effectiveStoreId) return;
        (async () => {
            isInitialLoad.current = true;
            setLoadingData(true); setError(''); setSuccess('');
            try {
                const wk = getWeekStart(new Date(selectedDate + 'T00:00:00'));
                const regSnap = await getDocs(query(collection(db, 'weekly_registrations'), where('weekStartDate', '==', toLocalDateString(wk)), where('storeId', '==', effectiveStoreId)));
                const uidsForShift = new Set<string>(), forceUids = new Set<string>();
                regSnap.docs.forEach(d => {
                    const reg = d.data() as WeeklyRegistration;
                    const m = reg.shifts.find(s => s.date === selectedDate && s.shiftId === selectedShiftId);
                    if (m) { uidsForShift.add(reg.userId); if (m.isAssignedByManager) forceUids.add(reg.userId); }
                });
                const users: UserDoc[] = [];
                if (uidsForShift.size > 0) {
                    const arr = Array.from(uidsForShift);
                    for (let i = 0; i < arr.length; i += 10) {
                        const chunk = arr.slice(i, i + 10);
                        const uSnap = await getDocs(query(collection(db, 'users'), where('uid', 'in', chunk)));
                        uSnap.docs.forEach(u => users.push(u.data() as UserDoc));
                    }
                }
                users.sort((a, b) => a.name.localeCompare(b.name));
                setInactiveUids(new Set(users.filter(u => u.isActive === false).map(u => u.uid)));
                setRegisteredEmployees(users.filter(u => u.isActive !== false));
                setManagerAssignedUids(forceUids);

                const schedsSnap = await getDocs(query(collection(db, 'schedules'), where('date', '==', selectedDate), where('shiftId', '==', selectedShiftId)));
                const serverSlot: Record<string, string[]> = {};
                counters.forEach(c => serverSlot[c.id] = []);
                schedsSnap.docs.forEach(d => { const s = d.data() as ScheduleDoc; if (serverSlot[s.counterId] !== undefined) serverSlot[s.counterId] = s.employeeIds || []; });
                serverAssignments.current = JSON.parse(JSON.stringify(serverSlot));

                const draft = readWeeklyDraft(effectiveStoreId, wk);
                weeklyDraftRef.current = draft;
                const dsk = getDayShiftKey(selectedDate, selectedShiftId);
                if (draft[dsk]) { setAssignments(draft[dsk]); setDraftLoaded(true); setHasDraftChanges(true); }
                else { setAssignments(serverSlot); setDraftLoaded(false); setHasDraftChanges(false); }
                setTotalDraftSlots(Object.keys(draft).length);
                setTimeout(() => { isInitialLoad.current = false; }, 300);
            } catch (err) { console.error(err); setError('Không thể tải dữ liệu'); }
            finally { setLoadingData(false); }
        })();
    }, [selectedDate, selectedShiftId, counters, effectiveStoreId]);

    // ── 4. Persist draft on assignment change ─────────────────────────────────
    useEffect(() => {
        if (isInitialLoad.current || typeof window === 'undefined') return;
        if (!selectedDate || !selectedShiftId || !effectiveStoreId) return;
        const wk = getWeekStart(new Date(selectedDate + 'T00:00:00'));
        const dsk = getDayShiftKey(selectedDate, selectedShiftId);
        const isDiff = JSON.stringify(assignments) !== JSON.stringify(serverAssignments.current);
        setHasDraftChanges(isDiff);
        const d = { ...weeklyDraftRef.current };
        if (isDiff) d[dsk] = assignments; else delete d[dsk];
        weeklyDraftRef.current = d;
        saveWeeklyDraft(effectiveStoreId, wk, d);
        setTotalDraftSlots(Object.keys(d).length);
    }, [assignments, selectedDate, selectedShiftId, effectiveStoreId]);

    // ── Reload after force-assign ─────────────────────────────────────────────
    const triggerReload = useCallback(() => {
        if (!effectiveStoreId || !selectedDate || !selectedShiftId) return;
        setLoadingData(true);
        (async () => {
            try {
                const wk = getWeekStart(new Date(selectedDate + 'T00:00:00'));
                const regSnap = await getDocs(query(collection(db, 'weekly_registrations'), where('weekStartDate', '==', toLocalDateString(wk)), where('storeId', '==', effectiveStoreId)));
                const uids = new Set<string>(), forceUids = new Set<string>();
                regSnap.docs.forEach(d => { const reg = d.data() as WeeklyRegistration; const m = reg.shifts.find(s => s.date === selectedDate && s.shiftId === selectedShiftId); if (m) { uids.add(reg.userId); if (m.isAssignedByManager) forceUids.add(reg.userId); } });
                const users: UserDoc[] = [];
                if (uids.size > 0) { const a = Array.from(uids); for (let i = 0; i < a.length; i += 10) { const c = a.slice(i, i + 10); const uSnap = await getDocs(query(collection(db, 'users'), where('uid', 'in', c))); uSnap.docs.forEach(u => users.push(u.data() as UserDoc)); } }
                users.sort((a, b) => a.name.localeCompare(b.name));
                setInactiveUids(new Set(users.filter(u => u.isActive === false).map(u => u.uid)));
                setRegisteredEmployees(users.filter(u => u.isActive !== false));
                setManagerAssignedUids(forceUids);
            } catch (err) { console.error(err); } finally { setLoadingData(false); }
        })();
    }, [effectiveStoreId, selectedDate, selectedShiftId]);

    const handleRemoveRegistration = async (uid: string) => {
        if (!user) return;
        try {
            const token = await user.getIdToken();
            const weekStartDate = toLocalDateString(getWeekStart(new Date(selectedDate + 'T00:00:00')));
            const res = await fetch('/api/register/force-assign', { method: 'DELETE', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify({ targetUserId: uid, weekStartDate, date: selectedDate, shiftId: selectedShiftId }) });
            if (!res.ok) { const e = await res.json(); throw new Error(e.error || 'Lỗi'); }
            const na = { ...assignments }; for (const k of Object.keys(na)) na[k] = na[k].filter(id => id !== uid);
            setAssignments(na); triggerReload();
        } catch (err) { setError(err instanceof Error ? err.message : 'Lỗi'); }
    };

    const handleDiscardDraft = () => {
        if (!effectiveStoreId || !selectedDate || !selectedShiftId) return;
        const wk = getWeekStart(new Date(selectedDate + 'T00:00:00'));
        const d = { ...weeklyDraftRef.current }; delete d[getDayShiftKey(selectedDate, selectedShiftId)];
        weeklyDraftRef.current = d; saveWeeklyDraft(effectiveStoreId, wk, d);
        setAssignments(JSON.parse(JSON.stringify(serverAssignments.current)));
        setHasDraftChanges(false); setDraftLoaded(false); setTotalDraftSlots(Object.keys(d).length); setSuccess(''); setError('');
    };

    const handleDiscardAllDrafts = () => {
        if (!effectiveStoreId) return;
        const wk = getWeekStart(new Date(selectedDate + 'T00:00:00'));
        weeklyDraftRef.current = {}; saveWeeklyDraft(effectiveStoreId, wk, {});
        setAssignments(JSON.parse(JSON.stringify(serverAssignments.current)));
        setHasDraftChanges(false); setDraftLoaded(false); setTotalDraftSlots(0); setSuccess(''); setError('');
    };

    const handleSaveAndPublish = async () => {
        if (!user || !effectiveStoreId) return;
        setSaving(true); setError(''); setSuccess('');
        try {
            const token = await user.getIdToken();
            const allDrafts = { ...weeklyDraftRef.current };
            const currentKey = getDayShiftKey(selectedDate, selectedShiftId);
            if (JSON.stringify(assignments) !== JSON.stringify(serverAssignments.current)) allDrafts[currentKey] = assignments;
            if (Object.keys(allDrafts).length === 0) { setSaving(false); return; }
            const days = Object.entries(allDrafts).map(([key, slot]) => {
                const [date, ...sp] = key.split('_'); const shiftId = sp.join('_');
                return { date, shiftId, assignments: Object.fromEntries(Object.entries(slot).map(([cid, uids]) => [cid, { employeeIds: uids, assignedByManagerUids: uids.filter(uid => managerAssignedUids.has(uid)) }])) };
            });
            const res = await fetch('/api/schedules/bulk', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify({ storeId: effectiveStoreId, days }) });
            if (!res.ok) { const e = await res.json(); throw new Error(e.error || 'Lỗi'); }
            const result = await res.json();
            const wk = getWeekStart(new Date(selectedDate + 'T00:00:00'));
            weeklyDraftRef.current = {}; saveWeeklyDraft(effectiveStoreId, wk, {});
            serverAssignments.current = JSON.parse(JSON.stringify(assignments));
            setHasDraftChanges(false); setDraftLoaded(false); setTotalDraftSlots(0);
            setSuccess(`Đã lưu ${result.savedDays ?? days.length} ca thành công!`);
        } catch (err) { setError(err instanceof Error ? err.message : 'Lỗi'); }
        finally { setSaving(false); }
    };

    // ── Guards ────────────────────────────────────────────────────────────────
    const canAccess = isAdmin || userDoc?.role === 'store_manager' || userDoc?.role === 'manager' || hasPermission('page.scheduling.builder');

    if (loadingConfig) return (
        <MobilePageShell title="Xếp ca">
            <div className="flex items-center justify-center py-16"><div className="w-6 h-6 border-2 border-primary-200 border-t-primary-600 rounded-full animate-spin" /></div>
        </MobilePageShell>
    );

    if (!canAccess) return (
        <MobilePageShell title="Xếp ca">
            <div className="p-8 text-center"><AlertCircle className="w-8 h-8 text-red-400 mx-auto mb-2" /><p className="text-sm text-red-600 font-bold">Không có quyền truy cập</p></div>
        </MobilePageShell>
    );

    const showDraftBar = hasDraftChanges || draftLoaded || totalDraftSlots > 0;

    return (
        <MobilePageShell title="Xếp ca làm việc">
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
                    {/* ── Week nav + Day tabs ─────────────────────────── */}
                    <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-2 mb-3">
                        <div className="flex items-center gap-1">
                            <button onClick={previousWeek} className="w-9 h-9 rounded-xl bg-gray-50 border border-gray-200 flex items-center justify-center active:scale-95 transition-transform shrink-0">
                                <ChevronLeft className="w-4 h-4 text-gray-600" />
                            </button>
                            <div className="flex-1 flex gap-1 overflow-x-auto scrollbar-hide justify-between">
                                {weekDays.map((dateStr, idx) => {
                                    const dateObj = new Date(dateStr + 'T00:00:00');
                                    const today = isToday(dateStr);
                                    const selected = idx === selectedDayIdx;
                                    const hasDraft = Object.keys(weeklyDraftRef.current).some(k => k.startsWith(dateStr));
                                    return (
                                        <button key={dateStr} onClick={() => setSelectedDayIdx(idx)}
                                            className={cn(
                                                'relative flex flex-col items-center flex-1 py-2 px-1 rounded-xl transition-all',
                                                selected ? 'bg-primary-600 text-white shadow-md shadow-primary-200' : today ? 'bg-primary-50 text-primary-700' : 'text-gray-500 hover:bg-gray-50'
                                            )}>
                                            <span className={cn('text-[9px] font-bold leading-none', selected ? 'text-primary-200' : 'text-gray-400')}>{dayNames[dateObj.getDay()]}</span>
                                            <span className="text-base font-black leading-snug">{dateObj.getDate()}</span>
                                            <span className={cn('text-[8px] font-semibold leading-none', selected ? 'text-primary-300' : 'text-gray-300')}>
                                                T{dateObj.getMonth() + 1}
                                            </span>
                                            {hasDraft && <span className={cn('absolute top-1 right-1 w-2 h-2 rounded-full border-2', selected ? 'bg-amber-300 border-primary-600' : 'bg-amber-400 border-white')} />}
                                        </button>
                                    );
                                })}
                            </div>
                            <button onClick={nextWeek} className="w-9 h-9 rounded-xl bg-gray-50 border border-gray-200 flex items-center justify-center active:scale-95 transition-transform shrink-0">
                                <ChevronRight className="w-4 h-4 text-gray-600" />
                            </button>
                        </div>

                        {/* ── Shift selector inside card ──────────────────── */}
                        {shiftTimes.length > 0 && (
                            <div className="flex gap-1.5 mt-2 pt-2 border-t border-gray-100 overflow-x-auto scrollbar-hide">
                                {shiftTimes.map(s => (
                                    <button key={s} onClick={() => setSelectedShiftId(s)}
                                        className={cn('flex-1 py-2 rounded-lg text-xs font-bold transition-all text-center',
                                            selectedShiftId === s ? 'bg-primary-600 text-white shadow-sm' : 'bg-gray-50 border border-gray-200 text-gray-600 active:bg-gray-100')}>
                                        {s}
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* ── Alerts ───────────────────────────────────────── */}
                    {error && (
                        <div className="flex items-center gap-2 bg-red-50 border border-red-200 rounded-lg px-3 py-2 mb-2">
                            <AlertCircle className="w-3.5 h-3.5 text-red-500 shrink-0" />
                            <p className="text-[11px] font-medium text-red-700 flex-1">{error}</p>
                        </div>
                    )}
                    {success && (
                        <div className="flex items-center gap-2 bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-2 mb-2">
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                            <p className="text-[11px] font-medium text-emerald-700 flex-1">{success}</p>
                            <button onClick={() => setSuccess('')} className="text-[10px] font-bold text-emerald-600">Đóng</button>
                        </div>
                    )}

                    {/* ── DraggableSchedule (touch-supported) ──────────── */}
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
                        storeId={effectiveStoreId}
                        selectedDate={selectedDate}
                        selectedShiftId={selectedShiftId}
                        registeredUids={new Set(registeredEmployees.map(e => e.uid))}
                        onSuccess={triggerReload}
                    />

                    {/* ── Sticky draft action bar ─────────────────────── */}
                    {showDraftBar && (
                        <div className="sticky bottom-2 z-30 mt-3">
                            <div className="bg-white/95 backdrop-blur-md border-2 border-amber-300 rounded-xl shadow-lg p-3">
                                <div className="flex items-center gap-2 mb-2">
                                    <FileWarning className="w-4 h-4 text-amber-600 shrink-0" />
                                    <span className="text-[11px] font-bold text-gray-800 flex-1">
                                        Có thay đổi chưa lưu
                                        {totalDraftSlots > 1 && (
                                            <span className="ml-1 text-[9px] font-bold px-1.5 py-0.5 bg-amber-100 text-amber-700 rounded-full">
                                                <Layers className="w-2.5 h-2.5 inline mr-0.5" />{totalDraftSlots} ca
                                            </span>
                                        )}
                                    </span>
                                </div>
                                <div className="flex gap-1.5">
                                    <button onClick={handleDiscardDraft} disabled={saving || !hasDraftChanges}
                                        className="flex-1 flex items-center justify-center gap-1 px-2 py-2 border border-gray-200 text-gray-600 rounded-lg text-[10px] font-bold transition-all disabled:opacity-40">
                                        <Undo2 className="w-3 h-3" /> Hủy ca này
                                    </button>
                                    {totalDraftSlots > 0 && (
                                        <button onClick={handleDiscardAllDrafts} disabled={saving}
                                            className="flex items-center justify-center gap-1 px-2 py-2 border border-red-200 text-red-600 rounded-lg text-[10px] font-bold transition-all disabled:opacity-40">
                                            <Trash2 className="w-3 h-3" />
                                        </button>
                                    )}
                                    <button onClick={handleSaveAndPublish} disabled={saving || loadingData}
                                        className="flex-1 flex items-center justify-center gap-1 px-3 py-2 bg-primary-600 text-white rounded-lg text-[10px] font-bold transition-all shadow-sm disabled:opacity-40">
                                        {saving ? <div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" /> : <Save className="w-3 h-3" />}
                                        {totalDraftSlots > 1 ? `Lưu ${totalDraftSlots} ca` : 'Lưu & Công khai'}
                                    </button>
                                </div>
                            </div>
                        </div>
                    )}
                </>
            )}

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
