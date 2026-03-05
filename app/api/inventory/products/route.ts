import { NextRequest, NextResponse } from 'next/server';
import { getAdminAuth, getAdminDb } from '@/lib/firebase-admin';
import type { ProductDoc } from '@/types/inventory';

// Helper: verify token and get caller info
async function verifyCaller(req: NextRequest) {
    const token = req.headers.get('Authorization')?.split('Bearer ')[1];
    if (!token) return null;
    const auth = getAdminAuth();
    const decoded = await auth.verifyIdToken(token);
    const db = getAdminDb();
    const snap = await db.collection('users').doc(decoded.uid).get();
    if (!snap.exists) return null;
    return { uid: decoded.uid, role: snap.data()?.role as string };
}

// GET /api/inventory/products — list products
// ?all=true → include inactive (for admin management)
export async function GET(req: NextRequest) {
    try {
        const caller = await verifyCaller(req);
        if (!caller) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

        const { searchParams } = new URL(req.url);
        const includeAll = searchParams.get('all') === 'true';

        const db = getAdminDb();
        let q: FirebaseFirestore.Query = db.collection('products');
        if (!includeAll) {
            q = q.where('isActive', '==', true);
        }

        const snap = await q.get();
        const products = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        // Sort client-side to avoid Firestore composite index requirement
        products.sort((a: any, b: any) => (a.name || '').localeCompare(b.name || ''));

        return NextResponse.json(products);
    } catch (err: unknown) {
        return NextResponse.json({ error: err instanceof Error ? err.message : 'Server error' }, { status: 500 });
    }
}

// POST /api/inventory/products — create a new product (admin only)
export async function POST(req: NextRequest) {
    try {
        const caller = await verifyCaller(req);
        if (!caller || caller.role !== 'admin') {
            return NextResponse.json({ error: 'Chỉ quản trị viên mới có thể tạo sản phẩm' }, { status: 403 });
        }

        const body = await req.json();
        const db = getAdminDb();
        const docRef = db.collection('products').doc();

        const product: ProductDoc = {
            id: docRef.id,
            companyCode: body.companyCode?.trim() || '',
            barcode: body.barcode?.trim() || '',
            name: body.name?.trim() || '',
            image: body.image?.trim() || '',
            invoicePrice: Number(body.invoicePrice) || 0,
            actualPrice: Number(body.actualPrice) || 0,
            origin: body.origin?.trim() || '',
            unit: body.unit?.trim() || '',
            category: body.category?.trim() || '',
            minStock: Number(body.minStock) || 0,
            isActive: true,
            createdAt: new Date().toISOString(),
        };

        if (!product.name) {
            return NextResponse.json({ error: 'Tên sản phẩm là bắt buộc' }, { status: 400 });
        }

        await docRef.set(product);
        return NextResponse.json({ id: docRef.id, message: 'Đã tạo sản phẩm' });
    } catch (err: unknown) {
        return NextResponse.json({ error: err instanceof Error ? err.message : 'Server error' }, { status: 500 });
    }
}

// PUT /api/inventory/products — update product info (admin only)
export async function PUT(req: NextRequest) {
    try {
        const caller = await verifyCaller(req);
        if (!caller || caller.role !== 'admin') {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        }

        const body = await req.json();
        if (!body.id) return NextResponse.json({ error: 'Missing product id' }, { status: 400 });

        const db = getAdminDb();
        const updateData: Record<string, any> = {};
        const fields = ['companyCode', 'barcode', 'name', 'image', 'invoicePrice', 'actualPrice', 'origin', 'unit', 'category', 'minStock'];

        for (const f of fields) {
            if (body[f] !== undefined) {
                updateData[f] = ['invoicePrice', 'actualPrice', 'minStock'].includes(f) ? Number(body[f]) || 0 : String(body[f]).trim();
            }
        }

        await db.collection('products').doc(body.id).update(updateData);
        return NextResponse.json({ message: 'Đã cập nhật sản phẩm' });
    } catch (err: unknown) {
        return NextResponse.json({ error: err instanceof Error ? err.message : 'Server error' }, { status: 500 });
    }
}

// PATCH /api/inventory/products — toggle active status (admin only)
export async function PATCH(req: NextRequest) {
    try {
        const caller = await verifyCaller(req);
        if (!caller || caller.role !== 'admin') {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        }

        const body = await req.json();
        if (!body.id) return NextResponse.json({ error: 'Missing product id' }, { status: 400 });

        const db = getAdminDb();
        await db.collection('products').doc(body.id).update({ isActive: !!body.isActive });

        return NextResponse.json({ message: body.isActive ? 'Sản phẩm đã kích hoạt' : 'Sản phẩm đã tắt' });
    } catch (err: unknown) {
        return NextResponse.json({ error: err instanceof Error ? err.message : 'Server error' }, { status: 500 });
    }
}
