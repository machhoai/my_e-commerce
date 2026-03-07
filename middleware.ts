import { NextRequest, NextResponse } from 'next/server';

/**
 * Next.js Middleware: Session cookie guard for protected routes.
 *
 * Checks for the presence of the 'session' cookie on dashboard routes.
 * If missing, redirects to /login. This provides a server-side safety net
 * for PWA users whose client-side auth state may have been evicted.
 *
 * NOTE: We intentionally do NOT verify the cookie cryptographically here
 * because Firebase Admin SDK doesn't run in Edge Runtime. The actual
 * Firebase auth state handles authorization; this is purely a UX guard
 * to prevent flashing dashboard UI before client-side redirect kicks in.
 */
export function middleware(request: NextRequest) {
    const { pathname } = request.nextUrl;

    // Check for session cookie on protected routes
    const sessionCookie = request.cookies.get('session');

    if (!sessionCookie?.value) {
        // No session cookie — redirect to login
        const loginUrl = new URL('/login', request.url);
        loginUrl.searchParams.set('redirect', pathname);
        return NextResponse.redirect(loginUrl);
    }

    return NextResponse.next();
}

export const config = {
    // Only run middleware on dashboard (protected) routes.
    // The (dashboard) route group means URLs are /admin/*, /manager/*, etc.
    // Exclude: /login, /api/*, /_next/*, static files, manifest, etc.
    matcher: [
        '/admin/:path*',
        '/manager/:path*',
        '/employee/:path*',
        '/notifications/:path*',
        '/profile/:path*',
        '/change-password',
    ],
};
