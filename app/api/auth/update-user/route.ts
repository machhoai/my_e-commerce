import { NextResponse } from 'next/server';
import { getAdminAuth, getAdminDb } from '@/lib/firebase-admin';

export async function POST(request: Request) {
    try {
        const authHeader = request.headers.get('Authorization');
        if (!authHeader?.startsWith('Bearer ')) {
            return NextResponse.json({ error: 'Không được phép' }, { status: 401 });
        }
        const token = authHeader.split('Bearer ')[1];

        const adminAuth = getAdminAuth();
        const decodedToken = await adminAuth.verifyIdToken(token);
        const requestUid = decodedToken.uid;

        // Check requester role
        const adminDb = getAdminDb();
        const requesterDoc = await adminDb.collection('users').doc(requestUid).get();
        if (!requesterDoc.exists) {
            return NextResponse.json({ error: 'Không tìm thấy thông tin người dùng' }, { status: 403 });
        }

        const requesterRole = requesterDoc.data()?.role;
        const body = await request.json();

        // 'targetUid' is the user to update. 
        // If not provided, assume the requester wants to update their own profile.
        const targetUid = body.targetUid || requestUid;

        // Authorization rules:
        // 1. Admin can update anyone.
        // 2. Manager can update themselves and any 'employee'.
        // 3. Employee can ONLY update themselves.

        if (requestUid !== targetUid) {
            if (requesterRole === 'employee') {
                return NextResponse.json({ error: 'Nhân viên chỉ có thể cập nhật hồ sơ của chính mình' }, { status: 403 });
            }
            if (requesterRole === 'manager') {
                const targetDoc = await adminDb.collection('users').doc(targetUid).get();
                if (targetDoc.exists && targetDoc.data()?.role !== 'employee') {
                    return NextResponse.json({ error: 'Quản lý chỉ có thể chỉnh sửa nhân viên' }, { status: 403 });
                }
                if (requesterDoc.data()?.canManageHR !== true) {
                    return NextResponse.json({ error: 'Bạn không có quyền quản lý nhân sự' }, { status: 403 });
                }
            }
        }

        // Prepare update data
        const updateData: any = {};

        // Fields anyone can update on themselves / managers on employees / admins on anyone
        if (body.name !== undefined) updateData.name = body.name;
        if (body.dob !== undefined) updateData.dob = body.dob;
        if (body.jobTitle !== undefined) updateData.jobTitle = body.jobTitle;
        if (body.email !== undefined) updateData.email = body.email;
        if (body.idCard !== undefined) updateData.idCard = body.idCard;
        if (body.bankAccount !== undefined) updateData.bankAccount = body.bankAccount;
        if (body.education !== undefined) updateData.education = body.education;
        if (body.phone !== undefined) updateData.phone = body.phone;

        // Fields ONLY Admin can update, OR Manager (with canManageHR) can update when editing an employee
        if (requesterRole === 'admin' || (requesterRole === 'manager' && requestUid !== targetUid && requesterDoc.data()?.canManageHR === true)) {
            if (body.type !== undefined) updateData.type = body.type;
        }

        // Fields ONLY Admin can update
        if (requesterRole === 'admin') {
            if (body.role !== undefined) updateData.role = body.role;
            if (body.canManageHR !== undefined) updateData.canManageHR = Boolean(body.canManageHR);
        }

        updateData.updatedAt = new Date().toISOString();

        // Perform Firestore update
        await adminDb.collection('users').doc(targetUid).update(updateData);

        return NextResponse.json({ success: true, message: 'Cập nhật người dùng thành công' });

    } catch (error: any) {
        console.error('Lỗi cập nhật người dùng:', error);
        return NextResponse.json(
            { error: error.message || 'Lỗi hệ thống khi cập nhật người dùng' },
            { status: 500 }
        );
    }
}
