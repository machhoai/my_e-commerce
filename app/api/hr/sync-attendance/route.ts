/**
 * POST /api/hr/sync-attendance
 *
 * Delta-sync: pulls all punch logs from the ZKTeco worker and inserts
 * only NEW records into the `attendance_logs` Firestore collection.
 *
 * Deduplication strategy:
 *   Doc ID = "{zk_user_id}_{timestamp_epoch}"
 *   We use Firestore's `create` operation (which fails if the doc exists).
 *   This gives us natural idempotency — re-running the sync is always safe.
 *
 * Additionally, we look up the `zkteco_users` collection to populate
 * `mapped_system_uid` on each record at import time, so the attendance
 * query route never needs a secondary join.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getAdminAuth, getAdminDb } from '@/lib/firebase-admin';
import { fetchZkLogs } from '@/lib/zkteco-worker';
import { AttendanceLogDoc, ZkUserDoc } from '@/types';

async function verifyToken(req: NextRequest): Promise<boolean> {
    const authHeader = req.headers.get('Authorization') ?? '';
    const token = authHeader.replace('Bearer ', '');
    if (!token) return false;
    try {
        await getAdminAuth().verifyIdToken(token);
        return true;
    } catch {
        return false;
    }
}

export async function POST(req: NextRequest) {
    if (!(await verifyToken(req))) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // 1. Fetch all raw logs from device
    let rawLogs;
    try {
        rawLogs = await fetchZkLogs();
    } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : String(e);
        return NextResponse.json({ error: `Worker unreachable: ${msg}` }, { status: 502 });
    }

    const db = getAdminDb();

    // 2. Pre-load zkteco_users mapping for uid enrichment
    const zkUsersSnap = await db.collection('zkteco_users').get();
    const zkUserMap = new Map<string, Pick<ZkUserDoc, 'mapped_system_uid' | 'status'>>();
    zkUsersSnap.forEach((d) => {
        const data = d.data() as ZkUserDoc;
        zkUserMap.set(data.zk_user_id, {
            mapped_system_uid: data.mapped_system_uid ?? null,
            status: data.status,
        });
    });

    const logsCol = db.collection('attendance_logs');
    const now = new Date().toISOString();
    const BATCH_LIMIT = 400; // safe under Firestore 500-op limit

    let inserted = 0;
    let skipped = 0;

    // Process in chunks to respect Firestore batch limits
    for (let i = 0; i < rawLogs.length; i += BATCH_LIMIT) {
        const chunk = rawLogs.slice(i, i + BATCH_LIMIT);

        // Parse timestamps and build candidate docs
        const candidates = chunk.map((log) => {
            // Normalize device timestamp: "YYYY-MM-DD HH:MM:SS" → ISO
            const tsStr = log.timestamp.replace(' ', 'T');
            const tsDate = new Date(tsStr);
            const epoch = isNaN(tsDate.getTime()) ? 0 : tsDate.getTime();
            const docId = `${log.user_id || log.uid}_${epoch}`;

            const zkInfo = zkUserMap.get(log.user_id || String(log.uid));
            const mappedUid = zkInfo?.status === 'mapped' ? (zkInfo.mapped_system_uid ?? null) : null;

            const doc: Omit<AttendanceLogDoc, 'id'> = {
                zk_user_id: log.user_id || String(log.uid),
                zk_uid: log.uid,
                timestamp: tsStr,
                status: log.status,
                punch: log.punch as AttendanceLogDoc['punch'],
                mapped_system_uid: mappedUid,
                syncedAt: now,
            };

            return { docId, doc };
        });

        // Check which docs already exist (batch get)
        const refs = candidates.map((c) => logsCol.doc(c.docId));
        const existingSnaps = await db.getAll(...refs);
        const existingSet = new Set(
            existingSnaps.filter((s) => s.exists).map((s) => s.id)
        );

        // Write only new docs
        const batch = db.batch();
        for (const { docId, doc } of candidates) {
            if (existingSet.has(docId)) {
                skipped++;
            } else {
                batch.set(logsCol.doc(docId), doc);
                inserted++;
            }
        }
        await batch.commit();
    }

    return NextResponse.json({
        message: 'Attendance sync complete.',
        inserted,
        skipped,
        total: rawLogs.length,
    });
}
