import { NextRequest, NextResponse } from 'next/server';
import { hydrateMemberships, getManagedStoreIds } from '@/lib/workplace/server';
import { requireWorkplaceCaller, workplaceAccessResponse } from '@/lib/workplace/access';

export async function GET(req: NextRequest) {
    try {
        const caller = await requireWorkplaceCaller(req);
        const [workplaces, managedStoreIds] = await Promise.all([
            hydrateMemberships(caller.db, caller.user),
            getManagedStoreIds(caller.db, caller.user),
        ]);
        return NextResponse.json({
            workplaces,
            managedStoreIds: [...managedStoreIds],
            primaryWorkplaceKey: caller.user.primaryWorkplaceKey || null,
            schemaVersion: caller.user.workplaceSchemaVersion || 1,
        }, { headers: { 'Cache-Control': 'no-store' } });
    } catch (error) {
        return workplaceAccessResponse(error)
            ?? NextResponse.json({ error: 'Không thể tải nơi làm việc.' }, { status: 500 });
    }
}
