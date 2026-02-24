'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { SettingsDoc, WeeklyRegistration, ShiftEntry } from '@/types';
import { db } from '@/lib/firebase';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { getWeekStart, getWeekDays, formatDate, weeklyRegId, cn } from '@/lib/utils';
import { Calendar as CalendarIcon, Save, AlertCircle, Info, CheckCircle2, ChevronLeft, ChevronRight } from 'lucide-react';

export default function EmployeeRegisterPage() {
    const { user, userDoc } = useAuth();
    const [settings, setSettings] = useState<SettingsDoc | null>(null);

    // Registration State
    const [currentWeekStart, setCurrentWeekStart] = useState<Date>(getWeekStart(new Date()));
    const weekDays = getWeekDays(currentWeekStart);

    // Array of 7 days, each holding an array of selected shiftIds
    const [selectedShifts, setSelectedShifts] = useState<string[][]>(Array(7).fill([]));
    const [existingRegId, setExistingRegId] = useState<string | null>(null);

    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');

    // Fetch Settings & Existing Registration
    useEffect(() => {
        if (!user) return;

        const fetchData = async () => {
            setLoading(true);
            try {
                // 1. Get Settings
                const settingsSnap = await getDoc(doc(db, 'settings', 'global'));
                if (settingsSnap.exists()) {
                    setSettings(settingsSnap.data() as SettingsDoc);
                }

                // 2. Get existing registration for this week
                const regId = weeklyRegId(user.uid, currentWeekStart);
                const regSnap = await getDoc(doc(db, 'weekly_registrations', regId));

                if (regSnap.exists()) {
                    setExistingRegId(regId);
                    const data = regSnap.data() as WeeklyRegistration;
                    const mappedSelections = weekDays.map(dateStr => {
                        return data.shifts.filter(s => s.date === dateStr).map(s => s.shiftId);
                    });
                    setSelectedShifts(mappedSelections);
                } else {
                    setExistingRegId(null);
                    setSelectedShifts(Array(7).fill([]));
                }
            } catch (err) {
                console.error('Error fetching data:', err);
                setError('Failed to load registration data');
            } finally {
                setLoading(false);
            }
        };

        fetchData();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [user, currentWeekStart]); // Intentionally omitting weekDays dependency

    const handlePreviousWeek = () => {
        const d = new Date(currentWeekStart);
        d.setDate(d.getDate() - 7);
        setCurrentWeekStart(d);
        setSuccess('');
        setError('');
    };

    const handleNextWeek = () => {
        const d = new Date(currentWeekStart);
        d.setDate(d.getDate() + 7);
        setCurrentWeekStart(d);
        setSuccess('');
        setError('');
    };

    const toggleShift = (dayIndex: number, shiftId: string) => {
        setError('');
        setSuccess('');

        // Check global settings
        if (!settings?.registrationOpen) {
            setError('Registration is currently closed by the administrator.');
            return;
        }

        const newSelections = [...selectedShifts];
        const dayShifts = [...newSelections[dayIndex]];
        const type = userDoc?.type || 'PT';

        if (dayShifts.includes(shiftId)) {
            // Deselect
            newSelections[dayIndex] = dayShifts.filter(id => id !== shiftId);
        } else {
            // Select
            // 1. Enforce shift limits immediately where possible to prevent bad state
            if (type === 'FT') {
                // FT: Only 1 shift per day allowed. If selecting new, replace the old one for convenience.
                newSelections[dayIndex] = [shiftId];
            } else {
                // PT: Up to 2 per day
                if (dayShifts.length >= 2) {
                    setError(`Part-time employees can select a maximum of 2 shifts per day.`);
                    return;
                }
                dayShifts.push(shiftId);
                newSelections[dayIndex] = dayShifts;
            }
        }

        setSelectedShifts(newSelections);
    };

    const validateRegistration = (): { valid: boolean; message: string } => {
        const type = userDoc?.type || 'PT';

        // FT Rules: Exactly 1 shift/day, at least 1 day completely empty
        if (type === 'FT') {
            let emptyDays = 0;
            for (let i = 0; i < 7; i++) {
                const count = selectedShifts[i].length;
                if (count === 0) {
                    emptyDays++;
                } else if (count > 1) {
                    // Should be prevented by toggle logic, but just in case
                    return { valid: false, message: `Full-time employees must select exactly 1 shift on working days.` };
                }
            }

            if (emptyDays < 1) {
                return { valid: false, message: `Full-time employees must take at least 1 day off per week.` };
            }

            // Also ensure they have SOME shifts selected, otherwise they aren't registering
            if (emptyDays === 7) {
                return { valid: false, message: "Please select your shifts for the week." };
            }
        }

        // PT Rules: Max 2/day, no mandatory off days
        if (type === 'PT') {
            let totalShifts = 0;
            for (let i = 0; i < 7; i++) {
                const count = selectedShifts[i].length;
                totalShifts += count;
                if (count > 2) {
                    return { valid: false, message: `Part-time employees cannot exceed 2 shifts per day.` };
                }
            }
            if (totalShifts === 0) {
                return { valid: false, message: "Please select at least one shift." };
            }
        }

        return { valid: true, message: '' };
    };

    const handleSave = async () => {
        if (!user) return;
        setError('');
        setSuccess('');

        // Pre-flight check
        if (!settings?.registrationOpen) {
            setError('Registration is currently closed.');
            return;
        }

        const validation = validateRegistration();
        if (!validation.valid) {
            setError(validation.message);
            return;
        }

        setSaving(true);
        try {
            // Build the shifts array
            const shiftsToSave: ShiftEntry[] = [];
            selectedShifts.forEach((dayShifts, i) => {
                const dateStr = weekDays[i];
                dayShifts.forEach(shiftId => {
                    shiftsToSave.push({ date: dateStr, shiftId });
                });
            });

            const regId = weeklyRegId(user.uid, currentWeekStart);
            const payload: WeeklyRegistration = {
                id: regId,
                userId: user.uid,
                weekStartDate: currentWeekStart.toISOString().split('T')[0],
                shifts: shiftsToSave,
                submittedAt: new Date().toISOString()
            };

            await setDoc(doc(db, 'weekly_registrations', regId), payload);
            setExistingRegId(regId);
            setSuccess('Shifts registered successfully!');
        } catch (err: unknown) {
            console.error('Save error:', err);
            setError('Failed to save registration');
        } finally {
            setSaving(false);
        }
    };

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
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent flex items-center gap-2">
                        <CalendarIcon className="w-7 h-7 text-blue-600" />
                        Shift Registration
                    </h1>
                    <p className="text-slate-500 mt-1 flex items-center gap-2">
                        Select your availability for upcoming weeks.
                        <span className="bg-slate-100 text-slate-700 px-2 py-0.5 rounded text-xs font-bold border border-slate-200 uppercase">
                            {userDoc?.type} Employee
                        </span>
                    </p>
                </div>

                <div className="flex items-center gap-4 bg-white p-2 rounded-xl shadow-sm border border-slate-200">
                    <button
                        onClick={handlePreviousWeek}
                        className="p-2 hover:bg-slate-100 rounded-lg transition-colors text-slate-600"
                    >
                        <ChevronLeft className="w-5 h-5" />
                    </button>
                    <div className="text-sm font-semibold text-slate-700 min-w-[140px] text-center">
                        {formatDate(weekDays[0])} - {formatDate(weekDays[6])}
                    </div>
                    <button
                        onClick={handleNextWeek}
                        className="p-2 hover:bg-slate-100 rounded-lg transition-colors text-slate-600"
                    >
                        <ChevronRight className="w-5 h-5" />
                    </button>
                </div>
            </div>

            {isClosed && (
                <div className="bg-amber-50 border border-amber-200 text-amber-800 p-4 rounded-xl flex items-start gap-3 shadow-sm">
                    <AlertCircle className="w-5 h-5 shrink-0 mt-0.5 text-amber-600" />
                    <div>
                        <h3 className="font-semibold text-amber-900">Registration is currently closed</h3>
                        <p className="text-sm mt-1">The administrator has disabled shift registration at this time. You can view your selections but cannot make changes.</p>
                    </div>
                </div>
            )}

            {/* Info Panel based on Role */}
            <div className="bg-blue-50/50 border border-blue-100 p-4 rounded-xl flex items-start gap-3 text-blue-800 text-sm">
                <Info className="w-5 h-5 shrink-0 text-blue-500 mt-0.5" />
                <div>
                    <strong className="block mb-1 text-blue-900">Registration Rules for {isFT ? 'Full-Time' : 'Part-Time'} Staff:</strong>
                    {isFT ? (
                        <ul className="list-disc pl-5 space-y-0.5 marker:text-blue-400 text-blue-700">
                            <li>You must select <strong>exactly 1 shift</strong> per working day.</li>
                            <li>You must leave <strong>at least 1 full day</strong> empty as your scheduled off day.</li>
                        </ul>
                    ) : (
                        <ul className="list-disc pl-5 space-y-0.5 marker:text-blue-400 text-blue-700">
                            <li>You can select <strong>up to 2 shifts</strong> per day.</li>
                            <li>There are no mandatory off days required.</li>
                        </ul>
                    )}
                </div>
            </div>

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
                <div className="grid grid-cols-1 lg:grid-cols-7 divide-y lg:divide-y-0 lg:divide-x divide-slate-100">
                    {weekDays.map((dateStr, i) => {
                        const dateObj = new Date(dateStr + "T00:00:00");
                        const isToday = new Date().toDateString() === dateObj.toDateString();
                        const dayName = dateObj.toLocaleDateString('en-US', { weekday: 'short' });
                        const dayNum = dateObj.getDate();
                        const monthName = dateObj.toLocaleDateString('en-US', { month: 'short' });

                        return (
                            <div key={dateStr} className="flex flex-col min-h-[300px]">
                                {/* Header */}
                                <div className={cn(
                                    "p-4 text-center border-b border-slate-100",
                                    isToday ? "bg-blue-50/50" : "bg-slate-50/50"
                                )}>
                                    <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider">{dayName}</div>
                                    <div className={cn(
                                        "text-xl font-bold mt-1 inline-flex items-center justify-center w-10 h-10 rounded-full",
                                        isToday ? "bg-blue-600 text-white shadow-md shadow-blue-500/20" : "text-slate-800"
                                    )}>
                                        {dayNum}
                                    </div>
                                    <div className="text-xs text-slate-400 mt-0.5">{monthName}</div>
                                </div>

                                {/* Shifts */}
                                <div className="flex-1 p-3 flex flex-col gap-2 bg-white">
                                    {settings?.shiftTimes.map(shiftId => {
                                        const isSelected = selectedShifts[i].includes(shiftId);

                                        return (
                                            <button
                                                key={shiftId}
                                                type="button"
                                                disabled={isClosed}
                                                onClick={() => toggleShift(i, shiftId)}
                                                className={cn(
                                                    "w-full px-3 py-4 text-sm font-semibold rounded-xl border-2 text-center transition-all duration-200",
                                                    isSelected
                                                        ? "border-blue-500 bg-blue-50 text-blue-700 shadow-sm"
                                                        : "border-slate-100 bg-white text-slate-500 hover:border-slate-300 hover:bg-slate-50",
                                                    isClosed && !isSelected && "opacity-50 cursor-not-allowed hover:border-slate-100 hover:bg-white",
                                                    isClosed && isSelected && "cursor-not-allowed"
                                                )}
                                            >
                                                {shiftId}
                                            </button>
                                        );
                                    })}

                                    {settings?.shiftTimes.length === 0 && (
                                        <div className="text-xs text-slate-400 text-center mt-4">No shifts configured</div>
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
                            <CheckCircle2 className="w-4 h-4" /> Form submitted for this week
                        </span>
                    ) : (
                        <span>No registration found for this week.</span>
                    )}
                </div>
                <button
                    onClick={handleSave}
                    disabled={saving || isClosed}
                    className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-6 py-2.5 rounded-lg font-medium transition-all shadow-lg shadow-blue-600/20 disabled:opacity-50 disabled:cursor-not-allowed focus:ring-4 focus:ring-blue-500/30"
                >
                    {saving ? (
                        <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    ) : (
                        <Save className="w-4 h-4" />
                    )}
                    Save Registration
                </button>
            </div>

        </div>
    );
}
