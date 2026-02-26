'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import {
    Settings as SettingsIcon, Save, Plus, X, AlertCircle, CheckCircle2,
    Clock, Users, Timer, ToggleLeft, ToggleRight, ShieldAlert
} from 'lucide-react';
import { StoreSettings, RegistrationSchedule } from '@/types';

const DAY_NAMES = ['Chủ nhật', 'Thứ 2', 'Thứ 3', 'Thứ 4', 'Thứ 5', 'Thứ 6', 'Thứ 7'];
const pad = (n: number) => String(n).padStart(2, '0');

export default function ManagerSettingsPage() {
    const { user, userDoc } = useAuth();

    const [settings, setSettings] = useState<StoreSettings | null>(null);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');
    const [newShift, setNewShift] = useState('');
    const [schedule, setSchedule] = useState<RegistrationSchedule>({
        enabled: false,
        openDay: 1, openHour: 8, openMinute: 0,
        closeDay: 5, closeHour: 22, closeMinute: 0,
    });

    const storeId = userDoc?.storeId ?? '';
    const getToken = useCallback(() => user?.getIdToken(), [user]);

    // Fetch store settings on load
    useEffect(() => {
        if (!user || !storeId) return;

        async function fetchSettings() {
            try {
                const token = await getToken();
                const res = await fetch(`/api/stores/${storeId}/settings`, {
                    headers: { 'Authorization': `Bearer ${token}` }
                });
                if (!res.ok) throw new Error('Không thể tải cài đặt cửa hàng');
                const data: StoreSettings = await res.json();

                setSettings({
                    registrationOpen: data.registrationOpen ?? false,
                    shiftTimes: data.shiftTimes || [],
                    quotas: {
                        defaultWeekday: data.quotas?.defaultWeekday || {},
                        defaultWeekend: data.quotas?.defaultWeekend || {},
                        specialDates: data.quotas?.specialDates || {},
                    },
                    monthlyQuotas: {
                        ftDaysOff: data.monthlyQuotas?.ftDaysOff ?? 4,
                        ptMinShifts: data.monthlyQuotas?.ptMinShifts ?? 10,
                        ptMaxShifts: data.monthlyQuotas?.ptMaxShifts ?? 25,
                    },
                    registrationSchedule: data.registrationSchedule,
                });
                if (data.registrationSchedule) {
                    setSchedule(data.registrationSchedule);
                }
            } catch (err) {
                console.error(err);
                setError('Không thể tải cài đặt cửa hàng');
            } finally {
                setLoading(false);
            }
        }

        fetchSettings();
    }, [user, storeId, getToken]);

    const handleSave = async () => {
        if (!settings || !user || !storeId) return;
        setSaving(true);
        setError('');
        setSuccess('');

        try {
            const payload: StoreSettings = { ...settings, registrationSchedule: schedule };
            const token = await user.getIdToken();
            const res = await fetch(`/api/stores/${storeId}/settings`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`,
                },
                body: JSON.stringify(payload),
            });
            if (!res.ok) {
                const errData = await res.json();
                throw new Error(errData.error || 'Lưu cài đặt thất bại');
            }
            setSuccess('Đã lưu cài đặt cửa hàng thành công!');
        } catch (err: unknown) {
            setError(err instanceof Error ? err.message : 'Đã xảy ra lỗi không xác định');
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
        setSettings({ ...settings, shiftTimes: [...settings.shiftTimes, newShift.trim()].sort() });
        setNewShift('');
        setSuccess('Đã thêm ca làm. Nhớ bấm Lưu.');
    };

    const handleRemoveShift = (shiftToRemove: string) => {
        if (!settings) return;
        setSettings({ ...settings, shiftTimes: settings.shiftTimes.filter(s => s !== shiftToRemove) });
        setSuccess('Đã xóa ca làm. Nhớ bấm Lưu.');
    };

    if (!userDoc || !['admin', 'store_manager'].includes(userDoc.role)) {
        return (
            <div className="flex flex-col items-center justify-center h-64 gap-3 text-red-500">
                <ShieldAlert className="w-10 h-10" />
                <p className="font-bold">Không có quyền truy cập trang này.</p>
            </div>
        );
    }

    if (!storeId) {
        return (
            <div className="flex flex-col items-center justify-center h-64 gap-3 text-amber-600">
                <AlertCircle className="w-10 h-10" />
                <p className="font-bold">Tài khoản chưa được gán vào cửa hàng nào.</p>
            </div>
        );
    }

    if (loading) {
        return (
            <div className="flex justify-center items-center h-64">
                <div className="w-8 h-8 border-4 border-slate-300 border-t-slate-800 rounded-full animate-spin"></div>
            </div>
        );
    }

    const openLabel = `${DAY_NAMES[schedule.openDay]} ${pad(schedule.openHour)}:${pad(schedule.openMinute)}`;
    const closeLabel = `${DAY_NAMES[schedule.closeDay]} ${pad(schedule.closeHour)}:${pad(schedule.closeMinute)}`;

    return (
        <div className="space-y-6 max-w-3xl mx-auto">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold bg-gradient-to-r from-slate-700 to-slate-900 bg-clip-text text-transparent flex items-center gap-2">
                        <SettingsIcon className="w-7 h-7 text-slate-700" />
                        Cài đặt cửa hàng
                    </h1>
                    <p className="text-slate-500 mt-1">
                        Quản lý đăng ký ca làm và khung giờ cho cửa hàng của bạn.
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

            {/* Error / Success Messages */}
            {error && (
                <div className="bg-red-50 text-red-600 p-4 rounded-xl flex items-center gap-3 border border-red-100 animate-in fade-in slide-in-from-top-2">
                    <AlertCircle className="w-5 h-5 shrink-0" />
                    <p className="text-sm font-medium">{error}</p>
                </div>
            )}
            {success && (
                <div className="bg-emerald-50 text-emerald-700 p-4 rounded-xl flex items-center gap-3 border border-emerald-200 animate-in fade-in slide-in-from-top-2">
                    <CheckCircle2 className="w-5 h-5 shrink-0 text-emerald-500" />
                    <div className="flex-1 flex items-center justify-between">
                        <p className="text-sm font-medium">{success}</p>
                        <button onClick={() => setSuccess('')} className="text-emerald-600 hover:text-emerald-800 text-xs font-semibold px-2 py-1 bg-emerald-100/50 rounded-md">Đóng</button>
                    </div>
                </div>
            )}

            {/* Registration Toggle */}
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
                <h2 className="text-lg font-bold text-slate-800 mb-1">Trạng thái Đăng ký</h2>
                <p className="text-sm text-slate-500 mb-6">
                    Bật/tắt quyền cho phép nhân viên đăng ký hoặc sửa đổi ca làm hàng tuần.
                </p>

                <button
                    onClick={() => {
                        setSettings(s => s ? { ...s, registrationOpen: !s.registrationOpen } : null);
                        setSuccess('Cài đặt đã cập nhật cục bộ. Nhớ bấm Lưu.');
                        setError('');
                    }}
                    className={`flex items-center gap-3 px-5 py-3 rounded-xl border-2 font-semibold transition-all text-sm ${settings?.registrationOpen
                            ? 'border-emerald-400 bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
                            : 'border-slate-300 bg-slate-50 text-slate-600 hover:bg-slate-100'
                        }`}
                >
                    {settings?.registrationOpen
                        ? <ToggleRight className="w-6 h-6 text-emerald-500" />
                        : <ToggleLeft className="w-6 h-6 text-slate-400" />}
                    {settings?.registrationOpen ? 'ĐANG MỞ — Chấp nhận đăng ký' : 'ĐÃ ĐÓNG — Khóa đăng ký'}
                </button>
            </div>

            {/* Auto-Schedule */}
            <div className={`bg-white rounded-2xl border shadow-sm p-6 transition-all ${schedule.enabled ? 'border-indigo-300 ring-1 ring-indigo-200' : 'border-slate-200'}`}>
                <div className="flex items-center justify-between mb-4">
                    <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                        <Timer className="w-5 h-5 text-indigo-500" />
                        Hẹn giờ tự động
                    </h2>
                    <label className="relative inline-flex items-center cursor-pointer">
                        <input
                            type="checkbox"
                            className="sr-only peer"
                            checked={schedule.enabled}
                            onChange={e => setSchedule(s => ({ ...s, enabled: e.target.checked }))}
                        />
                        <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-indigo-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-500"></div>
                    </label>
                </div>
                <p className="text-sm text-slate-500 mb-5">
                    Tự động mở/đóng đăng ký theo lịch hàng tuần.
                    {!schedule.enabled && <span className="text-amber-600 font-semibold ml-1">Hiện đang tắt.</span>}
                </p>

                {schedule.enabled && (
                    <>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-5">
                            {/* Open Window */}
                            <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 space-y-3">
                                <h3 className="text-sm font-bold text-emerald-800 flex items-center gap-1.5">
                                    <span className="w-2 h-2 rounded-full bg-emerald-500"></span>Mở Đăng ký
                                </h3>
                                <div className="space-y-1.5">
                                    <label className="text-xs font-semibold text-slate-600">Ngày trong tuần</label>
                                    <select
                                        value={schedule.openDay}
                                        onChange={e => setSchedule(s => ({ ...s, openDay: +e.target.value }))}
                                        className="w-full bg-white border border-emerald-200 text-sm rounded-lg focus:ring-emerald-500 focus:border-emerald-500 p-2 font-medium"
                                    >
                                        {DAY_NAMES.map((d, i) => <option key={i} value={i}>{d}</option>)}
                                    </select>
                                </div>
                                <div className="space-y-1.5">
                                    <label className="text-xs font-semibold text-slate-600">Giờ mở</label>
                                    <input
                                        type="time"
                                        value={`${pad(schedule.openHour)}:${pad(schedule.openMinute)}`}
                                        onChange={e => {
                                            const [h, m] = e.target.value.split(':').map(Number);
                                            setSchedule(s => ({ ...s, openHour: h, openMinute: m }));
                                        }}
                                        className="w-full bg-white border border-emerald-200 text-sm rounded-lg focus:ring-emerald-500 focus:border-emerald-500 p-2 font-medium"
                                    />
                                </div>
                            </div>

                            {/* Close Window */}
                            <div className="bg-red-50 border border-red-200 rounded-xl p-4 space-y-3">
                                <h3 className="text-sm font-bold text-red-800 flex items-center gap-1.5">
                                    <span className="w-2 h-2 rounded-full bg-red-500"></span>Đóng Đăng ký
                                </h3>
                                <div className="space-y-1.5">
                                    <label className="text-xs font-semibold text-slate-600">Ngày trong tuần</label>
                                    <select
                                        value={schedule.closeDay}
                                        onChange={e => setSchedule(s => ({ ...s, closeDay: +e.target.value }))}
                                        className="w-full bg-white border border-red-200 text-sm rounded-lg focus:ring-red-500 focus:border-red-500 p-2 font-medium"
                                    >
                                        {DAY_NAMES.map((d, i) => <option key={i} value={i}>{d}</option>)}
                                    </select>
                                </div>
                                <div className="space-y-1.5">
                                    <label className="text-xs font-semibold text-slate-600">Giờ đóng</label>
                                    <input
                                        type="time"
                                        value={`${pad(schedule.closeHour)}:${pad(schedule.closeMinute)}`}
                                        onChange={e => {
                                            const [h, m] = e.target.value.split(':').map(Number);
                                            setSchedule(s => ({ ...s, closeHour: h, closeMinute: m }));
                                        }}
                                        className="w-full bg-white border border-red-200 text-sm rounded-lg focus:ring-red-500 focus:border-red-500 p-2 font-medium"
                                    />
                                </div>
                            </div>
                        </div>

                        {/* Preview */}
                        <div className="bg-indigo-50 border border-indigo-100 rounded-xl p-3 text-xs text-indigo-700 flex items-start gap-2">
                            <Timer className="w-3.5 h-3.5 mt-0.5 shrink-0 text-indigo-400" />
                            <span>
                                Hệ thống sẽ tự động <strong className="text-emerald-700">mở</strong> vào <strong>{openLabel}</strong> và <strong className="text-red-600">đóng</strong> vào <strong>{closeLabel}</strong> hàng tuần (giờ Việt Nam).
                            </span>
                        </div>
                    </>
                )}
            </div>

            {/* Shift Times */}
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
                <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2 mb-4">
                    <Clock className="w-5 h-5 text-indigo-500" />
                    Khung giờ làm việc
                </h2>

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

            {/* Monthly Quotas */}
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
                <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2 mb-4">
                    <Users className="w-5 h-5 text-fuchsia-500" />
                    Định mức ca làm / Tháng
                </h2>

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
                                monthlyQuotas: { ...settings.monthlyQuotas!, ftDaysOff: parseInt(e.target.value) || 0 }
                            })}
                            className="w-full sm:w-1/2 bg-white border border-slate-200 text-sm font-bold rounded-lg focus:ring-orange-500 focus:border-orange-500 block p-2"
                            placeholder="VD: 4"
                        />
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
                                        monthlyQuotas: { ...settings.monthlyQuotas!, ptMinShifts: parseInt(e.target.value) || 0 }
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
                                        monthlyQuotas: { ...settings.monthlyQuotas!, ptMaxShifts: parseInt(e.target.value) || 0 }
                                    })}
                                    className="w-full bg-white border border-slate-200 text-sm font-bold rounded-lg focus:ring-orange-500 focus:border-orange-500 block p-2"
                                    placeholder="VD: 25"
                                />
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
