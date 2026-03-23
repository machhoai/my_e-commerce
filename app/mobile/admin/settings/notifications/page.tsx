import DesktopPage from '@/app/desktop/(dashboard)/admin/settings/notifications/page';
import MobilePageShell from '@/components/mobile/MobilePageShell';

export default function MobileAdminSettingsNotificationsPage() {
    return (
        <MobilePageShell title="Mẫu thông báo">
            <DesktopPage />
        </MobilePageShell>
    );
}
