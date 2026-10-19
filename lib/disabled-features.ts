// Retired pages stay unavailable regardless of role or saved database grants.
export const DISABLED_PAGE_PATHS = [
    '/greensm',
    '/admin/events',
    '/admin/vouchers',
    '/office/inventory/approvals',
    '/admin/products/products',
    '/admin/inventory/overview',
    '/manager/inventory/order',
    '/admin/daily-report',
    '/office/revenue',
] as const;

const DISABLED_PERMISSIONS = new Set([
    'page.greensm.promotion',
    'action.greensm.settings',
    'page.admin.events',
    'page.admin.vouchers',
    'action.voucher.revoke',
    'page.office.approvals',
    'action.office.approve',
    'page.products',
    'action.manager.order',
    'page.admin.daily_report',
    'page.office.revenue',
]);

export function isDisabledPage(path: string): boolean {
    const pathname = path.split(/[?#]/, 1)[0].replace(/^\/(desktop|mobile)(?=\/|$)/, '');
    return DISABLED_PAGE_PATHS.some(route => pathname === route || pathname.startsWith(`${route}/`));
}

export function isDisabledPermission(key: string): boolean {
    return DISABLED_PERMISSIONS.has(key);
}

export function activePermissions(permissions: readonly string[]): string[] {
    return permissions.filter(key => !isDisabledPermission(key));
}

export function activeDefaultRoute(route?: string | null): string | null {
    return route && !isDisabledPage(route) ? route : null;
}
