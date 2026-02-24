'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { Calendar, Users, Settings as SettingsIcon, LogOut, KeyRound } from 'lucide-react';
import { cn } from '@/lib/utils';

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
    const { userDoc, logout } = useAuth();
    const pathname = usePathname();

    if (!userDoc) return null;

    const routes = [
        {
            label: 'My Schedule',
            href: '/employee/dashboard',
            icon: Calendar,
            show: true, // Everyone sees their schedule
        },
        {
            label: 'Register Shifts',
            href: '/employee/register',
            icon: Calendar,
            show: true,
        },
        {
            label: 'Manager Schedule',
            href: '/manager/schedule',
            icon: Users,
            show: ['admin', 'manager'].includes(userDoc.role),
        },
        {
            label: 'User Management',
            href: '/admin/users',
            icon: Users,
            show: userDoc.role === 'admin',
        },
        {
            label: 'Global Settings',
            href: '/admin/settings',
            icon: SettingsIcon,
            show: userDoc.role === 'admin',
        },
    ];

    return (
        <div className="flex bg-slate-50 min-h-screen">
            {/* Sidebar */}
            <aside className="w-64 bg-slate-900 border-r border-slate-800 text-slate-100 flex flex-col">
                <div className="p-6">
                    <h1 className="text-xl font-bold bg-gradient-to-r from-blue-400 to-indigo-400 bg-clip-text text-transparent">
                        SchedulePro
                    </h1>
                    <p className="text-sm mt-2 text-slate-400">
                        Welcome, {userDoc.name || 'User'}
                    </p>
                    <p className="text-xs text-slate-500 uppercase flex items-center gap-1 mt-1">
                        <span className={cn(
                            "px-1.5 py-0.5 rounded text-[10px] font-bold",
                            userDoc.role === 'admin' ? "bg-red-500/20 text-red-400" :
                                userDoc.role === 'manager' ? "bg-amber-500/20 text-amber-400" :
                                    "bg-green-500/20 text-green-400"
                        )}>
                            {userDoc.role}
                        </span>
                        {userDoc.type && (
                            <span className="bg-slate-800 px-1.5 py-0.5 rounded text-[10px] font-bold">
                                {userDoc.type}
                            </span>
                        )}
                    </p>
                </div>

                <nav className="flex-1 px-4 space-y-2 mt-4">
                    {routes.filter(r => r.show).map((route) => {
                        const isActive = pathname.startsWith(route.href);
                        return (
                            <Link
                                key={route.href}
                                href={route.href}
                                className={cn(
                                    "flex items-center gap-3 px-3 py-2 rounded-md transition-colors text-sm font-medium",
                                    isActive
                                        ? "bg-blue-600 text-white"
                                        : "text-slate-400 hover:text-slate-100 hover:bg-slate-800"
                                )}
                            >
                                <route.icon className="w-4 h-4" />
                                {route.label}
                            </Link>
                        );
                    })}
                </nav>

                <div className="p-4 border-t border-slate-800 space-y-2">
                    <Link
                        href="/change-password"
                        className="flex w-full items-center gap-3 px-3 py-2 rounded-md text-slate-400 hover:text-slate-100 hover:bg-slate-800 transition-colors text-sm"
                    >
                        <KeyRound className="w-4 h-4" />
                        Change Password
                    </Link>
                    <button
                        onClick={logout}
                        className="flex w-full items-center gap-3 px-3 py-2 rounded-md text-red-400 hover:text-red-300 hover:bg-red-950/30 transition-colors text-sm"
                    >
                        <LogOut className="w-4 h-4" />
                        Sign Out
                    </button>
                </div>
            </aside>

            {/* Main Content */}
            <main className="flex-1 p-8 h-screen overflow-y-auto">
                <div className="max-w-6xl mx-auto">
                    {children}
                </div>
            </main>
        </div>
    );
}
