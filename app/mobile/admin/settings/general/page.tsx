'use client';

import DesktopPage from '@/app/desktop/(dashboard)/admin/settings/general/page';
import MobilePageShell from '@/components/mobile/MobilePageShell';
import { useMobileTranslation } from '@/lib/i18n';

export default function MobileAdminSettingsGeneralPage() {
    const { t } = useMobileTranslation();
    return (
        <MobilePageShell title={t('nav.generalSettings')}>
            <DesktopPage />
        </MobilePageShell>
    );
}