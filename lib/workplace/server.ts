import 'server-only';

import type { DocumentData, Firestore } from 'firebase-admin/firestore';
import type {
    OfficeDoc,
    UserDoc,
    UserWorkplace,
    WorkplaceMembership,
    WorkplaceType,
} from '@/types';
import { currentMembershipId, parseWorkplaceKey, workplaceKey } from './keys';

export const WORKPLACE_COLLECTIONS: Record<WorkplaceType, string> = {
    STORE: 'stores',
    OFFICE: 'offices',
    CENTRAL: 'warehouses',
};

function legacyMemberships(user: UserDoc): WorkplaceMembership[] {
    if (user.workplaceSchemaVersion === 2) return [];
    const now = user.createdAt || new Date(0).toISOString();
    const values: Array<[WorkplaceType, string | undefined]> = [
        ['STORE', user.storeId],
        ['OFFICE', user.officeId],
        ['CENTRAL', user.warehouseId],
    ];
    return values.flatMap(([type, id]) => {
        if (!id) return [];
        const key = workplaceKey(type, id);
        return [{
            id: currentMembershipId(user.uid, key),
            userId: user.uid,
            workplace: { type, id, key },
            status: 'ACTIVE' as const,
            effectiveFrom: now,
            effectiveTo: null,
            version: 1,
            createdAt: now,
            createdBy: 'legacy',
            updatedAt: now,
            updatedBy: 'legacy',
        }];
    });
}

export function membershipIsEffective(
    membership: Pick<WorkplaceMembership, 'status' | 'effectiveFrom' | 'effectiveTo'>,
    at = new Date(),
): boolean {
    const instant = at.getTime();
    return membership.status === 'ACTIVE'
        && new Date(membership.effectiveFrom).getTime() <= instant
        && (!membership.effectiveTo || instant < new Date(membership.effectiveTo).getTime());
}

export async function getUserMemberships(
    db: Firestore,
    user: UserDoc,
    options: { includeInactive?: boolean; at?: Date } = {},
): Promise<WorkplaceMembership[]> {
    let memberships: WorkplaceMembership[] = [];
    if (user.workplaceSchemaVersion === 2) {
        const snapshot = await db.collection('workplace_memberships').where('userId', '==', user.uid).get();
        memberships = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as WorkplaceMembership));
    } else {
        memberships = legacyMemberships(user);
    }
    return options.includeInactive
        ? memberships
        : memberships.filter(membership => membershipIsEffective(membership, options.at));
}

export async function getUserStoreIds(db: Firestore, user: UserDoc, at = new Date()): Promise<string[]> {
    return [...new Set((await getUserMemberships(db, user, { at }))
        .filter(item => item.workplace.type === 'STORE')
        .map(item => item.workplace.id))];
}

/** Adds every active workplace membership to user records used by HR list screens. */
export async function hydrateUserWorkplaces(db: Firestore, users: UserDoc[], at = new Date()): Promise<UserDoc[]> {
    const workplacesByUser = new Map<string, Map<string, { type: WorkplaceType; id: string }>>();
    for (const user of users) {
        const assignments = new Map<string, { type: WorkplaceType; id: string }>();
        if (user.workplaceSchemaVersion !== 2) {
            const legacy: Array<[WorkplaceType, string | undefined]> = [
                ['STORE', user.storeId], ['OFFICE', user.officeId], ['CENTRAL', user.warehouseId],
            ];
            for (const [type, id] of legacy) {
                if (id) assignments.set(workplaceKey(type, id), { type, id });
            }
        }
        workplacesByUser.set(user.uid, assignments);
    }

    const versionTwoIds = users.filter(user => user.workplaceSchemaVersion === 2).map(user => user.uid);
    const chunks: string[][] = [];
    for (let index = 0; index < versionTwoIds.length; index += 30) {
        chunks.push(versionTwoIds.slice(index, index + 30));
    }
    const snapshots = await Promise.all(chunks.map(chunk => db.collection('workplace_memberships')
        .where('userId', 'in', chunk)
        .get()));
    for (const snapshot of snapshots) {
        for (const document of snapshot.docs) {
            const membership = { id: document.id, ...document.data() } as WorkplaceMembership;
            if (membershipIsEffective(membership, at)) {
                const { type, id } = membership.workplace;
                workplacesByUser.get(membership.userId)?.set(workplaceKey(type, id), { type, id });
            }
        }
    }

    const distinctWorkplaces = new Map<string, { type: WorkplaceType; id: string }>();
    for (const assignments of workplacesByUser.values()) {
        for (const [key, assignment] of assignments) distinctWorkplaces.set(key, assignment);
    }
    const names = new Map<string, string>();
    const locations = [...distinctWorkplaces.entries()];
    for (let index = 0; index < locations.length; index += 100) {
        const batch = locations.slice(index, index + 100);
        const docs = await db.getAll(...batch.map(([, { type, id }]) => db.collection(WORKPLACE_COLLECTIONS[type]).doc(id)));
        docs.forEach((doc, index) => {
            const name = doc.data()?.name;
            names.set(batch[index][0], typeof name === 'string' && name ? name : batch[index][1].id);
        });
    }

    return users.map(user => {
        const assignments = [...(workplacesByUser.get(user.uid) || new Map()).entries()]
            .map(([key, { type, id }]) => ({ type, id, name: names.get(key) || id }));
        return {
            ...user,
            storeIds: assignments.filter(item => item.type === 'STORE').map(item => item.id),
            workplaceAssignments: assignments,
        };
    });
}

