'use client';

import DesktopPage from '@/app/desktop/(dashboard)/manager/hr/kpi-scoring/page';
import MobilePageShell from '@/components/mobile/MobilePageShell';
import { useMobileTranslation } from '@/lib/i18n';

export default function MobileManagerHrKpiScoringPage() {
    const { t } = useMobileTranslation();
    return (
        <MobilePageShell title={t('nav.kpiScoring')}>
            <DesktopPage />
        </MobilePageShell>
    );
}