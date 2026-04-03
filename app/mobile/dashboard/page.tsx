import MobileView from '@/app/desktop/(dashboard)/dashboard/MobileView';
import { getTopReferralEmployees } from '@/actions/referral';

export default async function MobileDashboardPage() {
    const topReferralData = await getTopReferralEmployees();
    return (
        <div>
            <MobileView topReferralData={topReferralData} />
        </div>
    );
}
