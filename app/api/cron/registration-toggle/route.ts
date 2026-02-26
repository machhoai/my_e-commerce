import { NextResponse } from 'next/server';

/**
 * This cron route has been removed.
 * Auto-schedule logic is now handled on-demand inside GET /api/settings.
 * This endpoint is kept only to return a proper 410 Gone response.
 */
export async function GET() {
    return NextResponse.json(
        { message: 'This cron endpoint is no longer active. Auto-schedule is handled on-demand.' },
        { status: 410 }
    );
}

