'use client';

import DesktopPage from '@/app/desktop/(dashboard)/admin/settings/roles/page';
import MobilePageShell from '@/components/mobile/MobilePageShell';
import { useMobileTranslation } from '@/lib/i18n';

export default function MobileAdminSettingsRolesPage() {
    const { t } = useMobileTranslation();
    return (
        <MobilePageShell title={t('nav.roles')}>
            <DesktopPage />
        </MobilePageShell>
    );
}