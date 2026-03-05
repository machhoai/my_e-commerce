import { NextRequest, NextResponse } from 'next/server';
import { getAdminAuth, getAdminDb } from '@/lib/firebase-admin';

// GET /api/kpi-records/averages?storeId=xxx
// Returns a map of userId -> { avgOfficial, count } for all OFFICIAL kpi_records in the store
export async function GET(req: NextRequest) {
    try {
        const token = req.headers.get('Authorization')?.split('Bearer ')[1];
        if (!token) return NextResponse.json({ error: 'Không được phép' }, { status: 401 });

        const adminAuth = getAdminAuth();
        await adminAuth.verifyIdToken(token);

        const adminDb = getAdminDb();
        const storeId = req.nextUrl.searchParams.get('storeId');
        if (!storeId) return NextResponse.json({ error: 'Thiếu storeId' }, { status: 400 });

        const snap = await adminDb.collection('kpi_records')
            .where('storeId', '==', storeId)
            .where('status', '==', 'OFFICIAL')
            .get();

        // Aggregate by userId
        const map: Record<string, { total: number; count: number }> = {};
        for (const doc of snap.docs) {
            const data = doc.data();
            const uid = data.userId as string;
            if (!map[uid]) map[uid] = { total: 0, count: 0 };
            map[uid].total += (data.officialTotal as number) || 0;
            map[uid].count += 1;
        }

        // Convert to averages
        const result: Record<string, { avgOfficial: number; count: number }> = {};
        for (const [uid, val] of Object.entries(map)) {
            result[uid] = {
                avgOfficial: val.count > 0 ? Math.round(val.total / val.count) : 0,
                count: val.count,
            };
        }

        return NextResponse.json(result);
    } catch (err: any) {
        console.error('[KpiRecords Averages GET]', err?.message || err);
        return NextResponse.json({ error: err?.message || 'Lỗi hệ thống' }, { status: 500 });
    }
}
