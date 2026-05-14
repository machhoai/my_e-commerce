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
        key: 'page.hr.attendance',
        label: 'Xem Lịch Sử Chấm Công',
        description: 'Truy cập trang xem lịch sử chấm công từ máy ZKTeco',
        group: 'Nhân sự & Lịch',
        type: 'page',
    },
    {
        key: 'hr.attendance.configure',
        label: 'Cấu Hình Chấm Công',
        description: 'Cấu hình chấm công',
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
        key: 'page.referral.history',
        label: 'Xem Lịch Sử Tích Điểm',
        description: 'Truy cập trang lịch sử tích điểm giới thiệu toàn bộ cửa hàng',
        group: 'Nhân sự & Lịch',
        type: 'page',
    },
    {
        key: 'manage_referrals',
        label: 'Quản Lý Giới Thiệu',
        description: 'Đồng bộ, điều chỉnh điểm giới thiệu và quản lý referral của cửa hàng',
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
    {
        key: 'action.hr.edit_contract',
        label: 'Chỉnh Sửa Số Hợp Đồng',
        description: 'Cho phép chỉnh sửa số hợp đồng của nhân viên',
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
    {
        key: 'search_vouchers',
        label: 'Tìm Kiếm Voucher',
        description: 'Cho phép quét và tìm kiếm mã voucher qua Scanner',
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
    // ── Vé & Đơn hàng (Ticketing) ────────────────────────────────
    {
        key: 'scan_tickets',
        label: 'Quét Vé & Đơn Hàng',
        description: 'Cho phép quét mã vé, đơn hàng từ hệ thống bán vé qua Scanner',
        group: 'Vé & Đơn hàng',
        type: 'action',
    },
    // ── POS (Point of Sale) ──────────────────────────────────
    {
        key: 'page.pos.access',
        label: 'Truy Cập Hệ Thống POS',
        description: 'Cho phép đăng nhập và sử dụng ứng dụng POS bán hàng',
        group: 'POS',
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

/**
 * Time-boundary rule for a shift / day type.
 * Used to classify Check-In status: EARLY | ON_TIME | LATE
 */
export interface AttendanceRule {
    startTime: string;         // HH:mm — shift start (e.g. "09:30")
    endTime: string;           // HH:mm — shift end   (e.g. "16:30")
    allowedEarlyMins: number;  // Grace period BEFORE startTime that still counts as ON_TIME
    allowedLateMins: number;   // Grace period AFTER  startTime that still counts as ON_TIME
}

/**
 * A complete rule set for ONE shift: weekday, weekend, and per-date overrides.
 */
export interface AttendanceRuleSet {
    defaultWeekday: AttendanceRule;
    defaultWeekend: AttendanceRule;
    specialDates: Record<string, AttendanceRule>; // "YYYY-MM-DD" → Rule
}

export interface StoreSettings {
    registrationOpen: boolean;
    strictShiftLimit?: boolean; // true (default) = block when full; false = allow over-registration
    maxShiftsPerDay?: number;   // Max shifts an employee can select per day (default = 1)
    referralEnabled?: boolean;  // true (default) = referral program active; false = disabled for this store
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
    /**
     * Per-shift attendance rules, keyed by shift name from shiftTimes.
     * Example: { "Ca 1": { defaultWeekday: {...}, ... }, "Ca 2": {...} }
     * Shift is auto-detected at check-in time (closest startTime wins).
     */
    attendanceRules?: {
        byShift: Record<string, AttendanceRuleSet>;
    };
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
    contractNumber?: string;  // Số hợp đồng (alphanumeric)
    gender?: string;           // Giới tính (from CCCD QR)
    permanentAddress?: string; // Địa chỉ thường trú (from CCCD QR)
    idCardFrontPhoto?: string; // WebP base64 — front of CCCD
    idCardBackPhoto?: string;  // WebP base64 — back of CCCD

    // Permissions
    canManageHR?: boolean;
    customRoleId?: string; // Points to a document in 'custom_roles' collection
    fcmToken?: string; // Firebase Cloud Messaging registration token (legacy single)
    fcmTokens?: string[]; // Multi-device FCM tokens array
    defaultDashboard?: string; // User-configurable preferred landing page (e.g. '/office/revenue')
    avatar?: string; // WebP base64 data URI for profile portrait

    // Two-Factor Authentication (TOTP / Google Authenticator)
    twoFactorSecret?: string;     // TOTP secret key (stored after verified setup)
    isTwoFactorEnabled?: boolean; // Whether 2FA is active for this user

    // Referral Points System
    referralPoints?: number;      // Total accumulated affiliate points
    monthlyReferralPoints?: Record<string, number>; // Per-month breakdown, key = "YYYY-MM"
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
    maxShiftsPerDay?: number;   // Max shifts an employee can select per day (default = 1)
    referralEnabled?: boolean;  // true (default) = referral program active; false = disabled for this store
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
    /** Per-shift attendance rules. Same shape as StoreSettings.attendanceRules. */
    attendanceRules?: {
        byShift: Record<string, AttendanceRuleSet>;
    };
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
export type VoucherCampaignPurpose = 'print' | 'event';

export interface TicketTemplateConfig {
    bgColor: string;            // e.g. '#1a1a2e'
    accentColor: string;        // e.g. '#f59e0b'
    ticketColor?: string;       // Overall ticket accent color for email (falls back to accentColor)
    logoUrl?: string;           // Firebase Storage URL
    title: string;              // Tiêu đề in trên vé
    showExpiry: boolean;
    showDescription: boolean;
    showRewardValue: boolean;
    qrSize: 'sm' | 'md' | 'lg'; // 100 | 140 | 180px
}

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
    purpose: VoucherCampaignPurpose;
    image?: string;           // Firebase Storage URL (WebP, optional)
    ticketTemplate?: TicketTemplateConfig; // Mẫu thiết kế vé (chỉ cho in ấn)
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
    emailedAt?: string | null;   // ISO timestamp của lần gửi email gần nhất
    emailedTo?: string | null;   // Địa chỉ email đã gửi
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
    location?: string | null; // e.g. 'Quận 1, TP.HCM'
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

// ============================================================
// Universal Scanner
// ============================================================

export type ScanResultType = 'PHONE' | 'VOUCHER' | 'PRODUCT' | 'REFERRAL' | 'NOT_FOUND';

export interface ScanResult {
    type: ScanResultType;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    data: any;
}

// ============================================================
// Ticketing API (External B.Duck Scan & Ticketing System)
// ============================================================

export type TicketPassStatus = 'active' | 'used' | 'voided';
export type TicketOrderStatus = 'pending' | 'paid' | 'cancelled';

export interface TicketPassData {
    id: string;
    shortCode: string;
    qrCode: string;
    orderId: string;
    orderNumber: string;
    customerId?: string;
    customerName: string;
    customerEmail?: string;
    productId: string;
    productName: string;
    productType: string;
    thumbnailUrl?: string;
    validityType: string;        // 'open-dated' | 'fixed-date'
    status: TicketPassStatus;
    comboItems?: string[] | null;
    visitDate?: string | null;
    validFrom: string;
    validUntil: string;
    createdAt: string;
    usedAt?: string | null;
    usedBy?: string | null;
}

export interface TicketOrderItem {
    productId: string;
    productName: string;
    productType: string;
    quantity: number;
    unitPrice: number;
    subtotal: number;
}

export interface TicketOrderData {
    id: string;
    orderNumber: string;
    orderCode: string;
    status: TicketOrderStatus;
    customerName: string;
    customerEmail?: string;
    customerPhone?: string;
    isGuestOrder: boolean;
    paymentProvider: string;
    items: TicketOrderItem[];
    subtotal: number;
    discountAmount: number;
    finalAmount: number;
    promotionCode?: string | null;
    passIds?: string[];
    paidAt?: string | null;
    createdAt: string;
    expiresAt?: string | null;
    cancelReason?: string | null;
}

/** Response from GET /api/v1/scan — can be pass or order */
export type TicketScanResponse =
    | { success: true; type: 'pass'; pass: TicketPassData }
    | { success: true; type: 'order'; order: TicketOrderData }
    | { success: false; error: string; message: string };

/** Response from POST /api/v1/scan/use-pass */
export type TicketUsePassResponse =
    | { success: true; message: string; pass: TicketPassData }
    | { success: false; error: string; message: string; pass?: TicketPassData | null };

/** Response from POST /api/v1/scan/confirm-payment */
export interface TicketConfirmPaymentPass {
    id: string;
    shortCode: string;
    qrCode: string;
    status: string;
}
export type TicketConfirmPaymentResponse =
    | {
        success: true;
        message: string;
        order: { id: string; orderNumber: string; orderCode: string; status: string; finalAmount: number; customerName: string; paidAt: string };
        passes: TicketConfirmPaymentPass[];
    }
    | { success: false; error: string; message: string };

// ============================================================
// Referral / Affiliate Points
// ============================================================

export type ReferralPackage = 'Silver' | 'Gold' | 'Diamond';
export type PendingReferralStatus = 'waiting' | 'matched' | 'expired' | 'no_order' | 'revoked';

export interface PendingReferralDoc {
    id: string;
    saleEmployeeId: string;      // UID of the sales staff who referred
    saleEmployeeName: string;    // Denormalized name
    cashierId: string;           // UID of cashier who created the ticket
    customerPhone: string;       // Customer's phone number
    expectedPackage: ReferralPackage;
    status: PendingReferralStatus;
    expiresAt: string;           // ISO timestamp (now + 5 min)
    createdAt: string;           // ISO timestamp
    matchedOrderCode?: string;   // POS order code once matched
    matchedOrderValue?: number;  // Order value in VND
    pointsAwarded?: number;      // Points given to employee
}

export type PointTransactionType = 'earned' | 'manual_adjustment' | 'refund_revocation';

export interface PointTransactionDoc {
    id: string;
    employeeId: string;          // UID of the employee who earned points
    type?: PointTransactionType; // Defaults to 'earned' for legacy data
    customerPhone?: string;
    orderCode?: string;          // POS order code
    orderValue?: number;         // Order value in VND
    points: number;              // Points awarded (negative for deductions)
    packageName?: string;        // Customer's purchased package (Silver/Gold/Diamond)
    reason?: string;             // Reason for manual adjustment or revocation
    adminId?: string;            // Admin who performed the adjustment/revocation
    linkedTransactionId?: string; // Original transaction ID (for revocations)
    isRevoked?: boolean;         // Whether this transaction was revoked
    createdAt: string;           // ISO timestamp
}

// ============================================================
// ZKTeco Time Attendance
// ============================================================

/** Status of a ZKTeco device user relative to the ERP system */
export type ZkUserStatus = 'unmapped' | 'mapped' | 'ignored';

/** Mirrors a user enrolled on the ZKTeco device */
export interface ZkUserDoc {
    id: string;                      // Firestore doc ID = zk_user_id (card/employee number string)
    zk_uid: number;                  // Device's internal numeric slot (1-based)
    zk_name: string;                 // Display name as stored on the device
    zk_user_id: string;              // Employee/card number string from device
    status: ZkUserStatus;
    mapped_system_uid?: string | null;   // UID of matched UserDoc
    mapped_system_name?: string | null;  // Denormalized for display
    lastSyncedAt: string;            // ISO timestamp of last device sync
}

/**
 * Punch type as reported by ZKTeco GT100 hardware.
 * In practice, use FILO logic (first punch = in, last = out) because
 * staff frequently forget to press status buttons.
 */
export type ZkPunchType = 0 | 1 | 2 | 3 | 4 | 5;
// 0=Check-In, 1=Check-Out, 2=Break-Out, 3=Break-In, 4=OT-In, 5=OT-Out

/** A single raw punch event imported from the ZKTeco device */
export interface AttendanceLogDoc {
    id: string;               // "{zk_user_id}_{timestamp_epoch}" — natural dedup key
    zk_user_id: string;       // Card/employee number
    zk_uid: number;           // Device's internal numeric uid
    timestamp: string;        // ISO string (local time as reported by device)
    status: number;           // Device status code (unused in MVP)
    punch: ZkPunchType;       // Raw hardware punch type
    mapped_system_uid?: string | null;  // Populated at sync time from zkteco_users mapping
    syncedAt: string;         // ISO timestamp of when this record was imported
}

/** Aggregated view for a single employee on a single day (FILO resolved) */
export interface DailyAttendance {
    zk_user_id: string;
    mapped_system_uid?: string | null;
    mapped_system_name?: string | null;
    zk_name: string;
    date: string;             // YYYY-MM-DD
    checkIn?: string | null;  // ISO timestamp of first punch
    checkOut?: string | null; // ISO timestamp of last punch (only when >1 punch)
    punchCount: number;       // Total raw punch count for the day
}

