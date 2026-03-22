'use client';

/**
 * PwaRedirect — mounts inside AuthProvider, runs client-side only.
 *
 * Logic:
 * • If the app is running in PWA standalone mode (installed on home screen)
 *   AND the user is authenticated → redirect to /dashboard.
 * • If already on /dashboard, do nothing (avoid redirect loop).
 * • Uses matchMedia('(display-mode: standalone)') for Chrome/Android.
 * • Also checks navigator.standalone (iOS Safari PWA).
 */

import { useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';

export default function PwaRedirect() {
    const router = useRouter();
    const pathname = usePathname();
    const { user, loading } = useAuth();

    useEffect(() => {
        // Wait until auth state resolves
        if (loading) return;
        // Must be authenticated
        if (!user) return;
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
    }, [user, loading, pathname, router]);

    return null;
}
