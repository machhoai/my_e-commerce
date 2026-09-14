import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { attendanceAccessErrorResponse, requireAttendanceAccess } from '@/lib/attendance/access';
import { attendanceMappingId } from '@/lib/attendance/device-model';
import { getAdminDb } from '@/lib/firebase-admin';
import type { ZkUserDoc } from '@/types';
import { assertEmployeeStoreMembership, getTargetUser } from '@/lib/scheduling/server';
import { workplaceAccessResponse } from '@/lib/workplace/access';

const mappingInputSchema = z.object({
    deviceId: z.string().trim().min(1),
    zkUserId: z.string().trim().min(1),
    status: z.enum(['unmapped', 'mapped', 'ignored']),
    mapped_system_uid: z.string().trim().min(1).nullable().optional(),
    mapped_system_name: z.string().trim().min(1).nullable().optional(),
}).strict().superRefine((input, context) => {
    if (input.status === 'mapped' && !input.mapped_system_uid) {
        context.addIssue({ code: z.ZodIssueCode.custom, path: ['mapped_system_uid'], message: 'Thiếu nhân viên cần ghép' });
    }
});

export async function GET(req: NextRequest) {
    try {
        const { searchParams } = new URL(req.url);
        const storeId = searchParams.get('storeId')?.trim() ?? '';
        const deviceId = searchParams.get('deviceId')?.trim() ?? '';
        const status = searchParams.get('status');
        await requireAttendanceAccess(req, { permission: 'hr.attendance.configure', storeId });
        const snapshot = await getAdminDb().collection('zkteco_users').get();
        const users = snapshot.docs
            .map((document) => ({ id: document.id, ...document.data() } as ZkUserDoc))
            .filter((user) => user.storeId === storeId)
            .filter((user) => !deviceId || user.deviceId === deviceId)
            .filter((user) => !status || user.status === status)
            .sort((a, b) => a.zk_name.localeCompare(b.zk_name, 'vi'));
        return NextResponse.json(users, { headers: { 'Cache-Control': 'no-store' } });
    } catch (error) {
        return attendanceAccessErrorResponse(error)
            ?? NextResponse.json({ error: 'Không thể tải mapping máy chấm công.' }, { status: 500 });
    }
}

export async function PATCH(req: NextRequest) {
    try {
        const input = mappingInputSchema.parse(await req.json());
        const db = getAdminDb();
        const ref = db.collection('zkteco_users').doc(attendanceMappingId(input.deviceId, input.zkUserId));
        const snapshot = await ref.get();
        if (!snapshot.exists) {
            return NextResponse.json({ error: 'Không tìm thấy người dùng trên thiết bị.' }, { status: 404 });
        }
        const mapping = { id: snapshot.id, ...snapshot.data() } as ZkUserDoc;
        await requireAttendanceAccess(req, {
            permission: 'hr.attendance.configure',
            storeId: mapping.storeId,
        });
        if (input.status === 'mapped' && input.mapped_system_uid) {
            const target = await getTargetUser(db, input.mapped_system_uid);
            const today = new Date().toLocaleDateString('sv-SE', { timeZone: 'Asia/Ho_Chi_Minh' });
            await assertEmployeeStoreMembership(db, target, mapping.storeId, today);
        }
        await ref.update({
            status: input.status,
            mapped_system_uid: input.status === 'mapped' ? input.mapped_system_uid ?? null : null,
            mapped_system_name: input.status === 'mapped' ? input.mapped_system_name ?? null : null,
        });
        return NextResponse.json({ success: true });
    } catch (error) {
        const accessResponse = attendanceAccessErrorResponse(error);
        if (accessResponse) return accessResponse;
        const workplaceResponse = workplaceAccessResponse(error);
        if (workplaceResponse) return workplaceResponse;
        if (error instanceof z.ZodError) {
            return NextResponse.json({ error: 'Mapping không hợp lệ.', details: error.flatten() }, { status: 400 });
        }
        return NextResponse.json({ error: 'Không thể cập nhật mapping.' }, { status: 500 });
    }
}
