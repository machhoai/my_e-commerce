import { UserRole } from '@/types';

/**
 * Returns the default dashboard route. All roles go to /dashboard.
 */
export function getRoleDefaultRoute(
    role: UserRole | string,
    workplaceType?: string
): string {
    return '/dashboard';
}

/**
 * Routes that are considered "protected" — i.e. requiring auth.
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
