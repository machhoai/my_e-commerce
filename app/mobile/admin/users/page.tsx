import DesktopPage from '@/app/desktop/(dashboard)/admin/users/page';
import MobilePageShell from '@/components/mobile/MobilePageShell';

export default function MobileAdminUsersPage() {
    return (
        <MobilePageShell title="Quản lý người dùng">
            <DesktopPage />
        </MobilePageShell>
    );
}
