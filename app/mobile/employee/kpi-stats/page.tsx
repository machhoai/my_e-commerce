import DesktopPage from '@/app/desktop/(dashboard)/employee/kpi-stats/page';
import MobilePageShell from '@/components/mobile/MobilePageShell';

export default function MobileEmployeeKpi_statsPage() {
    return (
        <MobilePageShell title="KPI của tôi">
            <DesktopPage />
        </MobilePageShell>
    );
}
