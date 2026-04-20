'use client';

import DesktopPage from '@/app/desktop/(dashboard)/admin/inventory/ledger/page';
import MobilePageShell from '@/components/mobile/MobilePageShell';
import { useMobileTranslation } from '@/lib/i18n';

export default function MobileAdminInventoryLedgerPage() {
    const { t } = useMobileTranslation();
    return (
        <MobilePageShell title={t('nav.inventoryLedger')}>
            <DesktopPage />
        </MobilePageShell>
    );
}