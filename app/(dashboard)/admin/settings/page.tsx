'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { SettingsDoc, CounterDoc } from '@/types';
import { Settings as SettingsIcon, Save, Plus, X, AlertCircle, CheckCircle2, Store, Clock } from 'lucide-react';
import { v4 as uuidv4 } from 'uuid'; // Simple built-in generator or Math.random

export default function AdminSettingsPage() {
    const { user } = useAuth();

    // Data State
    const [settings, setSettings] = useState<SettingsDoc | null>(null);
    const [counters, setCounters] = useState<CounterDoc[]>([]);

    // UI State
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');

    // New Item State
    const [newShift, setNewShift] = useState('');
    const [newCounter, setNewCounter] = useState('');

    // Generate simple short string if UUID not installed, but fallback works
    const generateId = () => Math.random().toString(36).substring(2, 9);

    // 1. Fetch current settings from API
    useEffect(() => {
        if (!user) return;

        async function fetchSettings() {
            try {
                const token = await user?.getIdToken();
                const res = await fetch('/api/settings', {
                    headers: { 'Authorization': `Bearer ${token}` }
                });

                if (!res.ok) throw new Error('Failed to fetch settings');
                const data = await res.json();

                // Ensure structure exists
                setSettings({
                    id: 'global',
                    registrationOpen: data.registrationOpen ?? false,
                    shiftTimes: data.shiftTimes || []
                });
                setCounters(data.counters || []);

            } catch (err) {
                console.error(err);
                setError('Failed to load settings');
            } finally {
                setLoading(false);
            }
        }

        fetchSettings();
    }, [user]);

    // 2. Save settings to API
    const handleSave = async (e?: React.FormEvent) => {
        if (e) e.preventDefault();
        if (!settings || !user) return;

        setSaving(true);
        setError('');
        setSuccess('');

        try {
            const payload = {
                ...settings,
                counters
            };

            const token = await user.getIdToken();
            const res = await fetch('/api/settings', {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify(payload)
            });

            if (!res.ok) throw new Error('Failed to save settings');
            setSuccess('Settings saved successfully!');
        } catch (err: unknown) {
            if (err instanceof Error) {
                setError(err.message);
            } else {
                setError('An unknown error occurred');
            }
        } finally {
            setSaving(false);
        }
    };

    const handleAddShift = () => {
        if (!newShift.trim() || !settings) return;
        if (settings.shiftTimes.includes(newShift.trim())) {
            setError('Shift time already exists');
            return;
        }
        setSettings({
            ...settings,
            shiftTimes: [...settings.shiftTimes, newShift.trim()].sort()
        });
        setNewShift('');
        setSuccess('Shift added. Remember to click Save.');
    };

    const handleRemoveShift = (shiftToRemove: string) => {
        if (!settings) return;
        setSettings({
            ...settings,
            shiftTimes: settings.shiftTimes.filter(s => s !== shiftToRemove)
        });
        setSuccess('Shift removed. Remember to click Save.');
    };

    const handleAddCounter = () => {
        if (!newCounter.trim()) return;
        if (counters.find(c => c.name.toLowerCase() === newCounter.trim().toLowerCase())) {
            setError('Counter already exists');
            return;
        }

        setCounters([
            ...counters,
            { id: `counter_${generateId()}`, name: newCounter.trim() }
        ]);
        setNewCounter('');
        setSuccess('Counter added. Remember to click Save.');
    };

    const handleRemoveCounter = (idToRemove: string) => {
        setCounters(counters.filter(c => c.id !== idToRemove));
        setSuccess('Counter removed. Remember to click Save.');
    };

    if (loading) {
        return (
            <div className="flex justify-center items-center h-64">
                <div className="w-8 h-8 border-4 border-slate-300 border-t-slate-800 rounded-full animate-spin"></div>
            </div>
        );
    }

    return (
        <div className="space-y-6 max-w-4xl mx-auto">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold bg-gradient-to-r from-slate-700 to-slate-900 bg-clip-text text-transparent flex items-center gap-2">
                        <SettingsIcon className="w-7 h-7 text-slate-700" />
                        Global Settings
                    </h1>
                    <p className="text-slate-500 mt-1">
                        Manage global app configurations, counters, and shifts.
                    </p>
                </div>

                <button
                    onClick={handleSave}
                    disabled={saving}
                    className="flex items-center gap-2 bg-slate-800 hover:bg-slate-900 text-white px-6 py-2.5 rounded-xl font-medium shadow-md transition-colors disabled:opacity-50 focus:ring-4 focus:ring-slate-300"
                >
                    {saving ? (
                        <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    ) : (
                        <Save className="w-4 h-4" />
                    )}
                    Save Settings
                </button>
            </div>

            {error && (
                <div className="bg-red-50 text-red-600 p-4 rounded-xl flex items-center gap-3 border border-red-100 animate-in fade-in slide-in-from-top-2">
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

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Left Column Controls */}
                <div className="space-y-6">

                    {/* Registration State Card */}
                    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden p-6 transition-all hover:shadow-md">
                        <div className="flex items-center justify-between mb-4">
                            <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                                Registration State
                            </h2>
                        </div>
                        <p className="text-sm text-slate-500 mb-6">
                            Toggle whether employees can submit or modify their weekly shift registrations.
                        </p>

                        <label className="relative inline-flex items-center cursor-pointer">
                            <input
                                type="checkbox"
                                className="sr-only peer"
                                checked={settings?.registrationOpen || false}
                                onChange={(e) => {
                                    setSettings(s => s ? { ...s, registrationOpen: e.target.checked } : null);
                                    setError(''); setSuccess('Setting updated locally. Remember to save.');
                                }}
                            />
                            <div className="w-14 h-7 bg-slate-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-emerald-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-6 after:w-6 after:transition-all peer-checked:bg-emerald-500"></div>
                            <span className={`ml-3 text-sm font-bold ${settings?.registrationOpen ? 'text-emerald-600' : 'text-slate-500'}`}>
                                {settings?.registrationOpen ? 'OPEN (Accepting)' : 'CLOSED (Locked)'}
                            </span>
                        </label>
                    </div>

                    {/* Shift Times Card */}
                    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden p-6 transition-all hover:shadow-md">
                        <div className="flex items-center justify-between mb-4">
                            <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                                <Clock className="w-5 h-5 text-indigo-500" />
                                Shift Times
                            </h2>
                        </div>

                        <div className="flex gap-2 mb-6">
                            <input
                                type="text"
                                value={newShift}
                                onChange={e => setNewShift(e.target.value)}
                                onKeyDown={e => e.key === 'Enter' && handleAddShift()}
                                placeholder="e.g. 08:00-12:00"
                                className="flex-1 bg-slate-50 border border-slate-200 text-sm rounded-lg focus:ring-indigo-500 focus:border-indigo-500 block p-2.5 outline-none"
                            />
                            <button
                                onClick={handleAddShift}
                                className="bg-indigo-50 text-indigo-600 hover:bg-indigo-100 hover:text-indigo-700 px-4 rounded-lg font-medium border border-indigo-200 transition-colors flex items-center"
                            >
                                <Plus className="w-4 h-4" />
                            </button>
                        </div>

                        <div className="space-y-2">
                            {settings?.shiftTimes.length === 0 ? (
                                <p className="text-sm text-slate-400 text-center py-2 bg-slate-50 rounded-lg border border-dashed">No shifts defined</p>
                            ) : (
                                settings?.shiftTimes.map(shift => (
                                    <div key={shift} className="flex items-center justify-between p-3 bg-slate-50 border border-slate-100 rounded-xl group hover:border-indigo-200 transition-colors">
                                        <span className="text-sm font-semibold text-slate-700 group-hover:text-indigo-700 flex items-center gap-2">
                                            <Clock className="w-4 h-4 text-slate-400 group-hover:text-indigo-400" />
                                            {shift}
                                        </span>
                                        <button
                                            onClick={() => handleRemoveShift(shift)}
                                            className="text-slate-400 hover:text-red-500 hover:bg-red-50 p-1.5 rounded-lg transition-colors"
                                        >
                                            <X className="w-4 h-4" />
                                        </button>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>

                </div>

                {/* Right Column: Counters */}
                <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden p-6 transition-all hover:shadow-md">
                    <div className="flex items-center justify-between mb-4">
                        <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                            <Store className="w-5 h-5 text-amber-500" />
                            Work Counters
                        </h2>
                    </div>
                    <p className="text-sm text-slate-500 mb-6">
                        These act as drop zones in the manager scheduling UI.
                    </p>

                    <div className="flex gap-2 mb-6">
                        <input
                            type="text"
                            value={newCounter}
                            onChange={e => setNewCounter(e.target.value)}
                            onKeyDown={e => e.key === 'Enter' && handleAddCounter()}
                            placeholder="e.g. Counter 1, Register A"
                            className="flex-1 bg-slate-50 border border-slate-200 text-sm rounded-lg focus:ring-amber-500 focus:border-amber-500 block p-2.5 outline-none"
                        />
                        <button
                            onClick={handleAddCounter}
                            className="bg-amber-50 text-amber-600 hover:bg-amber-100 hover:text-amber-700 px-4 rounded-lg font-medium border border-amber-200 transition-colors flex items-center"
                        >
                            <Plus className="w-4 h-4" />
                        </button>
                    </div>

                    <div className="space-y-2 max-h-[400px] overflow-y-auto pr-2">
                        {counters.length === 0 ? (
                            <p className="text-sm text-slate-400 text-center py-4 bg-slate-50 rounded-lg border border-dashed">No counters defined</p>
                        ) : (
                            counters.map(counter => (
                                <div key={counter.id} className="flex items-center justify-between p-3 bg-slate-50 border border-slate-100 rounded-xl group hover:border-amber-200 transition-colors">
                                    <span className="text-sm font-semibold text-slate-700 group-hover:text-amber-700">
                                        {counter.name}
                                    </span>
                                    <button
                                        onClick={() => handleRemoveCounter(counter.id)}
                                        className="text-slate-400 hover:text-red-500 hover:bg-red-50 p-1.5 rounded-lg transition-colors"
                                    >
                                        <X className="w-4 h-4" />
                                    </button>
                                </div>
                            ))
                        )}
                    </div>
                </div>

            </div>
        </div>
    );
}
