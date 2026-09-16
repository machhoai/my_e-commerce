import { NextRequest, NextResponse } from 'next/server';
import type { UserDoc } from '@/types';
import { requireWorkplaceCaller, WorkplaceAccessError, workplaceAccessResponse } from '@/lib/workplace/access';
import { hydrateUserStoreIds } from '@/lib/workplace/server';

export async function GET(req: NextRequest) {
    try {
        const caller = await requireWorkplaceCaller(req);
        if (!caller.isAdmin) throw new WorkplaceAccessError('Bạn không có quyền xem toàn bộ người dùng.', 403);
        const snapshot = await caller.db.collection('users').orderBy('name').get();
        const users = snapshot.docs.map(doc => ({ uid: doc.id, ...doc.data() } as UserDoc));
        return NextResponse.json(await hydrateUserStoreIds(caller.db, users), {
            headers: { 'Cache-Control': 'no-store' },
        });
    } catch (error) {
        return workplaceAccessResponse(error)
            ?? NextResponse.json({ error: 'Không thể tải danh sách người dùng.' }, { status: 500 });
    }
}
