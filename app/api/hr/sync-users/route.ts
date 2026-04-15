/**
 * POST /api/hr/sync-users
 *
 * Pulls all users from the ZKTeco worker and upserts them into the
 * `zkteco_users` Firestore collection.
 *
 * - Preserves existing `status` and `mapped_system_uid` (only updates
 *   fields that come from the hardware: zk_name, zk_uid, lastSyncedAt).
 * - Protected by Firebase ID token (Bearer auth).
 */

import { NextRequest, NextResponse } from 'next/server';
import { getAdminAuth, getAdminDb } from '@/lib/firebase-admin';
import { fetchZkUsers } from '@/lib/zkteco-worker';
import { ZkUserDoc } from '@/types';

export async function POST(req: NextRequest) {
    // ── Auth ──────────────────────────────────────────────────────────────────
    const authHeader = req.headers.get('Authorization') ?? '';
    const token = authHeader.replace('Bearer ', '');
    if (!token) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    try {
        await getAdminAuth().verifyIdToken(token);
    } catch {
        return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
    }

    // ── Fetch from device ──────────────────────────────────────────────────────
    let rawUsers;
    try {
        rawUsers = await fetchZkUsers();
    } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : String(e);
        return NextResponse.json({ error: `Worker unreachable: ${msg}` }, { status: 502 });
    }

    // ── Upsert into Firestore ─────────────────────────────────────────────────
    const db = getAdminDb();
    const col = db.collection('zkteco_users');
    const now = new Date().toISOString();

    const BATCH_LIMIT = 500;
    let inserted = 0;
    let updated = 0;

    for (let i = 0; i < rawUsers.length; i += BATCH_LIMIT) {
        const batch = db.batch();
        const chunk = rawUsers.slice(i, i + BATCH_LIMIT);

        for (const u of chunk) {
            const docId = u.user_id || String(u.uid); // card number is the stable key
            const ref = col.doc(docId);
            const snap = await ref.get();

            if (!snap.exists) {
                // New device user — create with default 'unmapped' status
                const newDoc: Omit<ZkUserDoc, 'id'> = {
                    zk_uid: u.uid,
                    zk_name: u.name,
                    zk_user_id: u.user_id || String(u.uid),
                    status: 'unmapped',
                    mapped_system_uid: null,
                    mapped_system_name: null,
                    lastSyncedAt: now,
                };
                batch.set(ref, newDoc);
                inserted++;
            } else {
                // Existing — only refresh hardware-sourced fields; keep mapping intact
                batch.update(ref, {
                    zk_uid: u.uid,
                    zk_name: u.name,
                    lastSyncedAt: now,
                });
                updated++;
            }
        }

        await batch.commit();
    }

    return NextResponse.json({
        message: 'ZKTeco users synced.',
        inserted,
        updated,
        total: rawUsers.length,
    });
}
