import { NextRequest, NextResponse } from 'next/server';
import { getAdminDb } from '@/lib/firebase-admin';
import { DEFAULT_SPINS } from '@/lib/event-engine';
import type { EventParticipation } from '@/types';

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

// ── POST /api/v1/events/register ────────────────────────────────
// Receives lead/customer registration data from external event apps.
// Upserts into event_participations — allocates default spins on first visit.
export async function POST(req: NextRequest) {
    try {
        const body = await req.json() as {
            eventId: string;
            customer: {
                phone: string;     // Primary key
                fullName: string;
                dob: string;       // YYYY-MM-DD — bắt buộc
                email?: string;    // tùy chọn
            };
            source?: string;       // e.g. 'qr_code', 'social_media', 'direct'
        };

        // ── Phone format validator (VN: 10 digits, starts 03/05/07/08/09) ──
        const VN_PHONE_REGEX = /^(0[35789][0-9]{8})$/;

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
        if (!body.customer?.dob?.trim()) {
            return NextResponse.json(
                { error: 'customer.dob là bắt buộc (định dạng YYYY-MM-DD)' },
                { status: 400, headers: corsHeaders },
            );
        }

        const phone = body.customer.phone.trim().replace(/[\s\-]/g, '');
        const fullName = body.customer.fullName.trim();
        const dob = body.customer.dob.trim();

        // ── Validate phone format ────────────────────────────────
        if (!VN_PHONE_REGEX.test(phone)) {
            return NextResponse.json(
                { error: 'Số điện thoại không đúng định dạng (VD: 0912345678)' },
                { status: 400, headers: corsHeaders },
            );
        }

        // ── Validate dob format (YYYY-MM-DD) ────────────────────
        const DOB_REGEX = /^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/;
        if (!DOB_REGEX.test(dob)) {
            return NextResponse.json(
                { error: 'Ngày sinh không đúng định dạng (YYYY-MM-DD, VD: 1995-10-25)' },
                { status: 400, headers: corsHeaders },
            );
        }

        const db = getAdminDb();

        // ── Verify event exists & is active ─────────────────────
        const eventSnap = await db.collection('events').doc(body.eventId).get();
        if (!eventSnap.exists) {
            return NextResponse.json(
                { error: 'Event not found' },
                { status: 404, headers: corsHeaders },
            );
        }

        const eventData = eventSnap.data();
        if (eventData?.status !== 'active') {
            return NextResponse.json(
                { error: 'Event is not active' },
                { status: 400, headers: corsHeaders },
            );
        }

        // ── Upsert participation record ─────────────────────────
        const docId = `${body.eventId}_${phone}`;
        const partRef = db.collection('event_participations').doc(docId);
        const partSnap = await partRef.get();

        const now = new Date().toISOString();

        if (partSnap.exists) {
            // Update customer info but DON'T reset spins
            await partRef.update({
                name: fullName,
                dob,
                email: body.customer.email?.trim() || null,
                source: body.source || null,
                updatedAt: now,
            });

            const existing = partSnap.data() as EventParticipation;

            return NextResponse.json({
                success: true,
                isNewUser: false,
                spinsRemaining: Math.max(0, existing.totalSpins - existing.usedSpins),
                message: 'Thông tin đã được cập nhật',
            }, { headers: corsHeaders });
        }

        // New participant — create with default spins
        const participation: EventParticipation = {
            eventId: body.eventId,
            phone,
            name: fullName,
            dob,
            email: body.customer.email?.trim() || null,
            source: body.source || null,
            totalSpins: DEFAULT_SPINS,
            usedSpins: 0,
            prizes: [],
            createdAt: now,
            updatedAt: now,
        };

        await partRef.set(participation);

        // ── Track registration as analytics event ───────────────
        const analyticsRef = db.collection('event_analytics').doc();
        await analyticsRef.set({
            id: analyticsRef.id,
            eventId: body.eventId,
            action: 'registration',
            userAgent: req.headers.get('user-agent') || '',
            timestamp: now,
            metadata: { phone, source: body.source || 'unknown' },
            createdAt: now,
        });

        return NextResponse.json({
            success: true,
            isNewUser: true,
            spinsRemaining: DEFAULT_SPINS,
            message: 'Đăng ký thành công',
        }, { headers: corsHeaders });
    } catch (err: unknown) {
        console.error('[Event Register]', err);
        const message = err instanceof Error ? err.message : 'System error';
        return NextResponse.json(
            { error: message },
            { status: 500, headers: corsHeaders },
        );
    }
}
