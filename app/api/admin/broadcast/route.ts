import { NextResponse } from 'next/server';
import { getAdminAuth, getAdminDb, getAdminMessaging } from '@/lib/firebase-admin';

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

        const adminDb = getAdminDb();
        const adminMessaging = getAdminMessaging();

        // Verify admin role
        const requesterDoc = await adminDb.collection('users').doc(requestUid).get();
        if (!requesterDoc.exists || requesterDoc.data()?.role !== 'admin') {
            return NextResponse.json({ error: 'Chỉ Quản trị viên mới có quyền gửi thông báo hàng loạt' }, { status: 403 });
        }

        const body = await request.json();
        const { title, message, targetType, targetValue } = body;

        if (!title || !message || !targetType) {
            return NextResponse.json({ error: 'Thiếu thông tin bắt buộc' }, { status: 400 });
        }

        // 1. Build Query
        // Only target active users
        let usersQuery: FirebaseFirestore.Query = adminDb.collection('users').where('isActive', '==', true);

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

        const uids: string[] = [];
        const fcmTokens: string[] = [];

        usersSnapshot.forEach(doc => {
            const data = doc.data();

            // Filter active users manually here to avoid missing composite index errors on Firestore
            if (data.isActive !== false) {
                uids.push(doc.id);
                if (data.fcmToken) {
                    fcmTokens.push(data.fcmToken);
                }
            }
        });

        const createdAt = new Date().toISOString();

        // 2. Action 1: Write to Firestore (Batched)
        // Firestore batch limits to 500 writes
        const chunkArray = <T>(arr: T[], size: number): T[][] => {
            const chunks = [];
            for (let i = 0; i < arr.length; i += size) {
                chunks.push(arr.slice(i, i + size));
            }
            return chunks;
        };

        const uidChunks = chunkArray(uids, 500);

        for (const chunk of uidChunks) {
            const batch = adminDb.batch();
            for (const uid of chunk) {
                const notificationRef = adminDb.collection('notifications').doc();
                batch.set(notificationRef, {
                    id: notificationRef.id,
                    userId: uid,
                    title,
                    body: message,
                    type: 'SYSTEM',
                    isRead: false,
                    createdAt
                });
            }
            await batch.commit();
        }

        // 3. Action 2: Send Push Notifications via FCM
        let pushSuccessCount = 0;
        let pushFailureCount = 0;

        if (fcmTokens.length > 0) {
            const tokenChunks = chunkArray(fcmTokens, 500); // sendEachForMulticast accepts max 500 tokens
            for (const chunk of tokenChunks) {
                try {
                    const response = await adminMessaging.sendEachForMulticast({
                        tokens: chunk,
                        notification: {
                            title,
                            body: message
                        },
                        webpush: {
                            notification: {
                                icon: '/Artboard.png',
                                badge: '/Artboard.png'
                            }
                        }
                    });
                    pushSuccessCount += response.successCount;
                    pushFailureCount += response.failureCount;
                } catch (pushErr) {
                    console.error("Lỗi khi gửi Push FCM hàng loạt:", pushErr);
                }
            }
        }

        return NextResponse.json({
            success: true,
            message: `Đã gửi thông báo thành công tới ${uids.length} người dùng.`,
            stats: {
                totalTargeted: uids.length,
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
