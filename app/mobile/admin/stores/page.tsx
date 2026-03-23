import DesktopPage from '@/app/desktop/(dashboard)/admin/stores/page';
import MobilePageShell from '@/components/mobile/MobilePageShell';

export default function MobileAdminStoresPage() {
    return (
        <MobilePageShell title="Cửa hàng">
            <DesktopPage />
        </MobilePageShell>
    );
}
