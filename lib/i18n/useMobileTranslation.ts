'use client';

// ─────────────────────────────────────────────────────────────────────────────
// Mobile i18n — Safe Translation Hook
//
// THE CRITICAL PIECE for Desktop isolation:
// • Inside /mobile (I18nMobileProvider exists) → returns context values
// • Outside /mobile (Desktop) → returns Vietnamese fallback, NEVER throws
// ─────────────────────────────────────────────────────────────────────────────

import { useContext } from 'react';
import { I18nContext } from './I18nMobileProvider';
import { createTranslationFunction } from './dictionaries';
import type { Locale, TranslationFunction } from './types';

/** Singleton fallback t() — created once, reused across all Desktop renders */
const fallbackT = createTranslationFunction('vi');

interface UseMobileTranslationReturn {
    /** Translation function: t('key') or t('key', { param: value }) */
    t: TranslationFunction;
    /** Current locale ('vi' or 'zh') */
    locale: Locale;
    /** Set locale — no-op on Desktop */
    setLocale: (locale: Locale) => void;
}

/**
 * Safe i18n hook for use in ANY component — mobile or desktop.
 *
 * When used inside `<I18nMobileProvider>` (mobile routes):
 *   → Returns the user's selected locale and active translation function.
 *
 * When used OUTSIDE provider (desktop routes):
 *   → Returns Vietnamese ('vi') translations with a no-op setLocale.
 *   → NEVER throws an error.
 *
 * @example
 * ```tsx
 * function MyButton() {
 *   const { t } = useMobileTranslation();
 *   return <button>{t('common.save')}</button>;
 * }
 * ```
 */
export function useMobileTranslation(): UseMobileTranslationReturn {
    const context = useContext(I18nContext);

    // Inside I18nMobileProvider — return live context
    if (context) {
        return {
            t: context.t,
            locale: context.locale,
            setLocale: context.setLocale,
        };
    }

    // Outside provider (Desktop) — safe Vietnamese fallback
    return {
        t: fallbackT,
        locale: 'vi',
        setLocale: () => {
            // No-op on Desktop — intentionally silent
        },
    };
}
