// ============================================================
// Firestore Collection Types
// ============================================================

export type UserRole = 'super_admin' | 'admin' | 'store_manager' | 'manager' | 'employee' | 'office';
export type EmployeeType = 'FT' | 'PT';

// All available granular permissions in the system
export type AppPermission =
    // ── Inventory ──
    | 'view_inventory'    // Xem kho hàng
    | 'create_product'   // Thêm sản phẩm
    | 'edit_product'     // Sửa sản phẩm
    | 'import_excel'     // Import Excel
    | 'delete_product'   // Xóa sản phẩm
    // ── Orders ──
    | 'create_order'            // Tạo lệnh đặt hàng
    | 'cancel_order'            // Hủy lệnh đặt hàng
    | 'approve_office_order'    // Duyệt lệnh (Văn phòng)
    | 'reject_office_order'     // Từ chối lệnh (Văn phòng)
    | 'dispatch_central_order'  // Xuất kho (Kho Tổng)
    // ── HR & Scheduling (legacy keys kept for compat) ──
    | 'view_overview'    // Xem lịch tổng quan
    | 'view_history'     // Xem lịch sử & thống kê
    | 'view_schedule'    // Xem trang xếp lịch (chỉ đọc)
    | 'edit_schedule'    // Xếp ca / lưu lịch
    | 'view_users'       // Xem danh sách nhân viên
    | 'manage_hr'        // Thêm/sửa/tắt hoạt động nhân viên
    | 'register_shift'   // Đăng ký ca làm (ân viên)
    | 'manage_kpi_templates'  // Tạo/sửa mẫu KPI
    | 'score_employees'       // Chấm điểm nhân viên
    | 'view_all_kpi'          // Xem thống kê KPI tất cả NV
    | 'export_kpi'            // Xuất báo cáo KPI
    | 'manage_central_warehouse' // Quản lý kho tổng
    | 'manage_locations' // Quản lý địa điểm (chi nhánh, VP, kho)
    | 'manage_roles'     // Quản lý phân quyền
    | 'manage_users'     // Quản lý tài khoản người dùng
    // ── Doanh thu ──
    | 'view_revenue';    // Xem trang phân tích doanh thu

