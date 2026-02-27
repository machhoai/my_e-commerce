import { getAdminDb } from './firebase-admin';
import { parseTemplate } from './template-parser';
import { sendNotification } from './notifications';
import { SettingsDoc, NotificationTemplate } from '@/types';

interface TriggerEventProps {
    eventName: string;
    userId: string;
    dataContext: Record<string, string | number | undefined>;
    actionLink?: string;
    storeId?: string;
}

/**
 * Automatically dynamically sends a pre-configured notification if the event is mapped to a template.
 */
export async function triggerEventNotification({
    eventName,
    userId,
    dataContext,
    actionLink,
    storeId
}: TriggerEventProps) {
    try {
        const adminDb = getAdminDb();

        // 1. Fetch Global Settings to find Event Mapping
        const settingsSnap = await adminDb.collection('settings').doc('global').get();
        if (!settingsSnap.exists) {
            console.log(`[EventNotification] Settings document not found. Skipping event: ${eventName}`);
            return { success: false, reason: 'unmapped' };
        }

        const settingsData = settingsSnap.data() as SettingsDoc;
        const mappings = settingsData.eventMappings || {};
        const templateId = mappings[eventName];

        if (!templateId) {
            console.log(`[EventNotification] Event '${eventName}' is not mapped to any template. Skipping.`);
            return { success: false, reason: 'unmapped' };
        }

        // 2. Fetch the corresponding Template
        const templateSnap = await adminDb.collection('notification_templates').doc(templateId).get();
        if (!templateSnap.exists) {
            console.error(`[EventNotification] Mapped template ID ${templateId} not found for event ${eventName}.`);
            return { success: false, reason: 'template_missing' };
        }

        const templateData = templateSnap.data() as NotificationTemplate;

        // 3. Parse templates using the provided rich data context
        const finalTitle = parseTemplate(templateData.titleTemplate, dataContext);
        const finalBody = parseTemplate(templateData.bodyTemplate, dataContext);

        // 4. Dispatch the actual Push Notification + Save to Firestore
        const result = await sendNotification({
            userId,
            title: finalTitle,
            body: finalBody,
            type: 'SYSTEM',
            actionLink,
            storeId
        });

        console.log(`[EventNotification] Successfully triggered event ${eventName} to user ${userId}`);
        return { success: true, notificationId: result.notificationId };

    } catch (error) {
        console.error(`[EventNotification] Failed to trigger event ${eventName} for user ${userId}:`, error);
        return { success: false, error: 'Internal delivery failure' };
    }
}
