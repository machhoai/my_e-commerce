import { NextRequest, NextResponse } from 'next/server';

/**
 * Next.js Middleware: Soft session check for protected routes.
 *
 * IMPORTANT: This middleware must NOT hard-redirect to /login when the
 * session cookie is missing. Firebase Client Auth stores state in IndexedDB,
 * which cannot be read from middleware (runs in Edge Runtime). Redirecting
 * here would kill the client-side auth recovery cycle — the client's
 * onAuthStateChanged never gets a chance to fire, verify the valid IndexedDB
 * token, and sync it back to a session cookie.
 *
 * Route protection is handled client-side by AuthGuard, which correctly
 * waits for onAuthStateChanged to resolve before deciding whether to
 * redirect to /login.
 *
 * This middleware only adds a header indicating the session status so that
 * Server Components can optionally use it for SSR decisions.
 */
export function middleware(request: NextRequest) {
    const sessionCookie = request.cookies.get('session');
    const response = NextResponse.next();

    // Pass session status as a header for Server Components (optional SSR use)
    response.headers.set(
        'x-session-status',
        sessionCookie?.value ? 'active' : 'none'
    );

    return response;
}

export const config = {
    // Run on protected routes — but only to set headers, never to redirect.
    matcher: [
        '/admin/:path*',
        '/manager/:path*',
        '/employee/:path*',
        '/notifications/:path*',
        '/profile/:path*',
        '/change-password',
    ],
};
