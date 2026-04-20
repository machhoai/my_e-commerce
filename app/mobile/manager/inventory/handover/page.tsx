'use client';

import DesktopPage from '@/app/desktop/(dashboard)/manager/inventory/handover/page';
import MobilePageShell from '@/components/mobile/MobilePageShell';
import { useMobileTranslation } from '@/lib/i18n';

export default function MobileManagerInventoryHandoverPage() {
    const { t } = useMobileTranslation();
    return (
        <MobilePageShell title={t('nav.handover')}>
            <DesktopPage />
        </MobilePageShell>
    );
}