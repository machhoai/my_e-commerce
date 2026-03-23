import DesktopPage from '@/app/desktop/(dashboard)/admin/inventory/stock/page';
import MobilePageShell from '@/components/mobile/MobilePageShell';

export default function MobileAdminInventoryStockPage() {
    return (
        <MobilePageShell title="Tồn kho">
            <DesktopPage />
        </MobilePageShell>
    );
}
