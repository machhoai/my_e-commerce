// @ts-nocheck
import { defaultCache } from "@serwist/next/worker";
import type { PrecacheEntry, SerwistGlobalConfig } from "serwist";
import { Serwist } from "serwist";

declare global { // eslint-disable-line no-var
    interface WorkerGlobalScope extends SerwistGlobalConfig {
        __SW_MANIFEST: (PrecacheEntry | string)[] | undefined;
    }
}

declare const self: ServiceWorkerGlobalScope;

// ==========================================
// SERWIST PWA SERVICE WORKER
// ==========================================
const serwist = new Serwist({
    precacheEntries: self.__SW_MANIFEST,
    skipWaiting: true,
    clientsClaim: true,
    navigationPreload: true,
    runtimeCaching: defaultCache,
});

serwist.addEventListeners();

// ==========================================
// CLIENT-TRIGGERED SKIP WAITING
// ==========================================
self.addEventListener('message', (event) => {
    if (event.data?.type === 'SKIP_WAITING') {
        self.skipWaiting();
    }
});

// ==========================================
// WEB PUSH — NATIVE RAW PUSH HANDLER
// ==========================================
// WHY NOT Firebase SDK inside SW?
// Firebase's messaging SDK in a SW context is async and slow to initialize.
// iOS Safari PWA kills the Service Worker if it doesn't call showNotification
// within ~2 seconds of receiving a push event.
// Solution: Use the raw Web Push API directly — sync, fast, and iOS-compatible.
//
// PAYLOAD FORMAT (sent from Firebase Admin SDK):
//   { notification: { title, body }, data: { actionLink }, webpush: { fcmOptions: { link } } }
// The raw 'push' event on the SW receives the FCM envelope as JSON.
//
self.addEventListener('push', (event) => {
    console.log('[SW] Push event received');

    // Guard: no data = browser-level test ping, show generic notice
    if (!event.data) {
        event.waitUntil(
            self.registration.showNotification('Thông báo mới', {
                body: 'Bạn có một thông báo mới.',
                icon: '/Artboard.png',
                badge: '/Artboard.png',
            })
        );
        return;
    }

    let payload = {};
    try {
        payload = event.data.json();
    } catch {
        // If the payload is not JSON (rare), treat raw text as body
        payload = { notification: { title: 'Thông báo', body: event.data.text() } };
    }

    console.log('[SW] Push payload parsed:', JSON.stringify(payload));

    // FCM wraps content inside `notification` (standard) and `data` (custom).
    // iOS REQUIRES the notification object to be present in the APNs envelope
    // (handled by Firebase Admin SDK when `notification` field is set).
    const notif = payload.notification || {};
    const data  = payload.data       || {};

    const title      = notif.title || data.title || 'Thông báo mới';
    const body       = notif.body  || data.body  || '';
    const actionLink = data.actionLink
        || payload?.webpush?.fcmOptions?.link
        || '/mobile/dashboard';

    // event.waitUntil keeps the SW alive until showNotification resolves.
    // This is MANDATORY on iOS — omitting it causes silent drops.
    event.waitUntil(
        self.registration.showNotification(title, {
            body,
            icon: '/Artboard.png',
            badge: '/Artboard.png',
            tag: 'push-notification',   // deduplicate: same tag = replace old
            renotify: false,
            data: { actionLink },
        })
    );
});

// ==========================================
// NOTIFICATION CLICK HANDLER
// ==========================================
self.addEventListener('notificationclick', (event) => {
    event.notification.close();
    const urlToOpen = event.notification.data?.actionLink || '/mobile/dashboard';

    event.waitUntil(
        clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
            // If a window is already open at that URL, focus it
            for (const client of clientList) {
                if (client.url.includes(urlToOpen) && 'focus' in client) {
                    return client.focus();
                }
            }
            // Otherwise open a new window/tab
            if (clients.openWindow) return clients.openWindow(urlToOpen);
        })
    );
});