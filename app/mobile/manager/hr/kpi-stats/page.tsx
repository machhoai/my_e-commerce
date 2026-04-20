'use client';

import DesktopPage from '@/app/desktop/(dashboard)/manager/hr/kpi-stats/page';
import MobilePageShell from '@/components/mobile/MobilePageShell';
import { useMobileTranslation } from '@/lib/i18n';

export default function MobileManagerHrKpiStatsPage() {
    const { t } = useMobileTranslation();
    return (
        <MobilePageShell title={t('nav.kpiStats')}>
            <DesktopPage />
        </MobilePageShell>
    );
}