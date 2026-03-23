import DesktopPage from '@/app/desktop/(dashboard)/manager/inventory/transfer/page';
import MobilePageShell from '@/components/mobile/MobilePageShell';

export default function MobileManagerInventoryTransferPage() {
    return (
        <MobilePageShell title="Chuyển kho">
            <DesktopPage />
        </MobilePageShell>
    );
}
