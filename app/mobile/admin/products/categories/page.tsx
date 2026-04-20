'use client';

import DesktopPage from '@/app/desktop/(dashboard)/admin/products/categories/page';
import MobilePageShell from '@/components/mobile/MobilePageShell';
import { useMobileTranslation } from '@/lib/i18n';

export default function MobileAdminProductsCategoriesPage() {
    const { t } = useMobileTranslation();
    return (
        <MobilePageShell title={t('nav.categories')}>
            <DesktopPage />
        </MobilePageShell>
    );
}