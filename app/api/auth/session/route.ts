import { NextRequest, NextResponse } from 'next/server';
import { getAdminAuth } from '@/lib/firebase-admin';
import { cookies } from 'next/headers';

// 7 days in milliseconds (for Firebase Admin createSessionCookie)
const SESSION_EXPIRY_MS = 7 * 24 * 60 * 60 * 1000; // 604800000
// 7 days in seconds (for cookie maxAge)
const SESSION_EXPIRY_SECONDS = 7 * 24 * 60 * 60; // 604800

/**
 * GET /api/auth/session
 * Verifies the session cookie and returns a custom token for client-side
 * re-authentication. This is the recovery path: when the browser evicts
 * IndexedDB (common on mobile PWAs), onAuthStateChanged fires with null.
 * The client calls this endpoint to check if the session cookie is still
 * valid and, if so, gets a custom token to silently re-authenticate.
 */
export async function GET() {
    try {
        const cookieStore = await cookies();
        const sessionCookie = cookieStore.get('session')?.value;

        if (!sessionCookie) {
            return NextResponse.json({ authenticated: false }, { status: 401 });
        }

        const adminAuth = getAdminAuth();

        // Verify the session cookie — throws if expired or invalid
        const decodedClaims = await adminAuth.verifySessionCookie(sessionCookie, true);

        // Create a custom token so the client can re-authenticate via
        // signInWithCustomToken() without asking the user for credentials
        const customToken = await adminAuth.createCustomToken(decodedClaims.uid);

        return NextResponse.json({ authenticated: true, customToken });
    } catch (error) {
        console.error('Session verification failed:', error);
        // Session cookie is invalid or expired — clear it
        try {
            const cookieStore = await cookies();
            cookieStore.set('session', '', {
                maxAge: 0,
                httpOnly: true,
                secure: process.env.NODE_ENV === 'production',
                path: '/',
                sameSite: 'lax',
            });
        } catch { /* best effort */ }
        return NextResponse.json({ authenticated: false }, { status: 401 });
    }
}

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

        // Clear the server-side session cookie
        cookieStore.set('session', '', {
            maxAge: 0,
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            path: '/',
            sameSite: 'lax',
        });

        // Clear last_visited_path so the next login won't resurrect a stale destination
        cookieStore.set('last_visited_path', '', {
            maxAge: 0,
            httpOnly: false, // non-httpOnly so client JS can also clear it
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
