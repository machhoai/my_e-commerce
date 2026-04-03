import { getAdminDb, getAdminMessaging } from './firebase-admin';
import type { SendResponse } from 'firebase-admin/messaging';

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

        // 2. Retrieve user's FCM tokens (multi-device) and send push notification
        const userDoc = await adminDb.collection('users').doc(userId).get();
        if (userDoc.exists) {
            const userData = userDoc.data();
            // Support both legacy single token and new multi-token array
            const tokensArray: string[] = userData?.fcmTokens || [];
            const legacyToken = userData?.fcmToken;

            // Merge: use fcmTokens[] if available, fallback to legacy
            const allTokens = new Set(tokensArray);
            if (legacyToken) allTokens.add(legacyToken);

            if (allTokens.size > 0) {
                // Build data-only messages for each token
                const messages = Array.from(allTokens).map(token => ({
                    token,
                    data: {
                        title: String(title || 'Thông báo'),
                        body: String(body || 'Nội dung'),
                        actionLink: actionLink || '/employee/dashboard',
                    },
                }));

                try {
                    const response = await adminMessaging.sendEach(messages);
                    const successCount = response.responses.filter((r: SendResponse) => r.success).length;
                    const failCount = response.responses.filter((r: SendResponse) => !r.success).length;
                    console.log(`[Notification] Push sent to ${successCount}/${allTokens.size} devices for user ${userId} (${failCount} failed)`);

                    // Clean up invalid tokens
                    const invalidTokens: string[] = [];
                    response.responses.forEach((resp: SendResponse, idx: number) => {
                        if (!resp.success) {
                            const errCode = resp.error?.code;
                            if (errCode === 'messaging/invalid-registration-token' ||
                                errCode === 'messaging/registration-token-not-registered') {
                                invalidTokens.push(messages[idx].token);
                            }
                        }
                    });

                    if (invalidTokens.length > 0) {
                        const remainingTokens = tokensArray.filter(t => !invalidTokens.includes(t));
                        await adminDb.collection('users').doc(userId).update({
                            fcmTokens: remainingTokens,
                            ...(invalidTokens.includes(legacyToken) ? { fcmToken: remainingTokens[0] || '' } : {}),
                        });
                        console.log(`[Notification] Cleaned ${invalidTokens.length} invalid token(s) for user ${userId}`);
                    }
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
