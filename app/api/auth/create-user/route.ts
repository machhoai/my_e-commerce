import { NextRequest, NextResponse } from 'next/server';
import { getAdminAuth, getAdminDb } from '@/lib/firebase-admin';
import { phoneToEmail, defaultPassword } from '@/lib/utils';
import { UserDoc } from '@/types';

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
        // admin: anyone
        // store_manager: manager and employee (within their store)
        // manager (with canManageHR): employee only (within their store)
        const allowedCallers = ['admin', 'store_manager', 'manager'];
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
            canManageHR, storeId: bodyStoreId,
        } = body as {
            name: string; phone: string; type: UserDoc['type'];
            dob?: string; jobTitle?: string; email?: string;
            idCard?: string; bankAccount?: string; education?: string;
            canManageHR?: boolean; storeId?: string;
        };

        let { role } = body as { role: UserDoc['role'] };

        // Enforce role restrictions
        if (callerRole === 'store_manager') {
            // store_manager can only create manager or employee
            if (!['manager', 'employee'].includes(role)) role = 'employee';
        } else if (callerRole === 'manager') {
            // manager can only create employee
            role = 'employee';
        }

        // Enforce storeId restrictions
        let effectiveStoreId: string | undefined;
        if (callerRole === 'admin') {
            effectiveStoreId = bodyStoreId; // admin can assign any store
        } else {
            effectiveStoreId = callerStoreId; // others must use their own store
        }

        if (!name || !phone || !role || !type) {
            return NextResponse.json({ error: 'Thiếu các trường bắt buộc' }, { status: 400 });
        }

        const email = phoneToEmail(phone);
        const password = defaultPassword(phone);

        const newUser = await adminAuth.createUser({
            email,
            password,
            displayName: name,
        });

        const userDoc: UserDoc = {
            uid: newUser.uid,
            name,
            phone,
            role,
            type,
            isActive: true,
            createdAt: new Date().toISOString(),
            ...(effectiveStoreId && { storeId: effectiveStoreId }),
            ...(dob && { dob }),
            ...(jobTitle && { jobTitle }),
            ...(realEmail && { email: realEmail }),
            ...(idCard && { idCard }),
            ...(bankAccount && { bankAccount }),
            ...(education && { education }),
            // Only admin can grant canManageHR
            ...(callerRole === 'admin' && canManageHR !== undefined && { canManageHR: Boolean(canManageHR) }),
        };

        await adminDb.collection('users').doc(newUser.uid).set(userDoc);

        return NextResponse.json({ uid: newUser.uid, message: 'Người dùng đã được tạo thành công' });
    } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Lỗi hệ thống';
        return NextResponse.json({ error: message }, { status: 500 });
    }
}
