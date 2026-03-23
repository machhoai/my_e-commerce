'use client';

import TabbedLayout, { TabItem } from '@/components/layout/TabbedLayout';
import { Settings, Zap, Shield, BellRing, Megaphone, ClipboardCheck } from 'lucide-react';

const tabs: TabItem[] = [
    { label: 'Cài đặt chung', href: '/admin/settings/general', icon: Settings },
    { label: 'Sự kiện', href: '/admin/settings/events', icon: Zap },
    { label: 'Phân quyền', href: '/admin/settings/roles', icon: Shield },
    { label: 'Mẫu thông báo', href: '/admin/settings/notifications', icon: BellRing },
    { label: 'Gửi thông báo', href: '/admin/settings/broadcast', icon: Megaphone },
    { label: 'Mẫu KPI', href: '/admin/settings/kpi-templates', icon: ClipboardCheck },
];

export default function AdminSettingsLayout({ children }: { children: React.ReactNode }) {
    return <TabbedLayout tabs={tabs}>{children}</TabbedLayout>;
}
