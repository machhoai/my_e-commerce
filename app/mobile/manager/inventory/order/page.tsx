import DesktopPage from '@/app/desktop/(dashboard)/manager/inventory/order/page';
import MobilePageShell from '@/components/mobile/MobilePageShell';

export default function MobileManagerInventoryOrderPage() {
    return (
        <MobilePageShell title="Đặt hàng">
            <DesktopPage />
        </MobilePageShell>
    );
}
