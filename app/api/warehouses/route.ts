import { NextRequest, NextResponse } from 'next/server';
import { getAdminAuth, getAdminDb } from '@/lib/firebase-admin';
import { WarehouseDoc } from '@/types';

async function requireAdmin(req: NextRequest) {
    const token = req.headers.get('Authorization')?.split('Bearer ')[1];
    if (!token) return null;
    const adminAuth = getAdminAuth();
    const decoded = await adminAuth.verifyIdToken(token);
    const adminDb = getAdminDb();
    const snap = await adminDb.collection('users').doc(decoded.uid).get();
    if (!snap.exists || !['admin', 'super_admin'].includes(snap.data()?.role)) return null;
    return decoded.uid;
}

// GET /api/warehouses — all warehouses (admin/super_admin) or caller's warehouse
export async function GET(req: NextRequest) {
    try {
        const token = req.headers.get('Authorization')?.split('Bearer ')[1];
        if (!token) return NextResponse.json({ error: 'Chưa xác thực' }, { status: 401 });

        const adminAuth = getAdminAuth();
        const decoded = await adminAuth.verifyIdToken(token);
        const adminDb = getAdminDb();

        const callerSnap = await adminDb.collection('users').doc(decoded.uid).get();
        if (!callerSnap.exists) return NextResponse.json({ error: 'Không tìm thấy người dùng' }, { status: 403 });
        const callerRole = callerSnap.data()?.role;

        if (callerRole === 'admin' || callerRole === 'super_admin') {
            const snap = await adminDb.collection('warehouses').orderBy('name').get();
            return NextResponse.json(snap.docs.map(d => ({ id: d.id, ...d.data() })));
        } else {
            // Non-admin: return their own warehouse
            const warehouseId = callerSnap.data()?.warehouseId;
            if (!warehouseId) return NextResponse.json([]);
            const whSnap = await adminDb.collection('warehouses').doc(warehouseId).get();
            if (!whSnap.exists) return NextResponse.json([]);
            return NextResponse.json([{ id: whSnap.id, ...whSnap.data() }]);
        }
    } catch (err) {
        const message = err instanceof Error ? err.message : 'Lỗi hệ thống';
        return NextResponse.json({ error: message }, { status: 500 });
    }
}

// POST /api/warehouses — create warehouse (admin only)
export async function POST(req: NextRequest) {
    try {
        const uid = await requireAdmin(req);
        if (!uid) return NextResponse.json({ error: 'Bị từ chối truy cập' }, { status: 403 });

        const body = await req.json() as { name: string; address?: string; capacitySqm?: number };
        if (!body.name?.trim()) return NextResponse.json({ error: 'Tên kho là bắt buộc' }, { status: 400 });

        const adminDb = getAdminDb();
        const ref = adminDb.collection('warehouses').doc();
        const doc: WarehouseDoc = {
            id: ref.id,
            name: body.name.trim(),
            address: body.address?.trim() || '',
            capacitySqm: body.capacitySqm || undefined,
            isActive: true,
            createdAt: new Date().toISOString(),
        };
        await ref.set(doc);
        return NextResponse.json({ id: ref.id, message: 'Tạo kho thành công' });
    } catch (err) {
        const message = err instanceof Error ? err.message : 'Lỗi hệ thống';
        return NextResponse.json({ error: message }, { status: 500 });
    }
}

// PUT /api/warehouses — update warehouse (admin only)
export async function PUT(req: NextRequest) {
    try {
        const uid = await requireAdmin(req);
        if (!uid) return NextResponse.json({ error: 'Bị từ chối truy cập' }, { status: 403 });

        const body = await req.json() as { id: string; name?: string; address?: string; capacitySqm?: number };
        if (!body.id) return NextResponse.json({ error: 'Thiếu warehouseId' }, { status: 400 });

        const adminDb = getAdminDb();
        const updateData: Partial<WarehouseDoc> = {};
        if (body.name !== undefined) updateData.name = body.name.trim();
        if (body.address !== undefined) updateData.address = body.address.trim();
        if (body.capacitySqm !== undefined) updateData.capacitySqm = body.capacitySqm;

        await adminDb.collection('warehouses').doc(body.id).update(updateData);
        return NextResponse.json({ message: 'Cập nhật kho thành công' });
    } catch (err) {
        const message = err instanceof Error ? err.message : 'Lỗi hệ thống';
        return NextResponse.json({ error: message }, { status: 500 });
    }
}

// PATCH /api/warehouses — toggle isActive (admin only)
export async function PATCH(req: NextRequest) {
    try {
        const uid = await requireAdmin(req);
        if (!uid) return NextResponse.json({ error: 'Bị từ chối truy cập' }, { status: 403 });

        const body = await req.json() as { id: string; isActive: boolean };
        if (!body.id) return NextResponse.json({ error: 'Thiếu warehouseId' }, { status: 400 });

        const adminDb = getAdminDb();
        await adminDb.collection('warehouses').doc(body.id).update({ isActive: body.isActive });
        return NextResponse.json({ message: body.isActive ? 'Kho đã mở' : 'Kho đã tắt' });
    } catch (err) {
        const message = err instanceof Error ? err.message : 'Lỗi hệ thống';
        return NextResponse.json({ error: message }, { status: 500 });
    }
}
