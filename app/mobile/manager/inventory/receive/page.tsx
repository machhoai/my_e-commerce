'use client';

import DesktopPage from '@/app/desktop/(dashboard)/manager/inventory/receive/page';
import MobilePageShell from '@/components/mobile/MobilePageShell';
import { useMobileTranslation } from '@/lib/i18n';

export default function MobileManagerInventoryReceivePage() {
    const { t } = useMobileTranslation();
    return (
        <MobilePageShell title={t('nav.receive')}>
            <DesktopPage />
        </MobilePageShell>
    );
}