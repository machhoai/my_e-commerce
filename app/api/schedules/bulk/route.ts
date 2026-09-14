import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireWorkplaceCaller, workplaceAccessResponse } from '@/lib/workplace/access';
import { saveScheduleDays } from '@/lib/scheduling/save';
import { sendTemplatedNotification } from '@/lib/notification-engine';

const assignments = z.record(z.string(), z.object({ employeeIds: z.array(z.string()), assignedByManagerUids: z.array(z.string()) }).strict());
const schema = z.object({
    storeId: z.string().min(1),
    days: z.array(z.object({ date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/), shiftId: z.string().min(1), assignments }).strict()).min(1),
}).strict();

export async function POST(req: NextRequest) {
    try {
        const caller = await requireWorkplaceCaller(req); const input = schema.parse(await req.json());
        const result = await saveScheduleDays(caller, input.storeId, input.days);
        const store = await caller.db.collection('stores').doc(input.storeId).get();
        void Promise.allSettled(result.changedUserIds.map(uid => sendTemplatedNotification({
            userId: uid, eventName: 'SCHEDULE_PUBLISHED',
            dataContext: { storeName: store.data()?.name || input.storeId, shiftId: input.days[0].shiftId, date: input.days[0].date },
            actionLink: '/employee/dashboard', storeId: input.storeId,
        })));
        return NextResponse.json({ message: 'Đã lưu và công khai lịch làm việc thành công', savedDays: result.savedDays });
    } catch (error) {
        if (error instanceof z.ZodError) return NextResponse.json({ error: 'Dữ liệu lịch không hợp lệ.' }, { status: 400 });
        return workplaceAccessResponse(error) ?? NextResponse.json({ error: error instanceof Error ? error.message : 'Không thể lưu lịch.' }, { status: 500 });
    }
}
