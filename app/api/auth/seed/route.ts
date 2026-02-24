import { NextResponse } from 'next/server';
import { getAdminAuth, getAdminDb } from '@/lib/firebase-admin';
import { phoneToEmail, defaultPassword } from '@/lib/utils';
import { UserDoc } from '@/types';

export async function GET() {
    try {
        const adminAuth = getAdminAuth();
        const adminDb = getAdminDb();

        const testUsers = [
            { name: 'PT Employee', phone: '0912345678', role: 'employee' as const, type: 'PT' as const },
            { name: 'FT Employee', phone: '0987654321', role: 'employee' as const, type: 'FT' as const },
            { name: 'Test Manager', phone: '0999999999', role: 'manager' as const, type: 'FT' as const }
        ];

        for (const u of testUsers) {
            const email = phoneToEmail(u.phone);
            const password = defaultPassword(u.phone);
            let uid = '';

            try {
                const existing = await adminAuth.getUserByEmail(email);
                uid = existing.uid;
                await adminAuth.updateUser(uid, { password, displayName: u.name });
            } catch (e: any) {
                if (e.code === 'auth/user-not-found') {
                    const created = await adminAuth.createUser({ email, password, displayName: u.name });
                    uid = created.uid;
                } else {
                    throw e;
                }
            }

            const userDoc: UserDoc = {
                uid,
                name: u.name,
                phone: u.phone,
                role: u.role,
                type: u.type,
                isActive: true,
                createdAt: new Date().toISOString(),
            };

            await adminDb.collection('users').doc(uid).set(userDoc);
        }

        return NextResponse.json({ message: 'Seeded successfully' });
    } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Unknown error';
        return NextResponse.json({ error: message }, { status: 500 });
    }
}
