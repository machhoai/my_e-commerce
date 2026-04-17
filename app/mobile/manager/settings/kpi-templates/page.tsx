'use client';

import DesktopPage from '@/app/desktop/(dashboard)/manager/settings/kpi-templates/page';
import MobilePageShell from '@/components/mobile/MobilePageShell';
import { useMobileTranslation } from '@/lib/i18n';

export default function MobileManagerKpiTemplatesPage() {
    const { t } = useMobileTranslation();
    return (
        <MobilePageShell title={t('nav.kpiTemplates')}>
            <DesktopPage />
        </MobilePageShell>
    );
}