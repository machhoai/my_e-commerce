// app/mobile/admin/daily-report/page.tsx
// Mobile Server Component — reuses same data fetching, passes to same DailyReportClient

import { Suspense } from 'react';
import { fetchRevenueFromCache } from '@/app/desktop/(dashboard)/office/revenue/actions';
import DailyReportClient from '@/components/admin/DailyReportClient';

export const metadata = {
    title: 'Daily Report | Joyworld',
    description: 'Báo cáo doanh thu hàng ngày',
};

export const dynamic = 'force-dynamic';

function getTodayVN(): string {
    const now = new Date();
    const vnDate = new Date(now.getTime() + 7 * 60 * 60 * 1000);
    return vnDate.toISOString().split('T')[0];
}

const DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;

export default async function MobileDailyReportPage({
    searchParams,
}: {
    searchParams: Promise<{ date?: string }>;
}) {
    const today = getTodayVN();
    const params = await searchParams;

    const rawDate = params.date;
    const selectedDate =
        rawDate && DATE_REGEX.test(rawDate) && rawDate <= today
            ? rawDate
            : today;

    const result = await fetchRevenueFromCache(selectedDate, selectedDate);

    return (
        <Suspense
            fallback={
                <div className="flex items-center justify-center min-h-[80vh]">
                    <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-teal-500" />
                </div>
            }
        >
            <DailyReportClient
                dailyPanel={result.dailyPanel}
                forDate={selectedDate}
                today={today}
                updatedAt={result.updatedAt}
                fromCache={result.fromCache}
                error={result.error}
                isMobile
            />
        </Suspense>
    );
}
