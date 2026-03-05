import { NextRequest, NextResponse } from 'next/server';
import { getAdminAuth, getAdminDb } from '@/lib/firebase-admin';

// Helper: verify admin
async function verifyAdmin(req: NextRequest) {
    const token = req.headers.get('Authorization')?.split('Bearer ')[1];
    if (!token) return null;
    const auth = getAdminAuth();
    const decoded = await auth.verifyIdToken(token);
    const db = getAdminDb();
    const snap = await db.collection('users').doc(decoded.uid).get();
    if (!snap.exists || snap.data()?.role !== 'admin') return null;
    return decoded.uid;
}

// GET /api/inventory/categories — list all categories
export async function GET(req: NextRequest) {
    try {
        const token = req.headers.get('Authorization')?.split('Bearer ')[1];
        if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        const auth = getAdminAuth();
        await auth.verifyIdToken(token);

        const db = getAdminDb();
        const snap = await db.collection('product_categories').orderBy('name').get();
        const categories = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        return NextResponse.json(categories);
    } catch (err: unknown) {
        return NextResponse.json({ error: err instanceof Error ? err.message : 'Server error' }, { status: 500 });
    }
}

// POST /api/inventory/categories — create a category (admin only)
export async function POST(req: NextRequest) {
    try {
        const uid = await verifyAdmin(req);
        if (!uid) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

        const { name } = await req.json();
        if (!name?.trim()) return NextResponse.json({ error: 'Tên danh mục là bắt buộc' }, { status: 400 });

        const db = getAdminDb();

        // Check duplicate
        const existing = await db.collection('product_categories').where('name', '==', name.trim()).get();
        if (!existing.empty) return NextResponse.json({ error: 'Danh mục đã tồn tại' }, { status: 400 });

        const ref = db.collection('product_categories').doc();
        await ref.set({ id: ref.id, name: name.trim(), createdAt: new Date().toISOString() });
        return NextResponse.json({ id: ref.id, message: 'Đã tạo danh mục' });
    } catch (err: unknown) {
        return NextResponse.json({ error: err instanceof Error ? err.message : 'Server error' }, { status: 500 });
    }
}

// PUT /api/inventory/categories — rename a category (admin only)
export async function PUT(req: NextRequest) {
    try {
        const uid = await verifyAdmin(req);
        if (!uid) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

        const { id, name } = await req.json();
        if (!id || !name?.trim()) return NextResponse.json({ error: 'Thiếu dữ liệu' }, { status: 400 });

        const db = getAdminDb();
        await db.collection('product_categories').doc(id).update({ name: name.trim() });
        return NextResponse.json({ message: 'Đã cập nhật danh mục' });
    } catch (err: unknown) {
        return NextResponse.json({ error: err instanceof Error ? err.message : 'Server error' }, { status: 500 });
    }
}

// DELETE /api/inventory/categories — delete a category (admin only)
export async function DELETE(req: NextRequest) {
    try {
        const uid = await verifyAdmin(req);
        if (!uid) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

        const { id } = await req.json();
        if (!id) return NextResponse.json({ error: 'Thiếu ID' }, { status: 400 });

        const db = getAdminDb();
        await db.collection('product_categories').doc(id).delete();
        return NextResponse.json({ message: 'Đã xóa danh mục' });
    } catch (err: unknown) {
        return NextResponse.json({ error: err instanceof Error ? err.message : 'Server error' }, { status: 500 });
    }
}
