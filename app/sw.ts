// @ts-nocheck
import { defaultCache } from "@serwist/next/worker";
import type { PrecacheEntry, SerwistGlobalConfig } from "serwist";
import { Serwist } from "serwist";
// 1. IMPORT TRỰC TIẾP TỪ NPM PACKAGE (Firebase v9/v10)
import { initializeApp } from "firebase/app";
import { getMessaging, onBackgroundMessage } from "firebase/messaging/sw";

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
try {
    // 2. KHỞI TẠO FIREBASE APP NATIVE (Serwist sẽ tự bundle thư viện này)
    const firebaseApp = initializeApp({
        apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
        authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
        projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
        storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
        messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
        appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
    });

    const messaging = getMessaging(firebaseApp);

    // 3. LẮNG NGHE BACKGROUND MESSAGE CHUẨN CỦA FIREBASE
    // When the FCM payload includes the 'notification' object, the Firebase SDK automatically
    // shows a notification. We don't need to manually call showNotification here, otherwise
    // we will get duplicate notifications on Android/Desktop.
    onBackgroundMessage(messaging, (payload) => {
        console.log('[SW] onBackgroundMessage payload received:', payload);
        // Custom background logic can go here. Do NOT call showNotification.
    });

    console.log('[SW] Firebase messaging loaded locally via Serwist Bundle');
} catch (error) {
    console.error('[SW] Firebase initialization failed:', error);
}

// ==========================================
// NOTIFICATION CLICK HANDLER
// ==========================================
self.addEventListener('notificationclick', (event) => {
    event.notification.close();
    event.waitUntil(
        clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
            const urlToOpen = event.notification.data?.actionLink || '/';
            for (let i = 0; i < clientList.length; i++) {
                const client = clientList[i];
                if ('focus' in client) return client.focus();
            }
            if (clients.openWindow) return clients.openWindow(urlToOpen);
        })
    );
});