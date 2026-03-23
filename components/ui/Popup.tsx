'use client';

/**
 * Popup — reusable modal dialog with scale-in animation.
 *
 * Features:
 *  - Renders into <body> via Portal
 *  - Scale + fade entrance/exit animation
 *  - Click backdrop or X button to close
 *  - Scrollable body area, sticky header & optional footer
 *  - Fully accessible: focus-trap-friendly, Escape key closes
 *
 * Usage:
 *   <Popup isOpen={open} onClose={() => setOpen(false)} title="My Title">
 *     <p>Content goes here</p>
 *   </Popup>
 */

import { useEffect, useRef, ReactNode } from 'react';
import { X } from 'lucide-react';
import { cn } from '@/lib/utils';
import Portal from '@/components/Portal';

interface PopupProps {
    /** Controls visibility */
    isOpen: boolean;
    /** Called when user dismisses (X button or backdrop click) */
    onClose: () => void;
    /** Title shown in the sticky header */
    title?: ReactNode;
    /** Optional icon/element shown left of the title */
    headerLeft?: ReactNode;
    /** Optional element shown at the right of the header row (besides X) */
    headerExtra?: ReactNode;
    /** Content rendered below the header, scrolls independently */
    children: ReactNode;
    /** Optional sticky footer (e.g. CTA buttons) */
    footer?: ReactNode;
    /**
     * Max width of the popup panel.
     * @default 'max-w-2xl'
     */
    maxWidth?: string;
    /**
     * Max height of the scrollable body region.
     * @default 'max-h-[80vh]'
     */
    maxHeight?: string;
    /**
     * Fixed height for the panel (overrides maxHeight) — prevents layout jumps.
     * e.g. 'h-[85vh]'
     */
    fixedHeight?: string;
    /** Extra class names for the panel */
    className?: string;
}

export default function Popup({
    isOpen,
    onClose,
    title,
    headerLeft,
    headerExtra,
    children,
    footer,
    maxWidth = 'max-w-2xl',
    maxHeight = 'max-h-[85vh]',
    fixedHeight,
    className,
}: PopupProps) {
    const panelRef = useRef<HTMLDivElement>(null);

    // Escape key to close
    useEffect(() => {
        if (!isOpen) return;
        const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
        document.addEventListener('keydown', handler);
        return () => document.removeEventListener('keydown', handler);
    }, [isOpen, onClose]);

    // Prevent body scroll while open
    useEffect(() => {
        if (isOpen) {
            document.body.style.overflow = 'hidden';
        } else {
            document.body.style.overflow = '';
        }
        return () => { document.body.style.overflow = ''; };
    }, [isOpen]);

    if (!isOpen) return null;

    return (
        <Portal>
            {/* ── Backdrop ── */}
            <div
                className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
                onClick={onClose}
            >
                {/* ── Panel ── */}
                <div
                    ref={panelRef}
                    role="dialog"
                    aria-modal="true"
                    onClick={e => e.stopPropagation()}
                    className={cn(
                        // Layout
                        'relative w-full flex flex-col overflow-hidden',
                        // Visuals
                        'bg-white rounded-2xl shadow-2xl',
                        // Size
                        maxWidth,
                        fixedHeight ? fixedHeight : maxHeight,
                        // Entrance animation — scale + fade
                        'animate-in zoom-in-95 fade-in duration-200',
                        className,
                    )}
                >
                    {/* ── Header ── */}
                    {(title || headerLeft || headerExtra) && (
                        <div className="flex items-center gap-3 px-5 py-4 shrink-0">
                            {headerLeft && (
                                <div className="shrink-0">{headerLeft}</div>
                            )}
                            {title && (
                                <div className="flex-1 min-w-0">
                                    {typeof title === 'string'
                                        ? <h2 className="text-base font-bold text-gray-900 truncate">{title}</h2>
                                        : title
                                    }
                                </div>
                            )}

                            {/* Close button */}
                            <button
                                onClick={onClose}
                                aria-label="Đóng"
                                className="shrink-0 w-8 h-8 rounded-xl flex items-center justify-center text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors active:scale-90"
                            >
                                <X className="w-4.5 h-4.5" />
                            </button>
                        </div>
                    )}
                    {/* If there's no header, still show X in top-right corner */}
                    {!title && !headerLeft && !headerExtra && (
                        <button
                            onClick={onClose}
                            aria-label="Đóng"
                            className="absolute top-3 right-3 z-10 w-8 h-8 rounded-xl flex items-center justify-center text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors active:scale-90"
                        >
                            <X className="w-4.5 h-4.5" />
                        </button>
                    )}
                    {headerExtra && (
                        <div className="px-4 py-2  shrink-0 flex items-center gap-1.5">{headerExtra}</div>
                    )}

                    {/* ── Body (scrollable) ── */}
                    <div className="flex-1 overflow-y-auto">
                        {children}
                    </div>

                    {/* ── Footer ── */}
                    {footer && (
                        <div className="shrink-0 border-t border-gray-100 bg-gray-50/50">
                            {footer}
                        </div>
                    )}
                </div>
            </div>
        </Portal>
    );
}
