import { NextRequest, NextResponse } from 'next/server';
import { getAdminAuth, getAdminDb } from '@/lib/firebase-admin';
import { defaultPassword } from '@/contexts/AuthContext';

export async function POST(req: NextRequest) {
    try {
        const token = req.headers.get('Authorization')?.split('Bearer ')[1];
        if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

        const adminAuth = getAdminAuth();
        const decoded = await adminAuth.verifyIdToken(token);
        const adminDb = getAdminDb();

        // Only admin can reset passwords
        const callerDoc = await adminDb.collection('users').doc(decoded.uid).get();
        if (!callerDoc.exists || callerDoc.data()?.role !== 'admin') {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        }

        const { targetUid } = await req.json() as { targetUid: string };
        if (!targetUid) return NextResponse.json({ error: 'targetUid required' }, { status: 400 });

        const targetDoc = await adminDb.collection('users').doc(targetUid).get();
        if (!targetDoc.exists) return NextResponse.json({ error: 'User not found' }, { status: 404 });

        const phone: string = targetDoc.data()?.phone ?? '';
        const password = defaultPassword(phone);

        await adminAuth.updateUser(targetUid, { password });

        return NextResponse.json({ message: 'Password reset to default successfully' });
    } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Internal server error';
        return NextResponse.json({ error: message }, { status: 500 });
    }
}
