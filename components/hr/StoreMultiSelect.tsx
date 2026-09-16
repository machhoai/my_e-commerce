'use client';

import type { StoreDoc } from '@/types';
import { cn } from '@/lib/utils';

interface StoreMultiSelectProps {
    stores: StoreDoc[];
    value: string[];
    onChange: (storeIds: string[]) => void;
    className?: string;
    emptyMessage?: string;
}

export default function StoreMultiSelect({
    stores,
    value,
    onChange,
    className,
    emptyMessage = 'Không có cửa hàng nào trong phạm vi.',
}: StoreMultiSelectProps) {
    const selected = new Set(value);

    const toggle = (storeId: string) => {
        onChange(selected.has(storeId)
            ? value.filter(id => id !== storeId)
            : [...value, storeId]);
    };

    if (!stores.length) {
        return <p className="rounded-xl bg-surface-50 p-3 text-xs text-surface-500">{emptyMessage}</p>;
    }

    return (
        <div className={cn('grid gap-2 rounded-xl border border-surface-200 bg-surface-50 p-3 sm:grid-cols-2', className)}>
            {stores.map(store => (
                <label
                    key={store.id}
                    className={cn(
                        'flex cursor-pointer items-center gap-2 rounded-lg border bg-white px-3 py-2 text-sm transition-colors',
                        selected.has(store.id)
                            ? 'border-primary-400 text-primary-700 ring-1 ring-primary-200'
                            : 'border-surface-200 text-surface-700 hover:border-surface-300',
                        store.isActive === false && 'opacity-50',
                    )}
                >
                    <input
                        type="checkbox"
                        checked={selected.has(store.id)}
                        disabled={store.isActive === false}
                        onChange={() => toggle(store.id)}
                        className="size-4 rounded border-surface-300 text-primary-600 focus:ring-primary-500"
                    />
                    <span className="min-w-0 truncate">🏪 {store.name}</span>
                </label>
            ))}
        </div>
    );
}
