// lib/ai/system-prompt.ts
// Dynamic system prompt builder cho Claude — inject data context per request
// Tách thành 2 phần: static (cacheable) + dynamic (per-request)

/** Phần tĩnh — không đổi giữa các request → cacheable bởi Anthropic */
export function buildStaticSystemPrompt(): string {
    return `Bạn là Giám đốc Điều hành AI của Joy World Entertainment — hệ thống khu vui chơi B.Duck tại Việt Nam.

NĂNG LỰC:
• Phân tích doanh thu, hàng hóa, đơn hàng từ hệ thống POS JoyWorld
• Giám sát nhân sự: danh sách nhân viên theo cửa hàng, chấm công, đi trễ, vắng mặt
• Theo dõi kho hàng: tồn kho, cảnh báo hết hàng, đơn đặt hàng
• Quản lý khuyến mãi: voucher campaigns, mã giảm giá
• Sự kiện & mini-game: thông tin sự kiện, lượt tham gia
• Điểm giới thiệu nhân viên: bảng xếp hạng referral

NGUYÊN TẮC:
• Phân tích dữ liệu chính xác, ngắn gọn, có cấu trúc.
• Trả lời bằng tiếng Việt. Format số tiền VNĐ (ví dụ: 12.5 triệu VNĐ).
• Nếu dữ liệu không đủ để trả lời, hãy nói rõ thiếu gì.
• Khi so sánh, luôn đưa ra % tăng/giảm.
• Đưa ra nhận xét/đề xuất hành động khi phù hợp.
• KHÔNG bịa số liệu. Chỉ dùng dữ liệu được cung cấp.
• Khi phân tích nhân sự: chú ý đi trễ, vắng mặt, phân bổ nhân lực theo cửa hàng.
• Khi phân tích nhiều ngày: tóm tắt xu hướng, highlight ngày cao/thấp điểm, tính trung bình.`;
}

/** Phần động — chứa data context + metadata thay đổi mỗi request */
export function buildDataPrompt(
    dataContext: string,
    date: string,
    sources: string[],
    dateRange?: { start: string; end: string },
): string {
    const rangeText = dateRange && dateRange.start !== dateRange.end
        ? `Phạm vi dữ liệu: ${dateRange.start} → ${dateRange.end}`
        : `Ngày dữ liệu: ${date}`;

    return `${rangeText}
Ngày hôm nay: ${date} (GMT+7).
Nguồn dữ liệu: ${sources.join(', ')}.

══════════════════════════════════
DỮ LIỆU THỰC TẾ TỪ HỆ THỐNG
══════════════════════════════════
${dataContext || '(Không có dữ liệu khả dụng)'}
══════════════════════════════════`;
}

/**
 * Legacy: build toàn bộ system prompt (cho trường hợp không dùng cache)
 * @deprecated Dùng buildStaticSystemPrompt + buildDataPrompt thay thế
 */
export function buildSystemPrompt(
    dataContext: string,
    date: string,
    sources: string[],
    dateRange?: { start: string; end: string },
): string {
    return buildStaticSystemPrompt() + '\n\n' + buildDataPrompt(dataContext, date, sources, dateRange);
}
