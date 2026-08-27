import assert from 'node:assert/strict';
import test from 'node:test';
// @ts-expect-error Node's strip-types test runner requires the explicit .ts extension.
import { distanceInMeters, evaluateGpsVerification, evaluateIpVerification, normalizeIpAddress } from '../../lib/attendance/policy.ts';
// @ts-expect-error Node's strip-types test runner requires the explicit .ts extension.
import { attendancePolicyInputSchema } from '../../lib/attendance/policy-schema.ts';
// @ts-expect-error Node's strip-types test runner requires the explicit .ts extension.
import { getNextAttendanceEventType, isAttendanceEventExpected, vietnamAttendanceDate } from '../../lib/attendance/state.ts';
// @ts-expect-error Node's strip-types test runner requires the explicit .ts extension.
import { parseAttendanceRange, resolveAcceptedAttendanceTimes, selectAttendanceRosterUids } from '../../lib/attendance/manager-model.ts';
// @ts-expect-error Node's strip-types test runner requires the explicit .ts extension.
import { calculateAttendanceStatus } from '../../lib/attendance-rules.ts';
// @ts-expect-error Node's strip-types test runner requires the explicit .ts extension.
import { attendanceDeviceEventId, attendanceDeviceIdempotencyKey, attendanceMappingId, normalizeDeviceTimestamp } from '../../lib/attendance/device-model.ts';

const target = {
    latitude: 10.7769,
    longitude: 106.7009,
    radiusM: 150,
    maxAccuracyM: 80,
    maxAgeSeconds: 120,
};
const now = new Date('2026-08-21T03:00:00.000Z');

test('distanceInMeters returns zero for the same coordinate', () => {
    assert.equal(distanceInMeters(target, target), 0);
});

test('GPS accepts a fresh and accurate location inside the geofence', () => {
    const decision = evaluateGpsVerification(
        {
            latitude: 10.7772,
            longitude: 106.7011,
            accuracyM: 15,
            capturedAt: '2026-08-21T02:59:30.000Z',
        },
        target,
        now,
    );

    assert.equal(decision.accepted, true);
    assert.equal(decision.reason, null);
    assert.ok(decision.distanceM !== null && decision.distanceM < target.radiusM);
});

test('GPS rejects a location outside the configured radius', () => {
    const decision = evaluateGpsVerification(
        {
            latitude: 10.7869,
            longitude: 106.7109,
            accuracyM: 15,
            capturedAt: '2026-08-21T02:59:30.000Z',
        },
        target,
        now,
    );

    assert.equal(decision.accepted, false);
    assert.equal(decision.reason, 'OUTSIDE_GEOFENCE');
    assert.ok(decision.distanceM !== null && decision.distanceM > target.radiusM);
});

test('GPS rejects low-accuracy and stale captures', () => {
    const inaccurate = evaluateGpsVerification(
        {
            latitude: target.latitude,
            longitude: target.longitude,
            accuracyM: 120,
            capturedAt: '2026-08-21T02:59:30.000Z',
        },
        target,
        now,
    );
    const stale = evaluateGpsVerification(
        {
            latitude: target.latitude,
            longitude: target.longitude,
            accuracyM: 10,
            capturedAt: '2026-08-21T02:50:00.000Z',
        },
        target,
        now,
    );

    assert.equal(inaccurate.reason, 'GPS_ACCURACY_LOW');
    assert.equal(stale.reason, 'GPS_STALE');
});

test('IP verification normalizes IPv4-mapped IPv6 addresses', () => {
    assert.equal(normalizeIpAddress('::ffff:203.0.113.10'), '203.0.113.10');
    assert.equal(normalizeIpAddress('2001:0db8:0:0:0:0:0:1'), '2001:db8::1');
    const decision = evaluateIpVerification('::ffff:203.0.113.10', [
        '203.0.113.10',
        '198.51.100.8',
    ]);

    assert.equal(decision.accepted, true);
    assert.equal(decision.matchedIpAddress, '203.0.113.10');
});

test('IP verification rejects missing, malformed and unlisted addresses', () => {
    assert.equal(evaluateIpVerification(null, ['203.0.113.10']).reason, 'IP_REQUIRED');
    assert.equal(evaluateIpVerification('not-an-ip', ['203.0.113.10']).reason, 'IP_REQUIRED');
    assert.equal(evaluateIpVerification('203.0.113.11', ['203.0.113.10']).reason, 'INVALID_IP');
});

test('policy schema accepts GPS software configuration and rejects incomplete IP configuration', () => {
    const gpsPolicy = attendancePolicyInputSchema.safeParse({
        enabled: true,
        sourceMode: 'SOFTWARE',
        verificationMethod: 'GPS',
        allowedIpAddresses: [],
        gps: target,
        requireCheckOut: true,
    });
    const incompleteIpPolicy = attendancePolicyInputSchema.safeParse({
        enabled: true,
        sourceMode: 'SOFTWARE',
        verificationMethod: 'IP',
        allowedIpAddresses: [],
        gps: null,
        requireCheckOut: true,
    });

    assert.equal(gpsPolicy.success, true);
    assert.equal(incompleteIpPolicy.success, false);
});

test('policy schema keeps machine configuration separate from GPS/IP settings', () => {
    const invalidMachinePolicy = attendancePolicyInputSchema.safeParse({
        enabled: true,
        sourceMode: 'MACHINE',
        verificationMethod: 'IP',
        allowedIpAddresses: ['203.0.113.10'],
        gps: null,
        requireCheckOut: true,
    });

    assert.equal(invalidMachinePolicy.success, false);
});

