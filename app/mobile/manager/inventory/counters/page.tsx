import DesktopPage from '@/app/desktop/(dashboard)/manager/inventory/counters/page';
import MobilePageShell from '@/components/mobile/MobilePageShell';

export default function MobileManagerInventoryCountersPage() {
    return (
        <MobilePageShell title="Quầy hàng">
            <DesktopPage />
        </MobilePageShell>
    );
}
