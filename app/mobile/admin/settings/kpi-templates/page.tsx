'use client';

import DesktopPage from '@/app/desktop/(dashboard)/admin/settings/kpi-templates/page';
import MobilePageShell from '@/components/mobile/MobilePageShell';
import { useMobileTranslation } from '@/lib/i18n';

export default function MobileAdminSettingsKpiTemplatesPage() {
    const { t } = useMobileTranslation();
    return (
        <MobilePageShell title={t('nav.systemKPITemplates')}>
            <DesktopPage />
        </MobilePageShell>
    );
}