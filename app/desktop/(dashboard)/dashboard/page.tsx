import DesktopView from "./DesktopView";
import { getTopReferralEmployees } from '@/actions/referral';

export default async function DashboardPage() {
    const topReferralData = await getTopReferralEmployees();
    return <DesktopView topReferralData={topReferralData} />;
}