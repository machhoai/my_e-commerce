'use client';

import DesktopPage from '@/app/desktop/(dashboard)/manager/inventory/usage/page';
import MobilePageShell from '@/components/mobile/MobilePageShell';
import { useMobileTranslation } from '@/lib/i18n';

export default function MobileManagerInventoryUsagePage() {
    const { t } = useMobileTranslation();
    return (
        <MobilePageShell title={t('nav.usage')}>
            <DesktopPage />
        </MobilePageShell>
    );
}