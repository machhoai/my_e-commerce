'use client';

import DesktopPage from '@/app/desktop/(dashboard)/admin/events/page';
import MobilePageShell from '@/components/mobile/MobilePageShell';
import { useMobileTranslation } from '@/lib/i18n';

export default function MobileAdminEventsPage() {
    const { t } = useMobileTranslation();
    return (
        <MobilePageShell title={t('nav.events')}>
            <DesktopPage />
        </MobilePageShell>
    );
}