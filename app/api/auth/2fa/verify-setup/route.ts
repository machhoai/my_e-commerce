import { NextRequest, NextResponse } from 'next/server';
import { getAdminAuth, getAdminDb } from '@/lib/firebase-admin';

/**
 * POST /api/auth/2fa/verify-setup
 * Verifies the user's 6-digit TOTP code against the temporary secret.
 * If valid, persists the secret to Firestore and enables 2FA.
 *
 * Body: { token: string, secret: string }
 */
export async function POST(req: NextRequest) {
    try {
        const authHeader = req.headers.get('Authorization')?.split('Bearer ')[1];
        if (!authHeader) {
            return NextResponse.json({ error: 'Không được phép' }, { status: 401 });
        }

        const adminAuth = getAdminAuth();
        const decoded = await adminAuth.verifyIdToken(authHeader);
        const uid = decoded.uid;

        const body = await req.json();
        const { token, secret } = body as { token?: string; secret?: string };

        if (!token || !secret) {
            return NextResponse.json(
                { error: 'Thiếu mã xác thực hoặc secret' },
                { status: 400 }
            );
        }

        // Validate the 6-digit code format
        if (!/^\d{6}$/.test(token)) {
            return NextResponse.json(
                { error: 'Mã xác thực phải gồm 6 chữ số' },
                { status: 400 }
            );
        }

        // Dynamic import to avoid ESM/CJS issues
        const { verifySync } = await import('otplib');

        // Verify the TOTP token against the secret
        const result = verifySync({ token, secret });

        if (!result.valid) {
            return NextResponse.json(
                { error: 'Mã xác thực không đúng. Vui lòng thử lại.' },
                { status: 400 }
            );
        }

        // Token is valid — persist 2FA config to Firestore
        const adminDb = getAdminDb();
        await adminDb.collection('users').doc(uid).update({
            twoFactorSecret: secret,
            isTwoFactorEnabled: true,
        });

        return NextResponse.json({ success: true, message: 'Bật xác thực 2 bước thành công!' });
    } catch (err: unknown) {
        console.error('2FA verify-setup error:', err);
        const message = err instanceof Error ? err.message : 'Lỗi hệ thống';
        return NextResponse.json({ error: message }, { status: 500 });
    }
}
