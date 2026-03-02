import { NextRequest, NextResponse } from 'next/server';
import { getAdminAuth, getAdminDb } from '@/lib/firebase-admin';

// PUT /api/kpi-templates/:id
export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    try {
        const { id } = await params;
        const token = req.headers.get('Authorization')?.split('Bearer ')[1];
        if (!token) return NextResponse.json({ error: 'Không được phép' }, { status: 401 });

        const adminAuth = getAdminAuth();
        await adminAuth.verifyIdToken(token);

        const adminDb = getAdminDb();
        const body = await req.json();
        const { name, groups, assignedCounterIds } = body;

        // Validate sum = 100
        let totalMax = 0;
        for (const group of groups) {
            for (const c of group.criteria) {
                totalMax += c.maxScore;
            }
        }
        if (totalMax !== 100) {
            return NextResponse.json({ error: `Tổng điểm phải bằng 100 (hiện tại: ${totalMax})` }, { status: 400 });
        }

        await adminDb.collection('kpi_templates').doc(id).update({
            name,
            groups,
            assignedCounterIds: assignedCounterIds || [],
        });

        return NextResponse.json({ message: 'Đã cập nhật mẫu KPI' });
    } catch (err) {
        console.error('[KpiTemplates PUT]', err);
        return NextResponse.json({ error: 'Lỗi hệ thống' }, { status: 500 });
    }
}

// DELETE /api/kpi-templates/:id
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    try {
        const { id } = await params;
        const token = req.headers.get('Authorization')?.split('Bearer ')[1];
        if (!token) return NextResponse.json({ error: 'Không được phép' }, { status: 401 });

        const adminAuth = getAdminAuth();
        await adminAuth.verifyIdToken(token);

        const adminDb = getAdminDb();
        await adminDb.collection('kpi_templates').doc(id).delete();

        return NextResponse.json({ message: 'Đã xóa mẫu KPI' });
    } catch (err) {
        console.error('[KpiTemplates DELETE]', err);
        return NextResponse.json({ error: 'Lỗi hệ thống' }, { status: 500 });
    }
}
