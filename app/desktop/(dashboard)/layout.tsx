import AuthGuard from '@/components/layout/AuthGuard';
import ProfileCompletionGuard from '@/components/auth/ProfileCompletionGuard';
import DashboardLayout from '@/components/layout/DashboardLayout';
import UniversalScannerModal from '@/components/scanner/UniversalScannerModal';

export default function DashboardRootLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return (
        <AuthGuard>
            <ProfileCompletionGuard>
                <DashboardLayout>
                    {children}
                    <UniversalScannerModal />
                </DashboardLayout>
            </ProfileCompletionGuard>
        </AuthGuard>
    );
}
