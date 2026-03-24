import { NextRequest, NextResponse } from 'next/server';
import { getAdminAuth, getAdminDb } from '@/lib/firebase-admin';
import { phoneToEmail, defaultPassword } from '@/lib/utils';
import { UserDoc } from '@/types';

// Allow large payloads for base64 ID card photos
export const maxDuration = 30;
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
    try {
        const token = req.headers.get('Authorization')?.split('Bearer ')[1];
        if (!token) return NextResponse.json({ error: 'Không được phép' }, { status: 401 });

        const adminAuth = getAdminAuth();
        const decoded = await adminAuth.verifyIdToken(token);
        const adminDb = getAdminDb();

        const callerDoc = await adminDb.collection('users').doc(decoded.uid).get();
        if (!callerDoc.exists) return NextResponse.json({ error: 'Không được phép' }, { status: 401 });

        const callerRole = callerDoc.data()?.role;
        const callerStoreId = callerDoc.data()?.storeId;

        // Who can create users?
        const allowedCallers = ['admin', 'super_admin', 'store_manager', 'manager'];
        if (!allowedCallers.includes(callerRole)) {
            return NextResponse.json({ error: 'Bị từ chối truy cập' }, { status: 403 });
        }
        if (callerRole === 'manager' && callerDoc.data()?.canManageHR !== true) {
            return NextResponse.json({ error: 'Bạn không có quyền tạo người dùng' }, { status: 403 });
        }

        const body = await req.json();
        const {
            name, phone, type, dob, jobTitle,
            email: realEmail, idCard, bankAccount, education,
            gender, permanentAddress, idCardFrontPhoto, idCardBackPhoto,
            canManageHR,
            // Workplace assignment
            workplaceType: bodyWorkplaceType,
            storeId: bodyStoreId,
            officeId: bodyOfficeId,
            warehouseId: bodyWarehouseId,
        } = body as {
            name: string; phone: string; type: UserDoc['type'];
            dob?: string; jobTitle?: string; email?: string;
            idCard?: string; bankAccount?: string; education?: string;
            gender?: string; permanentAddress?: string;
            idCardFrontPhoto?: string; idCardBackPhoto?: string;
            canManageHR?: boolean;
            workplaceType?: 'STORE' | 'OFFICE' | 'CENTRAL';
            storeId?: string; officeId?: string; warehouseId?: string;
        };

        let { role } = body as { role: UserDoc['role'] };

        // Enforce role restrictions
        if (callerRole === 'store_manager') {
            if (!['manager', 'employee'].includes(role)) role = 'employee';
        } else if (callerRole === 'manager') {
            role = 'employee';
        }

        // Resolve workplaceType and the single location ID
        const isAdmin = callerRole === 'admin' || callerRole === 'super_admin';
        const effectiveWorkplaceType: 'STORE' | 'OFFICE' | 'CENTRAL' = isAdmin
            ? (bodyWorkplaceType || 'STORE')
            : 'STORE'; // non-admin always creates within their store

        const effectiveStoreId = isAdmin ? bodyStoreId : callerStoreId;
        const effectiveOfficeId = isAdmin ? bodyOfficeId : undefined;
        const effectiveWarehouseId = isAdmin ? bodyWarehouseId : undefined;

        if (!name || !phone || !role || !type) {
            return NextResponse.json({ error: 'Thiếu các trường bắt buộc' }, { status: 400 });
        }

        // Check phone uniqueness before creating the Firebase Auth user
        const phoneCheck = await adminDb.collection('users')
            .where('phone', '==', phone).limit(1).get();
        if (!phoneCheck.empty) {
            return NextResponse.json(
                { error: 'Số điện thoại này đã được sử dụng bởi một tài khoản khác.' },
                { status: 409 }
            );
        }

        const email = phoneToEmail(phone);
        const password = defaultPassword(phone);

        const newUser = await adminAuth.createUser({ email, password, displayName: name });

        const userDoc: UserDoc = {
            uid: newUser.uid,
            name,
            phone,
            role,
            type,
            isActive: true,
            createdAt: new Date().toISOString(),
            workplaceType: effectiveWorkplaceType,
            ...(effectiveStoreId && { storeId: effectiveStoreId }),
            ...(effectiveOfficeId && { officeId: effectiveOfficeId }),
            ...(effectiveWarehouseId && { warehouseId: effectiveWarehouseId }),
            ...(dob && { dob }),
            ...(jobTitle && { jobTitle }),
            ...(realEmail && { email: realEmail }),
            ...(idCard && { idCard }),
            ...(bankAccount && { bankAccount }),
            ...(education && { education }),
            ...(gender && { gender }),
            ...(permanentAddress && { permanentAddress }),
            ...(idCardFrontPhoto && { idCardFrontPhoto }),
            ...(idCardBackPhoto && { idCardBackPhoto }),
            ...(isAdmin && canManageHR !== undefined && { canManageHR: Boolean(canManageHR) }),
        };

        await adminDb.collection('users').doc(newUser.uid).set(userDoc);

        return NextResponse.json({ uid: newUser.uid, message: 'Người dùng đã được tạo thành công' });
    } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Lỗi hệ thống';
        return NextResponse.json({ error: message }, { status: 500 });
    }
}
