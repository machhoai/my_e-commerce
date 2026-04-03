// Legacy FCM service worker — push notifications are now handled by the main
// service worker (sw.js) which includes Firebase messaging logic.
// This file is kept only for backward compatibility: existing browser
// registrations of this SW will activate this stub, which does nothing,
// allowing the main SW to handle all push events cleanly.
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (event) => {
    event.waitUntil(self.clients.claim());
});
