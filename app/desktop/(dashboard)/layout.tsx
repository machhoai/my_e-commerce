import AuthGuard from '@/components/layout/AuthGuard';
import DashboardLayout from '@/components/layout/DashboardLayout';
import UniversalScannerModal from '@/components/scanner/UniversalScannerModal';

export default function DashboardRootLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return (
        <AuthGuard>
            <DashboardLayout>
                {children}
                <UniversalScannerModal />
            </DashboardLayout>
        </AuthGuard>
    );
}
