'use client';

import { useEffect, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { cn } from '@/lib/utils';

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────
export interface BottomSheetProps {
    /** Whether the sheet is visible */
    isOpen: boolean;
    /** Called when the sheet should close (backdrop tap, swipe down, Esc) */
    onClose: () => void;
    /** Optional title rendered in the handle bar */
    title?: string;
    /** Sheet content */
    children: React.ReactNode;
    /** Extra class names applied to the sheet panel */
    className?: string;
    /**
     * Maximum height of the sheet expressed as a Tailwind max-h-* class.
     * Defaults to 'max-h-[85vh]'.
     */
    maxHeightClass?: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────────────────────
/** Minimum downward drag distance (px) to trigger close */
const SWIPE_CLOSE_THRESHOLD = 80;

// ─────────────────────────────────────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────────────────────────────────────
export default function BottomSheet({
    isOpen,
    onClose,
    title,
    children,
    className,
    maxHeightClass = 'max-h-[85vh]',
}: BottomSheetProps) {
    const sheetRef = useRef<HTMLDivElement>(null);
    const dragStartY = useRef<number | null>(null);
    const currentDragY = useRef<number>(0);

    // ── Lock body scroll when open ──────────────────────────────────────────
    useEffect(() => {
        if (isOpen) {
            const prev = document.body.style.overflow;
            document.body.style.overflow = 'hidden';
            return () => { document.body.style.overflow = prev; };
        }
    }, [isOpen]);

    // ── Esc key to close ────────────────────────────────────────────────────
    useEffect(() => {
        if (!isOpen) return;
        const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
        window.addEventListener('keydown', handler);
        return () => window.removeEventListener('keydown', handler);
    }, [isOpen, onClose]);

    // ── Swipe-down gesture ──────────────────────────────────────────────────
    const applyDrag = useCallback((dy: number) => {
        if (!sheetRef.current) return;
        const clamped = Math.max(0, dy); // only allow downward drag
        sheetRef.current.style.transform = `translateY(${clamped}px)`;
        sheetRef.current.style.transition = 'none';
    }, []);

    const resetDrag = useCallback((close: boolean) => {
        if (!sheetRef.current) return;
        sheetRef.current.style.transition = 'transform 0.3s cubic-bezier(0.32,0.72,0,1)';
        sheetRef.current.style.transform = close ? 'translateY(100%)' : 'translateY(0)';
        if (close) {
            setTimeout(() => {
                onClose();
                if (sheetRef.current) {
                    sheetRef.current.style.transform = '';
                    sheetRef.current.style.transition = '';
                }
            }, 300);
        } else {
            setTimeout(() => {
                if (sheetRef.current) {
                    sheetRef.current.style.transform = '';
                    sheetRef.current.style.transition = '';
                }
            }, 300);
        }
    }, [onClose]);

    const onTouchStart = useCallback((e: React.TouchEvent) => {
        dragStartY.current = e.touches[0].clientY;
        currentDragY.current = 0;
    }, []);

    const onTouchMove = useCallback((e: React.TouchEvent) => {
        if (dragStartY.current === null) return;
        const dy = e.touches[0].clientY - dragStartY.current;
        currentDragY.current = dy;
        applyDrag(dy);
    }, [applyDrag]);

    const onTouchEnd = useCallback(() => {
        const dy = currentDragY.current;
        dragStartY.current = null;
        currentDragY.current = 0;
        resetDrag(dy > SWIPE_CLOSE_THRESHOLD);
    }, [resetDrag]);

    // ── Do not render to DOM when closed ───────────────────────────────────
    if (typeof window === 'undefined') return null;

    return createPortal(
        <div
            className={cn(
                'fixed inset-0 z-50 flex flex-col justify-end',
                'pointer-events-none',
                isOpen ? 'pointer-events-auto' : '',
            )}
            aria-modal="true"
            role="dialog"
        >
            {/* Backdrop */}
            <div
                onClick={onClose}
                className={cn(
                    'absolute inset-0 bg-black/40 backdrop-blur-[2px] transition-opacity duration-300',
                    isOpen ? 'opacity-100' : 'opacity-0 pointer-events-none',
                )}
            />

            {/* Sheet panel */}
            <div
                ref={sheetRef}
                className={cn(
                    'relative w-full rounded-t-3xl bg-white shadow-2xl',
                    'flex flex-col overflow-hidden',
                    maxHeightClass,
                    'transition-transform duration-300 ease-[cubic-bezier(0.32,0.72,0,1)]',
                    isOpen ? 'translate-y-0' : 'translate-y-full',
                    className,
                )}
            >
                {/* Drag handle bar — touch target */}
                <div
                    className="flex-shrink-0 flex flex-col items-center pt-3 pb-1 cursor-grab active:cursor-grabbing select-none"
                    onTouchStart={onTouchStart}
                    onTouchMove={onTouchMove}
                    onTouchEnd={onTouchEnd}
                >
                    <div className="w-10 h-1 rounded-full bg-gray-300" />
                    {title && (
                        <h2 className="mt-3 text-[15px] font-bold text-gray-800 tracking-tight px-4 text-center">
                            {title}
                        </h2>
                    )}
                </div>

                {/* Divider */}
                {title && <div className="h-px bg-gray-100 mx-4" />}

                {/* Scrollable content */}
                <div className="flex-1 overflow-y-auto overscroll-contain">
                    {children}
                </div>
            </div>
        </div>,
        document.body,
    );
}
