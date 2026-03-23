'use client';

import { usePathname } from 'next/navigation';
import AuthGuard from '@/components/layout/AuthGuard';

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
            {children}
        </AuthGuard>
    );
}