export const ALL_PERMISSIONS: { key: AppPermission; label: string; description: string; group: string }[] = [
    // Kho hàng
    { key: 'view_inventory', label: 'Xem Kho hàng', description: 'Xem danh sách sản phẩm và tồn kho', group: 'Kho hàng' },
    { key: 'create_product', label: 'Thêm Sản phẩm', description: 'Tạo sản phẩm mới trong danh mục', group: 'Kho hàng' },
    { key: 'edit_product', label: 'Sửa Sản phẩm', description: 'Cập nhật thông tin sản phẩm', group: 'Kho hàng' },
    { key: 'import_excel', label: 'Import Excel', description: 'Nhập dữ liệu hàng loạt từ file Excel', group: 'Kho hàng' },
    { key: 'delete_product', label: 'Xóa Sản phẩm', description: 'Xóa sản phẩm khỏi hệ thống', group: 'Kho hàng' },
    // Đặt lệnh
    { key: 'create_order', label: 'Tạo Lệnh Đặt hàng', description: 'Tạo lệnh đặt hàng mới từ cửa hàng', group: 'Đặt lệnh' },
    { key: 'cancel_order', label: 'Hủy Lệnh', description: 'Hủy lệnh đặt hàng đang chờ xử lý', group: 'Đặt lệnh' },
    { key: 'approve_office_order', label: 'Duyệt lệnh (VP)', description: 'Phê duyệt lệnh đặt hàng tại tầng Văn phòng', group: 'Đặt lệnh' },
    { key: 'reject_office_order', label: 'Từ chối lệnh (VP)', description: 'Từ chối lệnh đặt hàng tại tầng Văn phòng', group: 'Đặt lệnh' },
    { key: 'dispatch_central_order', label: 'Xuất kho (Kho Tổng)', description: 'Xác nhận xuất hàng từ kho trung tâm', group: 'Đặt lệnh' },
    // Nhân sự & Xếp lịch
    { key: 'view_overview', label: 'Xem Tổng quan', description: 'Xem lịch tổng quan hàng tuần', group: 'Nhân sự' },
    { key: 'view_history', label: 'Xem Lịch sử', description: 'Xem thống kê và lịch sử các tháng', group: 'Nhân sự' },
    { key: 'view_schedule', label: 'Xem Xếp lịch', description: 'Xem (không sửa) trang xếp ca', group: 'Nhân sự' },
    { key: 'edit_schedule', label: 'Chỉnh sửa Xếp lịch', description: 'Tạo/lưu lịch phân công ca', group: 'Nhân sự' },
    { key: 'view_users', label: 'Xem Nhân viên', description: 'Xem danh sách nhân viên', group: 'Nhân sự' },
    { key: 'manage_hr', label: 'Quản lý Nhân sự', description: 'Thêm, sửa, vô hiệu hóa tài khoản', group: 'Nhân sự' },
    { key: 'register_shift', label: 'Đăng ký Ca làm', description: 'Tự đăng ký lịch làm hàng tuần', group: 'Nhân sự' },
    { key: 'manage_kpi_templates', label: 'Quản lý Mẫu KPI', description: 'Tạo, sửa, xóa mẫu chấm điểm KPI', group: 'Nhân sự' },
    { key: 'score_employees', label: 'Chấm điểm NV', description: 'Chấm điểm KPI chính thức cho nhân viên', group: 'Nhân sự' },
    { key: 'view_all_kpi', label: 'Xem KPI Tất cả NV', description: 'Xem thống kê KPI của tất cả nhân viên', group: 'Nhân sự' },
    { key: 'export_kpi', label: 'Xuất Báo cáo KPI', description: 'Xuất báo cáo PDF/Excel KPI nhân viên', group: 'Nhân sự' },
    { key: 'manage_central_warehouse', label: 'Quản lý Kho tổng', description: 'Truy cập và quản lý kho trung tâm', group: 'Kho hàng' },
    // Hệ thống
    { key: 'manage_locations', label: 'Quản lý Địa điểm', description: 'Tạo, sửa, bật/tắt cửa hàng, văn phòng, kho', group: 'Hệ thống' },
    { key: 'manage_roles', label: 'Quản lý Phân quyền', description: 'Tạo, sửa, xóa vai trò tùy chỉnh', group: 'Hệ thống' },
    { key: 'manage_users', label: 'Quản lý Người dùng', description: 'Tạo, sửa, khóa tài khoản người dùng', group: 'Hệ thống' },
    // Doanh thu
    { key: 'view_revenue', label: 'Xem Doanh thu', description: 'Truy cập trang phân tích doanh thu Joyworld', group: 'Doanh thu' },
];

export interface CustomRoleDoc {
    id: string;
    name: string;
    permissions: AppPermission[];
    isSystem?: boolean;         // Built-in role (admin, store_manager, manager, employee) — cannot be deleted
    isLocked?: boolean;         // Fully locked (admin role) — cannot be edited or deleted
    creatorRoles: string[];     // Which role IDs are allowed to create/assign this role
    color?: string;             // Display color for the role badge
    defaultRoute?: string;      // Default redirect route after login (e.g. '/office/revenue')
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
    isActive: boolean;
    createdAt?: string;
    settings?: StoreSettings;  // Per-store registration & shift configuration
}

export interface OfficeDoc {
    id: string;
    name: string;
    address?: string;
    contactEmail?: string;
    isActive: boolean;
    createdAt?: string;
}

export interface WarehouseDoc {
    id: string;
    name: string;
    address?: string;
    capacitySqm?: number;
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

    // Workplace assignment — workplaceType drives context-aware navigation
    workplaceType?: 'STORE' | 'OFFICE' | 'CENTRAL';
    storeId?: string;      // Populated when workplaceType === 'STORE'
    officeId?: string;     // Populated when workplaceType === 'OFFICE'
    warehouseId?: string;  // Populated when workplaceType === 'CENTRAL'

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
    defaultDashboard?: string; // User-configurable preferred landing page (e.g. '/office/revenue')
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
