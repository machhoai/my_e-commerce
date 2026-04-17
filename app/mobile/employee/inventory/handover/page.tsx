'use client';

import DesktopPage from '@/app/desktop/(dashboard)/employee/inventory/handover/page';
import MobilePageShell from '@/components/mobile/MobilePageShell';
import { useMobileTranslation } from '@/lib/i18n';

export default function MobileEmployeeInventoryHandoverPage() {
    const { t } = useMobileTranslation();
    return (
        <MobilePageShell title={t('nav.counterHandover')}>
            <DesktopPage />
        </MobilePageShell>
    );
}