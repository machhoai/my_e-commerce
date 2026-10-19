import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { createHash } from 'node:crypto';
import { runInNewContext } from 'node:vm';
import ts from 'typescript';

const nodeRequire = createRequire(import.meta.url);

// Execute the real service with an isolated clock and in-memory Firestore.
// No Firebase credentials or live database are involved.
function loadModule(path, dependencies = {}, Clock = Date) {
    const cjsModule = { exports: {} };
    const compiled = ts.transpileModule(readFileSync(new URL(`../../${path}`, import.meta.url), 'utf8'), {
        compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
    }).outputText;
    runInNewContext(compiled, {
        module: cjsModule, exports: cjsModule.exports, Date: Clock, Intl,
        require: (name) => {
            if (Object.hasOwn(dependencies, name)) return dependencies[name];
            if (name.startsWith('node:')) return nodeRequire(name);
            throw new Error(`Unexpected dependency: ${name}`);
        },
    });
    return cjsModule.exports;
}

const model = loadModule('lib/attendance/manager-model.ts');
const state = loadModule('lib/attendance/state.ts');
const gpsRules = loadModule('lib/attendance/gps.ts');
const policyRules = loadModule('lib/attendance/policy.ts', { './gps.ts': gpsRules });
const gps = { latitude: 10.8, longitude: 106.6, radiusM: 150, maxAccuracyM: 80, maxAgeSeconds: 120 };

function fixture(instant, method = 'GPS', options = {}) {
    let clock = Date.parse(instant);
    class Clock extends Date {
        constructor(...args) { super(...(args.length ? args : [clock])); }
        static now() { return clock; }
    }
    const documents = new Map();
    const writes = [];
    const dailyId = (date) => createHash('sha256').update(`store\0employee\0${date}`).digest('hex');
    documents.set('stores/store', { name: 'Test store' });
    documents.set('store_attendance_policies/store', {
        enabled: true, sourceMode: options.machine ? 'MACHINE' : 'SOFTWARE',
        requireCheckOut: true, verificationMethod: method, gps, allowedIpAddresses: ['203.0.113.10'],
    });
    documents.set('employee_day_allocations/2026-09-27', { storeId: 'store' });
    documents.set(`attendance_daily_states/${dailyId('2026-09-27')}`, {
        attendanceDate: '2026-09-27', checkInEventId: 'old-in', checkOutEventId: null,
    });
    documents.set('attendance_events/old-in', {
        id: 'old-in', eventType: 'CHECK_IN', occurredAt: options.checkInAt ?? '2026-09-27T07:22:38.812Z',
    });
    const snapshot = (ref) => ({ exists: documents.has(ref.path), data: () => documents.get(ref.path) });
    let eventCounter = 0;
    const db = {
        collection: (name) => ({ doc: (id = `new-event-${++eventCounter}`) => {
            const ref = { id, path: `${name}/${id}`, get: async () => snapshot(ref) };
            return ref;
        } }),
        getAll: async (...refs) => refs.map(snapshot),
        runTransaction: async (callback) => {
            if (options.crossDeadline) clock = Date.parse('2026-09-28T06:00:00+07:00');
            const pending = [];
            const transaction = {
                getAll: async (...refs) => refs.map(snapshot),
                get: async (ref) => snapshot(ref),
                create: (ref, data) => pending.push({ ref, data }),
                set: (ref, data) => pending.push({ ref, data }),
            };
            const result = await callback(transaction);
            for (const write of pending) documents.set(write.ref.path, write.data);
            writes.push(...pending);
            return result;
        },
    };
    const service = loadModule('lib/attendance/software-service.ts', {
        'server-only': {},
        '@/lib/attendance/access': {
            assertAttendancePermission: () => {},
            AttendanceAccessError: class extends Error {},
            requireAttendanceCaller: async () => ({ uid: 'employee', isAdmin: false, user: {} }),
        },
        '@/lib/attendance/policy': policyRules,
        '@/lib/attendance/request-ip': { getTrustedAttendanceRequestIp: () => options.ip || '203.0.113.10' },
        '@/lib/attendance/state': state,
        '@/lib/attendance/manager-model': model,
        '@/lib/firebase-admin': { getAdminDb: () => db },
        '@/lib/workplace/server': { getUserStoreIds: async () => ['store'], userHasWorkplace: async () => true },
        '@/lib/scheduling/server': {
            allocationRef: (_, uid, date) => db.collection('employee_day_allocations').doc(date),
            allocationFromSnapshot: () => ({ storeId: 'store' }),
            writeAllocation: () => {},
        },
    }, Clock);
    const req = { nextUrl: new URL('https://example.test/api/hr/attendance/context?storeId=store') };
    const punch = (eventType, location = {
        latitude: gps.latitude, longitude: gps.longitude, accuracyM: 10, capturedAt: instant,
    }, idempotencyKey = 'request') => service.punchSoftwareAttendance(req, { storeId: 'store', eventType, idempotencyKey, location });
    return { context: () => service.getSoftwareAttendanceContext(req), punch, writes,
        setTime: (instant) => { clock = Date.parse(instant); } };
}

