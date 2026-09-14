import { NextRequest, NextResponse } from 'next/server';
import { getAdminDb } from '@/lib/firebase-admin';
import { CounterDoc } from '@/types';
import { assertWorkplaceScope, requireWorkplaceCaller, workplaceAccessResponse } from '@/lib/workplace/access';

// GET /api/counters?storeId=xxx
export async function GET(req: NextRequest) {
    try {
        const caller = await requireWorkplaceCaller(req);

        const adminDb = getAdminDb();
        const { searchParams } = new URL(req.url);
        const storeId = searchParams.get('storeId');

        if (!storeId) return NextResponse.json([]);
        await assertWorkplaceScope(caller, 'STORE', storeId);

        const snap = await adminDb.collection('counters').where('storeId', '==', storeId).orderBy('name').get();
        const counters = snap.docs.map(d => d.data() as CounterDoc);
        return NextResponse.json(counters);
    } catch (err: unknown) {
        const accessResponse = workplaceAccessResponse(err); if (accessResponse) return accessResponse;
        const message = err instanceof Error ? err.message : 'Lỗi hệ thống';
        return NextResponse.json({ error: message }, { status: 500 });
    }
}

// POST /api/counters — create a counter
export async function POST(req: NextRequest) {
    try {
        const caller = await requireWorkplaceCaller(req);
        if (!caller.isAdmin && caller.user.role !== 'store_manager') {
            return NextResponse.json({ error: 'Bị từ chối truy cập' }, { status: 403 });
        }

        const body = await req.json() as { name: string; storeId: string };
        if (!body.name?.trim() || !body.storeId) {
            return NextResponse.json({ error: 'Thiếu thông tin bắt buộc' }, { status: 400 });
        }

        // store_manager can only create counters for their own store
        const effectiveStoreId = body.storeId;
        if (!effectiveStoreId) return NextResponse.json({ error: 'Không xác định được cửa hàng' }, { status: 400 });
        await assertWorkplaceScope(caller, 'STORE', effectiveStoreId);

        const adminDb = getAdminDb();
        const counterRef = adminDb.collection('counters').doc();
        const counterDoc: CounterDoc = {
            id: counterRef.id,
            name: body.name.trim(),
            storeId: effectiveStoreId,
            isActive: true,
        };
        await counterRef.set(counterDoc);

        return NextResponse.json({ id: counterRef.id, message: 'Tạo quầy thành công' });
    } catch (err: unknown) {
        const accessResponse = workplaceAccessResponse(err); if (accessResponse) return accessResponse;
        const message = err instanceof Error ? err.message : 'Lỗi hệ thống';
        return NextResponse.json({ error: message }, { status: 500 });
    }
}

// PUT /api/counters — update counter name
export async function PUT(req: NextRequest) {
    try {
        const caller = await requireWorkplaceCaller(req);
        if (!caller.isAdmin && caller.user.role !== 'store_manager') {
            return NextResponse.json({ error: 'Bị từ chối truy cập' }, { status: 403 });
        }

        const body = await req.json() as { id: string; name: string };
        if (!body.id || !body.name?.trim()) return NextResponse.json({ error: 'Thiếu thông tin' }, { status: 400 });

        const adminDb = getAdminDb();
        const counterSnap = await adminDb.collection('counters').doc(body.id).get();
        if (!counterSnap.exists) return NextResponse.json({ error: 'Không tìm thấy quầy' }, { status: 404 });

        // store_manager can only edit counters in their store
        await assertWorkplaceScope(caller, 'STORE', counterSnap.data()?.storeId || '');

        await adminDb.collection('counters').doc(body.id).update({ name: body.name.trim() });
        return NextResponse.json({ message: 'Cập nhật quầy thành công' });
    } catch (err: unknown) {
        const accessResponse = workplaceAccessResponse(err); if (accessResponse) return accessResponse;
        const message = err instanceof Error ? err.message : 'Lỗi hệ thống';
        return NextResponse.json({ error: message }, { status: 500 });
    }
}

// DELETE /api/counters — delete counter
export async function DELETE(req: NextRequest) {
    try {
        const caller = await requireWorkplaceCaller(req);
        if (!caller.isAdmin && caller.user.role !== 'store_manager') {
            return NextResponse.json({ error: 'Bị từ chối truy cập' }, { status: 403 });
        }

        const { searchParams } = new URL(req.url);
        const id = searchParams.get('id');
        if (!id) return NextResponse.json({ error: 'Thiếu id' }, { status: 400 });

        const adminDb = getAdminDb();
        const counterSnap = await adminDb.collection('counters').doc(id).get();
        if (!counterSnap.exists) return NextResponse.json({ error: 'Không tìm thấy quầy' }, { status: 404 });

        await assertWorkplaceScope(caller, 'STORE', counterSnap.data()?.storeId || '');

        await adminDb.collection('counters').doc(id).delete();
        return NextResponse.json({ message: 'Xóa quầy thành công' });
    } catch (err: unknown) {
        const accessResponse = workplaceAccessResponse(err); if (accessResponse) return accessResponse;
        const message = err instanceof Error ? err.message : 'Lỗi hệ thống';
        return NextResponse.json({ error: message }, { status: 500 });
    }
}
