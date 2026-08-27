import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import {
    attendanceAccessErrorResponse,
    requireAttendanceAccess,
} from '@/lib/attendance/access';
import { attendanceRulesInputSchema } from '@/lib/attendance/rules-schema';
import { getAdminDb } from '@/lib/firebase-admin';
import type { AuditLogDoc, StoreDoc } from '@/types';

type RouteContext = { params: Promise<{ storeId: string }> };

export async function PUT(req: NextRequest, { params }: RouteContext) {
    try {
        const { storeId } = await params;
        const caller = await requireAttendanceAccess(req, {
            permission: 'hr.attendance.configure',
            storeId,
        });
        const attendanceRules = attendanceRulesInputSchema.parse(await req.json());
        const db = getAdminDb();
        const storeRef = db.collection('stores').doc(storeId);
        const storeSnapshot = await storeRef.get();
        if (!storeSnapshot.exists) {
            return NextResponse.json({ error: 'Không tìm thấy cửa hàng.' }, { status: 404 });
        }
        const store = { id: storeSnapshot.id, ...storeSnapshot.data() } as StoreDoc;
        const previousRules = store.settings?.attendanceRules ?? null;
        const now = new Date().toISOString();
        const auditRef = db.collection('audit_logs').doc();
        const audit: AuditLogDoc = {
            id: auditRef.id,
            action: 'UPDATE_ATTENDANCE_RULES',
            actor: caller.uid,
            actorName: caller.user.name,
            timestamp: now,
            targetId: storeId,
            targetType: 'store_attendance_rules',
            storeId,
            details: `Cập nhật quy tắc tính công cho ${Object.keys(attendanceRules.byShift).length} ca`,
            before: previousRules as unknown as Record<string, unknown> | null,
            after: attendanceRules as unknown as Record<string, unknown>,
        };
        const batch = db.batch();
        batch.update(storeRef, { 'settings.attendanceRules': attendanceRules });
        batch.set(auditRef, audit);
        await batch.commit();
        return NextResponse.json({ attendanceRules });
    } catch (error) {
        const accessResponse = attendanceAccessErrorResponse(error);
        if (accessResponse) return accessResponse;
        if (error instanceof z.ZodError) {
            return NextResponse.json(
                { error: 'Quy tắc tính công không hợp lệ.', details: error.flatten() },
                { status: 400 },
            );
        }
        console.error('[attendance-rules] error:', error);
        return NextResponse.json({ error: 'Không thể lưu quy tắc tính công.' }, { status: 500 });
    }
}
