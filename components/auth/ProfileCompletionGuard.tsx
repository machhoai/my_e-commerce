'use client';

import { useAuth } from '@/contexts/AuthContext';
import { isProfileComplete } from '@/lib/profile-completion';
import MandatoryUpdateForm from '@/components/profile/MandatoryUpdateForm';

/**
 * Checks whether a user's profile is incomplete based on their role.
 *
 * - Admin / super_admin: only require a valid email (not @company.com).
 * - All others: require email + avatar + full CCCD data + bank account.
 */
interface ProfileCompletionGuardProps {
    children: React.ReactNode;
}

export default function ProfileCompletionGuard({ children }: ProfileCompletionGuardProps) {
    const { userDoc } = useAuth();

    // While userDoc hasn't loaded yet, don't block (AuthGuard already handles loading)
    if (!userDoc) return <>{children}</>;

    if (!isProfileComplete(userDoc)) {
        return <MandatoryUpdateForm />;
    }

    return <>{children}</>;
}
