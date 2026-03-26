import { NextRequest, NextResponse } from 'next/server';
import { getAdminAuth, getAdminDb } from '@/lib/firebase-admin';

/**
 * GET /api/auth/2fa/generate
 * Generates a TOTP secret + QR code for the authenticated user.
 * The secret is NOT saved to Firestore yet — it's held client-side
 * until the user verifies it with a valid OTP code.
 */
export async function GET(req: NextRequest) {
    try {
        const token = req.headers.get('Authorization')?.split('Bearer ')[1];
        if (!token) {
            return NextResponse.json({ error: 'Không được phép' }, { status: 401 });
        }

        const adminAuth = getAdminAuth();
        const decoded = await adminAuth.verifyIdToken(token);
        const uid = decoded.uid;

        // Fetch user doc to get display label
        const adminDb = getAdminDb();
        const userSnap = await adminDb.collection('users').doc(uid).get();
        if (!userSnap.exists) {
            return NextResponse.json({ error: 'Không tìm thấy người dùng' }, { status: 404 });
        }

        const userData = userSnap.data()!;
        const label = userData.email || userData.name || userData.phone || uid;

        // Dynamic import to avoid ESM/CJS issues
        const { generateSecret, generateURI } = await import('otplib');
        const QRCode = (await import('qrcode')).default;

        // Generate TOTP secret
        const secret = generateSecret();

        // Build otpauth URI
        const otpauthUrl = generateURI({
            strategy: 'totp',
            secret,
            label,
            issuer: 'B.Duck Cityfuns ERP',
        });

        // Generate QR code as Data URL
        const qrCodeUrl = await QRCode.toDataURL(otpauthUrl, {
            width: 280,
            margin: 2,
            color: { dark: '#1a1a2e', light: '#ffffff' },
        });

        return NextResponse.json({ secret, qrCodeUrl });
    } catch (err: unknown) {
        console.error('2FA generate error:', err);
        const message = err instanceof Error ? err.message : 'Lỗi hệ thống';
        return NextResponse.json({ error: message }, { status: 500 });
    }
}
