import DesktopPage from '@/app/desktop/(dashboard)/employee/inventory/usage/page';
import MobilePageShell from '@/components/mobile/MobilePageShell';

export default function MobileEmployeeInventoryUsagePage() {
    return (
        <MobilePageShell title="Hao hụt quầy">
            <DesktopPage />
        </MobilePageShell>
    );
}
