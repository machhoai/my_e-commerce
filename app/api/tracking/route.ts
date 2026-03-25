import { NextRequest, NextResponse } from 'next/server';
import { getAdminAuth, getAdminDb } from '@/lib/firebase-admin';

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

    // Allow admin, super_admin, office roles, or OFFICE workplace type
    if (['admin', 'super_admin', 'office'].includes(role) || workplaceType === 'OFFICE') {
        return decoded.uid;
    }

    return null;
}

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function slugify(text: string): string {
    return text
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '') // strip diacritics
        .replace(/đ/g, 'd')
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/(^-|-$)/g, '');
}

function detectDevice(userAgent: string | null): 'Mobile' | 'Desktop' | 'Unknown' {
    if (!userAgent) return 'Unknown';
    if (/mobile|android|iphone|ipad|ipod/i.test(userAgent)) return 'Mobile';
    return 'Desktop';
}

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
    try {
        return new URL(referer).hostname.replace('www.', '');
    } catch {
        return 'Other';
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/tracking — Fetch all links + aggregated visit stats
// ─────────────────────────────────────────────────────────────────────────────

export async function GET(req: NextRequest) {
    try {
        const uid = await requireOfficeOrAdmin(req);
        if (!uid) return NextResponse.json({ error: 'Không có quyền truy cập' }, { status: 403 });

        const adminDb = getAdminDb();

        // 1. Fetch all short links
        const linksSnap = await adminDb.collection('short_links').get();

        // 2. Fetch all visits
        const visitsSnap = await adminDb.collection('link_visits').get();

        // 3. Aggregate visits per slug
        const visitsBySlug: Record<string, {
            clicks: number;
            uniqueIps: Set<string>;
            sources: Record<string, number>;
            devices: Record<string, number>;
        }> = {};

        let totalClicks = 0;
        const globalSources: Record<string, number> = {};
        const globalDevices: Record<string, number> = {};

        visitsSnap.docs.forEach((doc) => {
            const v = doc.data();
            const slug = v.slug as string;

            if (!visitsBySlug[slug]) {
                visitsBySlug[slug] = { clicks: 0, uniqueIps: new Set(), sources: {}, devices: {} };
            }

            const entry = visitsBySlug[slug];
            entry.clicks++;
            totalClicks++;

            if (v.ip) entry.uniqueIps.add(v.ip);

            const source = detectSource(v.referer ?? null);
            entry.sources[source] = (entry.sources[source] || 0) + 1;
            globalSources[source] = (globalSources[source] || 0) + 1;

            const device = detectDevice(v.userAgent ?? null);
            entry.devices[device] = (entry.devices[device] || 0) + 1;
            globalDevices[device] = (globalDevices[device] || 0) + 1;
        });

        // 4. Build link list with stats
        const links = linksSnap.docs.map((doc) => {
            const data = doc.data();
            const slug = doc.id;
            const stats = visitsBySlug[slug];

            // Find top source for this link
            let topSource = 'N/A';
            if (stats) {
                const sorted = Object.entries(stats.sources).sort((a, b) => b[1] - a[1]);
                if (sorted.length > 0) topSource = sorted[0][0];
            }

            // createdAt: handle Firestore Timestamp or string
            let createdAt = 'N/A';
            if (data.createdAt) {
                if (typeof data.createdAt === 'string') {
                    createdAt = data.createdAt;
                } else if (data.createdAt.toDate) {
                    createdAt = data.createdAt.toDate().toISOString().split('T')[0];
                }
            }

            return {
                id: slug,
                slug,
                targetUrl: data.targetUrl ?? '',
                campaignName: data.campaignName || slug,
                clicks: stats?.clicks ?? 0,
                uniqueDevices: stats?.uniqueIps.size ?? 0,
                topSource,
                createdAt,
                active: data.active !== false,
            };
        });

        // Sort by clicks descending
        links.sort((a, b) => b.clicks - a.clicks);

        // 5. Compute global stats
        const topSourceEntry = Object.entries(globalSources).sort((a, b) => b[1] - a[1])[0];
        const topDeviceEntry = Object.entries(globalDevices).sort((a, b) => b[1] - a[1])[0];

        const stats = {
            totalClicks,
            topSource: topSourceEntry
                ? { name: topSourceEntry[0], pct: totalClicks > 0 ? Math.round((topSourceEntry[1] / totalClicks) * 100) : 0 }
                : { name: 'N/A', pct: 0 },
            topDevice: topDeviceEntry
                ? { name: topDeviceEntry[0], pct: totalClicks > 0 ? Math.round((topDeviceEntry[1] / totalClicks) * 100) : 0 }
                : { name: 'N/A', pct: 0 },
            activeLinks: links.filter(l => l.active).length,
            totalLinks: links.length,
        };

        return NextResponse.json({ links, stats });
    } catch (err) {
        const message = err instanceof Error ? err.message : 'Lỗi hệ thống';
        return NextResponse.json({ error: message }, { status: 500 });
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/tracking — Create a new short link
// ─────────────────────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
    try {
        const uid = await requireOfficeOrAdmin(req);
        if (!uid) return NextResponse.json({ error: 'Không có quyền truy cập' }, { status: 403 });

        const body = await req.json() as {
            campaignName: string;
            targetUrl: string;
            slug?: string;
        };

        if (!body.campaignName?.trim()) {
            return NextResponse.json({ error: 'Tên chiến dịch là bắt buộc' }, { status: 400 });
        }
        if (!body.targetUrl?.trim()) {
            return NextResponse.json({ error: 'URL đích là bắt buộc' }, { status: 400 });
        }

        const slug = body.slug?.trim() || slugify(body.campaignName);
        if (!slug) {
            return NextResponse.json({ error: 'Không thể tạo slug' }, { status: 400 });
        }

        const adminDb = getAdminDb();

        // Check if slug already exists
        const existing = await adminDb.collection('short_links').doc(slug).get();
        if (existing.exists) {
            return NextResponse.json({ error: `Slug "${slug}" đã tồn tại` }, { status: 409 });
        }

        await adminDb.collection('short_links').doc(slug).set({
            targetUrl: body.targetUrl.trim(),
            campaignName: body.campaignName.trim(),
            active: true,
            createdAt: new Date().toISOString(),
            createdBy: uid,
        });

        return NextResponse.json({ slug, message: 'Tạo link thành công' });
    } catch (err) {
        const message = err instanceof Error ? err.message : 'Lỗi hệ thống';
        return NextResponse.json({ error: message }, { status: 500 });
    }
}
