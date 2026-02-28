import { NextRequest, NextResponse } from 'next/server';
import { getAdminAuth, getAdminDb } from '@/lib/firebase-admin';
import { sendNotification } from '@/lib/notifications';
import { triggerEventNotification } from '@/lib/event-notifications';

interface BulkSchedulePayload {
    date: string;
    shiftId: string;
    storeId: string;
    assignments: Record<string, {
        employeeIds: string[];
        assignedByManagerUids: string[];
    }>;
}

// POST /api/schedules/bulk — Batch-write all counter assignments + aggregated notifications
export async function POST(req: NextRequest) {
    try {
        // 1. Verify authentication
        const token = req.headers.get('Authorization')?.split('Bearer ')[1];
        if (!token) return NextResponse.json({ error: 'Không được phép' }, { status: 401 });

        const adminAuth = getAdminAuth();
        const decoded = await adminAuth.verifyIdToken(token);
        const adminDb = getAdminDb();

        // 2. Verify caller is admin, store_manager or manager with HR permission
        const callerDoc = await adminDb.collection('users').doc(decoded.uid).get();
        if (!callerDoc.exists) {
            return NextResponse.json({ error: 'Không tìm thấy người dùng' }, { status: 403 });
        }
        const callerData = callerDoc.data()!;
        const allowedRoles = ['admin', 'store_manager', 'manager'];
        if (!allowedRoles.includes(callerData.role) && !callerData.canManageHR) {
            return NextResponse.json({ error: 'Không có quyền xếp lịch' }, { status: 403 });
        }

        // 3. Parse request body
        const body = await req.json() as BulkSchedulePayload;
        if (!body.date || !body.shiftId || !body.storeId || !body.assignments) {
            return NextResponse.json({ error: 'Dữ liệu không hợp lệ' }, { status: 400 });
        }

        // 4. Read all old schedule docs to detect changes, then batch-write everything
        const batch = adminDb.batch();
        const allAffectedUserIds = new Set<string>();

        for (const [counterId, data] of Object.entries(body.assignments)) {
            const docId = `${body.date}_${body.shiftId}_${counterId}`;
            const docRef = adminDb.collection('schedules').doc(docId);

            // Read old doc to detect which users are affected (added or removed)
            const oldDoc = await docRef.get();
            const oldEmployeeIds: string[] = oldDoc.exists ? (oldDoc.data()?.employeeIds || []) : [];

            // Find newly added and removed users
            const newlyAdded = data.employeeIds.filter(uid => !oldEmployeeIds.includes(uid));
            const removed = oldEmployeeIds.filter(uid => !data.employeeIds.includes(uid));

            // Track all affected users (both added and removed)
            newlyAdded.forEach(uid => allAffectedUserIds.add(uid));
            removed.forEach(uid => allAffectedUserIds.add(uid));

            // Queue the write in the batch
            batch.set(docRef, {
                id: docId,
                date: body.date,
                shiftId: body.shiftId,
                counterId,
                storeId: body.storeId,
                employeeIds: data.employeeIds,
                assignedByManagerUids: data.assignedByManagerUids,
                publishedAt: new Date().toISOString(),
                publishedBy: decoded.uid,
            });
        }

        // 5. Commit all writes atomically
        await batch.commit();

        // 6. Send ONE aggregated notification per affected user via event templates (fire-and-forget)
        if (allAffectedUserIds.size > 0) {
            // Fetch store name for template context
            const storeSnap = await adminDb.collection('stores').doc(body.storeId).get();
            const storeName = storeSnap.exists ? (storeSnap.data()?.name || body.storeId) : body.storeId;

            const notificationPromises = Array.from(allAffectedUserIds).map(async (uid) => {
                try {
                    // Fetch user name for template context
                    const userSnap = await adminDb.collection('users').doc(uid).get();
                    const userName = userSnap.exists ? (userSnap.data()?.name || '') : '';

                    // Try event-driven template first
                    const result = await triggerEventNotification({
                        eventName: 'SCHEDULE_PUBLISHED',
                        userId: uid,
                        dataContext: { name: userName, storeName, shiftId: body.shiftId, date: body.date },
                        actionLink: '/employee/dashboard',
                        storeId: body.storeId,
                    });

                    // Fallback to hardcoded notification if event is unmapped
                    if (!result.success && result.reason === 'unmapped') {
                        await sendNotification({
                            userId: uid,
                            title: 'Lịch làm việc của bạn đã được cập nhật',
                            body: 'Quản lý vừa công khai lịch làm việc mới. Vui lòng vào ứng dụng để kiểm tra chi tiết các ca làm của bạn.',
                            type: 'SYSTEM',
                            actionLink: '/employee/dashboard',
                            storeId: body.storeId,
                        });
                    }
                } catch (err) {
                    console.error(`[BulkSchedule] Failed to notify ${uid}:`, err);
                }
            });

            // Don't block the response on notifications
            Promise.all(notificationPromises).catch(() => { });
        }

        return NextResponse.json({ message: 'Đã lưu và công khai lịch làm việc thành công' });
    } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Lỗi hệ thống';
        console.error('[BulkSchedule] Error:', err);
        return NextResponse.json({ error: message }, { status: 500 });
    }
}

