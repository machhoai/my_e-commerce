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

        // Admin and office see all; others only see their store
        const canSeeAll = caller.role === 'admin' || caller.role === 'office';
        if (!canSeeAll) {
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
        const { storeId, storeName, items, note, attachmentUrl } = body;

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
                productCode: item.productCode || '',
                unit: item.unit || '',
                requestedQty: Number(item.requestedQty) || 0,
            })),
            status: 'PENDING_OFFICE',
            attachmentUrl: attachmentUrl || null,
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

// PATCH /api/inventory/orders — status transitions
// Actions: cancel | office_approve | office_reject | warehouse_reject
export async function PATCH(req: NextRequest) {
    try {
        const caller = await verifyCaller(req);
        if (!caller) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

        const body = await req.json();
        const { orderId, action, reason } = body;

        if (!orderId || !action) {
            return NextResponse.json({ error: 'orderId and action are required' }, { status: 400 });
        }

        const VALID_ACTIONS = ['cancel', 'office_approve', 'office_reject', 'warehouse_reject'];
        if (!VALID_ACTIONS.includes(action)) {
            return NextResponse.json({ error: `action must be one of: ${VALID_ACTIONS.join(', ')}` }, { status: 400 });
        }

        const db = getAdminDb();
        const orderRef = db.collection('purchase_orders').doc(orderId);
        const orderSnap = await orderRef.get();
        if (!orderSnap.exists) return NextResponse.json({ error: 'Không tìm thấy đơn hàng' }, { status: 404 });

        const order = orderSnap.data() as any;
        const now = new Date().toISOString();

        // ── CANCEL (Store side) ─────────────────────────────────
        if (action === 'cancel') {
            if (caller.role !== 'admin' && order.storeId !== caller.storeId) {
                return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
            }
            const cancelableStatuses = ['PENDING_OFFICE', 'PENDING'];
            if (!cancelableStatuses.includes(order.status)) {
                return NextResponse.json({ error: 'Chỉ có thể hủy đơn đang chờ văn phòng duyệt' }, { status: 400 });
            }
            await orderRef.update({
                status: 'CANCELED',
                cancelReason: reason || '',
                canceledAt: now,
                canceledBy: caller.uid,
                canceledByName: caller.name,
            });
            return NextResponse.json({ message: 'Đơn hàng đã được hủy' });
        }

        // ── OFFICE APPROVE ─────────────────────────────────────
        if (action === 'office_approve') {
            if (caller.role !== 'admin' && caller.role !== 'office') {
                return NextResponse.json({ error: 'Forbidden — office or admin only' }, { status: 403 });
            }
            if (order.status !== 'PENDING_OFFICE') {
                return NextResponse.json({ error: 'Đơn không ở trạng thái chờ VP duyệt' }, { status: 400 });
            }
            await orderRef.update({
                status: 'APPROVED_BY_OFFICE',
                officeApprovedBy: caller.uid,
                officeApprovedByName: caller.name,
                officeApprovedAt: now,
            });
            return NextResponse.json({ message: 'Đã duyệt đơn hàng' });
        }

        // ── OFFICE REJECT ──────────────────────────────────────
        if (action === 'office_reject') {
            if (caller.role !== 'admin' && caller.role !== 'office') {
                return NextResponse.json({ error: 'Forbidden — office or admin only' }, { status: 403 });
            }
            if (order.status !== 'PENDING_OFFICE') {
                return NextResponse.json({ error: 'Đơn không ở trạng thái chờ VP duyệt' }, { status: 400 });
            }
            if (!reason?.trim()) {
                return NextResponse.json({ error: 'Lý do từ chối là bắt buộc' }, { status: 400 });
            }
            await orderRef.update({
                status: 'REJECTED',
                rejectReason: reason.trim(),
                rejectedAt: now,
                officeRejectedBy: caller.uid,
                officeRejectedByName: caller.name,
            });
            return NextResponse.json({ message: 'Đã từ chối đơn hàng' });
        }

        // ── WAREHOUSE REJECT ───────────────────────────────────
        if (action === 'warehouse_reject') {
            if (caller.role !== 'admin') {
                return NextResponse.json({ error: 'Forbidden — admin only' }, { status: 403 });
            }
            if (order.status !== 'APPROVED_BY_OFFICE') {
                return NextResponse.json({ error: 'Đơn phải ở trạng thái VP đã duyệt' }, { status: 400 });
            }
            if (!reason?.trim()) {
                return NextResponse.json({ error: 'Lý do từ chối xuất kho là bắt buộc' }, { status: 400 });
            }
            await orderRef.update({
                status: 'REJECTED',
                rejectReason: reason.trim(),
                rejectedAt: now,
                rejectedBy: caller.uid,
                rejectedByName: caller.name,
            });
            return NextResponse.json({ message: 'Đã từ chối xuất kho' });
        }

    } catch (err: unknown) {
        return NextResponse.json({ error: err instanceof Error ? err.message : 'Server error' }, { status: 500 });
    }
}
