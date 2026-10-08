/**
 * lib/attendance-rules.ts
 *
 * Pure utility — no React, no Firebase, no side-effects.
 *
 * Schema: attendanceRules.byShift is keyed by shift name (from shiftTimes).
 * Each shift has its own defaultWeekday / defaultWeekend / specialDates rules.
 *
 * Shift auto-detection: given a punch-in timestamp, the shift whose startTime
 * (on that date) is closest to the actual punch time is selected.
 */

import type { AttendanceRule, AttendanceRuleSet, DailyAttendance } from '@/types';

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export type PunchStatus = 'EARLY' | 'ON_TIME' | 'LATE' | 'UNKNOWN';
export type PunchOutStatus = 'EARLY_OUT' | 'ON_TIME_OUT' | 'OVERTIME' | 'UNKNOWN';

export interface AttendanceStatusResult {
    // ─ punch-in classification ─────────────────────────────────────────────
    status: PunchStatus;
    /** ISO timestamp capped to startTime when employee arrived early */
    effectiveCheckIn: string;
    /** Decimal hours (e.g. 8.5) calculated from effectiveCheckIn → checkOut. null if checkOut missing */
    workHours: number | null;
    rule: AttendanceRule;
    /** Which shift was auto-detected for this punch (null = no rules configured) */
    detectedShift: string | null;
    // ─ punch-out classification ─────────────────────────────────────────────
    /** EARLY_OUT = left before endTime-grace, OVERTIME = stayed beyond endTime+grace, UNKNOWN = no checkOut */
    checkOutStatus: PunchOutStatus;
}

export type RuleContainer = {
    attendanceRules?: { byShift: Record<string, AttendanceRuleSet> } | null;
};

// ─────────────────────────────────────────────────────────────────────────────
// Defaults
// ─────────────────────────────────────────────────────────────────────────────

export const DEFAULT_RULE: AttendanceRule = {
    startTime: '08:00',
    endTime: '17:00',
    allowedEarlyMins: 0,
    allowedLateMins: 15,
};

export const BLANK_RULE_SET: AttendanceRuleSet = {
    defaultWeekday: { ...DEFAULT_RULE },
    defaultWeekend: { ...DEFAULT_RULE },
    specialDates: {},
};

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

/** Parse "HH:mm" and apply to a YYYY-MM-DD date string → Date in local time */
function timeOnDate(dateStr: string, timeStr: string): Date {
    return new Date(`${dateStr}T${timeStr}:00`);
}

// ─────────────────────────────────────────────────────────────────────────────
// Shift detection
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Given a punch-in ISO timestamp, find the shift name whose configured
 * startTime is chronologically closest to that punch, on that date.
 * Uses defaultWeekday.startTime as the reference (good enough for finding shift).
 */
export function detectShift(
    checkIn: string,      // ISO timestamp
    targetDate: string,   // YYYY-MM-DD
    byShift: Record<string, AttendanceRuleSet>
): string | null {
    const keys = Object.keys(byShift);
    if (keys.length === 0) return null;

    const inMs = new Date(checkIn).getTime();
    let closest: string | null = null;
    let minDiff = Infinity;

    for (const shiftName of keys) {
        const ruleSet = byShift[shiftName];
        // Use weekday startTime as a representative anchor
        const shiftStartMs = timeOnDate(targetDate, ruleSet.defaultWeekday.startTime).getTime();
        const diff = Math.abs(inMs - shiftStartMs);
        if (diff < minDiff) {
            minDiff = diff;
            closest = shiftName;
        }
    }
    return closest;
}

// ─────────────────────────────────────────────────────────────────────────────
// Rule resolution
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Resolve the exact AttendanceRule for a specific shift + date.
 * Priority: specialDates[date] → defaultWeekend (Sat/Sun) → defaultWeekday
 */
