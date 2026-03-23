import DesktopPage from '@/app/desktop/(dashboard)/admin/inventory/ledger/page';
import MobilePageShell from '@/components/mobile/MobilePageShell';

export default function MobileAdminInventoryLedgerPage() {
    return (
        <MobilePageShell title="Sổ kho tổng">
            <DesktopPage />
        </MobilePageShell>
    );
}
