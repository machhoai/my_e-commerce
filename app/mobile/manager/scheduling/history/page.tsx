'use client';

import DesktopPage from '@/app/desktop/(dashboard)/manager/scheduling/history/page';
import MobilePageShell from '@/components/mobile/MobilePageShell';
import { useMobileTranslation } from '@/lib/i18n';

export default function MobileManagerSchedulingHistoryPage() {
    const { t } = useMobileTranslation();
    return (
        <MobilePageShell title={t('nav.scheduleHistory')}>
            <DesktopPage />
        </MobilePageShell>
    );
}