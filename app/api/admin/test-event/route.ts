import { NextResponse } from 'next/server';
import { getAdminAuth, getAdminDb } from '@/lib/firebase-admin';
import { sendTemplatedNotification } from '@/lib/notification-engine';

// Mock data contexts for each system event
const MOCK_CONTEXTS: Record<string, Record<string, string | number>> = {
    SCHEDULE_PUBLISHED: {
        shiftDate: '10/04/2026',
        storeName: 'Joy World Quận 1',
    },
    SHIFT_CHANGED: {
        shiftDate: '10/04/2026',
        oldShift: 'Ca sáng (8:00 - 14:00)',
        newShift: 'Ca chiều (14:00 - 22:00)',
        storeName: 'Joy World Quận 1',
    },
    SWAP_REQUEST_RECEIVED: {
        requesterName: 'Nguyễn Văn A',
        shiftDate: '12/04/2026',
        storeName: 'Joy World Quận 1',
    },
    SWAP_REQUEST_APPROVED: {
        partnerName: 'Trần Thị B',
        shiftDate: '12/04/2026',
        storeName: 'Joy World Quận 1',
    },
    REFERRAL_POINTS_EARNED: {
        employeeName: 'Nguyễn Văn Test',
        points: 1,
        packageName: 'Gold',
    },
};

export async function POST(request: Request) {
    try {
        // Auth check
        const authHeader = request.headers.get('Authorization');
        if (!authHeader?.startsWith('Bearer ')) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }
        const token = authHeader.split('Bearer ')[1];
        const adminAuth = getAdminAuth();
        const decoded = await adminAuth.verifyIdToken(token);
        const uid = decoded.uid;

        // Verify admin role
        const adminDb = getAdminDb();
        const userSnap = await adminDb.collection('users').doc(uid).get();
        const role = userSnap.data()?.role;
        if (!userSnap.exists || (role !== 'admin' && role !== 'super_admin' && role !== 'store_manager')) {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        }

        const body = await request.json();
        const { eventKey } = body;

        if (!eventKey) {
            return NextResponse.json({ error: 'Missing eventKey' }, { status: 400 });
        }

        const mockContext = MOCK_CONTEXTS[eventKey] || {};
        const dataContext = {
            name: userSnap.data()?.name || 'Admin Test',
            ...mockContext,
        };

        console.log(`[TestEvent] Testing event '${eventKey}' for user ${uid}`);

        const result = await sendTemplatedNotification({
            userId: uid,
            eventName: eventKey,
            dataContext,
        });

        if (result.success) {
            return NextResponse.json({
                success: true,
                message: `✅ Test thành công! Notification đã gửi đến bạn.`,
                notificationId: result.notificationId,
            });
        } else {
            const reasonMessages: Record<string, string> = {
                settings_missing: 'Chưa có settings/global trong Firestore.',
                unmapped: `Sự kiện '${eventKey}' chưa được map với mẫu thông báo nào. Hãy chọn mẫu trước.`,
                no_template: 'Không tìm thấy mẫu thông báo.',
                template_missing: 'Mẫu thông báo đã bị xóa.',
                internal_error: 'Lỗi hệ thống.',
            };
            return NextResponse.json({
                success: false,
                error: reasonMessages[result.reason || ''] || `Thất bại: ${result.reason}`,
            }, { status: 400 });
        }
    } catch (error) {
        console.error('[TestEvent] Error:', error);
        return NextResponse.json({ error: 'Lỗi hệ thống' }, { status: 500 });
    }
}
