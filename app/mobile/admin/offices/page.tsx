'use client';

import DesktopPage from '@/app/desktop/(dashboard)/admin/offices/page';
import MobilePageShell from '@/components/mobile/MobilePageShell';
import { useMobileTranslation } from '@/lib/i18n';

export default function MobileAdminOfficesPage() {
    const { t } = useMobileTranslation();
    return (
        <MobilePageShell title={t('nav.offices')}>
            <DesktopPage />
        </MobilePageShell>
    );
}