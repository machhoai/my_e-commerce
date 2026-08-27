export const LEGACY_ATTENDANCE_DEVICE_ID = 'legacy-device';

function encodeKeyPart(value: string): string {
    return encodeURIComponent(value.trim());
}

export function attendanceMappingId(deviceId: string, zkUserId: string): string {
    return `${encodeKeyPart(deviceId)}__${encodeKeyPart(zkUserId)}`;
}

export function normalizeDeviceTimestamp(value: string): {
    occurredAt: string;
    attendanceDate: string;
} | null {
    const trimmed = value.trim();
    const localMatch = trimmed.match(/^(\d{4}-\d{2}-\d{2})[ T](\d{2}:\d{2}:\d{2})(?:\.\d+)?$/);
    const candidate = localMatch ? `${localMatch[1]}T${localMatch[2]}+07:00` : trimmed;
    const parsed = new Date(candidate);
    if (Number.isNaN(parsed.getTime())) return null;

    const attendanceDate = localMatch
        ? localMatch[1]
        : new Intl.DateTimeFormat('en-CA', {
            timeZone: 'Asia/Ho_Chi_Minh',
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
        }).format(parsed);
    return { occurredAt: parsed.toISOString(), attendanceDate };
}

export function attendanceDeviceIdempotencyKey(
    deviceId: string,
    zkUserId: string,
    occurredAt: string,
): string {
    return `${deviceId}|${zkUserId}|${occurredAt}`;
}

export function attendanceDeviceEventId(
    deviceId: string,
    zkUserId: string,
    occurredAt: string,
): string {
    return [deviceId, zkUserId, occurredAt].map(encodeKeyPart).join('__');
}

export const attendanceDeviceLogId = attendanceDeviceEventId;
