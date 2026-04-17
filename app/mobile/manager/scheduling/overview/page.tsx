'use client';

import DesktopPage from '@/app/desktop/(dashboard)/manager/scheduling/overview/page';
import MobilePageShell from '@/components/mobile/MobilePageShell';
import { useMobileTranslation } from '@/lib/i18n';

export default function MobileManagerSchedulingOverviewPage() {
    const { t } = useMobileTranslation();
    return (
        <MobilePageShell title={t('nav.scheduleOverview')}>
            <DesktopPage />
        </MobilePageShell>
    );
}