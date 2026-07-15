import { NextRequest, NextResponse } from 'next/server';
import { getAdminAuth, getAdminDb } from '@/lib/firebase-admin';

// GET /api/inventory/my-assignment — Check if the current user has an active
// counter assignment for today (assigned by manager).
export async function GET(req: NextRequest) {
    try {
        const token = req.headers.get('Authorization')?.split('Bearer ')[1];
        if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

        const auth = getAdminAuth();
        const decoded = await auth.verifyIdToken(token);
        const db = getAdminDb();

        // Get today's date in Vietnam timezone
        const today = new Date().toLocaleDateString('sv-SE', { timeZone: 'Asia/Ho_Chi_Minh' });

        // Find schedules for today. employeeIds is the authoritative assignment
        // list; assignedByManagerUids only marks force-assigned employees.
        const schedulesSnap = await db
            .collection('schedules')
            .where('date', '==', today)
            .get();

        if (schedulesSnap.empty) {
            return NextResponse.json({
                isAuthorized: false,
                message: 'Không có lịch phân công nào hôm nay.',
            });
        }

        const assignments: Array<{
            counterId: string;
            counterName: string;
            shiftId: string;
            storeId: string;
        }> = [];
        for (const doc of schedulesSnap.docs) {
            const schedule = doc.data();
            const employeeIds: string[] = schedule.employeeIds || [];

            if (employeeIds.includes(decoded.uid)) {
                let counterName = 'Quầy (không xác định)';
                const storeSnap = await db.collection('stores').doc(schedule.storeId).get();
                const counters = Array.isArray(storeSnap.data()?.settings?.counters)
                    ? storeSnap.data()!.settings.counters
                    : [];
                const counter = counters.find((item: { id?: string }) => item.id === schedule.counterId);
                if (counter?.name) counterName = counter.name;

                assignments.push({
                    counterId: schedule.counterId,
                    counterName,
                    shiftId: schedule.shiftId,
                    storeId: schedule.storeId,
                });
            }
        }

        if (assignments.length > 0) {
            return NextResponse.json({
                isAuthorized: true,
                ...assignments[0],
                assignments,
            });
        }

        return NextResponse.json({
            isAuthorized: false,
            message: 'Bạn không được phân công trực tại quầy nào hôm nay.',
        });
    } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Server error';
        return NextResponse.json({ error: message }, { status: 500 });
    }
}
