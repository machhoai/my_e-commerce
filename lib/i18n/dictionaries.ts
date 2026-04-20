// ─────────────────────────────────────────────────────────────────────────────
// Mobile i18n — Dictionary loader
// ─────────────────────────────────────────────────────────────────────────────

import type { Locale, Dictionary, TranslationFunction } from './types';
import viDict from './dictionaries/vi.json';
import zhDict from './dictionaries/zh.json';

const DICTIONARIES: Record<Locale, Dictionary> = {
    vi: viDict,
    zh: zhDict,
};

/** Get the full dictionary for a given locale */
export function getDictionary(locale: Locale): Dictionary {
    return DICTIONARIES[locale] ?? DICTIONARIES.vi;
}

/**
 * Create a translation function for the given locale.
 *
 * Resolution order:
 * 1. Current locale dictionary
 * 2. Vietnamese fallback (if key missing in zh)
 * 3. Return the key string itself (developer can spot missing keys)
 *
 * Interpolation: replaces {paramName} and {{paramName}} with provided values.
 */
export function createTranslationFunction(locale: Locale): TranslationFunction {
    const dict = getDictionary(locale);
    const fallback = locale !== 'vi' ? getDictionary('vi') : null;

    return (key: string, params?: Record<string, string | number>): string => {
        let value = dict[key] ?? fallback?.[key] ?? key;

        // Interpolation: replace {{paramName}} first, then {paramName}
        if (params) {
            Object.entries(params).forEach(([paramKey, paramValue]) => {
                const val = String(paramValue);
                value = value.replace(new RegExp(`\\{\\{${paramKey}\\}\\}`, 'g'), val);
                value = value.replace(new RegExp(`\\{${paramKey}\\}`, 'g'), val);
            });
        }

        return value;
    };
}
