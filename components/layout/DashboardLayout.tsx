'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { Calendar, Users, Settings as SettingsIcon, LogOut, KeyRound, Menu, X, User, Building2, Bell, BarChart3, Package, ScanBarcode, Store, Warehouse } from 'lucide-react';
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

    // Fetch store name (only relevant for STORE context users)
    useEffect(() => {
        const isStoreCtx = userDoc?.workplaceType === 'STORE' || (!userDoc?.workplaceType && userDoc?.storeId && userDoc?.role !== 'admin');
        if (isStoreCtx && userDoc?.storeId) {
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


    // Determine effective location context
    // Admin sees everything; workplaceType drives context for other roles
    const isAdmin = userDoc?.role === 'admin';
    const isSuperAdmin = userDoc?.role === 'super_admin';
    const isOfficeContext = !isAdmin && !isSuperAdmin && (userDoc?.workplaceType === 'OFFICE' || userDoc?.role === 'office');
    const isCentralContext = !isAdmin && !isSuperAdmin && userDoc?.workplaceType === 'CENTRAL';
    // Default: STORE context (legacy users without workplaceType are treated as STORE)
    const isStoreContext = !isAdmin && !isSuperAdmin && !isOfficeContext && !isCentralContext;

    const routes = [
        // ── Employee self-service (Store context only, non-admin) ──
        {
            label: 'Lịch của tôi',
            href: '/employee/dashboard',
            icon: Calendar,
            show: isStoreContext,
        },
        {
            label: 'Đăng ký ca làm',
            href: '/employee/register',
            icon: Calendar,
            show: isStoreContext,
        },
        {
            label: 'KPI của tôi',
            href: '/employee/kpi-stats',
            icon: BarChart3,
            show: isStoreContext,
        },
        {
            label: 'Kho quầy',
            href: '/employee/inventory/usage',
            icon: ScanBarcode,
            show: isStoreContext,
            matchPrefix: '/employee/inventory',
        },
        {
            label: 'Hồ sơ cá nhân',
            href: '/profile',
            icon: User,
            show: isStoreContext || isOfficeContext,
        },

        // ── Nhân sự & Xếp lịch (Store managers + admin/superadmin) ──
        {
            label: 'Lịch làm việc',
            href: '/manager/scheduling/overview',
            icon: Calendar,
            show: isAdmin || isSuperAdmin ||
                (isStoreContext && (
                    userDoc?.role === 'store_manager' ||
                    hasPermission('view_overview') ||
                    hasPermission('view_schedule') ||
                    hasPermission('edit_schedule') ||
                    hasPermission('view_history')
                )),
            matchPrefix: '/manager/scheduling',
            group: 'Nhân sự',
        },
        {
            label: 'Nhân sự & KPI',
            href: '/manager/hr/users',
            icon: Users,
            show: isAdmin || isSuperAdmin ||
                (isStoreContext && (
                    userDoc?.role === 'store_manager' ||
                    hasPermission('manage_hr') ||
                    hasPermission('view_users') ||
                    hasPermission('score_employees') ||
                    hasPermission('view_all_kpi')
                )),
            matchPrefix: '/manager/hr',
            group: 'Nhân sự',
        },

        // ── Kho hàng - Cửa hàng ──
        {
            label: 'Quản lý Kho',
            href: '/manager/inventory/order',
            icon: Package,
            show: isAdmin || isSuperAdmin ||
                (isStoreContext && (
                    userDoc?.role === 'store_manager' ||
                    hasPermission('view_inventory') ||
                    hasPermission('create_order')
                )),
            matchPrefix: '/manager/inventory',
            group: 'Kho hàng',
        },

        // ── Kho tổng (Central + admin + perms) ──
        {
            label: 'Kho tổng',
            href: '/admin/inventory/stock',
            icon: Package,
            show: isAdmin || isSuperAdmin || isCentralContext || hasPermission('manage_central_warehouse'),
            matchPrefix: '/admin/inventory',
            group: 'Kho hàng',
        },

        // ── Văn phòng ──
        {
            label: 'Duyệt lệnh VP',
            href: '/office/inventory/approvals',
            icon: Package,
            show: isAdmin || isSuperAdmin || isOfficeContext || hasPermission('approve_office_order') || hasPermission('reject_office_order'),
            matchPrefix: '/office/inventory',
            group: 'Văn phòng',
        },

        // ── Hệ thống (Admin + Super Admin) ──
        {
            label: 'Quản lý Cửa hàng',
            href: '/admin/settings/stores',
            icon: Store,
            show: isAdmin || isSuperAdmin,
            group: 'Hệ thống',
        },
        {
            label: 'Quản lý Văn phòng',
            href: '/admin/offices',
            icon: Building2,
            show: isAdmin || isSuperAdmin,
            group: 'Hệ thống',
        },
        {
            label: 'Quản lý Kho tổng',
            href: '/admin/warehouses',
            icon: Warehouse,
            show: isAdmin || isSuperAdmin,
            group: 'Hệ thống',
        },
        {
            label: 'Quản lý Người dùng',
            href: '/admin/users',
            icon: Users,
            show: isAdmin || isSuperAdmin,
            group: 'Hệ thống',
        },
        {
            label: 'Cài đặt hệ thống',
            href: '/admin/settings/general',
            icon: SettingsIcon,
            show: isAdmin || isSuperAdmin,
            matchPrefix: '/admin/settings',
            group: 'Hệ thống',
        },
        {
            label: 'Cài đặt cửa hàng',
            href: '/manager/settings',
            icon: SettingsIcon,
            show: isStoreContext && userDoc?.role === 'store_manager',
            group: 'Hệ thống',
        },
    ];

    const roleLabelMap: Record<string, string> = {
        super_admin: 'siêu quản trị',
        admin: 'quản trị viên',
        store_manager: 'cửa hàng trưởng',
        manager: 'quản lý',
        employee: 'nhân viên',
        office: 'văn phòng',
    };

    const roleBadgeClass: Record<string, string> = {
        super_admin: 'bg-yellow-500/20 text-yellow-300',
        admin: 'bg-red-500/20 text-red-400',
        store_manager: 'bg-purple-500/20 text-purple-400',
        manager: 'bg-amber-500/20 text-amber-400',
        employee: 'bg-green-500/20 text-green-400',
        office: 'bg-teal-500/20 text-teal-400',
    };

    const isNotificationsActive = pathname === '/notifications';

    // Build grouped visible routes
    const visibleRoutes = routes.filter(r => r.show);

    const SidebarContent = () => (
        <div className="flex flex-col h-full">
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

            <nav className="flex-1 px-4 space-y-1 mt-2 overflow-y-auto">
                {(() => {
                    let lastGroup = '';
                    return visibleRoutes.map((route) => {
                        const isActive = route.matchPrefix
                            ? pathname.startsWith(route.matchPrefix)
                            : pathname.startsWith(route.href);

                        // Render group header if new group
                        const showGroupHeader = route.group && route.group !== lastGroup;
                        if (route.group) lastGroup = route.group;

                        return (
                            <div key={route.href}>
                                {showGroupHeader && (
                                    <div className="pt-4 mt-2 pb-1 px-3 first:pt-0">
                                        <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">{route.group}</p>
                                    </div>
                                )}
                                <Link
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
                            </div>
                        );
                    });
                })()}

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
        </div>
    );

    return (
        <div className="flex bg-slate-50 h-screen">
            {/* Desktop Sidebar */}
            <aside className="hidden md:flex w-64 bg-slate-900 border-r border-slate-800 text-slate-100 flex-col shrink-0">
                <SidebarContent />
            </aside>

            {/* Mobile Drawer Overlay */}
            {mobileOpen && (
                <div className="md:hidden fixed inset-0 z-[100] flex">
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
            <main className="flex-1 h-screen overflow-y-scroll flex flex-col">
                <div className="mx-auto px-4 md:px-8 pb-4 md:pb-8 w-full">
                    {children}
                </div>
            </main>

            {/* Mobile Floating Hamburger Button */}
            {!mobileOpen && (
                <button
                    className="md:hidden fixed bottom-5 left-5 z-30 w-12 h-12 bg-slate-900 text-white rounded-full shadow-lg shadow-slate-900/40 flex items-center justify-center hover:bg-slate-800 active:scale-95 transition-all"
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
