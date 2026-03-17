'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { StoreDoc } from '@/types';
import { Building2, ChevronDown } from 'lucide-react';

/**
 * Dropdown for office-context users to pick which managed store to view.
 * Renders nothing if the user has 0 or 1 managed stores.
 */
export function OfficeManagedStorePicker({ className }: { className?: string }) {
    const { user, managedStoreIds, effectiveStoreId, setEffectiveStoreId } = useAuth();
    const [stores, setStores] = useState<StoreDoc[]>([]);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (!user || managedStoreIds.length === 0) return;
        (async () => {
            setLoading(true);
            try {
                const token = await user.getIdToken();
                const res = await fetch('/api/stores', { headers: { Authorization: `Bearer ${token}` } });
                if (res.ok) {
                    const all: StoreDoc[] = await res.json();
                    setStores(all.filter(s => managedStoreIds.includes(s.id)));
                }
            } catch { /* silent */ } finally {
                setLoading(false);
            }
        })();
    }, [user, managedStoreIds]);

    // Don't render if only 0 or 1 stores
    if (managedStoreIds.length <= 1) return null;
    if (loading) return null;

    const current = stores.find(s => s.id === effectiveStoreId);

    return (
        <div className={`relative inline-flex items-center ${className ?? ''}`}>
            <Building2 className="absolute left-3 w-3.5 h-3.5 text-surface-400 pointer-events-none" />
            <select
                value={effectiveStoreId}
                onChange={e => setEffectiveStoreId(e.target.value)}
                className="appearance-none pl-8 pr-8 py-2 text-sm font-medium bg-white border border-surface-200 rounded-xl shadow-sm focus:outline-none focus:ring-2 focus:ring-primary-300 text-surface-700 cursor-pointer min-w-[180px]"
                title="Chọn cửa hàng để xem"
            >
                {stores.map(s => (
                    <option key={s.id} value={s.id}>{s.name}</option>
                ))}
            </select>
            <ChevronDown className="absolute right-2.5 w-3.5 h-3.5 text-surface-400 pointer-events-none" />
        </div>
    );
}
