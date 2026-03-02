import { NextRequest, NextResponse } from 'next/server';
import { getAdminAuth, getAdminDb } from '@/lib/firebase-admin';
import { sendNotification } from '@/lib/notifications';
import { triggerEventNotification } from '@/lib/event-notifications';

interface DayPayload {
    date: string;
    shiftId: string;
    assignments: Record<string, {
        employeeIds: string[];
        assignedByManagerUids: string[];
    }>;
}

interface MultiDaySchedulePayload {
    storeId: string;
    /** New multi-day format: an array of day/shift payloads */
    days: DayPayload[];
}

// POST /api/schedules/bulk — Batch-write all counter assignments across multiple days
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
        const body = await req.json() as MultiDaySchedulePayload;
        if (!body.storeId || !Array.isArray(body.days) || body.days.length === 0) {
            return NextResponse.json({ error: 'Dữ liệu không hợp lệ' }, { status: 400 });
        }

        // 4. Single Firestore batch for all days
        const batch = adminDb.batch();
        const allAffectedUserIds = new Set<string>();

        // Track notification context per day for better messages
        const notificationContexts: Array<{ uid: string; shiftId: string; date: string }> = [];

        for (const day of body.days) {
            if (!day.date || !day.shiftId || !day.assignments) continue;

            for (const [counterId, data] of Object.entries(day.assignments)) {
                const docId = `${day.date}_${day.shiftId}_${counterId}`;
                const docRef = adminDb.collection('schedules').doc(docId);

                // Read old doc to detect which users are affected (added or removed)
                const oldDoc = await docRef.get();
                const oldEmployeeIds: string[] = oldDoc.exists ? (oldDoc.data()?.employeeIds || []) : [];

                const newlyAdded = data.employeeIds.filter(uid => !oldEmployeeIds.includes(uid));
                const removed = oldEmployeeIds.filter(uid => !data.employeeIds.includes(uid));

                newlyAdded.forEach(uid => {
                    allAffectedUserIds.add(uid);
                    notificationContexts.push({ uid, shiftId: day.shiftId, date: day.date });
                });
                removed.forEach(uid => allAffectedUserIds.add(uid));

                // Queue the write
                batch.set(docRef, {
                    id: docId,
                    date: day.date,
                    shiftId: day.shiftId,
                    counterId,
                    storeId: body.storeId,
                    employeeIds: data.employeeIds,
                    assignedByManagerUids: data.assignedByManagerUids,
                    publishedAt: new Date().toISOString(),
                    publishedBy: decoded.uid,
                });
            }
        }

        // 5. Commit all writes atomically in one batch
        await batch.commit();

        // 6. Send ONE aggregated notification per affected user (fire-and-forget)
        if (allAffectedUserIds.size > 0) {
            const storeSnap = await adminDb.collection('stores').doc(body.storeId).get();
            const storeName = storeSnap.exists ? (storeSnap.data()?.name || body.storeId) : body.storeId;

            // Deduplicate: one notification per user (use first context found)
            const notifiedUsers = new Set<string>();

            const notificationPromises = Array.from(allAffectedUserIds).map(async (uid) => {
                if (notifiedUsers.has(uid)) return;
                notifiedUsers.add(uid);
                try {
                    const ctx = notificationContexts.find(c => c.uid === uid);
                    const userSnap = await adminDb.collection('users').doc(uid).get();
                    const userName = userSnap.exists ? (userSnap.data()?.name || '') : '';

                    const result = await triggerEventNotification({
                        eventName: 'SCHEDULE_PUBLISHED',
                        userId: uid,
                        dataContext: {
                            name: userName,
                            storeName,
                            shiftId: ctx?.shiftId ?? body.days[0]?.shiftId ?? '',
                            date: ctx?.date ?? body.days[0]?.date ?? '',
                        },
                        actionLink: '/employee/dashboard',
                        storeId: body.storeId,
                    });

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

            Promise.all(notificationPromises).catch(() => { });
        }

        return NextResponse.json({
            message: 'Đã lưu và công khai lịch làm việc thành công',
            savedDays: body.days.length,
        });
    } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Lỗi hệ thống';
        console.error('[BulkSchedule] Error:', err);
        return NextResponse.json({ error: message }, { status: 500 });
    }
}
