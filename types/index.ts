// ============================================================
// Firestore Collection Types
// ============================================================

export type UserRole = 'admin' | 'manager' | 'employee';
export type EmployeeType = 'FT' | 'PT';

export interface UserDoc {
    uid: string;
    name: string;
    phone: string; // Used strictly for login via phoneToEmail pseudo-email trick
    role: UserRole;
    type: EmployeeType;
    isActive: boolean;
    createdAt?: string;

    // Extended Profile Fields
    dob?: string;
    jobTitle?: string;
    email?: string;
    idCard?: string;
    bankAccount?: string;
    education?: string;
}

export interface CounterDoc {
    id: string;
    name: string;
}

export interface SettingsDoc {
    id: 'global';
    registrationOpen: boolean;
    shiftTimes: string[]; // e.g. ["08:00-12:00", "12:00-17:00", "17:00-22:00"]
    quotas?: {
        defaultWeekday: Record<string, number>; // shiftId -> max quota
        defaultWeekend: Record<string, number>; // shiftId -> max quota
        specialDates: Record<string, Record<string, number>>; // "YYYY-MM-DD" -> shiftId -> max quota
    };
}

export interface ShiftEntry {
    date: string;   // ISO date string, e.g. "2024-01-15"
    shiftId: string; // one of settings.shiftTimes values
}

export interface WeeklyRegistration {
    id: string;
    userId: string;
    weekStartDate: string; // ISO date string for the Monday of the week
    shifts: ShiftEntry[];
    submittedAt?: string;
}

export interface ScheduleDoc {
    id: string;            // "{date}_{shiftId}" e.g. "2024-01-15_08:00-12:00"
    date: string;
    shiftId: string;
    counterId: string;
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
