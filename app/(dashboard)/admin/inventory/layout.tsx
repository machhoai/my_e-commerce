'use client';

import TabbedLayout, { TabItem } from '@/components/layout/TabbedLayout';
import { Package, Layers, Warehouse, Download, Truck, BookOpen } from 'lucide-react';

const tabs: TabItem[] = [
    { label: 'Tồn kho tổng', href: '/admin/inventory/stock', icon: Warehouse },
    { label: 'Nhập kho', href: '/admin/inventory/import', icon: Download },
    { label: 'Duyệt xuất kho', href: '/admin/inventory/dispatch', icon: Truck },
    { label: 'Sản phẩm', href: '/admin/inventory/products', icon: Package },
    { label: 'Danh mục', href: '/admin/inventory/categories', icon: Layers },
    { label: 'Thẻ kho', href: '/admin/inventory/ledger', icon: BookOpen },
];

export default function AdminInventoryLayout({ children }: { children: React.ReactNode }) {
    return <TabbedLayout tabs={tabs}>{children}</TabbedLayout>;
}
