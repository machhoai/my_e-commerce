import { NextResponse } from 'next/server';
import { getAdminAuth, getAdminDb } from '@/lib/firebase-admin';

// Allow large payloads for base64 ID card photos
export const maxDuration = 30;
export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
    try {
        // Check content-length to prevent abuse (10MB limit)
        const contentLength = parseInt(request.headers.get('content-length') || '0');
        if (contentLength > 10 * 1024 * 1024) {
            return NextResponse.json({ error: 'Payload quá lớn (tối đa 10MB)' }, { status: 413 });
        }

        const authHeader = request.headers.get('Authorization');
        if (!authHeader?.startsWith('Bearer ')) {
            return NextResponse.json({ error: 'Không được phép' }, { status: 401 });
        }
        const token = authHeader.split('Bearer ')[1];

        const adminAuth = getAdminAuth();
        const decodedToken = await adminAuth.verifyIdToken(token);
        const requestUid = decodedToken.uid;

        const adminDb = getAdminDb();
        const requesterDoc = await adminDb.collection('users').doc(requestUid).get();
        if (!requesterDoc.exists) {
            return NextResponse.json({ error: 'Không tìm thấy thông tin người dùng' }, { status: 403 });
        }

        const requesterRole = requesterDoc.data()?.role;
        const requesterStoreId = requesterDoc.data()?.storeId;
        const body = await request.json();

        const targetUid = body.targetUid || requestUid;

        // Authorization rules by role
        if (requestUid !== targetUid) {
            if (requesterRole === 'employee') {
                return NextResponse.json({ error: 'Nhân viên chỉ có thể cập nhật hồ sơ của chính mình' }, { status: 403 });
            }
            if (requesterRole === 'manager') {
                const targetDoc = await adminDb.collection('users').doc(targetUid).get();
                if (!targetDoc.exists) return NextResponse.json({ error: 'Không tìm thấy người dùng' }, { status: 404 });
                const targetData = targetDoc.data();
                if (targetData?.role !== 'employee') {
                    return NextResponse.json({ error: 'Quản lý chỉ có thể chỉnh sửa nhân viên' }, { status: 403 });
                }
                if (requesterDoc.data()?.canManageHR !== true) {
                    return NextResponse.json({ error: 'Bạn không có quyền quản lý nhân sự' }, { status: 403 });
                }
                // Store isolation check
                if (targetData?.storeId && requesterStoreId && targetData.storeId !== requesterStoreId) {
                    return NextResponse.json({ error: 'Không thể chỉnh sửa nhân viên từ cửa hàng khác' }, { status: 403 });
                }
            }
            if (requesterRole === 'store_manager') {
                const targetDoc = await adminDb.collection('users').doc(targetUid).get();
                if (!targetDoc.exists) return NextResponse.json({ error: 'Không tìm thấy người dùng' }, { status: 404 });
                const targetData = targetDoc.data();
                const allowedRoles = ['manager', 'employee'];
                if (!allowedRoles.includes(targetData?.role)) {
                    return NextResponse.json({ error: 'Cửa hàng trưởng chỉ có thể chỉnh sửa Quản lý và Nhân viên' }, { status: 403 });
                }
                // Store isolation check
                if (targetData?.storeId !== requesterStoreId) {
                    return NextResponse.json({ error: 'Không thể chỉnh sửa người dùng từ cửa hàng khác' }, { status: 403 });
                }
            }
        }

        const updateData: Record<string, unknown> = {};

        // Fields anyone can update on themselves / managers on employees
        if (body.name !== undefined) updateData.name = body.name;
        if (body.dob !== undefined) updateData.dob = body.dob;
        if (body.jobTitle !== undefined) updateData.jobTitle = body.jobTitle;
        if (body.email !== undefined) updateData.email = body.email;
        if (body.idCard !== undefined) updateData.idCard = body.idCard;
        if (body.avatar !== undefined) updateData.avatar = body.avatar;
        if (body.gender !== undefined) updateData.gender = body.gender;
        if (body.permanentAddress !== undefined) updateData.permanentAddress = body.permanentAddress;
        if (body.idCardFrontPhoto !== undefined) updateData.idCardFrontPhoto = body.idCardFrontPhoto;
        if (body.idCardBackPhoto !== undefined) updateData.idCardBackPhoto = body.idCardBackPhoto;




        if (body.bankAccount !== undefined) {
            updateData.bankAccount = body.bankAccount;
        }

        if (body.education !== undefined) updateData.education = body.education;
        if (body.contractNumber !== undefined) updateData.contractNumber = body.contractNumber;
        if (body.phone !== undefined) {
            const phoneCheck = await adminDb.collection('users')
                .where('phone', '==', body.phone).limit(1).get();
            const conflict = phoneCheck.docs.find(d => d.id !== targetUid);
            if (conflict) {
                return NextResponse.json(
                    { error: 'Số điện thoại này đã được sử dụng bởi một tài khoản khác.' },
                    { status: 409 }
                );
            }
            updateData.phone = body.phone;
        }

        // type: admin OR manager/store_manager with canManageHR editing someone else
        const isPrivilegedEdit = (requestUid !== targetUid) && (
            requesterDoc.data()?.canManageHR === true ||
            requesterRole === 'store_manager'
        );
        if (requesterRole === 'admin' || isPrivilegedEdit) {
            if (body.type !== undefined) updateData.type = body.type;
        }

        // Admin-only fields
        if (requesterRole === 'admin' || requesterRole === 'super_admin') {
            if (body.role !== undefined) updateData.role = body.role;
            if (body.canManageHR !== undefined) updateData.canManageHR = Boolean(body.canManageHR);

            // Workplace assignment: workplaceType determines which ID field is populated
            if (body.workplaceType !== undefined) {
                const wt: 'STORE' | 'OFFICE' | 'CENTRAL' = body.workplaceType;
                updateData.workplaceType = wt;

                // Clear all 3 IDs first, then set the relevant one
                updateData.storeId = null;
                updateData.officeId = null;
                updateData.warehouseId = null;

                if (wt === 'STORE' && body.storeId) updateData.storeId = body.storeId;
                if (wt === 'OFFICE' && body.officeId) updateData.officeId = body.officeId;
                if (wt === 'CENTRAL' && body.warehouseId) updateData.warehouseId = body.warehouseId;
            } else {
                // Legacy: if only storeId sent (no workplaceType), assume STORE
                if (body.storeId !== undefined) {
                    updateData.storeId = body.storeId || null;
                    updateData.workplaceType = body.storeId ? 'STORE' : null;
                    updateData.officeId = null;
                    updateData.warehouseId = null;
                }
            }

            if (body.customRoleId !== undefined) updateData.customRoleId = body.customRoleId || null;
        }

        // store_manager can update canManageHR, role, and customRoleId within their store
        if (requesterRole === 'store_manager' && requestUid !== targetUid) {
            if (body.canManageHR !== undefined) updateData.canManageHR = Boolean(body.canManageHR);
            if (body.role !== undefined && ['manager', 'employee'].includes(body.role)) {
                updateData.role = body.role;
            }
            if (body.customRoleId !== undefined) updateData.customRoleId = body.customRoleId || null;
        }

        updateData.updatedAt = new Date().toISOString();

        await adminDb.collection('users').doc(targetUid).update(updateData);

        return NextResponse.json({ success: true, message: 'Cập nhật người dùng thành công' });

    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'Lỗi hệ thống khi cập nhật người dùng';
        return NextResponse.json({ error: message }, { status: 500 });
    }
}
