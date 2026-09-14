import assert from 'node:assert/strict';
import test from 'node:test';
// @ts-expect-error Node's strip-types test runner requires the explicit .ts extension.
import { employeeDayAllocationId, parseWorkplaceKey, scheduleId, weeklyRegistrationId, workplaceKey } from '../../lib/workplace/keys.ts';

test('workplace key round-trips IDs containing separators and Unicode', () => {
    const key = workplaceKey('STORE', ' Cửa hàng:A/B ');
    assert.deepEqual(parseWorkplaceKey(key), { type: 'STORE', id: 'Cửa hàng:A/B' });
});

test('registration IDs differ by store for the same user and week', () => {
    const first = weeklyRegistrationId('user-1', 'store-A', '2026-09-14');
    const second = weeklyRegistrationId('user-1', 'store-B', '2026-09-14');
    assert.notEqual(first, second);
});

test('schedule IDs include store, date, shift and counter', () => {
    const base = scheduleId('store-A', '2026-09-14', 'morning', 'counter-1');
    assert.notEqual(base, scheduleId('store-B', '2026-09-14', 'morning', 'counter-1'));
    assert.notEqual(base, scheduleId('store-A', '2026-09-14', 'morning', 'counter-2'));
});

test('employee day allocation is shared across stores', () => {
    assert.equal(employeeDayAllocationId('user-1', '2026-09-14'), 'user-1__2026-09-14');
});
