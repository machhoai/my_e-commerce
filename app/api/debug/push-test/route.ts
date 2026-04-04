import { NextRequest, NextResponse } from 'next/server';
import { getAdminMessaging } from '@/lib/firebase-admin';

/**
 * POST /api/debug/push-test
 * Body: { token: string }
 *
 * Sends a standardized iOS-compatible push notification directly to a single
 * FCM token. Used exclusively by the PushDebugPanel component during development.
 */
export async function POST(req: NextRequest) {
    try {
        const { token } = await req.json();

        if (!token || typeof token !== 'string') {
            return NextResponse.json({ error: 'Missing or invalid token' }, { status: 400 });
        }

        const adminMessaging = getAdminMessaging();

        // ── iOS-compliant payload ────────────────────────────────────────────
        // RULE: iOS APNs will silently DROP any Web Push message that does NOT
        // have a `notification` object at the root. Data-only messages are
        // invisible to iOS when the app is backgrounded or closed.
        //
        // We set BOTH `notification` (for iOS APNs) and `data` (for the SW
        // raw push handler to read actionLink from).
        const message = {
            token,
            notification: {
                title: '🔔 iOS Push Test',
                body: `[${new Date().toLocaleTimeString('vi-VN')}] Thông báo test từ Debug Panel. Nếu bạn thấy cái này, iOS đã hoạt động!`,
            },
            webpush: {
                headers: {
                    // TTL: 60 seconds — short-lived test message
                    TTL: '60',
                    Urgency: 'high',
                },
                fcmOptions: {
                    link: '/mobile/dashboard',
                },
            },
            data: {
                actionLink: '/mobile/dashboard',
                source: 'push-debug-panel',
            },
            apns: {
                headers: {
                    // APNs priority 10 = immediate delivery (required for iOS PWAs)
                    'apns-priority': '10',
                    'apns-push-type': 'alert',
                },
                payload: {
                    aps: {
                        alert: {
                            title: '🔔 iOS Push Test',
                            body: `[${new Date().toLocaleTimeString('vi-VN')}] Thông báo test từ Debug Panel!`,
                        },
                        sound: 'default',
                        badge: 1,
                    },
                },
            },
        };

        const response = await adminMessaging.send(message);

        return NextResponse.json({
            success: true,
            messageId: response,
            sentAt: new Date().toISOString(),
        });
    } catch (error: unknown) {
        const err = error as { code?: string; message?: string };
        console.error('[DebugPush] Error sending test push:', err);

        return NextResponse.json({
            success: false,
            error: err?.message || 'Unknown error',
            code: err?.code,
        }, { status: 500 });
    }
}
