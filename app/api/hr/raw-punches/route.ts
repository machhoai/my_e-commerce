/**
 * GET /api/hr/raw-punches
 *
 * Returns ALL raw punch timestamps for a single day, grouped by zk_user_id.
 * Used by the "Lịch sử chạm" (Raw Punch History) tab.
 *
 * Query: ?date=YYYY-MM-DD
 *
 * Returns: Record<zk_user_id, { timestamps: string[]; zk_name: string; mapped_system_uid: string | null }>
 */

import { NextRequest, NextResponse } from 'next/server';
import { getAdminAuth, getAdminDb } from '@/lib/firebase-admin';
import { AttendanceLogDoc, ZkUserDoc } from '@/types';

async function verifyToken(req: NextRequest): Promise<boolean> {
    const token = req.headers.get('Authorization')?.replace('Bearer ', '') ?? '';
    if (!token) return false;
    try { await getAdminAuth().verifyIdToken(token); return true; }
    catch { return false; }
}

export interface RawPunchGroup {
    zk_user_id: string;
    zk_name: string;
    mapped_system_uid: string | null;
    mapped_system_name: string | null;
    timestamps: string[]; // ISO strings, sorted chronologically
}

export async function GET(req: NextRequest) {
    if (!(await verifyToken(req))) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const dateParam = searchParams.get('date'); // YYYY-MM-DD
    if (!dateParam) {
        return NextResponse.json({ error: 'Provide ?date=YYYY-MM-DD' }, { status: 400 });
    }

    const db = getAdminDb();
    const startISO = `${dateParam}T00:00:00`;
    const endISO = `${dateParam}T23:59:59`;

    // Fetch all raw punches for the day
    const logsSnap = await db
        .collection('attendance_logs')
        .where('timestamp', '>=', startISO)
        .where('timestamp', '<=', endISO)
        .get();

    const logs = logsSnap.docs.map((d) => ({ id: d.id, ...d.data() } as AttendanceLogDoc));

    // Fetch ZK user metadata
    const zkUsersSnap = await db.collection('zkteco_users').get();
    const zkMeta = new Map<string, Pick<ZkUserDoc, 'zk_name' | 'mapped_system_uid' | 'mapped_system_name'>>();
    zkUsersSnap.forEach((d) => {
        const data = d.data() as ZkUserDoc;
        zkMeta.set(data.zk_user_id, {
            zk_name: data.zk_name,
            mapped_system_uid: data.mapped_system_uid ?? null,
            mapped_system_name: data.mapped_system_name ?? null,
        });
    });

    // Group by zk_user_id, sort each group chronologically
    const grouped = new Map<string, string[]>();
    for (const log of logs) {
        if (!grouped.has(log.zk_user_id)) grouped.set(log.zk_user_id, []);
        grouped.get(log.zk_user_id)!.push(log.timestamp);
    }

    const result: RawPunchGroup[] = [];
    grouped.forEach((timestamps, userId) => {
        const meta = zkMeta.get(userId);
        result.push({
            zk_user_id: userId,
            zk_name: meta?.zk_name ?? userId,
            mapped_system_uid: meta?.mapped_system_uid ?? null,
            mapped_system_name: meta?.mapped_system_name ?? null,
            timestamps: timestamps.sort(),
        });
    });

    result.sort((a, b) => a.zk_name.localeCompare(b.zk_name));
    return NextResponse.json(result);
}
