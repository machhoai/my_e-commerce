import DesktopPage from '@/app/desktop/(dashboard)/manager/hr/kpi-scoring/page';
import MobilePageShell from '@/components/mobile/MobilePageShell';

export default function MobileManagerHrKpi_scoringPage() {
    return (
        <MobilePageShell title="Chấm điểm KPI">
            <DesktopPage />
        </MobilePageShell>
    );
}
