import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import type { UserDoc, WorkplaceMembership, WorkplaceType } from '@/types';
import {
    assertPermission,
    assertUserInWorkplaceScope,
    assertWorkplaceScope,
    requireWorkplaceCaller,
    WorkplaceAccessError,
    workplaceAccessResponse,
} from '@/lib/workplace/access';
import { assertWorkplaceExists, hydrateMemberships } from '@/lib/workplace/server';
import { currentMembershipId, workplaceKey } from '@/lib/workplace/keys';

const assignSchema = z.object({
    type: z.enum(['STORE', 'OFFICE', 'CENTRAL']),
    workplaceId: z.string().trim().min(1).max(256),
    effectiveFrom: z.string().datetime().optional(),
    makePrimary: z.boolean().optional(),
}).strict();

const updateSchema = z.object({
    membershipId: z.string().trim().min(1),
    action: z.enum(['END', 'SET_PRIMARY']),
    effectiveAt: z.string().datetime().optional(),
}).strict();

async function getTargetUser(caller: Awaited<ReturnType<typeof requireWorkplaceCaller>>, uid: string) {
    const snapshot = await caller.db.collection('users').doc(uid).get();
    if (!snapshot.exists) throw new WorkplaceAccessError('Không tìm thấy tài khoản.', 404);
    return { uid, ...snapshot.data() } as UserDoc;
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ uid: string }> }) {
    try {
        const caller = await requireWorkplaceCaller(req);
        const { uid } = await params;
        if (caller.uid !== uid) assertPermission(caller, 'page.hr.users');
        const user = await getTargetUser(caller, uid);
        if (caller.uid !== uid) await assertUserInWorkplaceScope(caller, user);
        return NextResponse.json(await hydrateMemberships(caller.db, user), {
            headers: { 'Cache-Control': 'no-store' },
        });
    } catch (error) {
        return workplaceAccessResponse(error)
            ?? NextResponse.json({ error: 'Không thể tải nơi làm việc.' }, { status: 500 });
    }
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ uid: string }> }) {
    try {
        const caller = await requireWorkplaceCaller(req);
        assertPermission(caller, 'action.hr.workplaces.assign');
        const { uid } = await params;
        if (!caller.isAdmin) await assertUserInWorkplaceScope(caller, await getTargetUser(caller, uid));
        const input = assignSchema.parse(await req.json());
        await assertWorkplaceScope(caller, input.type, input.workplaceId);
        const key = workplaceKey(input.type, input.workplaceId);
        await assertWorkplaceExists(caller.db, key);
        const now = new Date().toISOString();
        const effectiveFrom = input.effectiveFrom || now;
        const targetRef = caller.db.collection('users').doc(uid);
        const headId = currentMembershipId(uid, key);
        const headRef = caller.db.collection('workplace_membership_heads').doc(headId);

        const membershipId = await caller.db.runTransaction(async transaction => {
            const [targetSnapshot, headSnapshot] = await transaction.getAll(targetRef, headRef);
            if (!targetSnapshot.exists) throw new WorkplaceAccessError('Không tìm thấy tài khoản.', 404);
            const target = { uid, ...targetSnapshot.data() } as UserDoc;
            const activeMembershipId = headSnapshot.data()?.activeMembershipId as string | undefined;
            const activeSnapshot = activeMembershipId
                ? await transaction.get(caller.db.collection('workplace_memberships').doc(activeMembershipId))
                : null;

            if (activeSnapshot?.exists && activeSnapshot.data()?.status === 'ACTIVE') {
                return activeMembershipId!;
            }

            if (target.workplaceSchemaVersion !== 2) {
                const legacy: Array<[WorkplaceType, string | undefined]> = [
                    ['STORE', target.storeId], ['OFFICE', target.officeId], ['CENTRAL', target.warehouseId],
                ];
                let matchingLegacyMembershipId = '';
                for (const [legacyType, legacyId] of legacy) {
                    if (!legacyId) continue;
                    const legacyKey = workplaceKey(legacyType, legacyId);
                    const legacyHeadId = currentMembershipId(uid, legacyKey);
                    const legacyMembershipId = `${legacyHeadId}__v1`;
                    const legacyMembership: WorkplaceMembership = {
                        id: legacyMembershipId,
                        userId: uid,
                        workplace: { type: legacyType, id: legacyId, key: legacyKey },
                        status: 'ACTIVE',
                        effectiveFrom: target.createdAt || now,
                        effectiveTo: null,
                        version: 1,
                        createdAt: target.createdAt || now,
                        createdBy: 'migration-on-write',
                        updatedAt: now,
                        updatedBy: caller.uid,
                    };
                    transaction.set(caller.db.collection('workplace_memberships').doc(legacyMembershipId), legacyMembership, { merge: true });
                    transaction.set(caller.db.collection('workplace_membership_heads').doc(legacyHeadId), {
                        userId: uid, workplaceKey: legacyKey, activeMembershipId: legacyMembershipId, updatedAt: now,
                    }, { merge: true });
                    if (legacyKey === key) matchingLegacyMembershipId = legacyMembershipId;
                }
                if (matchingLegacyMembershipId) {
                    transaction.update(targetRef, {
                        workplaceSchemaVersion: 2,
                        primaryWorkplaceKey: input.makePrimary || !target.primaryWorkplaceKey
                            ? key
                            : target.primaryWorkplaceKey,
                        updatedAt: now,
                    });
                    return matchingLegacyMembershipId;
                }
            }

            const nextId = `${headId}__${Date.now().toString(36)}`;
            const membership: WorkplaceMembership = {
                id: nextId,
                userId: uid,
                workplace: { type: input.type, id: input.workplaceId, key },
                status: 'ACTIVE',
                effectiveFrom,
                effectiveTo: null,
                version: 2,
                createdAt: now,
                createdBy: caller.uid,
                updatedAt: now,
                updatedBy: caller.uid,
            };
            transaction.create(caller.db.collection('workplace_memberships').doc(nextId), membership);
            transaction.set(headRef, { userId: uid, workplaceKey: key, activeMembershipId: nextId, updatedAt: now });
            const userUpdate: Record<string, unknown> = { workplaceSchemaVersion: 2, updatedAt: now };
            if (input.makePrimary || !target.primaryWorkplaceKey) userUpdate.primaryWorkplaceKey = key;
            transaction.update(targetRef, userUpdate);
            transaction.create(caller.db.collection('workplace_audit_logs').doc(), {
                action: 'ASSIGN', actorUid: caller.uid, targetUid: uid, workplaceKey: key,
                membershipId: nextId, occurredAt: now,
            });
            return nextId;
        });
        return NextResponse.json({ success: true, membershipId }, { status: 201 });
    } catch (error) {
        if (error instanceof z.ZodError) return NextResponse.json({ error: 'Dữ liệu nơi làm việc không hợp lệ.' }, { status: 400 });
        return workplaceAccessResponse(error)
            ?? NextResponse.json({ error: error instanceof Error ? error.message : 'Không thể gán nơi làm việc.' }, { status: 500 });
    }
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ uid: string }> }) {
    try {
        const caller = await requireWorkplaceCaller(req);
        const { uid } = await params;
        const input = updateSchema.parse(await req.json());
        const membershipRef = caller.db.collection('workplace_memberships').doc(input.membershipId);
        const membershipSnapshot = await membershipRef.get();
        if (!membershipSnapshot.exists) throw new WorkplaceAccessError('Không tìm thấy quan hệ nơi làm việc.', 404);
        const membership = { id: membershipSnapshot.id, ...membershipSnapshot.data() } as WorkplaceMembership;
        if (membership.userId !== uid) throw new WorkplaceAccessError('Quan hệ nơi làm việc không thuộc tài khoản này.', 400);
        assertPermission(caller, input.action === 'SET_PRIMARY'
            ? 'action.hr.workplaces.set_primary'
            : 'action.hr.workplaces.end');
        await assertWorkplaceScope(caller, membership.workplace.type, membership.workplace.id);
        const now = new Date().toISOString();
        const effectiveAt = input.effectiveAt || now;
        const userRef = caller.db.collection('users').doc(uid);
        const headRef = caller.db.collection('workplace_membership_heads')
            .doc(currentMembershipId(uid, membership.workplace.key));

        await caller.db.runTransaction(async transaction => {
            const [fresh, userSnapshot] = await transaction.getAll(membershipRef, userRef);
            if (!fresh.exists) throw new WorkplaceAccessError('Không tìm thấy quan hệ nơi làm việc.', 404);
            if (input.action === 'SET_PRIMARY') {
                if (fresh.data()?.status !== 'ACTIVE') throw new WorkplaceAccessError('Chỉ có thể đặt nơi đang hoạt động làm nơi chính.', 409);
                transaction.update(userRef, { primaryWorkplaceKey: membership.workplace.key, updatedAt: now });
            } else {
                const nextStatus = 'ENDED';
                transaction.update(membershipRef, {
                    status: nextStatus,
                    effectiveTo: nextStatus === 'ENDED' ? effectiveAt : null,
                    updatedAt: now,
                    updatedBy: caller.uid,
                });
                transaction.set(headRef, {
                    userId: uid,
                    workplaceKey: membership.workplace.key,
                    activeMembershipId: null,
                    updatedAt: now,
                }, { merge: true });
                if (userSnapshot.data()?.primaryWorkplaceKey === membership.workplace.key) {
                    transaction.update(userRef, { primaryWorkplaceKey: null, updatedAt: now });
                }
            }
            transaction.create(caller.db.collection('workplace_audit_logs').doc(), {
                action: input.action, actorUid: caller.uid, targetUid: uid,
                workplaceKey: membership.workplace.key, membershipId: input.membershipId, occurredAt: now,
            });
        });
        return NextResponse.json({ success: true });
    } catch (error) {
        if (error instanceof z.ZodError) return NextResponse.json({ error: 'Dữ liệu cập nhật không hợp lệ.' }, { status: 400 });
        return workplaceAccessResponse(error)
            ?? NextResponse.json({ error: error instanceof Error ? error.message : 'Không thể cập nhật nơi làm việc.' }, { status: 500 });
    }
}
