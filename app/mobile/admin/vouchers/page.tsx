import DesktopPage from '@/app/desktop/(dashboard)/admin/vouchers/page';
import MobilePageShell from '@/components/mobile/MobilePageShell';

export default function MobileAdminVouchersPage() {
    return (
        <MobilePageShell title="Voucher">
            <DesktopPage />
        </MobilePageShell>
    );
}
