import assert from 'node:assert/strict';
import test from 'node:test';
// @ts-expect-error Node's strip-types test runner requires the explicit .ts extension.
import { getAgeFromDob, isEmployeeUnder18 } from '../../lib/hr/employee-age.ts';

const today = new Date(2026, 8, 17);

test('an employee becomes 18 on their exact birthday', () => {
    assert.equal(getAgeFromDob('2008-09-17', today), 18);
    assert.equal(isEmployeeUnder18('2008-09-17', today), false);
    assert.equal(getAgeFromDob('2008-09-18', today), 17);
    assert.equal(isEmployeeUnder18('2008-09-18', today), true);
});

test('missing, invalid, and future dates are not marked as underage', () => {
    assert.equal(getAgeFromDob(undefined, today), null);
    assert.equal(getAgeFromDob('2008-02-30', today), null);
    assert.equal(getAgeFromDob('2030-01-01', today), null);
    assert.equal(isEmployeeUnder18('not-a-date', today), false);
});

