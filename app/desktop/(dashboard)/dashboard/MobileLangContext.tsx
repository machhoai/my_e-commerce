'use client';

import { createContext, useContext, useState, ReactNode } from 'react';

// ─────────────────────────────────────────────────────────────────────────────
// Supported languages
// ─────────────────────────────────────────────────────────────────────────────
export type MobileLang = 'vi' | 'zh';

// ─────────────────────────────────────────────────────────────────────────────
// Translation dictionaries
// ─────────────────────────────────────────────────────────────────────────────
const dictionaries: Record<MobileLang, Record<string, string>> = {
    vi: {
        // Header
        greeting: 'Xin chào,',
        defaultUser: 'Người dùng',

        // Role labels
        role_super_admin: 'Siêu Quản Trị',
        role_admin: 'Quản Trị Viên',
        role_store_manager: 'Cửa Hàng Trưởng',
        role_manager: 'Quản Lý',
        role_employee: 'Nhân Viên',
        role_office: 'Văn Phòng',

        // Quick access section
        quickAccess: 'Truy cập nhanh',

        // Quick access items
        qa_mySchedule: 'Lịch của tôi',
        qa_registerShift: 'Danh sách đăng ký',
        qa_myKpi: 'KPI của tôi',
        qa_handover: 'Bàn giao hàng',
        qa_scheduling: 'Lịch làm',
        qa_hr: 'Nhân sự',
        qa_attendance: 'Chấm công',
        qa_revenue: 'Doanh thu',
        qa_all: 'Tất cả',

        // All-nav groups
        group_employee: 'Nhân viên',
        group_operation: 'Vận hành',
        group_hr: 'Nhân sự',
        group_storeInventory: 'Kho cửa hàng',
        group_revenue: 'Doanh thu',
        group_marketing: 'Marketing',
        group_admin: 'Quản trị',
        group_personal: 'Cá nhân',

        // Nav items
        nav_mySchedule: 'Lịch của tôi',
        nav_registerShift: 'Đăng ký ca',
        nav_myKpi: 'KPI của tôi',
        nav_referralPoints: 'Điểm giới thiệu',
        nav_handover: 'Bàn giao hàng',
        nav_usageReport: 'Tiêu hao hàng',
        nav_scheduling: 'Lịch làm việc',
        nav_shiftRegister: 'Đăng ký ca',
        nav_shiftBuilder: 'Xây dựng lịch',
        nav_shiftHistory: 'Lịch sử ca',
        nav_staffList: 'Danh sách NV',
        nav_kpiStats: 'KPI Thống kê',
        nav_kpiScoring: 'KPI Chấm điểm',
        nav_kpiTemplates: 'Mẫu KPI',
        nav_referralHistory: 'Lịch sử tích điểm',
        nav_attendanceCheck: 'Chấm công',
        nav_orderGoods: 'Đặt hàng',
        nav_receiveGoods: 'Nhập hàng',
        nav_transferGoods: 'Chuyển kho',
        nav_stockLedger: 'Sổ kho',
        nav_counters: 'Quầy hàng',
        nav_handoverInv: 'Bàn giao',
        nav_usage: 'Tiêu hao',
        nav_dispatchGoods: 'Xuất kho',
        nav_revenueReport: 'Báo cáo',
        nav_trackingLinks: 'Tracking Links',
        nav_voucherMgmt: 'Quản lý Voucher',
        nav_eventMgmt: 'Quản lý Sự kiện',
        nav_dailyReport: 'Báo cáo ngày',
        nav_profile: 'Hồ sơ',
        nav_notifications: 'Thông báo',
        nav_storeSettings: 'Cài đặt CH',

        // AllNav sheet title
        allFunctions: 'Tất cả chức năng',

        // ── PersonalScheduleView ──────────────────────────────────────
        personalScheduleTitle: 'Ca làm việc của bạn',
        today: 'Hôm nay',
        dayOff: 'Nghỉ hôm nay',
        monthlyShifts: 'Ca đã làm',
        kpiAvg: 'KPI TB',
        registeredNextWeek: 'Đã ĐK tuần tới',
        nextShift: 'Ca tiếp theo',

        // ── OperationTab ──────────────────────────────────────────────
        metric_staff: 'Nhân sự',
        metric_kpiAvg: 'KPI TB/tháng',
        metric_registered: 'Đã đăng ký',
        storeSchedule: 'Lịch làm việc cửa hàng',
        thisWeek: 'Tuần này',
        current: 'Hiện tại',
        nextWeekLabel: 'Tuần sau',
        noStore: 'Chọn cửa hàng để xem lịch',
        noShiftData: 'Chưa có dữ liệu ca',
        noShiftConfig: 'Chưa cấu hình ca làm việc',
        legend_cth: 'CTH = Cửa hàng trưởng',
        legend_ql: 'QL = Quản lý',
        legend_nv: 'NV = Nhân viên',
        shiftColHeader: 'Ca',
        staffRegCalendar: 'Lịch đăng ký ca nhân viên',
        noData: 'Không có dữ liệu',
        noStaff: 'Chưa có NV',
        noPerson: 'Chưa có',
        personCount: 'người',

        // ── RevenueTab ────────────────────────────────────────────────
        rev_day: 'Ngày',
        rev_month: 'Tháng',
        rev_custom: 'Tùy chọn',
        rev_realRevenue: 'Thực thu',
        rev_cash: 'Tiền mặt',
        rev_transfer: 'Chuyển khoản',
        rev_coins: 'Xu bán',
        rev_coinPrice: 'Giá',
        rev_peakDay: 'Ngày cao nhất',
        rev_cancelled: 'Đã hủy',
        rev_cancelledSub: 'Giao dịch hủy',
        rev_noCancelled: 'Không có',
        rev_dailySummary: 'Tổng kết ngày',
        rev_totalBill: 'Tổng hoá đơn',
        rev_refunded: 'Đã hủy',
        rev_revenueByDay: 'Doanh thu theo ngày',
        rev_paymentMethod: 'Phương thức thanh toán',
        rev_topProducts: 'Top sản phẩm',
        rev_qty: 'SL',
        rev_noData: 'Không có dữ liệu',
        rev_syncPrompt: 'Nhấn sync để tải từ Joyworld',
        rev_syncing: 'Đang tải...',
        rev_syncNow: 'Đồng bộ ngay',
        rev_updatedAt: 'Cập nhật',
        rev_errDefault: 'Đã xảy ra lỗi.',
        rev_errConnect: 'Không thể kết nối.',
        rev_errSync: 'Đồng bộ thất bại.',
        rev_billion: 'tỷ',

        // ── InventoryTab ──────────────────────────────────────────────
        inv_noStore: 'Chưa có cửa hàng được chọn',
        inv_sku: 'SKU theo dõi',
        inv_needRestock: 'Cần bổ sung',
        inv_pendingOrders: 'Đơn đang xử lý',
        inv_lowStockTitle: 'Hàng cần nhập bổ sung',
        inv_products: 'sản phẩm',
        inv_stock: 'Tồn',
        inv_min: 'Min',
        inv_outOfStock: 'Hết hàng',
        inv_lowStock: 'Sắp hết',
        inv_pendingOrdersTitle: 'Đơn đặt hàng đang xử lý',
        inv_orders: 'đơn',
        inv_items: 'sản phẩm',
        inv_units: 'đơn vị',
        inv_allGood: 'Kho đang ổn định',
        inv_allGoodSub: 'SKU, không có hàng cần nhập bổ sung',
        inv_retry: 'Thử lại',
        inv_viewAll: 'Xem toàn bộ kho hàng',
        inv_errLoad: 'Không thể tải dữ liệu kho',
        status_pendingOffice: 'Chờ VP duyệt',
        status_approvedOffice: 'VP đã duyệt',
        status_inTransit: 'Đang giao',
        status_completed: 'Hoàn tất',
        status_rejected: 'Từ chối',
        status_canceled: 'Đã hủy',
        status_pending: 'Chờ duyệt',
        status_dispatched: 'Đã xuất kho',

        // ── ManagementView tabs ───────────────────────────────────────
        tab_operation: 'Vận hành',
        tab_revenue: 'Doanh thu',
        tab_inventory: 'Kho bãi',

        // ── Store selector ────────────────────────────────────────────
        allStores: 'Tất cả cửa hàng',
        selectStore: 'Chọn cửa hàng để xem',

        // ── Notification banner ───────────────────────────────────────
        enableNotif: 'Bật thông báo',
        enableNotifDesc: 'Nhận thông báo lịch làm, đơn hàng và tin quan trọng ngay trên điện thoại.',
        allowNotif: 'Cho phép thông báo',
        later: 'Để sau',
    },

    zh: {
        // Header
        greeting: '您好，',
        defaultUser: '用户',

        // Role labels
        role_super_admin: '超级管理员',
        role_admin: '管理员',
        role_store_manager: '门店店长',
        role_manager: '经理',
        role_employee: '员工',
        role_office: '文职',

        // Quick access section
        quickAccess: '快速访问',

        // Quick access items
        qa_mySchedule: '我的班表',
        qa_registerShift: '申请排班',
        qa_myKpi: '我的KPI',
        qa_handover: '库存交接',
        qa_scheduling: '班次表',
        qa_hr: '人力资源',
        qa_attendance: '考勤',
        qa_revenue: '营业额',
        qa_all: '全部',

        // All-nav groups
        group_employee: '员工',
        group_operation: '运营',
        group_hr: '人力资源',
        group_storeInventory: '门店仓库',
        group_revenue: '营业额',
        group_marketing: '市场推广',
        group_admin: '管理',
        group_personal: '个人',

        // Nav items
        nav_mySchedule: '我的班表',
        nav_registerShift: '申请排班',
        nav_myKpi: '我的KPI',
        nav_referralPoints: '推荐积分',
        nav_handover: '库存交接',
        nav_usageReport: '消耗报告',
        nav_scheduling: '班次安排',
        nav_shiftRegister: '申请排班',
        nav_shiftBuilder: '排班制作',
        nav_shiftHistory: '班次历史',
        nav_staffList: '员工列表',
        nav_kpiStats: 'KPI统计',
        nav_kpiScoring: 'KPI评分',
        nav_kpiTemplates: 'KPI模板',
        nav_referralHistory: '积分历史',
        nav_attendanceCheck: '考勤',
        nav_orderGoods: '采购订单',
        nav_receiveGoods: '入库',
        nav_transferGoods: '调拨',
        nav_stockLedger: '库存台账',
        nav_counters: '柜台',
        nav_handoverInv: '库存交接',
        nav_usage: '消耗',
        nav_dispatchGoods: '出库',
        nav_revenueReport: '报告',
        nav_trackingLinks: '追踪链接',
        nav_voucherMgmt: '优惠券管理',
        nav_eventMgmt: '活动管理',
        nav_dailyReport: '日报',
        nav_profile: '个人资料',
        nav_notifications: '通知',
        nav_storeSettings: '门店设置',

        // AllNav sheet title
        allFunctions: '全部功能',

        // ── PersonalScheduleView ──────────────────────────────────────
        personalScheduleTitle: '您的班次安排',
        today: '今天',
        dayOff: '今天休息',
        monthlyShifts: '已上班次',
        kpiAvg: 'KPI均值',
        registeredNextWeek: '下周已申请',
        nextShift: '下一班次',

        // ── OperationTab ──────────────────────────────────────────────
        metric_staff: '员工',
        metric_kpiAvg: '月均KPI',
        metric_registered: '已申请',
        storeSchedule: '门店班次安排',
        thisWeek: '本周',
        current: '当前',
        nextWeekLabel: '下周',
        noStore: '请选择门店以查看班次',
        noShiftData: '暂无班次数据',
        noShiftConfig: '尚未配置班次',
        legend_cth: 'CTH = 店长',
        legend_ql: 'QL = 经理',
        legend_nv: 'NV = 员工',
        shiftColHeader: '班次',
        staffRegCalendar: '员工排班申请日历',
        noData: '暂无数据',
        noStaff: '暂无员工',
        noPerson: '暂无',
        personCount: '人',

        // ── RevenueTab ────────────────────────────────────────────────
        rev_day: '按日',
        rev_month: '按月',
        rev_custom: '自定义',
        rev_realRevenue: '实收',
        rev_cash: '现金',
        rev_transfer: '转账',
        rev_coins: '金币销售',
        rev_coinPrice: '单价',
        rev_peakDay: '最高单日',
        rev_cancelled: '已退款',
        rev_cancelledSub: '退款交易',
        rev_noCancelled: '无',
        rev_dailySummary: '当日汇总',
        rev_totalBill: '总账单',
        rev_refunded: '已退款',
        rev_revenueByDay: '每日营业额',
        rev_paymentMethod: '支付方式',
        rev_topProducts: '热销商品',
        rev_qty: '数量',
        rev_noData: '暂无数据',
        rev_syncPrompt: '点击同步从 Joyworld 加载',
        rev_syncing: '加载中...',
        rev_syncNow: '立即同步',
        rev_updatedAt: '更新于',
        rev_errDefault: '发生错误。',
        rev_errConnect: '无法连接。',
        rev_errSync: '同步失败。',
        rev_billion: '亿',

        // ── InventoryTab ──────────────────────────────────────────────
        inv_noStore: '尚未选择门店',
        inv_sku: '监控SKU',
        inv_needRestock: '需补货',
        inv_pendingOrders: '待处理订单',
        inv_lowStockTitle: '需补货商品',
        inv_products: '件商品',
        inv_stock: '库存',
        inv_min: '最低',
        inv_outOfStock: '已断货',
        inv_lowStock: '即将售罄',
        inv_pendingOrdersTitle: '待处理采购单',
        inv_orders: '张订单',
        inv_items: '件商品',
        inv_units: '件',
        inv_allGood: '库存状态正常',
        inv_allGoodSub: '个SKU，无需补货',
        inv_retry: '重试',
        inv_viewAll: '查看全部库存',
        inv_errLoad: '无法加载库存数据',
        status_pendingOffice: '待办公室审批',
        status_approvedOffice: '办公室已批准',
        status_inTransit: '配送中',
        status_completed: '已完成',
        status_rejected: '已拒绝',
        status_canceled: '已取消',
        status_pending: '待审批',
        status_dispatched: '已出库',

        // ── ManagementView tabs ───────────────────────────────────────
        tab_operation: '运营',
        tab_revenue: '营业额',
        tab_inventory: '库存',

        // ── Store selector ────────────────────────────────────────────
        allStores: '全部门店',
        selectStore: '选择门店查看',

        // ── Notification banner ───────────────────────────────────────
        enableNotif: '开启通知',
        enableNotifDesc: '在手机上即时接收班次、订单和重要消息。',
        allowNotif: '允许通知',
        later: '稍后再说',
    },
};

