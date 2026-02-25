// ============================================================
// Firestore Collection Types
// ============================================================

export type UserRole = 'admin' | 'store_manager' | 'manager' | 'employee';
export type EmployeeType = 'FT' | 'PT';

export interface StoreDoc {
    id: string;
    name: string;
    address?: string;
    isActive: boolean;
    createdAt?: string;
}

export interface UserDoc {
    uid: string;
    name: string;
    phone: string; // Used strictly for login via phoneToEmail pseudo-email trick
    role: UserRole;
    type: EmployeeType;
    isActive: boolean;
    createdAt?: string;
    storeId?: string; // Which store this user belongs to (undefined only for admin)

    // Extended Profile Fields
    dob?: string;
    jobTitle?: string;
    email?: string;
    idCard?: string;
    bankAccount?: string;
    education?: string;

    // Permissions
    canManageHR?: boolean;
}

export interface CounterDoc {
    id: string;
    name: string;
    storeId: string; // Each counter now belongs to a specific store
}

export interface SettingsDoc {
    id: 'global';
    registrationOpen: boolean;
    shiftTimes: string[]; // e.g. ["Ca 1", "Ca 2"]
    quotas?: {
        defaultWeekday: Record<string, number>; // shiftId -> max quota
        defaultWeekend: Record<string, number>; // shiftId -> max quota
        specialDates: Record<string, Record<string, number>>; // "YYYY-MM-DD" -> shiftId -> max quota
    };
    monthlyQuotas?: {
        ftDaysOff: number;
        ptMinShifts: number;
        ptMaxShifts: number;
    };
}

export interface ShiftEntry {
    date: string;   // ISO date string, e.g. "2024-01-15"
    shiftId: string; // one of settings.shiftTimes values
}

export interface WeeklyRegistration {
    id: string;
    userId: string;
    storeId: string;
    weekStartDate: string; // ISO date string for the Monday of the week
    shifts: ShiftEntry[];
    submittedAt?: string;
}

export interface ScheduleDoc {
    id: string;            // "{date}_{shiftId}_{counterId}" or "{date}_{shiftId}"
    date: string;
    shiftId: string;
    counterId: string;
    storeId: string;
    employeeIds: string[]; // array of user UIDs
    publishedAt?: string;
    publishedBy?: string;
}

// ============================================================
// UI / App Helpers
// ============================================================

export interface DayRegistration {
    date: string;
    selectedShifts: string[];
}

// When a manager drags employees to counters
export interface CounterAssignment {
    counterId: string;
    counterName: string;
    employeeIds: string[];
}

export type ScheduleMap = Record<string, CounterAssignment[]>;
// key = "date_shiftId"
