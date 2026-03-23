import DesktopPage from '@/app/desktop/(dashboard)/admin/inventory/import/page';
import MobilePageShell from '@/components/mobile/MobilePageShell';

export default function MobileAdminInventoryImportPage() {
    return (
        <MobilePageShell title="Nhập kho">
            <DesktopPage />
        </MobilePageShell>
    );
}
