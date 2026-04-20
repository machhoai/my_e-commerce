// ─────────────────────────────────────────────────────────────────────────────
// Mobile i18n — Type definitions
// ─────────────────────────────────────────────────────────────────────────────

/** Supported locale codes */
export type Locale = 'vi' | 'zh';

/**
 * Flat dictionary: dot-notation keys → translated strings.
 * e.g. { "common.back": "Quay lại", "auth.login": "Đăng nhập" }
 */
export type Dictionary = Record<string, string>;

/**
 * Translation function with optional interpolation.
 * Usage: t('auth.greeting', { name: 'Linh' }) → "Xin chào, Linh"
 * Interpolation pattern: {{paramName}}
 */
export type TranslationFunction = (
    key: string,
    params?: Record<string, string | number>,
) => string;

/** Shape of the i18n context value */
export interface I18nContextValue {
    locale: Locale;
    setLocale: (locale: Locale) => void;
    t: TranslationFunction;
    dictionary: Dictionary;
}