// ─────────────────────────────────────────────────────────────────────────────
// Context
// ─────────────────────────────────────────────────────────────────────────────
interface MobileLangContextValue {
    lang: MobileLang;
    setLang: (lang: MobileLang) => void;
    t: (key: string) => string;
}

const MobileLangContext = createContext<MobileLangContextValue>({
    lang: 'vi',
    setLang: () => { },
    t: (key) => key,
});

// ─────────────────────────────────────────────────────────────────────────────
// Provider
// ─────────────────────────────────────────────────────────────────────────────
export function MobileLangProvider({ children }: { children: ReactNode }) {
    const [lang, setLang] = useState<MobileLang>(() => {
        if (typeof window !== 'undefined') {
            const stored = localStorage.getItem('mobile_lang') as MobileLang | null;
            if (stored === 'vi' || stored === 'zh') return stored;
        }
        return 'vi';
    });

    const handleSetLang = (next: MobileLang) => {
        setLang(next);
        if (typeof window !== 'undefined') {
            localStorage.setItem('mobile_lang', next);
        }
    };

    const t = (key: string): string =>
        dictionaries[lang][key] ?? dictionaries['vi'][key] ?? key;

    return (
        <MobileLangContext.Provider value={{ lang, setLang: handleSetLang, t }}>
            {children}
        </MobileLangContext.Provider>
    );
}

// ─────────────────────────────────────────────────────────────────────────────
// Hook
// ─────────────────────────────────────────────────────────────────────────────
export function useMobileLang() {
    return useContext(MobileLangContext);
}
