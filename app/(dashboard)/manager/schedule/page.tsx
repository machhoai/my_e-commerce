'use client';

import { useState, useEffect } from 'react';
import { db } from '@/lib/firebase';
import { collection, doc, getDoc, getDocs, setDoc, query, where } from 'firebase/firestore';
import { UserDoc, CounterDoc, SettingsDoc, WeeklyRegistration, ScheduleDoc, StoreDoc } from '@/types';
import { getWeekStart, getWeekDays, toLocalDateString, formatDate } from '@/lib/utils';
import { useAuth } from '@/contexts/AuthContext';
import DraggableSchedule from '@/components/manager/DraggableSchedule';
import { Calendar, Clock, Save, AlertCircle, CheckCircle2, ChevronDown, ChevronLeft, ChevronRight, Building2 } from 'lucide-react';

export default function ManagerSchedulePage() {
    const { user, userDoc } = useAuth();

    const [currentWeekStart, setCurrentWeekStart] = useState<Date>(getWeekStart(new Date()));
    const weekDays = getWeekDays(currentWeekStart);
    const [selectedDate, setSelectedDate] = useState(toLocalDateString(new Date()));
    const [selectedShiftId, setSelectedShiftId] = useState<string>('');

    const [shiftTimes, setShiftTimes] = useState<string[]>([]);
    const [counters, setCounters] = useState<CounterDoc[]>([]);
    const [registeredEmployees, setRegisteredEmployees] = useState<UserDoc[]>([]);
    const [assignments, setAssignments] = useState<Record<string, string[]>>({});

    const [loadingConfig, setLoadingConfig] = useState(true);
    const [loadingData, setLoadingData] = useState(false);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');

    // Admin-only: store selector
    const [stores, setStores] = useState<StoreDoc[]>([]);
    const [selectedAdminStoreId, setSelectedAdminStoreId] = useState('');

    // 1. Load global settings (shifts) + admin stores list
    useEffect(() => {
        if (userDoc === undefined) return;
        async function loadConfig() {
            try {
                const snap = await getDoc(doc(db, 'settings', 'global'));
                if (snap.exists()) {
                    const data = snap.data() as SettingsDoc;
                    setShiftTimes(data.shiftTimes || []);
                    if (data.shiftTimes.length > 0) setSelectedShiftId(data.shiftTimes[0]);
                }

                if (userDoc?.role === 'admin' && user) {
                    const token = await user.getIdToken();
                    const res = await fetch('/api/stores', { headers: { 'Authorization': `Bearer ${token}` } });
                    const storeData = await res.json();
                    setStores(Array.isArray(storeData) ? storeData : []);
                } else if (userDoc?.storeId) {
                    const countersSnap = await getDocs(query(collection(db, 'counters'), where('storeId', '==', userDoc.storeId)));
                    if (countersSnap.docs.length > 0) {
                        setCounters(countersSnap.docs.map(d => d.data() as CounterDoc));
                    } else {
                        const snap2 = await getDoc(doc(db, 'settings', 'global'));
                        const data2 = snap2.data() as (SettingsDoc & { counters?: CounterDoc[] }) | undefined;
                        setCounters(data2?.counters || []);
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

    // 2. When admin picks a store, load its counters
    useEffect(() => {
        if (userDoc?.role !== 'admin' || !selectedAdminStoreId) return;
        async function loadAdminCounters() {
            const countersSnap = await getDocs(query(collection(db, 'counters'), where('storeId', '==', selectedAdminStoreId)));
            if (countersSnap.docs.length > 0) {
                setCounters(countersSnap.docs.map(d => d.data() as CounterDoc));
            } else {
                const snap = await getDoc(doc(db, 'settings', 'global'));
                const data = snap.data() as (SettingsDoc & { counters?: CounterDoc[] }) | undefined;
                setCounters(data?.counters || []);
            }
        }
        loadAdminCounters();
    }, [selectedAdminStoreId, userDoc]);

    // 3. Load employees + existing schedule when date/shift changes
    useEffect(() => {
        const effectiveStoreId = userDoc?.role === 'admin' ? selectedAdminStoreId : userDoc?.storeId;
        if (!selectedDate || !selectedShiftId || !effectiveStoreId) return;

        async function loadData() {
            setLoadingData(true);
            setError('');
            setSuccess('');
            try {
                const requestWeekStart = getWeekStart(new Date(selectedDate + "T00:00:00"));
                const regQuery = query(
                    collection(db, 'weekly_registrations'),
                    where('weekStartDate', '==', toLocalDateString(requestWeekStart)),
                    where('storeId', '==', effectiveStoreId)
                );
                const regSnap = await getDocs(regQuery);

                const uidsForShift = new Set<string>();
                regSnap.docs.forEach(d => {
                    const reg = d.data() as WeeklyRegistration;
                    const hasShift = reg.shifts.some(s => s.date === selectedDate && s.shiftId === selectedShiftId);
                    if (hasShift) uidsForShift.add(reg.userId);
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
                setRegisteredEmployees(users);

                const qScheds = query(
                    collection(db, 'schedules'),
                    where('date', '==', selectedDate),
                    where('shiftId', '==', selectedShiftId)
                );
                const schedsMulti = await getDocs(qScheds);
                const initialAssigns: Record<string, string[]> = {};
                counters.forEach(c => initialAssigns[c.id] = []);
                schedsMulti.docs.forEach(docSnap => {
                    const sData = docSnap.data() as ScheduleDoc;
                    if (initialAssigns[sData.counterId] !== undefined) {
                        initialAssigns[sData.counterId] = sData.employeeIds || [];
                    }
                });
                setAssignments(initialAssigns);
            } catch (err) {
                console.error(err);
                setError('Không thể tải danh sách nhân viên đã đăng ký');
            } finally {
                setLoadingData(false);
            }
        }
        loadData();
    }, [selectedDate, selectedShiftId, counters, userDoc, selectedAdminStoreId]);

    const handleSaveAndPublish = async () => {
        if (!user) return;
        setSaving(true);
        setError('');
        setSuccess('');
        try {
            const batchPromises = Object.entries(assignments).map(async ([counterId, uids]) => {
                const docId = `${selectedDate}_${selectedShiftId}_${counterId}`;
                return setDoc(doc(db, 'schedules', docId), {
                    id: docId,
                    date: selectedDate,
                    shiftId: selectedShiftId,
                    counterId,
                    employeeIds: uids,
                    publishedAt: new Date().toISOString(),
                    publishedBy: user.uid,
                });
            });
            await Promise.all(batchPromises);
            setSuccess('Đã lưu và công khai lịch làm việc cho nhân viên thành công!');
        } catch (err) {
            console.error(err);
            setError('Không thể công khai lịch làm việc');
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

    const effectiveStoreId = userDoc?.role === 'admin' ? selectedAdminStoreId : userDoc?.storeId;

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
                        {stores.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
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
                            <p className="text-slate-500 mt-1">Kéo nhân viên đã đăng ký vào các quầy để phân công ca làm.</p>
                        </div>

                        <div className="flex items-center gap-4 bg-white p-2 rounded-xl shadow-sm border border-slate-200">
                            <div className="flex items-center gap-2">
                                <button onClick={handlePreviousWeek} className="p-1.5 hover:bg-slate-100 rounded-lg transition-colors text-slate-600">
                                    <ChevronLeft className="w-5 h-5" />
                                </button>
                                <div className="text-sm font-semibold text-slate-700 min-w-[140px] text-center hidden md:block">
                                    {formatDate(weekDays[0])} - {formatDate(weekDays[6])}
                                </div>
                                <button onClick={handleNextWeek} className="p-1.5 hover:bg-slate-100 rounded-lg transition-colors text-slate-600">
                                    <ChevronRight className="w-5 h-5" />
                                </button>
                            </div>

                            <div className="w-px h-8 bg-slate-200" />

                            <div className="relative">
                                <Clock className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                                <select
                                    value={selectedShiftId}
                                    onChange={e => setSelectedShiftId(e.target.value)}
                                    className="pl-9 pr-8 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm font-medium text-slate-700 outline-none focus:ring-2 focus:ring-blue-500 appearance-none cursor-pointer min-w-[140px]"
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
                                const d = new Date(dateStr + "T00:00:00");
                                const isSelected = dateStr === selectedDate;
                                const isToday = dateStr === toLocalDateString(new Date());
                                const dayName = d.toLocaleDateString('vi-VN', { weekday: 'short' });
                                const dateNum = d.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit' });
                                return (
                                    <button
                                        key={dateStr}
                                        onClick={() => setSelectedDate(dateStr)}
                                        className={`flex flex-col items-center justify-center flex-1 p-2 rounded-lg border-2 transition-all ${isSelected
                                            ? 'border-blue-500 bg-blue-50 text-blue-700 shadow-sm'
                                            : 'border-transparent hover:border-slate-200 hover:bg-slate-50 text-slate-500'
                                            }`}
                                    >
                                        <span className={`text-xs font-semibold uppercase ${isSelected ? 'text-blue-600' : 'text-slate-400'}`}>{dayName}</span>
                                        <span className={`text-lg font-bold mt-0.5 ${isSelected ? 'text-blue-800' : 'text-slate-700'}`}>{dateNum}</span>
                                        {isToday && !isSelected && <span className="w-1.5 h-1.5 rounded-full bg-blue-500 mt-1"></span>}
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
                    />

                    <div className="flex items-center justify-between pt-4 border-t border-slate-200 mb-4">
                        <div className="text-sm text-slate-500 font-medium bg-slate-100 px-3 py-1.5 rounded-lg border border-slate-200/60 flex items-center gap-2">
                            <span className="w-2 h-2 rounded-full bg-blue-500 animate-pulse"></span>
                            Thay đổi được lưu tự động. Nhấn Công khai để gửi lịch cho nhân viên.
                        </div>
                        <button
                            onClick={handleSaveAndPublish}
                            disabled={saving || loadingData}
                            className="flex items-center gap-2 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white px-8 py-2.5 rounded-xl font-semibold transition-all shadow-lg shadow-blue-600/20 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            {saving ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> : <Save className="w-4 h-4" />}
                            Lưu &amp; Công khai Lịch làm việc
                        </button>
                    </div>
                </>
            )}
        </div>
    );
}
