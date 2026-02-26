import { getAdminAuth, getAdminDb, getAdminMessaging } from './firebase-admin';

interface SendNotificationProps {
    userId: string;
    title: string;
    body: string;
    type: 'SYSTEM' | 'SWAP_REQUEST' | 'APPROVAL' | 'GENERAL';
    actionLink?: string;
    storeId?: string;
}

export async function sendNotification({
    userId,
    title,
    body,
    type,
    actionLink,
    storeId
}: SendNotificationProps) {
    try {
        const adminDb = getAdminDb();
        const adminMessaging = getAdminMessaging();

        // 1. Create a new document in the notifications collection
        const notificationRef = adminDb.collection('notifications').doc();
        const notificationData = {
            id: notificationRef.id,
            userId,
            title,
            body,
            type,
            isRead: false,
            createdAt: new Date().toISOString(),
            ...(actionLink && { actionLink }),
            ...(storeId && { storeId })
        };

        await notificationRef.set(notificationData);
        console.log(`[Notification] Saved to Firestore for user ${userId}`);

        // 2. Retrieve user's FCM token and send push notification
        const userDoc = await adminDb.collection('users').doc(userId).get();
        if (userDoc.exists) {
            const fcmToken = userDoc.data()?.fcmToken;
            if (fcmToken) {
                try {
                    await adminMessaging.send({
                        token: fcmToken,
                        notification: {
                            title,
                            body
                        },
                        data: {
                            actionLink: actionLink || '/'
                        },
                        // Optionally add APNS / Webpush specific configuration
                        webpush: {
                            notification: {
                                icon: '/Artboard.png', // Add your app icon path here
                                badge: '/Artboard.png'
                            }
                        }
                    });
                    console.log(`[Notification] Push sent to FCM token for user ${userId}`);
                } catch (pushError) {
                    // Failing to send push shouldn't break the whole flow since it's already in the DB
                    console.error('[Notification] Error sending FCM push notification:', pushError);
                }
            } else {
                console.log(`[Notification] User ${userId} has no FCM token saved.`);
            }
        }

        return { success: true, notificationId: notificationRef.id };
    } catch (error) {
        console.error('[Notification] Internal error while sending notification:', error);
        return { success: false, error: 'Failed to send notification' };
    }
}
