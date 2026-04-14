import { NextRequest, NextResponse } from 'next/server';
import { getAdminAuth, getAdminDb } from '@/lib/firebase-admin';
import nodemailer from 'nodemailer';
import QRCode from 'qrcode';
import type { VoucherCode, VoucherCampaign, TicketTemplateConfig, VoucherRewardType } from '@/types';

// ── Types ─────────────────────────────────────────────────────────
interface SendResult {
    id: string;
    email: string;
    success: boolean;
    error?: string;
}

interface EmailAttachment {
    filename: string;
    content: Buffer;
    cid: string;
    contentType: string;
}

interface CodeWithQr {
    code: VoucherCode;
    qrCid: string;
    qrBuffer: Buffer;
}

// ── Email transporter ─────────────────────────────────────────────
function getTransporter(): nodemailer.Transporter {
    return nodemailer.createTransport({
        service: 'gmail',
        auth: { user: process.env.GMAIL_USER, pass: process.env.GMAIL_APP_PASSWORD },
    });
}

// ── Helpers ───────────────────────────────────────────────────────
function formatRewardValue(type: VoucherRewardType, value: number): string {
    if (type === 'discount_percent') return `Giam ${value}%`;
    if (type === 'discount_fixed') return `Giam ${value.toLocaleString('vi-VN')}d`;
    if (type === 'free_ticket') return 'Ve mien phi';
    return `Tang san pham (${value})`;
}

// Matches formatReward() in TicketDesigner.tsx
function formatRewardShort(type: VoucherRewardType, value: number): string {
    if (type === 'discount_percent') return `&ndash;${value}%`;
    if (type === 'discount_fixed') return `&ndash;${value.toLocaleString('vi-VN')}d`;
    if (type === 'free_ticket') return 'Ve mien phi';
    return 'Tang san pham';
}

