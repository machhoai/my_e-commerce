'use client';

/**
 * PwaRedirect — mounts inside AuthProvider, runs client-side only.
 *
 * Logic:
 * • If the app is running in PWA standalone mode (installed on home screen)
 *   AND the user is authenticated
 *   AND the user has a role allowed to use the mobile dashboard
 *   → redirect to /dashboard.
 * • If already on /dashboard, do nothing (avoid redirect loop).
 *
 * Allowed roles: admin, super_admin, store_manager
 */

import { useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';

// Roles that are allowed to be redirected to the mobile dashboard
const DASHBOARD_ROLES = new Set(['admin', 'super_admin', 'store_manager']);

export default function PwaRedirect() {
    const router = useRouter();
    const pathname = usePathname();
    const { user, userDoc, loading } = useAuth();

    useEffect(() => {
        // Wait until auth state fully resolves (including userDoc)
        if (loading) return;
        // Must be authenticated
        if (!user || !userDoc) return;
        // Only allowed roles
        if (!DASHBOARD_ROLES.has(userDoc.role)) return;
        // Already on dashboard — nothing to do
        if (pathname.startsWith('/dashboard')) return;

        // Detect PWA standalone mode
        const isStandalone =
            window.matchMedia('(display-mode: standalone)').matches ||
            // iOS Safari
            (navigator as { standalone?: boolean }).standalone === true;

        if (isStandalone) {
            router.replace('/dashboard');
        }
    }, [user, userDoc, loading, pathname, router]);

    return null;
}
