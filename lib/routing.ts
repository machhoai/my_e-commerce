import { UserRole } from '@/types';

/**
 * Returns the role-based default dashboard route for a given user.
 * Used by both middleware (Edge) and client-side login logic to ensure
 * a consistent fallback when no last_visited_path or defaultDashboard is set.
 *
 * Keep this file Edge-compatible: no firebase-admin, no Node.js built-ins.
 */
export function getRoleDefaultRoute(
    role: UserRole | string,
    workplaceType?: string
): string {
    if (role === 'super_admin' || role === 'admin') return '/office/revenue';
    if (role === 'store_manager') return '/manager/scheduling/overview';
    if (role === 'office') return '/office/revenue';
    if (role === 'manager') return '/manager/scheduling/overview';
    // employee (or unknown)
    return '/employee/dashboard';
}

/**
 * Parses the `last_visited_path` value from a raw Cookie header string.
 * Safe to use in both Edge middleware and client-side JS (document.cookie).
 */
export function parseLastVisitedPath(cookieHeader: string): string | null {
    const match = cookieHeader.match(/(?:^|;\s*)last_visited_path=([^;]*)/);
    return match ? decodeURIComponent(match[1]) : null;
}

/**
 * Routes that are considered "protected" — i.e. requiring auth.
 * Used by middleware to determine which paths should track last_visited_path.
 */
export const PROTECTED_ROUTE_PREFIXES = [
    '/admin',
    '/office',
    '/store',
    '/manager',
    '/employee',
    '/notifications',
    '/profile',
    '/scan',
    '/dashboard',
];

/**
 * Routes that are role-configurable as a defaultDashboard.
 * Keyed by role for use in the Profile page dropdown.
 */
export const DEFAULT_DASHBOARD_OPTIONS: Record<string, { label: string; value: string }[]> = {
    super_admin: [
        { label: 'Quản lý Người dùng', value: '/admin/users' },
        { label: 'Lịch làm việc', value: '/admin/scheduling/overview' },
        { label: 'Doanh thu', value: '/office/revenue' },
    ],
    admin: [
        { label: 'Quản lý Người dùng', value: '/admin/users' },
        { label: 'Lịch làm việc', value: '/admin/scheduling/overview' },
        { label: 'Doanh thu', value: '/office/revenue' },
    ],
    store_manager: [
        { label: 'Quản lý Người dùng', value: '/admin/users' },
        { label: 'Lịch làm việc', value: '/admin/scheduling/overview' },
    ],
    office: [
        { label: 'Doanh thu', value: '/office/revenue' },
    ],
    manager: [
        { label: 'Tổng quan Lịch làm', value: '/manager/scheduling/overview' },
    ],
    employee: [
        { label: 'Dashboard Nhân viên', value: '/employee/dashboard' },
    ],
};
