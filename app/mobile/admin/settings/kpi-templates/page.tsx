import DesktopPage from '@/app/desktop/(dashboard)/admin/settings/kpi-templates/page';
import MobilePageShell from '@/components/mobile/MobilePageShell';

export default function MobileAdminSettingsKpi_templatesPage() {
    return (
        <MobilePageShell title="Mẫu KPI hệ thống">
            <DesktopPage />
        </MobilePageShell>
    );
}
