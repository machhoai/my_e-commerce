'use client';

import DesktopPage from '@/app/desktop/(dashboard)/manager/inventory/receive/[orderId]/page';
import MobilePageShell from '@/components/mobile/MobilePageShell';
import { useMobileTranslation } from '@/lib/i18n';

export default function MobileManagerInventoryReceiveDetailPage() {
    const { t } = useMobileTranslation();
    return (
        <MobilePageShell title={t('nav.receive')}>
            <DesktopPage />
        </MobilePageShell>
    );
}
