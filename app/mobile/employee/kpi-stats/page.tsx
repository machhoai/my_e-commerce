'use client';

import DesktopPage from '@/app/desktop/(dashboard)/employee/kpi-stats/page';
import MobilePageShell from '@/components/mobile/MobilePageShell';
import { useMobileTranslation } from '@/lib/i18n';

export default function MobileEmployeeKpi_statsPage() {
    const { t } = useMobileTranslation();
    return (
        <MobilePageShell title={t('nav.myKPI')}>
            <DesktopPage />
        </MobilePageShell>
    );
}