'use client';

import { useEffect } from 'react';

/**
 * SilentPwaUpdater — invisible component that keeps the PWA up-to-date.
 *
 * Strategy:
 * 1. Every time the user returns to the tab → poll the server for a new SW.
 * 2. When a new SW is found waiting → tell it to skip waiting.
 * 3. When the new SW takes control → reload the page silently.
 */
export default function SilentPwaUpdater(): null {
    useEffect(() => {
        // Guard: only run in browsers that support Service Workers
        if (
            typeof window === 'undefined' ||
            typeof navigator === 'undefined' ||
            !('serviceWorker' in navigator)
        ) {
            return;
        }

        // Flag to prevent multiple reloads firing at once
        let isReloading = false;

        // ── 1. Poll for updates every time the tab becomes visible ──────
        const handleVisibilityChange = () => {
            if (document.visibilityState === 'visible') {
                navigator.serviceWorker.ready.then((reg) => {
                    reg.update().catch(() => {
                        // Network errors during update check are non-fatal
                    });
                });
            }
        };

        document.addEventListener('visibilitychange', handleVisibilityChange);

        // ── 2. Detect new service workers & ask them to activate ────────
        const listenForWaitingWorker = (reg: ServiceWorkerRegistration) => {
            // Handle a worker that is already waiting (e.g. page loaded while
            // a new SW was pending)
            if (reg.waiting && navigator.serviceWorker.controller) {
                reg.waiting.postMessage({ type: 'SKIP_WAITING' });
            }

            reg.addEventListener('updatefound', () => {
                const newWorker = reg.installing;
                if (!newWorker) return;

                newWorker.addEventListener('statechange', () => {
                    if (
                        newWorker.state === 'installed' &&
                        navigator.serviceWorker.controller
                    ) {
                        // A new SW is ready and there's an existing one controlling
                        // the page → tell the new one to take over immediately.
                        newWorker.postMessage({ type: 'SKIP_WAITING' });
                    }
                });
            });
        };

        navigator.serviceWorker.ready.then(listenForWaitingWorker);

        // Also cover the case where getRegistration resolves before ready
        navigator.serviceWorker.getRegistration().then((reg) => {
            if (reg) listenForWaitingWorker(reg);
        });

        // ── 3. Reload when the new SW takes control ─────────────────────
        const handleControllerChange = () => {
            if (isReloading) return;
            isReloading = true;
            window.location.reload();
        };

        navigator.serviceWorker.addEventListener(
            'controllerchange',
            handleControllerChange,
        );

        // ── Cleanup ─────────────────────────────────────────────────────
        return () => {
            document.removeEventListener(
                'visibilitychange',
                handleVisibilityChange,
            );
            navigator.serviceWorker.removeEventListener(
                'controllerchange',
                handleControllerChange,
            );
        };
    }, []);

    return null;
}
