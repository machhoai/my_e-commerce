import { NextRequest, NextResponse } from 'next/server';
import { getAdminAuth, getAdminDb } from '@/lib/firebase-admin';

export async function POST(req: NextRequest) {
    try {
        const token = req.headers.get('Authorization')?.split('Bearer ')[1];
        if (!token) return NextResponse.json({ error: 'Không có quyền truy cập' }, { status: 401 });

        const adminAuth = getAdminAuth();
        const decoded = await adminAuth.verifyIdToken(token);
        const adminDb = getAdminDb();

        const callerDoc = await adminDb.collection('users').doc(decoded.uid).get();
        if (!callerDoc.exists) return NextResponse.json({ error: 'Không có quyền truy cập' }, { status: 401 });

        const callerRole = callerDoc.data()?.role;
        const canManageHR = callerDoc.data()?.canManageHR;

        if (callerRole !== 'admin' && (callerRole !== 'manager' || canManageHR !== true)) {
            return NextResponse.json({ error: 'Không có quyền thực hiện thao tác này' }, { status: 403 });
        }

        const body = await req.json();
        const { targetUid, isActive } = body as { targetUid: string; isActive: boolean };

        if (!targetUid || typeof isActive !== 'boolean') {
            return NextResponse.json({ error: 'Thiếu thông tin bắt buộc' }, { status: 400 });
        }

        // Prevent manager from deactivating admins or other managers
        if (callerRole === 'manager') {
            const targetDoc = await adminDb.collection('users').doc(targetUid).get();
            if (!targetDoc.exists) return NextResponse.json({ error: 'Không tìm thấy người dùng' }, { status: 404 });
            const targetRole = targetDoc.data()?.role;
            if (targetRole !== 'employee') {
                return NextResponse.json({ error: 'Quản lý chỉ có thể thay đổi trạng thái nhân viên' }, { status: 403 });
            }
        }

        await adminDb.collection('users').doc(targetUid).update({ isActive });

        return NextResponse.json({ success: true, isActive });
    } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Lỗi hệ thống';
        return NextResponse.json({ error: message }, { status: 500 });
    }
}
