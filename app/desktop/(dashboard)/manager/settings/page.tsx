'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Settings as SettingsIcon, Save, Plus, X, AlertCircle, CheckCircle2, Store, Clock, Users, Timer, ShieldAlert, Package } from 'lucide-react';
import { SettingsDoc, CounterDoc, RegistrationSchedule } from '@/types';
import { DashboardHeader } from '@/components/inventory/overview/DashboardHeader';

const DAY_NAMES = ['Chủ nhật', 'Thứ 2', 'Thứ 3', 'Thứ 4', 'Thứ 5', 'Thứ 6', 'Thứ 7'];
const pad = (n: number) => String(n).padStart(2, '0');

export default function ManagerSettingsPage() {
    const { user, userDoc, hasPermission, effectiveStoreId } = useAuth();

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

    // Auto-schedule state
    const [schedule, setSchedule] = useState<RegistrationSchedule>({
        enabled: false,
        openDay: 1, openHour: 8, openMinute: 0,
        closeDay: 5, closeHour: 22, closeMinute: 0,
    });

    // Admin store selector for settings — only actual stores (not offices/warehouses)
    const [adminStores, setAdminStores] = useState<{ id: string; name: string }[]>([]);
    const [selectedStoreId, setSelectedStoreId] = useState('');

    // Resolve storeId: non-admin gets their assigned store; admin picks from list
    const storeId = userDoc?.role === 'admin' ? selectedStoreId : (effectiveStoreId || userDoc?.storeId || '');

    // Fetch stores list for admin to select from
    useEffect(() => {
        if (userDoc?.role !== 'admin' || !user) return;
        (async () => {
            try {
                const token = await user.getIdToken();
                const res = await fetch('/api/stores', { headers: { Authorization: `Bearer ${token}` } });
                const data = await res.json();
                const storeList = Array.isArray(data) ? data.map((s: any) => ({ id: s.id, name: s.name })) : [];
                setAdminStores(storeList);
                // Auto-select from localStorage if the stored ID is an actual store
                const saved = typeof window !== 'undefined' ? localStorage.getItem('globalSelectedStoreId') : '';
                if (saved && storeList.some((s: { id: string }) => s.id === saved)) {
                    setSelectedStoreId(saved);
                } else if (storeList.length > 0) {
                    setSelectedStoreId(storeList[0].id);
                }
            } catch { /* silent */ }
        })();
    }, [userDoc, user]);

    const generateId = () => Math.random().toString(36).substring(2, 9);

    // Fetch settings for store manager's own store
    useEffect(() => {
        if (!user || !storeId) return;

        async function fetchSettings() {
            setLoading(true);
            try {
                const token = await user!.getIdToken();
                const res = await fetch(`/api/stores/${storeId}/settings`, {
                    headers: { 'Authorization': `Bearer ${token}` }
                });
                if (!res.ok) throw new Error('Không thể tải cài đặt cửa hàng');
                const data = await res.json();

                setSettings({
                    id: storeId,
                    registrationOpen: data.registrationOpen ?? false,
                    strictShiftLimit: data.strictShiftLimit ?? true,
                    maxShiftsPerDay: data.maxShiftsPerDay ?? undefined,
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
                if (data.registrationSchedule) {
                    setSchedule(data.registrationSchedule);
                } else {
                    setSchedule({ enabled: false, openDay: 1, openHour: 8, openMinute: 0, closeDay: 5, closeHour: 22, closeMinute: 0 });
                }
                setCounters(data.counters || []);
            } catch (err) {
                console.error(err);
                setError('Không thể tải cài đặt');
            } finally {
                setLoading(false);
            }
        }

        fetchSettings();
    }, [user, storeId]);

    const handleSave = async (e?: React.FormEvent) => {
        if (e) e.preventDefault();
        if (!settings || !user || !storeId) return;

        setSaving(true);
        setError('');
        setSuccess('');

        try {
            const payload = { ...settings, counters, registrationSchedule: schedule };
            const token = await user.getIdToken();

            const res = await fetch(`/api/stores/${storeId}/settings`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                body: JSON.stringify(payload)
            });

            if (!res.ok) throw new Error('Lưu cài đặt thất bại');
            setSuccess('Đã lưu cài đặt thành công!');
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
            { id: `counter_${generateId()}`, name: newCounter.trim(), storeId: '', isActive: true }
        ]);
        setNewCounter('');
        setSuccess('Đã thêm quầy. Nhớ bấm Lưu.');
    };

    const handleRemoveCounter = (idToRemove: string) => {
        setCounters(counters.filter(c => c.id !== idToRemove));
        setSuccess('Đã xóa quầy. Nhớ bấm Lưu.');
    };

    const handleToggleCounter = (id: string) => {
        setCounters(counters.map(c => c.id === id ? { ...c, isActive: !(c.isActive !== false) } : c));
        setSuccess('Đã thay đổi trạng thái. Nhớ bấm Lưu.');
    };

    const handleRenameCounter = (id: string, newName: string) => {
        if (!newName.trim()) return;
        setCounters(counters.map(c => c.id === id ? { ...c, name: newName.trim() } : c));
    };

    const handleAddSpecialDate = () => {
        if (!newSpecialDate || !settings?.quotas) return;

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

    if (!userDoc || (
        userDoc.role !== 'store_manager' &&
        userDoc.role !== 'admin' &&
        !hasPermission('page.manager.settings')
    )) {
        return <div className="p-8 text-center text-danger-500 font-bold">Không có quyền truy cập.</div>;
    }

    // Admin: show store selector if no store is selected yet
    if (userDoc.role === 'admin' && !storeId && adminStores.length === 0) {
        return (
            <div className="flex justify-center items-center h-64">
                <div className="w-8 h-8 border-4 border-surface-300 border-t-surface-800 rounded-full animate-spin"></div>
            </div>
        );
    }

    if (loading && storeId) {
        return (
            <div className="flex justify-center items-center h-64">
                <div className="w-8 h-8 border-4 border-surface-300 border-t-surface-800 rounded-full animate-spin"></div>
            </div>
        );
    }

    return (
        <div className="space-y-6 mx-auto">
            {/* Header */}
            <DashboardHeader
                showSelect={false}
                titleChildren={
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 w-full">
                        <div>
                            <h1 className="text-2xl font-bold bg-gradient-to-r from-surface-700 to-surface-900 bg-clip-text text-transparent flex items-center gap-2">
                                <SettingsIcon className="w-7 h-7 text-surface-700" />
                                Cài đặt cửa hàng
                            </h1>
                            <p className="text-surface-500 mt-1 text-sm">
                                Quản lý cài đặt ca làm, quầy, định mức và lịch đăng ký cho cửa hàng của bạn.
                            </p>
                        </div>

                        <div className="flex items-center gap-3">
                            {userDoc?.role === 'admin' && adminStores.length > 0 && (
                                <select
                                    value={selectedStoreId}
                                    onChange={e => { setSelectedStoreId(e.target.value); localStorage.setItem('globalSelectedStoreId', e.target.value); }}
                                    className="bg-surface-50 border border-surface-200 text-sm rounded-xl px-3 py-2.5 outline-none focus:ring-2 focus:ring-surface-300 font-medium text-surface-700"
                                >
                                    {adminStores.map(s => (
                                        <option key={s.id} value={s.id}>{s.name}</option>
                                    ))}
                                </select>
                            )}

                            <button
                                onClick={handleSave}
                                disabled={saving}
                                className="flex items-center justify-center gap-2 bg-surface-800 hover:bg-surface-900 text-white px-6 py-2.5 rounded-xl font-medium shadow-md transition-colors disabled:opacity-50 focus:ring-4 focus:ring-surface-300"
                            >
                                {saving ? (
                                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                                ) : (
                                    <Save className="w-4 h-4" />
                                )}
                                Lưu cài đặt
                            </button>
                        </div>
                    </div>
                }
            />

            {error && (
                <div className="bg-danger-50 text-danger-600 p-4 rounded-xl flex items-center gap-3 border border-danger-100 animate-in fade-in slide-in-from-top-2">
                    <AlertCircle className="w-5 h-5 shrink-0" />
                    <p className="text-sm font-medium">{error}</p>
                </div>
            )}

            {success && (
                <div className="bg-success-50 text-success-700 p-4 rounded-xl flex items-center gap-3 border border-success-200 animate-in fade-in slide-in-from-top-2 shadow-sm">
                    <CheckCircle2 className="w-5 h-5 shrink-0 text-success-500" />
                    <div className="flex-1 flex items-center justify-between">
                        <p className="text-sm font-medium">{success}</p>
                        <button onClick={() => setSuccess('')} className="text-success-600 hover:text-success-800 text-xs font-semibold px-2 py-1 bg-success-100/50 rounded-md">
                            Đóng
                        </button>
                    </div>
                </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Left Column Controls */}
                <div className="space-y-6">

                    {/* Registration State Card */}
                    <div className="bg-white rounded-2xl border border-surface-200 shadow-sm overflow-hidden p-6 transition-all hover:shadow-md">
                        <div className="flex items-center justify-between mb-4">
                            <h2 className="text-lg font-bold text-surface-800 flex items-center gap-2">
                                Trạng thái Đăng ký
                            </h2>
                        </div>
                        <p className="text-sm text-surface-500 mb-6">
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
                            <div className="w-14 h-7 bg-surface-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-success-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-surface-300 after:border after:rounded-full after:h-6 after:w-6 after:transition-all peer-checked:bg-success-500"></div>
                            <span className={`ml-3 text-sm font-bold ${settings?.registrationOpen ? 'text-success-600' : 'text-surface-500'}`}>
                                {settings?.registrationOpen ? 'ĐANG MỞ (Chấp nhận đăng ký)' : 'ĐÃ ĐÓNG (Khóa đăng ký)'}
                            </span>
                        </label>
                    </div>

                    {/* Auto-Schedule Card */}
                    {(() => {
                        const openLabel = `${DAY_NAMES[schedule.openDay]} ${pad(schedule.openHour)}:${pad(schedule.openMinute)}`;
                        const closeLabel = `${DAY_NAMES[schedule.closeDay]} ${pad(schedule.closeHour)}:${pad(schedule.closeMinute)}`;
                        return (
                            <div className={`bg-white rounded-2xl border shadow-sm overflow-hidden p-6 transition-all hover:shadow-md ${schedule.enabled ? 'border-accent-300 ring-1 ring-accent-200' : 'border-surface-200'}`}>
                                <div className="flex items-center justify-between mb-4">
                                    <h2 className="text-lg font-bold text-surface-800 flex items-center gap-2">
                                        <Timer className="w-5 h-5 text-accent-500" />
                                        Hẹn giờ tự động
                                    </h2>
                                    <label className="relative inline-flex items-center cursor-pointer">
                                        <input type="checkbox" className="sr-only peer"
                                            checked={schedule.enabled}
                                            onChange={e => setSchedule(s => ({ ...s, enabled: e.target.checked }))}
                                        />
                                        <div className="w-11 h-6 bg-surface-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-accent-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-surface-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-accent-500"></div>
                                    </label>
                                </div>

                                <p className="text-sm text-surface-500 mb-5">
                                    Tự động mở/đóng đăng ký theo lịch hàng tuần.
                                    {!schedule.enabled && <span className="text-warning-600 font-semibold ml-1">Hiện đang tắt.</span>}
                                </p>

                                {schedule.enabled && (
                                    <>
                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-5">
                                            {/* Open Window */}
                                            <div className="bg-success-50 border border-success-200 rounded-xl p-4 space-y-3">
                                                <h3 className="text-sm font-bold text-success-800 flex items-center gap-1.5">
                                                    <span className="w-2 h-2 rounded-full bg-success-500"></span>
                                                    Mở Đăng ký
                                                </h3>
                                                <div className="space-y-1.5">
                                                    <label className="text-xs font-semibold text-surface-600">Ngày trong tuần</label>
                                                    <select value={schedule.openDay} onChange={e => setSchedule(s => ({ ...s, openDay: +e.target.value }))}
                                                        className="w-full bg-white border border-success-200 text-sm rounded-lg focus:ring-success-500 focus:border-success-500 p-2 font-medium">
                                                        {DAY_NAMES.map((d, i) => <option key={i} value={i}>{d}</option>)}
                                                    </select>
                                                </div>
                                                <div className="space-y-1.5">
                                                    <label className="text-xs font-semibold text-surface-600">Giờ mở</label>
                                                    <input type="time"
                                                        value={`${pad(schedule.openHour)}:${pad(schedule.openMinute)}`}
                                                        onChange={e => { const [h, m] = e.target.value.split(':').map(Number); setSchedule(s => ({ ...s, openHour: h, openMinute: m })); }}
                                                        className="w-full bg-white border border-success-200 text-sm rounded-lg focus:ring-success-500 focus:border-success-500 p-2 font-medium"
                                                    />
                                                </div>
                                            </div>

                                            {/* Close Window */}
                                            <div className="bg-danger-50 border border-danger-200 rounded-xl p-4 space-y-3">
                                                <h3 className="text-sm font-bold text-danger-800 flex items-center gap-1.5">
                                                    <span className="w-2 h-2 rounded-full bg-danger-500"></span>
                                                    Đóng Đăng ký
                                                </h3>
                                                <div className="space-y-1.5">
                                                    <label className="text-xs font-semibold text-surface-600">Ngày trong tuần</label>
                                                    <select value={schedule.closeDay} onChange={e => setSchedule(s => ({ ...s, closeDay: +e.target.value }))}
                                                        className="w-full bg-white border border-danger-200 text-sm rounded-lg focus:ring-danger-500 focus:border-danger-500 p-2 font-medium">
                                                        {DAY_NAMES.map((d, i) => <option key={i} value={i}>{d}</option>)}
                                                    </select>
                                                </div>
                                                <div className="space-y-1.5">
                                                    <label className="text-xs font-semibold text-surface-600">Giờ đóng</label>
                                                    <input type="time"
                                                        value={`${pad(schedule.closeHour)}:${pad(schedule.closeMinute)}`}
                                                        onChange={e => { const [h, m] = e.target.value.split(':').map(Number); setSchedule(s => ({ ...s, closeHour: h, closeMinute: m })); }}
                                                        className="w-full bg-white border border-danger-200 text-sm rounded-lg focus:ring-danger-500 focus:border-danger-500 p-2 font-medium"
                                                    />
                                                </div>
                                            </div>
                                        </div>

                                        {/* Preview */}
                                        <div className="bg-accent-50 border border-accent-100 rounded-xl p-3 text-xs text-accent-700 flex items-start gap-2">
                                            <Timer className="w-3.5 h-3.5 mt-0.5 shrink-0 text-accent-400" />
                                            <span>
                                                Hệ thống sẽ tự động <strong className="text-success-700">mở</strong> vào <strong>{openLabel}</strong> và <strong className="text-danger-600">đóng</strong> vào <strong>{closeLabel}</strong> hàng tuần (giờ Việt Nam).
                                            </span>
                                        </div>
                                    </>
                                )}
                            </div>
                        );
                    })()}

                    {/* Strict Shift Limit Card */}
                    <div className="bg-white rounded-2xl border border-surface-200 shadow-sm overflow-hidden p-6 transition-all hover:shadow-md">
                        <div className="flex items-center justify-between mb-4">
                            <h2 className="text-lg font-bold text-surface-800 flex items-center gap-2">
                                <ShieldAlert className="w-5 h-5 text-warning-500" />
                                Chặn đăng ký khi ca đã đầy
                            </h2>
                        </div>
                        <p className="text-sm text-surface-500 mb-6">
                            Nếu tắt, nhân viên vẫn có thể đăng ký nguyện vọng dù ca đã đạt số lượng tối đa.
                        </p>

                        <label className="relative inline-flex items-center cursor-pointer">
                            <input
                                type="checkbox"
                                className="sr-only peer"
                                checked={settings?.strictShiftLimit ?? true}
                                onChange={(e) => {
                                    setSettings(s => s ? { ...s, strictShiftLimit: e.target.checked } : null);
                                    setError(''); setSuccess('Cài đặt đã cập nhật cục bộ. Nhớ bấm Lưu.');
                                }}
                            />
                            <div className="w-14 h-7 bg-surface-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-warning-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-surface-300 after:border after:rounded-full after:h-6 after:w-6 after:transition-all peer-checked:bg-warning-500"></div>
                            <span className={`ml-3 text-sm font-bold ${(settings?.strictShiftLimit ?? true) ? 'text-warning-600' : 'text-surface-500'}`}>
                                {(settings?.strictShiftLimit ?? true) ? 'BẬT — Chặn đăng ký khi đầy' : 'TẮT — Cho phép đăng ký vượt định mức'}
                            </span>
                        </label>
                    </div>

                    {/* Max Shifts Per Day Card */}
                    <div className="bg-white rounded-2xl border border-surface-200 shadow-sm overflow-hidden p-6 transition-all hover:shadow-md">
                        <div className="flex items-center justify-between mb-4">
                            <h2 className="text-lg font-bold text-surface-800 flex items-center gap-2">
                                <Users className="w-5 h-5 text-primary-500" />
                                Số ca tối đa / ngày
                            </h2>
                        </div>
                        <p className="text-sm text-surface-500 mb-5">
                            Giới hạn số ca tối đa nhân viên có thể chọn trong <strong>một ngày</strong>.
                            Mặc định là <strong>1</strong> ca/ngày. Tăng lên để cho phép chọn nhiều ca trong ngày.
                        </p>
                        <div className="flex items-center gap-3">
                            <input
                                type="number" min="1" max="10"
                                value={settings?.maxShiftsPerDay ?? 1}
                                onChange={e => {
                                    const val = Math.max(1, parseInt(e.target.value) || 1);
                                    setSettings(s => s ? { ...s, maxShiftsPerDay: val } : null);
                                    setSuccess('Cài đặt đã cập nhật cục bộ. Nhớ bấm Lưu.');
                                }}
                                className="w-24 bg-surface-50 border border-surface-200 text-sm font-bold rounded-lg focus:ring-primary-500 focus:border-primary-500 block p-2.5 outline-none"
                            />
                            <span className="text-sm text-surface-600 font-medium">ca/ngày</span>
                            <span className={`text-xs px-2.5 py-1 rounded-full font-semibold border ${
                                (settings?.maxShiftsPerDay ?? 1) > 1
                                    ? 'bg-primary-50 text-primary-700 border-primary-200'
                                    : 'bg-surface-100 text-surface-500 border-surface-200'
                            }`}>
                                {(settings?.maxShiftsPerDay ?? 1) === 1 ? 'Mặc định — 1 ca/ngày' : `Tối đa ${settings?.maxShiftsPerDay} ca/ngày`}
                            </span>
                        </div>
                    </div>

                    {/* Shift Times Card */}
                    <div className="bg-white rounded-2xl border border-surface-200 shadow-sm overflow-hidden p-6 transition-all hover:shadow-md">
                        <div className="flex items-center justify-between mb-4">
                            <h2 className="text-lg font-bold text-surface-800 flex items-center gap-2">
                                <Clock className="w-5 h-5 text-accent-500" />
                                Khung giờ làm việc
                            </h2>
                        </div>

                        <div className="flex gap-2 mb-6">
                            <input
                                type="text" value={newShift} onChange={e => setNewShift(e.target.value)}
                                onKeyDown={e => e.key === 'Enter' && handleAddShift()}
                                placeholder="VD: 08:00-12:00"
                                className="flex-1 bg-surface-50 border border-surface-200 text-sm rounded-lg focus:ring-accent-500 focus:border-accent-500 block p-2.5 outline-none"
                            />
                            <button onClick={handleAddShift}
                                className="bg-accent-50 text-accent-600 hover:bg-accent-100 hover:text-accent-700 px-4 rounded-lg font-medium border border-accent-200 transition-colors flex items-center">
                                <Plus className="w-4 h-4" />
                            </button>
                        </div>

                        <div className="space-y-2">
                            {settings?.shiftTimes.length === 0 ? (
                                <p className="text-sm text-surface-400 text-center py-2 bg-surface-50 rounded-lg border border-dashed">Chưa có khung giờ nào</p>
                            ) : (
                                settings?.shiftTimes.map(shift => (
                                    <div key={shift} className="flex items-center justify-between p-3 bg-surface-50 border border-surface-100 rounded-xl group hover:border-accent-200 transition-colors">
                                        <span className="text-sm font-semibold text-surface-700 group-hover:text-accent-700 flex items-center gap-2">
                                            <Clock className="w-4 h-4 text-surface-400 group-hover:text-accent-400" />
                                            {shift}
                                        </span>
                                        <button onClick={() => handleRemoveShift(shift)} className="text-surface-400 hover:text-danger-500 hover:bg-danger-50 p-1.5 rounded-lg transition-colors">
                                            <X className="w-4 h-4" />
                                        </button>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>

                    {/* Quota Settings Card */}
                    <div className="bg-white rounded-2xl border border-surface-200 shadow-sm overflow-hidden p-6 transition-all hover:shadow-md">
                        <div className="flex items-center justify-between mb-4">
                            <h2 className="text-lg font-bold text-surface-800 flex items-center gap-2">
                                <Users className="w-5 h-5 text-fuchsia-500" />
                                Định mức nhân viên (Số người tối đa)
                            </h2>
                        </div>

                        <div className="space-y-4 mb-6">
                            {settings?.shiftTimes.length === 0 ? (
                                <p className="text-sm text-surface-400 text-center py-2 bg-surface-50 rounded-lg">Chưa có khung giờ nào để thiết lập định mức.</p>
                            ) : (
                                settings?.shiftTimes.map(shift => (
                                    <div key={shift} className="grid grid-cols-2 gap-4 items-center bg-surface-50 p-3 rounded-xl border border-surface-100">
                                        <div className="col-span-2 text-sm font-bold text-surface-700 pb-2 border-b border-surface-200">
                                            Ca làm: {shift}
                                        </div>
                                        <div className="space-y-1.5">
                                            <label className="text-xs font-semibold text-surface-500 uppercase tracking-wider">Định mức ngày thường</label>
                                            <input type="number" min="1"
                                                value={settings?.quotas?.defaultWeekday?.[shift] || ''}
                                                onChange={e => settings && setSettings({
                                                    ...settings,
                                                    quotas: { ...settings.quotas!, defaultWeekday: { ...settings.quotas!.defaultWeekday, [shift]: parseInt(e.target.value) || 1 } }
                                                })}
                                                className="w-full bg-white border border-surface-200 text-sm font-bold rounded-lg focus:ring-fuchsia-500 focus:border-fuchsia-500 block p-2" placeholder="e.g. 5"
                                            />
                                        </div>
                                        <div className="space-y-1.5">
                                            <label className="text-xs font-semibold text-surface-500 uppercase tracking-wider">Định mức cuối tuần</label>
                                            <input type="number" min="1"
                                                value={settings?.quotas?.defaultWeekend?.[shift] || ''}
                                                onChange={e => settings && setSettings({
                                                    ...settings,
                                                    quotas: { ...settings.quotas!, defaultWeekend: { ...settings.quotas!.defaultWeekend, [shift]: parseInt(e.target.value) || 1 } }
                                                })}
                                                className="w-full bg-white border border-surface-200 text-sm font-bold rounded-lg focus:ring-fuchsia-500 focus:border-fuchsia-500 block p-2" placeholder="e.g. 8"
                                            />
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>

                        {/* Monthly Quotas */}
                        <div className="border-t border-surface-100 pt-6 mt-6">
                            <h3 className="text-sm font-bold text-surface-700 mb-3 flex items-center gap-2">
                                <AlertCircle className="w-4 h-4 text-accent-500" />
                                Định mức ca làm / Tháng
                            </h3>
                            <div className="bg-accent-50/50 p-4 rounded-xl border border-accent-100 space-y-4">
                                <div className="space-y-1.5 pb-3 border-b border-accent-200/50">
                                    <label className="text-xs font-semibold text-surface-600 block">
                                        Toàn thời gian (FT) & Quản lý: <span className="text-accent-600">Số ngày nghỉ / tháng</span>
                                    </label>
                                    <input type="number" min="0" max="31"
                                        value={settings?.monthlyQuotas?.ftDaysOff ?? ''}
                                        onChange={e => settings && setSettings({ ...settings, monthlyQuotas: { ...settings.monthlyQuotas!, ftDaysOff: parseInt(e.target.value) || 0 } })}
                                        className="w-full sm:w-1/2 bg-white border border-surface-200 text-sm font-bold rounded-lg focus:ring-accent-500 focus:border-accent-500 block p-2" placeholder="VD: 4"
                                    />
                                    <p className="text-[10px] text-accent-600/80 mt-1">Hệ thống sẽ tự tính: [Số ngày trong tháng] - [Số ngày nghỉ] = Tổng số ca tối đa.</p>
                                </div>

                                <div>
                                    <label className="text-xs font-semibold text-surface-600 block mb-2">
                                        Bán thời gian (PT): <span className="text-accent-600">Số ca tối thiểu & tối đa / tháng</span>
                                    </label>
                                    <div className="grid grid-cols-2 gap-4">
                                        <div className="space-y-1.5">
                                            <label className="text-[10px] font-semibold text-surface-500 uppercase">Tối thiểu</label>
                                            <input type="number" min="0"
                                                value={settings?.monthlyQuotas?.ptMinShifts ?? ''}
                                                onChange={e => settings && setSettings({ ...settings, monthlyQuotas: { ...settings.monthlyQuotas!, ptMinShifts: parseInt(e.target.value) || 0 } })}
                                                className="w-full bg-white border border-surface-200 text-sm font-bold rounded-lg focus:ring-accent-500 focus:border-accent-500 block p-2" placeholder="VD: 10"
                                            />
                                        </div>
                                        <div className="space-y-1.5">
                                            <label className="text-[10px] font-semibold text-surface-500 uppercase">Tối đa</label>
                                            <input type="number" min="1"
                                                value={settings?.monthlyQuotas?.ptMaxShifts ?? ''}
                                                onChange={e => settings && setSettings({ ...settings, monthlyQuotas: { ...settings.monthlyQuotas!, ptMaxShifts: parseInt(e.target.value) || 0 } })}
                                                className="w-full bg-white border border-surface-200 text-sm font-bold rounded-lg focus:ring-accent-500 focus:border-accent-500 block p-2" placeholder="VD: 25"
                                            />
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Special Dates */}
                        <div className="border-t border-surface-100 pt-6 mt-6">
                            <h3 className="text-sm font-bold text-surface-700 mb-3">Ngày đặc biệt & Ngày lễ</h3>
                            <div className="bg-fuchsia-50/50 p-4 rounded-xl border border-fuchsia-100 mb-4 space-y-4">
                                <div>
                                    <label className="text-xs font-semibold text-surface-600 block mb-1">Chọn ngày</label>
                                    <input type="date" value={newSpecialDate} onChange={e => setNewSpecialDate(e.target.value)}
                                        className="w-full bg-white border border-surface-200 text-sm rounded-lg focus:ring-fuchsia-500 focus:border-fuchsia-500 block p-2 outline-none" />
                                </div>

                                {newSpecialDate && settings && settings.shiftTimes.length > 0 && (
                                    <div className="space-y-3">
                                        <label className="text-xs font-semibold text-surface-600 block">Thiết lập giới hạn cho ngày này</label>
                                        <div className="grid grid-cols-2 lg:grid-cols-3 gap-2">
                                            {settings.shiftTimes.map(shift => (
                                                <div key={shift} className="space-y-1">
                                                    <label className="text-[10px] font-bold text-surface-500">{shift}</label>
                                                    <input type="number" min="1"
                                                        value={newSpecialDateQuotas[shift] || ''}
                                                        onChange={e => setNewSpecialDateQuotas({ ...newSpecialDateQuotas, [shift]: parseInt(e.target.value) || 1 })}
                                                        placeholder={String(settings.quotas?.defaultWeekend?.[shift] || 5)}
                                                        className="w-full bg-white border border-surface-200 text-xs rounded-lg focus:ring-fuchsia-500 focus:border-fuchsia-500 block p-2"
                                                    />
                                                </div>
                                            ))}
                                        </div>
                                        <button onClick={handleAddSpecialDate}
                                            className="w-full mt-2 bg-fuchsia-100 hover:bg-fuchsia-200 text-fuchsia-700 py-2 rounded-lg font-bold text-sm transition-colors border border-fuchsia-200">
                                            Thêm định mức ngày đặc biệt
                                        </button>
                                    </div>
                                )}
                            </div>

                            <div className="space-y-3">
                                {!settings?.quotas?.specialDates || Object.keys(settings.quotas.specialDates).length === 0 ? (
                                    <p className="text-sm text-surface-400 text-center py-2 bg-surface-50 rounded-lg border border-dashed">Chưa có ngày đặc biệt nào</p>
                                ) : (
                                    Object.entries(settings.quotas.specialDates).sort((a, b) => a[0].localeCompare(b[0])).map(([dateCode, shiftQuotas]) => (
                                        <div key={dateCode} className="p-3 bg-white border border-surface-200 shadow-sm rounded-xl group relative">
                                            <div className="flex items-center justify-between mb-2 pb-2 border-b border-surface-100">
                                                <span className="text-sm font-bold text-surface-800">{new Date(dateCode).toLocaleDateString('vi-VN')}</span>
                                                <button onClick={() => handleRemoveSpecialDate(dateCode)}
                                                    className="text-surface-400 hover:text-danger-500 hover:bg-danger-50 p-1 rounded transition-colors absolute top-2 right-2">
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
                <div className="bg-white rounded-2xl border border-surface-200 shadow-sm overflow-hidden p-6 transition-all hover:shadow-md h-fit">
                    <div className="flex items-center justify-between mb-4">
                        <h2 className="text-lg font-bold text-surface-800 flex items-center gap-2">
                            <Store className="w-5 h-5 text-warning-500" />
                            Quầy làm việc
                        </h2>
                    </div>
                    <p className="text-sm text-surface-500 mb-6">
                        Các quầy này dùng để kéo thả phân công trong giao diện quản lý.
                    </p>

                    <div className="flex gap-2 mb-6">
                        <input type="text" value={newCounter} onChange={e => setNewCounter(e.target.value)}
                            onKeyDown={e => e.key === 'Enter' && handleAddCounter()}
                            placeholder="VD: Quầy 1, Register A"
                            className="flex-1 bg-surface-50 border border-surface-200 text-sm rounded-lg focus:ring-warning-500 focus:border-warning-500 block p-2.5 outline-none" />
                        <button onClick={handleAddCounter}
                            className="bg-warning-50 text-warning-600 hover:bg-warning-100 hover:text-warning-700 px-4 rounded-lg font-medium border border-warning-200 transition-colors flex items-center">
                            <Plus className="w-4 h-4" />
                        </button>
                    </div>

                    <div className="space-y-2 overflow-y-auto pr-2">
                        {counters.length === 0 ? (
                            <p className="text-sm text-surface-400 text-center py-4 bg-surface-50 rounded-lg border border-dashed">Chưa có quầy nào</p>
                        ) : (
                            counters.map(counter => (
                                <div key={counter.id} className={`flex items-center justify-between p-3 border rounded-xl group transition-colors ${counter.isActive !== false
                                    ? 'bg-surface-50 border-surface-100 hover:border-warning-200'
                                    : 'bg-surface-100/50 border-surface-200 opacity-60'
                                    }`}>
                                    <div className="flex items-center gap-3 flex-1 min-w-0">
                                        {/* Active toggle */}
                                        <button
                                            type="button"
                                            onClick={() => handleToggleCounter(counter.id)}
                                            className={`relative w-9 h-5 flex rounded-full transition-colors shrink-0 ${counter.isActive !== false ? 'bg-success-500' : 'bg-surface-300'
                                                }`}
                                            title={counter.isActive !== false ? 'Bật' : 'Tắt'}
                                        >
                                            <span className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${counter.isActive !== false ? 'translate-x-4' : 'translate-x-0.5'
                                                }`} />
                                        </button>
                                        {/* Counter name — editable */}
                                        <input
                                            type="text"
                                            value={counter.name}
                                            onChange={e => handleRenameCounter(counter.id, e.target.value)}
                                            className="text-sm font-semibold text-surface-700 bg-transparent border-none outline-none focus:bg-white focus:ring-1 focus:ring-warning-300 rounded px-1.5 py-0.5 w-full min-w-0"
                                        />
                                        {/* Inventory badge */}
                                        {counter.isActive !== false && (
                                            <span className="inline-flex items-center gap-1 text-[10px] font-bold text-success-600 bg-success-50 border border-success-200 px-1.5 py-0.5 rounded shrink-0">
                                                <Package className="w-3 h-3" />
                                                Kho
                                            </span>
                                        )}
                                    </div>
                                    <button onClick={() => handleRemoveCounter(counter.id)}
                                        className="text-surface-400 hover:text-danger-500 hover:bg-danger-50 p-1.5 rounded-lg transition-colors ml-2 shrink-0">
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
