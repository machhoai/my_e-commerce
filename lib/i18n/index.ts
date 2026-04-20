// ─────────────────────────────────────────────────────────────────────────────
// Mobile i18n — Barrel exports
// ─────────────────────────────────────────────────────────────────────────────

export { I18nMobileProvider, I18nContext } from './I18nMobileProvider';
export { useMobileTranslation } from './useMobileTranslation';
export { getDictionary, createTranslationFunction } from './dictionaries';
export { detectLocale, persistLocale } from './detect-locale';
export {
    DEFAULT_LOCALE,
    SUPPORTED_LOCALES,
    LOCALE_COOKIE_NAME,
    LOCALE_STORAGE_KEY,
    CHINESE_TIMEZONES,
} from './constants';
export type { Locale, Dictionary, TranslationFunction, I18nContextValue } from './types';
