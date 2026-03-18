import { NextRequest, NextResponse } from 'next/server';
import { getAdminDb } from '@/lib/firebase-admin';

// ── CORS headers for external domains ───────────────────────────
const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
};

// ── OPTIONS (CORS preflight) ────────────────────────────────────
export async function OPTIONS() {
    return new NextResponse(null, { status: 204, headers: corsHeaders });
}

// ── POST /api/v1/events/track ───────────────────────────────────
// Receives pageview & interaction analytics from external event apps
export async function POST(req: NextRequest) {
    try {
        const body = await req.json() as {
            eventId: string;
            action: string;        // 'pageview' | 'button_click' | 'spin_start' | etc.
            userAgent?: string;
            timestamp?: string;
            metadata?: Record<string, unknown>;
        };

        // Validation
        if (!body.eventId) {
            return NextResponse.json(
                { error: 'eventId is required' },
                { status: 400, headers: corsHeaders },
            );
        }
        if (!body.action) {
            return NextResponse.json(
                { error: 'action is required' },
                { status: 400, headers: corsHeaders },
            );
        }

        const db = getAdminDb();

        // Verify event exists
        const eventSnap = await db.collection('events').doc(body.eventId).get();
        if (!eventSnap.exists) {
            return NextResponse.json(
                { error: 'Event not found' },
                { status: 404, headers: corsHeaders },
            );
        }

        // Save analytics entry
        const docRef = db.collection('event_analytics').doc();
        await docRef.set({
            id: docRef.id,
            eventId: body.eventId,
            action: body.action,
            userAgent: body.userAgent || req.headers.get('user-agent') || '',
            timestamp: body.timestamp || new Date().toISOString(),
            metadata: body.metadata || {},
            ip: req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip') || '',
            createdAt: new Date().toISOString(),
        });

        return NextResponse.json(
            { success: true, id: docRef.id },
            { headers: corsHeaders },
        );
    } catch (err: unknown) {
        console.error('[Event Track]', err);
        const message = err instanceof Error ? err.message : 'System error';
        return NextResponse.json(
            { error: message },
            { status: 500, headers: corsHeaders },
        );
    }
}
