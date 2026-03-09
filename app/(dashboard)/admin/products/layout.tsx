'use client';

import TabbedLayout, { TabItem } from '@/components/layout/TabbedLayout';
import { Package, Layers } from 'lucide-react';

const tabs: TabItem[] = [
    { label: 'Sản phẩm', href: '/admin/products/products', icon: Package },
    { label: 'Danh mục', href: '/admin/products/categories', icon: Layers },
];

export default function AdminProductsLayout({ children }: { children: React.ReactNode }) {
    return <TabbedLayout tabs={tabs}>{children}</TabbedLayout>;
}
