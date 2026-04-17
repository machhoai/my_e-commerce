'use client';

import DesktopPage from '@/app/desktop/(dashboard)/manager/inventory/transfer/page';
import MobilePageShell from '@/components/mobile/MobilePageShell';
import { useMobileTranslation } from '@/lib/i18n';

export default function MobileManagerInventoryTransferPage() {
    const { t } = useMobileTranslation();
    return (
        <MobilePageShell title={t('nav.transfer')}>
            <DesktopPage />
        </MobilePageShell>
    );
}