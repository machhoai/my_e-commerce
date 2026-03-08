// ============================================================
// Firestore Collection Types
// ============================================================

export type UserRole = 'admin' | 'store_manager' | 'manager' | 'employee' | 'office';
export type EmployeeType = 'FT' | 'PT';

// All available granular permissions in the system
export type AppPermission =
    | 'view_overview'    // Xem lịch tổng quan
    | 'view_history'     // Xem lịch sử & thống kê
    | 'view_schedule'    // Xem trang xếp lịch (chỉ đọc)
    | 'edit_schedule'    // Xếp ca / lưu lịch
    | 'view_users'       // Xem danh sách nhân viên
    | 'manage_hr'        // Thêm/sửa/tắt hoạt động nhân viên
    | 'register_shift'   // Đăng ký ca làm (nhân viên)
    | 'manage_kpi_templates'  // Tạo/sửa mẫu KPI
    | 'score_employees'       // Chấm điểm nhân viên
    | 'view_all_kpi'          // Xem thống kê KPI tất cả NV
    | 'export_kpi'            // Xuất báo cáo KPI
    | 'manage_central_warehouse'; // Quản lý kho tổng

export const ALL_PERMISSIONS: { key: AppPermission; label: string; description: string }[] = [
    { key: 'view_overview', label: 'Xem Tổng quan', description: 'Xem lịch tổng quan hàng tuần' },
    { key: 'view_history', label: 'Xem Lịch sử', description: 'Xem thống kê và lịch sử các tháng' },
    { key: 'view_schedule', label: 'Xem Xếp lịch', description: 'Xem (không sửa) trang xếp ca' },
    { key: 'edit_schedule', label: 'Chỉnh sửa Xếp lịch', description: 'Tạo/lưu lịch phân công ca' },
    { key: 'view_users', label: 'Xem Nhân viên', description: 'Xem danh sách nhân viên' },
    { key: 'manage_hr', label: 'Quản lý Nhân sự', description: 'Thêm, sửa, vô hiệu hóa tài khoản' },
    { key: 'register_shift', label: 'Đăng ký Ca làm', description: 'Tự đăng ký lịch làm hàng tuần' },
    { key: 'manage_kpi_templates', label: 'Quản lý Mẫu KPI', description: 'Tạo, sửa, xóa mẫu chấm điểm KPI' },
    { key: 'score_employees', label: 'Chấm điểm NV', description: 'Chấm điểm KPI chính thức cho nhân viên' },
    { key: 'view_all_kpi', label: 'Xem KPI Tất cả NV', description: 'Xem thống kê KPI của tất cả nhân viên' },
    { key: 'export_kpi', label: 'Xuất Báo cáo KPI', description: 'Xuất báo cáo PDF/Excel KPI nhân viên' },
    { key: 'manage_central_warehouse', label: 'Quản lý Kho tổng', description: 'Truy cập và quản lý kho trung tâm (nhập kho, xuất kho, thẻ kho tổng)' },
];

export interface CustomRoleDoc {
    id: string;
    name: string;
    permissions: AppPermission[];
    isSystem?: boolean;         // Built-in role (admin, store_manager, manager, employee) — cannot be deleted
    isLocked?: boolean;         // Fully locked (admin role) — cannot be edited or deleted
    creatorRoles: string[];     // Which role IDs are allowed to create/assign this role
    color?: string;             // Display color for the role badge
    applicableTo?: ('STORE' | 'OFFICE' | 'CENTRAL')[];  // Which location types can use this role
    createdAt?: string;
    createdBy?: string;
}

// Per-store configurable settings (stored as a field in the store document)
export interface StoreSettings {
    registrationOpen: boolean;
    strictShiftLimit?: boolean; // true (default) = block when full; false = allow over-registration
    shiftTimes: string[]; // e.g. ["Ca 1", "Ca 2"]
    quotas?: {
        defaultWeekday: Record<string, number>;
        defaultWeekend: Record<string, number>;
        specialDates: Record<string, Record<string, number>>;
    };
    monthlyQuotas?: {
        ftDaysOff: number;
        ptMinShifts: number;
        ptMaxShifts: number;
    };
    registrationSchedule?: RegistrationSchedule;
}

