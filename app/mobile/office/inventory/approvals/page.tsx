import DesktopPage from '@/app/desktop/(dashboard)/office/inventory/approvals/page';
import MobilePageShell from '@/components/mobile/MobilePageShell';

export default function MobileOfficeInventoryApprovalsPage() {
    return (
        <MobilePageShell title="Duyệt lệnh">
            <DesktopPage />
        </MobilePageShell>
    );
}
