import DesktopPage from '@/app/desktop/(dashboard)/admin/settings/roles/page';
import MobilePageShell from '@/components/mobile/MobilePageShell';

export default function MobileAdminSettingsRolesPage() {
    return (
        <MobilePageShell title="Phân quyền">
            <DesktopPage />
        </MobilePageShell>
    );
}
