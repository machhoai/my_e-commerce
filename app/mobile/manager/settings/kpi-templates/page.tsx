import DesktopPage from '@/app/desktop/(dashboard)/manager/settings/kpi-templates/page';
import MobilePageShell from '@/components/mobile/MobilePageShell';

export default function MobileManagerSettingsKpi_templatesPage() {
    return (
        <MobilePageShell title="Mẫu KPI">
            <DesktopPage />
        </MobilePageShell>
    );
}
