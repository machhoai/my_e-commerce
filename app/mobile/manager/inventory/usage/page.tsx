import DesktopPage from '@/app/desktop/(dashboard)/manager/inventory/usage/page';
import MobilePageShell from '@/components/mobile/MobilePageShell';

export default function MobileManagerInventoryUsagePage() {
    return (
        <MobilePageShell title="Hao hụt">
            <DesktopPage />
        </MobilePageShell>
    );
}
