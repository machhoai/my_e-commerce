import { NextRequest, NextResponse } from 'next/server';
import { requireWorkplaceCaller, workplaceAccessResponse, WorkplaceAccessError } from '@/lib/workplace/access';
import { getManagedStoreIds, getStoreUsers } from '@/lib/workplace/server';

export async function GET(req: NextRequest, { params }: { params: Promise<{ storeId: string }> }) {
    try {
        const caller = await requireWorkplaceCaller(req); const { storeId } = await params;
        const canView = caller.isAdmin || caller.permissions.has('page.hr.users')
            || caller.permissions.has('page.scheduling.overview')
            || caller.permissions.has('page.scheduling.register')
            || caller.permissions.has('page.scheduling.builder')
            || caller.permissions.has('page.hr.attendance');
        if (!canView) throw new WorkplaceAccessError('Bạn không có quyền xem danh sách nhân viên.', 403);
        if (!caller.isAdmin && !(await getManagedStoreIds(caller.db, caller.user)).has(storeId)) {
            throw new WorkplaceAccessError('Cửa hàng nằm ngoài phạm vi quản lý.', 403);
        }
        const users = (await getStoreUsers(caller.db, storeId)).filter(user => user.isActive !== false);
        return NextResponse.json(users, { headers: { 'Cache-Control': 'no-store' } });
    } catch (error) {
        return workplaceAccessResponse(error) ?? NextResponse.json({ error: 'Không thể tải danh sách nhân viên.' }, { status: 500 });
    }
}
