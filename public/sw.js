/**
 * Service Worker — B.Duck Cityfuns PWA
 *
 * NOTE: This file is written as plain JS (not TypeScript) because it is
 * served statically from /public/sw.js. The Serwist + Turbopack combo
 * does NOT emit this file during `next dev`, so we maintain it manually.
 *
 * For production builds using webpack (next build without turbopack),
 * @serwist/next will overwrite this file with a generated version. When
 * testing locally with Turbopack, this hand-written version is used.
 */

// ── Install: take control immediately ────────────────────────────────────
self.addEventListener('install', (event) => {
    console.log('[SW] Installing...');
    self.skipWaiting();
});

// ── Activate: claim all clients immediately ───────────────────────────────
self.addEventListener('activate', (event) => {
    console.log('[SW] Activating...');
    event.waitUntil(self.clients.claim());
});

// ── Message: support skip-waiting trigger from client ────────────────────
self.addEventListener('message', (event) => {
    if (event.data?.type === 'SKIP_WAITING') {
        self.skipWaiting();
    }
});

// ── Push: handle incoming Web Push messages ──────────────────────────────
// iOS Safari requirements:
//   1. Must call event.waitUntil() synchronously (not async)
//   2. Must call showNotification() — cannot defer
//   3. Payload MUST have `notification: { title, body }` (data-only = dropped by APNs)
self.addEventListener('push', (event) => {
    console.log('[SW] Push event received!');

    let payload = {};

    if (event.data) {
        try {
            payload = event.data.json();
        } catch {
            payload = { notification: { title: 'Thông báo', body: event.data.text() } };
        }
    }

    console.log('[SW] Push payload:', JSON.stringify(payload));

    // Extract title/body from FCM standard format
    const notif      = payload.notification || {};
    const data       = payload.data || {};
    const title      = notif.title || data.title || 'Thông báo mới';
    const body       = notif.body  || data.body  || '';
    const actionLink = data.actionLink || (payload.webpush && payload.webpush.fcmOptions && payload.webpush.fcmOptions.link) || '/mobile/dashboard';

    // event.waitUntil keeps SW alive on iOS until showNotification resolves
    event.waitUntil(
        self.registration.showNotification(title, {
            body: body,
            icon: '/Artboard.png',
            badge: '/Artboard.png',
            tag: 'push-notification',
            renotify: false,
            data: { actionLink },
        })
    );
});

// ── Notification Click ────────────────────────────────────────────────────
self.addEventListener('notificationclick', (event) => {
    event.notification.close();
    const urlToOpen = (event.notification.data && event.notification.data.actionLink) || '/mobile/dashboard';

    event.waitUntil(
        self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
            for (const client of clientList) {
                if ('focus' in client) return client.focus();
            }
            if (self.clients.openWindow) return self.clients.openWindow(urlToOpen);
        })
    );
});
