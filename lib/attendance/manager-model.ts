export interface ManagerPunchLike {
    occurredAt: string;
    eventType: 'CHECK_IN' | 'CHECK_OUT' | 'PUNCH';
    status: 'ACCEPTED' | 'REJECTED';
    source?: 'SOFTWARE' | 'MACHINE';
}

/** Exclusive deadline: 06:00 the following day, always in Vietnam time. */
export function attendanceCheckoutDeadline(attendanceDate: string): number {
    return Date.parse(`${attendanceDate}T06:00:00+07:00`) + 86_400_000;
}

export function isWithinAttendanceCheckoutWindow(attendanceDate: string, occurredAt: string): boolean {
    const timestamp = Date.parse(occurredAt);
    return timestamp >= Date.parse(`${attendanceDate}T00:00:00+07:00`)
        && timestamp < attendanceCheckoutDeadline(attendanceDate);
}

export function previousAttendanceDateBeforeDeadline(nominalDate: string, now: Date): string | null {
    const previousDate = new Date(Date.parse(`${nominalDate}T00:00:00Z`) - 86_400_000)
        .toISOString().slice(0, 10);
    return isWithinAttendanceCheckoutWindow(previousDate, now.toISOString()) ? previousDate : null;
}

export function parseAttendanceRange(date: string | null, month: string | null) {
    if (date && /^\d{4}-\d{2}-\d{2}$/.test(date)) {
        const parsed = new Date(`${date}T00:00:00Z`);
        if (!Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === date) {
            return { startDate: date, endDate: date };
        }
    }
    if (month && /^\d{4}-\d{2}$/.test(month)) {
        const [year, monthNumber] = month.split('-').map(Number);
        if (monthNumber >= 1 && monthNumber <= 12) {
            const lastDay = new Date(Date.UTC(year, monthNumber, 0)).getUTCDate();
            return {
                startDate: `${month}-01`,
                endDate: `${month}-${String(lastDay).padStart(2, '0')}`,
            };
        }
    }
    return null;
}

/** Schedule roster wins; employees with punches are always retained for reconciliation. */
export function selectAttendanceRosterUids(
    allStoreUids: Iterable<string>,
    scheduledUids: Iterable<string>,
    punchedUids: Iterable<string>,
): Set<string> {
    const scheduled = new Set(scheduledUids);
    const punched = new Set(punchedUids);
    return scheduled.size > 0
        ? new Set([...scheduled, ...punched])
        : new Set([...allStoreUids, ...punched]);
}

/** Explicit software event types win; raw machine punches fall back to FILO. */
export function resolveAcceptedAttendanceTimes(punches: ManagerPunchLike[], attendanceDate?: string) {
    const accepted = punches
        .filter((event) => event.status === 'ACCEPTED')
        .filter((event) => !attendanceDate || event.source !== 'SOFTWARE' || event.eventType !== 'CHECK_OUT'
            || isWithinAttendanceCheckoutWindow(attendanceDate, event.occurredAt))
        .sort((a, b) => a.occurredAt.localeCompare(b.occurredAt));
    const explicitCheckIn = accepted.find((event) => event.eventType === 'CHECK_IN');
    const explicitCheckOut = [...accepted].reverse().find((event) => event.eventType === 'CHECK_OUT');
    return {
        checkIn: explicitCheckIn?.occurredAt ?? accepted[0]?.occurredAt ?? null,
        checkOut: explicitCheckOut?.occurredAt
            ?? (!explicitCheckIn && accepted.length > 1 ? accepted[accepted.length - 1].occurredAt : null),
        acceptedCount: accepted.length,
    };
}
