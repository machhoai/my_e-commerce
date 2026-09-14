import test from 'node:test';
import assert from 'node:assert/strict';
import { canManageHr } from '../../lib/hr-access.ts';

function fakeDb(roles) {
    return {
        collection: () => ({
            doc: (id) => ({
                get: async () => ({
                    exists: Object.hasOwn(roles, id),
                    data: () => ({ permissions: roles[id] }),
                }),
            }),
        }),
    };
}

test('accepts the new HR permission from a custom role', async () => {
    const allowed = await canManageHr(
        fakeDb({ hr_manager: ['action.hr.manage'] }),
        { role: 'employee', customRoleId: 'hr_manager' },
    );

    assert.equal(allowed, true);
});

test('loads permissions from the system role when no custom role is assigned', async () => {
    const allowed = await canManageHr(
        fakeDb({ manager: ['action.hr.manage'] }),
        { role: 'manager' },
    );

    assert.equal(allowed, true);
});

test('keeps the legacy canManageHR flag compatible', async () => {
    assert.equal(await canManageHr(fakeDb({}), { role: 'manager', canManageHR: true }), true);
});

test('rejects users without an HR management grant', async () => {
    const allowed = await canManageHr(
        fakeDb({ manager: ['page.hr.users'] }),
        { role: 'manager' },
    );

    assert.equal(allowed, false);
});
