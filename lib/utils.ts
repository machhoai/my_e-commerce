import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
    return twMerge(clsx(inputs));
}

/**
 * Format a date string (YYYY-MM-DD) to a human-readable label.
 */
export function formatDate(dateStr: string): string {
    const d = new Date(dateStr + 'T00:00:00');
    return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
}

/**
 * Get the Monday (start) of the week that contains the given date.
 */
export function getWeekStart(date: Date = new Date()): Date {
    const d = new Date(date);
    const day = d.getDay(); // 0=Sun, 1=Mon...
    const diff = d.getDate() - day + (day === 0 ? -6 : 1); // adjust to Monday
    d.setDate(diff);
    d.setHours(0, 0, 0, 0);
    return d;
}

/**
 * Returns an array of 7 ISO date strings (Mon-Sun) for a given week start.
 */
export function getWeekDays(weekStart: Date): string[] {
    return Array.from({ length: 7 }, (_, i) => {
        const d = new Date(weekStart);
        d.setDate(d.getDate() + i);
        return d.toISOString().split('T')[0];
    });
}

/**
 * Returns a weekly_registrations document ID for a user+week.
 */
export function weeklyRegId(userId: string, weekStart: Date): string {
    return `${userId}_${weekStart.toISOString().split('T')[0]}`;
}

/**
 * Returns a schedule document ID for date+shift.
 */
export function scheduleDocId(date: string, shiftId: string): string {
    return `${date}_${shiftId}`;
}

const COMPANY_DOMAIN = process.env.NEXT_PUBLIC_COMPANY_DOMAIN ?? 'company.com';

export function phoneToEmail(phone: string): string {
    // Strip non-digits, then format as email
    const cleaned = phone.replace(/\D/g, '');
    return `${cleaned}@${COMPANY_DOMAIN}`;
}

export function defaultPassword(phone: string): string {
    const cleaned = phone.replace(/\D/g, '');
    return cleaned.slice(-6);
}
