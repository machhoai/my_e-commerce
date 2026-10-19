import type { AttendanceDailyState, AttendanceEventType } from '@/types';

export const MINIMUM_ATTENDANCE_SESSION_MS = 60_000;

export function attendanceCheckoutAvailableAt(checkInOccurredAt: string | undefined): string | null {
    const checkInTime = checkInOccurredAt ? Date.parse(checkInOccurredAt) : NaN;
    return Number.isFinite(checkInTime)
        ? new Date(checkInTime + MINIMUM_ATTENDANCE_SESSION_MS).toISOString()
        : null;
}

export function getNextAttendanceEventType(
    state: AttendanceDailyState | null,
    requireCheckOut: boolean,
): AttendanceEventType | null {
    if (!state?.checkInEventId) return 'CHECK_IN';
    if (requireCheckOut && !state.checkOutEventId) return 'CHECK_OUT';
    return null;
}

export function isAttendanceEventExpected(
    requestedEventType: AttendanceEventType,
    state: AttendanceDailyState | null,
    requireCheckOut: boolean,
): boolean {
    return getNextAttendanceEventType(state, requireCheckOut) === requestedEventType;
}

export function vietnamAttendanceDate(date = new Date()): string {
    const parts = new Intl.DateTimeFormat('en-CA', {
        timeZone: 'Asia/Ho_Chi_Minh',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
    }).formatToParts(date);
    const value = (type: Intl.DateTimeFormatPartTypes) =>
        parts.find((part) => part.type === type)?.value ?? '';
    return `${value('year')}-${value('month')}-${value('day')}`;
}
