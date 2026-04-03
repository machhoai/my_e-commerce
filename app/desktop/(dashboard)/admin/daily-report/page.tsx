// app/desktop/(dashboard)/admin/daily-report/page.tsx
// Server Component — fetches DailyPanel data and passes to client
// Date is read from ?date=YYYY-MM-DD search param (defaults to today VN)

import { Suspense } from 'react';
import { fetchRevenueFromCache } from '@/app/desktop/(dashboard)/office/revenue/actions';
import DailyReportClient from '@/components/admin/DailyReportClient';

export const metadata = {
    title: 'Daily Report | Joyworld ERP',
    description: 'Bảng báo cáo doanh thu hàng ngày cho hệ thống Joyworld',
};

export const dynamic = 'force-dynamic';

function getTodayVN(): string {
    const now = new Date();
    const vnDate = new Date(now.getTime() + 7 * 60 * 60 * 1000);
    return vnDate.toISOString().split('T')[0];
}

const DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;

export default async function DailyReportPage({
    searchParams,
}: {
    searchParams: Promise<{ date?: string }>;
}) {
    const today = getTodayVN();
    const params = await searchParams;

    // Validate date param — reject anything that's not YYYY-MM-DD or future dates
    const rawDate = params.date;
    const selectedDate =
        rawDate && DATE_REGEX.test(rawDate) && rawDate <= today
            ? rawDate
            : today;

    const result = await fetchRevenueFromCache(selectedDate, selectedDate);

    return (
        <Suspense
            fallback={
                <div className="flex items-center justify-center min-h-screen">
                    <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-teal-500" />
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
            />
        </Suspense>
    );
}
