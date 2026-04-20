'use client';

import DesktopPage from '@/app/desktop/(dashboard)/admin/settings/events/page';
import MobilePageShell from '@/components/mobile/MobilePageShell';
import { useMobileTranslation } from '@/lib/i18n';

export default function MobileAdminSettingsEventsPage() {
    const { t } = useMobileTranslation();
    return (
        <MobilePageShell title={t('nav.eventSettings')}>
            <DesktopPage />
        </MobilePageShell>
    );
}