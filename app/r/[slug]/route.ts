import { NextRequest, NextResponse } from 'next/server';
import { getAdminDb } from '@/lib/firebase-admin';

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

interface LinkDoc {
    /** The full destination URL to redirect to */
    targetUrl: string;
    /** Whether this link is currently active */
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
    timestamp: FirebaseFirestore.FieldValue;
}

// ─────────────────────────────────────────────────────────────────────────────
// Database helpers
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Fetch the target URL for a given slug from the `short_links` collection.
 * Document ID = slug (e.g. "fb-campaign").
 *
 * Collection structure:
 *   short_links/{slug} → { targetUrl: string, active: boolean }
 */
async function getTargetUrl(slug: string): Promise<string | null> {
    const db = getAdminDb();
    const doc = await db.collection('short_links').doc(slug).get();

    if (!doc.exists) return null;

    const data = doc.data() as LinkDoc | undefined;
    if (!data?.targetUrl || data.active === false) return null;

    return data.targetUrl;
}

/**
 * Fire-and-forget: log the visit to the `link_visits` collection.
 * This function is intentionally NOT awaited before sending the redirect
 * response, so the user experiences zero database latency.
 */
async function logVisitToDB(payload: VisitPayload): Promise<void> {
    try {
        const db = getAdminDb();
        await db.collection('link_visits').add(payload);
    } catch (err) {
        // Logging failures must never surface to the end-user.
        console.error('[link-tracker] Failed to log visit:', err);
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

    // 1. Resolve target URL ─────────────────────────────────────────────────
    const targetUrl = await getTargetUrl(slug);

    if (!targetUrl) {
        return NextResponse.redirect(new URL('/not-found', request.url));
    }

    // 2. Extract analytics data ─────────────────────────────────────────────
    const headers = request.headers;

    const ip =
        headers.get('x-forwarded-for')?.split(',')[0]?.trim() ??
        headers.get('x-real-ip') ??
        null;

    const userAgent = headers.get('user-agent') ?? null;
    const referer = headers.get('referer') ?? null;

    // Vercel-specific geo headers (available on Vercel Edge/Serverless)
    const city = headers.get('x-vercel-ip-city') ?? null;
    const country = headers.get('x-vercel-ip-country') ?? null;

    // 3. Fire-and-forget: log the visit asynchronously ──────────────────────
    //    We deliberately do NOT await this — the user gets their redirect
    //    immediately while the DB write happens in the background.
    const { FieldValue } = await import('firebase-admin/firestore');

    const payload: VisitPayload = {
        slug,
        targetUrl,
        ip,
        userAgent,
        referer,
        city,
        country,
        timestamp: FieldValue.serverTimestamp(),
    };

    // Fire-and-forget (no await).
    // On Vercel you could wrap this with `waitUntil()` from @vercel/functions
    // to guarantee the serverless function stays alive until the write completes.
    // In a standard Node environment the Promise will resolve in the background.
    void logVisitToDB(payload);

    // 4. Redirect ───────────────────────────────────────────────────────────
    //    302 (Temporary Redirect) is used intentionally instead of 301.
    //    A 301 would be aggressively cached by the browser, causing subsequent
    //    clicks from the same user to bypass this handler entirely — which
    //    means we'd lose tracking data for repeat visitors.
    return NextResponse.redirect(targetUrl, 302);
}
