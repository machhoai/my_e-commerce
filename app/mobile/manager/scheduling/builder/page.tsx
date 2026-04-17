'use client';

import DesktopPage from '@/app/desktop/(dashboard)/manager/scheduling/builder/page';
import MobilePageShell from '@/components/mobile/MobilePageShell';
import { useMobileTranslation } from '@/lib/i18n';

export default function MobileManagerSchedulingBuilderPage() {
    const { t } = useMobileTranslation();
    return (
        <MobilePageShell title={t('nav.scheduleBuilder')}>
            <DesktopPage />
        </MobilePageShell>
    );
}