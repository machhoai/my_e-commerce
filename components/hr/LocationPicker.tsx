'use client';

import { cn } from '@/lib/utils';
import type { StoreDoc, OfficeDoc, WarehouseDoc } from '@/types';

// ─── Types ───────────────────────────────────────────────────────────────────
export type LocationType = 'STORE' | 'OFFICE' | 'CENTRAL';

export interface AnyLocation {
    id: string;
    name: string;
    type: LocationType;
    isActive: boolean;
}

export interface LocationPickerProps {
    value: string;
    onChange: (id: string, type: LocationType | null) => void;
    stores?: StoreDoc[];
    offices?: OfficeDoc[];
    warehouses?: WarehouseDoc[];
    placeholder?: string;
    className?: string;
    /** If true, show only active locations */
    activeOnly?: boolean;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────
export function deriveLocationType(
    id: string,
    stores: StoreDoc[],
    offices: OfficeDoc[],
    warehouses: WarehouseDoc[],
): LocationType | null {
    if (!id) return null;
    if (stores.some(s => s.id === id)) return 'STORE';
    if (offices.some(o => o.id === id)) return 'OFFICE';
    if (warehouses.some(w => w.id === id)) return 'CENTRAL';
    return null;
}

export function locationFieldName(type: LocationType | null): 'storeId' | 'officeId' | 'warehouseId' {
    if (type === 'OFFICE') return 'officeId';
    if (type === 'CENTRAL') return 'warehouseId';
    return 'storeId';
}

export function locationIcon(type: LocationType | null) {
    if (type === 'OFFICE') return '🏢';
    if (type === 'CENTRAL') return '🏭';
    return '🏪';
}

export function locationLabel(type: LocationType | null) {
    if (type === 'OFFICE') return 'Văn phòng';
    if (type === 'CENTRAL') return 'Kho';
    return 'Cửa hàng';
}

// ─── Component ────────────────────────────────────────────────────────────────
/**
 * Unified location picker that groups stores / offices / warehouses
 * into optgroups. Calls `onChange(id, type)` whenever selection changes.
 */
export default function LocationPicker({
    value,
    onChange,
    stores = [],
    offices = [],
    warehouses = [],
    placeholder = '— Tất cả —',
    className,
    activeOnly = false,
}: LocationPickerProps) {
    const filteredStores = activeOnly ? stores.filter(s => s.isActive) : stores;
    const filteredOffices = activeOnly ? offices.filter(o => o.isActive) : offices;
    const filteredWarehouses = activeOnly ? warehouses.filter(w => w.isActive) : warehouses;

    const handleChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
        const id = e.target.value;
        if (!id) { onChange('', null); return; }
        const type = deriveLocationType(id, stores, offices, warehouses);
        onChange(id, type);
    };

    return (
        <select
            value={value}
            onChange={handleChange}
            className={cn(className)}
        >
            <option value="">{placeholder}</option>

            {filteredStores.length > 0 && (
                <optgroup label="🏪 Cửa hàng">
                    {filteredStores.map(s => (
                        <option key={s.id} value={s.id}>{s.name}</option>
                    ))}
                </optgroup>
            )}

            {filteredOffices.length > 0 && (
                <optgroup label="🏢 Văn phòng">
                    {filteredOffices.map(o => (
                        <option key={o.id} value={o.id}>{o.name}</option>
                    ))}
                </optgroup>
            )}

            {filteredWarehouses.length > 0 && (
                <optgroup label="🏭 Kho">
                    {filteredWarehouses.map(w => (
                        <option key={w.id} value={w.id}>{w.name}</option>
                    ))}
                </optgroup>
            )}
        </select>
    );
}
