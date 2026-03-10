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
        <div className="space-y-0">
            {/* Tab Navigation Bar */}
            <div className="bg-white border-b border-slate-200 -mx-4 md:-mx-8 px-2 overflow-x-auto md:px-8 sticky top-0 z-50">
                <nav
                    className="flex gap-1 overflow-x-auto no-scrollbar py-1"
                    role="tablist"
                >
                    {tabs.map((tab) => {
                        const isActive = pathname === tab.href || pathname.startsWith(tab.href + '/');
                        return (
                            <Link
                                key={tab.href}
                                href={tab.href}
                                role="tab"
                                aria-selected={isActive}
                                className={cn(
                                    'flex flex-1 md:flex-none px-0 md:px-4 items-center gap-2 justify-center py-2 text-sm font-medium rounded-lg whitespace-nowrap transition-all duration-200 shrink-0',
                                    isActive
                                        ? 'bg-slate-900 text-white shadow-sm'
                                        : 'text-slate-500 hover:text-slate-800 hover:bg-slate-100'
                                )}
                            >
                                {tab.icon && <tab.icon className="w-4 h-4 shrink-0" />}
                                {tab.label}
                            </Link>
                        );
                    })}
                </nav>
            </div>

            {/* Page Content */}
            <div className="pt-4">
                {children}
            </div>
        </div>
    );
}
