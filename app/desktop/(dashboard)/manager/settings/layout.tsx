'use client';

import TabbedLayout, { TabItem } from '@/components/layout/TabbedLayout';
import { Settings, ClipboardCheck } from 'lucide-react';

const tabs: TabItem[] = [
    { label: 'Cài đặt chung', href: '/manager/settings', icon: Settings },
    { label: 'Mẫu KPI', href: '/manager/settings/kpi-templates', icon: ClipboardCheck },
];

export default function ManagerSettingsLayout({ children }: { children: React.ReactNode }) {
    return <TabbedLayout tabs={tabs}>{children}</TabbedLayout>;
}
