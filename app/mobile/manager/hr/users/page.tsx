'use client';

import DesktopPage from '@/app/desktop/(dashboard)/manager/hr/users/page';
import MobilePageShell from '@/components/mobile/MobilePageShell';
import { useMobileTranslation } from '@/lib/i18n';

export default function MobileManagerHrUsersPage() {
    const { t } = useMobileTranslation();
    return (
        <MobilePageShell title={t('nav.employees')}>
            <DesktopPage />
        </MobilePageShell>
    );
}