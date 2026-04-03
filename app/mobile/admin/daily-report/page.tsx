// app/mobile/admin/daily-report/page.tsx
// Mobile Server Component — reuses same data fetching, passes to same DailyReportClient

import { Suspense } from 'react';
import { fetchRevenueFromCache } from '@/app/desktop/(dashboard)/office/revenue/actions';
import DailyReportClient from '@/components/admin/DailyReportClient';
import Link from 'next/link';
import { ChevronLeft } from 'lucide-react';

export const metadata = {
    title: 'Daily Report | Admin | Joyworld',
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
        <div className="min-h-screen bg-gray-50 pb-safe flex flex-col">
            <header className="sticky top-0 z-40 bg-white/90 backdrop-blur-md border-b border-gray-100 shadow-sm">
                <div className="flex items-center justify-between h-14 px-3">
                    <Link href="/dashboard" className="p-2 -ml-2 rounded-full hover:bg-gray-100 text-gray-500 active:scale-95 transition-transform flex-shrink-0">
                        <ChevronLeft className="w-6 h-6 justify-center" />
                    </Link>
                    <h1 className="flex-1 text-center text-[15px] font-bold text-gray-900 absolute left-1/2 -translate-x-1/2">Báo cáo ngày</h1>
                    <div className="w-10"></div>{/* Spacer for centering */}
                </div>
            </header>
            
            <Suspense
                fallback={
                    <div className="flex items-center justify-center flex-1 min-h-[50vh]">
                        <div className="w-8 h-8 border-2 border-primary-500 border-t-transparent rounded-full animate-spin" />
                    </div>
                }
            >
                <div className="flex-1 overflow-y-auto px-3 pt-4 pb-20">
                    <DailyReportClient
                        dailyPanel={result.dailyPanel}
                        forDate={selectedDate}
                        today={today}
                        updatedAt={result.updatedAt}
                        fromCache={result.fromCache}
                        error={result.error}
                        isMobile
                    />
                </div>
            </Suspense>
        </div>
    );
}
