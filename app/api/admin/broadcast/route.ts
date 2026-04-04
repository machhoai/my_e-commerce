import { NextResponse } from 'next/server';
import { getAdminAuth } from '@/lib/firebase-admin';
import { broadcastTemplate } from '@/lib/notification-engine';

export async function POST(request: Request) {
    try {
        const authHeader = request.headers.get('Authorization');
        if (!authHeader?.startsWith('Bearer ')) {
            return NextResponse.json({ error: 'Không được phép' }, { status: 401 });
        }
        const token = authHeader.split('Bearer ')[1];

        const adminAuth = getAdminAuth();
        const decodedToken = await adminAuth.verifyIdToken(token);
        const requestUid = decodedToken.uid;

        // Verify admin role using the engine's DB access
        const { getAdminDb } = await import('@/lib/firebase-admin');
        const adminDb = getAdminDb();
        const requesterDoc = await adminDb.collection('users').doc(requestUid).get();
        const requesterRole = requesterDoc.data()?.role;
        if (!requesterDoc.exists || (requesterRole !== 'admin' && requesterRole !== 'store_manager')) {
            return NextResponse.json({ error: 'Chỉ Quản trị viên hoặc Cửa hàng trưởng mới có quyền gửi thông báo hàng loạt' }, { status: 403 });
        }

        const body = await request.json();
        const { title, message, targetType, targetValue, templateId } = body;

        // If templateId is provided, use the engine's broadcastTemplate
        if (templateId) {
            const result = await broadcastTemplate({
                templateId,
                targetType: targetType || 'ALL',
                targetValue,
            });

            if (!result.success) {
                return NextResponse.json({ error: result.error || 'Không thể gửi thông báo' }, { status: 400 });
            }

            return NextResponse.json({
                success: true,
                message: `Đã gửi thông báo thành công tới ${result.totalTargeted} người dùng.`,
                stats: {
                    totalTargeted: result.totalTargeted,
                    pushSent: result.pushSent,
                    pushFailed: result.pushFailed,
                },
            });
        }

        // Fallback: free-form title/message broadcast (from the standalone broadcast page)
        if (!title || !message || !targetType) {
            return NextResponse.json({ error: 'Thiếu thông tin bắt buộc' }, { status: 400 });
        }

        // For free-form broadcasts, we use the sendNotification directly
        const { getAdminMessaging } = await import('@/lib/firebase-admin');
        const { parseTemplate } = await import('@/lib/template-parser');
        const adminMessaging = getAdminMessaging();

        // Build user query
        let usersQuery: FirebaseFirestore.Query = adminDb.collection('users');

        if (targetType === 'STORE') {
            if (!targetValue) return NextResponse.json({ error: 'Vui lòng chọn cửa hàng' }, { status: 400 });
            usersQuery = usersQuery.where('storeId', '==', targetValue);
        } else if (targetType === 'ROLE') {
            if (!targetValue) return NextResponse.json({ error: 'Vui lòng chọn chức vụ' }, { status: 400 });
            usersQuery = usersQuery.where('role', '==', targetValue);
        }

        const usersSnapshot = await usersQuery.get();
        if (usersSnapshot.empty) {
            return NextResponse.json({ error: 'Không tìm thấy người dùng nào phù hợp với điều kiện' }, { status: 404 });
        }

        const usersData: { uid: string, name: string, fcmToken?: string, fcmTokens?: string[], storeId?: string }[] = [];

        usersSnapshot.forEach(doc => {
            const data = doc.data();
            if (data.isActive !== false) {
                usersData.push({
                    uid: doc.id,
                    name: data.name || 'bạn',
                    fcmToken: data.fcmToken,
                    fcmTokens: data.fcmTokens,
                    storeId: data.storeId,
                });
            }
        });

        const createdAt = new Date().toISOString();

        // Chunk helper
        const chunkArray = <T>(arr: T[], size: number): T[][] => {
            const chunks = [];
            for (let i = 0; i < arr.length; i += size) {
                chunks.push(arr.slice(i, i + size));
            }
            return chunks;
        };

        // Write to Firestore (Batched)
        const userChunks = chunkArray(usersData, 500);
        for (const chunk of userChunks) {
            const batch = adminDb.batch();
            for (const user of chunk) {
                const ctx = { name: user.name, storeName: user.storeId || '' };
                const personalizedTitle = parseTemplate(title, ctx);
                const personalizedBody = parseTemplate(message, ctx);

                const notificationRef = adminDb.collection('notifications').doc();
                batch.set(notificationRef, {
                    id: notificationRef.id,
                    userId: user.uid,
                    title: personalizedTitle,
                    body: personalizedBody,
                    type: 'SYSTEM',
                    isRead: false,
                    createdAt
                });
            }
            await batch.commit();
        }

        // Send FCM Push Notifications
        let pushSuccessCount = 0;
        let pushFailureCount = 0;

        const uniquePushMessages: any[] = [];
        const seenTokens = new Set<string>();

        for (const user of usersData) {
            // Collect all device tokens: new array + legacy single token
            const tokenSet = new Set<string>(user.fcmTokens || []);
            if (user.fcmToken) tokenSet.add(user.fcmToken);

            for (const token of tokenSet) {
                if (!seenTokens.has(token)) {
                    seenTokens.add(token);
                    const ctx = { name: user.name, storeName: user.storeId || '' };
                    const finalTitle = String(parseTemplate(title, ctx) || 'Thông báo');
                    const finalBody = String(parseTemplate(message, ctx) || 'Nội dung');
                    const validActionLink = '/';

                    uniquePushMessages.push({
                        token,
                        notification: {
                            title: finalTitle,
                            body: finalBody,
                        },
                        webpush: {
                            fcmOptions: {
                                link: validActionLink
                            }
                        },
                        data: {
                            actionLink: validActionLink,
                        }
                    });
                }
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
                    console.error("Lỗi khi gửi Push FCM hàng loạt:", pushErr);
                }
            }
        }

        return NextResponse.json({
            success: true,
            message: `Đã gửi thông báo thành công tới ${usersData.length} người dùng.`,
            stats: {
                totalTargeted: usersData.length,
                pushSent: pushSuccessCount,
                pushFailed: pushFailureCount
            }
        });

    } catch (error: unknown) {
        console.error('Lỗi khi gửi thông báo hàng loạt:', error);
        const errorMessage = error instanceof Error ? error.message : 'Lỗi hệ thống';
        return NextResponse.json({ error: errorMessage }, { status: 500 });
    }
}
