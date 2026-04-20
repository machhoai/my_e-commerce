'use client';

import DesktopPage from '@/app/desktop/(dashboard)/office/inventory/approvals/page';
import MobilePageShell from '@/components/mobile/MobilePageShell';
import { useMobileTranslation } from '@/lib/i18n';

export default function MobileOfficeInventoryApprovalsPage() {
    const { t } = useMobileTranslation();
    return (
        <MobilePageShell title={t('nav.approvals')}>
            <DesktopPage />
        </MobilePageShell>
    );
}