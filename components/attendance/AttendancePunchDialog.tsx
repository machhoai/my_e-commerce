'use client';

import { useEffect, useState } from 'react';
import { MapPin, X } from 'lucide-react';
import EmployeeAttendancePanel from '@/components/attendance/EmployeeAttendancePanel';
import { cn } from '@/lib/utils';

interface AttendancePunchDialogProps {
    className?: string;
}

export default function AttendancePunchDialog({ className }: AttendancePunchDialogProps) {
    const [open, setOpen] = useState(false);

    useEffect(() => {
        if (!open) return;

        const previousOverflow = document.body.style.overflow;
        const handleKeyDown = (event: KeyboardEvent) => {
            if (event.key === 'Escape') setOpen(false);
        };

        document.body.style.overflow = 'hidden';
        document.addEventListener('keydown', handleKeyDown);

        return () => {
            document.body.style.overflow = previousOverflow;
            document.removeEventListener('keydown', handleKeyDown);
        };
    }, [open]);

    return (
        <>
            <button
                type="button"
                onClick={() => setOpen(true)}
                className={cn(
                    'flex items-center justify-center gap-2 rounded-xl bg-success-600 px-3.5 py-2 text-sm font-bold text-white shadow-sm transition hover:bg-success-700 active:scale-[0.98]',
                    className,
                )}
            >
                <MapPin className="size-4" />
                Chấm công
            </button>

            {open ? (
                <div
                    className="fixed inset-0 z-[70] flex items-end justify-center bg-black/45 p-0 backdrop-blur-sm sm:items-center sm:p-6"
                    role="dialog"
                    aria-modal="true"
                    aria-labelledby="attendance-punch-dialog-title"
                    onMouseDown={(event) => {
                        if (event.target === event.currentTarget) setOpen(false);
                    }}
                >
                    <section className="flex max-h-[94dvh] w-full max-w-2xl flex-col overflow-hidden rounded-t-3xl bg-surface-50 shadow-2xl sm:rounded-3xl">
                        <header className="flex shrink-0 items-center justify-between border-b border-surface-200 bg-white px-5 py-4">
                            <div className="flex items-center gap-3">
                                <div className="flex size-10 items-center justify-center rounded-xl bg-success-50 text-success-600">
                                    <MapPin className="size-5" />
                                </div>
                                <div>
                                    <h2 id="attendance-punch-dialog-title" className="font-bold text-surface-900">
                                        Chấm công cá nhân
                                    </h2>
                                    <p className="text-xs text-surface-500">Xác minh vị trí theo cửa hàng của bạn</p>
                                </div>
                            </div>
                            <button
                                type="button"
                                onClick={() => setOpen(false)}
                                aria-label="Đóng cửa sổ chấm công"
                                className="flex size-10 items-center justify-center rounded-xl text-surface-500 transition hover:bg-surface-100 hover:text-surface-800"
                            >
                                <X className="size-5" />
                            </button>
                        </header>
                        <div className="overflow-y-auto p-3 sm:p-5">
                            <EmployeeAttendancePanel />
                        </div>
                    </section>
                </div>
            ) : null}
        </>
    );
}
