import DesktopPage from '@/app/desktop/(dashboard)/admin/inventory/dispatch/page';
import MobilePageShell from '@/components/mobile/MobilePageShell';

export default function MobileAdminInventoryDispatchPage() {
    return (
        <MobilePageShell title="Xuất kho">
            <DesktopPage />
        </MobilePageShell>
    );
}
