import 'server-only';

import type { NextRequest } from 'next/server';
import type { Firestore } from 'firebase-admin/firestore';
import { getAdminAuth, getAdminDb } from '@/lib/firebase-admin';
import type { UserDoc, WorkplaceType } from '@/types';
import { getManagedStoreIds, getUserMemberships, getUserStoreIds, userHasWorkplace } from './server';

export class WorkplaceAccessError extends Error {
    constructor(message: string, public readonly status = 403) {
        super(message);
        this.name = 'WorkplaceAccessError';
    }
}

export interface WorkplaceCaller {
    uid: string;
    user: UserDoc;
    db: Firestore;
    permissions: Set<string>;
    isAdmin: boolean;
}

export async function requireWorkplaceCaller(req: NextRequest): Promise<WorkplaceCaller> {
    const bearer = req.headers.get('authorization')?.match(/^Bearer\s+(.+)$/i)?.[1];
    if (!bearer) throw new WorkplaceAccessError('Chưa xác thực.', 401);
    let uid = '';
    try {
        uid = (await getAdminAuth().verifyIdToken(bearer)).uid;
    } catch {
        throw new WorkplaceAccessError('Token đăng nhập không hợp lệ.', 401);
    }
    const db = getAdminDb();
    const snapshot = await db.collection('users').doc(uid).get();
    if (!snapshot.exists) throw new WorkplaceAccessError('Không tìm thấy tài khoản.', 403);
    const user = { uid, ...snapshot.data() } as UserDoc;
    if (user.isActive === false) throw new WorkplaceAccessError('Tài khoản đã bị vô hiệu hóa.', 403);
    const isAdmin = user.role === 'admin' || user.role === 'super_admin';
    const roleId = user.customRoleId || user.role;
    const role = !isAdmin && roleId ? await db.collection('custom_roles').doc(roleId).get() : null;
    const permissions = new Set<string>(role?.exists && Array.isArray(role.data()?.permissions)
        ? role.data()!.permissions
        : []);
    if (user.canManageHR) permissions.add('action.hr.manage');
    return { uid, user, db, permissions, isAdmin };
}

export function assertPermission(caller: WorkplaceCaller, permission: string) {
    if (!caller.isAdmin && !caller.permissions.has(permission)) {
        throw new WorkplaceAccessError('Bạn không có quyền thực hiện thao tác này.', 403);
    }
}

export async function assertWorkplaceScope(
    caller: WorkplaceCaller,
    type: WorkplaceType,
    id: string,
) {
    if (caller.isAdmin) return;
    if (type === 'STORE') {
        if ((await getManagedStoreIds(caller.db, caller.user)).has(id)) return;
    } else if (await userHasWorkplace(caller.db, caller.user, type, id)) {
        return;
    }
    throw new WorkplaceAccessError('Nơi làm việc nằm ngoài phạm vi quản lý của bạn.', 403);
}

export async function assertUserInWorkplaceScope(caller: WorkplaceCaller, target: UserDoc) {
    if (caller.isAdmin || caller.uid === target.uid) return;
    const [managedStores, targetStores, callerMemberships, targetMemberships] = await Promise.all([
        getManagedStoreIds(caller.db, caller.user),
        getUserStoreIds(caller.db, target),
        getUserMemberships(caller.db, caller.user),
        getUserMemberships(caller.db, target),
    ]);
    if (targetStores.some(id => managedStores.has(id))) return;
    const callerKeys = new Set(callerMemberships
        .filter(item => item.workplace.type !== 'STORE')
        .map(item => item.workplace.key));
    if (targetMemberships.some(item => callerKeys.has(item.workplace.key))) return;
    throw new WorkplaceAccessError('Tài khoản nằm ngoài phạm vi nơi làm việc bạn quản lý.', 403);
}

export function workplaceAccessResponse(error: unknown): Response | null {
    if (!(error instanceof WorkplaceAccessError)) return null;
    return Response.json({ error: error.message }, { status: error.status });
}
