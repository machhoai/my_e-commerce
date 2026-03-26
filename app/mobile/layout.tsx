'use client';

import { usePathname } from 'next/navigation';
import AuthGuard from '@/components/layout/AuthGuard';
import ProfileCompletionGuard from '@/components/auth/ProfileCompletionGuard';
import UniversalScannerModal from '@/components/scanner/UniversalScannerModal';

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
                <div className="no-scrollbar">
                    {children}
                    {/* Floating QR/Barcode scanner — always accessible on mobile */}
                    <UniversalScannerModal />
                </div>
            </ProfileCompletionGuard>
        </AuthGuard>
    );
}
