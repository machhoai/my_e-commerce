import { NextRequest, NextResponse } from 'next/server';
import { getAdminAuth, getAdminDb } from '@/lib/firebase-admin';
import { recordTransaction, updateBalance } from '@/lib/inventory-services';

// POST /api/inventory/receive — store confirms receipt of dispatched goods via QR token
// Phase 4: Validates QR token, increments STORE stock, sets status to COMPLETED.
export async function POST(req: NextRequest) {
    try {
        const token = req.headers.get('Authorization')?.split('Bearer ')[1];
        if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

        const auth = getAdminAuth();
        const decoded = await auth.verifyIdToken(token);
        const db = getAdminDb();

        const body = await req.json();
        const { orderId, qrCodeToken, receivedItems } = body;
        // receivedItems: [{ productId, receivedQty }]

        if (!orderId || !qrCodeToken || !receivedItems?.length) {
            return NextResponse.json({ error: 'orderId, qrCodeToken, and receivedItems required' }, { status: 400 });
        }

        // Fetch the order
        const orderRef = db.collection('purchase_orders').doc(orderId);
        const orderSnap = await orderRef.get();
        if (!orderSnap.exists) {
            return NextResponse.json({ error: 'Không tìm thấy đơn hàng' }, { status: 404 });
        }

        const order = orderSnap.data()!;

        // Validate QR token
        if (order.qrCodeToken !== qrCodeToken) {
            return NextResponse.json({ error: 'Mã QR không hợp lệ hoặc đã hết hạn' }, { status: 403 });
        }

        // Validate status
        if (order.status !== 'IN_TRANSIT') {
            return NextResponse.json({ error: 'Đơn hàng không ở trạng thái vận chuyển' }, { status: 400 });
        }

        const storeId = order.storeId;
        const discrepancies: string[] = [];

        // Process each item: increment STORE stock
        const updatedItems = order.items.map((orderItem: any) => {
            const received = receivedItems.find((r: any) => r.productId === orderItem.productId);
            const receivedQty = received ? (Number(received.receivedQty) || 0) : 0;
            const dispatchedQty = Number(orderItem.dispatchedQty || orderItem.approvedQty) || 0;

            // Track discrepancy
            if (receivedQty < dispatchedQty) {
                discrepancies.push(
                    `${orderItem.productName}: xuất ${dispatchedQty}, nhận ${receivedQty} (thiếu ${dispatchedQty - receivedQty})`
                );
            }

            return {
                ...orderItem,
                receivedQty,
            };
        });

        // Use transactions for each item to safely update store balances
        for (const item of updatedItems) {
            const qty = Number(item.receivedQty) || 0;
            if (qty <= 0) continue;

            // Increment store balance
            await updateBalance(item.productId, 'STORE', storeId, qty);

            // Record ledger entry
            await recordTransaction({
                productId: item.productId,
                fromLocationType: 'CENTRAL',
                fromLocationId: 'CENTRAL',
                toLocationType: 'STORE',
                toLocationId: storeId,
                quantity: qty,
                type: 'DISPATCH_TO_STORE',
                status: 'APPROVED',
                createdByUserId: decoded.uid,
                referenceId: orderId,
                note: `Nhận hàng tại cửa hàng — xác nhận nhận ${qty} ${item.unit || ''}`,
            });
        }

        // Build discrepancy note
        const discrepancyNote = discrepancies.length > 0
            ? `Chênh lệch: ${discrepancies.join('; ')}`
            : '';
        const existingNote = order.note || '';
        const finalNote = [existingNote, discrepancyNote].filter(Boolean).join(' | ');

        // Update order status to COMPLETED
        await orderRef.update({
            status: 'COMPLETED',
            items: updatedItems,
            completedAt: new Date().toISOString(),
            note: finalNote,
        });

        return NextResponse.json({
            message: 'Đã xác nhận nhận hàng thành công',
            discrepancies: discrepancies.length > 0 ? discrepancies : undefined,
        });
    } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Server error';
        return NextResponse.json({ error: message }, { status: 500 });
    }
}
