import assert from 'node:assert/strict';
import test from 'node:test';
// @ts-expect-error Explicit extension for the Node strip-types runner.
import { hasBankAccount, isProfileComplete } from '../../lib/profile-completion.ts';
import type { UserDoc } from '../../types/index';

const profile = (changes: Partial<UserDoc> = {}): UserDoc => ({
    role: 'employee', email: 'employee@example.com', avatar: 'avatar-url', idCard: '012345678901',
    dob: '2000-01-01', gender: 'Nam', permanentAddress: 'Address',
    idCardFrontPhoto: 'front-url', idCardBackPhoto: 'back-url', bankAccount: '001234567890',
    ...changes,
} as UserDoc);

test('an otherwise complete employee profile requires a bank account, including legacy accounts', () => {
    for (const bankAccount of [undefined, '', '   ', '\t\n']) {
        const user = profile({ bankAccount, setupCompletedAt: '2026-10-01T00:00:00Z' });
        assert.equal(hasBankAccount(user), false);
        assert.equal(isProfileComplete(user), false);
    }
    assert.equal(isProfileComplete(profile()), true);
});

test('a bank account does not replace other mandatory profile fields', () => {
    for (const field of ['avatar', 'idCard', 'dob', 'gender', 'permanentAddress', 'idCardFrontPhoto', 'idCardBackPhoto'] as const) {
        assert.equal(isProfileComplete(profile({ [field]: '' })), false);
    }
    assert.equal(isProfileComplete(profile({ email: '0123456789@company.com' })), false);
});

test('managers and store managers require a bank account too', () => {
    for (const role of ['manager', 'store_manager'] as const) {
        assert.equal(isProfileComplete(profile({ role, bankAccount: '' })), false);
        assert.equal(isProfileComplete(profile({ role })), true);
    }
});

test('admin email-only exception remains, while missing-bank warnings still apply', () => {
    for (const role of ['admin', 'super_admin'] as const) {
        const user = profile({ role, bankAccount: '', avatar: '' });
        assert.equal(isProfileComplete(user), true);
        assert.equal(hasBankAccount(user), false);
        assert.equal(isProfileComplete({ ...user, email: '' }), false);
    }
});
