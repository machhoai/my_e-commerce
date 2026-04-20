'use client';

// ─────────────────────────────────────────────────────────────────────────────
// Mobile i18n — React Context Provider
// Wraps ONLY /mobile routes. Desktop never touches this provider.
// ─────────────────────────────────────────────────────────────────────────────

import { createContext, useState, useEffect, useCallback, useMemo } from 'react';
import type { Locale, I18nContextValue } from './types';
import { DEFAULT_LOCALE } from './constants';
import { getDictionary, createTranslationFunction } from './dictionaries';
import { detectLocale, persistLocale } from './detect-locale';

/**
 * The i18n context — defaults to `null` so that `useMobileTranslation`
 * can differentiate between "inside provider" vs "outside provider (Desktop)".
 */
export const I18nContext = createContext<I18nContextValue | null>(null);

export function I18nMobileProvider({ children }: { children: React.ReactNode }) {
    const [locale, setLocaleState] = useState<Locale>(DEFAULT_LOCALE);
    const [hydrated, setHydrated] = useState(false);

    // On mount: detect and apply the user's locale preference
    useEffect(() => {
        const detected = detectLocale();
        setLocaleState(detected);
        // Persist on first detection so cookie is always set
        persistLocale(detected);
        setHydrated(true);
    }, []);

    // Stable setter that also persists the choice
    const setLocale = useCallback((newLocale: Locale) => {
        setLocaleState(newLocale);
        persistLocale(newLocale);
    }, []);

    // Memoize dictionary + translation function to avoid re-creating on every render
    const dictionary = useMemo(() => getDictionary(locale), [locale]);
    const t = useMemo(() => createTranslationFunction(locale), [locale]);

    const contextValue = useMemo<I18nContextValue>(() => ({
        locale,
        setLocale,
        t,
        dictionary,
    }), [locale, setLocale, t, dictionary]);

    // Avoid hydration mismatch: render children with default locale until client detects
    // This is intentionally subtle — the flash is near-instant on modern devices
    if (!hydrated) {
        const defaultT = createTranslationFunction(DEFAULT_LOCALE);
        const defaultDict = getDictionary(DEFAULT_LOCALE);
        return (
            <I18nContext.Provider value={{
                locale: DEFAULT_LOCALE,
                setLocale,
                t: defaultT,
                dictionary: defaultDict,
            }}>
                {children}
            </I18nContext.Provider>
        );
    }

    return (
        <I18nContext.Provider value={contextValue}>
            {children}
        </I18nContext.Provider>
    );
}
