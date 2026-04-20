'use client';

import DesktopPage from '@/app/desktop/(dashboard)/admin/inventory/import/page';
import MobilePageShell from '@/components/mobile/MobilePageShell';
import { useMobileTranslation } from '@/lib/i18n';

export default function MobileAdminInventoryImportPage() {
    const { t } = useMobileTranslation();
    return (
        <MobilePageShell title={t('nav.importStock')}>
            <DesktopPage />
        </MobilePageShell>
    );
}