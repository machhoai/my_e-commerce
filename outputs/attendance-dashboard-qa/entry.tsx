import React from 'react';
import { createRoot } from 'react-dom/client';
import EmployeeAttendancePanel from '../../components/attendance/EmployeeAttendancePanel';
createRoot(document.getElementById('root')!).render(<EmployeeAttendancePanel dashboard />);
