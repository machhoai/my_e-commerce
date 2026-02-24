import { NextRequest, NextResponse } from 'next/server';
import { getAdminAuth, getAdminDb } from '@/lib/firebase-admin';
import { phoneToEmail, defaultPassword } from '@/lib/utils';
import { UserDoc } from '@/types';

export async function POST(req: NextRequest) {
    try {
        // Verify the calling user is admin or manager
        const token = req.headers.get('Authorization')?.split('Bearer ')[1];
        if (!token) return NextResponse.json({ error: 'Không được phép' }, { status: 401 });

        const adminAuth = getAdminAuth();
        const decoded = await adminAuth.verifyIdToken(token);
        const adminDb = getAdminDb();

        const callerDoc = await adminDb.collection('users').doc(decoded.uid).get();
        if (!callerDoc.exists) return NextResponse.json({ error: 'Không được phép' }, { status: 401 });

        const callerRole = callerDoc.data()?.role;
        if (!['admin', 'manager'].includes(callerRole)) {
            return NextResponse.json({ error: 'Bị từ chối truy cập' }, { status: 403 });
        }

        const body = await req.json();

        let { role } = body as { role: UserDoc['role'] };
        // Enforce manager limitations: managers can ONLY create 'employee' roles
        if (callerRole === 'manager') {
            role = 'employee';
        }

        const { name, phone, type, dob, jobTitle, email: realEmail, idCard, bankAccount, education } = body as {
            name: string;
            phone: string;
            type: UserDoc['type'];
            dob?: string;
            jobTitle?: string;
            email?: string;
            idCard?: string;
            bankAccount?: string;
            education?: string;
        };

        if (!name || !phone || !role || !type) {
            return NextResponse.json({ error: 'Thiếu các trường bắt buộc' }, { status: 400 });
        }

        const email = phoneToEmail(phone);
        const password = defaultPassword(phone);

        // Create Firebase Auth user (does NOT log out the calling admin)
        const newUser = await adminAuth.createUser({
            email,
            password,
            displayName: name,
        });

        // Write Firestore user doc
        const userDoc: UserDoc = {
            uid: newUser.uid,
            name,
            phone,
            role,
            type,
            isActive: true,
            createdAt: new Date().toISOString(),
            ...(dob && { dob }),
            ...(jobTitle && { jobTitle }),
            ...(realEmail && { email: realEmail }),
            ...(idCard && { idCard }),
            ...(bankAccount && { bankAccount }),
            ...(education && { education }),
        };

        await adminDb.collection('users').doc(newUser.uid).set(userDoc);

        return NextResponse.json({ uid: newUser.uid, message: 'Người dùng đã được tạo thành công' });
    } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Lỗi hệ thống';
        return NextResponse.json({ error: message }, { status: 500 });
    }
}
