import type { ScheduleDoc, StoreSettings } from '@/types';

type MonthlyQuotas = NonNullable<StoreSettings['monthlyQuotas']>;

export function nextMonthStart(month: string): string {
    const [year, monthNumber] = month.split('-').map(Number);
    const next = new Date(Date.UTC(year, monthNumber, 1));
    return `${next.getUTCFullYear()}-${String(next.getUTCMonth() + 1).padStart(2, '0')}-01`;
}

export function monthlyShiftLimit(type: string | undefined, month: string, quotas: Partial<MonthlyQuotas> | undefined): number {
    const [year, monthNumber] = month.split('-').map(Number);
    const days = new Date(year, monthNumber, 0).getDate();
    return type === 'FT'
        ? Math.max(0, days - Number(quotas?.ftDaysOff ?? 4))
        : Number(quotas?.ptMaxShifts ?? 25);
}

export function assignedShiftKeys(schedules: Pick<ScheduleDoc, 'storeId' | 'date' | 'shiftId'>[]): Set<string> {
    return new Set(schedules.map(schedule => `${schedule.storeId}\u0000${schedule.date}\u0000${schedule.shiftId}`));
}
