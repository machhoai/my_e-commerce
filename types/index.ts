// ============================================================
// Firestore Collection Types
// ============================================================

export type UserRole = 'super_admin' | 'admin' | 'store_manager' | 'manager' | 'employee' | 'office';

export type EmployeeType = 'FT' | 'PT';

// ── Permission System ─────────────────────────────────────────
// Mỗi key theo quy ước:
//   page.*   → kiểm soát truy cập vào trang (route guard)
//   action.* → kiểm soát hành động ghi dữ liệu (thêm/sửa/xóa)
// Admin & super_admin luôn bypass tất cả checks.

export interface PermissionDef {
    key: string;
    label: string;
    description: string;
    group: string;
    type: 'page' | 'action';
}

export const ALL_PERMISSIONS: PermissionDef[] = [
    // ── Nhân sự & Lịch làm việc ───────────────────────────────
    {
        key: 'page.scheduling.overview',
        label: 'Xem Lịch Tổng Quan',
        description: 'Truy cập trang lịch tổng quan hàng tuần',
        group: 'Nhân sự & Lịch',
        type: 'page',
    },
    {
        key: 'page.scheduling.register',
        label: 'Xem Đăng Ký Ca',
        description: 'Truy cập trang xem đăng ký ca của nhân viên',
        group: 'Nhân sự & Lịch',
        type: 'page',
    },
    {
        key: 'page.scheduling.history',
        label: 'Xem Lịch Sử',
        description: 'Truy cập trang lịch sử & thống kê các tháng',
        group: 'Nhân sự & Lịch',
        type: 'page',
    },
    {
        key: 'page.scheduling.builder',
        label: 'Vào Trang Xếp Ca',
        description: 'Truy cập trang xếp ca làm việc',
        group: 'Nhân sự & Lịch',
        type: 'page',
    },
    {
        key: 'action.schedule.edit',
        label: 'Lưu / Chỉnh Sửa Lịch',
        description: 'Được phép lưu và chỉnh sửa ca trong Builder',
        group: 'Nhân sự & Lịch',
        type: 'action',
    },
    {
        key: 'page.hr.users',
        label: 'Xem Danh Sách Nhân Viên',
        description: 'Truy cập trang quản lý nhân viên',
        group: 'Nhân sự & Lịch',
        type: 'page',
    },
    {
        key: 'action.hr.manage',
        label: 'Thêm / Sửa Nhân Viên',
        description: 'Tạo, chỉnh sửa, khóa tài khoản nhân viên',
        group: 'Nhân sự & Lịch',
        type: 'action',
    },
    {
        key: 'page.hr.kpi_stats',
        label: 'Xem KPI Nhân Viên',
        description: 'Truy cập trang xem thống kê KPI toàn shop',
        group: 'Nhân sự & Lịch',
        type: 'page',
    },
    {
        key: 'page.hr.kpi_scoring',
        label: 'Vào Trang Chấm KPI',
        description: 'Truy cập trang chấm điểm KPI nhân viên',
        group: 'Nhân sự & Lịch',
        type: 'page',
    },
    {
        key: 'action.hr.score',
        label: 'Chấm Điểm KPI',
        description: 'Thực hiện chấm điểm KPI chính thức',
        group: 'Nhân sự & Lịch',
        type: 'action',
    },
    {
        key: 'action.export.kpi',
        label: 'Xuất Báo Cáo KPI',
        description: 'Xuất file PDF/Excel thống kê KPI nhân viên',
        group: 'Nhân sự & Lịch',
        type: 'action',
    },
    {
        key: 'page.hr.kpi_templates',
        label: 'Quản Lý Mẫu KPI',
        description: 'Tạo, sửa, xóa mẫu chấm điểm KPI',
        group: 'Nhân sự & Lịch',
        type: 'page',
    },
    {
        key: 'action.hr.view_employee_profile',
        label: 'Xem Hồ Sơ Nhân Viên',
        description: 'Xem popup hồ sơ nhân viên (thông tin, KPI, lịch ca)',
        group: 'Nhân sự & Lịch',
        type: 'action',
    },

    // ── Kho cửa hàng ──────────────────────────────────────────
    {
        key: 'page.manager.inventory',
        label: 'Xem Kho Cửa Hàng',
        description: 'Truy cập trang kho và đặt hàng của cửa hàng',
        group: 'Kho Cửa Hàng',
        type: 'page',
    },
    {
        key: 'action.manager.order',
        label: 'Tạo Lệnh Đặt Hàng',
        description: 'Được phép gửi lệnh đặt hàng về kho tổng',
        group: 'Kho Cửa Hàng',
        type: 'action',
    },
    // ── Kho tổng ──────────────────────────────────────────────
    {
        key: 'page.admin.inventory',
        label: 'Xem Kho Tổng',
        description: 'Truy cập trang tổng quan kho tổng',
        group: 'Kho Tổng',
        type: 'page',
    },
    {
        key: 'page.admin.inventory.import',
        label: 'Nhập Kho',
        description: 'Truy cập trang nhập hàng vào kho tổng',
        group: 'Kho Tổng',
        type: 'page',
    },
    {
        key: 'page.admin.inventory.dispatch',
        label: 'Duyệt Xuất Kho',
        description: 'Truy cập trang duyệt lệnh xuất kho',
        group: 'Kho Tổng',
        type: 'page',
    },
    {
        key: 'action.warehouse.write',
        label: 'Thực Hiện Nhập / Xuất Kho',
        description: 'Ghi dữ liệu nhập kho, xuất kho, điều chỉnh tồn',
        group: 'Kho Tổng',
        type: 'action',
    },
    // ── Sản phẩm ──────────────────────────────────────────────
    {
        key: 'page.products',
        label: 'Xem Sản Phẩm',
        description: 'Truy cập trang danh sách sản phẩm',
        group: 'Sản Phẩm',
        type: 'page',
    },
    {
        key: 'page.products.categories',
        label: 'Xem Danh Mục',
        description: 'Truy cập trang quản lý danh mục sản phẩm',
        group: 'Sản Phẩm',
        type: 'page',
    },
    {
        key: 'action.products.write',
        label: 'Thêm / Sửa / Xóa Sản Phẩm',
        description: 'Ghi dữ liệu sản phẩm và danh mục',
        group: 'Sản Phẩm',
        type: 'action',
    },
    // ── Văn phòng ─────────────────────────────────────────────
    {
        key: 'page.office.approvals',
        label: 'Duyệt Lệnh Văn Phòng',
        description: 'Truy cập trang duyệt lệnh đặt hàng từ cửa hàng',
        group: 'Văn Phòng',
        type: 'page',
    },
    {
        key: 'action.office.approve',
        label: 'Phê Duyệt / Từ Chối Lệnh',
        description: 'Thực hiện phê duyệt hoặc từ chối đơn hàng',
        group: 'Văn Phòng',
        type: 'action',
    },
    {
        key: 'page.office.revenue',
        label: 'Xem Doanh Thu',
        description: 'Truy cập trang phân tích doanh thu',
        group: 'Văn Phòng',
        type: 'page',
    },
    // ── Cài Đặt Cửa Hàng ───────────────────────────────────────
    {
        key: 'page.manager.settings',
        label: 'Cài Đặt Cửa Hàng',
        description: 'Truy cập trang cài đặt ca làm, quầy, định mức của cửa hàng',
        group: 'Cài Đặt Cửa Hàng',
        type: 'page',
    },
    {
        key: 'action.manager.settings.write',
        label: 'Chỉnh Sửa Cài Đặt Cửa Hàng',
        description: 'Lưu thay đổi cài đặt ca làm, quầy, định mức',
        group: 'Cài Đặt Cửa Hàng',
        type: 'action',
    },
    // ── Hệ thống ──────────────────────────────────────────────
    {
        key: 'page.admin.settings',
        label: 'Cài Đặt Hệ Thống',
        description: 'Truy cập trang cài đặt hệ thống (Chỉ admin)',
        group: 'Hệ Thống',
        type: 'page',
    },
    {
        key: 'page.admin.broadcast',
        label: 'Gửi Thông Báo Hệ Thống',
        description: 'Truy cập trang gửi push notification hàng loạt',
        group: 'Hệ Thống',
        type: 'page',
    },
    // ── Voucher ───────────────────────────────────────────────
    {
        key: 'page.admin.vouchers',
        label: 'Quản Lý Voucher',
        description: 'Truy cập trang quản lý chiến dịch và mã voucher',
        group: 'Voucher',
        type: 'page',
    },
    {
        key: 'action.voucher.revoke',
        label: 'Vô Hiệu Hóa Voucher',
        description: 'Vô hiệu hóa mã voucher đã phát hành',
        group: 'Voucher',
        type: 'action',
    },
    // ── Sự kiện ──────────────────────────────────────────────────
    {
        key: 'page.admin.events',
        label: 'Quản Lý Sự Kiện',
        description: 'Truy cập trang quản lý sự kiện và phát hành voucher',
        group: 'Sự kiện',
        type: 'page',
    },
];

