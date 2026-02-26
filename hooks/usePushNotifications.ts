import { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { db } from '@/lib/firebase';
import { doc, updateDoc } from 'firebase/firestore';
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

                // Check if we need to update the token in Firestore
                if (userDoc?.fcmToken !== token) {
                    try {
                        const userRef = doc(db, 'users', user.uid);
                        await updateDoc(userRef, { fcmToken: token });
                        console.log('FCM Token updated in Firestore');
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
                    // Here you could trigger a local toast if you want, 
                    // but the NotificationBell will already show the real-time update in the DB.
                } catch (err) {
                    console.log('failed: ', err);
                }
            }
        };
        listenForMessages();
    }, [permissionGranted]);

    return { fcmToken, permissionGranted, notification };
}
