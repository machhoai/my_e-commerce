export type AttendancePermission =
    | 'page.hr.attendance'
    | 'hr.attendance.configure'
    | 'action.attendance.punch'
    | 'action.attendance.export'
    | 'action.attendance.adjust';

/**
 * Attendance managers can also record their own attendance. Keeping this
 * implication here ensures API authorization matches the manager UI.
 */
export function grantsAttendancePermission(
    grantedPermissions: ReadonlySet<string>,
    requiredPermission: AttendancePermission,
): boolean {
    if (grantedPermissions.has(requiredPermission)) return true;

    return requiredPermission === 'action.attendance.punch'
        && grantedPermissions.has('page.hr.attendance');
}
