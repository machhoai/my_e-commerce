import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import ts from 'typescript';

const require = createRequire(import.meta.url);

// Load the real server functions with in-memory Firestore/auth dependencies.
function loadModule(relativePath, dependencies = {}) {
    const source = readFileSync(new URL(relativePath, import.meta.url), 'utf8');
    const { outputText } = ts.transpileModule(source, {
        compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
    });
    const loadedModule = { exports: {} };
    new Function('require', 'module', 'exports', outputText)(id => {
        if (id === 'server-only') return {};
        if (Object.hasOwn(dependencies, id)) return dependencies[id];
        return require(id);
    }, loadedModule, loadedModule.exports);
    return loadedModule.exports;
}

const keys = loadModule('../../lib/workplace/keys.ts');
const workplaces = loadModule('../../lib/workplace/server.ts', { './keys': keys });
const policy = loadModule('../../lib/attendance/policy.ts');
const state = loadModule('../../lib/attendance/state.ts');
const managerModel = loadModule('../../lib/attendance/manager-model.ts');
const permissions = loadModule('../../lib/attendance/permission.ts');

function fixture() {
    const employee = { uid: 'linh', name: 'Ngọc Linh', storeId: 'aeon', workplaceSchemaVersion: 2, isActive: true };
    const membership = (userId, storeId, overrides = {}) => ({
        userId, workplace: { type: 'STORE', id: storeId, key: keys.workplaceKey('STORE', storeId) },
        status: 'ACTIVE', effectiveFrom: '2020-01-01T00:00:00Z', effectiveTo: null, ...overrides,
    });
    const records = {
        users: { linh: employee, legacy: { uid: 'legacy', storeId: 'landmark', isActive: true },
            ended: { uid: 'ended', storeId: 'landmark', workplaceSchemaVersion: 2 },
            future: { uid: 'future', storeId: 'landmark', workplaceSchemaVersion: 2 } },
        workplace_memberships: {
            aeon: membership('linh', 'aeon'), landmark: membership('linh', 'landmark'),
            ended: membership('ended', 'landmark', { effectiveTo: '2021-01-01T00:00:00Z' }),
            future: membership('future', 'landmark', { effectiveFrom: '2999-01-01T00:00:00Z' }),
        },
        stores: { aeon: { name: 'AEON' }, landmark: { name: 'Landmark 81' } },
        store_attendance_policies: {
            aeon: { enabled: true, sourceMode: 'SOFTWARE', verificationMethod: 'GPS', requireCheckOut: true,
                gps: { latitude: 10, longitude: 106, radiusM: 150, maxAccuracyM: 80, maxAgeSeconds: 120 } },
            landmark: { enabled: true, sourceMode: 'MACHINE', verificationMethod: null, requireCheckOut: true },
        },
        attendance_daily_states: {}, employee_day_allocations: {},
    };
    const snapshot = (collection, id) => ({ id, exists: Object.hasOwn(records[collection] || {}, id), data: () => records[collection]?.[id] });
    const query = (collection, filters = []) => ({
        doc: id => ({ get: async () => snapshot(collection, id), collection, id }),
        where: (field, operator, value) => {
            assert.equal(operator, '==');
            return query(collection, [...filters, [field, value]]);
        },
        get: async () => ({ docs: Object.keys(records[collection] || {})
            .filter(id => filters.every(([field, value]) => field.split('.').reduce((data, key) => data?.[key], records[collection][id]) === value))
            .map(id => snapshot(collection, id)) }),
    });
    const db = { collection: collection => query(collection), getAll: async (...refs) => refs.map(ref => snapshot(ref.collection, ref.id)) };
    const caller = { uid: employee.uid, user: employee, isAdmin: false, permissions: new Set(['action.attendance.punch']) };
    const service = loadModule('../../lib/attendance/software-service.ts', {
        'node:crypto': require('node:crypto'),
        '@/lib/attendance/access': {
            requireAttendanceCaller: async () => caller,
            assertAttendancePermission: (identity, permission) => assert.ok(permissions.grantsAttendancePermission(identity.permissions, permission)),
            AttendanceAccessError: class extends Error {},
        },
        '@/lib/attendance/policy': policy, '@/lib/attendance/state': state,
        '@/lib/attendance/manager-model': managerModel,
        '@/lib/attendance/request-ip': { getTrustedAttendanceRequestIp: () => null },
        '@/lib/firebase-admin': { getAdminDb: () => db }, '@/lib/workplace/server': workplaces,
        '@/lib/scheduling/server': { allocationRef: (database, uid, date) => database.collection('employee_day_allocations').doc(keys.employeeDayAllocationId(uid, date)) },
    });
    const contextFor = storeId => service.getSoftwareAttendanceContext({ nextUrl: new URL(`https://example.test/api/hr/attendance/context?storeId=${storeId}`) });
    return { employee, records, db, service, contextFor };
}

test('mapping roster includes secondary memberships and legacy users, excludes ended and future memberships', async () => {
    const { db } = fixture();
    const roster = await workplaces.getStoreUsers(db, 'landmark');
    assert.deepEqual(roster.map(user => user.uid).sort(), ['legacy', 'linh']);
    assert.equal(roster.find(user => user.uid === 'linh').storeId, 'aeon');
});

test('the same employee receives the selected store attendance method in either membership', async () => {
    const { contextFor } = fixture();
    const gps = await contextFor('aeon');
    assert.equal(gps.store.id, 'aeon');
    assert.equal(gps.canPunch, true);
    assert.equal(gps.locationRequired, true);
    assert.equal(gps.policy.verificationMethod, 'GPS');
    const machine = await contextFor('landmark');
    assert.equal(machine.store.id, 'landmark');
    assert.equal(machine.reason, 'MACHINE_ONLY');
    assert.equal(machine.policy.sourceMode, 'MACHINE');
    assert.equal(machine.canPunch, false);
});

test('an employee cannot request attendance at a store outside their effective memberships', async () => {
    const { contextFor, service } = fixture();
    await assert.rejects(contextFor('unrelated'), error => error instanceof service.AttendanceServiceError
        && error.status === 403 && error.reason === 'STORE_ACCESS_DENIED');
});

test('ended memberships cannot authorize attendance even when the legacy primary store still points there', async () => {
    const { records, contextFor, service } = fixture();
    records.workplace_memberships.aeon.status = 'ENDED';
    await assert.rejects(contextFor('aeon'), error => error instanceof service.AttendanceServiceError
        && error.reason === 'STORE_ACCESS_DENIED');
});

test('a day assigned to another store retains its attendance policy', async () => {
    const { records, contextFor } = fixture();
    records.employee_day_allocations[keys.employeeDayAllocationId('linh', state.vietnamAttendanceDate())] = { storeId: 'landmark' };
    const context = await contextFor('aeon');
    assert.equal(context.store.id, 'landmark');
    assert.equal(context.reason, 'MACHINE_ONLY');
});
