import { NextRequest, NextResponse } from 'next/server';
import { getAdminDb, getAdminMessaging } from '@/lib/firebase-admin';
import type { SendResponse } from 'firebase-admin/messaging';

/**
 * GET /api/debug/push-status?uid=USER_ID
 *
 * Returns a full diagnostic snapshot of the push notification pipeline
 * for a specific user. This helps identify exactly which link in the chain
 * is broken on production (Vercel) without needing console access.
 *
 * REMOVE THIS ENDPOINT AFTER DEBUGGING IS COMPLETE.
 */
export async function GET(req: NextRequest) {
    const uid = req.nextUrl.searchParams.get('uid');

    if (!uid) {
        return NextResponse.json({ error: 'Missing uid param. Use ?uid=USER_UID' }, { status: 400 });
    }

    const result: Record<string, unknown> = {
        timestamp: new Date().toISOString(),
        nodeEnv: process.env.NODE_ENV,
    };

    // ── 1. Check server env vars ─────────────────────────────────────────────
    result.envVars = {
        NEXT_PUBLIC_FIREBASE_API_KEY:           process.env.NEXT_PUBLIC_FIREBASE_API_KEY ? '✅ SET' : '❌ MISSING',
        NEXT_PUBLIC_FIREBASE_PROJECT_ID:        process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID ? '✅ SET' : '❌ MISSING',
        NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID ? '✅ SET' : '❌ MISSING',
        NEXT_PUBLIC_FIREBASE_VAPID_KEY:         process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY ? '✅ SET' : '❌ MISSING',
        FIREBASE_ADMIN_PROJECT_ID:              process.env.FIREBASE_ADMIN_PROJECT_ID ? '✅ SET' : '❌ MISSING',
        FIREBASE_ADMIN_CLIENT_EMAIL:            process.env.FIREBASE_ADMIN_CLIENT_EMAIL ? '✅ SET' : '❌ MISSING',
        FIREBASE_ADMIN_PRIVATE_KEY:             process.env.FIREBASE_ADMIN_PRIVATE_KEY ? '✅ SET' : '❌ MISSING',
        // Show partial value for VAPID to verify correct key
        VAPID_KEY_PREVIEW: process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY
            ? `${process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY.substring(0, 10)}...${process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY.slice(-6)}`
            : 'NOT FOUND',
    };

    // ── 2. Check Firestore for FCM tokens ────────────────────────────────────
    try {
        const adminDb = getAdminDb();
        const userDoc = await adminDb.collection('users').doc(uid).get();

        if (!userDoc.exists) {
            result.firestore = { error: `User ${uid} not found in Firestore` };
        } else {
            const data = userDoc.data()!;
            const fcmTokens: string[] = data.fcmTokens || [];
            const legacyToken: string = data.fcmToken || '';
            const allTokens = new Set(fcmTokens);
            if (legacyToken) allTokens.add(legacyToken);

            result.firestore = {
                fcmTokensCount: fcmTokens.length,
                legacyTokenPresent: Boolean(legacyToken),
                totalUniqueTokens: allTokens.size,
                // Show token previews (first 20 + last 10 chars) for identification
                tokenPreviews: Array.from(allTokens).map(t =>
                    `${t.substring(0, 20)}...${t.slice(-10)}`
                ),
            };

            // ── 3. Test send to each token ────────────────────────────────────
            if (allTokens.size > 0) {
                const adminMessaging = getAdminMessaging();
                const testMessages = Array.from(allTokens).map(token => ({
                    token,
                    notification: {
                        title: `🔧 Server Diagnostic [${new Date().toLocaleTimeString('vi-VN')}]`,
                        body: 'Token test từ /api/debug/push-status. Nếu bạn thấy cái này → push hoạt động!',
                    },
                    webpush: {
                        headers: { TTL: '60', Urgency: 'high' },
                        fcmOptions: { link: '/mobile/dashboard' },
                    },
                    data: { actionLink: '/mobile/dashboard', source: 'server-diagnostic' },
                    apns: {
                        headers: { 'apns-priority': '10', 'apns-push-type': 'alert' },
                        payload: {
                            aps: {
                                alert: {
                                    title: '🔧 Server Diagnostic',
                                    body: 'Token test thành công!',
                                },
                                sound: 'default',
                            },
                        },
                    },
                }));

                const sendResult = await adminMessaging.sendEach(testMessages);
                const responses = sendResult.responses.map((r: SendResponse, i: number) => ({
                    tokenPreview: `${Array.from(allTokens)[i].substring(0, 20)}...`,
                    success: r.success,
                    messageId: r.messageId || null,
                    errorCode: r.error?.code || null,
                    errorMessage: r.error?.message || null,
                }));

                result.fcmSendTest = {
                    successCount: sendResult.successCount,
                    failureCount: sendResult.failureCount,
                    responses,
                };
            } else {
                result.fcmSendTest = { skipped: 'No FCM tokens found for this user' };
            }
        }
    } catch (error: unknown) {
        result.firestore = { error: String(error) };
    }

    return NextResponse.json(result, {
        headers: {
            'Cache-Control': 'no-store',
        },
    });
}
