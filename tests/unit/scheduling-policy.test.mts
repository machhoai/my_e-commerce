import assert from 'node:assert/strict';
import test from 'node:test';
// @ts-expect-error Node's strip-types test runner requires the explicit .ts extension.
import { businessDateInstant, exceedsDailyShiftLimit, MAX_EMPLOYEE_SHIFTS_PER_DAY } from '../../lib/scheduling/policy.ts';

test('company scheduling policy is fixed at one distinct shift per day', () => {
    assert.equal(MAX_EMPLOYEE_SHIFTS_PER_DAY, 1);
    assert.equal(exceedsDailyShiftLimit(['morning']), false);
    assert.equal(exceedsDailyShiftLimit(['morning', 'evening']), true);
});

test('the same shift at several counters still counts as one shift', () => {
    assert.equal(exceedsDailyShiftLimit(['morning', 'morning', 'morning']), false);
});

test('a workplace assignment added after noon applies to that business date', () => {
    const assignment = new Date('2026-09-28T06:35:26.131Z');
    assert.equal(assignment <= businessDateInstant('2026-09-28'), true);
    assert.equal(assignment <= businessDateInstant('2026-09-27'), false);
});
