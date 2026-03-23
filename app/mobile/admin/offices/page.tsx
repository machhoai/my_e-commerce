import DesktopPage from '@/app/desktop/(dashboard)/admin/offices/page';
import MobilePageShell from '@/components/mobile/MobilePageShell';

export default function MobileAdminOfficesPage() {
    return (
        <MobilePageShell title="Văn phòng">
            <DesktopPage />
        </MobilePageShell>
    );
}
