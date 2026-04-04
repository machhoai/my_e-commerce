import { app } from './firebase';
import { getMessaging, getToken, onMessage, isSupported, Messaging } from 'firebase/messaging';

let messaging: Messaging | null = null;

// Initialize messaging only on the client side and if supported
export const getFirebaseMessaging = async (): Promise<Messaging | null> => {
    if (typeof window === 'undefined') return null;

    try {
        const supported = await isSupported();
        if (supported) {
            if (!messaging) {
                messaging = getMessaging(app);
            }
            return messaging;
        }
    } catch (error) {
        console.error('Firebase Messaging is not supported in this environment', error);
    }
    return null;
};

// VAPID Key from Firebase Console -> Project Settings -> Cloud Messaging -> Web Push certificates
// You'll need to set this in your environment variables
const VAPID_KEY = process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY;

export const requestFirebaseNotificationPermission = async (): Promise<string | null> => {
    try {
        const msg = await getFirebaseMessaging();
        if (!msg) return null;

        const permission = await Notification.requestPermission();
        if (permission === 'granted') {
            let swRegistration: ServiceWorkerRegistration | undefined;
            try {
                if ('serviceWorker' in navigator) {
                    // SW should already be registered by RegisterSW component.
                    // We just need to get the active registration.
                    // Wait up to 5s for it to be ready.
                    const readyTimeout = new Promise<never>((_, reject) =>
                        setTimeout(() => reject(new Error('SW ready timeout (5s)')), 5000)
                    );
                    swRegistration = await Promise.race([
                        navigator.serviceWorker.ready,
                        readyTimeout,
                    ]) as ServiceWorkerRegistration;
                    console.log('[FCM] SW ready, scope:', swRegistration.scope, '| state:', swRegistration.active?.state);
                }
            } catch (regErr) {
                console.warn('[FCM] SW not ready in time:', regErr);
                // Attempt fallback registration
                try {
                    await navigator.serviceWorker.register('/sw.js', { scope: '/', updateViaCache: 'none' });
                    swRegistration = await navigator.serviceWorker.ready;
                    console.log('[FCM] Fallback SW registration succeeded');
                } catch {
                    console.warn('[FCM] Fallback SW registration also failed, proceeding without SW');
                }
            }

            const currentToken = await getToken(msg, {
                vapidKey: VAPID_KEY,
                serviceWorkerRegistration: swRegistration,
            });
            if (currentToken) {
                return currentToken;
            } else {
                console.log('No registration token available. Request permission to generate one.');
                return null;
            }
        } else {
            console.log('Notification permission not granted.');
            return null;
        }
    } catch (error) {
        console.error('An error occurred while retrieving token:', error);
        return null;
    }
};

export const onMessageListener = async () => {
    const msg = await getFirebaseMessaging();
    if (!msg) return;

    return new Promise((resolve) => {
        onMessage(msg, (payload) => {
            resolve(payload);
        });
    });
};
