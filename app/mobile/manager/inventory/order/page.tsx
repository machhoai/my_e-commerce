'use client';

import DesktopPage from '@/app/desktop/(dashboard)/manager/inventory/order/page';
import MobilePageShell from '@/components/mobile/MobilePageShell';
import { useMobileTranslation } from '@/lib/i18n';

export default function MobileManagerInventoryOrderPage() {
    const { t } = useMobileTranslation();
    return (
        <MobilePageShell title={t('nav.order')}>
            <DesktopPage />
        </MobilePageShell>
    );
}