'use client';

import DesktopPage from '@/app/desktop/(dashboard)/admin/inventory/history/page';
import MobilePageShell from '@/components/mobile/MobilePageShell';
import { useMobileTranslation } from '@/lib/i18n';

export default function MobileAdminInventoryHistoryPage() {
    const { t } = useMobileTranslation();
    return (
        <MobilePageShell title={t('nav.inventoryHistory')}>
            <DesktopPage />
        </MobilePageShell>
    );
}