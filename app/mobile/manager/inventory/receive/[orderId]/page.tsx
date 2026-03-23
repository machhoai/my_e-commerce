import DesktopPage from '@/app/desktop/(dashboard)/manager/inventory/receive/[orderId]/page';
import MobilePageShell from '@/components/mobile/MobilePageShell';

export default function MobileManagerInventoryReceiveDetailPage() {
    return (
        <MobilePageShell title="Chi tiết nhận hàng">
            <DesktopPage />
        </MobilePageShell>
    );
}
