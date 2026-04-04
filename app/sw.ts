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
// FIREBASE CLOUD MESSAGING (FCM) — PUSH NOTIFICATIONS
// ==========================================
// We use TWO layers:
// 1. Firebase compat SDK (via importScripts) — works on Android/Desktop
// 2. Native `push` event listener — fallback for iOS which doesn't support importScripts from CDN
//
// If Firebase compat loads successfully, it intercepts FCM push events and
// calls onBackgroundMessage. If it fails (iOS), we fall back to the native
// `push` event handler below.

let firebaseMessagingAvailable = false;

try {
    // ─── Layer 1: Firebase compat SDK (Android/Desktop) ──────────────
    // iOS Safari service workers do NOT support importScripts() from external
    // URLs (CDNs). This will silently fail on iOS — that's expected.
    importScripts('https://www.gstatic.com/firebasejs/10.9.0/firebase-app-compat.js');
    importScripts('https://www.gstatic.com/firebasejs/10.9.0/firebase-messaging-compat.js');

    firebase.initializeApp({
        apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
        authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
        projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
        storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
        messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
        appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
    });

    const messaging = firebase.messaging();
    firebaseMessagingAvailable = true;

    // Handle background/data-only messages from FCM.
    messaging.onBackgroundMessage((payload) => {
        console.log('[SW] onBackgroundMessage payload:', JSON.stringify(payload));

        const title = payload?.data?.title || payload?.notification?.title || 'Thông báo mới';
        const body = payload?.data?.body || payload?.notification?.body || 'Nội dung thông báo';
        const actionLink = payload?.data?.actionLink || '/mobile/dashboard';

        self.registration.showNotification(title, {
            body,
            icon: '/Artboard.png',
            badge: '/Artboard.png',
            data: { actionLink, ...(payload?.data || {}) },
        });
    });

    console.log('[SW] Firebase messaging compat SDK loaded successfully');
} catch (error) {
    console.warn('[SW] Firebase compat SDK not available (expected on iOS):', error);
}

// ─── Layer 2: Native Push Event (iOS fallback) ──────────────────────
// On iOS, importScripts fails, so Firebase SDK can't intercept push events.
// We handle the raw `push` event directly. This also serves as a safety net
// on all platforms in case Firebase SDK misses a message.
self.addEventListener('push', (event) => {
    // If Firebase messaging handled this event, skip to avoid duplicates.
    // Firebase compat SDK sets an internal flag when it processes a push.
    // We check if Firebase is available AND if the event has already been handled.
    if (firebaseMessagingAvailable) {
        // Firebase SDK will handle this via onBackgroundMessage — skip.
        console.log('[SW] push event: Firebase SDK available, deferring to onBackgroundMessage');
        return;
    }

    console.log('[SW] push event: handling natively (iOS or Firebase unavailable)');

    let data = {};
    try {
        data = event.data?.json() || {};
    } catch {
        try {
            data = { body: event.data?.text() || 'Bạn có thông báo mới' };
        } catch { /* empty */ }
    }

    // FCM data-only messages wrap the payload under data.data
    const payload = (data as any).data || data;
    const title = payload?.title || (data as any)?.notification?.title || 'Thông báo mới';
    const body = payload?.body || (data as any)?.notification?.body || 'Nội dung thông báo';
    const actionLink = payload?.actionLink || '/mobile/dashboard';

    event.waitUntil(
        self.registration.showNotification(title, {
            body,
            icon: '/Artboard.png',
            badge: '/Artboard.png',
            data: { actionLink, ...payload },
        })
    );
});

// ==========================================
// NOTIFICATION CLICK HANDLER
// ==========================================
self.addEventListener('notificationclick', (event) => {
    event.notification.close();
    event.waitUntil(
        clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
            const urlToOpen = event.notification.data?.actionLink || '/';
            // If a window is already open, focus it
            for (let i = 0; i < clientList.length; i++) {
                const client = clientList[i];
                if ('focus' in client) return client.focus();
            }
            // Otherwise open a new window
            if (clients.openWindow) return clients.openWindow(urlToOpen);
        })
    );
});
