'use client';

import { useState, useEffect } from 'react';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAuth } from '@/contexts/AuthContext';
import type { StoreSettings } from '@/types';

const GLOBAL_STORE_KEY = 'globalSelectedStoreId';

/**
 * Real-time hook that listens to the current store's settings from Firestore.
 * Returns the `settings` sub-field of the `stores/{storeId}` document.
 *
 * StoreId resolution order:
 * 1. effectiveStoreId (from AuthContext — dashboard store selector / office user)
 * 2. userDoc.storeId (for store-context employees)
 * 3. localStorage 'globalSelectedStoreId' (last store selected in admin settings)
 *
 * Usage:
 * ```ts
 * const { referralEnabled, loading } = useStoreSettings();
 * ```
 */
export function useStoreSettings() {
    const { effectiveStoreId, userDoc } = useAuth();
    const [settings, setSettings] = useState<StoreSettings | null>(null);
    const [loading, setLoading] = useState(true);

    // For admin users who might not have effectiveStoreId set,
    // fall back to the globalSelectedStoreId from localStorage
    const [fallbackStoreId, setFallbackStoreId] = useState('');
    useEffect(() => {
        if (typeof window !== 'undefined') {
            const saved = localStorage.getItem(GLOBAL_STORE_KEY) ?? '';
            setFallbackStoreId(saved);

            // Listen for storage changes from other tabs/components
            const handler = (e: StorageEvent) => {
                if (e.key === GLOBAL_STORE_KEY) {
                    setFallbackStoreId(e.newValue ?? '');
                }
            };
            window.addEventListener('storage', handler);
            return () => window.removeEventListener('storage', handler);
        }
    }, []);

    // Resolve storeId with fallback chain
    const storeId =
        effectiveStoreId ||
        userDoc?.storeId ||
        fallbackStoreId;

    useEffect(() => {
        if (!storeId) {
            setSettings(null);
            setLoading(false);
            return;
        }

        setLoading(true);
        const unsub = onSnapshot(
            doc(db, 'stores', storeId),
            (snap) => {
                if (snap.exists()) {
                    const data = snap.data();
                    setSettings((data.settings as StoreSettings) ?? null);
                } else {
                    setSettings(null);
                }
                setLoading(false);
            },
            (err) => {
                console.error('[useStoreSettings] Firestore listener error:', err);
                setLoading(false);
            }
        );

        return () => unsub();
    }, [storeId]);

    // Derived convenience values with safe defaults
    return {
        settings,
        loading,
        storeId,
        /** Whether referral program is active for this store. Default: true (opt-out model). */
        referralEnabled: settings?.referralEnabled ?? true,
        registrationOpen: settings?.registrationOpen ?? false,
    };
}
