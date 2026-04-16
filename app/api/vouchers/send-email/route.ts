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
// Horizontal ticket-stub layout matching real event ticket design.
// ─ Left panel: logo, title, code ID, status badges, CTA button
// ─ Vertical perforation (notches + dashed line)
// ─ Right panel: QR code
// ═══════════════════════════════════════════════════════════════
function buildTicketHtml(
    code: VoucherCode,
    tpl: TicketTemplateConfig,
    campaign: VoucherCampaign,
    hasLogo: boolean,
    index: number,
    total: number,
): string {
    const qrPx = tpl.qrSize === 'sm' ? 100 : tpl.qrSize === 'md' ? 140 : 180;
    const qid = safeCid(code.id);
    const expiry = formatDate(code.validTo);
    const rewardShort = formatRewardShort(code.rewardType, code.rewardValue);
    // ticketColor falls back to accentColor
    const tc = tpl.ticketColor || tpl.accentColor || '#22c55e';

    // ─── Multi-Label ───
    const multiLabel = total > 1
        ? `<tr>
             <td align="center" style="padding:${index === 0 ? '0' : '24px'} 0 12px; font-size: 11px; font-weight: 800; color: #6b7280; text-transform: uppercase; letter-spacing: 2px;">
               VÉ SỐ ${index + 1} / ${total}
             </td>
           </tr>`
        : (index === 0 ? '' : '<tr><td style="height:24px;"></td></tr>');

    // ─── Logo ───
    const logoHtml = hasLogo
        ? `<img src="cid:logo@voucher" alt="Logo" width="44" height="44"
             style="display: block; width: 44px; height: 44px; border-radius: 12px; object-fit: cover; border: 2px solid #f3f4f6;" />`
        : `<div style="width: 44px; height: 44px; border-radius: 12px; background: linear-gradient(135deg, ${tc}20 0%, ${tc}10 100%); display: flex; align-items: center; justify-content: center; border: 2px solid ${tc}30;">
             <span style="font-size: 20px;">🎫</span>
           </div>`;

    // ─── Reward Badge (optional) ───
    const rewardRow = tpl.showRewardValue
        ? `<tr>
             <td style="padding-top: 10px;">
               <div style="display: inline-block; background: ${tc}; border-radius: 8px; padding: 4px 10px;">
                 <span style="color: #FFFFFF; font-weight: 800; font-size: 13px; letter-spacing: -0.3px;">${rewardShort}</span>
               </div>
             </td>
           </tr>`
        : '';

    // ─── Expiry (optional) ───
    const expiryBadge = tpl.showExpiry && expiry
        ? `<span style="display: inline-flex; align-items: center; gap: 4px; background-color: #f9fafb; border: 1px solid #e5e7eb; border-radius: 8px; padding: 4px 10px; font-size: 11px; font-weight: 600; color: #6b7280;">
             &#128197; HSD: ${expiry}
           </span>`
        : '';

    // ─── Description (optional) ───
    const descRow = tpl.showDescription && campaign.description
        ? `<tr>
             <td style="padding-top: 8px;">
               <p style="margin: 0; font-size: 12px; color: #9ca3af; line-height: 1.5;">${esc(campaign.description)}</p>
             </td>
           </tr>`
        : '';

    // QR panel width calculation
    const qrCellWidth = qrPx + 44; // padding around QR

    // ─── MAIN TICKET RETURN ───
    return `
    ${multiLabel}
    <tr>
      <td>
        <table width="100%" cellpadding="0" cellspacing="0"
          style="border-radius: 20px; overflow: hidden; background-color: #FFFFFF; box-shadow: 0 4px 24px rgba(0,0,0,0.08), 0 1px 4px rgba(0,0,0,0.04); font-family: 'Segoe UI', -apple-system, 'Helvetica Neue', Arial, sans-serif;">

          <tr>
            <!-- LEFT: Info Panel -->
            <td valign="top" style="padding: 24px 20px 24px 24px; width: auto;">
              <table cellpadding="0" cellspacing="0" width="100%">
                <!-- Logo + Title row -->
                <tr>
                  <td>
                    <table cellpadding="0" cellspacing="0"><tr>
                      <td valign="top" style="width: 44px; padding-right: 12px;">
                        ${logoHtml}
                      </td>
                      <td valign="top">
                        <p style="margin: 0; font-size: 15px; font-weight: 800; color: #111827; line-height: 1.3;">
                          ${esc(tpl.title || campaign.name)}
                        </p>
                        <p style="margin: 3px 0 0; font-size: 12px; color: #9ca3af; font-family: 'Courier New', Courier, monospace; font-weight: 600; letter-spacing: 0.5px;">
                          #${esc(code.id)}
                        </p>
                      </td>
                    </tr></table>
                  </td>
                </tr>

                <!-- Status badges -->
                <tr>
                  <td style="padding-top: 14px;">
                    <table cellpadding="0" cellspacing="0"><tr>
                      <td style="padding-right: 6px;">
                        <span style="display: inline-flex; align-items: center; gap: 4px; background-color: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 8px; padding: 4px 10px; font-size: 11px; font-weight: 700; color: #16a34a;">
                          &#9989; Active
                        </span>
                      </td>
                      <td style="padding-right: 6px;">
                        ${expiryBadge}
                      </td>
                    </tr></table>
                  </td>
                </tr>

                ${rewardRow}
                ${descRow}

                <!-- Instruction text -->
                <tr>
                  <td style="padding-top: 14px;">
                    <p style="margin: 0; font-size: 12px; color: #9ca3af; line-height: 1.4;">
                      Xuất trình mã QR này tại quầy để sử dụng voucher
                    </p>
                  </td>
                </tr>

                <!-- CTA Button -->
                <tr>
                  <td style="padding-top: 14px;">
                    <div style="display: inline-block; background-color: #111827; border-radius: 12px; padding: 10px 20px; cursor: pointer;">
                      <span style="color: #FFFFFF; font-size: 13px; font-weight: 700; letter-spacing: 0.3px;">🎫&nbsp; Xem Voucher</span>
                    </div>
                  </td>
                </tr>
              </table>
            </td>

            <!-- PERFORATION: Vertical dashed separator with notches -->
            <td width="1" valign="top" style="position: relative; width: 1px; padding: 0;">
              <table cellpadding="0" cellspacing="0" width="1" style="width: 1px;">
                <!-- Top notch -->
                <tr>
                  <td align="center" style="width: 1px; padding: 0;">
                    <div style="width: 24px; height: 12px; background-color: #FFF8E7; border-radius: 0 0 12px 12px; margin-left: -12px;"></div>
                  </td>
                </tr>
                <!-- Dashed line -->
                <tr>
                  <td style="width: 1px; border-left: 2px dashed #e5e7eb; height: 100%; padding: 0;">
                    &nbsp;
                  </td>
                </tr>
                <!-- Bottom notch -->
                <tr>
                  <td align="center" style="width: 1px; padding: 0;">
                    <div style="width: 24px; height: 12px; background-color: #FFF8E7; border-radius: 12px 12px 0 0; margin-left: -12px;"></div>
                  </td>
                </tr>
              </table>
            </td>

            <!-- RIGHT: QR Code Panel -->
            <td valign="middle" align="center" width="${qrCellWidth}" style="padding: 24px 24px 24px 20px; background-color: #fafafa;">
              <table cellpadding="0" cellspacing="0">
                <tr>
                  <td align="center">
                    <div style="background-color: #FFFFFF; padding: 10px; border-radius: 14px; border: 2px solid #e5e7eb; box-shadow: 0 2px 8px rgba(0,0,0,0.04);">
                      <img src="cid:${qid}" alt="QR" width="${qrPx}" height="${qrPx}" style="display: block; border-radius: 6px;" />
                    </div>
                  </td>
                </tr>
              </table>
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
    const tc = tpl.ticketColor || tpl.accentColor || '#22c55e';

    // Intro Block
    const introBlock = introText
        ? `<tr>
             <td style="padding: 0 0 24px;">
               <div style="background-color: #FFFFFF; border: 2px dashed ${tc}40; border-radius: 16px; padding: 20px 24px; text-align: left; box-shadow: 0 4px 12px ${tc}10;">
                 <p style="margin: 0; font-size: 15px; color: #374151; line-height: 1.6; white-space: pre-line; font-weight: 500;">
                   ${esc(introText)}
                 </p>
               </div>
             </td>
           </tr>`
        : '';

    // Header Note for multiple vouchers
    const headerNote = total > 1
        ? `<tr>
             <td align="center" style="padding: 0 0 24px;">
               <span style="display: inline-block; background-color: ${tc}; color: #FFFFFF; font-size: 13px; font-weight: bold; padding: 8px 16px; border-radius: 20px; letter-spacing: 0.5px;">
                 🎉 BẠN CÓ ${total} VOUCHER BÊN DƯỚI 👇
               </span>
             </td>
           </tr>`
        : '';

    // Join tickets with spacing
    const tickets = codes
        .map(({ code }, i) => buildTicketHtml(code, tpl, campaign, hasLogo, i, total))
        .join(`<tr><td height="20"></td></tr>`);

    return `<!DOCTYPE html>
<html lang="vi">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width,initial-scale=1" />
<title>Voucher ${esc(campaign.name)}</title>
</head>
<body style="margin: 0; padding: 0; background-color: #FFF8E7; font-family: 'Segoe UI', -apple-system, 'Helvetica Neue', Arial, sans-serif; -webkit-font-smoothing: antialiased;">

<table width="100%" cellpadding="0" cellspacing="0" bgcolor="#FFF8E7" style="padding: 40px 0 60px; background-color: #FFF8E7;">
<tr><td align="center">

  <table width="580" cellpadding="0" cellspacing="0" style="max-width: 580px; width: 100%;">

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
