import { NextRequest, NextResponse } from 'next/server';
import { getAdminAuth, getAdminDb } from '@/lib/firebase-admin';

// GET /api/kpi-templates?storeId=xxx
export async function GET(req: NextRequest) {
    try {
        const token = req.headers.get('Authorization')?.split('Bearer ')[1];
        if (!token) return NextResponse.json({ error: 'Không được phép' }, { status: 401 });

        const adminAuth = getAdminAuth();
        await adminAuth.verifyIdToken(token);

        const storeId = req.nextUrl.searchParams.get('storeId');
        if (!storeId) return NextResponse.json({ error: 'Thiếu storeId' }, { status: 400 });

        const adminDb = getAdminDb();
        const snap = await adminDb.collection('kpi_templates').where('storeId', '==', storeId).get();
        const templates = snap.docs.map(d => ({ id: d.id, ...d.data() }));

        return NextResponse.json(templates);
    } catch (err) {
        console.error('[KpiTemplates GET]', err);
        return NextResponse.json({ error: 'Lỗi hệ thống' }, { status: 500 });
    }
}

// POST /api/kpi-templates
export async function POST(req: NextRequest) {
    try {
        const token = req.headers.get('Authorization')?.split('Bearer ')[1];
        if (!token) return NextResponse.json({ error: 'Không được phép' }, { status: 401 });

        const adminAuth = getAdminAuth();
        const decoded = await adminAuth.verifyIdToken(token);

        // Verify permission
        const adminDb = getAdminDb();
        const callerDoc = await adminDb.collection('users').doc(decoded.uid).get();
        if (!callerDoc.exists) return NextResponse.json({ error: 'Không tìm thấy người dùng' }, { status: 403 });
        const caller = callerDoc.data()!;
        if (!['admin', 'store_manager'].includes(caller.role) && !caller.canManageHR) {
            return NextResponse.json({ error: 'Không có quyền' }, { status: 403 });
        }

        const body = await req.json();
        const { name, storeId, groups, assignedCounterIds } = body;

        if (!name || !storeId || !groups || !Array.isArray(groups)) {
            return NextResponse.json({ error: 'Dữ liệu không hợp lệ' }, { status: 400 });
        }

        // Validate sum = 100
        let totalMax = 0;
        for (const group of groups) {
            if (!group.name || !Array.isArray(group.criteria)) {
                return NextResponse.json({ error: 'Nhóm tiêu chí không hợp lệ' }, { status: 400 });
            }
            for (const c of group.criteria) {
                if (!c.name || typeof c.maxScore !== 'number' || c.maxScore <= 0) {
                    return NextResponse.json({ error: `Tiêu chí "${c.name || '?'}" không hợp lệ` }, { status: 400 });
                }
                totalMax += c.maxScore;
            }
        }
        if (totalMax !== 100) {
            return NextResponse.json({ error: `Tổng điểm phải bằng 100 (hiện tại: ${totalMax})` }, { status: 400 });
        }

        const docRef = adminDb.collection('kpi_templates').doc();
        const data = {
            id: docRef.id,
            storeId,
            name,
            assignedCounterIds: assignedCounterIds || [],
            maxTotalScore: 100,
            groups,
            createdAt: new Date().toISOString(),
            createdBy: decoded.uid,
        };
        await docRef.set(data);

        return NextResponse.json(data, { status: 201 });
    } catch (err) {
        console.error('[KpiTemplates POST]', err);
        return NextResponse.json({ error: 'Lỗi hệ thống' }, { status: 500 });
    }
}
