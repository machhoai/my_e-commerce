import type { WorkplaceType } from '@/types';

export function workplaceKey(type: WorkplaceType, id: string): string {
    return `${type}:${encodeURIComponent(id.trim())}`;
}

export function parseWorkplaceKey(key: string): { type: WorkplaceType; id: string } | null {
    const separator = key.indexOf(':');
    if (separator <= 0) return null;
    const type = key.slice(0, separator) as WorkplaceType;
    if (!['STORE', 'OFFICE', 'CENTRAL'].includes(type)) return null;
    try {
        const id = decodeURIComponent(key.slice(separator + 1)).trim();
        return id ? { type, id } : null;
    } catch {
        return null;
    }
}

export function currentMembershipId(userId: string, key: string): string {
    return `${encodeURIComponent(userId)}__${encodeURIComponent(key)}`;
}

export function weeklyRegistrationId(userId: string, storeId: string, weekStartDate: string): string {
    return `${encodeURIComponent(userId)}__${encodeURIComponent(storeId)}__${weekStartDate}`;
}

export function legacyWeeklyRegistrationId(userId: string, weekStartDate: string): string {
    return `${userId}_${weekStartDate}`;
}

export function scheduleId(storeId: string, date: string, shiftId: string, counterId: string): string {
    return [storeId, date, shiftId, counterId].map(encodeURIComponent).join('__');
}

export function employeeDayAllocationId(userId: string, date: string): string {
    return `${encodeURIComponent(userId)}__${date}`;
}
