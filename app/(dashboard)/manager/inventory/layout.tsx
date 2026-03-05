'use client';

import TabbedLayout, { TabItem } from '@/components/layout/TabbedLayout';
import { ShoppingCart, ArrowRightLeft, BookOpen, BarChart3, ScanBarcode, Handshake } from 'lucide-react';

const tabs: TabItem[] = [
    { label: 'Đặt hàng', href: '/manager/inventory/order', icon: ShoppingCart },
    { label: 'Xuất quầy', href: '/manager/inventory/transfer', icon: ArrowRightLeft },
    { label: 'Tồn kho quầy', href: '/manager/inventory/counters', icon: BarChart3 },
    { label: 'Thẻ kho', href: '/manager/inventory/ledger', icon: BookOpen },
    { label: 'Quét mã vạch', href: '/manager/inventory/usage', icon: ScanBarcode },
    { label: 'Giao ca', href: '/manager/inventory/handover', icon: Handshake },
];

export default function InventoryLayout({ children }: { children: React.ReactNode }) {
    return <TabbedLayout tabs={tabs}>{children}</TabbedLayout>;
}

