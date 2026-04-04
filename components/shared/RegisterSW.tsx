'use client';

import { useEffect } from 'react';

/**
 * RegisterSW — registers the Service Worker as early as possible.
 *
 * This component MUST be mounted in the root layout (app/layout.tsx) so that
 * the SW is registered on every page, not just when the user grants notification
 * permission. Without this, on production (Vercel) the SW is never installed
 * and push notifications fail silently.
 *
 * Why a dedicated component instead of doing it in SilentPwaUpdater?
 * SilentPwaUpdater calls navigator.serviceWorker.ready without first registering
 * the SW — it just passively listens. This component actively registers.
 */
export default function RegisterSW(): null {
    useEffect(() => {
        if (
            typeof window === 'undefined' ||
            !('serviceWorker' in navigator)
        ) return;

        const register = async () => {
            try {
                // Check if SW is already registered to avoid duplicate installs
                const registrations = await navigator.serviceWorker.getRegistrations();
                const existing = registrations.find(r =>
                    r.scope === `${location.origin}/` ||
                    r.active?.scriptURL?.includes('/sw.js') ||
                    r.installing?.scriptURL?.includes('/sw.js') ||
                    r.waiting?.scriptURL?.includes('/sw.js')
                );

                if (existing) {
                    console.log('[SW] Already registered, scope:', existing.scope, '| active state:', existing.active?.state);
                    return;
                }

                // Register the main service worker
                const registration = await navigator.serviceWorker.register('/sw.js', {
                    scope: '/',
                    // updateViaCache: 'none' forces the browser to always check for a new SW
                    // instead of using the HTTP cache. Critical for Vercel deployments.
                    updateViaCache: 'none',
                });

                console.log('[SW] Registered successfully, scope:', registration.scope);

                // If a new SW is waiting, tell it to skip waiting and take control immediately
                if (registration.waiting) {
                    registration.waiting.postMessage({ type: 'SKIP_WAITING' });
                }

                registration.addEventListener('updatefound', () => {
                    const newWorker = registration.installing;
                    if (!newWorker) return;
                    newWorker.addEventListener('statechange', () => {
                        if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                            newWorker.postMessage({ type: 'SKIP_WAITING' });
                        }
                    });
                });
            } catch (err) {
                console.error('[SW] Registration failed:', err);
            }
        };

        // Run after the page has loaded to not block initial render
        if (document.readyState === 'complete') {
            register();
        } else {
            window.addEventListener('load', register, { once: true });
        }
    }, []);

    return null;
}
