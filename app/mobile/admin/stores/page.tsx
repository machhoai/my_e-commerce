'use client';

import DesktopPage from '@/app/desktop/(dashboard)/admin/stores/page';
import MobilePageShell from '@/components/mobile/MobilePageShell';
import { useMobileTranslation } from '@/lib/i18n';

export default function MobileAdminStoresPage() {
    const { t } = useMobileTranslation();
    return (
        <MobilePageShell title={t('nav.stores')}>
            <DesktopPage />
        </MobilePageShell>
    );
}