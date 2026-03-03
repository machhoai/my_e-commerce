import { getAdminDb, getAdminMessaging } from './firebase-admin';
import { parseTemplate } from './template-parser';
import { sendNotification } from './notifications';
import { NotificationTemplate } from '@/types';

// ─── Types ───────────────────────────────────────────────────────────────────

interface SendTemplatedNotificationProps {
    userId: string;
    templateId?: string;
    eventName?: string;
    dataContext: Record<string, string | number | undefined>;
    actionLink?: string;
    storeId?: string;
}

interface BroadcastTemplateProps {
    templateId: string;
    targetUserIds?: string[];
    targetType?: 'ALL' | 'STORE' | 'ROLE';
    targetValue?: string;
    dataContext?: Record<string, string | number | undefined>;
}

// ─── Core Engine ─────────────────────────────────────────────────────────────

/**
 * Send a templated notification to a single user.
 *
 * Provide EITHER `templateId` (direct) or `eventName` (auto-lookup from settings/global).
 * The user's name is automatically merged into `dataContext` as `{name}`.
 */
export async function sendTemplatedNotification({
    userId,
    templateId,
    eventName,
    dataContext,
    actionLink,
    storeId,
}: SendTemplatedNotificationProps): Promise<{ success: boolean; reason?: string; notificationId?: string }> {
    const tag = '[NotificationEngine]';
    console.log(`${tag} Called for user=${userId}, templateId=${templateId || 'none'}, eventName=${eventName || 'none'}`);

    try {
        const adminDb = getAdminDb();
        let resolvedTemplateId = templateId;

        // ── Step A: Resolve templateId from eventName if needed ──
        if (!resolvedTemplateId && eventName) {
            console.log(`${tag} Looking up event mapping for '${eventName}' in settings/global...`);
            const settingsSnap = await adminDb.collection('settings').doc('global').get();

            if (!settingsSnap.exists) {
                console.log(`${tag} settings/global doc not found. Skipping.`);
                return { success: false, reason: 'settings_missing' };
            }

            const mappings = settingsSnap.data()?.eventMappings || {};
            resolvedTemplateId = mappings[eventName];

            if (!resolvedTemplateId) {
                console.log(`${tag} Event '${eventName}' is NOT mapped to any template. Skipping.`);
                return { success: false, reason: 'unmapped' };
            }
            console.log(`${tag} Event '${eventName}' mapped to templateId='${resolvedTemplateId}'`);
        }

        if (!resolvedTemplateId) {
            console.error(`${tag} No templateId or eventName provided. Cannot send.`);
            return { success: false, reason: 'no_template' };
        }

        // ── Step B: Fetch the template ──
        const templateSnap = await adminDb.collection('notification_templates').doc(resolvedTemplateId).get();
        if (!templateSnap.exists) {
            console.error(`${tag} Template '${resolvedTemplateId}' not found in Firestore.`);
            return { success: false, reason: 'template_missing' };
        }
        const templateData = templateSnap.data() as NotificationTemplate;
        console.log(`${tag} Template loaded: "${templateData.name}"`);

        // ── Step C: Fetch user doc and merge name into context ──
        const userSnap = await adminDb.collection('users').doc(userId).get();
        const userName = userSnap.exists ? (userSnap.data()?.name || '') : '';

        const mergedContext: Record<string, string | number | undefined> = {
            name: userName,
            ...dataContext,
        };
        console.log(`${tag} Context merged for user '${userName}':`, mergedContext);

        // ── Step D: Parse template title & body ──
        const finalTitle = parseTemplate(templateData.titleTemplate, mergedContext);
        const finalBody = parseTemplate(templateData.bodyTemplate, mergedContext);
        console.log(`${tag} Parsed title="${finalTitle}", body="${finalBody.substring(0, 80)}..."`);

        // ── Step E: Save to Firestore + Send FCM push ──
        const result = await sendNotification({
            userId,
            title: finalTitle,
            body: finalBody,
            type: 'SYSTEM',
            actionLink,
            storeId,
        });

        console.log(`${tag} ✅ Notification sent to user=${userId}, notificationId=${result.notificationId}`);
        return { success: true, notificationId: result.notificationId };

    } catch (error) {
        console.error(`${tag} ❌ Failed for user=${userId}:`, error);
        return { success: false, reason: 'internal_error' };
    }
}

// ─── Broadcast (one template → many users) ───────────────────────────────────

/**
 * Send a template-based notification to many users.
 * Used by the "Gửi ngay" (Send Now) button and the standalone broadcast page.
 *
 * Fetches matching users, personalizes the template per user, saves to Firestore
 * in batches, and sends FCM push notifications.
 */
