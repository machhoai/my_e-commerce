// lib/ai/intent-classifier.ts
// Phân loại câu hỏi người dùng → domain dữ liệu + date range (server-side, 0 token)

export type DataDomain =
    | 'revenue'    // Doanh thu, thanh toán
    | 'goods'      // Hàng hóa, vé, combo
    | 'member'     // Thành viên, khách hàng
    | 'orders'     // Đơn hàng chi tiết
    | 'hr'         // Nhân sự, chấm công
    | 'inventory'  // Kho, tồn kho
    | 'voucher'    // Voucher, khuyến mãi
    | 'event'      // Sự kiện, mini-game
    | 'general';   // Tổng quan

const KEYWORD_MAP: Record<DataDomain, string[]> = {
    revenue: [
        'doanh thu', 'revenue', 'tiền', 'thu nhập', 'lợi nhuận',
        'thanh toán', 'chuyển khoản', 'tiền mặt', 'cash', 'transfer',
        'hoàn trả', 'refund', 'bao nhiêu tiền', 'kiếm được',
    ],
    goods: [
        'hàng hóa', 'sản phẩm', 'vé', 'ticket', 'combo', 'gói',
        'bán chạy', 'top', 'thẻ thành viên', 'lưu niệm', 'souvenir',
        'loại vé', 'mặt hàng', 'bán được', 'số lượng bán',
    ],
    member: [
        'thành viên', 'member', 'khách hàng', 'khách', 'đăng ký mới',
        'lượt khách', 'số dư', 'xu', 'coin', 'nạp tiền', 'thẻ',
        'tích điểm', 'gift', 'tặng',
    ],
    orders: [
        'đơn hàng', 'order', 'giao dịch', 'hóa đơn', 'bill',
        'chi tiết đơn', 'mã đơn',
    ],
    hr: [
        'nhân viên', 'nhân sự', 'chấm công', 'ca làm', 'nghỉ phép',
        'lương', 'kpi', 'hiệu suất', 'attendance', 'staff',
        'đi muộn', 'đi trễ', 'di tre', 'vắng mặt', 'vang mat',
        'lịch làm', 'schedule', 'danh sách nhân viên',
        'cửa hàng', 'store', 'giới thiệu', 'referral',
        'điểm giới thiệu', 'chức vụ', 'phân công',
    ],
    inventory: [
        'kho', 'tồn kho', 'xuất kho', 'nhập kho', 'stock',
        'hết hàng', 'đặt hàng', 'purchase order', 'inventory',
        'sắp hết', 'tồn', 'warehouse',
    ],
    voucher: [
        'voucher', 'mã giảm giá', 'khuyến mãi', 'coupon',
        'chiến dịch', 'campaign',
    ],
    event: [
        'sự kiện', 'event', 'mini game', 'minigame', 'quay số',
        'gacha', 'giải thưởng', 'tham gia', 'trò chơi',
    ],
    general: [
        'tổng quan', 'overview', 'báo cáo', 'report', 'hôm nay',
        'so sánh', 'tóm tắt', 'summary', 'tình hình',
    ],
};

/**
 * Phân loại câu hỏi → danh sách domain (sắp theo điểm cao nhất).
 * Nếu không match domain cụ thể → fallback 'general'.
 */
export function classifyIntent(message: string): DataDomain[] {
    const lower = message.toLowerCase();
    const scores: [DataDomain, number][] = [];

    for (const [domain, keywords] of Object.entries(KEYWORD_MAP)) {
        let score = 0;
        for (const kw of keywords) {
            if (lower.includes(kw)) score += kw.length; // Từ dài = chính xác hơn
        }
        if (score > 0) scores.push([domain as DataDomain, score]);
    }

    // Sắp theo điểm giảm dần
    scores.sort((a, b) => b[1] - a[1]);

    // Lấy top 2 domains (tối đa), nếu không match → general
    const top = scores.slice(0, 2).map(s => s[0]);
    return top.length > 0 ? top : ['general'];
}

// ═══════════════════════════════════════════════════════════════
// DATE RANGE EXTRACTION — hỗ trợ nhiều pattern thời gian
// ═══════════════════════════════════════════════════════════════

/** Bỏ dấu tiếng Việt — cho phép match cả 'thang 5' lẫn 'tháng 5' */
function normalize(str: string): string {
    return str.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/g, 'd').replace(/Đ/g, 'D');
}

/** Helper: lấy thời gian hiện tại GMT+7 */
function nowVN(): Date {
    return new Date(Date.now() + 7 * 3600000);
}

/** Format Date → YYYY-MM-DD */
function fmt(d: Date): string {
    return d.toISOString().split('T')[0];
}

/**
 * Trích xuất khoảng thời gian từ câu hỏi.
 * Hỗ trợ: hôm qua, hôm nay, tuần này/trước, tháng X, tháng này/trước,
 *          quý X, năm nay, từ DD/MM đến DD/MM, YYYY-MM-DD, DD/MM/YYYY
 */
