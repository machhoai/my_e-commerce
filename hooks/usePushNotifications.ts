import { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { db } from '@/lib/firebase';
import { doc, updateDoc, arrayUnion } from 'firebase/firestore';
import { requestFirebaseNotificationPermission, onMessageListener } from '@/lib/firebase-messaging';
import { MessagePayload } from 'firebase/messaging';

export function usePushNotifications() {
    const { user, userDoc } = useAuth();
    const [permissionGranted, setPermissionGranted] = useState(false);
    const [fcmToken, setFcmToken] = useState<string | null>(null);
    const [notification, setNotification] = useState<MessagePayload | null>(null);

    useEffect(() => {
        const setupPushNotifications = async () => {
            if (!user || typeof window === 'undefined') return;

            // Request permission and get token
            const token = await requestFirebaseNotificationPermission();

            if (token) {
                setPermissionGranted(true);
                setFcmToken(token);

                // Store token in fcmTokens array (multi-device) AND legacy fcmToken field
                const existingTokens: string[] = userDoc?.fcmTokens || [];
                if (!existingTokens.includes(token)) {
                    try {
                        const userRef = doc(db, 'users', user.uid);
                        await updateDoc(userRef, {
                            fcmToken: token,              // legacy single-token (backward compat)
                            fcmTokens: arrayUnion(token), // multi-device tokens array
                        });
                        console.log('[FCM] Token saved to Firestore (fcmTokens array)');
                    } catch (error) {
                        console.error('Error updating FCM Token in Firestore:', error);
                    }
                }
            }
        };

        // Delay the prompt slightly to ensure the app is fully loaded
        const timer = setTimeout(() => {
            if ('Notification' in window) {
                if (Notification.permission === 'granted' || Notification.permission === 'default') {
                    setupPushNotifications();
                }
            }
        }, 3000);

        return () => clearTimeout(timer);
    }, [user, userDoc]);

    useEffect(() => {
        const listenForMessages = async () => {
            if (permissionGranted) {
                try {
                    const payload = await onMessageListener() as MessagePayload;
                    setNotification(payload);

                    // Show browser notification for foreground data-only messages.
                    // (Background messages are handled by the service worker.)
                    const title = payload?.data?.title || payload?.notification?.title || 'Thông báo mới';
                    const body = payload?.data?.body || payload?.notification?.body || '';
                    if (typeof window !== 'undefined' && Notification.permission === 'granted') {
                        new Notification(title, {
                            body,
                            icon: '/Artboard.png',
                            badge: '/Artboard.png',
                        });
                    }
                } catch (err) {
                    console.log('failed: ', err);
                }
            }
        };
        listenForMessages();
    }, [permissionGranted]);

    return { fcmToken, permissionGranted, notification };
}
