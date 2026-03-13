'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { Calendar, Users, Settings as SettingsIcon, LogOut, KeyRound, Menu, X, User, Building2, Bell, BarChart3, Package, ScanBarcode, Store, Warehouse, ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useState, useEffect } from 'react';
import { doc, getDoc, collection, query, where, onSnapshot } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { StoreDoc } from '@/types';

import { usePushNotifications } from '@/hooks/usePushNotifications';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
    const { user, userDoc, logout, loading, hasPermission } = useAuth();
    const pathname = usePathname();
    const [mobileOpen, setMobileOpen] = useState(false);
    const [storeName, setStoreName] = useState<string>('');
    const [unreadCount, setUnreadCount] = useState(0);

    const [expandedGroups, setExpandedGroups] = useState<string[]>(['Nhân sự', 'Kho hàng', 'Văn phòng', 'Hệ thống']);

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
            <div className="min-h-screen flex items-center justify-center bg-surface-950">
                <div className="flex flex-col items-center gap-3">
                    <div className="w-10 h-10 border-4 border-primary-500 border-t-transparent rounded-full animate-spin" />
                    <p className="text-surface-400 text-sm">Đang tải...</p>
                </div>
            </div>
        );
    }

    if (!userDoc) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-surface-950">
                <div className="flex flex-col items-center gap-4 text-center px-4">
                    <div className="w-10 h-10 border-4 border-danger-500 border-t-transparent rounded-full animate-spin" />
                    <p className="text-surface-300 text-sm">Đang kết nối...</p>
                    <button
                        onClick={logout}
                        className="text-xs text-danger-400 hover:text-danger-300 underline mt-2"
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
            group: 'Cá nhân',
        },
        {
            label: 'Đăng ký ca làm',
            href: '/employee/register',
            icon: Calendar,
            show: isStoreContext,
            group: 'Cá nhân',
        },
        {
            label: 'KPI của tôi',
            href: '/employee/kpi-stats',
            icon: BarChart3,
            show: isStoreContext,
            group: 'Cá nhân',
        },
        {
            label: 'Kho quầy',
            href: '/employee/inventory/usage',
            icon: ScanBarcode,
            show: isStoreContext,
            matchPrefix: '/employee/inventory',
            group: 'Cá nhân',
        },
        {
            label: 'Hồ sơ cá nhân',
            href: '/profile',
            icon: User,
            show: isStoreContext || isOfficeContext,
            group: 'Cá nhân',
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
            label: 'Kho cửa hàng',
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
            href: '/admin/inventory/overview',
            icon: Warehouse,
            show: isAdmin || isSuperAdmin || isCentralContext || hasPermission('manage_central_warehouse'),
            matchPrefix: '/admin/inventory',
            group: 'Kho hàng',
        },

        // ── Sản phẩm ──
        {
            label: 'Sản phẩm',
            href: '/admin/products/products',
            icon: Package,
            show: isAdmin || isSuperAdmin || isCentralContext || hasPermission('manage_central_warehouse'),
            matchPrefix: '/admin/products',
            group: 'Kho hàng',
        },

        // ── Văn phòng ──
        {
            label: 'Duyệt lệnh',
            href: '/office/inventory/approvals',
            icon: Package,
            show: isAdmin || isSuperAdmin || isOfficeContext || hasPermission('approve_office_order') || hasPermission('reject_office_order'),
            matchPrefix: '/office/inventory',
            group: 'Văn phòng',
        },
        {
            label: 'Doanh thu',
            href: '/office/revenue',
            icon: BarChart3,
            show: isAdmin || isSuperAdmin || hasPermission('view_revenue'),
            group: 'Văn phòng',
        },

        // ── Hệ thống (Admin + Super Admin) ──
        {
            label: 'Quản lý Cửa hàng',
            href: '/admin/stores',
            icon: Store,
            show: isAdmin || isSuperAdmin,
            matchPrefix: '/admin/stores',
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
        super_admin: 'Siêu Quản Trị',
        admin: 'Quản Trị Viên',
        store_manager: 'Cửa Hàng Trưởng',
        manager: 'Quản Lý',
        employee: 'Nhân Viên',
        office: 'Văn Phòng',
    };

    const roleBadgeClass: Record<string, string> = {
        super_admin: 'bg-yellow-500/20 text-yellow-500',
        admin: 'bg-success-500/20 text-success-500',
        store_manager: 'bg-accent-500/20 text-accent-400',
        manager: 'bg-warning-500/20 text-warning-400',
        employee: 'bg-primary-500/20 text-primary-400',
        office: 'bg-teal-500/20 text-teal-400',
    };

    const isNotificationsActive = pathname === '/notifications';

    // Build grouped visible routes
    const visibleRoutes = routes.filter(r => r.show);

    const toggleGroup = (title: string) => {
        setExpandedGroups((prev) =>
            prev.includes(title) ? prev.filter((t) => t !== title) : [...prev, title]
        );
    };

    const SidebarContent = () => {
        // Group visible routes
        const groups: { title: string, items: typeof visibleRoutes }[] = [];
        const groupOrder = ['Cá nhân', 'Nhân sự', 'Kho hàng', 'Văn phòng', 'Hệ thống'];

        groupOrder.forEach(gTitle => {
            const items = visibleRoutes.filter(r => r.group === gTitle);
            if (items.length > 0) {
                groups.push({ title: gTitle, items });
            }
        });

        // Add ungrouped items
        const ungroupedItems = visibleRoutes.filter(r => !r.group);
        if (ungroupedItems.length > 0) {
            groups.push({ title: 'Khác', items: ungroupedItems });
        }

        const getInitials = (name: string) => {
            if (!name) return 'U';
            const parts = name.split(' ').filter(Boolean);
            if (parts.length >= 2) {
                return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
            }
            return name.substring(0, 2).toUpperCase();
        };

        return (
            <div className="flex flex-col h-full bg-surface-950 text-surface-100">
                {/* Header/Branding */}
                <div className="border-surface-800 pt-2 shrink-0">
                    <div className="flex items-center h-16 w-full gap-3">
                        <img src="/logo.png" alt="" className="h-full w-full object-contain" />
                    </div>
                </div>

                {/* User Profile */}
                <div className="border-b border-surface-800 p-4 shrink-0">
                    <div className="flex items-center gap-3">
                        <Avatar className="size-10 border-2 border-surface-700">
                            <AvatarImage src="/placeholder-user.jpg" alt="User" />
                            <AvatarFallback className="bg-surface-800 text-surface-300 text-sm font-semibold">{getInitials(userDoc.name)}</AvatarFallback>
                        </Avatar>
                        <div className="flex-1 min-w-0">
                            <p className="text-sm text-surface-400">Xin chào,</p>
                            <p className="font-medium truncate">{userDoc.name || 'Người dùng'}</p>
                        </div>
                        <div className="space-y-0.5">
                            <button
                                onClick={logout}
                                className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm text-danger-400/90 hover:bg-danger-950/30 hover:text-danger-400 transition-colors"
                            >
                                <LogOut className="size-5" />
                            </button>
                        </div>
                    </div>
                    <div className="mt-3 flex flex-wrap gap-2">
                        <span className={cn(
                            "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium",
                            roleBadgeClass[userDoc.role] ?? 'bg-surface-800 text-surface-300'
                        )}>
                            {roleLabelMap[userDoc.role] ?? userDoc.role}
                        </span>
                        {storeName && userDoc.role !== 'admin' && (
                            <span className="inline-flex items-center gap-1 rounded-full border border-surface-700 px-2.5 py-0.5 text-xs text-surface-300">
                                <Building2 className="size-3" />
                                <span className="max-w-[120px] truncate">{storeName}</span>
                            </span>
                        )}
                        {userDoc.type && (
                            <span className="inline-flex items-center rounded-full bg-surface-800 px-2.5 py-0.5 text-xs text-surface-300 font-medium">
                                {userDoc.type}
                            </span>
                        )}
                    </div>
                </div>

                {/* Navigation */}
                <nav className="flex-1 overflow-y-auto p-3 custom-scrollbar">
                    {groups.map((group) => (
                        <div key={group.title} className="mb-2">
                            <button
                                onClick={() => toggleGroup(group.title)}
                                className="flex w-full items-center justify-between rounded-md px-2 py-1.5 text-xs font-medium uppercase tracking-wider text-surface-500 hover:text-surface-300 transition-colors"
                            >
                                {group.title}
                                <ChevronDown
                                    className={cn(
                                        "size-3.5 transition-transform duration-200",
                                        expandedGroups.includes(group.title) ? "rotate-0" : "-rotate-90"
                                    )}
                                />
                            </button>
                            {expandedGroups.includes(group.title) && (
                                <div className="mt-1 space-y-0.5">
                                    {group.items.map((route) => {
                                        const isActive = route.matchPrefix
                                            ? pathname.startsWith(route.matchPrefix)
                                            : pathname.startsWith(route.href);

                                        return (
                                            <Link
                                                key={route.href}
                                                href={route.href}
                                                onClick={() => setMobileOpen(false)}
                                                className={cn(
                                                    "flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors",
                                                    isActive
                                                        ? "bg-success-600/20 text-success-400 font-medium"
                                                        : "text-surface-400 hover:bg-surface-800/50 hover:text-surface-200"
                                                )}
                                            >
                                                <route.icon className={cn("size-4 shrink-0", isActive && "text-success-400")} />
                                                <span>{route.label}</span>
                                            </Link>
                                        );
                                    })}
                                </div>
                            )}
                        </div>
                    ))}

                    {/* Notifications */}
                    <div className="mt-2 border-t border-surface-800 pt-2">
                        <Link
                            href="/notifications"
                            onClick={() => setMobileOpen(false)}
                            className={cn(
                                "flex items-center justify-between rounded-lg px-3 py-2 text-sm transition-colors",
                                isNotificationsActive
                                    ? "bg-surface-800 text-white font-medium"
                                    : "text-surface-400 hover:bg-surface-800/50 hover:text-surface-200"
                            )}
                        >
                            <div className="flex items-center gap-3">
                                <Bell className={cn("size-4", isNotificationsActive && "text-success-500")} />
                                <span>Thông báo</span>
                            </div>
                            {unreadCount > 0 && (
                                <span className="flex size-5 items-center justify-center rounded-full bg-danger-500 text-[10px] font-bold text-white">
                                    {unreadCount > 99 ? '99+' : unreadCount}
                                </span>
                            )}
                        </Link>
                        <Link
                            href="/change-password"
                            onClick={() => setMobileOpen(false)}
                            className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm text-surface-400 hover:bg-surface-800/50 hover:text-surface-200 transition-colors"
                        >
                            <KeyRound className="size-4" />
                            <span>Đổi mật khẩu</span>
                        </Link>
                    </div>
                </nav>

                {/* Footer */}
                <div className="p-2 shrink-0">
                    <p className="px-3 text-[10px] text-surface-500/70 text-center">
                        Thiết kế & phát triển bởi Mạch Hoài
                    </p>
                </div>
            </div>
        );
    };

    return (
        <div className="flex bg-surface-50 h-screen">
            {/* Desktop Sidebar */}
            <aside className="hidden md:flex w-64 bg-surface-950 border-r border-surface-800 text-surface-100 flex-col shrink-0">
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
                    <aside className="relative z-50 w-72 bg-surface-950 text-surface-100 flex flex-col animate-in slide-in-from-left-4 duration-200 overflow-hidden">
                        <button
                            className="absolute top-4 right-4 text-surface-400 hover:text-surface-100 p-1 z-50 rounded-lg bg-surface-800/50"
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
            <main className="flex-1 h-screen overflow-hidden flex flex-col bg-surface-50/50">
                <div className="flex-1 overflow-y-auto w-full p-4 custom-scrollbar">
                    {children}
                </div>
            </main>

            {/* Mobile Combined FAB Group — Scan (primary) + Menu (secondary) */}
            {!mobileOpen && (
                <div className="md:hidden fixed bottom-5 right-5 z-30 flex flex-col items-center gap-2.5">
                    {/* Secondary: Menu button (smaller, above scan) */}
                    <button
                        className="relative w-10 h-10 bg-surface-900/90 backdrop-blur-sm text-white rounded-full shadow-lg shadow-surface-900/30 flex items-center justify-center hover:bg-surface-800 active:scale-90 transition-all outline-none"
                        onClick={() => setMobileOpen(true)}
                        aria-label="Mở menu"
                    >
                        <Menu className="w-4 h-4" />
                        {unreadCount > 0 && (
                            <span className="absolute -top-1 -right-1 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-danger-500 text-[9px] font-bold text-white px-0.5 ring-2 ring-white">
                                {unreadCount > 99 ? '99+' : unreadCount}
                            </span>
                        )}
                    </button>

                    {/* Primary: Scan button (large, prominent) */}
                    <Link
                        href="/scan"
                        className={cn(
                            "w-14 h-14 bg-gradient-to-br from-accent-600 to-accent-700 text-white rounded-full shadow-xl shadow-accent-600/40 flex items-center justify-center hover:from-accent-700 hover:to-accent-800 active:scale-90 transition-all outline-none",
                            pathname === '/scan' && "ring-3 ring-accent-300 ring-offset-2"
                        )}
                        aria-label="Quét mã sản phẩm"
                    >
                        <ScanBarcode className="w-6 h-6" />
                    </Link>
                </div>
            )}
        </div>
    );
}