export function resolveRuleForShift(
    shiftName: string,
    targetDate: string,
    byShift: Record<string, AttendanceRuleSet>
): AttendanceRule {
    const ruleSet = byShift[shiftName];
    if (!ruleSet) return DEFAULT_RULE;

    // 1. Special date override
    if (ruleSet.specialDates?.[targetDate]) {
        return ruleSet.specialDates[targetDate];
    }

    // 2. Weekend vs weekday
    const dow = new Date(`${targetDate}T00:00:00`).getDay(); // 0=Sun, 6=Sat
    return (dow === 0 || dow === 6) ? ruleSet.defaultWeekend : ruleSet.defaultWeekday;
}

// ─────────────────────────────────────────────────────────────────────────────
// Status engine
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Calculate attendance status for a single employee on a single day.
 *
 * 1. Auto-detects which shift the employee belongs to (closest startTime).
 * 2. Resolves the rule for that shift + date.
 * 3. Calculates EARLY / ON_TIME / LATE and work hours (capped at endTime).
 *
 * Falls back to DEFAULT_RULE if no rules are configured.
 */
export function calculateAttendanceStatus(
    punchIn: string,
    punchOut: string | null | undefined,
    targetDate: string,
    settings?: RuleContainer | null,
    assignedShift?: string | null,
): AttendanceStatusResult {
    const byShift = settings?.attendanceRules?.byShift;

    // ── Detect shift and resolve rule ─────────────────────────────────────────
    let detectedShift: string | null = null;
    let rule = DEFAULT_RULE;

    if (byShift && Object.keys(byShift).length > 0) {
        detectedShift = assignedShift && byShift[assignedShift]
            ? assignedShift
            : detectShift(punchIn, targetDate, byShift);
        if (detectedShift) {
            rule = resolveRuleForShift(detectedShift, targetDate, byShift);
        }
    }

    const punchInDate = new Date(punchIn);
    const shiftStart = timeOnDate(targetDate, rule.startTime);
    const shiftEnd = timeOnDate(targetDate, rule.endTime);
    const lateThreshold = new Date(shiftStart.getTime() + rule.allowedLateMins * 60_000);

    // ── Status classification ──────────────────────────────────────────────────
    let status: PunchStatus;
    if (punchInDate < shiftStart) {
        status = 'EARLY';
    } else if (punchInDate > lateThreshold) {
        status = 'LATE';
    } else {
        status = 'ON_TIME';
    }

    // ── Effective check-in: capped at startTime if arrived early ──────────────
    const effectiveCheckInDate = punchInDate < shiftStart ? shiftStart : punchInDate;
    const effectiveCheckIn = effectiveCheckInDate.toISOString();

    // ── Work hours (decimal, capped at shiftEnd) ───────────────────────────────
    let workHours: number | null = null;
    if (punchOut) {
        const punchOutDate = new Date(punchOut);
        const effectiveOut = punchOutDate > shiftEnd ? shiftEnd : punchOutDate;
        const diffMs = effectiveOut.getTime() - effectiveCheckInDate.getTime();
        if (diffMs > 0) {
            workHours = Math.round((diffMs / 3_600_000) * 100) / 100;
        }
    }

    // ── Punch-out classification ──────────────────────────────────────────────
    // EARLY_OUT  : left before  endTime - allowedEarlyMins
    // ON_TIME_OUT: left between endTime - allowedEarlyMins  and  endTime + allowedLateMins
    // OVERTIME   : stayed after endTime + allowedLateMins
    let checkOutStatus: PunchOutStatus = 'UNKNOWN';
    if (punchOut) {
        const punchOutDate = new Date(punchOut);
        const earlyOutThreshold = new Date(shiftEnd.getTime() - rule.allowedEarlyMins * 60_000);
        const overtimeThreshold  = new Date(shiftEnd.getTime() + rule.allowedLateMins  * 60_000);
        if (punchOutDate < earlyOutThreshold) {
            checkOutStatus = 'EARLY_OUT';
        } else if (punchOutDate > overtimeThreshold) {
            checkOutStatus = 'OVERTIME';
        } else {
            checkOutStatus = 'ON_TIME_OUT';
        }
    }

    return { status, effectiveCheckIn, workHours, rule, detectedShift, checkOutStatus };
}

