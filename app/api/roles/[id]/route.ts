import { NextRequest, NextResponse } from 'next/server';
import { getAdminAuth, getAdminDb } from '@/lib/firebase-admin';
import { AppPermission } from '@/types';

async function requireAdmin(req: NextRequest) {
    const token = req.headers.get('Authorization')?.split('Bearer ')[1];
    if (!token) throw new Error('UNAUTHORIZED');
    const adminAuth = getAdminAuth();
    const decoded = await adminAuth.verifyIdToken(token);
    const adminDb = getAdminDb();
    const callerDoc = await adminDb.collection('users').doc(decoded.uid).get();
    if (!callerDoc.exists || callerDoc.data()?.role !== 'admin') throw new Error('FORBIDDEN');
    return { decoded, adminDb };
}

function handleError(err: unknown) {
    if (err instanceof Error && err.message === 'UNAUTHORIZED') return NextResponse.json({ error: 'Chưa xác thực' }, { status: 401 });
    if (err instanceof Error && err.message === 'FORBIDDEN') return NextResponse.json({ error: 'Không có quyền' }, { status: 403 });
    const message = err instanceof Error ? err.message : 'Lỗi hệ thống';
    return NextResponse.json({ error: message }, { status: 500 });
}

// PUT /api/roles/[id] — update role name, permissions and/or allowStoreManager (admin only)
export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    try {
        const { adminDb } = await requireAdmin(req);
        const { id } = await params;
        const body = await req.json() as { name?: string; permissions?: AppPermission[]; allowStoreManager?: boolean };
        const updateData: Record<string, unknown> = {};
        if (body.name !== undefined) updateData.name = body.name.trim();
        if (body.permissions !== undefined) updateData.permissions = body.permissions;
        if (body.allowStoreManager !== undefined) updateData.allowStoreManager = Boolean(body.allowStoreManager);
        if (Object.keys(updateData).length === 0) {
            return NextResponse.json({ error: 'Không có dữ liệu cập nhật' }, { status: 400 });
        }
        await adminDb.collection('custom_roles').doc(id).update(updateData);
        return NextResponse.json({ message: 'Đã cập nhật role' });
    } catch (err) { return handleError(err); }
}

// DELETE /api/roles/[id] — delete role (admin only). Blocked if any user still has this role.
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    try {
        const { adminDb } = await requireAdmin(req);
        const { id } = await params;

        // Check if any users currently hold this custom role
        const usersSnap = await adminDb.collection('users')
            .where('customRoleId', '==', id)
            .get();

        if (!usersSnap.empty) {
            const count = usersSnap.size;
            const names = usersSnap.docs.slice(0, 3).map(d => d.data().name).join(', ');
            return NextResponse.json({
                error: `Không thể xóa: role này đang được dùng bởi ${count} tài khoản (${names}${count > 3 ? '...' : ''}). Hãy gỡ role khỏi các tài khoản trước.`
            }, { status: 409 });
        }

        await adminDb.collection('custom_roles').doc(id).delete();
        return NextResponse.json({ message: 'Đã xóa role' });
    } catch (err) { return handleError(err); }
}
