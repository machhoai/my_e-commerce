'use client';

import TabbedLayout, { TabItem } from '@/components/layout/TabbedLayout';
import { Users, ClipboardCheck, BarChart3 } from 'lucide-react';

const tabs: TabItem[] = [
    { label: 'Nhân viên', href: '/manager/hr/users', icon: Users },
    { label: 'Chấm điểm', href: '/manager/hr/kpi-scoring', icon: ClipboardCheck },
    { label: 'Thống kê KPI', href: '/manager/hr/kpi-stats', icon: BarChart3 },
];

export default function HrLayout({ children }: { children: React.ReactNode }) {
    return <TabbedLayout tabs={tabs}>{children}</TabbedLayout>;
}
