import { NextRequest, NextResponse } from 'next/server';
import { PROTECTED_ROUTE_PREFIXES } from '@/lib/routing';

// Paths that are public (no auth needed, no last_visited tracking)
const PUBLIC_PATHS = new Set(['/login', '/change-password']);

// Cookie name for storing the last visited protected route
const LAST_VISITED_COOKIE = 'last_visited_path';

// 7 days in seconds
const COOKIE_MAX_AGE = 7 * 24 * 60 * 60;

/**
 * Next.js Edge Middleware: Smart session check, last-visited tracking, and root redirect.
 *
 * ARCHITECTURE NOTE:
 * This app uses a hybrid auth model — Firebase Client Auth (IndexedDB) with a server-side
 * session cookie for PWA/mobile persistence. The Edge Runtime cannot run firebase-admin,
 * so the `session` cookie is used as a fast presence signal only (not cryptographic verification).
 * Real auth enforcement is handled client-side by AuthGuard + onAuthStateChanged.
 *
 * What this middleware does:
 * 1. If the user visits `/`   and has NO session cookie → redirect to /login.
 * 2. If the user visits `/` or `/login` and HAS a session cookie →
 *    redirect to: last_visited_path cookie → OR → /employee/dashboard (safe fallback).
 *    (The login page itself handles the full 3-tier priority using userDoc data.)
 * 3. For any other protected route hit, set/refresh the `last_visited_path` cookie.
 */
export function middleware(request: NextRequest) {
    const { pathname } = request.nextUrl;
    const sessionCookie = request.cookies.get('session');
    const hasSession = Boolean(sessionCookie?.value);

    // ── 1. Root ("/") handling ──────────────────────────────────────────────
    if (pathname === '/') {
        if (!hasSession) {
            // No session → send to login
            return NextResponse.redirect(new URL('/login', request.url));
        }

        // Has session → restore last visited or safe fallback
        const lastVisited = request.cookies.get(LAST_VISITED_COOKIE)?.value;
        const destination = lastVisited || '/employee/dashboard';
        return NextResponse.redirect(new URL(destination, request.url));
    }

    // ── 2. /login fast redirect for already-authenticated users ────────────
    // (The login page handles the full priority logic client-side, but this
    //  provides an instant server-side redirect to avoid flashing the login UI.)
    if (pathname === '/login' && hasSession) {
        const lastVisited = request.cookies.get(LAST_VISITED_COOKIE)?.value;
        const destination = lastVisited || '/employee/dashboard';
        return NextResponse.redirect(new URL(destination, request.url));
    }

    // ── 3. Protected routes: track last_visited_path ───────────────────────
    const isProtected = PROTECTED_ROUTE_PREFIXES.some(prefix =>
        pathname.startsWith(prefix)
    );

    if (isProtected && !PUBLIC_PATHS.has(pathname)) {
        const response = NextResponse.next();

        // Refresh the last_visited_path cookie
        response.cookies.set(LAST_VISITED_COOKIE, pathname, {
            maxAge: COOKIE_MAX_AGE,
            httpOnly: false, // Must be readable by client JS (login page redirect logic)
            secure: process.env.NODE_ENV === 'production',
            path: '/',
            sameSite: 'lax',
        });

        // Keep the existing session-status header for Server Components
        response.headers.set(
            'x-session-status',
            hasSession ? 'active' : 'none'
        );

        return response;
    }

    return NextResponse.next();
}

export const config = {
    matcher: [
        /*
         * Match:
         *  - `/` (root — redirect to login or dashboard)
         *  - `/login` (fast redirect for authenticated users)
         *  - All protected dashboard routes (for last_visited_path tracking)
         *
         * Exclude: _next/static, _next/image, favicon.ico, api routes (handled separately)
         */
        '/((?!_next/static|_next/image|favicon.ico|api/).*)',
    ],
};
