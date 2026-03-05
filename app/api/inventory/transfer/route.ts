import { NextRequest, NextResponse } from 'next/server';
import { getAdminAuth, getAdminDb } from '@/lib/firebase-admin';
import { moveStock } from '@/lib/inventory-services';

// POST /api/inventory/transfer — transfer stock from STORE to COUNTER
export async function POST(req: NextRequest) {
    try {
        const token = req.headers.get('Authorization')?.split('Bearer ')[1];
        if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

        const auth = getAdminAuth();
        const decoded = await auth.verifyIdToken(token);
        const db = getAdminDb();

        // Verify caller
        const callerSnap = await db.collection('users').doc(decoded.uid).get();
        if (!callerSnap.exists) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }
        const callerRole = callerSnap.data()?.role;
        if (callerRole !== 'admin' && callerRole !== 'store_manager') {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        }

        const body = await req.json();
        const { storeId, counterId, counterName, productId, quantity, note } = body;

        if (!storeId || !counterId || !productId || !quantity) {
            return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
        }

        const qty = Number(quantity);
        if (qty <= 0) {
            return NextResponse.json({ error: 'Số lượng phải lớn hơn 0' }, { status: 400 });
        }

        // Use the atomic moveStock function from Phase 1
        const txId = await moveStock({
            productId,
            fromLocationType: 'STORE',
            fromLocationId: storeId,
            toLocationType: 'COUNTER',
            toLocationId: counterId,
            quantity: qty,
            type: 'TRANSFER_TO_COUNTER',
            createdByUserId: decoded.uid,
            note: note || `Xuất ra ${counterName || counterId}`,
        });

        return NextResponse.json({ message: 'Đã xuất hàng ra quầy thành công', transactionId: txId });
    } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Server error';
        return NextResponse.json({ error: message }, { status: 500 });
    }
}
