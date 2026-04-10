import { NextRequest, NextResponse } from 'next/server';
import { getAdminAuth, getAdminDb } from '@/lib/firebase-admin';
import nodemailer from 'nodemailer';
import QRCode from 'qrcode';
import type { VoucherCode, VoucherCampaign, TicketTemplateConfig, VoucherRewardType } from '@/types';

// ── Email transporter (Gmail SMTP) ──────────────────────────────
function getTransporter() {
    return nodemailer.createTransport({
        service: 'gmail',
        auth: {
            user: process.env.GMAIL_USER,
            pass: process.env.GMAIL_APP_PASSWORD,
        },
    });
}

// ── Reward label helper ──────────────────────────────────────────
const REWARD_LABELS: Record<VoucherRewardType, string> = {
    discount_percent: 'Giảm %',
    discount_fixed: 'Giảm tiền',
    free_ticket: 'Vé miễn phí',
    free_item: 'Tặng sản phẩm',
};

function formatRewardValue(type: VoucherRewardType, value: number): string {
    if (type === 'discount_percent') return `Giảm ${value}%`;
    if (type === 'discount_fixed') return `Giảm ${value.toLocaleString('vi-VN')}đ`;
    if (type === 'free_ticket') return 'Vé miễn phí';
    return `Tặng sản phẩm (${value})`;
}