test('daily attendance state enforces CHECK_IN then CHECK_OUT order', () => {
    const checkedInState = {
        id: 'state-1',
        storeId: 'store-1',
        employeeUid: 'user-1',
        attendanceDate: '2026-08-21',
        checkInEventId: 'event-in',
        checkOutEventId: null,
        updatedAt: '2026-08-21T01:00:00.000Z',
    };
    const completedState = { ...checkedInState, checkOutEventId: 'event-out' };

    assert.equal(getNextAttendanceEventType(null, true), 'CHECK_IN');
    assert.equal(getNextAttendanceEventType(checkedInState, true), 'CHECK_OUT');
    assert.equal(getNextAttendanceEventType(checkedInState, false), null);
    assert.equal(getNextAttendanceEventType(completedState, true), null);
    assert.equal(isAttendanceEventExpected('CHECK_IN', checkedInState, true), false);
    assert.equal(isAttendanceEventExpected('CHECK_OUT', checkedInState, true), true);
});

test('attendance date is calculated in Vietnam timezone', () => {
    assert.equal(vietnamAttendanceDate(new Date('2026-08-20T18:30:00.000Z')), '2026-08-21');
});

test('manager range validates real dates and resolves month end', () => {
    assert.deepEqual(parseAttendanceRange('2026-02-28', null), {
        startDate: '2026-02-28',
        endDate: '2026-02-28',
    });
    assert.deepEqual(parseAttendanceRange(null, '2024-02'), {
        startDate: '2024-02-01',
        endDate: '2024-02-29',
    });
    assert.equal(parseAttendanceRange('2026-02-31', null), null);
    assert.equal(parseAttendanceRange(null, '2026-13'), null);
});

test('scheduled roster takes priority while retaining unexpected punches', () => {
    assert.deepEqual(
        [...selectAttendanceRosterUids(['a', 'b', 'c'], ['b'], ['c'])].sort(),
        ['b', 'c'],
    );
    assert.deepEqual(
        [...selectAttendanceRosterUids(['a', 'b'], [], ['c'])].sort(),
        ['a', 'b', 'c'],
    );
});

test('unified daily times prefer explicit software events and otherwise use FILO', () => {
    assert.deepEqual(resolveAcceptedAttendanceTimes([
        { occurredAt: '2026-08-21T07:30:00', eventType: 'PUNCH', status: 'ACCEPTED' },
        { occurredAt: '2026-08-21T17:15:00', eventType: 'PUNCH', status: 'ACCEPTED' },
    ]), {
        checkIn: '2026-08-21T07:30:00',
        checkOut: '2026-08-21T17:15:00',
        acceptedCount: 2,
    });
    assert.deepEqual(resolveAcceptedAttendanceTimes([
        { occurredAt: '2026-08-21T06:00:00', eventType: 'PUNCH', status: 'REJECTED' },
        { occurredAt: '2026-08-21T08:00:00', eventType: 'CHECK_IN', status: 'ACCEPTED' },
        { occurredAt: '2026-08-21T17:00:00', eventType: 'CHECK_OUT', status: 'ACCEPTED' },
    ]), {
        checkIn: '2026-08-21T08:00:00',
        checkOut: '2026-08-21T17:00:00',
        acceptedCount: 2,
    });
});

test('calculation uses assigned shift before automatic shift detection', () => {
    const settings = {
        attendanceRules: {
            byShift: {
                Morning: {
                    defaultWeekday: { startTime: '08:00', endTime: '12:00', allowedEarlyMins: 0, allowedLateMins: 10 },
                    defaultWeekend: { startTime: '08:00', endTime: '12:00', allowedEarlyMins: 0, allowedLateMins: 10 },
                    specialDates: {},
                },
                Evening: {
                    defaultWeekday: { startTime: '16:00', endTime: '20:00', allowedEarlyMins: 0, allowedLateMins: 10 },
                    defaultWeekend: { startTime: '16:00', endTime: '20:00', allowedEarlyMins: 0, allowedLateMins: 10 },
                    specialDates: {},
                },
            },
        },
    };
    const result = calculateAttendanceStatus(
        '2026-08-21T15:55:00',
        '2026-08-21T20:05:00',
        '2026-08-21',
        settings,
        'Morning',
    );
    assert.equal(result.detectedShift, 'Morning');
    assert.equal(result.status, 'LATE');
});

test('device mapping and event IDs include the physical device identity', () => {
    assert.equal(attendanceMappingId('store-01-zk', '1001'), 'store-01-zk__1001');
    assert.notEqual(attendanceMappingId('store-01-zk', '1001'), attendanceMappingId('store-02-zk', '1001'));
    assert.notEqual(
        attendanceDeviceEventId('store-01-zk', '1001', '2026-08-21T01:00:00.000Z'),
        attendanceDeviceEventId('store-01-zk', '1001', '2026-08-21T10:00:00.000Z'),
    );
});

test('device timestamp is normalized from Vietnam local time to a stable ISO key', () => {
    const normalized = normalizeDeviceTimestamp('2026-08-21 08:30:22');
    assert.deepEqual(normalized, {
        occurredAt: '2026-08-21T01:30:22.000Z',
        attendanceDate: '2026-08-21',
    });
    assert.equal(
        attendanceDeviceIdempotencyKey('store-01-zk', '1001', normalized!.occurredAt),
        'store-01-zk|1001|2026-08-21T01:30:22.000Z',
    );
    assert.equal(normalizeDeviceTimestamp('not-a-date'), null);
});
