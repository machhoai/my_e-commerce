import DesktopPage from '@/app/desktop/(dashboard)/admin/warehouses/page';
import MobilePageShell from '@/components/mobile/MobilePageShell';

export default function MobileAdminWarehousesPage() {
    return (
        <MobilePageShell title="Kho">
            <DesktopPage />
        </MobilePageShell>
    );
}
