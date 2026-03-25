import { NextRequest, NextResponse } from 'next/server';
import { getAdminAuth, getAdminDb } from '@/lib/firebase-admin';

// ─────────────────────────────────────────────────────────────────────────────
// Auth helper (same as parent route)
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

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function detectSource(referer: string | null): string {
    if (!referer) return 'Direct';
    const r = referer.toLowerCase();
    if (r.includes('facebook.com') || r.includes('fb.com') || r.includes('fbclid')) return 'Facebook';
    if (r.includes('instagram.com')) return 'Instagram';
    if (r.includes('tiktok.com')) return 'TikTok';
    if (r.includes('zalo')) return 'Zalo';
    if (r.includes('google.com') || r.includes('google.com.vn')) return 'Google';
    if (r.includes('youtube.com')) return 'YouTube';
    if (r.includes('twitter.com') || r.includes('x.com')) return 'Twitter/X';
    try { return new URL(referer).hostname.replace('www.', ''); } catch { return 'Other'; }
}

function countBy<T>(arr: T[], keyFn: (item: T) => string | null): Record<string, number> {
    const result: Record<string, number> = {};
    for (const item of arr) {
        const key = keyFn(item) || 'Không rõ';
        result[key] = (result[key] || 0) + 1;
    }
    return result;
}

function sortedEntries(obj: Record<string, number>): { name: string; value: number }[] {
    return Object.entries(obj)
        .map(([name, value]) => ({ name, value }))
        .sort((a, b) => b.value - a.value);
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
// GET /api/tracking/[slug] — Detail data for a single campaign
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

        // Fetch all visits for this slug
        const visitsSnap = await adminDb
            .collection('link_visits')
            .where('slug', '==', slug)
            .get();

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const visits: any[] = visitsSnap.docs.map((doc) => {
            const d = doc.data();
            return {
                id: doc.id,
                ip: d.ip ?? null,
                userAgent: d.userAgent ?? null,
                referer: d.referer ?? null,
                city: d.city ?? null,
                country: d.country ?? null,
                acceptLanguage: d.acceptLanguage ?? null,
                language: d.language ?? null,
                browser: d.browser ?? null,
                os: d.os ?? null,
                device: d.device ?? null,
                timezone: d.timezone ?? null,
                networkType: d.networkType ?? null,
                timestamp: toISOString(d.timestamp),
            };
        });

        // Sort by timestamp descending
        visits.sort((a, b) => (b.timestamp || '').localeCompare(a.timestamp || ''));

        // ── Aggregations ──────────────────────────────────────────────────
        const totalClicks = visits.length;
        const uniqueIps = new Set(visits.filter(v => v.ip).map(v => v.ip)).size;

        // Time-series: clicks per day
        const clicksByDate: Record<string, number> = {};
        for (const v of visits) {
            if (v.timestamp) {
                const day = v.timestamp.split('T')[0];
                clicksByDate[day] = (clicksByDate[day] || 0) + 1;
            }
        }
        const clicksOverTime = Object.entries(clicksByDate)
            .map(([date, count]) => ({ date, count }))
            .sort((a, b) => a.date.localeCompare(b.date));

        // Hour-of-day distribution
        const clicksByHour: Record<string, number> = {};
        for (const v of visits) {
            if (v.timestamp) {
                const hour = new Date(v.timestamp).getHours().toString().padStart(2, '0') + ':00';
                clicksByHour[hour] = (clicksByHour[hour] || 0) + 1;
            }
        }
        const hourDistribution = Object.entries(clicksByHour)
            .map(([hour, count]) => ({ name: hour, value: count }))
            .sort((a, b) => a.name.localeCompare(b.name));

        // Breakdowns
        const bySource = sortedEntries(countBy(visits, v => detectSource(v.referer)));
        const byDevice = sortedEntries(countBy(visits, v => v.device));
        const byBrowser = sortedEntries(countBy(visits, v => v.browser));
        const byOS = sortedEntries(countBy(visits, v => v.os));
        const byCity = sortedEntries(countBy(visits, v => v.city));
        const byCountry = sortedEntries(countBy(visits, v => v.country));
        const byLanguage = sortedEntries(countBy(visits, v => v.language));
        const byTimezone = sortedEntries(countBy(visits, v => v.timezone));
        const byNetwork = sortedEntries(countBy(visits, v => v.networkType));

        // Link meta
        let createdAt = '';
        if (linkData.createdAt) {
            createdAt = typeof linkData.createdAt === 'string'
                ? linkData.createdAt
                : linkData.createdAt.toDate?.().toISOString() ?? '';
        }

        return NextResponse.json({
            link: {
                slug,
                targetUrl: linkData.targetUrl ?? '',
                campaignName: linkData.campaignName || slug,
                active: linkData.active !== false,
                createdAt,
            },
            stats: {
                totalClicks,
                uniqueIps,
            },
            charts: {
                clicksOverTime,
                hourDistribution,
                bySource,
                byDevice,
                byBrowser,
                byOS,
                byCity,
                byCountry,
                byLanguage,
                byTimezone,
                byNetwork,
            },
            visits, // raw data for table / export
        });
    } catch (err) {
        const message = err instanceof Error ? err.message : 'Lỗi hệ thống';
        return NextResponse.json({ error: message }, { status: 500 });
    }
}
