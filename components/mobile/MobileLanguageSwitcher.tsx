'use client';

// ─────────────────────────────────────────────────────────────────────────────
// MobileLanguageSwitcher — Compact language toggle for /mobile routes
// ─────────────────────────────────────────────────────────────────────────────

import { useMobileTranslation } from '@/lib/i18n';
import { cn } from '@/lib/utils';
import { Globe } from 'lucide-react';

/**
 * A compact language toggle that switches between Vietnamese and Chinese.
 * Designed to be placed in page headers or settings sections.
 *
 * Consumes the i18n context via the safe hook — if rendered on Desktop
 * (which should never happen), it gracefully no-ops.
 */
export default function MobileLanguageSwitcher({ className }: { className?: string }) {
    const { locale, setLocale, t } = useMobileTranslation();

    const toggleLocale = () => {
        setLocale(locale === 'vi' ? 'zh' : 'vi');
    };

    return (
        <button
            onClick={toggleLocale}
            className={cn(
                'flex items-center gap-1.5 px-3 py-1.5 rounded-xl',
                'bg-white/80 backdrop-blur-sm border border-gray-200',
                'text-xs font-bold text-gray-700',
                'active:scale-95 transition-all duration-150',
                'shadow-sm hover:shadow-md',
                className,
            )}
            aria-label={t('dashboard.switchLanguage')}
            title={t('dashboard.switchLanguage')}
        >
            <Globe className="w-3.5 h-3.5 text-primary-500" />
            <span className="leading-none">
                {locale === 'vi' ? '中文' : 'VI'}
            </span>
        </button>
    );
}
