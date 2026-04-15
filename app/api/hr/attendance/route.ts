/**
 * GET /api/hr/attendance
 *
 * Queries attendance_logs and applies FILO (First-In, Last-Out) logic
 * to resolve daily check-in / check-out times for each ZK user.
 *
 * Query params:
 *   ?date=YYYY-MM-DD   → Day mode: single day roster
 *   ?month=YYYY-MM     → Month mode: all days in month
 *
 * Returns:
 *   Array of DailyAttendance objects (one per employee per day).
 */

import { NextRequest, NextResponse } from 'next/server';
import { getAdminAuth, getAdminDb } from '@/lib/firebase-admin';
import { AttendanceLogDoc, DailyAttendance, ZkUserDoc } from '@/types';

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

/**
 * FILO Aggregator
 *
 * Given an array of raw punch records for a single employee on a single day,
 * sorted chronologically (ascending), returns the resolved DailyAttendance:
 * - checkIn  = timestamp of the FIRST punch
 * - checkOut = timestamp of the LAST punch (only if more than 1 punch exists)
 *
 * We intentionally ignore the raw `punch` field because GT100 operators
 * frequently forget to select the correct status button.
 */
function applyFILO(
    userId: string,
    date: string,
    punches: AttendanceLogDoc[],
    zkName: string,
    mappedUid: string | null | undefined,
    mappedName: string | null | undefined
): DailyAttendance {
    // Sort ascending by timestamp
    const sorted = [...punches].sort(
        (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
    );

    const checkIn = sorted[0]?.timestamp ?? null;
    const checkOut = sorted.length > 1 ? sorted[sorted.length - 1].timestamp : null;

    return {
        zk_user_id: userId,
        date,
        zk_name: zkName,
        mapped_system_uid: mappedUid ?? null,
        mapped_system_name: mappedName ?? null,
        checkIn,
        checkOut,
        punchCount: sorted.length,
    };
}

export async function GET(req: NextRequest) {
    if (!(await verifyToken(req))) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const dateParam = searchParams.get('date');   // YYYY-MM-DD
    const monthParam = searchParams.get('month'); // YYYY-MM

    if (!dateParam && !monthParam) {
        return NextResponse.json(
            { error: 'Provide either ?date=YYYY-MM-DD or ?month=YYYY-MM' },
            { status: 400 }
        );
    }

    const db = getAdminDb();

    // ── Build date range ──────────────────────────────────────────────────────
    let startISO: string;
    let endISO: string;

    if (dateParam) {
        // Day mode: exactly that calendar date
        startISO = `${dateParam}T00:00:00`;
        endISO = `${dateParam}T23:59:59`;
    } else {
        // Month mode: first → last day inclusive
        const [year, month] = (monthParam as string).split('-').map(Number);
        const lastDay = new Date(year, month, 0).getDate(); // last day of month
        startISO = `${monthParam}-01T00:00:00`;
        endISO = `${monthParam}-${String(lastDay).padStart(2, '0')}T23:59:59`;
    }

    // ── Fetch logs in range ───────────────────────────────────────────────────
    const logsSnap = await db
        .collection('attendance_logs')
        .where('timestamp', '>=', startISO)
        .where('timestamp', '<=', endISO)
        .get();

    const logs = logsSnap.docs.map((d) => ({ id: d.id, ...d.data() } as AttendanceLogDoc));

    // ── Fetch ZK user metadata for name + mapping ─────────────────────────────
    const zkUsersSnap = await db.collection('zkteco_users').get();
    const zkUserMap = new Map<string, Pick<ZkUserDoc, 'zk_name' | 'mapped_system_uid' | 'mapped_system_name'>>();
    zkUsersSnap.forEach((d) => {
        const data = d.data() as ZkUserDoc;
        zkUserMap.set(data.zk_user_id, {
            zk_name: data.zk_name,
            mapped_system_uid: data.mapped_system_uid ?? null,
            mapped_system_name: data.mapped_system_name ?? null,
        });
    });

    // ── Group by (zk_user_id, date) ───────────────────────────────────────────
    // Key: "userId|YYYY-MM-DD"
    const grouped = new Map<string, AttendanceLogDoc[]>();

    for (const log of logs) {
        const date = log.timestamp.slice(0, 10); // extract YYYY-MM-DD
        const key = `${log.zk_user_id}|${date}`;
        if (!grouped.has(key)) grouped.set(key, []);
        grouped.get(key)!.push(log);
    }

    // ── Apply FILO and build response ─────────────────────────────────────────
    const result: DailyAttendance[] = [];

    grouped.forEach((punches, key) => {
        const [userId, date] = key.split('|');
        const meta = zkUserMap.get(userId);
        result.push(
            applyFILO(
                userId,
                date,
                punches,
                meta?.zk_name ?? userId,
                meta?.mapped_system_uid ?? null,
                meta?.mapped_system_name ?? null
            )
        );
    });

    // Sort by date asc, then by name asc
    result.sort((a, b) => {
        const dateCmp = a.date.localeCompare(b.date);
        if (dateCmp !== 0) return dateCmp;
        return a.zk_name.localeCompare(b.zk_name);
    });

    return NextResponse.json(result);
}
