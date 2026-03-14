'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import { LucideIcon } from 'lucide-react';

export interface TabItem {
    label: string;
    href: string;
    icon?: LucideIcon;
}

interface TabbedLayoutProps {
    tabs: TabItem[];
    children: React.ReactNode;
}

export default function TabbedLayout({ tabs, children }: TabbedLayoutProps) {
    const pathname = usePathname();

    return (
        <div className="relative">
            {/* Tab Navigation Bar — fixed, glass-morphism style */}
            <div className="flex-1 top-0 left-0 right-0 z-50 ">
                <nav
                    className="flex items-center gap-1 px-2 py-1.5 overflow-x-auto no-scrollbar"
                    role="tablist"
                >
                    {tabs.map((tab) => {
                        const isActive = pathname === tab.href || pathname.startsWith(tab.href + '/');
                        const Icon = tab.icon;
                        return (
                            <Link
                                key={tab.href}
                                href={tab.href}
                                role="tab"
                                aria-selected={isActive}
                                className={cn(
                                    'flex items-center gap-1.5 px-3.5 py-2 text-sm font-semibold rounded-lg whitespace-nowrap transition-all duration-200 shrink-0',
                                    isActive
                                        ? 'bg-primary-600 text-white shadow-md shadow-surface-900/20'
                                        : 'text-surface-500 hover:text-surface-800 hover:bg-surface-100/80'
                                )}
                            >
                                {Icon && (
                                    <Icon className={cn(
                                        'w-4 h-4 shrink-0',
                                        isActive ? 'text-white' : 'text-surface-400'
                                    )} />
                                )}
                                {tab.label}
                            </Link>
                        );
                    })}
                </nav>
            </div>

            {/* Page Content — offset for fixed tab bar */}
            <div className="pt-4">
                {children}
            </div>
        </div>
    );
}
