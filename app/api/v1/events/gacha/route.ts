import { NextRequest, NextResponse } from 'next/server';
import { executeGacha } from '@/actions/universal_gacha';

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

// ── POST /api/v1/events/gacha ───────────────────────────────────
// REST wrapper around the executeGacha Server Action.
// Allows external apps (e.g. bduck-ticketing) to trigger gacha rolls
// without needing direct Firestore access to ERP's database.
export async function POST(req: NextRequest) {
    try {
        const body = await req.json() as {
            eventId: string;
            customer: {
                phone: string;
                fullName: string;
                dob: string;
                email?: string;
            };
            source?: string;
        };

        // ── Validation ──────────────────────────────────────────
        if (!body.eventId) {
            return NextResponse.json(
                { error: 'eventId is required' },
                { status: 400, headers: corsHeaders },
            );
        }
        if (!body.customer?.phone?.trim()) {
            return NextResponse.json(
                { error: 'customer.phone là bắt buộc' },
                { status: 400, headers: corsHeaders },
            );
        }
        if (!body.customer?.fullName?.trim()) {
            return NextResponse.json(
                { error: 'customer.fullName là bắt buộc' },
                { status: 400, headers: corsHeaders },
            );
        }

        // ── Call the Server Action ───────────────────────────────
        const result = await executeGacha(body.eventId, {
            phone: body.customer.phone,
            name: body.customer.fullName,
            dob: body.customer.dob || '2000-01-01',
            email: body.customer.email,
        });

        return NextResponse.json(result, { headers: corsHeaders });
    } catch (err: unknown) {
        console.error('[Event Gacha REST]', err);
        const message = err instanceof Error ? err.message : 'System error';
        return NextResponse.json(
            { success: false, status: 'ERROR', error: message },
            { status: 500, headers: corsHeaders },
        );
    }
}
