import DesktopPage from '@/app/desktop/(dashboard)/manager/inventory/dispatch/page';
import MobilePageShell from '@/components/mobile/MobilePageShell';

export default function MobileManagerInventoryDispatchPage() {
    return (
        <MobilePageShell title="Xuất kho">
            <DesktopPage />
        </MobilePageShell>
    );
}
