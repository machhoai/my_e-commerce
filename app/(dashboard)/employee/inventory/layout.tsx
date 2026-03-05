'use client';

import TabbedLayout, { TabItem } from '@/components/layout/TabbedLayout';
import { ScanBarcode, Handshake } from 'lucide-react';

const tabs: TabItem[] = [
    { label: 'Quét mã vạch', href: '/employee/inventory/usage', icon: ScanBarcode },
    { label: 'Giao ca', href: '/employee/inventory/handover', icon: Handshake },
];

export default function EmployeeInventoryLayout({ children }: { children: React.ReactNode }) {
    return <TabbedLayout tabs={tabs}>{children}</TabbedLayout>;
}
