'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { SettingsDoc, CounterDoc } from '@/types';
import { Settings as SettingsIcon, Save, Plus, X, AlertCircle, CheckCircle2, Store, Clock, Users } from 'lucide-react';
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
    const [newSpecialDate, setNewSpecialDate] = useState('');
    const [newSpecialDateQuotas, setNewSpecialDateQuotas] = useState<Record<string, number>>({});

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

                if (!res.ok) throw new Error('Không thể tải cài đặt');
                const data = await res.json();

                // Ensure structure exists
                setSettings({
                    id: 'global',
                    registrationOpen: data.registrationOpen ?? false,
                    shiftTimes: data.shiftTimes || [],
                    quotas: {
                        defaultWeekday: data.quotas?.defaultWeekday || {},
                        defaultWeekend: data.quotas?.defaultWeekend || {},
                        specialDates: data.quotas?.specialDates || {}
                    },
                    monthlyQuotas: {
                        ftDaysOff: data.monthlyQuotas?.ftDaysOff || 4,
                        ptMinShifts: data.monthlyQuotas?.ptMinShifts || 10,
                        ptMaxShifts: data.monthlyQuotas?.ptMaxShifts || 25
                    }
                });
                setCounters(data.counters || []);

            } catch (err) {
                console.error(err);
                setError('Không thể tải cài đặt');
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

            if (!res.ok) throw new Error('Lưu cài đặt thất bại');
            setSuccess('Đã lưu cài đặt thành công!');
        } catch (err: unknown) {
            if (err instanceof Error) {
                setError(err.message);
            } else {
                setError('Đã xảy ra lỗi không xác định');
            }
        } finally {
            setSaving(false);
        }
    };

    const handleAddShift = () => {
        if (!newShift.trim() || !settings) return;
        if (settings.shiftTimes.includes(newShift.trim())) {
            setError('Khung giờ này đã tồn tại');
            return;
        }
        setSettings({
            ...settings,
            shiftTimes: [...settings.shiftTimes, newShift.trim()].sort()
        });
        setNewShift('');
        setSuccess('Đã thêm ca làm. Nhớ bấm Lưu.');
    };

    const handleRemoveShift = (shiftToRemove: string) => {
        if (!settings) return;
        setSettings({
            ...settings,
            shiftTimes: settings.shiftTimes.filter(s => s !== shiftToRemove)
        });
        setSuccess('Đã xóa ca làm. Nhớ bấm Lưu.');
    };

    const handleAddCounter = () => {
        if (!newCounter.trim()) return;
        if (counters.find(c => c.name.toLowerCase() === newCounter.trim().toLowerCase())) {
            setError('Quầy này đã tồn tại');
            return;
        }

        setCounters([
            ...counters,
            { id: `counter_${generateId()}`, name: newCounter.trim() }
        ]);
        setNewCounter('');
        setSuccess('Đã thêm quầy. Nhớ bấm Lưu.');
    };

    const handleRemoveCounter = (idToRemove: string) => {
        setCounters(counters.filter(c => c.id !== idToRemove));
        setSuccess('Đã xóa quầy. Nhớ bấm Lưu.');
    };

    const handleAddSpecialDate = () => {
        if (!newSpecialDate || !settings?.quotas) return;

        // Use default weekend quotas if newSpecialDateQuotas is empty for that shift
        const finalQuotas: Record<string, number> = {};
        settings.shiftTimes.forEach(shift => {
            finalQuotas[shift] = newSpecialDateQuotas[shift] || settings.quotas!.defaultWeekend[shift] || 5;
        });

        setSettings({
            ...settings,
            quotas: {
                ...settings.quotas,
                specialDates: {
                    ...settings.quotas.specialDates,
                    [newSpecialDate]: finalQuotas
                }
            }
        });
        setNewSpecialDate('');
        setNewSpecialDateQuotas({});
        setSuccess('Đã thêm định mức ngày đặc biệt. Nhớ bấm Lưu.');
    };

    const handleRemoveSpecialDate = (dateCode: string) => {
        if (!settings?.quotas) return;
        const newDates = { ...settings.quotas.specialDates };
        delete newDates[dateCode];
        setSettings({
            ...settings,
            quotas: {
                ...settings.quotas,
                specialDates: newDates
            }
        });
        setSuccess('Đã xóa ngày đặc biệt.');
    };

    if (loading) {
        return (
            <div className="flex justify-center items-center h-64">
                <div className="w-8 h-8 border-4 border-slate-300 border-t-slate-800 rounded-full animate-spin"></div>
            </div>
        );
    }

    return (
        <div className="space-y-6 mx-auto">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold bg-gradient-to-r from-slate-700 to-slate-900 bg-clip-text text-transparent flex items-center gap-2">
                        <SettingsIcon className="w-7 h-7 text-slate-700" />
                        Cài đặt hệ thống
                    </h1>
                    <p className="text-slate-500 mt-1">
                        Quản lý cấu hình toàn hệ thống, quầy và các ca làm.
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
                    Lưu cài đặt
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
                            Đóng
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
                                Trạng thái Đăng ký
                            </h2>
                        </div>
                        <p className="text-sm text-slate-500 mb-6">
                            Bật/tắt quyền cho phép nhân viên đăng ký hoặc sửa đổi ca làm hàng tuần.
                        </p>

                        <label className="relative inline-flex items-center cursor-pointer">
                            <input
                                type="checkbox"
                                className="sr-only peer"
                                checked={settings?.registrationOpen || false}
                                onChange={(e) => {
                                    setSettings(s => s ? { ...s, registrationOpen: e.target.checked } : null);
                                    setError(''); setSuccess('Cài đặt đã cập nhật cục bộ. Nhớ bấm Lưu.');
                                }}
                            />
                            <div className="w-14 h-7 bg-slate-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-emerald-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-6 after:w-6 after:transition-all peer-checked:bg-emerald-500"></div>
                            <span className={`ml-3 text-sm font-bold ${settings?.registrationOpen ? 'text-emerald-600' : 'text-slate-500'}`}>
                                {settings?.registrationOpen ? 'ĐANG MỞ (Chấp nhận đăng ký)' : 'ĐÃ ĐÓNG (Khóa đăng ký)'}
                            </span>
                        </label>
                    </div>

                    {/* Shift Times Card */}
                    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden p-6 transition-all hover:shadow-md">
                        <div className="flex items-center justify-between mb-4">
                            <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                                <Clock className="w-5 h-5 text-indigo-500" />
                                Khung giờ làm việc
                            </h2>
                        </div>

                        <div className="flex gap-2 mb-6">
                            <input
                                type="text"
                                value={newShift}
                                onChange={e => setNewShift(e.target.value)}
                                onKeyDown={e => e.key === 'Enter' && handleAddShift()}
                                placeholder="VD: 08:00-12:00"
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
                                <p className="text-sm text-slate-400 text-center py-2 bg-slate-50 rounded-lg border border-dashed">Chưa có khung giờ nào</p>
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

                    {/* Quota Settings Card */}
                    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden p-6 transition-all hover:shadow-md">
                        <div className="flex items-center justify-between mb-4">
                            <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                                <Users className="w-5 h-5 text-fuchsia-500" />
                                Định mức nhân viên (Số người tối đa)
                            </h2>
                        </div>

                        <div className="space-y-4 mb-6">
                            {settings?.shiftTimes.length === 0 ? (
                                <p className="text-sm text-slate-400 text-center py-2 bg-slate-50 rounded-lg">Chưa có khung giờ nào để thiết lập định mức.</p>
                            ) : (
                                settings?.shiftTimes.map(shift => (
                                    <div key={shift} className="grid grid-cols-2 gap-4 items-center bg-slate-50 p-3 rounded-xl border border-slate-100">
                                        <div className="col-span-2 text-sm font-bold text-slate-700 pb-2 border-b border-slate-200">
                                            Ca làm: {shift}
                                        </div>
                                        <div className="space-y-1.5">
                                            <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Định mức ngày thường</label>
                                            <input
                                                type="number" min="1"
                                                value={settings?.quotas?.defaultWeekday?.[shift] || ''}
                                                onChange={e => settings && setSettings({
                                                    ...settings,
                                                    quotas: {
                                                        ...settings.quotas!,
                                                        defaultWeekday: {
                                                            ...settings.quotas!.defaultWeekday,
                                                            [shift]: parseInt(e.target.value) || 1
                                                        }
                                                    }
                                                })}
                                                className="w-full bg-white border border-slate-200 text-sm font-bold rounded-lg focus:ring-fuchsia-500 focus:border-fuchsia-500 block p-2"
                                                placeholder="e.g. 5"
                                            />
                                        </div>
                                        <div className="space-y-1.5">
                                            <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Định mức cuối tuần</label>
                                            <input
                                                type="number" min="1"
                                                value={settings?.quotas?.defaultWeekend?.[shift] || ''}
                                                onChange={e => settings && setSettings({
                                                    ...settings,
                                                    quotas: {
                                                        ...settings.quotas!,
                                                        defaultWeekend: {
                                                            ...settings.quotas!.defaultWeekend,
                                                            [shift]: parseInt(e.target.value) || 1
                                                        }
                                                    }
                                                })}
                                                className="w-full bg-white border border-slate-200 text-sm font-bold rounded-lg focus:ring-fuchsia-500 focus:border-fuchsia-500 block p-2"
                                                placeholder="e.g. 8"
                                            />
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>

                        {/* Monthly Quotas Global Configuration */}
                        <div className="border-t border-slate-100 pt-6 mt-6">
                            <h3 className="text-sm font-bold text-slate-700 mb-3 flex items-center gap-2">
                                <AlertCircle className="w-4 h-4 text-orange-500" />
                                Định mức ca làm / Tháng
                            </h3>
                            <div className="bg-orange-50/50 p-4 rounded-xl border border-orange-100 space-y-4">

                                <div className="space-y-1.5 pb-3 border-b border-orange-200/50">
                                    <label className="text-xs font-semibold text-slate-600 block">
                                        Toàn thời gian (FT) & Quản lý: <span className="text-orange-600">Số ngày nghỉ / tháng</span>
                                    </label>
                                    <input
                                        type="number" min="0" max="31"
                                        value={settings?.monthlyQuotas?.ftDaysOff ?? ''}
                                        onChange={e => settings && setSettings({
                                            ...settings,
                                            monthlyQuotas: {
                                                ...settings.monthlyQuotas!,
                                                ftDaysOff: parseInt(e.target.value) || 0
                                            }
                                        })}
                                        className="w-full sm:w-1/2 bg-white border border-slate-200 text-sm font-bold rounded-lg focus:ring-orange-500 focus:border-orange-500 block p-2"
                                        placeholder="VD: 4"
                                    />
                                    <p className="text-[10px] text-orange-600/80 mt-1">Hệ thống sẽ tự tính: [Số ngày trong tháng] - [Số ngày nghỉ] = Tổng số ca tối đa.</p>
                                </div>

                                <div>
                                    <label className="text-xs font-semibold text-slate-600 block mb-2">
                                        Bán thời gian (PT): <span className="text-orange-600">Số ca tối thiểu & tối đa / tháng</span>
                                    </label>
                                    <div className="grid grid-cols-2 gap-4">
                                        <div className="space-y-1.5">
                                            <label className="text-[10px] font-semibold text-slate-500 uppercase">Tối thiểu</label>
                                            <input
                                                type="number" min="0"
                                                value={settings?.monthlyQuotas?.ptMinShifts ?? ''}
                                                onChange={e => settings && setSettings({
                                                    ...settings,
                                                    monthlyQuotas: {
                                                        ...settings.monthlyQuotas!,
                                                        ptMinShifts: parseInt(e.target.value) || 0
                                                    }
                                                })}
                                                className="w-full bg-white border border-slate-200 text-sm font-bold rounded-lg focus:ring-orange-500 focus:border-orange-500 block p-2"
                                                placeholder="VD: 10"
                                            />
                                        </div>
                                        <div className="space-y-1.5">
                                            <label className="text-[10px] font-semibold text-slate-500 uppercase">Tối đa</label>
                                            <input
                                                type="number" min="1"
                                                value={settings?.monthlyQuotas?.ptMaxShifts ?? ''}
                                                onChange={e => settings && setSettings({
                                                    ...settings,
                                                    monthlyQuotas: {
                                                        ...settings.monthlyQuotas!,
                                                        ptMaxShifts: parseInt(e.target.value) || 0
                                                    }
                                                })}
                                                className="w-full bg-white border border-slate-200 text-sm font-bold rounded-lg focus:ring-orange-500 focus:border-orange-500 block p-2"
                                                placeholder="VD: 25"
                                            />
                                        </div>
                                    </div>
                                </div>

                            </div>
                        </div>

                        <div className="border-t border-slate-100 pt-6 mt-6">
                            <h3 className="text-sm font-bold text-slate-700 mb-3">Ngày đặc biệt & Ngày lễ</h3>
                            <div className="bg-fuchsia-50/50 p-4 rounded-xl border border-fuchsia-100 mb-4 space-y-4">
                                <div>
                                    <label className="text-xs font-semibold text-slate-600 block mb-1">Chọn ngày</label>
                                    <input
                                        type="date"
                                        value={newSpecialDate}
                                        onChange={e => setNewSpecialDate(e.target.value)}
                                        className="w-full bg-white border border-slate-200 text-sm rounded-lg focus:ring-fuchsia-500 focus:border-fuchsia-500 block p-2 outline-none"
                                    />
                                </div>

                                {newSpecialDate && settings && settings.shiftTimes.length > 0 && (
                                    <div className="space-y-3">
                                        <label className="text-xs font-semibold text-slate-600 block">Thiết lập giới hạn cho ngày này (mặc định theo định mức cuối tuần nếu để trống)</label>
                                        <div className="grid grid-cols-2 lg:grid-cols-3 gap-2">
                                            {settings.shiftTimes.map(shift => (
                                                <div key={shift} className="space-y-1">
                                                    <label className="text-[10px] font-bold text-slate-500">{shift}</label>
                                                    <input
                                                        type="number" min="1"
                                                        value={newSpecialDateQuotas[shift] || ''}
                                                        onChange={e => setNewSpecialDateQuotas({
                                                            ...newSpecialDateQuotas,
                                                            [shift]: parseInt(e.target.value) || 1
                                                        })}
                                                        placeholder={String(settings.quotas?.defaultWeekend?.[shift] || 5)}
                                                        className="w-full bg-white border border-slate-200 text-xs rounded-lg focus:ring-fuchsia-500 focus:border-fuchsia-500 block p-2"
                                                    />
                                                </div>
                                            ))}
                                        </div>
                                        <button
                                            onClick={handleAddSpecialDate}
                                            className="w-full mt-2 bg-fuchsia-100 hover:bg-fuchsia-200 text-fuchsia-700 py-2 rounded-lg font-bold text-sm transition-colors border border-fuchsia-200"
                                        >
                                            Thêm định mức ngày đặc biệt
                                        </button>
                                    </div>
                                )}
                            </div>

                            <div className="space-y-3">
                                {!settings?.quotas?.specialDates || Object.keys(settings.quotas.specialDates).length === 0 ? (
                                    <p className="text-sm text-slate-400 text-center py-2 bg-slate-50 rounded-lg border border-dashed">Chưa có ngày đặc biệt nào</p>
                                ) : (
                                    Object.entries(settings.quotas.specialDates).sort((a, b) => a[0].localeCompare(b[0])).map(([dateCode, shiftQuotas]) => (
                                        <div key={dateCode} className="p-3 bg-white border border-slate-200 shadow-sm rounded-xl group relative">
                                            <div className="flex items-center justify-between mb-2 pb-2 border-b border-slate-100">
                                                <span className="text-sm font-bold text-slate-800">{new Date(dateCode).toLocaleDateString('vi-VN')}</span>
                                                <button
                                                    onClick={() => handleRemoveSpecialDate(dateCode)}
                                                    className="text-slate-400 hover:text-red-500 hover:bg-red-50 p-1 rounded transition-colors absolute top-2 right-2"
                                                >
                                                    <X className="w-4 h-4" />
                                                </button>
                                            </div>
                                            <div className="flex flex-wrap gap-2 text-xs">
                                                {Object.entries(shiftQuotas).map(([shift, limit]) => (
                                                    <div key={shift} className="bg-fuchsia-50 text-fuchsia-700 px-2 py-1 rounded border border-fuchsia-100">
                                                        <span className="font-semibold">{shift}:</span> {limit}
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    ))
                                )}
                            </div>
                        </div>

                    </div>

                </div>

                {/* Right Column: Counters */}
                <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden p-6 transition-all hover:shadow-md">
                    <div className="flex items-center justify-between mb-4">
                        <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                            <Store className="w-5 h-5 text-amber-500" />
                            Quầy làm việc
                        </h2>
                    </div>
                    <p className="text-sm text-slate-500 mb-6">
                        Các quầy này dùng để kéo thả phân công trong giao diện quản lý.
                    </p>

                    <div className="flex gap-2 mb-6">
                        <input
                            type="text"
                            value={newCounter}
                            onChange={e => setNewCounter(e.target.value)}
                            onKeyDown={e => e.key === 'Enter' && handleAddCounter()}
                            placeholder="VD: Quầy 1, Register A"
                            className="flex-1 bg-slate-50 border border-slate-200 text-sm rounded-lg focus:ring-amber-500 focus:border-amber-500 block p-2.5 outline-none"
                        />
                        <button
                            onClick={handleAddCounter}
                            className="bg-amber-50 text-amber-600 hover:bg-amber-100 hover:text-amber-700 px-4 rounded-lg font-medium border border-amber-200 transition-colors flex items-center"
                        >
                            <Plus className="w-4 h-4" />
                        </button>
                    </div>

                    <div className="space-y-2 overflow-y-auto pr-2">
                        {counters.length === 0 ? (
                            <p className="text-sm text-slate-400 text-center py-4 bg-slate-50 rounded-lg border border-dashed">Chưa có quầy nào</p>
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
