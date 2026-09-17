import assert from 'node:assert/strict';
import test from 'node:test';
// @ts-expect-error Node's strip-types test runner requires the explicit .ts extension.
import { exceedsDailyShiftLimit, MAX_EMPLOYEE_SHIFTS_PER_DAY } from '../../lib/scheduling/policy.ts';

test('company scheduling policy is fixed at one distinct shift per day', () => {
    assert.equal(MAX_EMPLOYEE_SHIFTS_PER_DAY, 1);
    assert.equal(exceedsDailyShiftLimit(['morning']), false);
    assert.equal(exceedsDailyShiftLimit(['morning', 'evening']), true);
});

test('the same shift at several counters still counts as one shift', () => {
    assert.equal(exceedsDailyShiftLimit(['morning', 'morning', 'morning']), false);
});
