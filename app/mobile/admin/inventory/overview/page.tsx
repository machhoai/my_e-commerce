import DesktopPage from '@/app/desktop/(dashboard)/admin/inventory/overview/page';
import MobilePageShell from '@/components/mobile/MobilePageShell';

export default function MobileAdminInventoryOverviewPage() {
    return (
        <MobilePageShell title="Kho tổng quan">
            <DesktopPage />
        </MobilePageShell>
    );
}
