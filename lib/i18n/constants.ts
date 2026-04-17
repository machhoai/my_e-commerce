// ─────────────────────────────────────────────────────────────────────────────
// Mobile i18n — Constants
// ─────────────────────────────────────────────────────────────────────────────

import type { Locale } from './types';

/** Default locale — Vietnamese */
export const DEFAULT_LOCALE: Locale = 'vi';

/** All supported locales */
export const SUPPORTED_LOCALES: Locale[] = ['vi', 'zh'];

/** Cookie name for persisting locale preference */
export const LOCALE_COOKIE_NAME = 'mobile-locale';

/** localStorage key (fallback for cookie) */
export const LOCALE_STORAGE_KEY = 'mobile-locale';

/**
 * IANA timezone identifiers used in mainland China and Chinese-speaking regions.
 * Used for auto-detection when navigator.language is ambiguous.
 */
export const CHINESE_TIMEZONES = [
    'Asia/Shanghai',
    'Asia/Chongqing',
    'Asia/Harbin',
    'Asia/Urumqi',
    'Asia/Hong_Kong',
    'Asia/Macau',
    'Asia/Taipei',
] as const;