// ── HTML email template ─────────────────────────────────────────
function buildEmailHtml(
    code: VoucherCode,
    campaign: VoucherCampaign,
    qrDataUrl: string,
    tpl: TicketTemplateConfig,
): string {
    const rewardText = formatRewardValue(code.rewardType, code.rewardValue);
    const expiryFormatted = code.validTo
        ? new Date(code.validTo).toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' })
        : '';

    return `<!DOCTYPE html>
<html lang="vi">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Voucher ${code.id}</title>
</head>
<body style="margin:0;padding:0;background:#f1f5f9;font-family:'Segoe UI',Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f1f5f9;padding:32px 0;">
    <tr>
      <td align="center">
        <!-- Wrapper -->
        <table width="560" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08);">
          <!-- Header band -->
          <tr>
            <td style="background:${tpl.bgColor};padding:28px 32px;">
              ${tpl.logoUrl ? `<img src="${tpl.logoUrl}" alt="Logo" style="height:40px;margin-bottom:12px;display:block;" />` : ''}
              <h1 style="margin:0;color:#ffffff;font-size:22px;font-weight:700;letter-spacing:-0.3px;">${tpl.title}</h1>
              ${campaign.description && tpl.showDescription ? `<p style="margin:6px 0 0;color:rgba(255,255,255,0.75);font-size:13px;">${campaign.description}</p>` : ''}
            </td>
          </tr>
          <!-- Ticket body -->
          <tr>
            <td style="padding:28px 32px;">
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <!-- Left: info -->
                  <td style="vertical-align:top;padding-right:24px;">
                    ${tpl.showRewardValue ? `
                    <div style="background:${tpl.accentColor}18;border:2px solid ${tpl.accentColor};border-radius:10px;padding:12px 16px;margin-bottom:16px;display:inline-block;">
                      <span style="color:${tpl.accentColor};font-size:18px;font-weight:800;">${rewardText}</span>
                    </div>` : ''}
                    <p style="margin:0 0 6px;font-size:11px;font-weight:600;color:#94a3b8;text-transform:uppercase;letter-spacing:0.5px;">Mã voucher</p>
                    <p style="margin:0 0 16px;font-size:22px;font-weight:800;color:#1e293b;letter-spacing:2px;font-family:monospace;">${code.id}</p>
                    ${tpl.showExpiry && expiryFormatted ? `
                    <p style="margin:0 0 4px;font-size:11px;font-weight:600;color:#94a3b8;text-transform:uppercase;letter-spacing:0.5px;">Hết hạn</p>
                    <p style="margin:0;font-size:13px;font-weight:600;color:#475569;">${expiryFormatted}</p>` : ''}
                  </td>
                  <!-- Right: QR -->
                  <td style="vertical-align:top;text-align:center;width:${tpl.qrSize === 'sm' ? 110 : tpl.qrSize === 'md' ? 150 : 190}px;">
                    <img src="${qrDataUrl}" alt="QR Code" style="width:${tpl.qrSize === 'sm' ? 100 : tpl.qrSize === 'md' ? 140 : 180}px;height:${tpl.qrSize === 'sm' ? 100 : tpl.qrSize === 'md' ? 140 : 180}px;border-radius:8px;" />
                    <p style="margin:6px 0 0;font-size:10px;color:#94a3b8;">Quét để sử dụng</p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <!-- Dashed divider -->
          <tr>
            <td style="padding:0 32px;">
              <hr style="border:none;border-top:2px dashed #e2e8f0;margin:0;" />
            </td>
          </tr>
          <!-- Footer -->
          <tr>
            <td style="padding:16px 32px 24px;">
              <p style="margin:0;font-size:11px;color:#94a3b8;text-align:center;">
                Voucher này được gửi tự động. Vui lòng không chia sẻ mã với người khác.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

// ═══════════════════════════════════════════════════════════════
// POST /api/vouchers/send-email
// Body: { voucherCodeIds, campaignId, singleEmail?, emails?, templateConfig }
// ═══════════════════════════════════════════════════════════════
export async function POST(req: NextRequest) {
    // ── Auth ──────────────────────────────────────────────────
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    try {
        await getAdminAuth().verifyIdToken(authHeader.slice(7));
    } catch {
        return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
    }

    // ── Parse body ────────────────────────────────────────────
    let body: {
        voucherCodeIds: string[];
        campaignId: string;
        singleEmail?: string;
        emails?: string[];
        templateConfig: TicketTemplateConfig;
    };
    try {
        body = await req.json();
    } catch {
        return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
    }

    const { voucherCodeIds, campaignId, singleEmail, emails, templateConfig } = body;

    if (!Array.isArray(voucherCodeIds) || voucherCodeIds.length === 0) {
        return NextResponse.json({ error: 'Cần ít nhất 1 mã voucher' }, { status: 400 });
    }
    if (!singleEmail && (!Array.isArray(emails) || emails.length !== voucherCodeIds.length)) {
        return NextResponse.json({ error: 'Số lượng email không khớp với số mã' }, { status: 400 });
    }

    const db = getAdminDb();

    // ── Fetch campaign ────────────────────────────────────────
    const campSnap = await db.collection('voucher_campaigns').doc(campaignId).get();
    if (!campSnap.exists) {
        return NextResponse.json({ error: 'Chiến dịch không tồn tại' }, { status: 404 });
    }
    const campaign = campSnap.data() as VoucherCampaign;

    // ── Fetch voucher codes ────────────────────────────────────
    const codeRefs = voucherCodeIds.map(id => db.collection('voucher_codes').doc(id));
    const codeSnaps = await db.getAll(...codeRefs);
    const validCodes: { code: VoucherCode; email: string }[] = [];

    codeSnaps.forEach((snap, i) => {
        if (!snap.exists) return;
        const code = snap.data() as VoucherCode;
        const recipientEmail = singleEmail ?? emails![i];
        if (recipientEmail) validCodes.push({ code: { ...code, id: snap.id }, email: recipientEmail });
    });

    if (validCodes.length === 0) {
        return NextResponse.json({ error: 'Không tìm thấy mã voucher hợp lệ' }, { status: 404 });
    }

    const transporter = getTransporter();
    const now = new Date().toISOString();
    const results: { id: string; email: string; success: boolean; error?: string }[] = [];

    // ── Send in parallel batches of 10 ────────────────────────
    const BATCH = 10;
    for (let i = 0; i < validCodes.length; i += BATCH) {
        const chunk = validCodes.slice(i, i + BATCH);
        await Promise.allSettled(
            chunk.map(async ({ code, email }) => {
                try {
                    // Generate QR
                    const qrDataUrl = await QRCode.toDataURL(code.id, {
                        width: 300,
                        margin: 2,
                        color: { dark: templateConfig.bgColor, light: '#FFFFFF' },
                    });

                    const html = buildEmailHtml(code, campaign, qrDataUrl, templateConfig);
                    const subject = `Voucher ${formatRewardValue(code.rewardType, code.rewardValue)} — ${templateConfig.title}`;

                    await transporter.sendMail({
                        from: `"${templateConfig.title}" <${process.env.GMAIL_USER}>`,
                        to: email,
                        subject,
                        html,
                    });

                    results.push({ id: code.id, email, success: true });
                } catch (err) {
                    results.push({ id: code.id, email, success: false, error: err instanceof Error ? err.message : 'Lỗi không xác định' });
                }
            }),
        );
    }

    // ── Batch-update Firestore for successful sends ───────────
    const successIds = results.filter(r => r.success);
    if (successIds.length > 0) {
        const batch = db.batch();
        for (const { id, email } of successIds) {
            batch.update(db.collection('voucher_codes').doc(id), {
                emailedAt: now,
                emailedTo: email,
            });
        }
        await batch.commit();
    }

    const sent = results.filter(r => r.success).length;
    const failed = results.filter(r => !r.success).length;
    const errors = results.filter(r => !r.success).map(r => `${r.id}: ${r.error}`);

    return NextResponse.json({ sent, failed, errors, results });
}
