importScripts('https://www.gstatic.com/firebasejs/10.9.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.9.0/firebase-messaging-compat.js');

// Initialize the Firebase app in the service worker by passing in the
// messagingSenderId.
// We use the compat library for the service worker due to its simpler initialization
const firebaseConfig = {
    apiKey: new URL(location).searchParams.get("apiKey") || "REPLACE_API_KEY", // Usually passed via URL params or hardcoded for SW
    projectId: "employee-shift-scheduling", // fallback project ID
    messagingSenderId: "123456789", // fallback messaging sender ID
    appId: "1:123456789:web:abcdef" // fallback app ID
};

// We intercept the query params if they're passed, otherwise we can rely on a basic init
// For a Next.js app, it's safer to pass config via URL or use self.__FIREBASE_CONFIG
try {
    firebase.initializeApp(firebaseConfig);
    const messaging = firebase.messaging();

    messaging.onBackgroundMessage((payload) => {
        console.log('[firebase-messaging-sw.js] Received background message ', payload);

        const notificationTitle = payload.notification?.title || 'Thông báo mới';
        const notificationOptions = {
            body: payload.notification?.body || 'Bạn có một thông báo từ hệ thống.',
            icon: '/Artboard.png',
            badge: '/Artboard.png',
            data: payload.data
        };

        self.registration.showNotification(notificationTitle, notificationOptions);
    });
} catch (error) {
    console.error('Firebase messaging service worker error:', error);
}

self.addEventListener('notificationclick', (event) => {
    event.notification.close();
    event.waitUntil(
        clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
            const urlToOpen = event.notification.data?.actionLink || '/';
            // If window already open, focus it
            for (let i = 0; i < clientList.length; i++) {
                const client = clientList[i];
                if (client.url === '/' && 'focus' in client) return client.focus();
            }
            if (clients.openWindow) return clients.openWindow(urlToOpen);
        })
    );
});
