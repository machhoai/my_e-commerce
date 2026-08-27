import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import {
    attendanceAccessErrorResponse,
    requireAttendanceAccess,
} from '@/lib/attendance/access';
import { normalizeIpAddress } from '@/lib/attendance/policy';
import { attendancePolicyInputSchema } from '@/lib/attendance/policy-schema';
import { getAdminDb } from '@/lib/firebase-admin';
import type { AuditLogDoc, StoreAttendancePolicy, StoreDoc } from '@/types';

type RouteContext = { params: Promise<{ storeId: string }> };

function policyErrorResponse(error: unknown): Response {
    const accessResponse = attendanceAccessErrorResponse(error);
    if (accessResponse) return accessResponse;

    if (error instanceof z.ZodError) {
        return NextResponse.json(
            { error: 'Cấu hình chấm công không hợp lệ.', details: error.flatten() },
            { status: 400 },
        );
    }

    console.error('[attendance-policy] error:', error);
    return NextResponse.json({ error: 'Không thể xử lý cấu hình chấm công.' }, { status: 500 });
}

export async function GET(req: NextRequest, { params }: RouteContext) {
    try {
        const { storeId } = await params;
        await requireAttendanceAccess(req, {
            permission: 'hr.attendance.configure',
            storeId,
        });

        const db = getAdminDb();
        const [storeSnapshot, policySnapshot] = await Promise.all([
            db.collection('stores').doc(storeId).get(),
            db.collection('store_attendance_policies').doc(storeId).get(),
        ]);

        if (!storeSnapshot.exists) {
            return NextResponse.json({ error: 'Không tìm thấy cửa hàng.' }, { status: 404 });
        }

        const store = { id: storeSnapshot.id, ...storeSnapshot.data() } as StoreDoc;
        const policy = policySnapshot.exists
            ? (policySnapshot.data() as StoreAttendancePolicy)
            : null;

        return NextResponse.json(
            { policy, storeCoordinate: store.coordinate ?? null },
            { headers: { 'Cache-Control': 'no-store' } },
        );
    } catch (error) {
        return policyErrorResponse(error);
    }
}

export async function PUT(req: NextRequest, { params }: RouteContext) {
    try {
        const { storeId } = await params;
        const caller = await requireAttendanceAccess(req, {
            permission: 'hr.attendance.configure',
            storeId,
        });
        const input = attendancePolicyInputSchema.parse(await req.json());
        const db = getAdminDb();
        const storeRef = db.collection('stores').doc(storeId);
        const policyRef = db.collection('store_attendance_policies').doc(storeId);
        const [storeSnapshot, oldPolicySnapshot] = await Promise.all([
            storeRef.get(),
            policyRef.get(),
        ]);

        if (!storeSnapshot.exists) {
            return NextResponse.json({ error: 'Không tìm thấy cửa hàng.' }, { status: 404 });
        }

        const now = new Date().toISOString();
        const allowedIpAddresses = Array.from(
            new Set(
                input.allowedIpAddresses
                    .map(normalizeIpAddress)
                    .filter((value): value is string => Boolean(value)),
            ),
        );
        const policy: StoreAttendancePolicy = {
            storeId,
            enabled: input.enabled,
            sourceMode: input.sourceMode,
            verificationMethod: input.verificationMethod,
            allowedIpAddresses,
            gps: input.gps,
            requireCheckOut: input.requireCheckOut,
            timezone: 'Asia/Ho_Chi_Minh',
            effectiveFrom: now,
            effectiveTo: null,
            updatedBy: caller.uid,
            updatedAt: now,
        };

        const oldPolicy = oldPolicySnapshot.exists
            ? (oldPolicySnapshot.data() as StoreAttendancePolicy)
            : null;
        const auditRef = db.collection('audit_logs').doc();
        const audit: AuditLogDoc = {
            id: auditRef.id,
            action: oldPolicy ? 'UPDATE_ATTENDANCE_POLICY' : 'CREATE_ATTENDANCE_POLICY',
            actor: caller.uid,
            actorName: caller.user.name,
            timestamp: now,
            targetId: storeId,
            targetType: 'store_attendance_policy',
            storeId,
            details: `${oldPolicy ? 'Cập nhật' : 'Tạo'} cấu hình chấm công ${policy.sourceMode}${policy.verificationMethod ? `/${policy.verificationMethod}` : ''}`,
            before: oldPolicy as unknown as Record<string, unknown> | null,
            after: policy as unknown as Record<string, unknown>,
        };

        const batch = db.batch();
        batch.set(policyRef, policy);
        batch.set(auditRef, audit);
        if (policy.gps) {
            batch.set(
                storeRef,
                {
                    coordinate: {
                        latitude: policy.gps.latitude,
                        longitude: policy.gps.longitude,
                    },
                },
                { merge: true },
            );
        }
        await batch.commit();

        return NextResponse.json({ policy });
    } catch (error) {
        return policyErrorResponse(error);
    }
}
