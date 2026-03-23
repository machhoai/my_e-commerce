import DesktopPage from '@/app/desktop/(dashboard)/manager/inventory/receive/page';
import MobilePageShell from '@/components/mobile/MobilePageShell';

export default function MobileManagerInventoryReceivePage() {
    return (
        <MobilePageShell title="Nhận hàng">
            <DesktopPage />
        </MobilePageShell>
    );
}
