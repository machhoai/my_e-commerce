import DesktopPage from '@/app/desktop/(dashboard)/admin/settings/events/page';
import MobilePageShell from '@/components/mobile/MobilePageShell';

export default function MobileAdminSettingsEventsPage() {
    return (
        <MobilePageShell title="Cài đặt sự kiện">
            <DesktopPage />
        </MobilePageShell>
    );
}
