import { NextRequest, NextResponse } from 'next/server';
import { getAdminAuth, getAdminDb } from '@/lib/firebase-admin';
import { canManageHr } from '@/lib/hr-access';
import type { UserDoc } from '@/types';
import { assertUserInWorkplaceScope, requireWorkplaceCaller } from '@/lib/workplace/access';

export async function POST(req: NextRequest) {
    try {
        const token = req.headers.get('Authorization')?.split('Bearer ')[1];
        if (!token) return NextResponse.json({ error: 'Không có quyền truy cập' }, { status: 401 });

        const adminAuth = getAdminAuth();
        const decoded = await adminAuth.verifyIdToken(token);
        const adminDb = getAdminDb();

        const callerDoc = await adminDb.collection('users').doc(decoded.uid).get();
        if (!callerDoc.exists) return NextResponse.json({ error: 'Không có quyền truy cập' }, { status: 401 });

        const callerData = callerDoc.data() as UserDoc;
        const callerRole = callerData.role;

        // Who can toggle?
        // admin: anyone
        // store_manager: manager and employee in their own store
        // other roles with action.hr.manage (or legacy canManageHR): employees in their store
        const isAllowed = await canManageHr(adminDb, callerData);

        if (!isAllowed) {
            return NextResponse.json({ error: 'Không có quyền thực hiện thao tác này' }, { status: 403 });
        }

        const body = await req.json();
        const { targetUid, isActive } = body as { targetUid: string; isActive: boolean };

        if (!targetUid || typeof isActive !== 'boolean') {
            return NextResponse.json({ error: 'Thiếu thông tin bắt buộc' }, { status: 400 });
        }

        const targetDoc = await adminDb.collection('users').doc(targetUid).get();
        if (!targetDoc.exists) return NextResponse.json({ error: 'Không tìm thấy người dùng' }, { status: 404 });
        const target = { uid: targetUid, ...targetDoc.data() } as UserDoc;
        const targetRole = target.role;
        await assertUserInWorkplaceScope(await requireWorkplaceCaller(req), target);

        if (callerRole === 'store_manager') {
            // store_manager can toggle manager and employee in their store only
            if (!['manager', 'employee'].includes(targetRole)) {
                return NextResponse.json({ error: 'Cửa hàng trưởng chỉ có thể thao tác với Quản lý và Nhân viên' }, { status: 403 });
            }
        } else if (callerRole !== 'admin' && callerRole !== 'super_admin') {
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