export async function broadcastTemplate({
    templateId,
    targetUserIds,
    targetType,
    targetValue,
    dataContext = {},
}: BroadcastTemplateProps): Promise<{
    success: boolean;
    totalTargeted: number;
    pushSent: number;
    pushFailed: number;
    error?: string;
}> {
    const tag = '[BroadcastEngine]';
    console.log(`${tag} Broadcasting templateId=${templateId}, targetType=${targetType || 'DIRECT'}, targetUserIds=${targetUserIds?.length || 'none'}`);

    try {
        const adminDb = getAdminDb();
        const adminMessaging = getAdminMessaging();

        // ── Fetch template ──
        const templateSnap = await adminDb.collection('notification_templates').doc(templateId).get();
        if (!templateSnap.exists) {
            console.error(`${tag} Template '${templateId}' not found.`);
            return { success: false, totalTargeted: 0, pushSent: 0, pushFailed: 0, error: 'Không tìm thấy mẫu thông báo' };
        }
        const templateData = templateSnap.data() as NotificationTemplate;
        console.log(`${tag} Template loaded: "${templateData.name}"`);

        // ── Build user list ──
        let usersData: { uid: string; name: string; fcmToken?: string; storeId?: string }[] = [];

        if (targetUserIds && targetUserIds.length > 0) {
            // Direct user list
            for (const uid of targetUserIds) {
                const userSnap = await adminDb.collection('users').doc(uid).get();
                if (userSnap.exists) {
                    const data = userSnap.data()!;
                    if (data.isActive !== false) {
                        usersData.push({ uid, name: data.name || 'bạn', fcmToken: data.fcmToken, storeId: data.storeId });
                    }
                }
            }
        } else {
            // Query-based targeting
            let usersQuery: FirebaseFirestore.Query = adminDb.collection('users');

            if (targetType === 'STORE' && targetValue) {
                usersQuery = usersQuery.where('storeId', '==', targetValue);
            } else if (targetType === 'ROLE' && targetValue) {
                usersQuery = usersQuery.where('role', '==', targetValue);
            }

            const usersSnapshot = await usersQuery.get();
            usersSnapshot.forEach(doc => {
                const data = doc.data();
                if (data.isActive !== false) {
                    usersData.push({
                        uid: doc.id,
                        name: data.name || 'bạn',
                        fcmToken: data.fcmToken,
                        storeId: data.storeId,
                    });
                }
            });
        }

        if (usersData.length === 0) {
            console.log(`${tag} No target users found.`);
            return { success: false, totalTargeted: 0, pushSent: 0, pushFailed: 0, error: 'Không tìm thấy người dùng nào phù hợp' };
        }

        console.log(`${tag} Targeting ${usersData.length} users`);

        const createdAt = new Date().toISOString();

        // ── Helper: chunk array for Firestore batch limits ──
        const chunkArray = <T>(arr: T[], size: number): T[][] => {
            const chunks = [];
            for (let i = 0; i < arr.length; i += size) {
                chunks.push(arr.slice(i, i + size));
            }
            return chunks;
        };

        // ── Write notifications to Firestore in batches ──
        const userChunks = chunkArray(usersData, 500);
        for (const chunk of userChunks) {
            const batch = adminDb.batch();
            for (const user of chunk) {
                const ctx = { name: user.name, storeName: user.storeId || '', ...dataContext };
                const personalizedTitle = parseTemplate(templateData.titleTemplate, ctx);
                const personalizedBody = parseTemplate(templateData.bodyTemplate, ctx);

                const notificationRef = adminDb.collection('notifications').doc();
                batch.set(notificationRef, {
                    id: notificationRef.id,
                    userId: user.uid,
                    title: personalizedTitle,
                    body: personalizedBody,
                    type: 'SYSTEM',
                    isRead: false,
                    createdAt,
                });
            }
            await batch.commit();
        }
        console.log(`${tag} ✅ Firestore notifications written for ${usersData.length} users`);

        // ── Send FCM push messages ──
        let pushSuccessCount = 0;
        let pushFailureCount = 0;

        const uniquePushMessages: any[] = [];
        const seenTokens = new Set<string>();

        for (const user of usersData) {
            if (user.fcmToken && !seenTokens.has(user.fcmToken)) {
                seenTokens.add(user.fcmToken);
                const ctx = { name: user.name, storeName: user.storeId || '', ...dataContext };
                uniquePushMessages.push({
                    token: user.fcmToken,
                    data: {
                        title: String(parseTemplate(templateData.titleTemplate, ctx) || 'Thông báo'),
                        body: String(parseTemplate(templateData.bodyTemplate, ctx) || 'Nội dung'),
                        actionLink: '/',
                    },
                });
            }
        }

        if (uniquePushMessages.length > 0) {
            const messageChunks = chunkArray(uniquePushMessages, 500);
            for (const chunk of messageChunks) {
                try {
                    const response = await adminMessaging.sendEach(chunk);
                    pushSuccessCount += response.successCount;
                    pushFailureCount += response.failureCount;
                } catch (pushErr) {
                    console.error(`${tag} FCM batch error:`, pushErr);
                }
            }
        }

        console.log(`${tag} ✅ FCM push: ${pushSuccessCount} sent, ${pushFailureCount} failed`);

        return {
            success: true,
            totalTargeted: usersData.length,
            pushSent: pushSuccessCount,
            pushFailed: pushFailureCount,
        };

    } catch (error) {
        console.error(`${tag} ❌ Broadcast failed:`, error);
        return { success: false, totalTargeted: 0, pushSent: 0, pushFailed: 0, error: 'Lỗi hệ thống' };
    }
}
