// ─────────────────────────────────────────────────────────────────────────────
// Mobile i18n — Auto-detection logic (client-side only)
// ─────────────────────────────────────────────────────────────────────────────

import type { Locale } from './types';
import {
    DEFAULT_LOCALE,
    SUPPORTED_LOCALES,
    LOCALE_COOKIE_NAME,
    LOCALE_STORAGE_KEY,
    CHINESE_TIMEZONES,
} from './constants';

/** Read a cookie value by name (client-side) */
function getCookie(name: string): string | undefined {
    if (typeof document === 'undefined') return undefined;
    const match = document.cookie.match(new RegExp(`(?:^|;\\s*)${name}=([^;]*)`));
    return match ? decodeURIComponent(match[1]) : undefined;
}

/** Write a cookie (365-day expiry, SameSite=Lax, path=/) */
export function setLocaleCookie(locale: Locale): void {
    if (typeof document === 'undefined') return;
    const maxAge = 365 * 24 * 60 * 60; // 1 year
    document.cookie = `${LOCALE_COOKIE_NAME}=${locale};path=/;max-age=${maxAge};SameSite=Lax`;
}

/** Save locale to localStorage */
export function setLocaleStorage(locale: Locale): void {
    try {
        if (typeof localStorage !== 'undefined') {
            localStorage.setItem(LOCALE_STORAGE_KEY, locale);
        }
    } catch {
        // Silently fail (e.g. private browsing)
    }
}

/** Persist locale to both cookie and localStorage */
export function persistLocale(locale: Locale): void {
    setLocaleCookie(locale);
    setLocaleStorage(locale);
}

/**
 * Detect the user's preferred locale.
 *
 * Priority:
 * 1. Cookie (explicit prior choice)
 * 2. localStorage (fallback for cookie)
 * 3. navigator.language starts with "zh" → 'zh'
 * 4. Browser timezone is in Chinese timezone list → 'zh'
 * 5. Default: 'vi'
 */
export function detectLocale(): Locale {
    // 1. Check cookie
    const cookieVal = getCookie(LOCALE_COOKIE_NAME);
    if (cookieVal && SUPPORTED_LOCALES.includes(cookieVal as Locale)) {
        return cookieVal as Locale;
    }

    // 2. Check localStorage
    try {
        if (typeof localStorage !== 'undefined') {
            const stored = localStorage.getItem(LOCALE_STORAGE_KEY);
            if (stored && SUPPORTED_LOCALES.includes(stored as Locale)) {
                return stored as Locale;
            }
        }
    } catch {
        // Ignore
    }

    // 3. Check navigator.language
    if (typeof navigator !== 'undefined') {
        const lang = navigator.language || (navigator as any).userLanguage || '';
        if (lang.toLowerCase().startsWith('zh')) {
            return 'zh';
        }
    }

    // 4. Check timezone
    try {
        const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
        if (tz && (CHINESE_TIMEZONES as readonly string[]).includes(tz)) {
            return 'zh';
        }
    } catch {
        // Intl not available — fallback
    }

    // 5. Default
    return DEFAULT_LOCALE;
}
