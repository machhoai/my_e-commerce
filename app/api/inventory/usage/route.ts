import { NextRequest, NextResponse } from 'next/server';
import { getAdminAuth, getAdminDb } from '@/lib/firebase-admin';
import { verifyCounterAccess, recordTransaction, updateBalance } from '@/lib/inventory-services';

// POST /api/inventory/usage — Submit barcode usage record (consume stock at a counter)
export async function POST(req: NextRequest) {
    try {
        const token = req.headers.get('Authorization')?.split('Bearer ')[1];
        if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

        const auth = getAdminAuth();
        const decoded = await auth.verifyIdToken(token);

        const body = await req.json();
        const { counterId, productId, quantity, note } = body;

        if (!counterId || !productId || !quantity) {
            return NextResponse.json({ error: 'Thiếu thông tin bắt buộc' }, { status: 400 });
        }

        const qty = Number(quantity);
        if (qty <= 0) {
            return NextResponse.json({ error: 'Số lượng phải lớn hơn 0' }, { status: 400 });
        }

        // ── Shift-based access control ──
        const access = await verifyCounterAccess(decoded.uid, counterId);
        if (!access.isAuthorized) {
            return NextResponse.json(
                { error: `UNAUTHORIZED: ${access.error}` },
                { status: 403 }
            );
        }

        // Decrement stock at the counter
        await updateBalance(productId, 'COUNTER', counterId, -qty);

        // Record the usage transaction
        const txId = await recordTransaction({
            productId,
            fromLocationType: 'COUNTER',
            fromLocationId: counterId,
            toLocationType: '',
            toLocationId: '',
            quantity: qty,
            type: 'USAGE',
            status: 'APPROVED',
            createdByUserId: decoded.uid,
            referenceId: access.shiftId || '',
            note: note || 'Sử dụng tại quầy',
        });

        return NextResponse.json({
            success: true,
            message: 'Đã ghi nhận sử dụng thành công',
            transactionId: txId,
        });
    } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Server error';
        return NextResponse.json({ error: message }, { status: 500 });
    }
}
