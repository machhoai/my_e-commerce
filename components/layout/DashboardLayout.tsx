'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { Calendar, Users, Settings as SettingsIcon, LogOut, KeyRound, Menu, X, User, Building2, Shield, BellRing, Zap, Bell } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useState, useEffect } from 'react';
import { doc, getDoc, collection, query, where, onSnapshot } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { StoreDoc } from '@/types';

import { usePushNotifications } from '@/hooks/usePushNotifications';

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
    const { user, userDoc, logout, loading, hasPermission } = useAuth();
    const pathname = usePathname();
    const [mobileOpen, setMobileOpen] = useState(false);
    const [storeName, setStoreName] = useState<string>('');
    const [unreadCount, setUnreadCount] = useState(0);

    // Initialize Push Notifications hook (handles permission request and saving token)
    usePushNotifications();

    // Fetch store name
    useEffect(() => {
        if (userDoc?.storeId && userDoc.role !== 'admin') {
            const fetchStore = async () => {
                try {
                    const snap = await getDoc(doc(db, 'stores', userDoc.storeId!));
                    if (snap.exists()) {
                        setStoreName((snap.data() as StoreDoc).name);
                    }
                } catch (err) {
                    console.error("Failed to fetch store:", err);
                }
            };
            fetchStore();
        }
    }, [userDoc]);

    // Real-time unread notification count for sidebar badge
    useEffect(() => {
        if (!user) return;

        const q = query(
            collection(db, 'notifications'),
            where('userId', '==', user.uid),
            where('isRead', '==', false)
        );

        const unsubscribe = onSnapshot(q, (snapshot) => {
            setUnreadCount(snapshot.size);
        }, (error) => {
            console.error("Error listening to unread notifications:", error);
        });

        return () => unsubscribe();
    }, [user]);

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-slate-950">
                <div className="flex flex-col items-center gap-3">
                    <div className="w-10 h-10 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
                    <p className="text-slate-400 text-sm">Đang tải...</p>
                </div>
            </div>
        );
    }

    if (!userDoc) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-slate-950">
                <div className="flex flex-col items-center gap-4 text-center px-4">
                    <div className="w-10 h-10 border-4 border-red-500 border-t-transparent rounded-full animate-spin" />
                    <p className="text-slate-300 text-sm">Đang kết nối...</p>
                    <button
                        onClick={logout}
                        className="text-xs text-red-400 hover:text-red-300 underline mt-2"
                    >
                        Đăng xuất
                    </button>
                </div>
            </div>
        );
    }


    const routes = [
        {
            label: 'Lịch của tôi',
            href: '/employee/dashboard',
            icon: Calendar,
            show: userDoc?.role !== 'admin',
        },
        {
            label: 'Đăng ký ca làm',
            href: '/employee/register',
            icon: Calendar,
            show: userDoc?.role !== 'admin',
        },
        {
            label: 'Hồ sơ cá nhân',
            href: '/profile',
            icon: User,
            show: userDoc?.role !== 'admin',
        },
        {
            label: 'Xếp lịch (Quản lý)',
            href: '/manager/schedule',
            icon: Users,
            show: userDoc?.role === 'admin' || userDoc?.role === 'store_manager' || hasPermission('edit_schedule') || hasPermission('view_schedule'),
        },
        {
            label: 'Lịch tổng quan',
            href: '/manager/overview',
            icon: Calendar,
            show: userDoc?.role === 'admin' || userDoc?.role === 'store_manager' || hasPermission('view_overview'),
        },
        {
            label: 'Lịch sử & Thống kê',
            href: '/manager/history',
            icon: Calendar,
            show: userDoc?.role === 'admin' || userDoc?.role === 'store_manager' || hasPermission('view_history'),
        },
        {
            label: 'Quản lý nhân viên',
            href: '/manager/users',
            icon: Users,
            show: userDoc?.role === 'admin' || userDoc?.role === 'store_manager' || hasPermission('manage_hr') || hasPermission('view_users'),
        },
        {
            label: 'Quản lý người dùng',
            href: '/admin/users',
            icon: Users,
            show: userDoc?.role === 'admin',
        },
        {
            label: 'Quản lý Cửa hàng',
            href: '/admin/stores',
            icon: Building2,
            show: userDoc?.role === 'admin',
        },
        {
            label: 'Phân quyền & Role',
            href: '/admin/roles',
            icon: Shield,
            show: userDoc?.role === 'admin',
        },
        {
            label: 'Cài đặt cửa hàng',
            href: '/manager/settings',
            icon: SettingsIcon,
            show: userDoc?.role === 'store_manager',
        },
        {
            label: 'Cài đặt hệ thống',
            href: '/admin/settings',
            icon: SettingsIcon,
            show: userDoc?.role === 'admin',
        },
        {
            label: 'Cài đặt Sự kiện',
            href: '/admin/settings/events',
            icon: Zap,
            show: userDoc?.role === 'admin',
        },
        {
            label: 'Mẫu thông báo',
            href: '/admin/notification-templates',
            icon: BellRing,
            show: userDoc?.role === 'admin',
        },
        {
            label: 'Gửi thông báo',
            href: '/admin/broadcast',
            icon: BellRing,
            show: userDoc?.role === 'admin',
        },
    ];

    const roleLabelMap: Record<string, string> = {
        admin: 'quản trị viên',
        store_manager: 'cửa hàng trưởng',
        manager: 'quản lý',
        employee: 'nhân viên',
    };

    const roleBadgeClass: Record<string, string> = {
        admin: 'bg-red-500/20 text-red-400',
        store_manager: 'bg-purple-500/20 text-purple-400',
        manager: 'bg-amber-500/20 text-amber-400',
        employee: 'bg-green-500/20 text-green-400',
    };

    const isNotificationsActive = pathname === '/notifications';

    const SidebarContent = () => (
        <>
            <div className="p-6">
                <img src="/logo.png" alt="logo" className="w-full h-16 object-contain" />
                <h1 className="text-lg font-bold text-center bg-gradient-to-r from-blue-400 to-indigo-400 bg-clip-text text-transparent">
                    Quản lí nhân sự
                </h1>
                <p className="text-sm text-center mt-2 text-slate-400">
                    Xin chào, {userDoc.name || 'Người dùng'}
                </p>
                <p className="text-xs text-slate-500 uppercase flex items-center justify-center gap-1 mt-1">
                    <span className={cn(
                        'px-1.5 py-0.5 rounded text-[10px] font-bold',
                        roleBadgeClass[userDoc.role] ?? 'bg-slate-700 text-slate-300'
                    )}>
                        {roleLabelMap[userDoc.role] ?? userDoc.role}
                    </span>
                    {userDoc.type && (
                        <span className="bg-slate-800 px-1.5 py-0.5 rounded text-[10px] font-bold">
                            {userDoc.type}
                        </span>
                    )}
                </p>
                {storeName && userDoc.role !== 'admin' && (
                    <div className="mt-3 flex items-center justify-center gap-1.5 text-xs text-indigo-400 bg-indigo-500/10 px-2.5 py-1.5 rounded-lg border border-indigo-500/20 w-fit mx-auto">
                        <Building2 className="w-3.5 h-3.5 shrink-0" />
                        <span className="font-semibold text-center leading-tight">{storeName}</span>
                    </div>
                )}
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

                {/* Notification Nav Item with Badge */}
                <Link
                    href="/notifications"
                    onClick={() => setMobileOpen(false)}
                    className={cn(
                        'flex items-center gap-3 px-3 py-2 rounded-md transition-colors text-sm font-medium',
                        isNotificationsActive
                            ? 'bg-blue-600 text-white'
                            : 'text-slate-400 hover:text-slate-100 hover:bg-slate-800'
                    )}
                >
                    <div className="relative">
                        <Bell className="w-4 h-4 shrink-0" />
                        {unreadCount > 0 && (
                            <span className="absolute -top-1.5 -right-2 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-red-500 text-[9px] font-bold text-white px-1 ring-2 ring-slate-900">
                                {unreadCount > 99 ? '99+' : unreadCount}
                            </span>
                        )}
                    </div>
                    <span className="ml-0.5">Thông báo</span>
                </Link>
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
                <div className="mt-3 pt-3 border-t border-slate-800/60 text-center">
                    <p className="text-[10px] text-slate-600 leading-tight">
                        Thiết kế &amp; phát triển bởi
                    </p>
                    <p className="text-[11px] font-semibold text-slate-500 tracking-wide mt-0.5">
                        Mạch Hoài
                    </p>
                    <p className="text-[9px] text-slate-700 mt-0.5 leading-tight">
                        IT &amp; Đào tạo
                    </p>
                    <p className="text-[9px] text-slate-700 leading-tight">
                        Công ty TNHH JoyWorld Entertainment
                    </p>
                </div>
            </div>
        </>
    );

    return (
        <div className="flex bg-slate-50 min-h-screen">
            {/* Desktop Sidebar */}
            <aside className="hidden md:flex w-64 bg-slate-900 border-r border-slate-800 text-slate-100 flex-col shrink-0">
                <SidebarContent />
            </aside>

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

            {/* Main Content — full height, no header */}
            <main className="flex-1 h-screen overflow-y-auto flex flex-col">
                <div className="mx-auto p-4 md:p-8 w-full">
                    {children}
                </div>
            </main>

            {/* Mobile Floating Hamburger Button */}
            {!mobileOpen && (
                <button
                    className="md:hidden fixed bottom-5 right-5 z-30 w-12 h-12 bg-slate-900 text-white rounded-full shadow-lg shadow-slate-900/40 flex items-center justify-center hover:bg-slate-800 active:scale-95 transition-all"
                    onClick={() => setMobileOpen(true)}
                    aria-label="Mở menu"
                >
                    <Menu className="w-5 h-5" />
                    {unreadCount > 0 && (
                        <span className="absolute -top-1 -right-1 flex h-5 min-w-[20px] items-center justify-center rounded-full bg-red-500 text-[10px] font-bold text-white px-1 ring-2 ring-slate-50">
                            {unreadCount > 99 ? '99+' : unreadCount}
                        </span>
                    )}
                </button>
            )}
        </div>
    );
}
