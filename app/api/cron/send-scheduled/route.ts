import { NextResponse } from 'next/server';
import { getAdminDb, getAdminMessaging } from '@/lib/firebase-admin';
import { ScheduledNotification, NotificationTemplate, NotificationDoc } from '@/types';
import { parseTemplate } from '@/lib/template-parser';

export async function GET(request: Request) {
    try {
        // Authenticate the CRON request via standard Vercel protection header, or a custom secret
        const authHeader = request.headers.get('authorization');
        const isCronEnv = process.env.CRON_SECRET;

        if (isCronEnv && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
            return NextResponse.json({ success: false, error: 'Unauthorized CRON execution' }, { status: 401 });
        }

        const adminDb = getAdminDb();
        const adminMessaging = getAdminMessaging();
        const nowIso = new Date().toISOString();

        // 1. Find all active generic scheduled tasks that are past their scheduledAt time
        // Note: For recurring cron patterns, a more complex evaluator like `cron-parser` would be needed. 
        // For now, we address one-time scheduledAt tasks.
        const scheduledSnap = await adminDb.collection('scheduled_notifications')
            .where('isActive', '==', true)
            .where('scheduledAt', '<=', nowIso)
            .get();

        if (scheduledSnap.empty) {
            return NextResponse.json({ success: true, executed: 0, message: 'No scheduled tasks due.' });
        }

        let totalTargeted = 0;
        let pushSuccessCount = 0;
        let pushFailureCount = 0;

        for (const doc of scheduledSnap.docs) {
            const task = doc.data() as ScheduledNotification;

            try {
                // Determine target audience
                let usersQuery = adminDb.collection('users').where('isActive', '==', true);
                if (task.targetType === 'STORE' && task.targetValue) {
                    usersQuery = usersQuery.where('storeId', '==', task.targetValue);
                } else if (task.targetType === 'ROLE' && task.targetValue) {
                    usersQuery = usersQuery.where('role', '==', task.targetValue);
                }

                const [usersSnap, templateSnap] = await Promise.all([
                    usersQuery.get(),
                    adminDb.collection('notification_templates').doc(task.templateId).get()
                ]);

                if (!templateSnap.exists || usersSnap.empty) {
                    // Mark inactive since template is missing or no users exist
                    await doc.ref.update({ isActive: false, reason: 'Template missing or zero targets' });
                    continue;
                }

                const template = templateSnap.data() as NotificationTemplate;

                // Process dispatch loop (Batched & Deduplicated logic)
                const messagesPayloads: any[] = [];
                const batch = adminDb.batch();
                let batchCount = 0;

                const processedTokens = new Set<string>();

                for (const userDoc of usersSnap.docs) {
                    const userData = userDoc.data();
                    const uid = userDoc.id;
                    const fcmToken = userData.fcmToken;

                    // Parse Custom Variables
                    const dataContext: Record<string, string | number | undefined> = {
                        name: userData.name || 'Bạn',
                        role: userData.role || '',
                        targetValue: task.targetValue || '',
                        storeId: task.targetValue || '',
                    };

                    const finalTitle = parseTemplate(template.titleTemplate, dataContext);
                    const finalBody = parseTemplate(template.bodyTemplate, dataContext);

                    // 1. Create In-App Notification Doc
                    const baseNotifRef = adminDb.collection('notifications').doc();
                    batch.set(baseNotifRef, {
                        id: baseNotifRef.id,
                        userId: uid,
                        title: finalTitle,
                        body: finalBody,
                        type: 'SYSTEM',
                        isRead: false,
                        createdAt: nowIso,
                    });
                    batchCount++;
                    totalTargeted++;

                    // Write batch chunk if reaching limit (500)
                    if (batchCount === 450) {
                        await batch.commit();
                        batchCount = 0;
                    }

                    // 2. Queue FCM push avoiding duplicate token
                    if (fcmToken && typeof fcmToken === 'string' && !processedTokens.has(fcmToken)) {
                        processedTokens.add(fcmToken);
                        messagesPayloads.push({
                            token: fcmToken,
                            notification: {
                                title: finalTitle,
                                body: finalBody
                            }
                        });
                    }
                }

                // Push remaining batch chunk
                if (batchCount > 0) {
                    await batch.commit();
                }

                // Dispatch FCM sendEach in chunks of 500
                const CHUNK_SIZE = 500;
                for (let i = 0; i < messagesPayloads.length; i += CHUNK_SIZE) {
                    const chunk = messagesPayloads.slice(i, i + CHUNK_SIZE);
                    const pushResponse = await adminMessaging.sendEach(chunk);
                    pushSuccessCount += pushResponse.successCount;
                    pushFailureCount += pushResponse.failureCount;

                    if (pushResponse.failureCount > 0) {
                        pushResponse.responses.forEach((resp: any, idx: number) => {
                            if (!resp.success) console.error(`Failed to send to token. Error: ${resp.error}`);
                        });
                    }
                }

                // Deactivate the one-time scheduled task after successfully running
                await doc.ref.update({
                    isActive: false,
                    executedAt: nowIso,
                    targetsHit: totalTargeted
                });

            } catch (taskErr) {
                console.error(`Error processing scheduled task ${task.id}:`, taskErr);
                // Mark failed, perhaps implement retry logic later
                await doc.ref.update({ isActive: false, error: 'Execution failed internal' });
            }
        }

        return NextResponse.json({
            success: true,
            executed: scheduledSnap.size,
            stats: {
                totalTargeted,
                pushSent: pushSuccessCount,
                pushFailed: pushFailureCount
            }
        });

    } catch (error) {
        console.error('CRON Scheduled Notifications Error:', error);
        return NextResponse.json({ success: false, error: 'Internal Server Error' }, { status: 500 });
    }
}