function formatDate(dateStr: string | undefined): string {
    if (!dateStr) return '';
    return new Date(dateStr).toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

function esc(str: string): string {
    return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function safeCid(codeId: string): string {
    return `qr${codeId.replace(/[^a-zA-Z0-9]/g, '')}@voucher`;
}

// ── Fetch logo → CID attachment ───────────────────────────────────
async function fetchLogoAttachment(logoUrl: string): Promise<EmailAttachment | null> {
    try {
        if (logoUrl.startsWith('data:')) {
            const match = logoUrl.match(/^data:([^;]+);base64,(.+)$/);
            if (!match) return null;
            const contentType = match[1];
            const ext = contentType.split('/')[1] ?? 'png';
            return { filename: `logo.${ext}`, content: Buffer.from(match[2], 'base64'), cid: 'logo@voucher', contentType };
        }
        const res = await fetch(logoUrl, { signal: AbortSignal.timeout(5000) });
        if (!res.ok) return null;
        const contentType = res.headers.get('content-type') ?? 'image/png';
        const ext = contentType.split('/')[1]?.split(';')[0] ?? 'png';
        return { filename: `logo.${ext}`, content: Buffer.from(await res.arrayBuffer()), cid: 'logo@voucher', contentType };
    } catch {
        return null;
    }
}

// ═══════════════════════════════════════════════════════════════
// buildTicketHtml
// Reproduces TicketPreview component pixel-for-pixel as email HTML.
// ─ Header band (gradient, decorative blobs, logo, badge, title, desc)
// ─ Perforation row (notches + dashed line)
// ─ Body (reward badge | code | expiry) + QR
// ─ Footer (subtle gradient, privacy text)
// ═══════════════════════════════════════════════════════════════
function buildTicketHtml(
    code: VoucherCode,
    tpl: TicketTemplateConfig,
    campaign: VoucherCampaign,
    hasLogo: boolean,
    index: number,
    total: number,
): string {
    // QR sizes: sm=88, md=120, lg=160
    const qrPx = tpl.qrSize === 'sm' ? 88 : tpl.qrSize === 'md' ? 120 : 160;
    const qid = safeCid(code.id);
    const expiry = formatDate(code.validTo);
    const rewardShort = formatRewardShort(code.rewardType, code.rewardValue);

    // ─── 1. Multi-Label: Thêm dấu, Bold, màu ấm hơn ───
    const multiLabel = total > 1
        ? `<tr>
             <td align="center" style="padding:${index === 0 ? '0' : '24px'} 0 12px; font-size: 11px; font-weight: 800; color: #5C3317; text-transform: uppercase; letter-spacing: 2px;">
               VÉ SỐ ${index + 1} / ${total}
             </td>
           </tr>`
        : (index === 0 ? '' : '<tr><td style="height:24px;"></td></tr>');

    // ─── 2. Logo Row (Nếu có) ───
    const logoRow = hasLogo
        ? `<tr>
             <td style="padding-bottom: 16px;">
               <img src="cid:logo@voucher" alt="Logo" height="40"
                 style="display: block; max-height: 40px; max-width: 160px; object-fit: contain;" />
             </td>
           </tr>`
        : '';

    // ─── 3. Description: Sửa lại opacity và padding ───
    const descRow = tpl.showDescription && campaign.description
        ? `<tr>
             <td style="padding-top: 10px; font-size: 13px; color: rgba(255,255,255,0.75); line-height: 1.6;">
               ${esc(campaign.description)}
             </td>
           </tr>`
        : '';

    // ─── 4. Reward Badge: Tăng kích thước, đậm, shadow nổi khối ───
    const rewardBadge = tpl.showRewardValue
        ? `<tr>
             <td style="padding-bottom: 20px;">
               <div style="display: inline-block; background: linear-gradient(135deg, ${tpl.accentColor} 0%, #FF8200 100%); border-radius: 14px; padding: 12px 18px; box-shadow: 0 6px 16px ${tpl.accentColor}50;">
                 <span style="color: #FFFFFF; font-weight: 900; font-size: 24px; letter-spacing: -1px;">${rewardShort}</span>
               </div>
             </td>
           </tr>`
        : '';

    // ─── 5. Expiry: "Hết hạn ngày", tông màu ấm ───
    const expiryRow = tpl.showExpiry && expiry
        ? `<tr>
             <td>
               <table cellpadding="0" cellspacing="0"><tr>
                 <td style="width: 4px; background-color: ${tpl.accentColor}; border-radius: 2px;">&nbsp;</td>
                 <td style="width: 10px;">&nbsp;</td>
                 <td>
                   <div style="font-size: 10px; font-weight: 800; color: #8B6914; text-transform: uppercase; letter-spacing: 1.2px; margin-bottom: 2px;">HẾT HẠN NGÀY</div>
                   <div style="font-size: 14px; font-weight: 700; color: #3D1F0A;">${expiry}</div>
                 </td>
               </tr></table>
             </td>
           </tr>`
        : '';

    // ─── MAIN TICKET RETURN ───
    return `
    ${multiLabel}
    <tr>
      <td>
        <table width="100%" cellpadding="0" cellspacing="0"
          style="border-radius: 24px; overflow: hidden; background-color: #FFFFFF; box-shadow: 0 20px 50px rgba(92, 51, 23, 0.15), 0 4px 12px rgba(0,0,0,0.1); font-family: 'Nunito', 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;">

          <tr>
            <td colspan="2"
              style="background: linear-gradient(135deg, ${tpl.bgColor} 0%, #FFCD00 100%); padding: 32px 32px 28px; border-bottom: 1px solid #FFCD00;">
              <table width="100%" cellpadding="0" cellspacing="0">
                ${logoRow}
                <tr>
                  <td style="padding-bottom: 12px;">
                    <table cellpadding="0" cellspacing="0"><tr>
                      <td style="background-color: rgba(255,255,255,0.7); border: 1px solid rgba(139, 26, 26, 0.2); border-radius: 20px; padding: 5px 14px;">
                        <table cellpadding="0" cellspacing="0"><tr>
                          <td style="color: #8B1A1A; font-size: 10px; font-weight: 800; letter-spacing: 1.5px; text-transform: uppercase; white-space: nowrap;">
                            ${esc(tpl.title || campaign.name)}
                          </td>
                        </tr></table>
                      </td>
                    </tr></table>
                  </td>
                </tr>
                ${descRow}
              </table>
            </td>
          </tr>

          <tr>
            <td colspan="2" bgcolor="#FFFFAF" style="padding: 0; background-color: #FFFFFF;">
              <table width="100%" cellpadding="0" cellspacing="0"><tr>
                <td width="12" height="24" style="background-color: #FFF8E7; border-radius: 0 12px 12px 0; border: 1px solid rgba(255, 205, 0, 0.3); border-left: 0;">&nbsp;</td>
                <td style="border-top: 2.5px dashed rgba(139, 26, 26, 0.25);">&nbsp;</td>
                <td width="12" height="24" style="background-color: #FFF8E7; border-radius: 12px 0 0 12px; border: 1px solid rgba(255, 205, 0, 0.3); border-right: 0;">&nbsp;</td>
              </tr></table>
            </td>
          </tr>

          <tr>
            <td bgcolor="#FFFFFF" valign="top" style="padding: 28px 0 24px 32px;">
              <table cellpadding="0" cellspacing="0">
                ${rewardBadge}

                <tr>
                  <td style="font-size: 10px; font-weight: 800; color: #8B6914; text-transform: uppercase; letter-spacing: 1.5px; padding-bottom: 4px;">
                    MÃ VOUCHER
                  </td>
                </tr>
                <tr>
                  <td style="padding-bottom: 20px;">
                    <div style="display: inline-block; background-color: #FFF8CC; border-radius: 12px; padding: 12px 16px; border: 1px solid rgba(255, 205, 0, 0.5); box-shadow: inset 0 2px 4px rgba(92, 51, 23, 0.05);">
                      <span style="font-size: 18px; font-weight: 900; color: #FC4C02; letter-spacing: 3px; font-family: 'Courier New', Courier, monospace;">
                        ${esc(code.id)}
                      </span>
                    </div>
                  </td>
                </tr>

                ${expiryRow}
              </table>
            </td>

            <td bgcolor="#FFFFFF" valign="top" align="center" style="padding: 28px 32px 24px 24px; white-space: nowrap;">
              <div style="display: inline-block; background-color: #FFFFFF; padding: 10px; border-radius: 16px; border: 3px solid #FC4C02; box-shadow: 0 4px 20px rgba(252, 76, 2, 0.25);">
                <img src="cid:${qid}" alt="QR" width="${qrPx}" height="${qrPx}" style="display: block; border-radius: 8px;" />
              </div>
              <div style="margin-top: 10px; font-size: 11px; color: #8B1A1A; font-weight: 700; letter-spacing: 0.3px;">QUÉT ĐỂ SỬ DỤNG</div>
            </td>
          </tr>

          <tr>
            <td colspan="2"
              style="background-color: #FFF9E6; border-top: 1px solid rgba(255, 205, 0, 0.2); padding: 14px 32px; text-align: center;">
              <span style="font-size: 11px; color: #8B6914; font-weight: 500; letter-spacing: 0.2px;">
                Voucher này chỉ dành cho bạn. Vui lòng không chia sẻ mã nhé! Quạck!
              </span>
            </td>
          </tr>

        </table>
      </td>
    </tr>`;
}

// ═══════════════════════════════════════════════════════════════
// buildEmailHtml
// Wraps one or many ticket cards in a minimal outer shell.
// ═══════════════════════════════════════════════════════════════
function buildEmailHtml(
    codes: CodeWithQr[],
    campaign: VoucherCampaign,
    tpl: TicketTemplateConfig,
    hasLogo: boolean,
    introText?: string,
): string {
    const total = codes.length;

    // Intro Block: Đổi từ viền trái cứng nhắc sang dạng Card bo tròn, viền đứt nét dễ thương
    const introBlock = introText
        ? `<tr>
             <td style="padding: 0 0 24px;">
               <div style="background-color: #FFFFFF; border: 2px dashed #FFCD00; border-radius: 16px; padding: 20px 24px; text-align: left; box-shadow: 0 4px 12px rgba(255, 205, 0, 0.1);">
                 <p style="margin: 0; font-size: 15px; color: #5C3317; line-height: 1.6; white-space: pre-line; font-weight: 500;">
                   ${esc(introText)}
                 </p>
               </div>
             </td>
           </tr>`
        : '';

    // Header Note: Đổi thành dạng Pill (viên thuốc) màu cam nổi bật thay vì text mờ ảo
    const headerNote = total > 1
        ? `<tr>
             <td align="center" style="padding: 0 0 24px;">
               <span style="display: inline-block; background-color: #FF8200; color: #FFFFFF; font-size: 13px; font-weight: bold; padding: 8px 16px; border-radius: 20px; letter-spacing: 0.5px;">
                 🎉 BẠN CÓ ${total} VOUCHER BÊN DƯỚI 👇
               </span>
             </td>
           </tr>`
        : '';

    // Nối các vé lại và chèn một khoảng trống (24px) giữa các vé để không bị dính chùm
    const tickets = codes
        .map(({ code }, i) => buildTicketHtml(code, tpl, campaign, hasLogo, i, total))
        .join(`<tr><td height="24"></td></tr>`);

    return `<!DOCTYPE html>
<html lang="vi">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width,initial-scale=1" />
<title>Voucher ${esc(campaign.name)}</title>
</head>
<body style="margin: 0; padding: 0; background-color: #FFF8E7; font-family: 'Nunito', 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; -webkit-font-smoothing: antialiased;">

<table width="100%" cellpadding="0" cellspacing="0" bgcolor="#FFF8E7" style="padding: 40px 0 60px; background-color: #FFF8E7;">
<tr><td align="center">

  <table width="520" cellpadding="0" cellspacing="0" style="max-width: 520px; width: 100%;">

    <tr>
      <td align="center" style="padding-bottom: 24px;">
        <img src="https://employee.joyworld.vn/logo.png" alt="B.Duck Cityfuns" width="120" style="display: block; border: 0;" />
      </td>
    </tr>

    ${introBlock}
    ${headerNote}
    ${tickets}

    <tr>
      <td align="center" style="padding-top: 32px; font-size: 12px; color: #8B6914; line-height: 1.5;">
        <p style="margin: 0 0 6px 0; font-weight: bold; font-size: 14px;">Cảm ơn bạn đã đồng hành cùng B.Duck Cityfuns! 💛</p>
      </td>
    </tr>

  </table>
</td></tr>
</table>

</body>
</html>`;
}

// ═══════════════════════════════════════════════════════════════
// POST /api/vouchers/send-email
// ═══════════════════════════════════════════════════════════════
export async function POST(req: NextRequest): Promise<NextResponse> {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    try {
        await getAdminAuth().verifyIdToken(authHeader.slice(7));
    } catch {
        return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
    }

    let body: {
        voucherCodeIds: string[];
        campaignId: string;
        singleEmail?: string;
        emails?: string[];
        templateConfig: TicketTemplateConfig;
        customSubject?: string;
        senderName?: string;
        introText?: string;
    };
    try {
        body = await req.json();
    } catch {
        return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
    }

    const { voucherCodeIds, campaignId, singleEmail, emails, templateConfig, customSubject, senderName, introText } = body;

    if (!Array.isArray(voucherCodeIds) || voucherCodeIds.length === 0) {
        return NextResponse.json({ error: 'Can it nhat 1 ma voucher' }, { status: 400 });
    }
    if (!singleEmail && (!Array.isArray(emails) || emails.length !== voucherCodeIds.length)) {
        return NextResponse.json({ error: 'So luong email khong khop voi so ma' }, { status: 400 });
    }

    const db = getAdminDb();
    const campSnap = await db.collection('voucher_campaigns').doc(campaignId).get();
    if (!campSnap.exists) {
        return NextResponse.json({ error: 'Chien dich khong ton tai' }, { status: 404 });
    }
    const campaign = campSnap.data() as VoucherCampaign;

    // Pre-fetch logo once
    const logoAttachment = templateConfig.logoUrl
        ? await fetchLogoAttachment(templateConfig.logoUrl)
        : null;
    const hasLogo = logoAttachment !== null;

    // Group codes by recipient email
    const codeRefs = voucherCodeIds.map(id => db.collection('voucher_codes').doc(id));
    const codeSnaps = await db.getAll(...codeRefs);
    const emailToCodesMap = new Map<string, VoucherCode[]>();

    codeSnaps.forEach((snap, i) => {
        if (!snap.exists) return;
        const code = snap.data() as VoucherCode;
        const recipientEmail = singleEmail ?? emails![i];
        if (!recipientEmail) return;
        const codeWithId: VoucherCode = { ...code, id: snap.id };
        const existing = emailToCodesMap.get(recipientEmail) ?? [];
        existing.push(codeWithId);
        emailToCodesMap.set(recipientEmail, existing);
    });

    if (emailToCodesMap.size === 0) {
        return NextResponse.json({ error: 'Khong tim thay ma voucher hop le' }, { status: 404 });
    }

    const transporter = getTransporter();
    const now = new Date().toISOString();
    const results: SendResult[] = [];
    const emailGroups = Array.from(emailToCodesMap.entries());

    const BATCH = 5;
    for (let i = 0; i < emailGroups.length; i += BATCH) {
        const chunk = emailGroups.slice(i, i + BATCH);
        await Promise.allSettled(
            chunk.map(async ([recipientEmail, groupCodes]) => {
                try {
                    // Generate QR for each code
                    const codesWithQr: CodeWithQr[] = await Promise.all(
                        groupCodes.map(async (code) => {
                            const qrBuffer = await QRCode.toBuffer(code.id, {
                                width: 300,
                                margin: 2,
                                // QR fg color matches tpl.bgColor, same as TicketDesigner fgColor
                                color: { dark: templateConfig.bgColor, light: '#FFFFFF' },
                            });
                            return { code, qrCid: safeCid(code.id), qrBuffer };
                        }),
                    );

                    const html = buildEmailHtml(codesWithQr, campaign, templateConfig, hasLogo, introText);

                    const codeCount = groupCodes.length;
                    const rewardSummary = codeCount > 1
                        ? `${codeCount} voucher ưu đãi`
                        : formatRewardValue(groupCodes[0].rewardType, groupCodes[0].rewardValue);
                    const subject = customSubject?.trim() || `${rewardSummary} - ${templateConfig.title}`;
                    const fromName = senderName?.trim() || templateConfig.title;

                    // Attachments: all QRs + optional logo
                    const attachments: EmailAttachment[] = codesWithQr.map(({ qrCid, qrBuffer, code }) => ({
                        filename: `qr-${code.id}.png`,
                        content: qrBuffer,
                        cid: qrCid,
                        contentType: 'image/png',
                    }));
                    if (logoAttachment) attachments.push(logoAttachment);

                    await transporter.sendMail({
                        from: `"${fromName}" <${process.env.GMAIL_USER}>`,
                        to: recipientEmail,
                        subject,
                        html,
                        attachments,
                    });

                    for (const code of groupCodes) {
                        results.push({ id: code.id, email: recipientEmail, success: true });
                    }
                } catch (err) {
                    const errorMsg = err instanceof Error ? err.message : 'Loi khong xac dinh';
                    for (const code of groupCodes) {
                        results.push({ id: code.id, email: recipientEmail, success: false, error: errorMsg });
                    }
                }
            }),
        );
    }

    // Firestore: mark sent codes
    const successResults = results.filter(r => r.success);
    if (successResults.length > 0) {
        const batch = db.batch();
        for (const { id, email } of successResults) {
            batch.update(db.collection('voucher_codes').doc(id), { emailedAt: now, emailedTo: email });
        }
        await batch.commit();
    }

    return NextResponse.json({
        sent: results.filter(r => r.success).length,
        failed: results.filter(r => !r.success).length,
        errors: results.filter(r => !r.success).map(r => `${r.id}: ${r.error}`),
        results,
        emailsSent: emailToCodesMap.size,
    });
}
