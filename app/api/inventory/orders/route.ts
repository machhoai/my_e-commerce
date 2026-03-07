import { NextRequest, NextResponse } from 'next/server';
import { getAdminAuth, getAdminDb } from '@/lib/firebase-admin';
import type { PurchaseOrderDoc } from '@/types/inventory';

// Helper: verify token and get caller data
async function verifyCaller(req: NextRequest) {
    const token = req.headers.get('Authorization')?.split('Bearer ')[1];
    if (!token) return null;
    const auth = getAdminAuth();
    const decoded = await auth.verifyIdToken(token);
    const db = getAdminDb();
    const snap = await db.collection('users').doc(decoded.uid).get();
    if (!snap.exists) return null;
    return { uid: decoded.uid, ...snap.data() as { name: string; role: string; storeId?: string } };
}

// GET /api/inventory/orders — list purchase orders
export async function GET(req: NextRequest) {
    try {
        const caller = await verifyCaller(req);
        if (!caller) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

        const db = getAdminDb();
        const { searchParams } = new URL(req.url);
        const status = searchParams.get('status');
        const storeId = searchParams.get('storeId');
        const orderId = searchParams.get('id');

        // Single order fetch by ID
        if (orderId) {
            const orderSnap = await db.collection('purchase_orders').doc(orderId).get();
            if (!orderSnap.exists) return NextResponse.json([], { status: 200 });
            const orderData = { id: orderSnap.id, ...orderSnap.data() };
            // Check access
            if (caller.role !== 'admin' && (orderData as any).storeId !== caller.storeId) {
                return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
            }
            return NextResponse.json([orderData]);
        }

        let q: FirebaseFirestore.Query = db.collection('purchase_orders');

        // Admin sees all, others see only their store
        if (caller.role !== 'admin') {
            q = q.where('storeId', '==', caller.storeId || '');
        } else if (storeId) {
            q = q.where('storeId', '==', storeId);
        }

        if (status) {
            q = q.where('status', '==', status);
        }

        const snap = await q.limit(200).get();
        const orders = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        // Sort client-side to avoid Firestore composite index requirement
        orders.sort((a: any, b: any) => (b.timestamp || '').localeCompare(a.timestamp || ''));

        return NextResponse.json(orders);
    } catch (err: unknown) {
        return NextResponse.json({ error: err instanceof Error ? err.message : 'Server error' }, { status: 500 });
    }
}

// POST /api/inventory/orders — create a new purchase order
export async function POST(req: NextRequest) {
    try {
        const caller = await verifyCaller(req);
        if (!caller) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        if (caller.role !== 'admin' && caller.role !== 'store_manager') {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        }

        const body = await req.json();
        const { storeId, storeName, items, note } = body;

        if (!storeId || !items?.length) {
            return NextResponse.json({ error: 'storeId and items are required' }, { status: 400 });
        }

        const db = getAdminDb();
        const docRef = db.collection('purchase_orders').doc();

        const order: PurchaseOrderDoc = {
            id: docRef.id,
            storeId,
            storeName: storeName || '',
            items: items.map((item: any) => ({
                productId: item.productId,
                productName: item.productName || '',
                unit: item.unit || '',
                requestedQty: Number(item.requestedQty) || 0,
            })),
            status: 'PENDING',
            createdBy: caller.uid,
            createdByName: caller.name,
            timestamp: new Date().toISOString(),
            note: note || '',
        };

        await docRef.set(order);

        return NextResponse.json({ id: docRef.id, message: 'Đơn đặt hàng đã được tạo' });
    } catch (err: unknown) {
        return NextResponse.json({ error: err instanceof Error ? err.message : 'Server error' }, { status: 500 });
    }
}

// PATCH /api/inventory/orders — cancel (store) or reject (admin)
export async function PATCH(req: NextRequest) {
    try {
        const caller = await verifyCaller(req);
        if (!caller) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

        const body = await req.json();
        const { orderId, action, reason } = body;

        if (!orderId || !action) {
            return NextResponse.json({ error: 'orderId and action are required' }, { status: 400 });
        }
        if (!['cancel', 'reject'].includes(action)) {
            return NextResponse.json({ error: 'action must be cancel or reject' }, { status: 400 });
        }

        const db = getAdminDb();
        const orderRef = db.collection('purchase_orders').doc(orderId);
        const orderSnap = await orderRef.get();
        if (!orderSnap.exists) return NextResponse.json({ error: 'Không tìm thấy đơn hàng' }, { status: 404 });

        const order = orderSnap.data() as any;

        // Authorization
        if (action === 'cancel') {
            // Store side: only same store or admin
            if (caller.role !== 'admin' && order.storeId !== caller.storeId) {
                return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
            }
            if (order.status !== 'PENDING') {
                return NextResponse.json({ error: 'Chỉ có thể hủy đơn đang chờ duyệt' }, { status: 400 });
            }
            await orderRef.update({
                status: 'CANCELED',
                cancelReason: reason || '',
                canceledAt: new Date().toISOString(),
                canceledBy: caller.uid,
                canceledByName: caller.name,
            });
            return NextResponse.json({ message: 'Đơn hàng đã được hủy' });
        }

        if (action === 'reject') {
            // Admin only
            if (caller.role !== 'admin') {
                return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
            }
            if (order.status !== 'PENDING') {
                return NextResponse.json({ error: 'Chỉ có thể từ chối đơn đang chờ duyệt' }, { status: 400 });
            }
            if (!reason?.trim()) {
                return NextResponse.json({ error: 'Lý do từ chối là bắt buộc' }, { status: 400 });
            }
            await orderRef.update({
                status: 'REJECTED',
                rejectReason: reason.trim(),
                rejectedAt: new Date().toISOString(),
                rejectedBy: caller.uid,
                rejectedByName: caller.name,
            });
            return NextResponse.json({ message: 'Đã từ chối đơn hàng' });
        }

    } catch (err: unknown) {
        return NextResponse.json({ error: err instanceof Error ? err.message : 'Server error' }, { status: 500 });
    }
}
