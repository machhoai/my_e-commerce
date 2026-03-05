import { NextRequest, NextResponse } from 'next/server';
import { getAdminAuth, getAdminDb } from '@/lib/firebase-admin';
import { CustomRoleDoc, AppPermission } from '@/types';

// System roles to auto-seed if collection is empty
const SYSTEM_ROLES: Omit<CustomRoleDoc, 'createdAt' | 'createdBy'>[] = [
    {
        id: 'admin',
        name: 'Quản trị viên',
        permissions: ['view_overview', 'view_history', 'view_schedule', 'edit_schedule', 'view_users', 'manage_hr', 'manage_kpi_templates', 'score_employees', 'view_all_kpi', 'export_kpi'],
        isSystem: true,
        isLocked: true,
        creatorRoles: ['admin'],
        color: 'red',
    },
    {
        id: 'store_manager',
        name: 'Cửa hàng trưởng',
        permissions: ['view_overview', 'view_history', 'view_schedule', 'edit_schedule', 'view_users', 'manage_hr', 'manage_kpi_templates', 'score_employees', 'view_all_kpi', 'export_kpi'],
        isSystem: true,
        isLocked: false,
        creatorRoles: ['admin'],
        color: 'purple',
    },
    {
        id: 'manager',
        name: 'Quản lý',
        permissions: ['view_overview', 'view_history'],
        isSystem: true,
        isLocked: false,
        creatorRoles: ['admin', 'store_manager'],
        color: 'amber',
    },
    {
        id: 'employee',
        name: 'Nhân viên',
        permissions: ['register_shift'],
        isSystem: true,
        isLocked: false,
        creatorRoles: ['admin', 'store_manager'],
        color: 'blue',
    },
];

async function ensureSystemRoles(adminDb: FirebaseFirestore.Firestore) {
    const col = adminDb.collection('custom_roles');
    // Check if system roles already exist
    const adminSnap = await col.doc('admin').get();
    if (adminSnap.exists) return; // Already seeded

    const batch = adminDb.batch();
    for (const role of SYSTEM_ROLES) {
        const { id, ...data } = role;
        batch.set(col.doc(id), { ...data, createdAt: new Date().toISOString(), createdBy: 'system' });
    }
    await batch.commit();
}

// GET /api/roles — list all roles (system + custom)
export async function GET(req: NextRequest) {
    try {
        const token = req.headers.get('Authorization')?.split('Bearer ')[1];
        if (!token) return NextResponse.json({ error: 'Chưa xác thực' }, { status: 401 });

        const adminAuth = getAdminAuth();
        await adminAuth.verifyIdToken(token);

        const adminDb = getAdminDb();
        await ensureSystemRoles(adminDb);

        const snap = await adminDb.collection('custom_roles').orderBy('name').get();
        const roles = snap.docs.map(d => ({ id: d.id, ...d.data() }));

        return NextResponse.json(roles);
    } catch (err) {
        const message = err instanceof Error ? err.message : 'Lỗi hệ thống';
        return NextResponse.json({ error: message }, { status: 500 });
    }
}

// POST /api/roles — create a new role (admin only)
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

        const body = await req.json() as {
            name: string;
            permissions: AppPermission[];
            creatorRoles?: string[];
            color?: string;
        };

        if (!body.name?.trim()) {
            return NextResponse.json({ error: 'Tên role không được để trống' }, { status: 400 });
        }

        const newRole: Omit<CustomRoleDoc, 'id'> = {
            name: body.name.trim(),
            permissions: body.permissions || [],
            creatorRoles: body.creatorRoles || ['admin'],
            color: body.color || undefined,
            isSystem: false,
            isLocked: false,
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
