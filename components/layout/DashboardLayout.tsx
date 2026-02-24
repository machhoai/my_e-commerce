'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { Calendar, Users, Settings as SettingsIcon, LogOut, KeyRound, Menu, X, User } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useState } from 'react';

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
    const { userDoc, logout } = useAuth();
    const pathname = usePathname();
    const [mobileOpen, setMobileOpen] = useState(false);

    if (!userDoc) return null;

    const routes = [
        {
            label: 'Lịch của tôi',
            href: '/employee/dashboard',
            icon: Calendar,
            show: true,
        },
        {
            label: 'Đăng ký ca làm',
            href: '/employee/register',
            icon: Calendar,
            show: true,
        },
        {
            label: 'Hồ sơ cá nhân',
            href: '/profile',
            icon: User,
            show: true,
        },
        {
            label: 'Xếp lịch (Quản lý)',
            href: '/manager/schedule',
            icon: Users,
            show: ['admin', 'manager'].includes(userDoc.role),
        },
        {
            label: 'Quản lý nhân viên',
            href: '/manager/users',
            icon: Users,
            show: ['admin', 'manager'].includes(userDoc.role),
        },
        {
            label: 'Quản lý người dùng',
            href: '/admin/users',
            icon: Users,
            show: userDoc.role === 'admin',
        },
        {
            label: 'Cài đặt hệ thống',
            href: '/admin/settings',
            icon: SettingsIcon,
            show: userDoc.role === 'admin',
        },
    ];

    const roleLabelMap: Record<string, string> = {
        admin: 'admin',
        manager: 'quản lý',
        employee: 'nhân viên',
    };

    const SidebarContent = () => (
        <>
            <div className="p-6">
                <h1 className="text-xl font-bold bg-gradient-to-r from-blue-400 to-indigo-400 bg-clip-text text-transparent">
                    SchedulePro
                </h1>
                <p className="text-sm mt-2 text-slate-400">
                    Xin chào, {userDoc.name || 'Người dùng'}
                </p>
                <p className="text-xs text-slate-500 uppercase flex items-center gap-1 mt-1">
                    <span className={cn(
                        'px-1.5 py-0.5 rounded text-[10px] font-bold',
                        userDoc.role === 'admin' ? 'bg-red-500/20 text-red-400' :
                            userDoc.role === 'manager' ? 'bg-amber-500/20 text-amber-400' :
                                'bg-green-500/20 text-green-400'
                    )}>
                        {roleLabelMap[userDoc.role] ?? userDoc.role}
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
                            onClick={() => setMobileOpen(false)}
                            className={cn(
                                'flex items-center gap-3 px-3 py-2 rounded-md transition-colors text-sm font-medium',
                                isActive
                                    ? 'bg-blue-600 text-white'
                                    : 'text-slate-400 hover:text-slate-100 hover:bg-slate-800'
                            )}
                        >
                            <route.icon className="w-4 h-4 shrink-0" />
                            {route.label}
                        </Link>
                    );
                })}
            </nav>

            <div className="p-4 border-t border-slate-800 space-y-2">
                <Link
                    href="/change-password"
                    onClick={() => setMobileOpen(false)}
                    className="flex w-full items-center gap-3 px-3 py-2 rounded-md text-slate-400 hover:text-slate-100 hover:bg-slate-800 transition-colors text-sm"
                >
                    <KeyRound className="w-4 h-4" />
                    Đổi mật khẩu
                </Link>
                <button
                    onClick={logout}
                    className="flex w-full items-center gap-3 px-3 py-2 rounded-md text-red-400 hover:text-red-300 hover:bg-red-950/30 transition-colors text-sm"
                >
                    <LogOut className="w-4 h-4" />
                    Đăng xuất
                </button>
            </div>
        </>
    );

    return (
        <div className="flex bg-slate-50 min-h-screen">
            {/* Desktop Sidebar */}
            <aside className="hidden md:flex w-64 bg-slate-900 border-r border-slate-800 text-slate-100 flex-col shrink-0">
                <SidebarContent />
            </aside>

            {/* Mobile Hamburger Button */}
            <button
                className="md:hidden fixed top-4 left-4 z-50 bg-slate-900 text-slate-100 p-2 rounded-lg shadow-lg border border-slate-800"
                onClick={() => setMobileOpen(true)}
                aria-label="Mở menu"
            >
                <Menu className="w-5 h-5" />
            </button>

            {/* Mobile Drawer Overlay */}
            {mobileOpen && (
                <div className="md:hidden fixed inset-0 z-40 flex">
                    {/* Backdrop */}
                    <div
                        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
                        onClick={() => setMobileOpen(false)}
                    />
                    {/* Drawer */}
                    <aside className="relative z-50 w-72 bg-slate-900 text-slate-100 flex flex-col animate-in slide-in-from-left-4 duration-200">
                        <button
                            className="absolute top-4 right-4 text-slate-400 hover:text-slate-100 p-1"
                            onClick={() => setMobileOpen(false)}
                            aria-label="Đóng menu"
                        >
                            <X className="w-5 h-5" />
                        </button>
                        <SidebarContent />
                    </aside>
                </div>
            )}

            {/* Main Content */}
            <main className="flex-1 p-4 md:p-8 h-screen overflow-y-auto">
                <div className="mx-auto pt-14 md:pt-0">
                    {children}
                </div>
            </main>
        </div>
    );
}
