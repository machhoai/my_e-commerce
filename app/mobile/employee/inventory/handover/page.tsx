import DesktopPage from '@/app/desktop/(dashboard)/employee/inventory/handover/page';
import MobilePageShell from '@/components/mobile/MobilePageShell';

export default function MobileEmployeeInventoryHandoverPage() {
    return (
        <MobilePageShell title="Bàn giao quầy">
            <DesktopPage />
        </MobilePageShell>
    );
}
