import EmployeeAttendancePanel from '@/components/attendance/EmployeeAttendancePanel';
import MobilePageShell from '@/components/mobile/MobilePageShell';

export default function MobileEmployeeAttendancePage() {
    return (
        <MobilePageShell title="Chấm công">
            <EmployeeAttendancePanel />
        </MobilePageShell>
    );
}
