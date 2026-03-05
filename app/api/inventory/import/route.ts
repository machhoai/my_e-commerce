import { NextRequest, NextResponse } from 'next/server';
import { getAdminAuth, getAdminDb } from '@/lib/firebase-admin';
import { recordTransaction, updateBalance } from '@/lib/inventory-services';

// POST /api/inventory/import — import goods into central warehouse (admin only)
export async function POST(req: NextRequest) {
    try {
        const token = req.headers.get('Authorization')?.split('Bearer ')[1];
        if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

        const auth = getAdminAuth();
        const decoded = await auth.verifyIdToken(token);
        const db = getAdminDb();

        // Verify admin
        const callerSnap = await db.collection('users').doc(decoded.uid).get();
        if (!callerSnap.exists || callerSnap.data()?.role !== 'admin') {
            return NextResponse.json({ error: 'Chỉ quản trị viên mới có thể nhập kho' }, { status: 403 });
        }

        const body = await req.json();
        const { items, note } = body;
        // items: [{ productId, productName, quantity }]

        if (!items?.length) {
            return NextResponse.json({ error: 'Danh sách sản phẩm không được trống' }, { status: 400 });
        }

        const batchId = `IMP_${Date.now()}`;

        for (const item of items) {
            const qty = Number(item.quantity) || 0;
            if (qty <= 0) continue;

            // Increment central warehouse balance
            await updateBalance(item.productId, 'CENTRAL', 'CENTRAL', qty);

            // Record ledger entry
            await recordTransaction({
                productId: item.productId,
                fromLocationType: '',
                fromLocationId: '',
                toLocationType: 'CENTRAL',
                toLocationId: 'CENTRAL',
                quantity: qty,
                type: 'IMPORT_CENTRAL',
                status: 'APPROVED',
                createdByUserId: decoded.uid,
                referenceId: batchId,
                note: note || `Nhập kho: ${item.productName || item.productId}`,
            });
        }

        return NextResponse.json({ message: 'Đã nhập kho thành công', batchId });
    } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Server error';
        return NextResponse.json({ error: message }, { status: 500 });
    }
}
