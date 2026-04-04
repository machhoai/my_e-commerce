import { useEffect, useState, useCallback } from 'react';
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
    // true when Notification API exists, permission is 'default', and we need a user gesture
    const [needsPrompt, setNeedsPrompt] = useState(false);

    /** Save FCM token to Firestore (multi-device array + legacy field) */
    const saveToken = useCallback(async (token: string) => {
        if (!user) return;
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
    }, [user, userDoc]);

    /** Core setup: request permission → get token → save */
    const setupPush = useCallback(async () => {
        if (!user || typeof window === 'undefined') return;
        const token = await requestFirebaseNotificationPermission();
        if (token) {
            setPermissionGranted(true);
            setFcmToken(token);
            setNeedsPrompt(false);
            await saveToken(token);
        }
    }, [user, saveToken]);

    /**
     * PUBLIC — call this from a user-gesture handler (button onClick).
     * iOS Safari/PWA requires Notification.requestPermission() to be triggered
     * by a direct user tap. Calling it from setTimeout or useEffect is silently ignored.
     */
    const promptForPermission = useCallback(async () => {
        await setupPush();
    }, [setupPush]);

    // On mount: auto-register if already granted, or flag that we need a prompt
    useEffect(() => {
        if (!user || typeof window === 'undefined') return;

        const timer = setTimeout(() => {
            if (!('Notification' in window)) return;

            if (Notification.permission === 'granted') {
                // Already granted — silently register token (no user gesture needed)
                setupPush();
            } else if (Notification.permission === 'default') {
                // Never asked — on iOS this MUST come from a user gesture,
                // so we just flag it and let the UI show a prompt banner.
                // On Android/Desktop, auto-requesting also works, but showing
                // a banner first is better UX anyway (less intrusive).
                setNeedsPrompt(true);
            }
            // 'denied' — nothing we can do
        }, 2000);

        return () => clearTimeout(timer);
    }, [user, setupPush]);

    // Listen for foreground messages
    useEffect(() => {
        if (!permissionGranted) return;

        const listenForMessages = async () => {
            try {
                const payload = await onMessageListener() as MessagePayload;
                setNotification(payload);

                // We NO LONGER manually call `new Notification(...)` here.
                // Since the FCM payloads now contain the standard `notification` block,
                // the browser/OS handles them natively (avoiding duplicate notifications
                // if multiple tabs are open).
            } catch (err) {
                console.log('failed: ', err);
            }
        };
        listenForMessages();
    }, [permissionGranted]);

    return { fcmToken, permissionGranted, notification, needsPrompt, promptForPermission };
}
