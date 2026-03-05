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

        // Find any schedule for today where this user is in assignedByManagerUids
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

        // Look for a schedule where user is force-assigned
        for (const doc of schedulesSnap.docs) {
            const schedule = doc.data();
            const assignedByManager: string[] = schedule.assignedByManagerUids || [];

            if (assignedByManager.includes(decoded.uid)) {
                // Fetch counter name for display
                let counterName = 'Quầy (không xác định)';
                try {
                    const counterSnap = await db.collection('counters').doc(schedule.counterId).get();
                    if (counterSnap.exists && counterSnap.data()?.name) {
                        counterName = counterSnap.data()!.name;
                    }
                } catch { /* use friendly fallback */ }

                return NextResponse.json({
                    isAuthorized: true,
                    counterId: schedule.counterId,
                    counterName,
                    shiftId: schedule.shiftId,
                    storeId: schedule.storeId,
                });
            }
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
