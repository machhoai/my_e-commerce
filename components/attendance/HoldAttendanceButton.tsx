'use client';

import { useEffect, useRef, useState } from 'react';
import { CheckCircle2, Fingerprint, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

const HOLD_MS = 1500;

export default function HoldAttendanceButton({ disabled, submitting, checkout, completed, onConfirm }: {
    disabled: boolean;
    submitting: boolean;
    checkout: boolean;
    completed: boolean;
    onConfirm: () => void;
}) {
    const [progress, setProgress] = useState(0);
    const timer = useRef<ReturnType<typeof setInterval> | null>(null);
    const confirmed = useRef(false);
    const confirmRef = useRef(onConfirm);
    useEffect(() => { confirmRef.current = onConfirm; }, [onConfirm]);

    function cancel() {
        if (timer.current !== null) clearInterval(timer.current);
        timer.current = null;
        setProgress(0);
    }

    useEffect(() => {
        if (disabled) {
            if (timer.current !== null) clearInterval(timer.current);
            timer.current = null;
        }
        return () => {
            if (timer.current !== null) clearInterval(timer.current);
            timer.current = null;
        };
    }, [disabled]);

    useEffect(() => {
        const cancelOnHide = () => { if (document.hidden) cancel(); };
        window.addEventListener('blur', cancel);
        document.addEventListener('visibilitychange', cancelOnHide);
        return () => {
            window.removeEventListener('blur', cancel);
            document.removeEventListener('visibilitychange', cancelOnHide);
        };
    }, []);

    function start() {
        if (disabled || timer.current !== null) return;
        confirmed.current = false;
        setProgress(0);
        const started = performance.now();
        timer.current = setInterval(() => {
            const elapsed = performance.now() - started;
            setProgress(Math.min(1, elapsed / HOLD_MS));
            if (elapsed >= HOLD_MS && !confirmed.current) {
                confirmed.current = true;
                cancel();
                confirmRef.current();
            }
        }, 25);
    }

    const label = completed ? 'Đã hoàn tất' : checkout ? 'Ra ca' : 'Vào ca';
    return (
        <div className="flex flex-col items-center gap-3 py-3">
            <div className="flex size-40 items-center justify-center rounded-full bg-blue-100/60 p-5 sm:size-56">
                <div className="rounded-full p-1.5" style={{ background: `conic-gradient(${checkout ? '#ea580c' : '#059669'} ${(disabled ? 0 : progress) * 360}deg, transparent 0deg)` }}>
                    <button
                        type="button"
                        disabled={disabled}
                        aria-label={`${label}. Nhấn giữ 1,5 giây để xác nhận`}
                        onPointerDown={(event) => {
                            if (!event.isPrimary || event.button !== 0) return;
                            event.preventDefault();
                            event.currentTarget.setPointerCapture(event.pointerId);
                            start();
                        }}
                        onPointerUp={cancel}
                        onPointerCancel={cancel}
                        onLostPointerCapture={cancel}
                        onPointerLeave={cancel}
                        onContextMenu={(event) => event.preventDefault()}
                        onKeyDown={(event) => {
                            if (event.key !== ' ' && event.key !== 'Enter') return;
                            event.preventDefault();
                            if (!event.repeat) start();
                        }}
                        onKeyUp={(event) => { if (event.key === ' ' || event.key === 'Enter') cancel(); }}
                        onBlur={cancel}
                        className={cn('flex size-36 touch-none select-none flex-col items-center justify-center gap-2 rounded-full text-white shadow-lg transition disabled:cursor-not-allowed disabled:bg-surface-300 disabled:shadow-none focus-visible:outline focus-visible:outline-4 focus-visible:outline-offset-4 focus-visible:outline-primary-500', checkout ? 'bg-orange-600 shadow-orange-600/20' : 'bg-emerald-600 shadow-emerald-600/20')}
                    >
                        {submitting ? <Loader2 className="size-9 animate-spin" /> : completed ? <CheckCircle2 className="size-9" /> : <Fingerprint className="size-10" />}
                        <span className="text-sm font-bold uppercase tracking-wide">{submitting ? 'Đang xác minh' : label}</span>
                    </button>
                </div>
            </div>
            <p className="text-xs font-medium text-surface-500">{progress > 0 && !disabled ? 'Tiếp tục giữ để xác nhận…' : 'Nhấn giữ 1,5 giây để chấm công'}</p>
        </div>
    );
}
