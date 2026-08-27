import 'server-only';

import type { DecodedIdToken } from 'firebase-admin/auth';
import type { NextRequest } from 'next/server';
import { getAdminAuth, getAdminDb } from '@/lib/firebase-admin';
import type { UserDoc } from '@/types';

export type AttendancePermission =
    | 'page.hr.attendance'
    | 'hr.attendance.configure'
    | 'action.attendance.punch'
    | 'action.attendance.export'
    | 'action.attendance.adjust';

export class AttendanceAccessError extends Error {
    constructor(message: string, public readonly status: number) {
        super(message);
        this.name = 'AttendanceAccessError';
    }
}

export interface AttendanceCaller {
    uid: string;
    user: UserDoc;
    permissions: Set<string>;
    managedStoreIds: Set<string>;
    isAdmin: boolean;
}

async function verifyRequestIdentity(req: NextRequest): Promise<DecodedIdToken> {
    const bearer = req.headers.get('authorization')?.match(/^Bearer\s+(.+)$/i)?.[1];
    if (bearer) {
        try {
            return await getAdminAuth().verifyIdToken(bearer);
        } catch {
            throw new AttendanceAccessError('Token đăng nhập không hợp lệ.', 401);
        }
    }

    const sessionCookie = req.cookies.get('session')?.value;
    if (!sessionCookie) {
        throw new AttendanceAccessError('Phiên đăng nhập không tồn tại.', 401);
    }

    try {
        return await getAdminAuth().verifySessionCookie(sessionCookie, true);
    } catch {
        throw new AttendanceAccessError('Phiên đăng nhập đã hết hạn hoặc không hợp lệ.', 401);
    }
}

export async function requireAttendanceCaller(req: NextRequest): Promise<AttendanceCaller> {
    const identity = await verifyRequestIdentity(req);
    const db = getAdminDb();
    const userSnapshot = await db.collection('users').doc(identity.uid).get();

    if (!userSnapshot.exists) {
        throw new AttendanceAccessError('Không tìm thấy tài khoản.', 403);
    }

    const user = { uid: identity.uid, ...userSnapshot.data() } as UserDoc;
    if (user.isActive === false) {
        throw new AttendanceAccessError('Tài khoản đã bị vô hiệu hóa.', 403);
    }

    const isAdmin = user.role === 'admin' || user.role === 'super_admin';
    const roleId = user.customRoleId || user.role;

    const [roleSnapshot, officeSnapshot] = await Promise.all([
        !isAdmin && roleId
            ? db.collection('custom_roles').doc(roleId).get()
            : Promise.resolve(null),
        !isAdmin && user.officeId
            ? db.collection('offices').doc(user.officeId).get()
            : Promise.resolve(null),
    ]);

    const permissions = new Set<string>(
        roleSnapshot?.exists && Array.isArray(roleSnapshot.data()?.permissions)
            ? roleSnapshot.data()!.permissions
            : [],
    );
    const officeStoreIds =
        officeSnapshot?.exists && Array.isArray(officeSnapshot.data()?.managedStoreIds)
            ? officeSnapshot.data()!.managedStoreIds
            : [];
    const managedStoreIds = new Set<string>(officeStoreIds);
    if (user.storeId) managedStoreIds.add(user.storeId);

    return {
        uid: identity.uid,
        user,
        permissions,
        managedStoreIds,
        isAdmin,
    };
}

export function assertAttendancePermission(
    caller: AttendanceCaller,
    permission: AttendancePermission,
): void {
    if (!caller.isAdmin && !caller.permissions.has(permission)) {
        throw new AttendanceAccessError('Bạn không có quyền thực hiện thao tác chấm công này.', 403);
    }
}

export function assertAttendanceStoreAccess(
    caller: AttendanceCaller,
    storeId: string,
): void {
    if (!storeId.trim()) {
        throw new AttendanceAccessError('Thiếu mã cửa hàng.', 400);
    }
    if (!caller.isAdmin && !caller.managedStoreIds.has(storeId)) {
        throw new AttendanceAccessError('Bạn không có quyền truy cập cửa hàng này.', 403);
    }
}

export async function requireAttendanceAccess(
    req: NextRequest,
    options: { permission: AttendancePermission; storeId?: string },
): Promise<AttendanceCaller> {
    const caller = await requireAttendanceCaller(req);
    assertAttendancePermission(caller, options.permission);
    if (options.storeId !== undefined) {
        assertAttendanceStoreAccess(caller, options.storeId);
    }
    return caller;
}

export function attendanceAccessErrorResponse(error: unknown): Response | null {
    if (!(error instanceof AttendanceAccessError)) return null;
    return Response.json({ error: error.message }, { status: error.status });
}
