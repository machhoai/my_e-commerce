'use client';

import TabbedLayout, { TabItem } from '@/components/layout/TabbedLayout';
import { ShoppingCart, ArrowRightLeft, BookOpen, BarChart3, ScanBarcode, Handshake, PackageCheck } from 'lucide-react';

const tabs: TabItem[] = [
    { label: 'Đặt hàng', href: '/manager/inventory/order', icon: ShoppingCart },
    { label: 'Nhận hàng', href: '/manager/inventory/receive', icon: PackageCheck },
    { label: 'Xuất quầy', href: '/manager/inventory/transfer', icon: ArrowRightLeft },
    { label: 'Tồn kho quầy', href: '/manager/inventory/counters', icon: BarChart3 },
    { label: 'Thẻ kho', href: '/manager/inventory/ledger', icon: BookOpen },
    { label: 'Quét mã vạch', href: '/manager/inventory/usage', icon: ScanBarcode },
    { label: 'Giao ca', href: '/manager/inventory/handover', icon: Handshake },
];

export default function InventoryLayout({ children }: { children: React.ReactNode }) {
    return <TabbedLayout tabs={tabs}>{children}</TabbedLayout>;
}

