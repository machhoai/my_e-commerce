import { NextRequest, NextResponse } from 'next/server';
import { getAdminAuth, getAdminDb } from '@/lib/firebase-admin';

// POST /api/inventory/products/bulk — batch-insert up to 500 products (admin only)
export async function POST(req: NextRequest) {
    try {
        const token = req.headers.get('Authorization')?.split('Bearer ')[1];
        if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

        const auth = getAdminAuth();
        const decoded = await auth.verifyIdToken(token);
        const db = getAdminDb();

        const callerSnap = await db.collection('users').doc(decoded.uid).get();
        if (!callerSnap.exists || callerSnap.data()?.role !== 'admin') {
            return NextResponse.json({ error: 'Chỉ quản trị viên mới có thể nhập hàng loạt' }, { status: 403 });
        }

        const body = await req.json();
        const rows: Record<string, unknown>[] = body.products;

        if (!Array.isArray(rows) || rows.length === 0) {
            return NextResponse.json({ error: 'Danh sách sản phẩm rỗng' }, { status: 400 });
        }
        // Firestore batch limit = 500 ops
        if (rows.length > 500) {
            return NextResponse.json({ error: 'Tối đa 500 sản phẩm mỗi lần nhập' }, { status: 400 });
        }

        const now = new Date().toISOString();
        const batch = db.batch();
        let count = 0;

        console.log('[BulkImport] Received', rows.length, 'rows');

        // Helper: try starred, unstarred, then English key — robust to all payload formats
        const str = (row: Record<string, unknown>, starred: string, plain: string, eng: string): string =>
            String(row[starred] ?? row[plain] ?? row[eng] ?? '').trim();

        for (const row of rows) {
            const name = str(row, 'Tên hàng hóa *', 'Tên hàng hóa', 'name');
            if (!name) continue; // skip completely blank rows

            const docRef = db.collection('products').doc();
            batch.set(docRef, {
                id: docRef.id,
                companyCode: str(row, 'Mã nội bộ *', 'Mã nội bộ', 'companyCode'),
                barcode: str(row, 'Mã vạch *', 'Mã vạch', 'barcode'),
                name,
                unit: str(row, 'Đơn vị tính *', 'Đơn vị tính', 'unit'),
                category: str(row, 'Danh mục *', 'Danh mục', 'category'),
                origin: str(row, 'Xuất xứ', 'Xuất xứ', 'origin'),
                invoicePrice: Number(row['Giá hóa đơn'] ?? row.invoicePrice ?? 0) || 0,
                actualPrice: Number(row['Giá thực tế'] ?? row.actualPrice ?? 0) || 0,
                minStock: Number(row['Tồn kho tối thiểu'] ?? row.minStock ?? 0) || 0,
                image: String(row['Hình ảnh (Link)'] ?? row.image ?? '').trim(),
                isActive: true,
                createdAt: now,
            });
            count++;
        }

        await batch.commit();
        return NextResponse.json({ message: `Đã nhập thành công ${count} sản phẩm`, count });
    } catch (err: unknown) {
        return NextResponse.json({ error: err instanceof Error ? err.message : 'Server error' }, { status: 500 });
    }
}
