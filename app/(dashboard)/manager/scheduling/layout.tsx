'use client';

import TabbedLayout, { TabItem } from '@/components/layout/TabbedLayout';
import { Eye, CalendarCog, History, Calendar } from 'lucide-react';

const tabs: TabItem[] = [
    { label: 'Tổng quan', href: '/manager/scheduling/overview', icon: Eye },
    { label: 'Xếp ca', href: '/manager/scheduling/builder', icon: CalendarCog },
    { label: 'Lịch sử', href: '/manager/scheduling/history', icon: History },
    { label: 'Đăng ký ca', href: '/manager/scheduling/register', icon: Calendar },
];

export default function SchedulingLayout({ children }: { children: React.ReactNode }) {
    return <TabbedLayout tabs={tabs}>{children}</TabbedLayout>;
}
