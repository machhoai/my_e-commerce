import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireWorkplaceCaller, workplaceAccessResponse } from '@/lib/workplace/access';
import { saveScheduleDays } from '@/lib/scheduling/save';
import { sendNotification } from '@/lib/notifications';

const schema = z.object({
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/), shiftId: z.string().min(1), storeId: z.string().min(1),
    assignments: z.record(z.string(), z.object({ employeeIds: z.array(z.string()), assignedByManagerUids: z.array(z.string()) }).strict()),
}).strict();

export async function POST(req: NextRequest) {
    try {
        const caller = await requireWorkplaceCaller(req); const input = schema.parse(await req.json());
        const result = await saveScheduleDays(caller, input.storeId, [{ date: input.date, shiftId: input.shiftId, assignments: input.assignments }]);
        void Promise.allSettled(result.changedUserIds.map(uid => sendNotification({
            userId: uid, title: 'Lịch làm việc của bạn đã được cập nhật',
            body: `Lịch ngày ${input.date}, ca ${input.shiftId} vừa được công bố.`, type: 'SYSTEM',
            actionLink: '/employee/dashboard', storeId: input.storeId,
        })));
        return NextResponse.json({ message: 'Đã lưu lịch làm việc thành công' });
    } catch (error) {
        if (error instanceof z.ZodError) return NextResponse.json({ error: 'Dữ liệu lịch không hợp lệ.' }, { status: 400 });
        return workplaceAccessResponse(error) ?? NextResponse.json({ error: error instanceof Error ? error.message : 'Không thể lưu lịch.' }, { status: 500 });
    }
}
