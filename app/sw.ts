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

const serwist = new Serwist({
    precacheEntries: self.__SW_MANIFEST,
    skipWaiting: true,
    clientsClaim: true,
    navigationPreload: true,
    runtimeCaching: defaultCache,
});

serwist.addEventListeners();

// ==========================================
// PUSH NOTIFICATIONS & FIREBASE CLOUD MESSAGING
// ==========================================

// Lắng nghe sự kiện Push Notification từ Server/FCM (Firebase Cloud Messaging)
self.addEventListener('push', (event) => {
    // GHI CHÚ CHO TƯƠNG LAI:
    // Tại đây sẽ xử lý logic nhận Web Push hoặc FCM data.
    // Khi server gửi thông báo dạng Push qua Web Push:
    //
    // try {
    //   const payload = event.data?.json() ?? {};
    //   const title = payload.title || "Thông báo từ Lịch Làm Việc";
    //   const options = {
    //     body: payload.body || "Bạn có một thông báo mới.",
    //     icon: '/Artboard.png',
    //     badge: '/Artboard.png',
    //     data: payload.data // URL hoặc metadata để điều hướng khi click
    //   };
    //   event.waitUntil(self.registration.showNotification(title, options));
    // } catch (e) {
    //   console.error("Lỗi khi xử lý Push Event:", e);
    // }

    console.log('[Service Worker] Đã nhận được Push Notification, nhưng chưa có logic hiển thị.');
});

// Lắng nghe sự kiện khi người dùng click vào thông báo (Notification)
self.addEventListener('notificationclick', (event) => {
    // GHI CHÚ CHO TƯƠNG LAI:
    // Logic xử lý khi user click vào notification, ví dụ chuyển hướng đến App
    //
    // event.notification.close();
    // const urlToOpen = event.notification.data?.url || '/';
    //
    // event.waitUntil(
    //   clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windowClients) => {
    //     // Nếu có tab đang mở ứng dụng, focus vào tab đó
    //     for (const client of windowClients) {
    //       if (client.url.includes(urlToOpen) && 'focus' in client) {
    //         return client.focus();
    //       }
    //     }
    //     // Nếu không, mở tab mới
    //     if (clients.openWindow) {
    //       return clients.openWindow(urlToOpen);
    //     }
    //   })
    // );

    console.log('[Service Worker] Người dùng click vào thông báo:', event);
    event.notification.close();
});
