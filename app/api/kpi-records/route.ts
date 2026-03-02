import { NextRequest, NextResponse } from 'next/server';
import { getAdminAuth, getAdminDb } from '@/lib/firebase-admin';

// GET /api/kpi-records?userId=xxx&storeId=xxx&date=xxx&month=xxx
export async function GET(req: NextRequest) {
    try {
        const token = req.headers.get('Authorization')?.split('Bearer ')[1];
        if (!token) return NextResponse.json({ error: 'Không được phép' }, { status: 401 });

        const adminAuth = getAdminAuth();
        await adminAuth.verifyIdToken(token);

        const adminDb = getAdminDb();
        const storeId = req.nextUrl.searchParams.get('storeId');
        const userId = req.nextUrl.searchParams.get('userId');
        const date = req.nextUrl.searchParams.get('date');
        const month = req.nextUrl.searchParams.get('month'); // e.g. "2026-03"

        if (!storeId) return NextResponse.json({ error: 'Thiếu storeId' }, { status: 400 });

        let q: FirebaseFirestore.Query = adminDb.collection('kpi_records').where('storeId', '==', storeId);
        if (userId) q = q.where('userId', '==', userId);
        if (date) q = q.where('date', '==', date);
        if (month) {
            q = q.where('date', '>=', `${month}-01`).where('date', '<=', `${month}-31`);
        }

        const snap = await q.get();
        const records = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        return NextResponse.json(records);
    } catch (err) {
        console.error('[KpiRecords GET]', err);
        return NextResponse.json({ error: 'Lỗi hệ thống' }, { status: 500 });
    }
}

// POST /api/kpi-records — Employee self-score
export async function POST(req: NextRequest) {
    try {
        const token = req.headers.get('Authorization')?.split('Bearer ')[1];
        if (!token) return NextResponse.json({ error: 'Không được phép' }, { status: 401 });

        const adminAuth = getAdminAuth();
        const decoded = await adminAuth.verifyIdToken(token);
        const adminDb = getAdminDb();

        const body = await req.json();
        const { storeId, shiftId, date, counterId, templateId, details } = body;

        if (!storeId || !shiftId || !date || !counterId || !templateId || !Array.isArray(details)) {
            return NextResponse.json({ error: 'Dữ liệu không hợp lệ' }, { status: 400 });
        }

        // Validate each selfScore <= maxScore
        let selfTotal = 0;
        for (const d of details) {
            if (typeof d.selfScore !== 'number' || d.selfScore < 0 || d.selfScore > d.maxScore) {
                return NextResponse.json({ error: `Điểm tự đánh giá "${d.criteriaName}" không hợp lệ (0-${d.maxScore})` }, { status: 400 });
            }
            selfTotal += d.selfScore;
        }

        // Check for existing record
        const existingSnap = await adminDb.collection('kpi_records')
            .where('userId', '==', decoded.uid)
            .where('date', '==', date)
            .where('shiftId', '==', shiftId)
            .where('counterId', '==', counterId)
            .get();

        if (!existingSnap.empty) {
            return NextResponse.json({ error: 'Bạn đã tự đánh giá ca này rồi' }, { status: 409 });
        }

        const docRef = adminDb.collection('kpi_records').doc();
        const record = {
            id: docRef.id,
            storeId,
            userId: decoded.uid,
            shiftId,
            date,
            counterId,
            templateId,
            selfTotal,
            officialTotal: 0,
            status: 'SELF_SCORED',
            details: details.map((d: any) => ({
                criteriaName: d.criteriaName,
                maxScore: d.maxScore,
                selfScore: d.selfScore,
                officialScore: 0,
                note: d.note || '',
            })),
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
        };
        await docRef.set(record);

        return NextResponse.json(record, { status: 201 });
    } catch (err) {
        console.error('[KpiRecords POST]', err);
        return NextResponse.json({ error: 'Lỗi hệ thống' }, { status: 500 });
    }
}
