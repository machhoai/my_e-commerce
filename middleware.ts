import { NextRequest, NextResponse } from 'next/server';
import { PROTECTED_ROUTE_PREFIXES } from '@/lib/routing';

// Paths that are public (no auth needed)
const PUBLIC_PATHS = new Set(['/login', '/change-password', '/403']);

// Cookie name storing the user's base role (plain text, set at login for Edge middleware)
const USER_ROLE_COOKIE = 'user_role';

// Roles that are allowed to access /admin/* routes
const ADMIN_ROLES = new Set(['admin', 'super_admin']);

// 7 days in seconds
const COOKIE_MAX_AGE = 7 * 24 * 60 * 60;

// ── Device detection ─────────────────────────────────────────────────────────
const MOBILE_UA_REGEX =
    /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini|Mobile|mobile|CriOS|FxiOS/i;

// Paths that bypass device-based routing (served from app root, not desktop/mobile)
const DEVICE_BYPASS_PREFIXES = ['/api', '/_next', '/p/', '/403'];
const DEVICE_BYPASS_EXTENSIONS = /\.(png|ico|svg|jpg|jpeg|webp|gif|js|css|woff2?|ttf|eot|map|json|webmanifest)$/i;

/**
 * Next.js Edge Middleware: Smart session check, /admin hardlock, last-visited tracking,
 * AND device-based routing (desktop/mobile rewrite).
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
 * 5. Device-based rewrite: mobile UA → /mobile/*, desktop/tablet → /desktop/*.
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
        // Has session → always go to dashboard
        return NextResponse.redirect(new URL('/dashboard', request.url));
    }

    // ── 2. /login — fast redirect for already-authenticated users ─────────
    // If the user already has a session cookie, redirect them to /dashboard.
    if (pathname === '/login' && hasSession) {
        return NextResponse.redirect(new URL('/dashboard', request.url));
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

    // ── 3b. /dashboard — all authenticated users can access ───────────────
    if (pathname.startsWith('/dashboard')) {
        if (!hasSession) {
            return NextResponse.redirect(new URL('/login', request.url));
        }
        // Fall through to device-rewrite below ↓
    }

    // ── 4. Protected routes ────────────────────────────────────────────────
    const isProtected = PROTECTED_ROUTE_PREFIXES.some(prefix =>
        pathname.startsWith(prefix)
    );

    let response: NextResponse;

    if (isProtected && !PUBLIC_PATHS.has(pathname)) {
        response = NextResponse.next();

        response.headers.set(
            'x-session-status',
            hasSession ? 'active' : 'none'
        );
    } else {
        response = NextResponse.next();
    }

    // ── 5. Device-based rewrite (desktop ↔ mobile) ────────────────────────
    // Skip rewrite for paths that should be served from app root directly
    const shouldBypass =
        DEVICE_BYPASS_PREFIXES.some(prefix => pathname.startsWith(prefix)) ||
        DEVICE_BYPASS_EXTENSIONS.test(pathname) ||
        pathname.startsWith('/desktop') ||
        pathname.startsWith('/mobile');

    if (!shouldBypass) {
        const ua = request.headers.get('user-agent') || '';
        const isMobile = MOBILE_UA_REGEX.test(ua);
        const rewritePrefix = isMobile ? '/mobile' : '/desktop';
        const rewriteUrl = new URL(rewritePrefix + pathname + request.nextUrl.search, request.url);

        // Create a rewrite response and copy over any cookies/headers set above
        const rewriteResponse = NextResponse.rewrite(rewriteUrl);

        // Copy cookies from the original response (last_visited_path, etc.)
        response.cookies.getAll().forEach(cookie => {
            rewriteResponse.cookies.set(cookie.name, cookie.value, {
                maxAge: COOKIE_MAX_AGE,
                httpOnly: false,
                secure: process.env.NODE_ENV === 'production',
                path: '/',
                sameSite: 'lax',
            });
        });

        // Copy custom headers
        response.headers.forEach((value, key) => {
            rewriteResponse.headers.set(key, value);
        });

        return rewriteResponse;
    }

    return response;
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
