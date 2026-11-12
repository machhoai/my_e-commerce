import type { UserDoc } from '@/types';

export function hasBankAccount(user: Pick<UserDoc, 'bankAccount'>): boolean {
    return typeof user.bankAccount === 'string' && user.bankAccount.trim().length > 0;
}

export function isProfileComplete(user: UserDoc): boolean {
    const hasValidEmail = !!user.email && user.email.includes('@') && !user.email.endsWith('@company.com');
    if (!hasValidEmail) return false;
    if (user.role === 'admin' || user.role === 'super_admin') return true;
    return hasBankAccount(user) && !!(
        user.avatar && user.idCard && user.dob && user.gender && user.permanentAddress
        && user.idCardFrontPhoto && user.idCardBackPhoto
    );
}
