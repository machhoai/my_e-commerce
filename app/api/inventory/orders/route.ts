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
