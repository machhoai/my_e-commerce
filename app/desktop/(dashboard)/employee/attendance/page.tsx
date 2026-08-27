import EmployeeAttendancePanel from '@/components/attendance/EmployeeAttendancePanel';

export default function EmployeeAttendancePage() {
    return (
        <div className="mx-auto w-full max-w-3xl space-y-5 py-2">
            <header>
                <h1 className="text-2xl font-bold text-surface-900">Chấm công</h1>
                <p className="mt-1 text-sm text-surface-500">
                    Chấm công vào và ra theo chính sách của cửa hàng.
                </p>
            </header>
            <EmployeeAttendancePanel />
        </div>
    );
}
