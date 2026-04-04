'use client';

import { usePathname } from 'next/navigation';
import AuthGuard from '@/components/layout/AuthGuard';
import ProfileCompletionGuard from '@/components/auth/ProfileCompletionGuard';
import UniversalScannerModal from '@/components/scanner/UniversalScannerModal';
import { usePushNotifications } from '@/hooks/usePushNotifications';

export default function MobileLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    const pathname = usePathname();

    // Auth pages (login, change-password) should NOT be wrapped in AuthGuard
    const isAuthPage = pathname === '/login' || pathname === '/change-password';

    if (isAuthPage) {
        return <>{children}</>;
    }

    return (
        <AuthGuard>
            <ProfileCompletionGuard>
                <MobileLayoutInner>{children}</MobileLayoutInner>
            </ProfileCompletionGuard>
        </AuthGuard>
    );
}

/** Inner component so hooks run only for authenticated users (inside AuthGuard) */
function MobileLayoutInner({ children }: { children: React.ReactNode }) {
    // Initialize Push Notifications — request permission & register FCM token.
    // On desktop this lives inside DashboardLayout; mobile needs its own call.
    usePushNotifications();

    return (
        <div className="no-scrollbar">
            {children}
            {/* Floating QR/Barcode scanner — always accessible on mobile */}
            <UniversalScannerModal />
        </div>
    );
}
