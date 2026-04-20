'use client';

import DesktopPage from '@/app/desktop/(dashboard)/admin/products/products/page';
import MobilePageShell from '@/components/mobile/MobilePageShell';
import { useMobileTranslation } from '@/lib/i18n';

export default function MobileAdminProductsProductsPage() {
    const { t } = useMobileTranslation();
    return (
        <MobilePageShell title={t('nav.products')}>
            <DesktopPage />
        </MobilePageShell>
    );
}