'use client';

import { useRouter } from 'next/navigation';
import { ChevronLeft } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useMobileTranslation } from '@/lib/i18n';
import { WorkplacePicker } from '@/components/shared/WorkplacePicker';

interface MobilePageShellProps {
    title: string;
    children: React.ReactNode;
    /** Extra element rendered on the right side of the header (e.g. action button) */
    headerRight?: React.ReactNode;
    /** If true, content area has no padding (for full-bleed pages like tables) */
    noPadding?: boolean;
    /** Custom back action. Defaults to router.back() */
    onBack?: () => void;
    /** Show the workplace context selector as part of the page, below the header. */
    showWorkplacePicker?: boolean;
}

export default function MobilePageShell({
    title,
    children,
    headerRight,
    noPadding = false,
    onBack,
    showWorkplacePicker = false,
}: MobilePageShellProps) {
    const router = useRouter();
    const { t } = useMobileTranslation();

    return (
        <div className="min-h-screen bg-gray-50 flex flex-col">
            {/* ── Sticky native-style header ──────────────────────────────── */}
            <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-gray-100 shadow-sm">
                <div className="flex items-center gap-3 px-4 py-3 safe-area-top">
                    <button
                        onClick={onBack ?? (() => router.back())}
                        className="w-9 h-9 rounded-xl bg-gray-100 flex items-center justify-center active:scale-95 transition-transform shrink-0"
                        aria-label={t('common.back')}
                    >
                        <ChevronLeft className="w-5 h-5 text-gray-600" />
                    </button>
                    <h1 className="text-base font-bold text-gray-900 truncate flex-1">
                        {title}
                    </h1>
                    {headerRight && (
                        <div className="shrink-0 flex items-center gap-2">
                            {headerRight}
                        </div>
                    )}
                </div>
            </header>

            {showWorkplacePicker && (
                <WorkplacePicker className="mx-4 mt-4 w-auto rounded-2xl border border-gray-100 bg-white px-3 py-2.5 shadow-sm" />
            )}

            {/* ── Page content ────────────────────────────────────────────── */}
            <main className={cn('flex-1', noPadding ? '' : 'p-4')}>
                {children}
            </main>
        </div>
    );
}
