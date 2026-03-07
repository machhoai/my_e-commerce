import { NextRequest, NextResponse } from 'next/server';
import { getAdminAuth } from '@/lib/firebase-admin';
import { cookies } from 'next/headers';

// 7 days in milliseconds (for Firebase Admin createSessionCookie)
const SESSION_EXPIRY_MS = 7 * 24 * 60 * 60 * 1000; // 604800000
// 7 days in seconds (for cookie maxAge)
const SESSION_EXPIRY_SECONDS = 7 * 24 * 60 * 60; // 604800

/**
 * POST /api/auth/session
 * Creates a server-side session cookie from a Firebase ID token.
 * This ensures the user stays logged in for 7 days even if the browser
 * evicts IndexedDB/localStorage (common on mobile PWAs, especially iOS).
 */
export async function POST(req: NextRequest) {
    try {
        const { idToken } = await req.json();

        if (!idToken) {
            return NextResponse.json({ error: 'Missing idToken' }, { status: 400 });
        }

        const adminAuth = getAdminAuth();

        // Create a session cookie using Firebase Admin SDK
        const sessionCookie = await adminAuth.createSessionCookie(idToken, {
            expiresIn: SESSION_EXPIRY_MS,
        });

        // Set the cookie in the response
        const cookieStore = await cookies();
        cookieStore.set('session', sessionCookie, {
            maxAge: SESSION_EXPIRY_SECONDS,
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            path: '/',
            sameSite: 'lax',
        });

        return NextResponse.json({ status: 'success' });
    } catch (error) {
        console.error('Failed to create session cookie:', error);
        return NextResponse.json(
            { error: 'Failed to create session' },
            { status: 401 }
        );
    }
}

/**
 * DELETE /api/auth/session
 * Clears the session cookie on logout.
 */
export async function DELETE() {
    try {
        const cookieStore = await cookies();
        cookieStore.set('session', '', {
            maxAge: 0,
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            path: '/',
            sameSite: 'lax',
        });

        return NextResponse.json({ status: 'success' });
    } catch (error) {
        console.error('Failed to clear session cookie:', error);
        return NextResponse.json(
            { error: 'Failed to clear session' },
            { status: 500 }
        );
    }
}
