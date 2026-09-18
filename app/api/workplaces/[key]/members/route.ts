import { NextRequest, NextResponse } from 'next/server';
import { assertPermission, assertWorkplaceScope, requireWorkplaceCaller, workplaceAccessResponse, WorkplaceAccessError } from '@/lib/workplace/access';
import { parseWorkplaceKey } from '@/lib/workplace/keys';
import { getWorkplaceUsers, hydrateUserStoreIds } from '@/lib/workplace/server';

export async function GET(req: NextRequest, { params }: { params: Promise<{ key: string }> }) {
    try {
        const caller = await requireWorkplaceCaller(req); assertPermission(caller, 'page.hr.users');
        const parsed = parseWorkplaceKey((await params).key);
        if (!parsed) throw new WorkplaceAccessError('Mã nơi làm việc không hợp lệ.', 400);
        await assertWorkplaceScope(caller, parsed.type, parsed.id);
        const users = await hydrateUserStoreIds(
            caller.db,
            await getWorkplaceUsers(caller.db, parsed.type, parsed.id),
        );
        return NextResponse.json(users, { headers: { 'Cache-Control': 'no-store' } });
    } catch (error) {
        return workplaceAccessResponse(error) ?? NextResponse.json({ error: 'Không thể tải danh sách nhân viên.' }, { status: 500 });
    }
}
