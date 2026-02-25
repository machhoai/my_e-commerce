import { NextRequest, NextResponse } from 'next/server';
import { getAdminAuth, getAdminDb } from '@/lib/firebase-admin';
import { CounterDoc } from '@/types';

async function getCallerInfo(req: NextRequest) {
    const token = req.headers.get('Authorization')?.split('Bearer ')[1];
    if (!token) return null;
    const adminAuth = getAdminAuth();
    const decoded = await adminAuth.verifyIdToken(token);
    const adminDb = getAdminDb();
    const snap = await adminDb.collection('users').doc(decoded.uid).get();
    if (!snap.exists) return null;
    return { uid: decoded.uid, ...snap.data() } as { uid: string; role: string; storeId?: string };
}

// GET /api/counters?storeId=xxx
export async function GET(req: NextRequest) {
    try {
        const caller = await getCallerInfo(req);
        if (!caller) return NextResponse.json({ error: 'Không được phép' }, { status: 401 });

        const adminDb = getAdminDb();
        const { searchParams } = new URL(req.url);
        let storeId = searchParams.get('storeId');

        // Non-admin users can only see their own store's counters
        if (caller.role !== 'admin') {
            storeId = caller.storeId || null;
        }

        if (!storeId) return NextResponse.json([]);

        const snap = await adminDb.collection('counters').where('storeId', '==', storeId).orderBy('name').get();
        const counters = snap.docs.map(d => d.data() as CounterDoc);
        return NextResponse.json(counters);
    } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Lỗi hệ thống';
        return NextResponse.json({ error: message }, { status: 500 });
    }
}

// POST /api/counters — create a counter
export async function POST(req: NextRequest) {
    try {
        const caller = await getCallerInfo(req);
        if (!caller) return NextResponse.json({ error: 'Không được phép' }, { status: 401 });
        if (!['admin', 'store_manager'].includes(caller.role)) {
            return NextResponse.json({ error: 'Bị từ chối truy cập' }, { status: 403 });
        }

        const body = await req.json() as { name: string; storeId: string };
        if (!body.name?.trim() || !body.storeId) {
            return NextResponse.json({ error: 'Thiếu thông tin bắt buộc' }, { status: 400 });
        }

        // store_manager can only create counters for their own store
        const effectiveStoreId = caller.role === 'admin' ? body.storeId : caller.storeId;
        if (!effectiveStoreId) return NextResponse.json({ error: 'Không xác định được cửa hàng' }, { status: 400 });

        const adminDb = getAdminDb();
        const counterRef = adminDb.collection('counters').doc();
        const counterDoc: CounterDoc = {
            id: counterRef.id,
            name: body.name.trim(),
            storeId: effectiveStoreId,
        };
        await counterRef.set(counterDoc);

        return NextResponse.json({ id: counterRef.id, message: 'Tạo quầy thành công' });
    } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Lỗi hệ thống';
        return NextResponse.json({ error: message }, { status: 500 });
    }
}

// PUT /api/counters — update counter name
export async function PUT(req: NextRequest) {
    try {
        const caller = await getCallerInfo(req);
        if (!caller) return NextResponse.json({ error: 'Không được phép' }, { status: 401 });
        if (!['admin', 'store_manager'].includes(caller.role)) {
            return NextResponse.json({ error: 'Bị từ chối truy cập' }, { status: 403 });
        }

        const body = await req.json() as { id: string; name: string };
        if (!body.id || !body.name?.trim()) return NextResponse.json({ error: 'Thiếu thông tin' }, { status: 400 });

        const adminDb = getAdminDb();
        const counterSnap = await adminDb.collection('counters').doc(body.id).get();
        if (!counterSnap.exists) return NextResponse.json({ error: 'Không tìm thấy quầy' }, { status: 404 });

        // store_manager can only edit counters in their store
        if (caller.role === 'store_manager' && counterSnap.data()?.storeId !== caller.storeId) {
            return NextResponse.json({ error: 'Bị từ chối truy cập' }, { status: 403 });
        }

        await adminDb.collection('counters').doc(body.id).update({ name: body.name.trim() });
        return NextResponse.json({ message: 'Cập nhật quầy thành công' });
    } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Lỗi hệ thống';
        return NextResponse.json({ error: message }, { status: 500 });
    }
}

// DELETE /api/counters — delete counter
export async function DELETE(req: NextRequest) {
    try {
        const caller = await getCallerInfo(req);
        if (!caller) return NextResponse.json({ error: 'Không được phép' }, { status: 401 });
        if (!['admin', 'store_manager'].includes(caller.role)) {
            return NextResponse.json({ error: 'Bị từ chối truy cập' }, { status: 403 });
        }

        const { searchParams } = new URL(req.url);
        const id = searchParams.get('id');
        if (!id) return NextResponse.json({ error: 'Thiếu id' }, { status: 400 });

        const adminDb = getAdminDb();
        const counterSnap = await adminDb.collection('counters').doc(id).get();
        if (!counterSnap.exists) return NextResponse.json({ error: 'Không tìm thấy quầy' }, { status: 404 });

        if (caller.role === 'store_manager' && counterSnap.data()?.storeId !== caller.storeId) {
            return NextResponse.json({ error: 'Bị từ chối truy cập' }, { status: 403 });
        }

        await adminDb.collection('counters').doc(id).delete();
        return NextResponse.json({ message: 'Xóa quầy thành công' });
    } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Lỗi hệ thống';
        return NextResponse.json({ error: message }, { status: 500 });
    }
}
