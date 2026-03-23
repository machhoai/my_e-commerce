import DesktopPage from '@/app/desktop/(dashboard)/admin/events/page';
import MobilePageShell from '@/components/mobile/MobilePageShell';

export default function MobileAdminEventsPage() {
    return (
        <MobilePageShell title="Sự kiện">
            <DesktopPage />
        </MobilePageShell>
    );
}
