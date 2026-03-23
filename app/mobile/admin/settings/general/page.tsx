import DesktopPage from '@/app/desktop/(dashboard)/admin/settings/general/page';
import MobilePageShell from '@/components/mobile/MobilePageShell';

export default function MobileAdminSettingsGeneralPage() {
    return (
        <MobilePageShell title="Cài đặt chung">
            <DesktopPage />
        </MobilePageShell>
    );
}
