'use client';

import DesktopPage from '@/app/desktop/(dashboard)/admin/settings/notifications/page';
import MobilePageShell from '@/components/mobile/MobilePageShell';
import { useMobileTranslation } from '@/lib/i18n';

export default function MobileAdminSettingsNotificationsPage() {
    const { t } = useMobileTranslation();
    return (
        <MobilePageShell title={t('nav.notificationTemplates')}>
            <DesktopPage />
        </MobilePageShell>
    );
}