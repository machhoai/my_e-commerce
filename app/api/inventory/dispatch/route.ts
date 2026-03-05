import { NextRequest, NextResponse } from 'next/server';
import { getAdminAuth, getAdminDb } from '@/lib/firebase-admin';
import { recordTransaction, updateBalance } from '@/lib/inventory-services';

// POST /api/inventory/dispatch — approve and dispatch a purchase order (admin only)
export async function POST(req: NextRequest) {
    try {
        const token = req.headers.get('Authorization')?.split('Bearer ')[1];
        if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

        const auth = getAdminAuth();
        const decoded = await auth.verifyIdToken(token);
        const db = getAdminDb();

        // Verify admin
        const callerSnap = await db.collection('users').doc(decoded.uid).get();
        if (!callerSnap.exists || callerSnap.data()?.role !== 'admin') {
            return NextResponse.json({ error: 'Chỉ quản trị viên mới có thể duyệt' }, { status: 403 });
        }
        const callerName = callerSnap.data()?.name || '';

        const body = await req.json();
        const { orderId, approvedItems } = body;
        // approvedItems: [{ productId, productName, unit, requestedQty, approvedQty }]

        if (!orderId || !approvedItems?.length) {
            return NextResponse.json({ error: 'orderId and approvedItems required' }, { status: 400 });
        }

        // Fetch the order
        const orderRef = db.collection('purchase_orders').doc(orderId);
        const orderSnap = await orderRef.get();
        if (!orderSnap.exists) {
            return NextResponse.json({ error: 'Không tìm thấy đơn hàng' }, { status: 404 });
        }

        const order = orderSnap.data()!;
        if (order.status !== 'PENDING') {
            return NextResponse.json({ error: 'Đơn hàng đã được xử lý' }, { status: 400 });
        }

        const storeId = order.storeId;

        // Process each item: decrement CENTRAL, increment STORE, record transaction
        for (const item of approvedItems) {
            const qty = Number(item.approvedQty) || 0;
            if (qty <= 0) continue;

            // Decrement from central warehouse
            await updateBalance(item.productId, 'CENTRAL', 'CENTRAL', -qty);

            // Increment at the store
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
                note: `Xuất kho cho ${order.storeName || storeId}`,
            });
        }

        // Update the order status
        await orderRef.update({
            status: 'DISPATCHED',
            approvedBy: decoded.uid,
            approvedByName: callerName,
            dispatchedAt: new Date().toISOString(),
            items: approvedItems.map((item: any) => ({
                productId: item.productId,
                productName: item.productName || '',
                unit: item.unit || '',
                requestedQty: Number(item.requestedQty) || 0,
                approvedQty: Number(item.approvedQty) || 0,
            })),
        });

        return NextResponse.json({ message: 'Đã duyệt và xuất kho thành công' });
    } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Server error';
        return NextResponse.json({ error: message }, { status: 500 });
    }
}
