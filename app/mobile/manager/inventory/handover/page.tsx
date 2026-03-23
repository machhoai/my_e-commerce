import DesktopPage from '@/app/desktop/(dashboard)/manager/inventory/handover/page';
import MobilePageShell from '@/components/mobile/MobilePageShell';

export default function MobileManagerInventoryHandoverPage() {
    return (
        <MobilePageShell title="Bàn giao quầy">
            <DesktopPage />
        </MobilePageShell>
    );
}
