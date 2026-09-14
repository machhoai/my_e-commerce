import type { UserDoc } from '@/types';

const HR_MANAGE_PERMISSION = 'action.hr.manage';
const LEGACY_HR_MANAGE_PERMISSION = 'manage_hr';

/**
 * Server-side HR authorization. Keep the legacy canManageHR flag working while
 * honoring the role permissions configured in custom_roles.
 */
export async function canManageHr(
    db: FirebaseFirestore.Firestore,
    user: Partial<UserDoc>,
): Promise<boolean> {
    if (user.role === 'admin' || user.role === 'super_admin' || user.role === 'store_manager') {
        return true;
    }

    if (user.canManageHR === true) return true;

    const roleId = user.customRoleId || user.role;
    if (!roleId) return false;

    const roleSnap = await db.collection('custom_roles').doc(roleId).get();
    if (!roleSnap.exists) return false;

    const permissions = roleSnap.data()?.permissions;
    return Array.isArray(permissions) && (
        permissions.includes(HR_MANAGE_PERMISSION) ||
        permissions.includes(LEGACY_HR_MANAGE_PERMISSION)
    );
}
