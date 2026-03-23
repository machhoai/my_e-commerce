import DesktopPage from '@/app/desktop/(dashboard)/manager/inventory/ledger/page';
import MobilePageShell from '@/components/mobile/MobilePageShell';

export default function MobileManagerInventoryLedgerPage() {
    return (
        <MobilePageShell title="Sổ kho">
            <DesktopPage />
        </MobilePageShell>
    );
}
