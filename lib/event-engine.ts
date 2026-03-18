/**
 * ═══════════════════════════════════════════════════════════════
 * Event Engine SDK — Headless Promotion Engine
 * ═══════════════════════════════════════════════════════════════
 *
 * Server-side utility for fetching sanitized event configs and
 * player participation data. Used by both the ERP admin UI and
 * any bespoke event frontend.
 *
 * IMPORTANT: This runs on the server. Never import in client
 * components — use via Server Actions or API routes.
 */

import { getAdminDb } from '@/lib/firebase-admin';
import type { EventDoc, EventParticipation } from '@/types';

// ─── Sanitized config returned to client ────────────────────────
export interface EventConfig {
    id: string;
    name: string;
    startDate: string;
    endDate: string;
    status: string;
    /** Prize display names + reward types (NO stock data leaked) */
    prizes: Array<{
        campaignName: string;
        rewardType: string;
    }>;
}

export interface ParticipationInfo {
    totalSpins: number;
    usedSpins: number;
    spinsRemaining: number;
    prizesWon: number;
}

// ─── Constants ──────────────────────────────────────────────────
const DEFAULT_SPINS = 3;

/**
 * Returns today's date string (YYYY-MM-DD) in Vietnam timezone (UTC+7).
 * Using toISOString() is wrong for server-side date comparisons in VN
 * because it returns UTC — which is 7 hours behind.
 */
export function todayVN(): string {
    return new Date(Date.now() + 7 * 60 * 60 * 1000)
        .toISOString()
        .slice(0, 10);
}

// ─── fetchEventConfig ───────────────────────────────────────────
/**
 * Fetches and validates an event by ID.
 * Returns a sanitized EventConfig (no stock numbers, no internal IDs).
 * Throws descriptive errors for invalid/expired/inactive events.
 */
export async function fetchEventConfig(eventId: string): Promise<EventConfig> {
    if (!eventId) throw new Error('eventId is required');

    const db = getAdminDb();
    const snap = await db.collection('events').doc(eventId).get();

    if (!snap.exists) {
        throw new Error('EVENT_NOT_FOUND');
    }

    const event = snap.data() as EventDoc;

    // Validate status
    if (event.status !== 'active') {
        throw new Error('EVENT_NOT_ACTIVE');
    }

    // Validate date range
    const today = todayVN();
    if (today < event.startDate) {
        throw new Error('EVENT_NOT_STARTED');
    }
    if (today > event.endDate) {
        throw new Error('EVENT_EXPIRED');
    }

    // Return sanitized config — NO stock numbers
    return {
        id: event.id,
        name: event.name,
        startDate: event.startDate,
        endDate: event.endDate,
        status: event.status,
        prizes: (event.prizePool || []).map(p => ({
            campaignName: p.campaignName || 'Prize',
            rewardType: p.rewardType,
        })),
    };
}

// ─── getParticipation ───────────────────────────────────────────
/**
 * Returns the player's participation record for an event.
 * Creates a new record with default spins if none exists.
 */
export async function getParticipation(
    eventId: string,
    phone: string,
): Promise<ParticipationInfo> {
    if (!eventId || !phone) throw new Error('eventId and phone are required');

    const db = getAdminDb();
    const docId = `${eventId}_${phone.replace(/\s+/g, '')}`;
    const ref = db.collection('event_participations').doc(docId);
    const snap = await ref.get();

    if (snap.exists) {
        const data = snap.data() as EventParticipation;
        return {
            totalSpins: data.totalSpins,
            usedSpins: data.usedSpins,
            spinsRemaining: Math.max(0, data.totalSpins - data.usedSpins),
            prizesWon: data.prizes.length,
        };
    }

    // Default: new player with DEFAULT_SPINS
    return {
        totalSpins: DEFAULT_SPINS,
        usedSpins: 0,
        spinsRemaining: DEFAULT_SPINS,
        prizesWon: 0,
    };
}

/** Internal: default spin allocation */
export { DEFAULT_SPINS };
