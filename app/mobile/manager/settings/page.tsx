import DesktopPage from '@/app/desktop/(dashboard)/manager/settings/page';
import MobilePageShell from '@/components/mobile/MobilePageShell';

export default function MobileManagerSettingsPage() {
    return (
        <MobilePageShell title="Cài đặt cửa hàng">
            <DesktopPage />
        </MobilePageShell>
    );
}
