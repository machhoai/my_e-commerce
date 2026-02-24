import { NextRequest, NextResponse } from 'next/server';
import { getAdminAuth, getAdminDb } from '@/lib/firebase-admin';
import { phoneToEmail, defaultPassword } from '@/lib/utils';
import { UserDoc } from '@/types';

export async function POST(req: NextRequest) {
    try {
        // Verify the calling user is admin or manager
        const token = req.headers.get('Authorization')?.split('Bearer ')[1];
        if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

        const adminAuth = getAdminAuth();
        const decoded = await adminAuth.verifyIdToken(token);
        const adminDb = getAdminDb();

        const callerDoc = await adminDb.collection('users').doc(decoded.uid).get();
        if (!callerDoc.exists) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

        const callerRole = callerDoc.data()?.role;
        if (!['admin', 'manager'].includes(callerRole)) {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        }

        const body = await req.json();
        const { name, phone, role, type } = body as {
            name: string;
            phone: string;
            role: UserDoc['role'];
            type: UserDoc['type'];
        };

        if (!name || !phone || !role || !type) {
            return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
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
        };

        await adminDb.collection('users').doc(newUser.uid).set(userDoc);

        return NextResponse.json({ uid: newUser.uid, message: 'User created successfully' });
    } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Internal server error';
        return NextResponse.json({ error: message }, { status: 500 });
    }
}
