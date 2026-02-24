'use client';

import { useState, useEffect } from 'react';
import { db } from '@/lib/firebase';
import { collection, doc, getDoc, getDocs, setDoc, query, where, serverTimestamp } from 'firebase/firestore';
import { UserDoc, CounterDoc, SettingsDoc, WeeklyRegistration, ScheduleDoc } from '@/types';
import { scheduleDocId, getWeekStart, weeklyRegId, formatDate } from '@/lib/utils';
import { useAuth } from '@/contexts/AuthContext';
import DraggableSchedule from '@/components/manager/DraggableSchedule';
import { Calendar, Clock, Save, AlertCircle, CheckCircle2, ChevronDown } from 'lucide-react';

export default function ManagerSchedulePage() {
    const { user } = useAuth();

    // Controls
    const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
    const [selectedShiftId, setSelectedShiftId] = useState<string>('');

    // Data State
    const [shiftTimes, setShiftTimes] = useState<string[]>([]);
    const [counters, setCounters] = useState<CounterDoc[]>([]);
    const [registeredEmployees, setRegisteredEmployees] = useState<UserDoc[]>([]);

    // assignments mode: counterId -> array of UIDs
    const [assignments, setAssignments] = useState<Record<string, string[]>>({});

    // Status State
    const [loadingConfig, setLoadingConfig] = useState(true);
    const [loadingData, setLoadingData] = useState(false);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');

    // 1. Load global settings (shifts, counters) once
    useEffect(() => {
        async function loadConfig() {
            try {
                const rulesRef = doc(db, 'settings', 'global');
                const snap = await getDoc(rulesRef);
                if (snap.exists()) {
                    const data = snap.data() as SettingsDoc & { counters?: CounterDoc[] };
                    setShiftTimes(data.shiftTimes || []);
                    setCounters(data.counters || []); // Wait, admin page adds counters here
                    if (data.shiftTimes.length > 0) {
                        setSelectedShiftId(data.shiftTimes[0]);
                    }
                }
            } catch (err) {
                console.error(err);
                setError('Failed to load global settings');
            } finally {
                setLoadingConfig(false);
            }
        }
        loadConfig();
    }, []);

    // 2. Load employees & existing schedule when date/shift changes
    useEffect(() => {
        if (!selectedDate || !selectedShiftId) return;

        async function loadData() {
            setLoadingData(true);
            setError('');
            setSuccess('');

            try {
                const requestWeekStart = getWeekStart(new Date(selectedDate + "T00:00:00"));

                // A. Find all registrations for this week
                const qReg = query(
                    collection(db, 'weekly_registrations'),
                    where('weekStartDate', '==', requestWeekStart.toISOString().split('T')[0])
                );
                const regSnap = await getDocs(qReg);

                // Filter those who registered for THIS specific date & shift
                const uidsForShift = new Set<string>();
                regSnap.docs.forEach(d => {
                    const reg = d.data() as WeeklyRegistration;
                    const hasShift = reg.shifts.some(s => s.date === selectedDate && s.shiftId === selectedShiftId);
                    if (hasShift) uidsForShift.add(reg.userId);
                });

                // B. Fetch User docs for those UIDs
                const users: UserDoc[] = [];
                if (uidsForShift.size > 0) {
                    // Batch querying users (max 10 in 'in' clause, so chunk if needed. Keeping simple here)
                    const uidsArray = Array.from(uidsForShift);
                    // Handle firestore 'in' 10 limit safely
                    const chunks = [];
                    for (let i = 0; i < uidsArray.length; i += 10) {
                        chunks.push(uidsArray.slice(i, i + 10));
                    }

                    for (const chunk of chunks) {
                        const qUsers = query(collection(db, 'users'), where('uid', 'in', chunk));
                        const uSnap = await getDocs(qUsers);
                        uSnap.docs.forEach(u => users.push(u.data() as UserDoc));
                    }
                }

                // Sort users alphabetically
                users.sort((a, b) => a.name.localeCompare(b.name));
                setRegisteredEmployees(users);

                // C. Load existing schedule assignments if any
                const schedId = scheduleDocId(selectedDate, selectedShiftId);
                const schedSnap = await getDoc(doc(db, 'schedules', schedId));

                if (schedSnap.exists()) {
                    const data = schedSnap.data() as ScheduleDoc;
                    // If schedule exists, convert to dict: counterId -> UIDs
                    // Wait, the schema in plan says: { id, date, shiftId, counterId, employeeIds: string[] }
                    // This implies ONE document per (Date+Shift) OR ONE document per (Date+Shift+Counter)?
                    // Let's adapt: it's better to store ONE document per (Date+Shift+Counter).
                    // Let's implement that adaptation for simplicity & real-time efficiency.

                    // Query all schedules for Date+Shift
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
                        initialAssigns[sData.counterId] = sData.employeeIds;
                    });

                    setAssignments(initialAssigns);
                } else {
                    // Empty assignments
                    const initialAssigns: Record<string, string[]> = {};
                    counters.forEach(c => initialAssigns[c.id] = []);
                    setAssignments(initialAssigns);
                }

            } catch (err) {
                console.error(err);
                setError('Failed to load registered employees');
            } finally {
                setLoadingData(false);
            }
        }

        loadData();
    }, [selectedDate, selectedShiftId, counters]);

    const handleSaveAndPublish = async () => {
        if (!user) return;
        setSaving(true);
        setError('');
        setSuccess('');

        try {
            // Create/Update a schedule document per Counter for this Date + Shift
            // Document ID: date_shiftId_counterId to ensure uniqueness and easy updating
            const batchPromises = Object.entries(assignments).map(async ([counterId, uids]) => {
                const docId = `${selectedDate}_${selectedShiftId}_${counterId}`;
                const payload = {
                    id: docId,
                    date: selectedDate,
                    shiftId: selectedShiftId,
                    counterId,
                    employeeIds: uids,
                    publishedAt: new Date().toISOString(),
                    publishedBy: user.uid
                };
                return setDoc(doc(db, 'schedules', docId), payload);
            });

            await Promise.all(batchPromises);
            setSuccess('Schedule saved and published to employees successfully!');
        } catch (err) {
            console.error(err);
            setError('Failed to publish schedule');
        } finally {
            setSaving(false);
        }
    };

    if (loadingConfig) {
        return (
            <div className="flex justify-center items-center h-64">
                <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent flex items-center gap-2">
                        <Calendar className="w-7 h-7 text-blue-600" />
                        Manager Schedule
                    </h1>
                    <p className="text-slate-500 mt-1 flex items-center gap-2">
                        Drag registered employees to counters to assign their shifts.
                    </p>
                </div>

                {/* Date and Shift Selectors */}
                <div className="flex items-center gap-4 bg-white p-2 rounded-xl shadow-sm border border-slate-200">
                    <div className="relative">
                        <Calendar className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                        <input
                            type="date"
                            value={selectedDate}
                            onChange={(e) => setSelectedDate(e.target.value)}
                            className="pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm font-medium text-slate-700 outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 cursor-pointer"
                        />
                    </div>

                    <div className="w-px h-8 bg-slate-200" />

                    <div className="relative">
                        <Clock className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                        <select
                            value={selectedShiftId}
                            onChange={(e) => setSelectedShiftId(e.target.value)}
                            className="pl-9 pr-8 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm font-medium text-slate-700 outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 appearance-none cursor-pointer min-w-[140px]"
                        >
                            {shiftTimes.length === 0 && <option value="">No shifts available</option>}
                            {shiftTimes.map(shift => (
                                <option key={shift} value={shift}>{shift}</option>
                            ))}
                        </select>
                        <ChevronDown className="w-4 h-4 absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                    </div>
                </div>
            </div>

            {error && (
                <div className="bg-red-50 text-red-600 p-4 rounded-xl flex items-center gap-3 border border-red-100 animate-in fade-in slide-in-from-top-2 shadow-sm">
                    <AlertCircle className="w-5 h-5 shrink-0" />
                    <p className="text-sm font-medium">{error}</p>
                </div>
            )}

            {success && (
                <div className="bg-emerald-50 text-emerald-700 p-4 rounded-xl flex items-center gap-3 border border-emerald-200 animate-in fade-in slide-in-from-top-2 shadow-sm">
                    <CheckCircle2 className="w-5 h-5 shrink-0 text-emerald-500" />
                    <div className="flex-1 flex items-center justify-between">
                        <p className="text-sm font-medium">{success}</p>
                        <button
                            onClick={() => setSuccess('')}
                            className="text-emerald-600 hover:text-emerald-800 text-xs font-semibold px-2 py-1 bg-emerald-100/50 rounded-md"
                        >
                            Dismiss
                        </button>
                    </div>
                </div>
            )}

            {/* Main Drag/Drop Interface */}
            <DraggableSchedule
                employees={registeredEmployees}
                counters={counters}
                assignments={assignments}
                onAssignmentChange={setAssignments}
                isLoading={loadingData}
            />

            {/* Footer Actions */}
            <div className="flex items-center justify-between pt-4 border-t border-slate-200 mt-8 mb-4">
                <div className="text-sm text-slate-500 font-medium bg-slate-100 px-3 py-1.5 rounded-lg border border-slate-200/60 flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-blue-500 animate-pulse"></span>
                    Changes are auto-saved to state. Click Publish to send to employees.
                </div>
                <button
                    onClick={handleSaveAndPublish}
                    disabled={saving || loadingData}
                    className="flex items-center gap-2 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white px-8 py-2.5 rounded-xl font-semibold transition-all shadow-lg shadow-blue-600/20 disabled:opacity-50 disabled:cursor-not-allowed focus:ring-4 focus:ring-blue-500/30"
                >
                    {saving ? (
                        <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    ) : (
                        <Save className="w-4 h-4" />
                    )}
                    Save & Publish Schedule
                </button>
            </div>

        </div>
    );
}
