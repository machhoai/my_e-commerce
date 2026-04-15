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

import { AttendanceRule, AttendanceRuleSet } from '@/types';

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

type RuleContainer = {
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
    settings?: RuleContainer | null
): AttendanceStatusResult {
    const byShift = settings?.attendanceRules?.byShift;

    // ── Detect shift and resolve rule ─────────────────────────────────────────
    let detectedShift: string | null = null;
    let rule = DEFAULT_RULE;

    if (byShift && Object.keys(byShift).length > 0) {
        detectedShift = detectShift(punchIn, targetDate, byShift);
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