export function extractDateRange(message: string): { start: string; end: string } | null {
    const lower = message.toLowerCase();
    const norm = normalize(lower); // bỏ dấu để match cả 'thang 5'
    const today = nowVN();
    const year = today.getFullYear();
    const month = today.getMonth(); // 0-indexed

    // ── Relative keywords ──────────────────────────────────────
    if (norm.includes('hom nay') || norm.includes('ngay hom nay')) {
        return { start: fmt(today), end: fmt(today) };
    }

    if (norm.includes('hom qua') || norm.includes('ngay hom qua')) {
        const d = new Date(today); d.setDate(d.getDate() - 1);
        return { start: fmt(d), end: fmt(d) };
    }

    // ── Tuần ───────────────────────────────────────────────────
    if (norm.includes('tuan nay') || norm.includes('tuan hien tai')) {
        const d = new Date(today);
        const dayOfWeek = d.getDay() || 7; // Monday = 1
        d.setDate(d.getDate() - dayOfWeek + 1); // Monday this week
        return { start: fmt(d), end: fmt(today) };
    }

    if (norm.includes('tuan truoc') || norm.includes('tuan qua')) {
        const d = new Date(today);
        const dayOfWeek = d.getDay() || 7;
        d.setDate(d.getDate() - dayOfWeek - 6); // Monday last week
        const end = new Date(d); end.setDate(end.getDate() + 6);
        return { start: fmt(d), end: fmt(end) };
    }

    // ── Tháng cụ thể: "tháng 5", "thang 05", "t5" ─────────────
    const monthMatch = norm.match(/thang\s*(\d{1,2})/);
    if (monthMatch) {
        const m = parseInt(monthMatch[1], 10);
        if (m >= 1 && m <= 12) {
            // Nếu tháng > tháng hiện tại → năm trước
            const y = m > month + 1 ? year - 1 : year;
            const start = new Date(Date.UTC(y, m - 1, 1));
            // Nếu tháng = tháng hiện tại → end = today, ngược lại = cuối tháng
            const isCurrentMonth = (m === month + 1 && y === year);
            const end = isCurrentMonth
                ? today
                : new Date(Date.UTC(y, m, 0)); // ngày cuối tháng
            return { start: fmt(start), end: fmt(end) };
        }
    }

    // ── "tháng này" / "tháng hiện tại" ─────────────────────────
    if (norm.includes('thang nay') || norm.includes('thang hien tai')) {
        const start = new Date(Date.UTC(year, month, 1));
        return { start: fmt(start), end: fmt(today) };
    }

    // ── "tháng trước" / "tháng vừa rồi" ───────────────────────
    if (norm.includes('thang truoc') || norm.includes('thang vua roi') || norm.includes('thang vua qua')) {
        const start = new Date(Date.UTC(year, month - 1, 1));
        const end = new Date(Date.UTC(year, month, 0));
        return { start: fmt(start), end: fmt(end) };
    }

    // ── Quý: "quý 1", "quy 2", "q1", "q2" ────────────────────
    const qMatch = norm.match(/(?:quy|q)\s*(\d)/);
    if (qMatch) {
        const q = parseInt(qMatch[1], 10);
        if (q >= 1 && q <= 4) {
            const startMonth = (q - 1) * 3;
            const start = new Date(Date.UTC(year, startMonth, 1));
            const endMonth = startMonth + 2;
            // Nếu quý chưa kết thúc → end = today
            const lastDay = new Date(Date.UTC(year, endMonth + 1, 0));
            const end = lastDay > today ? today : lastDay;
            return { start: fmt(start), end: fmt(end) };
        }
    }

    // ── "năm nay" / "năm hiện tại" ─────────────────────────────
    if (norm.includes('nam nay') || norm.includes('nam hien tai')) {
        const start = new Date(Date.UTC(year, 0, 1));
        return { start: fmt(start), end: fmt(today) };
    }

    // ── "năm trước" / "năm ngoái" ──────────────────────────────
    if (norm.includes('nam truoc') || norm.includes('nam ngoai')) {
        const start = new Date(Date.UTC(year - 1, 0, 1));
        const end = new Date(Date.UTC(year - 1, 11, 31));
        return { start: fmt(start), end: fmt(end) };
    }

    // ── Khoảng: "từ 1/5 đến 10/5", "tu 01/05 den 13/05" ───────
    const rangeMatch = norm.match(/tu\s*(\d{1,2})[/.](\d{1,2})(?:[/.](\d{4}))?\s*(?:den|toi|-)\s*(\d{1,2})[/.](\d{1,2})(?:[/.](\d{4}))?/);
    if (rangeMatch) {
        const [, d1, m1, y1, d2, m2, y2] = rangeMatch;
        const startY = y1 ? parseInt(y1) : year;
        const endY = y2 ? parseInt(y2) : year;
        const start = `${startY}-${m1.padStart(2, '0')}-${d1.padStart(2, '0')}`;
        const end = `${endY}-${m2.padStart(2, '0')}-${d2.padStart(2, '0')}`;
        return { start, end };
    }

    // ── "X ngày gần đây" / "X ngay qua" ────────────────────────
    const daysAgoMatch = norm.match(/(\d+)\s*ngay\s*(?:gan day|qua|truoc)/);
    if (daysAgoMatch) {
        const n = parseInt(daysAgoMatch[1], 10);
        const start = new Date(today);
        start.setDate(start.getDate() - n + 1);
        return { start: fmt(start), end: fmt(today) };
    }

    // ── Match ISO: YYYY-MM-DD ──────────────────────────────────
    const isoMatch = message.match(/(\d{4}-\d{2}-\d{2})/);
    if (isoMatch) return { start: isoMatch[1], end: isoMatch[1] };

    // ── Match VN: DD/MM/YYYY ───────────────────────────────────
    const vnMatch = message.match(/(\d{1,2})\/(\d{1,2})\/(\d{4})/);
    if (vnMatch) {
        const d = `${vnMatch[3]}-${vnMatch[2].padStart(2, '0')}-${vnMatch[1].padStart(2, '0')}`;
        return { start: d, end: d };
    }

    return null; // Default to today (caller handles)
}
