'use client';

import DesktopPage from '@/app/desktop/(dashboard)/admin/users/page';
import MobilePageShell from '@/components/mobile/MobilePageShell';
import { useMobileTranslation } from '@/lib/i18n';

export default function MobileAdminUsersPage() {
    const { t } = useMobileTranslation();
    return (
        <MobilePageShell title={t('nav.userManagement')}>
            <DesktopPage />
        </MobilePageShell>
    );
}