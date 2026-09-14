import { FieldPath } from 'firebase-admin/firestore';
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import type { ScheduleDoc, StoreDoc, UserDoc, WeeklyRegistration, WorkplaceMembership, WorkplaceType } from '@/types';
import { requireWorkplaceCaller, WorkplaceAccessError, workplaceAccessResponse } from '@/lib/workplace/access';
import { currentMembershipId, scheduleId, weeklyRegistrationId, workplaceKey } from '@/lib/workplace/keys';
import { allocationFromSnapshot, allocationRef, shiftTouchesDates, writeAllocation } from '@/lib/scheduling/server';

const inputSchema = z.object({
    phase: z.enum(['USERS', 'REGISTRATIONS', 'SCHEDULES']),
    dryRun: z.boolean().default(true),
    cursor: z.string().optional(),
    limit: z.number().int().min(1).max(50).default(25),
}).strict();

function pageQuery(caller: Awaited<ReturnType<typeof requireWorkplaceCaller>>, collection: string, cursor: string | undefined, limit: number) {
    let query: FirebaseFirestore.Query = caller.db.collection(collection).orderBy(FieldPath.documentId()).limit(limit);
    if (cursor) query = query.startAfter(cursor);
    return query;
}

async function migrateUser(caller: Awaited<ReturnType<typeof requireWorkplaceCaller>>, doc: FirebaseFirestore.QueryDocumentSnapshot) {
    const user = { uid: doc.id, ...doc.data() } as UserDoc;
    if (user.workplaceSchemaVersion === 2) return 'SKIPPED';
    const locations: Array<[WorkplaceType, string | undefined]> = [
        ['STORE', user.storeId], ['OFFICE', user.officeId], ['CENTRAL', user.warehouseId],
    ];
    const values = locations.filter((item): item is [WorkplaceType, string] => Boolean(item[1]));
    const now = new Date().toISOString();
    await caller.db.runTransaction(async transaction => {
        for (const [type, id] of values) {
            const key = workplaceKey(type, id); const headId = currentMembershipId(user.uid, key);
            const membershipId = `${headId}__v1`;
            const membership: WorkplaceMembership = {
                id: membershipId, userId: user.uid, workplace: { type, id, key }, status: 'ACTIVE',
                effectiveFrom: user.createdAt || now, effectiveTo: null, version: 1,
                createdAt: user.createdAt || now, createdBy: 'migration', updatedAt: now, updatedBy: caller.uid,
            };
            transaction.set(caller.db.collection('workplace_memberships').doc(membershipId), membership, { merge: true });
            transaction.set(caller.db.collection('workplace_membership_heads').doc(headId), {
                userId: user.uid, workplaceKey: key, activeMembershipId: membershipId, updatedAt: now,
            }, { merge: true });
        }
        transaction.update(doc.ref, {
            workplaceSchemaVersion: 2,
            primaryWorkplaceKey: user.primaryWorkplaceKey || (values[0] ? workplaceKey(values[0][0], values[0][1]) : null),
            updatedAt: now,
        });
    });
    return 'MIGRATED';
}

async function migrateRegistration(caller: Awaited<ReturnType<typeof requireWorkplaceCaller>>, doc: FirebaseFirestore.QueryDocumentSnapshot) {
    const value = { id: doc.id, ...doc.data() } as WeeklyRegistration;
    if (!value.userId || !value.storeId || !value.weekStartDate) return 'INVALID';
    const targetId = weeklyRegistrationId(value.userId, value.storeId, value.weekStartDate);
    if (doc.id === targetId && value.schemaVersion === 2) return 'SKIPPED';
    const targetRef = caller.db.collection('weekly_registrations').doc(targetId);
    const storeSnapshot = await caller.db.collection('stores').doc(value.storeId).get();
    const store = { id: storeSnapshot.id, ...storeSnapshot.data() } as StoreDoc;
    const dates = [...new Set((value.shifts || []).flatMap(item => shiftTouchesDates(store, item.date, item.shiftId)))];
    const dayRefs = dates.map(date => allocationRef(caller.db, value.userId, date));
    return caller.db.runTransaction(async transaction => {
        const [target, ...days] = await Promise.all([transaction.get(targetRef), ...dayRefs.map(ref => transaction.get(ref))]);
        if (target.exists && target.id !== doc.id) return 'CONFLICT';
        days.forEach((snapshot, index) => {
            const allocation = allocationFromSnapshot(snapshot, value.userId, dates[index], value.storeId);
            writeAllocation(transaction, dayRefs[index], {
                ...allocation, registrationIds: [...new Set([...(allocation.registrationIds || []).filter(id => id !== doc.id), targetId])],
            });
        });
        transaction.set(targetRef, { ...value, id: targetId, schemaVersion: 2, revision: value.revision || 1 });
        if (doc.id !== targetId) transaction.delete(doc.ref);
        return 'MIGRATED';
    });
}

