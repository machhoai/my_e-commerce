'use client';

import DesktopPage from '@/app/desktop/(dashboard)/manager/settings/page';
import MobilePageShell from '@/components/mobile/MobilePageShell';
import { useMobileTranslation } from '@/lib/i18n';

export default function MobileManagerSettingsPage() {
    const { t } = useMobileTranslation();
    return (
        <MobilePageShell title={t('nav.storeSettings')}>
            <DesktopPage />
        </MobilePageShell>
    );
}