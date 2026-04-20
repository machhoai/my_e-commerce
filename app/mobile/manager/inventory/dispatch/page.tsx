'use client';

import DesktopPage from '@/app/desktop/(dashboard)/manager/inventory/dispatch/page';
import MobilePageShell from '@/components/mobile/MobilePageShell';
import { useMobileTranslation } from '@/lib/i18n';

export default function MobileManagerInventoryDispatchPage() {
    const { t } = useMobileTranslation();
    return (
        <MobilePageShell title={t('nav.dispatch')}>
            <DesktopPage />
        </MobilePageShell>
    );
}