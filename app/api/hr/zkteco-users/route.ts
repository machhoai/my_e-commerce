/**
 * POST /api/hr/zkteco-users
 *
 * GET  — Returns all documents from the `zkteco_users` collection.
 *         Supports ?status=unmapped|mapped|ignored filter.
 *
 * PATCH — Updates the mapping status of a single ZK user.
 *          Body: { id: string; status: ZkUserStatus; mapped_system_uid?: string | null; mapped_system_name?: string | null }
 */

import { NextRequest, NextResponse } from 'next/server';
import { getAdminAuth, getAdminDb } from '@/lib/firebase-admin';
import { ZkUserDoc, ZkUserStatus } from '@/types';

async function verifyToken(req: NextRequest): Promise<string | null> {
    const authHeader = req.headers.get('Authorization') ?? '';
    const token = authHeader.replace('Bearer ', '');
    if (!token) return null;
    try {
        const decoded = await getAdminAuth().verifyIdToken(token);
        return decoded.uid;
    } catch {
        return null;
    }
}

// GET /api/hr/zkteco-users[?status=unmapped]
export async function GET(req: NextRequest) {
    const uid = await verifyToken(req);
    if (!uid) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { searchParams } = new URL(req.url);
    const statusFilter = searchParams.get('status') as ZkUserStatus | null;

    const db = getAdminDb();
    let query = db.collection('zkteco_users') as FirebaseFirestore.Query;
    if (statusFilter) {
        query = query.where('status', '==', statusFilter);
    }

    const snap = await query.orderBy('zk_name').get();
    const docs = snap.docs.map((d) => ({ id: d.id, ...d.data() } as ZkUserDoc));

    return NextResponse.json(docs);
}

// PATCH /api/hr/zkteco-users — update a single user's mapping
export async function PATCH(req: NextRequest) {
    const uid = await verifyToken(req);
    if (!uid) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json();
    const { id, status, mapped_system_uid, mapped_system_name } = body;

    if (!id || !status) {
        return NextResponse.json({ error: 'id and status are required' }, { status: 400 });
    }

    const db = getAdminDb();
    const ref = db.collection('zkteco_users').doc(id);
    const snap = await ref.get();
    if (!snap.exists) {
        return NextResponse.json({ error: 'ZK user not found' }, { status: 404 });
    }

    await ref.update({
        status,
        mapped_system_uid: mapped_system_uid ?? null,
        mapped_system_name: mapped_system_name ?? null,
    });

    return NextResponse.json({ success: true });
}
