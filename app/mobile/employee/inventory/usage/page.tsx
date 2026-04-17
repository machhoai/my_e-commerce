'use client';

import DesktopPage from '@/app/desktop/(dashboard)/employee/inventory/usage/page';
import MobilePageShell from '@/components/mobile/MobilePageShell';
import { useMobileTranslation } from '@/lib/i18n';

export default function MobileEmployeeInventoryUsagePage() {
    const { t } = useMobileTranslation();
    return (
        <MobilePageShell title={t('nav.counterUsage')}>
            <DesktopPage />
        </MobilePageShell>
    );
}