import { NextRequest, NextResponse } from 'next/server';
import { getAdminAuth, getAdminDb } from '@/lib/firebase-admin';
import { recordTransaction, updateBalance } from '@/lib/inventory-services';
import { randomUUID } from 'crypto';

// POST /api/inventory/dispatch — approve and dispatch a purchase order (admin only)
// Phase 2: Deducts CENTRAL stock, generates QR token, sets status to IN_TRANSIT.
// Stock is NOT added to the store until the store confirms receipt via /api/inventory/receive.
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
        const validStatuses = ['PACKING', 'PENDING', 'APPROVED_BY_OFFICE'];
        if (!validStatuses.includes(order.status as string)) {
            return NextResponse.json({ error: 'Đơn hàng phải ở trạng thái đang đóng gói' }, { status: 400 });
        }

        const storeId = order.storeId;
        const warehouseId = order.warehouseId || 'CENTRAL';

        // Generate secure QR token
        const qrCodeToken = randomUUID();

        // Process each item: ONLY decrement from CENTRAL (store receives later via QR)
        for (const item of approvedItems) {
            const qty = Number(item.approvedQty) || 0;
            if (qty <= 0) continue;

            // Decrement from the target warehouse
            await updateBalance(item.productId, 'CENTRAL', warehouseId, -qty);

            // Record ledger entry (goods leaving central)
            await recordTransaction({
                productId: item.productId,
                fromLocationType: 'CENTRAL',
                fromLocationId: warehouseId,
                toLocationType: 'STORE',
                toLocationId: storeId,
                quantity: qty,
                type: 'DISPATCH_TO_STORE',
                status: 'APPROVED',
                createdByUserId: decoded.uid,
                referenceId: orderId,
                note: `Xuất kho cho ${order.storeName || storeId} — đang vận chuyển`,
            });
        }

        // Update the order: IN_TRANSIT + QR token
        await orderRef.update({
            status: 'IN_TRANSIT',
            qrCodeToken,
            approvedBy: decoded.uid,
            approvedByName: callerName,
            warehouseDispatchedBy: decoded.uid,
            warehouseDispatchedByName: callerName,
            dispatchedAt: new Date().toISOString(),
            items: approvedItems.map((item: any) => ({
                productId: item.productId,
                productName: item.productName || '',
                productCode: item.productCode || '',
                unit: item.unit || '',
                requestedQty: Number(item.requestedQty) || 0,
                dispatchedQty: Number(item.approvedQty) || 0,
                approvedQty: Number(item.approvedQty) || 0, // legacy compat
            })),
        });

        return NextResponse.json({
            message: 'Đã duyệt xuất kho — đơn hàng đang vận chuyển',
            qrCodeToken,
            orderId,
        });
    } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Server error';
        return NextResponse.json({ error: message }, { status: 500 });
    }
}
