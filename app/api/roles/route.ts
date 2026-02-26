import { NextRequest, NextResponse } from 'next/server';
import { getAdminAuth, getAdminDb } from '@/lib/firebase-admin';
import { CustomRoleDoc, AppPermission } from '@/types';

// GET /api/roles — list all custom roles (any authenticated user, to populate dropdowns)
export async function GET(req: NextRequest) {
    try {
        const token = req.headers.get('Authorization')?.split('Bearer ')[1];
        if (!token) return NextResponse.json({ error: 'Chưa xác thực' }, { status: 401 });

        const adminAuth = getAdminAuth();
        await adminAuth.verifyIdToken(token);

        const adminDb = getAdminDb();
        const snap = await adminDb.collection('custom_roles').orderBy('name').get();
        const roles = snap.docs.map(d => ({ id: d.id, ...d.data() }));

        return NextResponse.json(roles);
    } catch (err) {
        const message = err instanceof Error ? err.message : 'Lỗi hệ thống';
        return NextResponse.json({ error: message }, { status: 500 });
    }
}

// POST /api/roles — create a new custom role (admin only)
export async function POST(req: NextRequest) {
    try {
        const token = req.headers.get('Authorization')?.split('Bearer ')[1];
        if (!token) return NextResponse.json({ error: 'Chưa xác thực' }, { status: 401 });

        const adminAuth = getAdminAuth();
        const decoded = await adminAuth.verifyIdToken(token);

        const adminDb = getAdminDb();
        const callerDoc = await adminDb.collection('users').doc(decoded.uid).get();
        if (!callerDoc.exists || callerDoc.data()?.role !== 'admin') {
            return NextResponse.json({ error: 'Chỉ admin mới có quyền tạo role' }, { status: 403 });
        }

        const body = await req.json() as { name: string; permissions: AppPermission[]; allowStoreManager?: boolean };
        if (!body.name?.trim()) {
            return NextResponse.json({ error: 'Tên role không được để trống' }, { status: 400 });
        }

        const newRole: Omit<CustomRoleDoc, 'id'> = {
            name: body.name.trim(),
            permissions: body.permissions || [],
            allowStoreManager: Boolean(body.allowStoreManager),
            createdAt: new Date().toISOString(),
            createdBy: decoded.uid,
        };

        const ref = await adminDb.collection('custom_roles').add(newRole);
        return NextResponse.json({ id: ref.id, ...newRole }, { status: 201 });
    } catch (err) {
        const message = err instanceof Error ? err.message : 'Lỗi hệ thống';
        return NextResponse.json({ error: message }, { status: 500 });
    }
}
