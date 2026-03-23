'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { Calendar, Users, Settings as SettingsIcon, LogOut, KeyRound, Menu, X, User, Building2, Bell, BarChart3, Package, ScanBarcode, Store, Warehouse, ChevronDown, ChevronRight, ShoppingCart, ClipboardList, Ticket, CalendarDays, LayoutGrid } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useState, useEffect } from 'react';
import { doc, getDoc, collection, query, where, onSnapshot } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { StoreDoc, CustomRoleDoc } from '@/types';

import { usePushNotifications } from '@/hooks/usePushNotifications';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';

const SIDEBAR_COLLAPSED_KEY = 'sidebar-collapsed';

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
    const { user, userDoc, logout, loading, hasPermission } = useAuth();
    const pathname = usePathname();
    const [mobileOpen, setMobileOpen] = useState(false);
    const [storeName, setStoreName] = useState<string>('');
    const [unreadCount, setUnreadCount] = useState(0);
    const [customRoles, setCustomRoles] = useState<CustomRoleDoc[]>([]);
    const [isCollapsed, setIsCollapsed] = useState(() => {
        if (typeof window !== 'undefined') {
            return localStorage.getItem(SIDEBAR_COLLAPSED_KEY) === 'true';
        }
        if (mobileOpen) {
            return false;
        }
        return false;
    });

    const [expandedGroups, setExpandedGroups] = useState<string[]>(['NhÃ¢n sá»±', 'Kho hÃ ng', 'VÄƒn phÃ²ng', 'Há»‡ thá»‘ng']);

    const toggleCollapsed = () => {
        if (mobileOpen) {
            setMobileOpen(false);
        } else {
            setIsCollapsed(prev => {
                const next = !prev;
                localStorage.setItem(SIDEBAR_COLLAPSED_KEY, String(next));
                return next;
            });
        }
    };

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

    // Fetch custom roles for role name display
    useEffect(() => {
        if (!user) return;
        (async () => {
            try {
                const token = await user.getIdToken();
                const res = await fetch('/api/roles', { headers: { Authorization: `Bearer ${token}` } });
                if (res.ok) setCustomRoles(await res.json());
            } catch { /* silent */ }
        })();
    }, [user]);

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
    const isAdmin = userDoc?.role === 'admin';
    const isSuperAdmin = userDoc?.role === 'super_admin';
    const isOfficeContext = !isAdmin && !isSuperAdmin && (userDoc?.workplaceType === 'OFFICE' || userDoc?.role === 'office');
    const isCentralContext = !isAdmin && !isSuperAdmin && userDoc?.workplaceType === 'CENTRAL';
    const isStoreContext = !isAdmin && !isSuperAdmin && !isOfficeContext && !isCentralContext;

    const routes = [
        {
            label: 'Dashboard',
            href: '/dashboard',
            icon: LayoutGrid,
            show: isAdmin || isSuperAdmin || (isStoreContext && userDoc?.role === 'store_manager'),
            group: 'Cá Nhân',
        },
        {
            label: 'Lịch Của Tôi',
            href: '/employee/dashboard',
            icon: Calendar,
            show: isStoreContext,
            group: 'Cá Nhân',
        },
        {
            label: 'Đăng Ký Ca Làm',
            href: '/employee/register',
            icon: Calendar,
            show: isStoreContext,
            group: 'Cá Nhân',
        },
        {
            label: 'KPI Của Tôi',
            href: '/employee/kpi-stats',
            icon: BarChart3,
            show: isStoreContext,
            group: 'Cá Nhân',
        },
        {
            label: 'Kho Quầy',
            href: '/employee/inventory/usage',
            icon: ScanBarcode,
            show: isStoreContext,
            matchPrefix: '/employee/inventory',
            group: 'Cá Nhân',
        },
        {
            label: 'Hồ Sơ Cá Nhân',
            href: '/profile',
            icon: User,
            show: isStoreContext || isOfficeContext,
            group: 'Cá Nhân',
        },

        {
            label: 'Lịch Làm Việc',
            href: '/manager/scheduling/overview',
            icon: Calendar,
            show: isAdmin || isSuperAdmin ||
                (isStoreContext && userDoc?.role === 'store_manager') ||
                (isStoreContext && userDoc?.role === 'manager') ||
                isOfficeContext ||
                hasPermission('page.scheduling.overview'),
            matchPrefix: '/manager/scheduling',
            group: 'Nhân Sự',
        },
        {
            label: 'Đăng Ký Ca',
            href: '/manager/scheduling/register',
            icon: ClipboardList,
            show: isAdmin || isSuperAdmin ||
                (isStoreContext && userDoc?.role === 'store_manager') ||
                (isStoreContext && userDoc?.role === 'manager') ||
                isOfficeContext ||
                hasPermission('page.scheduling.register'),
            group: 'Nhân Sự',
        },
        {
            label: 'Nhân Sự & KPI',
            href: '/manager/hr/users',
            icon: Users,
            show: isAdmin || isSuperAdmin ||
                (isStoreContext && userDoc?.role === 'store_manager') ||
                (isStoreContext && userDoc?.role === 'manager') ||
                isOfficeContext ||
                hasPermission('page.hr.users'),
            matchPrefix: '/manager/hr',
            group: 'Nhân Sự',
        },

        {
            label: 'Kho Cửa Hàng',
            href: '/manager/inventory/order',
            icon: Package,
            show: isAdmin || isSuperAdmin ||
                (isStoreContext && userDoc?.role === 'store_manager') ||
                hasPermission('page.manager.inventory'),
            matchPrefix: '/manager/inventory',
            group: 'Kho Hàng',
        },
        {
            label: 'Cài Đặt Cửa Hàng',
            href: '/manager/settings',
            icon: SettingsIcon,
            show: isAdmin || isSuperAdmin ||
                (isStoreContext && userDoc?.role === 'store_manager') ||
                hasPermission('page.manager.settings'),
            matchPrefix: '/manager/settings',
            group: 'Cài Đặt',
        },
        {
            label: 'Kho Tổng',
            href: '/admin/inventory/overview',
            icon: Warehouse,
            show: isAdmin || isSuperAdmin || isCentralContext || hasPermission('page.admin.inventory'),
            matchPrefix: '/admin/inventory',
            group: 'Kho Hàng',
        },
        {
            label: 'Sản Phẩm',
            href: '/admin/products/products',
            icon: Package,
            show: isAdmin || isSuperAdmin || isCentralContext || hasPermission('page.products'),
            matchPrefix: '/admin/products',
            group: 'Kho Hàng',
        },

        {
            label: 'Duyệt Lệnh',
            href: '/office/inventory/approvals',
            icon: Package,
            show: isAdmin || isSuperAdmin || isOfficeContext ||
                hasPermission('page.office.approvals'),
            matchPrefix: '/office/inventory',
            group: 'Văn Phòng',
        },
        {
            label: 'Doanh thu',
            href: '/office/revenue',
            icon: BarChart3,
            show: isAdmin || isSuperAdmin || isOfficeContext ||
                userDoc?.role === 'office' ||
                hasPermission('page.office.revenue'),
            group: 'Văn Phòng',
        },

        {
            label: 'Quản lý Cửa Hàng',
            href: '/admin/stores',
            icon: Store,
            show: isAdmin || isSuperAdmin,
            matchPrefix: '/admin/stores',
            group: 'H\u1ec7 Th\u1ed1ng',
        },
        {
            label: 'Quản lý Văn Phòng',
            href: '/admin/offices',
            icon: Building2,
            show: isAdmin || isSuperAdmin,
            group: 'H\u1ec7 Th\u1ed1ng',
        },
        {
            label: 'Quản lý Kho Tổng',
            href: '/admin/warehouses',
            icon: Warehouse,
            show: isAdmin || isSuperAdmin,
            group: 'H\u1ec7 Th\u1ed1ng',
        },
        {
            label: 'Quản lý Người dùng',
            href: '/admin/users',
            icon: Users,
            show: isAdmin || isSuperAdmin,
            group: 'H\u1ec7 Th\u1ed1ng',
        },
        {
            label: 'Quản lý Voucher',
            href: '/admin/vouchers',
            icon: Ticket,
            show: isAdmin || isSuperAdmin || hasPermission('page.admin.vouchers'),
            matchPrefix: '/admin/vouchers',
            group: 'H\u1ec7 Th\u1ed1ng',
        },
        {
            label: 'Quản lý Sự kiện',
            href: '/admin/events',
            icon: CalendarDays,
            show: isAdmin || isSuperAdmin || hasPermission('page.admin.events'),
            matchPrefix: '/admin/events',
            group: 'H\u1ec7 Th\u1ed1ng',
        },
        {
            label: 'Cài đặt hệ thống',
            href: '/admin/settings/general',
            icon: SettingsIcon,
            show: isAdmin || isSuperAdmin,
            matchPrefix: '/admin/settings',
            group: 'H\u1ec7 Th\u1ed1ng',
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
        super_admin: 'bg-bduck-yellow/20 text-bduck-yellow border border-bduck-yellow/30',
        admin: 'bg-success-500/20 text-success-400 border border-success-500/30',
        store_manager: 'bg-accent-500/20 text-accent-300 border border-accent-500/30',
        manager: 'bg-warning-500/20 text-warning-300 border border-warning-500/30',
        employee: 'bg-primary-500/20 text-primary-300 border border-primary-500/30',
        office: 'bg-teal-500/20 text-teal-300 border border-teal-500/30',
    };

    const roleDotClass: Record<string, string> = {
        super_admin: 'bg-bduck-yellow',
        admin: 'bg-success-400',
        store_manager: 'bg-accent-400',
        manager: 'bg-warning-400',
        employee: 'bg-primary-400',
        office: 'bg-teal-400',
    };

    const groupIconMap: Record<string, React.ElementType> = {
        'Cá Nhân': User,
        'Nhân Sự': Users,
        'Kho Hàng': Package,
        'Văn Phòng': Building2,
        'Cài Đặt': SettingsIcon,
        'Hệ Thống': SettingsIcon,
        'Khác': SettingsIcon,
    };

    const isNotificationsActive = pathname === '/notifications';

    const visibleRoutes = routes.filter(r => r.show);

    const toggleGroup = (title: string) => {
        setExpandedGroups((prev) =>
            prev.includes(title) ? prev.filter((t) => t !== title) : [...prev, title]
        );
    };

    const SidebarContent = () => {
        const getInitials = (name: string) => {
            if (!name) return 'U';
            const parts = name.split(' ').filter(Boolean);
            if (parts.length >= 2) return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
            return name.substring(0, 2).toUpperCase();
        };

        if (isCollapsed) {
            // Flatten all visible routes into icon list, keep group separation
            const iconGroups: { items: typeof visibleRoutes }[] = [];
            const groupOrder = ['Cá Nhân', 'Nhân Sự', 'Kho Hàng', 'Văn Phòng', 'Cài Đặt', 'Hệ Thống'];
            groupOrder.forEach(gTitle => {
                const items = visibleRoutes.filter(r => r.group === gTitle);
                if (items.length > 0) iconGroups.push({ items });
            });
            const ungrouped = visibleRoutes.filter(r => !r.group);
            if (ungrouped.length > 0) iconGroups.push({ items: ungrouped });

            const IconLink = ({ route }: { route: typeof visibleRoutes[0] }) => {
                const isActive = route.matchPrefix
                    ? pathname.startsWith(route.matchPrefix)
                    : pathname.startsWith(route.href);
                return (
                    <Link
                        href={route.href}
                        title={route.label}
                        onClick={() => setMobileOpen(false)}
                        className={cn(
                            "flex items-center justify-center w-10 h-10 rounded-xl transition-all duration-200",
                            isActive
                                ? "bg-accent-100 text-accent-600"
                                : "text-surface-400 hover:bg-primary-200 hover:text-surface-700"
                        )}
                    >
                        <route.icon className="size-[18px]" />
                    </Link>
                );
            };

            return (
                <div className="flex flex-col h-full items-center py-3 gap-2">

                    {/* Logo + expand button */}
                    <div className="flex flex-col items-center gap-1.5 mb-1 px-1.5 w-full relative">
                        <div className="flex items-center justify-center w-10 h-10">
                            <img src="/logo.png" alt="Logo" className="w-9 h-9 object-contain" />
                        </div>
                        {
                            !mobileOpen && (
                                <button
                                    onClick={toggleCollapsed}
                                    title="Mở Rộng Sidebar"
                                    className="flex -right-2 top-1/2 -translate-y-1/2 translate-x-1/2 absolute items-center justify-center w-6 h-6 rounded-full hover:bg-primary-600 hover:text-white text-surface-700 transition-colors"
                                >
                                    <ChevronRight className="size-3.5" />
                                </button>
                            )
                        }
                    </div>

                    {/* Icon groups as cards */}
                    <div className="flex-1 flex flex-col gap-2 w-full px-1.5 overflow-y-auto custom-scrollbar">
                        {iconGroups.map((group, idx) => (
                            <div
                                key={idx}
                                className="flex w-fit flex-col items-center gap-1 bg-white rounded-2xl p-1 shadow-sm border border-surface-100"
                            >
                                {group.items.map(route => (
                                    <IconLink key={route.href} route={route} />
                                ))}
                            </div>
                        ))}

                        {/* Utility group: Notifications + Settings */}
                        <div className="flex flex-col items-center gap-1 bg-white rounded-2xl p-1 shadow-sm border border-surface-100">
                            <Link
                                href="/notifications"
                                title="Thông Báo"
                                onClick={() => setMobileOpen(false)}
                                className={cn(
                                    "relative flex items-center justify-center w-10 h-10 rounded-xl transition-all duration-200",
                                    isNotificationsActive
                                        ? "bg-accent-100 text-accent-500"
                                        : "text-surface-600 hover:bg-surface-100 hover:text-surface-600"
                                )}
                            >
                                <Bell className="size-[18px]" />
                                {unreadCount > 0 && (
                                    <span className="flex h-3.5 leading-none aspect-square items-center justify-center absolute top-0 right-0 rounded-full bg-danger-500 text-[10px] text-white">
                                        {unreadCount > 99 ? '99+' : unreadCount}
                                    </span>
                                )}
                            </Link>
                            <Link
                                href="/change-password"
                                title="Đổi Mật Khẩu"
                                onClick={() => setMobileOpen(false)}
                                className="flex items-center justify-center w-10 h-10 rounded-xl text-surface-400 hover:bg-surface-100 hover:text-surface-700 transition-all duration-200"
                            >
                                <KeyRound className="size-[18px]" />
                            </Link>
                        </div>
                    </div>

                    {/* Avatar pinned at bottom */}
                    <div className="mt-auto pt-2 flex flex-col items-center gap-1 pb-1">
                        <button
                            onClick={logout}
                            title="Đăng Xuất"
                            className="relative group"
                        >
                            <div className="p-[2px] rounded-full bg-gradient-to-br from-success-400 via-primary-500 to-accent-500">
                                <Avatar className="size-9">
                                    <AvatarImage src="/placeholder-user.jpg" alt="User" />
                                    <AvatarFallback className="bg-surface-100 text-surface-700 text-xs font-bold">
                                        {getInitials(userDoc.name)}
                                    </AvatarFallback>
                                </Avatar>
                            </div>
                            <span className="absolute bottom-0.5 right-0.5 size-2 rounded-full bg-success-400 ring-2 ring-white" />
                        </button>
                    </div>
                </div>
            );
        }

        const groups: { title: string, items: typeof visibleRoutes }[] = [];
        const groupOrder = ['Cá Nhân', 'Nhân Sự', 'Kho Hàng', 'Văn Phòng', 'Cài Đặt', 'Hệ Thống'];
        groupOrder.forEach(gTitle => {
            const items = visibleRoutes.filter(r => r.group === gTitle);
            if (items.length > 0) groups.push({ title: gTitle, items });
        });
        const ungroupedItems = visibleRoutes.filter(r => !r.group);
        if (ungroupedItems.length > 0) groups.push({ title: 'KhÃ¡c', items: ungroupedItems });

        return (
            <div className="flex flex-col h-full px-2 w-full">

                {/* Logo + collapse toggle */}
                <div className=" pt-3 pb-2 shrink-0 flex items-center">
                    <div className="flex items-center h-14 flex-1">
                        <img src="/logo.png" alt="Logo" className="h-full w-full object-contain" />
                    </div>
                    {
                        !mobileOpen && (
                            <button
                                onClick={toggleCollapsed}
                                title="Thu gọn sidebar"
                                className="flex items-center justify-center size-8 shrink-0 rounded-full bg-surface-100 text-surface-500 hover:bg-surface-200 hover:text-surface-700 transition-colors"
                            >
                                <ChevronDown className="size-3.5 rotate-90" />
                            </button>
                        )
                    }
                </div>

                {/* Profile card - light */}
                <div className="mt-3 mb-2 rounded-2xl bg-white shadow-sm p-3">
                    <div className="flex items-center gap-3">
                        <div className="relative shrink-0">
                            <div className="p-[2px] rounded-full bg-gradient-to-br from-success-400 via-primary-500 to-accent-500">
                                <Avatar className="size-10">
                                    <AvatarImage src="/placeholder-user.jpg" alt="User" />
                                    <AvatarFallback className="bg-surface-100 text-surface-700 text-sm font-bold">
                                        {getInitials(userDoc.name)}
                                    </AvatarFallback>
                                </Avatar>
                            </div>
                            <span className="absolute bottom-0 right-0 size-2.5 rounded-full bg-success-400 ring-2 ring-white" />
                        </div>
                        <div className="flex-1 min-w-0">
                            <p className="font-semibold text-sm text-surface-900 truncate leading-tight">
                                {userDoc.name || 'Người dùng'}
                            </p>
                            <p className="text-[10px] text-surface-400 truncate leading-tight mt-0.5">
                                {user?.email}
                            </p>
                        </div>
                        <button
                            onClick={logout}
                            title="Đăng xuất"
                            className="shrink-0 flex items-center justify-center size-8 rounded-lg text-surface-400 hover:text-danger-500 hover:bg-danger-50 transition-colors"
                        >
                            <LogOut className="size-4" />
                        </button>
                    </div>
                    <div className="mt-2.5 flex flex-wrap gap-1.5">
                        <span className={cn(
                            "inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[11px] font-medium",
                            (() => {
                                if (userDoc.customRoleId) {
                                    const cr = customRoles.find(r => r.id === userDoc.customRoleId);
                                    const colorMap: Record<string, string> = {
                                        red: 'bg-danger-500/20 text-danger-300 border border-danger-500/30',
                                        purple: 'bg-accent-500/20 text-accent-300 border border-accent-500/30',
                                        amber: 'bg-warning-500/20 text-warning-300 border border-warning-500/30',
                                        blue: 'bg-primary-500/20 text-primary-300 border border-primary-500/30',
                                        emerald: 'bg-success-500/20 text-success-300 border border-success-500/30',
                                        indigo: 'bg-accent-500/20 text-accent-200 border border-accent-500/30',
                                        pink: 'bg-pink-500/20 text-pink-300 border border-pink-500/30',
                                        slate: 'bg-surface-500/20 text-surface-300 border border-surface-500/30',
                                    };
                                    return colorMap[cr?.color ?? 'slate'] ?? 'bg-surface-500/20 text-surface-300 border border-surface-500/30';
                                }
                                return roleBadgeClass[userDoc.role] ?? 'bg-surface-100 text-surface-600 border border-surface-200';
                            })()
                        )}>
                            <span className={cn("size-1.5 rounded-full shrink-0", roleDotClass[userDoc.role] ?? 'bg-surface-400')} />
                            {(() => {
                                if (userDoc.customRoleId) {
                                    const cr = customRoles.find(r => r.id === userDoc.customRoleId);
                                    return cr?.name ?? roleLabelMap[userDoc.role] ?? userDoc.role;
                                }
                                return roleLabelMap[userDoc.role] ?? userDoc.role;
                            })()}
                        </span>
                        {storeName && userDoc.role !== 'admin' && (
                            <span className="inline-flex items-center gap-1 rounded-full border border-surface-200 bg-surface-50 px-2.5 py-0.5 text-[11px] text-surface-500">
                                <Building2 className="size-2.5 shrink-0" />
                                <span className="max-w-[110px] truncate">{storeName}</span>
                            </span>
                        )}
                        {userDoc.type && (
                            <span className="inline-flex items-center rounded-full bg-surface-100 px-2.5 py-0.5 text-[11px] text-surface-500">
                                {userDoc.type}
                            </span>
                        )}
                    </div>
                </div>

                {/* Navigation */}
                <nav className="flex-1 overflow-y-auto py-2 custom-scrollbar">
                    <div className="space-y-0.5">
                        {groups.map((group) => {
                            const GroupIcon = groupIconMap[group.title] ?? SettingsIcon;
                            const isExpanded = expandedGroups.includes(group.title);
                            return (
                                <div key={group.title} className="mb-1">
                                    <button
                                        onClick={() => toggleGroup(group.title)}
                                        className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-xs font-semibold uppercase tracking-wider text-surface-400 hover:text-surface-600 hover:bg-primary-200 transition-colors group/header"
                                    >
                                        <GroupIcon className="size-3 text-surface-500 group-hover/header:text-surface-500 transition-colors" />
                                        <span className="flex-1 text-left text-surface-500">{group.title}</span>
                                        <ChevronDown className={cn(
                                            "size-3 transition-transform duration-200 text-surface-500",
                                            isExpanded ? "rotate-0" : "-rotate-90"
                                        )} />
                                    </button>
                                    {isExpanded && (
                                        <div className="mt-0.5 space-y-0.5 pl-1">
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
                                                            "relative flex items-center gap-2.5 px-3 py-2 text-sm rounded-xl transition-colors duration-200",
                                                            isActive
                                                                ? "bg-accent-50 text-accent-600 font-medium"
                                                                : "text-surface-500 hover:bg-primary-200 hover:text-surface-800"
                                                        )}
                                                    >
                                                        {isActive && (
                                                            <span className="absolute left-0 top-1/2 -translate-y-1/2 h-5 w-0.5 rounded-full bg-accent-500" />
                                                        )}
                                                        <route.icon className={cn(
                                                            "size-4 shrink-0 transition-colors duration-200",
                                                            isActive ? "text-accent-500" : "text-surface-600"
                                                        )} />
                                                        <span className={cn("flex-1", isActive ? "text-accent-600" : "text-surface-600")}>{route.label}</span>
                                                    </Link>
                                                );
                                            })}
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>

                    {/* Account links */}
                    <div className="mt-3 pt-3 border-t border-primary-900 space-y-0.5 pb-2">
                        <Link
                            href="/notifications"
                            onClick={() => setMobileOpen(false)}
                            className={cn(
                                "relative flex items-center gap-2.5 px-3 py-2 text-sm rounded-xl transition-colors duration-200",
                                isNotificationsActive
                                    ? "bg-accent-50 text-accent-600 font-medium"
                                    : "text-surface-500 hover:bg-primary-200 hover:text-surface-800"
                            )}
                        >
                            {isNotificationsActive && (
                                <span className="absolute left-0 top-1/2 -translate-y-1/2 h-5 w-0.5 rounded-full bg-accent-500" />
                            )}
                            <Bell className={cn("size-4 shrink-0 text-surface-600", isNotificationsActive && "text-accent-600")} />
                            <span className={cn("flex-1 text-surface-600", isNotificationsActive && "text-accent-600")}>Thông báo</span>
                            {unreadCount > 0 && (
                                <span className="flex min-w-[20px] h-5 items-center justify-center rounded-full bg-danger-500 px-1.5 text-[10px] font-bold text-white">
                                    {unreadCount > 99 ? '99+' : unreadCount}
                                </span>
                            )}
                        </Link>
                        <Link
                            href="/change-password"
                            onClick={() => setMobileOpen(false)}
                            className="flex items-center gap-2.5 px-3 py-2 text-sm rounded-xl text-surface-500 hover:bg-primary-200 hover:text-surface-800 transition-colors duration-200"
                        >
                            <KeyRound className="size-4 shrink-0 text-surface-600" />
                            <span className='text-surface-600'>Đổi mật khẩu</span>
                        </Link>
                    </div>
                </nav>

                {/* Footer */}
                <div className="px-4 py-2 shrink-0">
                    <p className="text-[10px] text-surface-400 text-center">
                        Thiết kế & phát triển bởi{' '}
                        <span className="text-surface-500 font-medium">Mạch Hoài</span>
                    </p>
                    <p className="text-[9px] text-surface-500 text-center mt-0.5">
                        Phiên bản v{process.env.NEXT_PUBLIC_BUILD_VERSION || 'Dev'}
                    </p>
                </div>
            </div>
        );
    };

    return (
        <div className="flex bg-surface-50 h-screen">
            {/* Desktop Sidebar */}
            <aside className={cn(
                "hidden md:flex flex-col items-center justify-center shrink-0 transition-all duration-300",
                isCollapsed
                    ? "w-[72px] bg-surface-50"
                    : "w-64 bg-primary-400"
            )}>
                <SidebarContent />
            </aside>

            {/* Mobile Drawer Overlay */}
            {mobileOpen && (
                <div className="md:hidden fixed inset-0 z-[100] flex">
                    <div
                        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
                        onClick={() => setMobileOpen(false)}
                    />
                    <aside className="relative z-50 w-72 bg-primary-400 text-surface-100 flex flex-col animate-in slide-in-from-left-4 duration-200 overflow-hidden">
                        <button
                            className="absolute top-4 right-4 text-surface-400 hover:text-surface-100 p-1 z-50 rounded-lg bg-surface-800/50 hover:bg-surface-700/50 transition-colors"
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
            <main className="flex-1 h-screen overflow-hidden flex flex-col bg-surface-50/50">
                <div className="flex-1 overflow-y-auto w-full p-4 custom-scrollbar">
                    {children}
                </div>
            </main>

            {/* Mobile FAB Group */}
            {!mobileOpen && (
                <div className="md:hidden fixed bottom-24 right-[30px] z-30 flex flex-col items-center gap-2.5">
                    <button
                        className="relative w-10 h-10 bg-surface-900/90 backdrop-blur-sm text-white rounded-full flex items-center justify-center hover:bg-surface-800 active:scale-90 transition-all outline-none"
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
                </div>
            )}
        </div>
    );
}