export interface CustomRoleDoc {
    id: string;
    name: string;
    permissions: string[];       // Danh sách permission keys (page.* / action.*)
    isSystem?: boolean;         // Built-in role — cannot be deleted
    isLocked?: boolean;         // Fully locked (admin) — cannot be edited
    creatorRoles: string[];     // Which role IDs are allowed to assign this role
    color?: string;             // Display color for the role badge
    defaultRoute?: string;      // Default redirect route after login
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
    /** Store IDs this office is authorized to manage. Empty/undefined = no store access. */
    managedStoreIds?: string[];
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

// ============================================================
// Voucher Management
// ============================================================

export type VoucherRewardType = 'discount_percent' | 'discount_fixed' | 'free_ticket' | 'free_item';
export type VoucherCampaignStatus = 'active' | 'paused' | 'ended';
export type VoucherCodeStatus = 'available' | 'distributed' | 'used' | 'revoked' | 'expired';

export interface VoucherCampaign {
    id: string;
    name: string;
    description: string;
    rewardType: VoucherRewardType;
    rewardValue: number;
    validFrom: string;   // ISO date string
    validTo: string;     // ISO date string
    prefix: string;
    codeLength: number;
    suffix: string;
    totalIssued: number;
    status: VoucherCampaignStatus;
    image?: string;      // Firebase Storage URL (WebP, optional)
    createdAt?: string;
    createdBy?: string;
}

export interface VoucherCode {
    id: string;          // The actual code, e.g. "OPEN-X7B9-26"
    campaignId: string;
    campaignName?: string;
    rewardType: VoucherRewardType;
    rewardValue: number;
    validTo: string;
    status: VoucherCodeStatus;
    distributedToPhone: string | null;
    distributedAt: string | null;
    usedAt: string | null;
    usedByStaffId: string | null;
}

// ============================================================
// Event Management
// ============================================================

export type EventStatus = 'upcoming' | 'active' | 'ended' | 'closed';
export type AuditAction = 'CREATE_EVENT' | 'UPDATE_EVENT' | 'GENERATE_VOUCHERS' | 'ISSUE_VOUCHER' | 'REVOKE_VOUCHER';

export interface PrizePoolEntry {
    campaignId: string;
    campaignName?: string;      // denormalized for display
    rewardType: string;
    dailyLimit: number;         // max codes to distribute per day for this campaign
    rate: number;               // win percentage, e.g. 10 = 10%
}

export interface EventDoc {
    id: string;
    name: string;
    prizePool: PrizePoolEntry[];
    startDate: string;          // ISO date string YYYY-MM-DD
    endDate: string;            // ISO date string YYYY-MM-DD
    status: EventStatus;
    dailyStats: Record<string, Record<string, number>>;  // { 'YYYY-MM-DD': { campaignId: count } }
    createdBy: string;
    createdAt: string;
}

export interface AuditLogDoc {
    id: string;
    action: AuditAction;
    actor: string;            // User ID
    actorName?: string;       // Display name
    timestamp: string;        // ISO timestamp
    targetId: string;         // Event/Campaign ID
    details: string;          // Human-readable description
}

// ============================================================
// Headless Promotion Engine
// ============================================================

export interface EventParticipation {
    eventId: string;
    phone: string;
    name: string;
    dob: string;              // YYYY-MM-DD — bắt buộc
    email?: string | null;    // tùy chọn
    totalSpins: number;       // default 3
    usedSpins: number;
    prizes: string[];         // voucher code IDs won
    createdAt: string;
    updatedAt?: string;
    source?: string | null;   // 'qr_code' | 'social_media' | 'direct' | ...
}

export type GachaStatus = 'WON_VOUCHER' | 'LUCK_NEXT_TIME' | 'NO_SPINS_LEFT' | 'ERROR';

export interface GachaResult {
    success: boolean;
    status: GachaStatus;
    spinsRemaining?: number;
    prizeData?: {
        campaignId: string;
        campaignName: string;
        rewardType: string;
        rewardValue: number;
        voucherCode: string;
    };
    message?: string;
}

