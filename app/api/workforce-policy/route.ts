import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { assertPermission, requireWorkplaceCaller, workplaceAccessResponse } from '@/lib/workplace/access';

const schema = z.object({
    ftDaysOff: z.number().int().min(0).max(31),
    ptMinShifts: z.number().int().min(0).max(100),
    ptMaxShifts: z.number().int().min(0).max(100),
}).strict().refine(value => value.ptMinShifts <= value.ptMaxShifts, { message: 'Định mức PT tối thiểu phải nhỏ hơn hoặc bằng tối đa.' });

export async function GET(req: NextRequest) {
    try {
        const caller = await requireWorkplaceCaller(req);
        const snapshot = await caller.db.collection('workforce_policies').doc('global').get();
        return NextResponse.json(snapshot.exists ? snapshot.data() : { ftDaysOff: 4, ptMinShifts: 10, ptMaxShifts: 25 });
    } catch (error) {
        return workplaceAccessResponse(error) ?? NextResponse.json({ error: 'Không thể tải định mức.' }, { status: 500 });
    }
}

export async function PUT(req: NextRequest) {
    try {
        const caller = await requireWorkplaceCaller(req); assertPermission(caller, 'page.admin.settings');
        const input = schema.parse(await req.json()); const now = new Date().toISOString();
        await caller.db.collection('workforce_policies').doc('global').set({ ...input, updatedAt: now, updatedBy: caller.uid }, { merge: true });
        return NextResponse.json({ success: true });
    } catch (error) {
        if (error instanceof z.ZodError) return NextResponse.json({ error: error.issues[0]?.message || 'Định mức không hợp lệ.' }, { status: 400 });
        return workplaceAccessResponse(error) ?? NextResponse.json({ error: 'Không thể lưu định mức.' }, { status: 500 });
    }
}
