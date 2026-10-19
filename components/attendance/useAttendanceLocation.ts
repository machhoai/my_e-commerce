'use client';

import { useEffect, useState } from 'react';
import { evaluateGpsVerification, type AttendanceLocationCapture, type AttendanceGpsTarget } from '@/lib/attendance/gps';

const messages = {
    LOCATION_REQUIRED: 'Chưa có vị trí GPS. Hãy bật định vị và cho phép truy cập vị trí.',
    GPS_ACCURACY_LOW: 'GPS chưa đủ chính xác. Hãy di chuyển ra nơi thoáng và thử lại.',
    GPS_STALE: 'Vị trí GPS đã quá cũ. Đang chờ vị trí mới.',
    OUTSIDE_GEOFENCE: 'Bạn đang ở ngoài bán kính chấm công của cửa hàng.',
    IP_REQUIRED: '',
    INVALID_IP: '',
};

export function useAttendanceLocation(target: AttendanceGpsTarget | null | undefined, enabled: boolean) {
    const [capture, setCapture] = useState<{ location: AttendanceLocationCapture; receivedAt: number } | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [revision, setRevision] = useState(0);
    const [now, setNow] = useState(0);
    const targetKey = target ? JSON.stringify(target) : '';

    useEffect(() => {
        if (!enabled) return;
        let active = true;
        if (!navigator.geolocation) return;
        const watch = navigator.geolocation.watchPosition((position) => {
            if (!active) return;
            const receivedAt = performance.now();
            setCapture({
                location: {
                    latitude: position.coords.latitude,
                    longitude: position.coords.longitude,
                    accuracyM: position.coords.accuracy,
                    capturedAt: new Date(position.timestamp).toISOString(),
                },
                receivedAt,
            });
            setNow(receivedAt);
            setError(null);
        }, (failure) => {
            if (!active) return;
            setCapture(null);
            setError(failure.code === failure.PERMISSION_DENIED
                ? 'Bạn chưa cho phép truy cập vị trí. Hãy bật quyền định vị trong trình duyệt.'
                : 'Không lấy được GPS. Hãy bật định vị, kiểm tra tín hiệu và thử lại.');
        }, { enableHighAccuracy: true, maximumAge: 0, timeout: 15_000 });
        const timer = window.setInterval(() => setNow(performance.now()), 1000);
        return () => {
            active = false;
            navigator.geolocation.clearWatch(watch);
            window.clearInterval(timer);
        };
    }, [enabled, targetKey, revision]);

    const location = capture?.location;
    const decision = target ? evaluateGpsVerification(location, target) : null;
    // The timestamp already contains elapsed wall time; use monotonic age only as an extra guard.
    const stale = Boolean(capture && target && now - capture.receivedAt > target.maxAgeSeconds * 1000);
    const accepted = Boolean(enabled && !error && decision?.accepted && !stale);
    const message = !enabled ? null : (typeof navigator === 'undefined' || !navigator.geolocation)
        ? 'Thiết bị hoặc trình duyệt không hỗ trợ định vị GPS.'
        : error || (stale ? messages.GPS_STALE : decision?.reason ? messages[decision.reason] : null);

    return {
        accepted,
        message,
        distanceM: decision?.distanceM ?? null,
        retry: () => { setCapture(null); setError(null); setRevision((value) => value + 1); },
    };
}
