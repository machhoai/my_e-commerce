'use client';

import TabbedLayout, { TabItem } from '@/components/layout/TabbedLayout';
import { Warehouse, Download, Truck, BookOpen, BarChart3, ClipboardList } from 'lucide-react';

const tabs: TabItem[] = [
    { label: 'Tổng quan', href: '/admin/inventory/overview', icon: BarChart3 },
    { label: 'Tồn kho tổng', href: '/admin/inventory/stock', icon: Warehouse },
    { label: 'Nhập kho', href: '/admin/inventory/import', icon: Download },
    { label: 'Duyệt xuất kho', href: '/admin/inventory/dispatch', icon: Truck },
    { label: 'Lịch sử đơn hàng', href: '/admin/inventory/history', icon: ClipboardList },
    { label: 'Thẻ kho', href: '/admin/inventory/ledger', icon: BookOpen },
];

export default function AdminInventoryLayout({ children }: { children: React.ReactNode }) {
    return <TabbedLayout tabs={tabs}>{children}</TabbedLayout>;
}
