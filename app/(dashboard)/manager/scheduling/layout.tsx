'use client';

import TabbedLayout, { TabItem } from '@/components/layout/TabbedLayout';
import { Eye, CalendarCog, History } from 'lucide-react';

const tabs: TabItem[] = [
    { label: 'Tổng quan', href: '/manager/scheduling/overview', icon: Eye },
    { label: 'Xếp ca', href: '/manager/scheduling/builder', icon: CalendarCog },
    { label: 'Lịch sử', href: '/manager/scheduling/history', icon: History },
];

export default function SchedulingLayout({ children }: { children: React.ReactNode }) {
    return <TabbedLayout tabs={tabs}>{children}</TabbedLayout>;
}