test('GPS and IP checkout reject at 59.999 seconds and accept at exactly 60 seconds', async () => {
    for (const method of ['GPS', 'IP']) {
        const f = fixture('2026-09-27T07:23:38.811Z', method);
        assert.equal((await f.context()).checkOutAvailableAt, '2026-09-27T07:23:38.812Z');
        await assert.rejects(f.punch('CHECK_OUT'), { status: 409, reason: 'CHECK_OUT_TOO_SOON' });
        assert.equal(f.writes.length, 0);
        f.setTime('2026-09-27T07:23:38.812Z');
        assert.equal((await f.punch('CHECK_OUT')).event.occurredAt, '2026-09-27T07:23:38.812Z');
    }
});

test('check-in survives reload, blocks an immediate checkout, and retries do not duplicate events', async () => {
    const f = fixture('2026-09-28T08:00:00+07:00', 'IP');
    const checkIn = await f.punch('CHECK_IN', undefined, 'in');
    const writeCount = f.writes.length;
    const duplicate = await f.punch('CHECK_IN', undefined, 'in');
    assert.equal(duplicate.created, false);
    assert.equal(duplicate.event.id, checkIn.event.id);
    assert.equal(f.writes.length, writeCount);
    await assert.rejects(f.punch('CHECK_IN', undefined, 'another-in'), { reason: 'EVENT_SEQUENCE_CONFLICT' });
    const reloaded = await f.context();
    assert.equal(reloaded.nextEventType, 'CHECK_OUT');
    assert.equal(reloaded.checkOutAvailableAt, '2026-09-28T01:01:00.000Z');
    await assert.rejects(f.punch('CHECK_OUT', undefined, 'out'), { reason: 'CHECK_OUT_TOO_SOON' });
    assert.equal(f.writes.length, writeCount);
    f.setTime(reloaded.checkOutAvailableAt);
    await f.punch('CHECK_OUT', undefined, 'out');
    assert.equal((await f.context()).nextEventType, null);
});

test('missing or malformed check-in time cannot bypass the minimum checkout interval', async () => {
    for (const checkInAt of ['', 'invalid']) {
        const f = fixture('2026-09-27T08:00:00Z', 'IP', { checkInAt });
        await assert.rejects(f.punch('CHECK_OUT'), { reason: 'INVALID_CHECK_IN_TIME' });
        assert.equal(f.writes.length, 0);
    }
});

test('before 06:00 context and verified checkout both use the previous open session', async () => {
    for (const method of ['GPS', 'IP']) {
        const f = fixture('2026-09-28T05:59:59.999+07:00', method);
        const context = await f.context();
        assert.equal(context.attendanceDate, '2026-09-27');
        assert.equal(context.nextEventType, 'CHECK_OUT');
        const result = await f.punch('CHECK_OUT');
        assert.equal(result.event.attendanceDate, '2026-09-27');
        assert.equal(result.event.method, method);
    }
});

test('at and after 06:00 old checkout is rejected while today check-in is allowed', async () => {
    for (const instant of ['2026-09-28T06:00:00+07:00', '2026-09-28T15:52:56+07:00']) {
        const f = fixture(instant);
        const context = await f.context();
        assert.equal(context.attendanceDate, '2026-09-28');
        assert.equal(context.nextEventType, 'CHECK_IN');
        await assert.rejects(f.punch('CHECK_OUT'), { reason: 'EVENT_SEQUENCE_CONFLICT' });
        assert.equal(f.writes.length, 0);
        assert.equal((await f.punch('CHECK_IN')).event.attendanceDate, '2026-09-28');
    }
});

test('checkout cannot bypass GPS/IP verification or use software under machine policy', async () => {
    const invalidGps = fixture('2026-09-28T05:00:00+07:00');
    await assert.rejects(invalidGps.punch('CHECK_OUT', {
        latitude: 0, longitude: 0, accuracyM: 10, capturedAt: '2026-09-28T05:00:00+07:00',
    }), { reason: 'OUTSIDE_GEOFENCE' });
    const invalidIp = fixture('2026-09-28T05:00:00+07:00', 'IP', { ip: '203.0.113.11' });
    await assert.rejects(invalidIp.punch('CHECK_OUT'), { reason: 'INVALID_IP' });
    const machine = fixture('2026-09-28T05:00:00+07:00', 'GPS', { machine: true });
    await assert.rejects(machine.punch('CHECK_OUT'), { reason: 'MACHINE_ONLY' });
    for (const f of [invalidGps, invalidIp, machine]) assert.equal(f.writes.length, 0);
});

test('transaction crossing 06:00 rejects checkout without writing an event', async () => {
    const f = fixture('2026-09-28T05:59:59.999+07:00', 'GPS', { crossDeadline: true });
    await assert.rejects(f.punch('CHECK_OUT'), { reason: 'CHECK_OUT_DEADLINE_EXCEEDED' });
    assert.equal(f.writes.length, 0);
});
