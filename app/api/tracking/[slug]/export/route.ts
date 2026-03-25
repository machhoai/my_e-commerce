import { NextRequest, NextResponse } from 'next/server';
import { getAdminAuth, getAdminDb } from '@/lib/firebase-admin';
import ExcelJS from 'exceljs';

// ─────────────────────────────────────────────────────────────────────────────
// Auth helper
// ─────────────────────────────────────────────────────────────────────────────

async function requireOfficeOrAdmin(req: NextRequest) {
    const token = req.headers.get('Authorization')?.split('Bearer ')[1];
    if (!token) return null;
    const adminAuth = getAdminAuth();
    const decoded = await adminAuth.verifyIdToken(token);
    const adminDb = getAdminDb();
    const snap = await adminDb.collection('users').doc(decoded.uid).get();
    if (!snap.exists) return null;
    const data = snap.data();
    const role = data?.role as string;
    const workplaceType = data?.workplaceType as string | undefined;
    if (['admin', 'super_admin', 'office'].includes(role) || workplaceType === 'OFFICE') return decoded.uid;
    return null;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function toISOString(ts: any): string {
    if (!ts) return '';
    if (typeof ts === 'string') return ts;
    if (ts.toDate) return ts.toDate().toISOString();
    if (ts._seconds) return new Date(ts._seconds * 1000).toISOString();
    return '';
}

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/tracking/[slug]/export — Download Excel
// ─────────────────────────────────────────────────────────────────────────────

export async function GET(
    req: NextRequest,
    { params }: { params: Promise<{ slug: string }> },
) {
    try {
        const uid = await requireOfficeOrAdmin(req);
        if (!uid) return NextResponse.json({ error: 'Không có quyền truy cập' }, { status: 403 });

        const { slug } = await params;
        const adminDb = getAdminDb();

        // Fetch link info
        const linkSnap = await adminDb.collection('short_links').doc(slug).get();
        if (!linkSnap.exists) {
            return NextResponse.json({ error: 'Không tìm thấy link' }, { status: 404 });
        }
        const linkData = linkSnap.data()!;
        const campaignName = linkData.campaignName || slug;

        // Fetch all visits
        const visitsSnap = await adminDb
            .collection('link_visits')
            .where('slug', '==', slug)
            .get();

        // Build Excel
        const workbook = new ExcelJS.Workbook();
        workbook.creator = 'JoyWorld Tracking';
        workbook.created = new Date();

        const sheet = workbook.addWorksheet('Visits');

        // Columns
        sheet.columns = [
            { header: '#', key: 'index', width: 6 },
            { header: 'Thời gian', key: 'timestamp', width: 22 },
            { header: 'IP', key: 'ip', width: 16 },
            { header: 'Thành phố', key: 'city', width: 16 },
            { header: 'Quốc gia', key: 'country', width: 14 },
            { header: 'Trình duyệt', key: 'browser', width: 16 },
            { header: 'Hệ điều hành', key: 'os', width: 14 },
            { header: 'Thiết bị', key: 'device', width: 12 },
            { header: 'Ngôn ngữ', key: 'language', width: 10 },
            { header: 'Múi giờ', key: 'timezone', width: 22 },
            { header: 'Mạng', key: 'networkType', width: 10 },
            { header: 'Nguồn', key: 'referer', width: 30 },
            { header: 'User-Agent', key: 'userAgent', width: 50 },
        ];

        // Header style
        sheet.getRow(1).font = { bold: true, size: 11 };
        sheet.getRow(1).fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: 'FF6366F1' },
        };
        sheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 11 };

        // Data rows
        const docs = visitsSnap.docs
            .map((doc) => ({ id: doc.id, ...doc.data() }))
            .sort((a, b) => {
                const ta = toISOString((a as Record<string, unknown>).timestamp);
                const tb = toISOString((b as Record<string, unknown>).timestamp);
                return tb.localeCompare(ta);
            });

        docs.forEach((d, i) => {
            const row = d as Record<string, unknown>;
            const ts = toISOString(row.timestamp);
            sheet.addRow({
                index: i + 1,
                timestamp: ts ? new Date(ts).toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' }) : '',
                ip: row.ip ?? '',
                city: row.city ?? '',
                country: row.country ?? '',
                browser: row.browser ?? '',
                os: row.os ?? '',
                device: row.device ?? '',
                language: row.language ?? '',
                timezone: row.timezone ?? '',
                networkType: row.networkType ?? '',
                referer: row.referer ?? '',
                userAgent: row.userAgent ?? '',
            });
        });

        // Alternating row colors
        for (let i = 2; i <= sheet.rowCount; i++) {
            if (i % 2 === 0) {
                sheet.getRow(i).fill = {
                    type: 'pattern',
                    pattern: 'solid',
                    fgColor: { argb: 'FFF8FAFC' },
                };
            }
        }

        // Generate buffer
        const buffer = await workbook.xlsx.writeBuffer();

        const filename = `tracking_${slug}_${new Date().toISOString().split('T')[0]}.xlsx`;

        return new NextResponse(buffer as ArrayBuffer, {
            status: 200,
            headers: {
                'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
                'Content-Disposition': `attachment; filename="${filename}"`,
                'Cache-Control': 'no-store',
            },
        });
    } catch (err) {
        const message = err instanceof Error ? err.message : 'Lỗi hệ thống';
        return NextResponse.json({ error: message }, { status: 500 });
    }
}
