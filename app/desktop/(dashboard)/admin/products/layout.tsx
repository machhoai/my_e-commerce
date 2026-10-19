'use client';

import TabbedLayout, { TabItem } from '@/components/layout/TabbedLayout';
import { Layers } from 'lucide-react';

const tabs: TabItem[] = [
    { label: 'Danh mục', href: '/admin/products/categories', icon: Layers },
];

export default function AdminProductsLayout({ children }: { children: React.ReactNode }) {
    return <TabbedLayout tabs={tabs}>{children}</TabbedLayout>;
}
