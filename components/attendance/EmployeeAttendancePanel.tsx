'use client';

import { useCallback, useEffect, useState } from 'react';
import {
    AlertTriangle,
    Building2,
    CheckCircle2,
    Clock3,
    Loader2,
    LogIn,
    LogOut,
    MapPin,
    RefreshCw,
    ShieldCheck,
    Wifi,
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { cn } from '@/lib/utils';
import type {
    AttendanceEvent,
    AttendanceEventType,
    SoftwareAttendanceContext,
} from '@/types';

function formatAttendanceTime(value: string): string {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '--:--';
    return date.toLocaleTimeString('vi-VN', {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        timeZone: 'Asia/Ho_Chi_Minh',
    });
}

function eventLabel(eventType: AttendanceEventType): string {
    return eventType === 'CHECK_IN' ? 'Chấm công vào' : 'Chấm công ra';
}

function captureCurrentLocation(): Promise<{
    latitude: number;
    longitude: number;
    accuracyM: number;
    capturedAt: string;
}> {
    if (!navigator.geolocation) {
        return Promise.reject(new Error('Thiết bị hoặc trình duyệt không hỗ trợ định vị GPS.'));
    }

    return new Promise((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(
            (position) => resolve({
                latitude: position.coords.latitude,
                longitude: position.coords.longitude,
                accuracyM: position.coords.accuracy,
                capturedAt: new Date(position.timestamp).toISOString(),
            }),
            (locationError) => {
                const message = locationError.code === locationError.PERMISSION_DENIED
                    ? 'Bạn cần cho phép truy cập vị trí để chấm công.'
                    : 'Không lấy được vị trí chính xác. Hãy bật GPS và thử lại.';
                reject(new Error(message));
            },
            { enableHighAccuracy: true, timeout: 15_000, maximumAge: 0 },
        );
    });
}

function AttendanceEventCard({ event }: { event: AttendanceEvent }) {
    const isCheckIn = event.eventType === 'CHECK_IN';
    return (
        <div className="flex items-center gap-3 rounded-2xl border border-surface-200 bg-white p-3">
            <div className={cn(
                'flex size-10 shrink-0 items-center justify-center rounded-xl',
                isCheckIn ? 'bg-success-50 text-success-600' : 'bg-primary-50 text-primary-600',
            )}>
                {isCheckIn ? <LogIn className="size-5" /> : <LogOut className="size-5" />}
            </div>
            <div className="min-w-0 flex-1">
                <p className="text-xs font-semibold text-surface-500">{eventLabel(event.eventType)}</p>
                <p className="text-lg font-bold tabular-nums text-surface-900">
                    {formatAttendanceTime(event.occurredAt)}
                </p>
            </div>
            <span className="rounded-full bg-surface-100 px-2.5 py-1 text-[10px] font-semibold text-surface-600">
                {event.method === 'GPS' ? 'GPS' : 'IP'}
            </span>
        </div>
    );
}

export default function EmployeeAttendancePanel() {
    const { user, loading: authLoading, hasPermission, getToken } = useAuth();
    const canUseAttendance = hasPermission('action.attendance.punch')
        || hasPermission('page.hr.attendance');
    const [context, setContext] = useState<SoftwareAttendanceContext | null>(null);
    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState<string | null>(null);

    const loadContext = useCallback(async (signal?: AbortSignal) => {
        if (!user || !canUseAttendance) {
            setLoading(false);
            return;
        }
        setLoading(true);
        try {
            const token = await getToken();
            const response = await fetch('/api/hr/attendance/context', {
                headers: { Authorization: `Bearer ${token}` },
                cache: 'no-store',
                signal,
            });
            const data = await response.json().catch(() => null);
            if (!response.ok) throw new Error(data?.error || 'Không thể tải trạng thái chấm công.');
            if (signal?.aborted) return;
            setContext(data as SoftwareAttendanceContext);
            setError(null);
        } catch (loadError) {
            if (loadError instanceof Error && loadError.name === 'AbortError') return;
            setContext(null);
            setError(loadError instanceof Error ? loadError.message : 'Không thể tải trạng thái chấm công.');
        } finally {
            if (!signal?.aborted) setLoading(false);
        }
    }, [canUseAttendance, getToken, user]);

    useEffect(() => {
        const controller = new AbortController();
        void loadContext(controller.signal);
        return () => controller.abort();
    }, [loadContext]);

    const handlePunch = async () => {
        if (!context?.canPunch || !context.nextEventType || submitting) return;
        setSubmitting(true);
        setError(null);
        setSuccess(null);

        try {
            if (!navigator.onLine) {
                throw new Error('Thiết bị đang ngoại tuyến. Vui lòng kết nối mạng rồi thử lại.');
            }
            const location = context.locationRequired
                ? await captureCurrentLocation()
                : undefined;
            const token = await getToken();
            const response = await fetch('/api/hr/attendance/punch', {
                method: 'POST',
                headers: {
                    Authorization: `Bearer ${token}`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    eventType: context.nextEventType,
                    idempotencyKey: crypto.randomUUID(),
                    location,
                }),
            });
            const data = await response.json().catch(() => null);
            if (!response.ok) throw new Error(data?.error || 'Không thể thực hiện chấm công.');

            const event = data?.event as AttendanceEvent | undefined;
            setSuccess(
                event
                    ? `${eventLabel(event.eventType)} thành công lúc ${formatAttendanceTime(event.occurredAt)}.`
                    : 'Chấm công thành công.',
            );
            await loadContext();
        } catch (punchError) {
            setError(punchError instanceof Error ? punchError.message : 'Không thể thực hiện chấm công.');
        } finally {
            setSubmitting(false);
        }
    };

    if (authLoading || loading) {
        return (
            <div className="flex min-h-80 items-center justify-center rounded-3xl border border-surface-200 bg-white">
                <div className="flex flex-col items-center gap-3 text-surface-500">
                    <Loader2 className="size-7 animate-spin text-primary-500" />
                    <span className="text-sm">Đang tải trạng thái chấm công...</span>
                </div>
            </div>
        );
    }

    if (!canUseAttendance) {
        return (
            <div className="rounded-3xl border border-warning-200 bg-warning-50 p-6 text-center">
                <AlertTriangle className="mx-auto mb-3 size-8 text-warning-600" />
                <h2 className="font-bold text-warning-900">Chưa được cấp quyền chấm công</h2>
                <p className="mt-1 text-sm text-warning-700">Vui lòng liên hệ quản lý để được cấp quyền.</p>
            </div>
        );
    }

    const method = context?.policy?.verificationMethod;
    const nextEventType = context?.nextEventType;
    const completed = context?.reason === 'COMPLETED';

    return (
        <div className="space-y-4">
            <section className="overflow-hidden rounded-3xl border border-surface-200 bg-white shadow-sm">
                <div className="bg-gradient-to-br from-primary-600 via-primary-500 to-accent-500 p-5 text-white sm:p-6">
                    <div className="flex items-start justify-between gap-4">
                        <div className="min-w-0">
                            <p className="text-xs font-semibold uppercase tracking-wider text-white/70">Chấm công hôm nay</p>
                            <h2 className="mt-1 truncate text-xl font-bold">{context?.store?.name || 'Chưa xác định cửa hàng'}</h2>
                            <div className="mt-2 flex items-center gap-1.5 text-xs text-white/80">
                                <Building2 className="size-3.5" />
                                <span>{context?.attendanceDate || '--'}</span>
                            </div>
                        </div>
                        <button
                            type="button"
                            onClick={() => void loadContext()}
                            disabled={submitting}
                            aria-label="Làm mới trạng thái chấm công"
                            className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-white/15 transition hover:bg-white/25 disabled:opacity-50"
                        >
                            <RefreshCw className="size-4" />
                        </button>
                    </div>
                </div>

                <div className="space-y-4 p-4 sm:p-6">
                    <div className={cn(
                        'flex items-start gap-3 rounded-2xl border p-3.5',
                        context?.canPunch
                            ? 'border-success-200 bg-success-50'
                            : completed
                                ? 'border-primary-200 bg-primary-50'
                                : 'border-warning-200 bg-warning-50',
                    )}>
                        {context?.canPunch || completed
                            ? <CheckCircle2 className={cn('mt-0.5 size-5 shrink-0', context?.canPunch ? 'text-success-600' : 'text-primary-600')} />
                            : <AlertTriangle className="mt-0.5 size-5 shrink-0 text-warning-600" />}
                        <div>
                            <p className="text-sm font-semibold text-surface-900">{context?.message}</p>
                            {method ? (
                                <p className="mt-0.5 text-xs text-surface-600">
                                    Xác minh bằng {method === 'GPS' ? 'vị trí GPS' : 'mạng Internet cửa hàng'}.
                                </p>
                            ) : null}
                        </div>
                    </div>

                    {method ? (
                        <div className="grid gap-2 sm:grid-cols-2">
                            <div className="flex items-center gap-3 rounded-2xl bg-surface-50 p-3">
                                {method === 'GPS'
                                    ? <MapPin className="size-5 text-primary-500" />
                                    : <Wifi className="size-5 text-primary-500" />}
                                <div className="min-w-0">
                                    <p className="text-[10px] font-semibold uppercase text-surface-400">Phương thức</p>
                                    <p className="truncate text-sm font-semibold text-surface-800">{method}</p>
                                </div>
                            </div>
                            <div className="flex items-center gap-3 rounded-2xl bg-surface-50 p-3">
                                <ShieldCheck className="size-5 text-success-500" />
                                <div className="min-w-0">
                                    <p className="text-[10px] font-semibold uppercase text-surface-400">
                                        {method === 'IP' ? 'IP hiện tại' : 'Bán kính cho phép'}
                                    </p>
                                    <p className="truncate text-sm font-semibold text-surface-800">
                                        {method === 'IP'
                                            ? context?.currentIpAddress || 'Không xác định'
                                            : `${context?.policy?.gps?.radiusM ?? 0} m`}
                                    </p>
                                </div>
                            </div>
                        </div>
                    ) : null}

                    <button
                        type="button"
                        onClick={() => void handlePunch()}
                        disabled={!context?.canPunch || !nextEventType || submitting}
                        aria-label={nextEventType ? eventLabel(nextEventType) : 'Đã hoàn tất chấm công'}
                        className={cn(
                            'flex min-h-14 w-full items-center justify-center gap-2 rounded-2xl px-5 text-sm font-bold text-white shadow-sm transition active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-60',
                            nextEventType === 'CHECK_OUT'
                                ? 'bg-primary-600 hover:bg-primary-700'
                                : 'bg-success-600 hover:bg-success-700',
                        )}
                    >
                        {submitting ? (
                            <Loader2 className="size-5 animate-spin" />
                        ) : nextEventType === 'CHECK_OUT' ? (
                            <LogOut className="size-5" />
                        ) : (
                            <LogIn className="size-5" />
                        )}
                        <span>
                            {submitting
                                ? 'Đang xác minh...'
                                : nextEventType
                                    ? eventLabel(nextEventType)
                                    : 'Đã hoàn tất hôm nay'}
                        </span>
                    </button>

                    <div aria-live="polite">
                        {error ? (
                            <p className="rounded-xl bg-danger-50 px-3 py-2 text-sm text-danger-700">{error}</p>
                        ) : null}
                        {success ? (
                            <p className="rounded-xl bg-success-50 px-3 py-2 text-sm text-success-700">{success}</p>
                        ) : null}
                    </div>
                </div>
            </section>

            <section className="rounded-3xl border border-surface-200 bg-surface-50 p-4 sm:p-5">
                <div className="mb-3 flex items-center gap-2">
                    <Clock3 className="size-4 text-surface-500" />
                    <h3 className="text-sm font-bold text-surface-800">Lịch sử hôm nay</h3>
                </div>
                {context?.todayEvents.length ? (
                    <div className="grid gap-2 sm:grid-cols-2">
                        {context.todayEvents.map((event) => <AttendanceEventCard key={event.id} event={event} />)}
                    </div>
                ) : (
                    <div className="rounded-2xl border border-dashed border-surface-300 bg-white py-8 text-center text-sm text-surface-500">
                        Chưa có lần chấm công nào hôm nay.
                    </div>
                )}
            </section>
        </div>
    );
}
