'use client';

import { useAuth } from '@/contexts/AuthContext';
import { UserDoc } from '@/types';
import MandatoryUpdateForm from '@/components/profile/MandatoryUpdateForm';

/**
 * Checks whether a user's profile is incomplete based on their role.
 *
 * - Admin / super_admin: only require a valid email (not @company.com).
 * - All others: require email + avatar + full CCCD data.
 */
function isProfileIncomplete(user: UserDoc): boolean {
    const isAdmin = user.role === 'admin' || user.role === 'super_admin';

    // Email validation (applies to ALL roles)
    const hasValidEmail =
        !!user.email &&
        user.email.includes('@') &&
        !user.email.endsWith('@company.com');

    if (!hasValidEmail) return true;

    // Admins only need valid email
    if (isAdmin) return false;

    // Employees need avatar + full CCCD
    if (!user.avatar) return true;
    if (!user.idCard) return true;
    if (!user.dob) return true;
    if (!user.gender) return true;
    if (!user.permanentAddress) return true;
    if (!user.idCardFrontPhoto) return true;
    if (!user.idCardBackPhoto) return true;

    return false;
}

interface ProfileCompletionGuardProps {
    children: React.ReactNode;
}

export default function ProfileCompletionGuard({ children }: ProfileCompletionGuardProps) {
    const { userDoc } = useAuth();

    // While userDoc hasn't loaded yet, don't block (AuthGuard already handles loading)
    if (!userDoc) return <>{children}</>;

    if (isProfileIncomplete(userDoc)) {
        return <MandatoryUpdateForm />;
    }

    return <>{children}</>;
}