export async function getStoreUsers(db: Firestore, storeId: string, at = new Date()): Promise<UserDoc[]> {
    const key = workplaceKey('STORE', storeId);
    const [memberships, legacyUsers] = await Promise.all([
        db.collection('workplace_memberships')
            .where('workplace.key', '==', key)
            .get(),
        db.collection('users').where('storeId', '==', storeId).get(),
    ]);
    const membershipByUid = new Map<string, WorkplaceMembership>();
    for (const doc of memberships.docs) {
        const membership = { id: doc.id, ...doc.data() } as WorkplaceMembership;
        if (membershipIsEffective(membership, at)) membershipByUid.set(membership.userId, membership);
    }
    const userIds = [...membershipByUid.keys()];
    const v2Users = userIds.length
        ? await db.getAll(...userIds.map(uid => db.collection('users').doc(uid)))
        : [];
    const users = new Map<string, UserDoc>();
    for (const snapshot of v2Users) {
        if (snapshot.exists) users.set(snapshot.id, { uid: snapshot.id, ...snapshot.data() } as UserDoc);
    }
    for (const snapshot of legacyUsers.docs) {
        const user = { uid: snapshot.id, ...snapshot.data() } as UserDoc;
        if (user.workplaceSchemaVersion !== 2) users.set(user.uid, user);
    }
    return [...users.values()];
}

export async function getWorkplaceUsers(db: Firestore, type: WorkplaceType, id: string, at = new Date()): Promise<UserDoc[]> {
    if (type === 'STORE') return getStoreUsers(db, id, at);
    const key = workplaceKey(type, id);
    const legacyField = type === 'OFFICE' ? 'officeId' : 'warehouseId';
    const [memberships, legacyUsers] = await Promise.all([
        db.collection('workplace_memberships').where('workplace.key', '==', key).get(),
        db.collection('users').where(legacyField, '==', id).get(),
    ]);
    const ids = [...new Set(memberships.docs
        .map(doc => ({ id: doc.id, ...doc.data() } as WorkplaceMembership))
        .filter(item => membershipIsEffective(item, at)).map(item => item.userId))];
    const snapshots = ids.length ? await db.getAll(...ids.map(uid => db.collection('users').doc(uid))) : [];
    const users = new Map<string, UserDoc>();
    snapshots.forEach(snapshot => { if (snapshot.exists) users.set(snapshot.id, { uid: snapshot.id, ...snapshot.data() } as UserDoc); });
    legacyUsers.docs.forEach(snapshot => {
        const user = { uid: snapshot.id, ...snapshot.data() } as UserDoc;
        if (user.workplaceSchemaVersion !== 2) users.set(user.uid, user);
    });
    return [...users.values()];
}

export async function getUserOfficeIds(db: Firestore, user: UserDoc, at = new Date()): Promise<string[]> {
    return [...new Set((await getUserMemberships(db, user, { at }))
        .filter(item => item.workplace.type === 'OFFICE')
        .map(item => item.workplace.id))];
}

export async function getManagedStoreIds(db: Firestore, user: UserDoc): Promise<Set<string>> {
    const directStoreIds = await getUserStoreIds(db, user);
    const officeIds = await getUserOfficeIds(db, user);
    const managed = new Set(directStoreIds);
    if (officeIds.length) {
        const snapshots = await db.getAll(...officeIds.map(id => db.collection('offices').doc(id)));
        for (const snapshot of snapshots) {
            if (!snapshot.exists) continue;
            const office = snapshot.data() as OfficeDoc;
            for (const storeId of office.managedStoreIds || []) managed.add(storeId);
        }
    }
    return managed;
}

export async function userHasWorkplace(
    db: Firestore,
    user: UserDoc,
    type: WorkplaceType,
    id: string,
    at = new Date(),
): Promise<boolean> {
    return (await getUserMemberships(db, user, { at }))
        .some(item => item.workplace.type === type && item.workplace.id === id);
}

export async function hydrateMemberships(db: Firestore, user: UserDoc): Promise<UserWorkplace[]> {
    const memberships = await getUserMemberships(db, user, { includeInactive: true });
    const docs = await Promise.all(memberships.map(item =>
        db.collection(WORKPLACE_COLLECTIONS[item.workplace.type]).doc(item.workplace.id).get(),
    ));
    return memberships.map((membership, index) => {
        const data: DocumentData = docs[index].data() || {};
        return {
            ...membership,
            name: data.name || membership.workplace.id,
            address: data.address,
            isActive: docs[index].exists && data.isActive !== false,
            isEffective: membershipIsEffective(membership),
            isPrimary: user.primaryWorkplaceKey === membership.workplace.key,
        };
    });
}

export async function assertWorkplaceExists(db: Firestore, key: string) {
    const parsed = parseWorkplaceKey(key);
    if (!parsed) throw new Error('Mã nơi làm việc không hợp lệ.');
    const snapshot = await db.collection(WORKPLACE_COLLECTIONS[parsed.type]).doc(parsed.id).get();
    if (!snapshot.exists || snapshot.data()?.isActive === false) {
        throw new Error('Nơi làm việc không tồn tại hoặc đã ngừng hoạt động.');
    }
    return parsed;
}