export interface DetailedAttendanceShift {
    shift: string;
    dayType: 'Ngày thường' | 'Cuối tuần/lễ';
    standardMinutes: number | null;
    workedMinutes: number | null;
    missingMinutes: number | null;
    outsideMinutes: number | null;
    counted: boolean;
    pending: boolean;
    label: string;
    statusIn: PunchStatus;
    statusOut: PunchOutStatus;
}

/** Export uses Vietnam time and configured rules; never invent a default paid shift. */
export function detailedAttendanceShifts(
    date: string,
    record: DailyAttendance | undefined,
    settings?: RuleContainer | null,
): DetailedAttendanceShift[] {
    if (!record?.checkIn && !record?.checkOut) return [];
    const byShift = settings?.attendanceRules?.byShift ?? {};
    const weekend = [0, 6].includes(new Date(`${date}T00:00:00Z`).getUTCDay());
    const inMs = record?.checkIn ? Date.parse(record.checkIn) : NaN;
    const outMs = record?.checkOut ? Date.parse(record.checkOut) : NaN;
    const bounds = (shift: string) => {
        const rule = byShift[shift] ? resolveRuleForShift(shift, date, byShift) : null;
        const start = rule ? Date.parse(`${date}T${rule.startTime}:00+07:00`) : NaN;
        let end = rule ? Date.parse(`${date}T${rule.endTime}:00+07:00`) : NaN;
        if (end < start) end += 86_400_000;
        return { rule, start, end };
    };
    // Infer the worked shift from punches and the rules for this date, not registrations.
    const anchor = Number.isFinite(inMs) ? inMs : outMs;
    const shiftAnchor = (shift: string) => Number.isFinite(inMs) ? bounds(shift).start : bounds(shift).end;
    const detected = Object.keys(byShift).sort((a, b) =>
        Math.abs(shiftAnchor(a) - anchor) - Math.abs(shiftAnchor(b) - anchor))[0];
    const shifts = [detected ?? 'Chưa xác định'];

    return shifts.map((shift) => {
        const { rule, start, end } = bounds(shift);
        const special = Boolean(byShift[shift]?.specialDates?.[date]);
        const standardMinutes = Number.isFinite(end - start) && end > start ? (end - start) / 60_000 : null;
        const result: DetailedAttendanceShift = {
            shift, dayType: weekend || special ? 'Cuối tuần/lễ' : 'Ngày thường',
            standardMinutes, workedMinutes: null, missingMinutes: null, outsideMinutes: null,
            counted: false, pending: false, label: '', statusIn: 'UNKNOWN', statusOut: 'UNKNOWN',
        };
        const pending = (reason: string) => ({ ...result, pending: true, label: `Chờ xác nhận · ${reason}` });
        if (!record?.checkIn || !record?.checkOut) return pending(!record?.checkIn ? 'Thiếu giờ vào' : 'Thiếu giờ ra');
        if (!Number.isFinite(inMs) || !Number.isFinite(outMs) || outMs <= inMs) return pending('Giờ vào/ra không hợp lệ');
        if (!rule || standardMinutes === null) return pending('Thiếu hoặc sai quy tắc ca');

        // Keep full precision for counting; round only when displaying minutes in Excel.
        const workedMinutes = Math.max(0, Math.min(outMs, end) - Math.max(inMs, start)) / 60_000;
        if (workedMinutes === 0) return pending('Chấm công ngoài khung ca');
        const missingMinutes = Math.max(0, standardMinutes - workedMinutes);
        const outsideMinutes = Math.max(0, outMs - inMs) / 60_000 - workedMinutes;
        return {
            ...result, workedMinutes, missingMinutes, outsideMinutes, counted: true,
            label: missingMinutes > 0 ? 'Thiếu giờ' : 'Đủ giờ',
            statusIn: inMs < start ? 'EARLY' : inMs > start + rule.allowedLateMins * 60_000 ? 'LATE' : 'ON_TIME',
            statusOut: outMs < end - rule.allowedEarlyMins * 60_000 ? 'EARLY_OUT'
                : outMs > end + rule.allowedLateMins * 60_000 ? 'OVERTIME' : 'ON_TIME_OUT',
        };
    });
}
