import DesktopPage from '@/app/desktop/(dashboard)/manager/scheduling/history/page';
import MobilePageShell from '@/components/mobile/MobilePageShell';

export default function MobileManagerSchedulingHistoryPage() {
    return (
        <MobilePageShell title="Lịch sử ca">
            <DesktopPage />
        </MobilePageShell>
    );
}
