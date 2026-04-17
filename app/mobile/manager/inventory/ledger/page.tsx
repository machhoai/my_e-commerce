'use client';

import DesktopPage from '@/app/desktop/(dashboard)/manager/inventory/ledger/page';
import MobilePageShell from '@/components/mobile/MobilePageShell';
import { useMobileTranslation } from '@/lib/i18n';

export default function MobileManagerInventoryLedgerPage() {
    const { t } = useMobileTranslation();
    return (
        <MobilePageShell title={t('nav.ledger')}>
            <DesktopPage />
        </MobilePageShell>
    );
}