async function migrateSchedule(caller: Awaited<ReturnType<typeof requireWorkplaceCaller>>, doc: FirebaseFirestore.QueryDocumentSnapshot) {
    const value = { id: doc.id, ...doc.data() } as ScheduleDoc;
    if (!value.storeId || !value.date || !value.shiftId || !value.counterId) return 'INVALID';
    const targetId = scheduleId(value.storeId, value.date, value.shiftId, value.counterId);
    if (doc.id === targetId && (doc.data().schemaVersion === 2)) return 'SKIPPED';
    const targetRef = caller.db.collection('schedules').doc(targetId);
    const storeSnapshot = await caller.db.collection('stores').doc(value.storeId).get();
    const store = { id: storeSnapshot.id, ...storeSnapshot.data() } as StoreDoc;
    const heldDates = shiftTouchesDates(store, value.date, value.shiftId);
    const employeeDays = [...new Set(value.employeeIds || [])].flatMap(uid => heldDates.map(date => ({ uid, date })));
    const dayRefs = employeeDays.map(item => allocationRef(caller.db, item.uid, item.date));
    return caller.db.runTransaction(async transaction => {
        const [target, ...days] = await Promise.all([transaction.get(targetRef), ...dayRefs.map(ref => transaction.get(ref))]);
        if (target.exists && target.id !== doc.id) return 'CONFLICT';
        days.forEach((snapshot, index) => {
            const allocation = allocationFromSnapshot(snapshot, employeeDays[index].uid, employeeDays[index].date, value.storeId);
            writeAllocation(transaction, dayRefs[index], {
                ...allocation, scheduleIds: [...new Set([...(allocation.scheduleIds || []).filter(id => id !== doc.id), targetId])],
            });
        });
        transaction.set(targetRef, { ...value, id: targetId, schemaVersion: 2 });
        if (doc.id !== targetId) transaction.delete(doc.ref);
        return 'MIGRATED';
    });
}

export async function POST(req: NextRequest) {
    try {
        const caller = await requireWorkplaceCaller(req);
        if (!caller.isAdmin) throw new WorkplaceAccessError('Chỉ quản trị viên được chạy migration.', 403);
        const input = inputSchema.parse(await req.json());
        const collection = input.phase === 'USERS' ? 'users' : input.phase === 'REGISTRATIONS' ? 'weekly_registrations' : 'schedules';
        const snapshot = await pageQuery(caller, collection, input.cursor, input.limit).get();
        const result = { scanned: snapshot.size, migrated: 0, skipped: 0, conflicts: 0, invalid: 0 };
        if (!input.dryRun) {
            for (const doc of snapshot.docs) {
                const status = input.phase === 'USERS' ? await migrateUser(caller, doc)
                    : input.phase === 'REGISTRATIONS' ? await migrateRegistration(caller, doc)
                        : await migrateSchedule(caller, doc);
                if (status === 'MIGRATED') result.migrated += 1;
                else if (status === 'CONFLICT') result.conflicts += 1;
                else if (status === 'INVALID') result.invalid += 1;
                else result.skipped += 1;
            }
        }
        return NextResponse.json({
            phase: input.phase, dryRun: input.dryRun, ...result,
            nextCursor: snapshot.size === input.limit ? snapshot.docs.at(-1)?.id || null : null,
        });
    } catch (error) {
        if (error instanceof z.ZodError) return NextResponse.json({ error: 'Tham số migration không hợp lệ.' }, { status: 400 });
        return workplaceAccessResponse(error) ?? NextResponse.json({ error: error instanceof Error ? error.message : 'Migration thất bại.' }, { status: 500 });
    }
}
