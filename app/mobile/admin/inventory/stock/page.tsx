'use client';

import DesktopPage from '@/app/desktop/(dashboard)/admin/inventory/stock/page';
import MobilePageShell from '@/components/mobile/MobilePageShell';
import { useMobileTranslation } from '@/lib/i18n';

export default function MobileAdminInventoryStockPage() {
    const { t } = useMobileTranslation();
    return (
        <MobilePageShell title={t('nav.stock')}>
            <DesktopPage />
        </MobilePageShell>
    );
}