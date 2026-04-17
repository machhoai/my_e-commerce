'use client';

import DesktopPage from '@/app/desktop/(dashboard)/admin/settings/broadcast/page';
import MobilePageShell from '@/components/mobile/MobilePageShell';
import { useMobileTranslation } from '@/lib/i18n';

export default function MobileAdminSettingsBroadcastPage() {
    const { t } = useMobileTranslation();
    return (
        <MobilePageShell title={t('nav.broadcast')}>
            <DesktopPage />
        </MobilePageShell>
    );
}