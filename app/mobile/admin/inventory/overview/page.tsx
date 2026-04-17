'use client';

import DesktopPage from '@/app/desktop/(dashboard)/admin/inventory/overview/page';
import MobilePageShell from '@/components/mobile/MobilePageShell';
import { useMobileTranslation } from '@/lib/i18n';

export default function MobileAdminInventoryOverviewPage() {
    const { t } = useMobileTranslation();
    return (
        <MobilePageShell title={t('nav.inventoryOverview')}>
            <DesktopPage />
        </MobilePageShell>
    );
}