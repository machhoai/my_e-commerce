import { NextRequest, NextResponse } from 'next/server';
import { PROTECTED_ROUTE_PREFIXES } from '@/lib/routing';

// Paths that are public (no auth needed, no last_visited tracking)
const PUBLIC_PATHS = new Set(['/login', '/change-password', '/403']);

// Cookie name for storing the last visited protected route
const LAST_VISITED_COOKIE = 'last_visited_path';

// Cookie name storing the user's base role (plain text, set at login for Edge middleware)
const USER_ROLE_COOKIE = 'user_role';

// Roles that are allowed to access /admin/* routes
const ADMIN_ROLES = new Set(['admin', 'super_admin']);

// 7 days in seconds
const COOKIE_MAX_AGE = 7 * 24 * 60 * 60;

/**
 * Next.js Edge Middleware: Smart session check, /admin hardlock, last-visited tracking.
 *
 * ARCHITECTURE NOTE:
 * This app uses a hybrid auth model — Firebase Client Auth (IndexedDB) with a server-side
 * session cookie for PWA/mobile persistence. The Edge Runtime cannot run firebase-admin,
 * so the `session` cookie is used as a fast presence signal only (not cryptographic verification).
 * Real auth enforcement is handled client-side by AuthGuard + onAuthStateChanged.
 *
 * The `user_role` cookie (plain text, httpOnly: false) is set on the client after login
 * purely so the Edge middleware can make role-based redirect decisions without a DB call.
 *
 * What this middleware does:
 * 1. If the user visits `/`  and has NO session cookie → redirect to /login.
 * 2. If the user visits `/` and HAS a session cookie →
 *    redirect to: last_visited_path cookie → OR → /employee/dashboard (safe fallback).
 * 3. /admin/* lock: if user_role is not admin/super_admin → redirect to /403.
 * 4. For any other protected route hit, set/refresh the `last_visited_path` cookie.
 */
// ── CORS headers for public API routes (external event apps) ──────────────
const CORS_HEADERS = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

export function middleware(request: NextRequest) {
    const { pathname } = request.nextUrl;
    const sessionCookie = request.cookies.get('session');
    const hasSession = Boolean(sessionCookie?.value);
    const userRole = request.cookies.get(USER_ROLE_COOKIE)?.value ?? '';

    // ── CORS: handle all /api/v1/* routes (preflight + actual requests) ─────
    if (pathname.startsWith('/api/v1/')) {
        // Preflight: respond immediately with CORS headers
        if (request.method === 'OPTIONS') {
            return new NextResponse(null, { status: 204, headers: CORS_HEADERS });
        }
        // Actual request: pass through but inject CORS headers into response
        const response = NextResponse.next();
        Object.entries(CORS_HEADERS).forEach(([key, value]) => {
            response.headers.set(key, value);
        });
        return response;
    }

    // ── 1. Root ("/") handling ──────────────────────────────────────────────
    if (pathname === '/') {
        if (!hasSession) {
            return NextResponse.redirect(new URL('/login', request.url));
        }
        // Has session → restore last visited or safe fallback
        const lastVisited = request.cookies.get(LAST_VISITED_COOKIE)?.value;
        const destination = lastVisited || '/employee/dashboard';
        return NextResponse.redirect(new URL(destination, request.url));
    }

    // ── 2. /login — fast redirect for already-authenticated users ─────────
    // If the user already has a session cookie, redirect them away from /login.
    // We use `user_role` + `last_visited_path` to pick the right destination.
    // The login page client-side logic is STILL the authoritative handler for
    // defaultDashboard/roleDefaultRoute, but this server-side shortcut avoids
    // the infinite spinner caused by Firebase Auth resolving while /login renders.
    if (pathname === '/login' && hasSession) {
        const lastVisited = request.cookies.get(LAST_VISITED_COOKIE)?.value;
        // If userRole is known and is admin, send to last_visited or /admin/users.
        // Otherwise, send to last_visited or the safe universal fallback.
        const adminFallback = ADMIN_ROLES.has(userRole) ? '/admin/users' : '/employee/dashboard';
        const destination = lastVisited || adminFallback;
        return NextResponse.redirect(new URL(destination, request.url));
    }

    // ── 3. /admin hardlock — only admin & super_admin allowed ──────────────

    if (pathname.startsWith('/admin')) {
        if (!hasSession) {
            return NextResponse.redirect(new URL('/login', request.url));
        }
        if (!ADMIN_ROLES.has(userRole)) {
            return NextResponse.redirect(new URL('/403', request.url));
        }
    }

    // ── 3b. /dashboard — PWA mobile home (admin + store_manager only) ─────────
    if (pathname.startsWith('/dashboard')) {
        if (!hasSession) {
            return NextResponse.redirect(new URL('/login', request.url));
        }
        const DASHBOARD_ROLES = new Set(['admin', 'super_admin', 'store_manager']);
        if (!DASHBOARD_ROLES.has(userRole)) {
            return NextResponse.redirect(new URL('/403', request.url));
        }
        // Do NOT update last_visited_path so desktop users' last real path
        // stays untouched when they close the PWA.
        return NextResponse.next();
    }

    // ── 4. Protected routes: track last_visited_path ───────────────────────
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
         *  - All protected dashboard routes (for last_visited_path tracking)
         *  - /api/v1/* — public event API routes (for CORS preflight handling)
         *
         * Exclude: _next/static, _next/image, favicon.ico, other api routes (handled separately)
         */
        '/((?!_next/static|_next/image|favicon.ico|api/).*)',
        '/api/v1/(.*)',
    ],
};