export interface StoreDoc {
    id: string;
    name: string;
    address?: string;
    type?: 'STORE' | 'CENTRAL' | 'OFFICE'; // Location type for routing purposes
    isActive: boolean;
    createdAt?: string;
    settings?: StoreSettings;  // Per-store registration & shift configuration
}

export interface UserDoc {
    uid: string;
    name: string;
    phone: string; // Used strictly for login via phoneToEmail pseudo-email trick
    role: UserRole;
    type: EmployeeType;
    isActive: boolean;
    createdAt?: string;
    storeId?: string; // Which store/office/central location this user belongs to
    locationType?: 'STORE' | 'OFFICE' | 'CENTRAL'; // Cached from the assigned location's type — drives context-aware navigation

    // Extended Profile Fields
    dob?: string;
    jobTitle?: string;
    email?: string;
    idCard?: string;
    bankAccount?: string;
    education?: string;

    // Permissions
    canManageHR?: boolean;
    customRoleId?: string; // Points to a document in 'custom_roles' collection
    fcmToken?: string; // Firebase Cloud Messaging registration token
}

export interface NotificationDoc {
    id: string;
    userId: string;
    storeId?: string;
    title: string;
    body: string;
    type: 'SYSTEM' | 'SWAP_REQUEST' | 'APPROVAL' | 'GENERAL';
    isRead: boolean;
    actionLink?: string;
    createdAt: string;
}

export interface NotificationTemplate {
    id: string;
    name: string;
    titleTemplate: string;
    bodyTemplate: string;
    isSystemEvent: boolean;
}



export interface CounterDoc {
    id: string;
    name: string;
    storeId: string; // Each counter now belongs to a specific store
    isActive: boolean; // Whether this counter is active for inventory tracking
}

export interface SettingsDoc {
    id: string; // 'global' for the legacy global doc, or storeId for store-specific docs
    registrationOpen: boolean;
    strictShiftLimit?: boolean; // true (default) = block when full; false = allow over-registration
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
    registrationSchedule?: RegistrationSchedule;
    eventMappings?: Record<string, string>; // Maps system event keys like 'SHIFT_CHANGED' -> templateId
}

export interface RegistrationSchedule {
    enabled: boolean;
    openDay: number;    // 0=CN, 1=T2 ... 6=T7
    openHour: number;
    openMinute: number;
    closeDay: number;
    closeHour: number;
    closeMinute: number;
}

export interface ShiftEntry {
    date: string;   // ISO date string, e.g. "2024-01-15"
    shiftId: string; // one of settings.shiftTimes values
    isAssignedByManager?: boolean; // true if this specific shift was force-assigned by manager
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
    assignedByManagerUids?: string[]; // UIDs force-assigned by manager (subset of employeeIds)
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

// ============================================================
// KPI & Performance Scoring
// ============================================================

export interface KpiCriteria {
    name: string;
    maxScore: number;
}

export interface KpiGroup {
    name: string;
    criteria: KpiCriteria[];
}

export interface KpiTemplateDoc {
    id: string;
    storeId: string;
    name: string;
    assignedCounterIds: string[];
    maxTotalScore: 100; // always 100
    groups: KpiGroup[];
    createdAt?: string;
    createdBy?: string;
}

export type KpiRecordStatus = 'DRAFT' | 'SELF_SCORED' | 'OFFICIAL';

export interface KpiCriteriaScore {
    criteriaName: string;
    maxScore: number;
    selfScore: number;
    officialScore: number;
    note?: string;
}

export interface KpiRecordDoc {
    id: string;
    storeId: string;
    userId: string;
    shiftId: string;
    date: string;
    counterId: string;
    templateId: string;
    selfTotal: number;
    officialTotal: number;
    scoredByUserId?: string;
    status: KpiRecordStatus;
    details: KpiCriteriaScore[];
    createdAt?: string;
    updatedAt?: string;
}
