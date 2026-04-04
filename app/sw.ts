// @ts-nocheck
/**
 * Service Worker — B.Duck Cityfuns PWA
 *
 * DELIBERATE DESIGN DECISION: This SW intentionally does NOT use Serwist /
 * Workbox precaching. Here's why:
 *
 * Workbox's install-time precaching downloads every cached route BEFORE the
 * SW can activate. On Vercel production, if ANY single precache request fails
 * (network blip, CDN hiccup, 404), the entire SW stays stuck in 'installing'
 * and NEVER activates. This silently breaks push notifications for all users.
 *
 * For this app, reliable Push Notification delivery is more important than
 * offline page caching. We use a minimal SW that always installs successfully.
 *
 * If offline caching is needed in the future, add it AFTER the SW is confirmed
 * stable, using runtime caching (not install-time precaching).
 */

declare const self: ServiceWorkerGlobalScope;

// ── Install: activate immediately, no precaching to wait for ─────────────
self.addEventListener('install', () => {
    console.log('[SW] Installing — skip waiting immediately');
    self.skipWaiting();
});

// ── Activate: claim all clients right away ────────────────────────────────
self.addEventListener('activate', (event) => {
    console.log('[SW] Activated — claiming all clients');
    event.waitUntil(self.clients.claim());
});

// ── Message: support manual skip-waiting from React app ──────────────────
self.addEventListener('message', (event) => {
    if (event.data?.type === 'SKIP_WAITING') {
        self.skipWaiting();
    }
});

// ── Push: handle Web Push messages ───────────────────────────────────────
// iOS Safari requirements (strictly enforced by APNs):
//   1. Payload MUST include `notification: { title, body }` — data-only = dropped
//   2. event.waitUntil() MUST wrap showNotification synchronously
//   3. SW must activate within ~2s of push — no async init allowed
self.addEventListener('push', (event) => {
    console.log('[SW] Push event received');

    let payload: Record<string, unknown> = {};

    if (event.data) {
        try {
            payload = event.data.json() as Record<string, unknown>;
        } catch {
            payload = {
                notification: { title: 'Thông báo', body: event.data.text() },
            };
        }
    }

    console.log('[SW] Push payload parsed:', JSON.stringify(payload));

    const notif = (payload.notification as Record<string, string>) || {};
    const data  = (payload.data  as Record<string, string>) || {};
    const webpush = (payload.webpush as Record<string, unknown>) || {};
    const fcmOptions = (webpush.fcmOptions as Record<string, string>) || {};

    const title      = notif.title || data.title || 'Thông báo mới';
    const body       = notif.body  || data.body  || '';
    const actionLink = data.actionLink || fcmOptions.link || '/mobile/dashboard';

    // event.waitUntil is MANDATORY — keeps SW alive until showNotification resolves
    event.waitUntil(
        self.registration.showNotification(title, {
            body,
            icon: '/Artboard.png',
            badge: '/Artboard.png',
            tag: 'app-push',          // deduplication: new push replaces old one
            renotify: false,
            data: { actionLink },
        })
    );
});

// ── Notification Click ────────────────────────────────────────────────────
self.addEventListener('notificationclick', (event) => {
    event.notification.close();
    const urlToOpen = (event.notification.data as { actionLink?: string })?.actionLink
        || '/mobile/dashboard';

    event.waitUntil(
        (self.clients as Clients).matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
            // Focus existing window if one is open
            for (const client of clientList) {
                if ('focus' in client) return (client as WindowClient).focus();
            }
            // Otherwise open a new window
            if ((self.clients as Clients).openWindow) {
                return (self.clients as Clients).openWindow(urlToOpen);
            }
        })
    );
});