import { NextRequest, NextResponse } from 'next/server';
import { getAdminAuth, getAdminDb } from '@/lib/firebase-admin';
import { StoreDoc } from '@/types';

// Helper to verify caller is admin
async function verifyAdmin(req: NextRequest) {
    const token = req.headers.get('Authorization')?.split('Bearer ')[1];
    if (!token) return null;
    const adminAuth = getAdminAuth();
    const decoded = await adminAuth.verifyIdToken(token);
    const adminDb = getAdminDb();
    const callerSnap = await adminDb.collection('users').doc(decoded.uid).get();
    if (!callerSnap.exists || callerSnap.data()?.role !== 'admin') return null;
    return decoded.uid;
}

// GET /api/stores — returns all stores (admin) or just caller's store (store_manager/manager/employee)
export async function GET(req: NextRequest) {
    try {
        const token = req.headers.get('Authorization')?.split('Bearer ')[1];
        if (!token) return NextResponse.json({ error: 'Không được phép' }, { status: 401 });

        const adminAuth = getAdminAuth();
        const decoded = await adminAuth.verifyIdToken(token);
        const adminDb = getAdminDb();

        const callerSnap = await adminDb.collection('users').doc(decoded.uid).get();
        if (!callerSnap.exists) return NextResponse.json({ error: 'Không tìm thấy người dùng' }, { status: 403 });
        const callerRole = callerSnap.data()?.role;

        if (callerRole === 'admin') {
            const snap = await adminDb.collection('stores').orderBy('name').get();
            const stores = snap.docs.map(d => ({ id: d.id, ...d.data() }));
            return NextResponse.json(stores);
        } else {
            // Non-admin users just get their own store
            const callerStoreId = callerSnap.data()?.storeId;
            if (!callerStoreId) return NextResponse.json([]);
            const storeSnap = await adminDb.collection('stores').doc(callerStoreId).get();
            if (!storeSnap.exists) return NextResponse.json([]);
            return NextResponse.json([{ id: storeSnap.id, ...storeSnap.data() }]);
        }
    } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Lỗi hệ thống';
        return NextResponse.json({ error: message }, { status: 500 });
    }
}

// POST /api/stores — create a new store (admin only)
export async function POST(req: NextRequest) {
    try {
        const callerUid = await verifyAdmin(req);
        if (!callerUid) return NextResponse.json({ error: 'Bị từ chối truy cập' }, { status: 403 });

        const body = await req.json() as { name: string; address?: string };
        if (!body.name?.trim()) {
            return NextResponse.json({ error: 'Tên cửa hàng là bắt buộc' }, { status: 400 });
        }

        const adminDb = getAdminDb();
        const storeRef = adminDb.collection('stores').doc();
        const storeDoc: StoreDoc = {
            id: storeRef.id,
            name: body.name.trim(),
            address: body.address?.trim() || '',
            isActive: true,
            createdAt: new Date().toISOString(),
        };
        await storeRef.set(storeDoc);

        return NextResponse.json({ id: storeRef.id, message: 'Tạo cửa hàng thành công' });
    } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Lỗi hệ thống';
        return NextResponse.json({ error: message }, { status: 500 });
    }
}

// PUT /api/stores — update store info (admin only)
export async function PUT(req: NextRequest) {
    try {
        const callerUid = await verifyAdmin(req);
        if (!callerUid) return NextResponse.json({ error: 'Bị từ chối truy cập' }, { status: 403 });

        const body = await req.json() as { id: string; name?: string; address?: string };
        if (!body.id) return NextResponse.json({ error: 'Thiếu storeId' }, { status: 400 });

        const adminDb = getAdminDb();
        const updateData: Partial<StoreDoc> = {};
        if (body.name !== undefined) updateData.name = body.name.trim();
        if (body.address !== undefined) updateData.address = body.address.trim();

        await adminDb.collection('stores').doc(body.id).update(updateData);
        return NextResponse.json({ message: 'Cập nhật cửa hàng thành công' });
    } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Lỗi hệ thống';
        return NextResponse.json({ error: message }, { status: 500 });
    }
}

// PATCH /api/stores — toggle store active status (admin only)
export async function PATCH(req: NextRequest) {
    try {
        const callerUid = await verifyAdmin(req);
        if (!callerUid) return NextResponse.json({ error: 'Bị từ chối truy cập' }, { status: 403 });

        const body = await req.json() as { id: string; isActive: boolean };
        if (!body.id) return NextResponse.json({ error: 'Thiếu storeId' }, { status: 400 });

        const adminDb = getAdminDb();
        await adminDb.collection('stores').doc(body.id).update({ isActive: body.isActive });
        return NextResponse.json({ message: body.isActive ? 'Cửa hàng đã mở' : 'Cửa hàng đã tắt' });
    } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Lỗi hệ thống';
        return NextResponse.json({ error: message }, { status: 500 });
    }
}
