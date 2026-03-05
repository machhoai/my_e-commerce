import { NextRequest, NextResponse } from 'next/server';
import { getAdminAuth, getAdminDb } from '@/lib/firebase-admin';
import { verifyCounterAccess } from '@/lib/inventory-services';
import type { ShiftHandoverDoc, HandoverCountedItem } from '@/types/inventory';

// POST /api/inventory/handover — Submit shift handover cross-check
export async function POST(req: NextRequest) {
    try {
        const token = req.headers.get('Authorization')?.split('Bearer ')[1];
        if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

        const auth = getAdminAuth();
        const decoded = await auth.verifyIdToken(token);

        const body = await req.json();
        const {
            storeId,
            counterId,
            outgoingShiftId,
            incomingShiftId,
            incomingUserId,
            countedItems,
            note,
        } = body;

        if (!storeId || !counterId || !outgoingShiftId || !incomingShiftId || !countedItems) {
            return NextResponse.json({ error: 'Thiếu thông tin bắt buộc' }, { status: 400 });
        }

        // ── Shift-based access control ──
        const access = await verifyCounterAccess(decoded.uid, counterId);
        if (!access.isAuthorized) {
            return NextResponse.json(
                { error: `UNAUTHORIZED: ${access.error}` },
                { status: 403 }
            );
        }

        const db = getAdminDb();

        // Determine handover status based on discrepancies
        const items = countedItems as HandoverCountedItem[];
        const hasDiscrepancy = items.some(item => item.diff !== 0);

        const docRef = db.collection('shift_handovers').doc();
        const handover: Omit<ShiftHandoverDoc, 'id'> & { id: string } = {
            id: docRef.id,
            storeId,
            counterId,
            date: new Date().toLocaleDateString('sv-SE', { timeZone: 'Asia/Ho_Chi_Minh' }),
            outgoingShiftId,
            incomingShiftId,
            outgoingUserId: decoded.uid,
            incomingUserId: incomingUserId || '',
            countedItems: items,
            status: hasDiscrepancy ? 'DISCREPANCY_PENDING_APPROVAL' : 'MATCHED',
            note: note || '',
            timestamp: new Date().toISOString(),
        };

        await docRef.set(handover);

        return NextResponse.json({
            success: true,
            message: hasDiscrepancy
                ? 'Đã ghi nhận giao ca — có chênh lệch cần xác nhận'
                : 'Đã ghi nhận giao ca — khớp tồn kho',
            handoverId: docRef.id,
            hasDiscrepancy,
        });
    } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Server error';
        return NextResponse.json({ error: message }, { status: 500 });
    }
}
