import { NextRequest, NextResponse } from 'next/server';
import { getAdminAuth, getAdminDb } from '@/lib/firebase-admin';

// PUT /api/kpi-records/:id — Manager official scoring
export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    try {
        const { id } = await params;
        const token = req.headers.get('Authorization')?.split('Bearer ')[1];
        if (!token) return NextResponse.json({ error: 'Không được phép' }, { status: 401 });

        const adminAuth = getAdminAuth();
        const decoded = await adminAuth.verifyIdToken(token);
        const adminDb = getAdminDb();

        // Verify caller has scoring permission
        const callerDoc = await adminDb.collection('users').doc(decoded.uid).get();
        if (!callerDoc.exists) return NextResponse.json({ error: 'Không tìm thấy người dùng' }, { status: 403 });
        const caller = callerDoc.data()!;
        if (!['admin', 'store_manager'].includes(caller.role) && !caller.canManageHR) {
            return NextResponse.json({ error: 'Không có quyền chấm điểm' }, { status: 403 });
        }

        const body = await req.json();
        const { details, status } = body;

        if (!Array.isArray(details)) {
            return NextResponse.json({ error: 'Dữ liệu không hợp lệ' }, { status: 400 });
        }

        // Validate each officialScore <= maxScore
        let officialTotal = 0;
        for (const d of details) {
            if (typeof d.officialScore !== 'number' || d.officialScore < 0 || d.officialScore > d.maxScore) {
                return NextResponse.json({ error: `Điểm "${d.criteriaName}" không hợp lệ (0-${d.maxScore})` }, { status: 400 });
            }
            officialTotal += d.officialScore;
        }

        await adminDb.collection('kpi_records').doc(id).update({
            details,
            officialTotal,
            status: status || 'OFFICIAL',
            scoredByUserId: decoded.uid,
            updatedAt: new Date().toISOString(),
        });

        return NextResponse.json({ message: 'Đã chấm điểm thành công', officialTotal });
    } catch (err) {
        console.error('[KpiRecords PUT]', err);
        return NextResponse.json({ error: 'Lỗi hệ thống' }, { status: 500 });
    }
}
