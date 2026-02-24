import { NextRequest, NextResponse } from 'next/server';
import { getAdminAuth, getAdminDb } from '@/lib/firebase-admin';
import { UserRole } from '@/types';

export async function POST(req: NextRequest) {
    try {
        const token = req.headers.get('Authorization')?.split('Bearer ')[1];
        if (!token) return NextResponse.json({ error: 'Không được phép' }, { status: 401 });

        const adminAuth = getAdminAuth();
        const decoded = await adminAuth.verifyIdToken(token);
        const adminDb = getAdminDb();

        // Only admin can change roles
        const callerDoc = await adminDb.collection('users').doc(decoded.uid).get();
        if (!callerDoc.exists || callerDoc.data()?.role !== 'admin') {
            return NextResponse.json({ error: 'Bị từ chối truy cập' }, { status: 403 });
        }

        const { targetUid, role } = await req.json() as { targetUid: string; role: UserRole };

        if (!targetUid || !role) {
            return NextResponse.json({ error: 'Thiếu thông tin targetUid và role' }, { status: 400 });
        }

        const validRoles: UserRole[] = ['admin', 'manager', 'employee'];
        if (!validRoles.includes(role)) {
            return NextResponse.json({ error: 'Vai trò không hợp lệ' }, { status: 400 });
        }

        await adminDb.collection('users').doc(targetUid).update({ role });

        return NextResponse.json({ message: 'Cập nhật vai trò thành công' });
    } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Lỗi hệ thống';
        return NextResponse.json({ error: message }, { status: 500 });
    }
}
