import assert from 'node:assert/strict';
import test from 'node:test';
// @ts-expect-error Node's strip-types test runner requires the explicit .ts extension.
import { assignedShiftKeys, monthlyShiftLimit, nextMonthStart } from '../../lib/scheduling/monthly-quota.ts';

test('monthly quota counts scheduled shifts across past and future dates once per shift', () => {
    const assigned = assignedShiftKeys([
        { storeId: 'a', date: '2026-09-02', shiftId: 'morning' },
        { storeId: 'a', date: '2026-09-02', shiftId: 'morning' }, // two counters
        { storeId: 'a', date: '2026-09-28', shiftId: 'evening' },
        { storeId: 'b', date: '2026-09-29', shiftId: 'morning' },
    ]);
    assert.equal(assigned.size, 3);
    assert.equal(monthlyShiftLimit('PT', '2026-09', { ptMaxShifts: 3 }), 3);
    assert.equal(monthlyShiftLimit('FT', '2026-09', { ftDaysOff: 4 }), 26);
    assert.equal(monthlyShiftLimit('FT', '2024-02', { ftDaysOff: 4 }), 25);
    assert.equal(nextMonthStart('2026-12'), '2027-01-01');
});
