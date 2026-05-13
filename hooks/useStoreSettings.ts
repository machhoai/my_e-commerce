'use client';

import { useState, useEffect } from 'react';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAuth } from '@/contexts/AuthContext';
import type { StoreSettings } from '@/types';

/**
 * Real-time hook that listens to the current store's settings from Firestore.
 * Returns the `settings` sub-field of the `stores/{storeId}` document.
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

    // Resolve: store-context users use effectiveStoreId, admin uses globalSelectedStoreId (not handled here)
    const storeId = effectiveStoreId || userDoc?.storeId || '';

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
