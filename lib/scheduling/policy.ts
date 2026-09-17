/**
 * An employee may work at several counters during one shift, but may only
 * work one distinct shift (and at one store) per business day.
 */
export const MAX_EMPLOYEE_SHIFTS_PER_DAY = 1;

export function exceedsDailyShiftLimit(shiftIds: Iterable<string>): boolean {
    return new Set(shiftIds).size > MAX_EMPLOYEE_SHIFTS_PER_DAY;
}
