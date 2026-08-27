import type { AttendanceDailyState, AttendanceEventType } from '@/types';

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
