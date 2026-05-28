'use client';

import GreenSMPromotion from '@/components/greensm/GreenSMPromotion';
import MobilePageShell from '@/components/mobile/MobilePageShell';

export default function MobileGreenSMPage() {
    return (
        <MobilePageShell title="GreenSM" noPadding>
            <GreenSMPromotion variant="mobile" />
        </MobilePageShell>
    );
}
