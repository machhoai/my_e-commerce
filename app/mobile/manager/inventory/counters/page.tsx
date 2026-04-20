'use client';

import DesktopPage from '@/app/desktop/(dashboard)/manager/inventory/counters/page';
import MobilePageShell from '@/components/mobile/MobilePageShell';
import { useMobileTranslation } from '@/lib/i18n';

export default function MobileManagerInventoryCountersPage() {
    const { t } = useMobileTranslation();
    return (
        <MobilePageShell title={t('nav.counters')}>
            <DesktopPage />
        </MobilePageShell>
    );
}