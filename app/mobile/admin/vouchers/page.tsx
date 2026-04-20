'use client';

import DesktopPage from '@/app/desktop/(dashboard)/admin/vouchers/page';
import MobilePageShell from '@/components/mobile/MobilePageShell';
import { useMobileTranslation } from '@/lib/i18n';

export default function MobileAdminVouchersPage() {
    const { t } = useMobileTranslation();
    return (
        <MobilePageShell title={t('nav.vouchers')}>
            <DesktopPage />
        </MobilePageShell>
    );
}