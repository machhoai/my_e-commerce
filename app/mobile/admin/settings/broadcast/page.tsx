import DesktopPage from '@/app/desktop/(dashboard)/admin/settings/broadcast/page';
import MobilePageShell from '@/components/mobile/MobilePageShell';

export default function MobileAdminSettingsBroadcastPage() {
    return (
        <MobilePageShell title="Gửi thông báo">
            <DesktopPage />
        </MobilePageShell>
    );
}
