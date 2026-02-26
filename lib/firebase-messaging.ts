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
            const currentToken = await getToken(msg, { vapidKey: VAPID_KEY });
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
