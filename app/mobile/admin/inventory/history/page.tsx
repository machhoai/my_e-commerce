import DesktopPage from '@/app/desktop/(dashboard)/admin/inventory/history/page';
import MobilePageShell from '@/components/mobile/MobilePageShell';

export default function MobileAdminInventoryHistoryPage() {
    return (
        <MobilePageShell title="Lịch sử kho">
            <DesktopPage />
        </MobilePageShell>
    );
}
