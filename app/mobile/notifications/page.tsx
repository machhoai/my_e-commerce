import DesktopPage from '@/app/desktop/(dashboard)/notifications/page';
import MobilePageShell from '@/components/mobile/MobilePageShell';

export default function MobileNotificationsPage() {
    return (
        <MobilePageShell title="Thông báo">
            <DesktopPage />
        </MobilePageShell>
    );
}
