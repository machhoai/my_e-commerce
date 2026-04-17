'use client';

import DesktopPage from '@/app/desktop/(dashboard)/manager/scheduling/register/page';
import MobilePageShell from '@/components/mobile/MobilePageShell';
import { useMobileTranslation } from '@/lib/i18n';

export default function MobileManagerSchedulingRegisterPage() {
    const { t } = useMobileTranslation();
    return (
        <MobilePageShell title={t('nav.scheduleRegister')}>
            <DesktopPage />
        </MobilePageShell>
    );
}