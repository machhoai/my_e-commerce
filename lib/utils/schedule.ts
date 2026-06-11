import { RegistrationSchedule } from '@/types';

/**
 * Checks if the current time is within the configured registration window.
 * All time calculations are done in UTC+7 (Vietnam time).
 */
export function isInOpenWindow(schedule: RegistrationSchedule): boolean {
    const nowUtc = new Date();
    const vnMs = nowUtc.getTime() + 7 * 60 * 60 * 1000;
    const vnNow = new Date(vnMs);

    const currentDay = vnNow.getUTCDay();
    const currentMinutes = vnNow.getUTCHours() * 60 + vnNow.getUTCMinutes();

    const openTotal = schedule.openDay * 24 * 60 + schedule.openHour * 60 + schedule.openMinute;
    const closeTotal = schedule.closeDay * 24 * 60 + schedule.closeHour * 60 + schedule.closeMinute;
    const nowTotal = currentDay * 24 * 60 + currentMinutes;

    if (openTotal <= closeTotal) {
        return nowTotal >= openTotal && nowTotal < closeTotal;
    } else {
        return nowTotal >= openTotal || nowTotal < closeTotal;
    }
}
