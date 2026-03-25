import { NextRequest, NextResponse } from 'next/server';
import { getAdminDb } from '@/lib/firebase-admin';

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

interface LinkDoc {
    targetUrl: string;
    active: boolean;
}

interface VisitPayload {
    slug: string;
    targetUrl: string;
    ip: string | null;
    userAgent: string | null;
    referer: string | null;
    city: string | null;
    country: string | null;
    acceptLanguage: string | null;
    language: string | null;
    browser: string | null;
    os: string | null;
    device: string | null;
    timezone: string | null;
    networkType: string | null;
    timestamp: FirebaseFirestore.FieldValue;
}

// ─────────────────────────────────────────────────────────────────────────────
// Parsers
// ─────────────────────────────────────────────────────────────────────────────

function parseBrowser(ua: string | null): string | null {
    if (!ua) return null;
    if (/CriOS/i.test(ua)) return 'Chrome (iOS)';
    if (/FxiOS/i.test(ua)) return 'Firefox (iOS)';
    if (/EdgA?/i.test(ua) || /Edg\//i.test(ua)) return 'Edge';
    if (/OPR|Opera/i.test(ua)) return 'Opera';
    if (/SamsungBrowser/i.test(ua)) return 'Samsung Internet';
    if (/Chrome/i.test(ua) && !/Chromium/i.test(ua)) return 'Chrome';
    if (/Safari/i.test(ua) && !/Chrome/i.test(ua)) return 'Safari';
    if (/Firefox/i.test(ua)) return 'Firefox';
    if (/MSIE|Trident/i.test(ua)) return 'IE';
    return 'Other';
}

function parseOS(ua: string | null): string | null {
    if (!ua) return null;
    if (/iPhone|iPad|iPod/i.test(ua)) return 'iOS';
    if (/Android/i.test(ua)) return 'Android';
    if (/Windows/i.test(ua)) return 'Windows';
    if (/Mac OS X|macOS/i.test(ua)) return 'macOS';
    if (/Linux/i.test(ua)) return 'Linux';
    if (/CrOS/i.test(ua)) return 'Chrome OS';
    return 'Other';
}

function parseDevice(ua: string | null): string | null {
    if (!ua) return null;
    if (/iPad|Tablet|PlayBook/i.test(ua) || (/Android/i.test(ua) && !/Mobile/i.test(ua))) return 'Tablet';
    if (/Mobile|iPhone|iPod|Android.*Mobile|webOS|BlackBerry|IEMobile|Opera Mini/i.test(ua)) return 'Mobile';
    return 'Desktop';
}

function parsePrimaryLanguage(acceptLang: string | null): string | null {
    if (!acceptLang) return null;
    const first = acceptLang.split(',')[0]?.trim().split(';')[0]?.trim();
    return first || null;
}

// ─────────────────────────────────────────────────────────────────────────────
// DB helpers
// ─────────────────────────────────────────────────────────────────────────────

async function getTargetUrl(slug: string): Promise<string | null> {
    const db = getAdminDb();
    const doc = await db.collection('short_links').doc(slug).get();
    if (!doc.exists) return null;
    const data = doc.data() as LinkDoc | undefined;
    if (!data?.targetUrl || data.active === false) return null;
    return data.targetUrl;
}

async function logVisitToDB(payload: VisitPayload): Promise<string | null> {
    try {
        const db = getAdminDb();
        const docRef = await db.collection('link_visits').add(payload);
        return docRef.id;
    } catch (err) {
        console.error('[link-tracker] Failed to log visit:', err);
        return null;
    }
}

/**
 * Fire-and-forget IP geolocation fallback using ip-api.com
 * Only used when Vercel geo headers are not available.
 */
async function resolveGeoFromIP(ip: string, docId: string): Promise<void> {
    try {
        const res = await fetch(`http://ip-api.com/json/${ip}?fields=city,country`, { signal: AbortSignal.timeout(3000) });
        if (!res.ok) return;
        const data = await res.json();
        if (data.city || data.country) {
            const db = getAdminDb();
            await db.collection('link_visits').doc(docId).update({
                city: data.city || null,
                country: data.country || null,
            });
        }
    } catch {
        // Silently fail — geo enrichment is best-effort
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// Route Handler
// ─────────────────────────────────────────────────────────────────────────────

export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ slug: string }> },
) {
    const { slug } = await params;
    const url = request.nextUrl;

    // ── Phase 2: Client-side data has been collected, log & redirect ────────
    const tz = url.searchParams.get('_tz');
    const net = url.searchParams.get('_net');
    const dest = url.searchParams.get('_dest');

    if (dest) {
        // This is the callback from the client-side collector
        const headers = request.headers;
        const ip = headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? headers.get('x-real-ip') ?? null;
        const userAgent = headers.get('user-agent') ?? null;
        const referer = headers.get('x-custom-referer') ?? url.searchParams.get('_ref') ?? null;
        const acceptLanguage = headers.get('accept-language') ?? null;

        const city = headers.get('x-vercel-ip-city') ?? null;
        const country = headers.get('x-vercel-ip-country') ?? null;

        const { FieldValue } = await import('firebase-admin/firestore');

        const payload: VisitPayload = {
            slug,
            targetUrl: dest,
            ip,
            userAgent,
            referer,
            city,
            country,
            acceptLanguage,
            language: parsePrimaryLanguage(acceptLanguage),
            browser: parseBrowser(userAgent),
            os: parseOS(userAgent),
            device: parseDevice(userAgent),
            timezone: tz || null,
            networkType: net || null,
            timestamp: FieldValue.serverTimestamp(),
        };

        // Log visit (fire-and-forget)
        void logVisitToDB(payload).then((docId) => {
            // If no Vercel geo, try IP fallback
            if (!city && !country && ip && docId) {
                void resolveGeoFromIP(ip, docId);
            }
        });

        return NextResponse.redirect(dest, 302);
    }

    // ── Phase 1: Resolve link & serve client-side collector page ────────────
    const targetUrl = await getTargetUrl(slug);

    if (!targetUrl) {
        return NextResponse.redirect(new URL('/not-found', request.url));
    }

    // Capture referer before the redirect (it may be lost in the 2nd request)
    const originalReferer = request.headers.get('referer') ?? '';

    // Serve a minimal HTML page that collects client-side data then redirects
    const html = `<!DOCTYPE html>
<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Redirecting…</title>
<style>body{margin:0;display:flex;align-items:center;justify-content:center;height:100vh;background:#f8fafc;font-family:system-ui,sans-serif}
.loader{width:24px;height:24px;border:3px solid #e2e8f0;border-top-color:#6366f1;border-radius:50%;animation:spin .6s linear infinite}
@keyframes spin{to{transform:rotate(360deg)}}</style></head>
<body><div class="loader"></div>
<script>
(function(){
  var tz='',net='';
  try{tz=Intl.DateTimeFormat().resolvedOptions().timeZone}catch(e){}
  try{var c=navigator.connection||navigator.mozConnection||navigator.webkitConnection;if(c)net=c.effectiveType||''}catch(e){}
  var ref=${JSON.stringify(originalReferer)};
  var base=location.pathname+'?_dest='+encodeURIComponent(${JSON.stringify(targetUrl)});
  base+='&_tz='+encodeURIComponent(tz);
  base+='&_net='+encodeURIComponent(net);
  if(ref)base+='&_ref='+encodeURIComponent(ref);
  location.replace(base);
})();
</script></body></html>`;

    return new NextResponse(html, {
        status: 200,
        headers: {
            'Content-Type': 'text/html; charset=utf-8',
            'Cache-Control': 'no-store, no-cache, must-revalidate',
        },
    });
}
