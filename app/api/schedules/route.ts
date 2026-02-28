import { NextRequest, NextResponse } from 'next/server';
import { getAdminAuth, getAdminDb } from '@/lib/firebase-admin';
import { sendNotification } from '@/lib/notifications';

interface SchedulePayload {
    date: string;
    shiftId: string;
    storeId: string;
    assignments: Record<string, {
        employeeIds: string[];
        assignedByManagerUids: string[];
    }>;
}

// POST /api/schedules — Save schedule assignments + notify force-assigned users
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
        const body = await req.json() as SchedulePayload;
        if (!body.date || !body.shiftId || !body.storeId || !body.assignments) {
            return NextResponse.json({ error: 'Dữ liệu không hợp lệ' }, { status: 400 });
        }

        // 4. For each counter, read old doc to detect newly force-assigned users
        const newlyAssignedUsers: { uid: string; shiftId: string; date: string }[] = [];

        const batchPromises = Object.entries(body.assignments).map(async ([counterId, data]) => {
            const docId = `${body.date}_${body.shiftId}_${counterId}`;
            const docRef = adminDb.collection('schedules').doc(docId);

            // Read previous doc to find previously force-assigned users
            const oldDoc = await docRef.get();
            const oldAssignedByManager: string[] = oldDoc.exists
                ? (oldDoc.data()?.assignedByManagerUids || [])
                : [];

            // Detect newly force-assigned UIDs (in new list but not in old list)
            const newForceAssigned = data.assignedByManagerUids.filter(
                uid => !oldAssignedByManager.includes(uid)
            );
            newForceAssigned.forEach(uid => {
                newlyAssignedUsers.push({ uid, shiftId: body.shiftId, date: body.date });
            });

            // Write schedule document
            await docRef.set({
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
        });

        await Promise.all(batchPromises);

        // 5. Send notifications to newly force-assigned users (fire-and-forget)
        const notificationPromises = newlyAssignedUsers.map(({ uid, shiftId, date }) =>
            sendNotification({
                userId: uid,
                title: 'Bạn vừa được gán ca làm việc',
                body: `Quản lý đã phân công bạn làm ca ${shiftId} ngày ${date}. Vui lòng kiểm tra lịch.`,
                type: 'SYSTEM',
                actionLink: '/employee/dashboard',
                storeId: body.storeId,
            }).catch(err => console.error(`[Schedules] Failed to notify ${uid}:`, err))
        );

        // Don't block the response on notifications
        Promise.all(notificationPromises).catch(() => { });

        return NextResponse.json({ message: 'Đã lưu lịch làm việc thành công' });
    } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Lỗi hệ thống';
        console.error('[Schedules] Error:', err);
        return NextResponse.json({ error: message }, { status: 500 });
    }
}
