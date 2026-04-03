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
// FIREBASE CLOUD MESSAGING — load compat SDK for background push
// ==========================================
importScripts('https://www.gstatic.com/firebasejs/10.9.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.9.0/firebase-messaging-compat.js');

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
// Firebase config is injected at build time from NEXT_PUBLIC_* env vars.
try {
    firebase.initializeApp({
        apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
        authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
        projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
        storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
        messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
        appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
    });

    const messaging = firebase.messaging();

    // Handle background/data-only messages from FCM.
    // This replaces the old firebase-messaging-sw.js logic.
    messaging.onBackgroundMessage((payload) => {
        console.log('[SW] onBackgroundMessage payload:', JSON.stringify(payload));

        const title = payload?.data?.title || payload?.notification?.title || 'Thông báo mới';
        const body = payload?.data?.body || payload?.notification?.body || 'Nội dung thông báo';
        const actionLink = payload?.data?.actionLink || '/employee/dashboard';

        self.registration.showNotification(title, {
            body,
            icon: '/Artboard.png',
            badge: '/Artboard.png',
            data: { actionLink, ...(payload?.data || {}) },
        });
    });
} catch (error) {
    console.error('[SW] Firebase messaging init error:', error);
}

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
