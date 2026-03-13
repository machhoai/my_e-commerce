'use client';

import { useState, useEffect, useRef } from 'react';
import { Search, SlidersHorizontal, ChevronUp, ChevronDown, ChevronsUpDown, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import MobileFilterDrawer, { FilterConfig, SortOption } from './MobileFilterDrawer';

interface DataTableToolbarProps {
    searchValue: string;
    onSearchChange: (value: string) => void;
    searchPlaceholder?: string;
    filters: FilterConfig[];
    filterValues: Record<string, string>;
    onFilterChange: (key: string, value: string) => void;
    sortOptions: SortOption[];
    currentSort: string;
    currentOrder: string;
    onSortChange: (field: string) => void;
    activeFilterCount: number;
    onClearAll: () => void;
    onMobileApply: (values: Record<string, string>) => void;
}

export default function DataTableToolbar({
    searchValue,
    onSearchChange,
    searchPlaceholder = 'Tìm kiếm...',
    filters,
    filterValues,
    onFilterChange,
    sortOptions,
    currentSort,
    currentOrder,
    onSortChange,
    activeFilterCount,
    onClearAll,
    onMobileApply,
}: DataTableToolbarProps) {
    const [isDrawerOpen, setIsDrawerOpen] = useState(false);
    const [localSearch, setLocalSearch] = useState(searchValue);
    const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    // Sync external search value
    useEffect(() => {
        setLocalSearch(searchValue);
    }, [searchValue]);

    const handleSearchInput = (value: string) => {
        setLocalSearch(value);
        // Debounce search updates to URL
        if (debounceRef.current) clearTimeout(debounceRef.current);
        debounceRef.current = setTimeout(() => {
            onSearchChange(value);
        }, 300);
    };

    const totalActiveCount = activeFilterCount + (currentSort ? 1 : 0);

    return (
        <>
            <div className="bg-white rounded-xl border border-surface-200 shadow-sm overflow-hidden">
                {/* Desktop View */}
                <div className="hidden md:flex items-center gap-3 p-3">
                    {/* Search */}
                    <div className="relative flex-1 max-w-sm">
                        <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-surface-400" />
                        <input
                            type="text"
                            value={localSearch}
                            onChange={(e) => handleSearchInput(e.target.value)}
                            placeholder={searchPlaceholder}
                            className="w-full pl-9 pr-8 py-2 text-sm outline-none bg-surface-50 rounded-lg border border-surface-200 focus:border-accent-300 focus:ring-2 focus:ring-accent-100 transition-all text-surface-700 placeholder-surface-400"
                        />
                        {localSearch && (
                            <button
                                onClick={() => { setLocalSearch(''); onSearchChange(''); }}
                                className="absolute right-2 top-1/2 -translate-y-1/2 p-0.5 rounded hover:bg-surface-200 text-surface-400 transition-colors"
                            >
                                <X className="w-3.5 h-3.5" />
                            </button>
                        )}
                    </div>

                    <div className="h-6 w-px bg-surface-200" />

                    {/* Filter Dropdowns */}
                    {filters.map((filter) => (
                        <select
                            key={filter.key}
                            value={filterValues[filter.key] || ''}
                            onChange={(e) => onFilterChange(filter.key, e.target.value)}
                            className={cn(
                                'text-sm flex-1 px-3 py-2 rounded-lg border outline-none cursor-pointer transition-all appearance-none bg-no-repeat bg-[length:16px] bg-[right_8px_center]',
                                filterValues[filter.key]
                                    ? 'bg-accent-50 text-accent-700 border-accent-200 font-semibold'
                                    : 'bg-white text-surface-600 border-surface-200 hover:border-surface-300'
                            )}
                            style={{
                            }}
                        >
                            <option value="">{filter.label}</option>
                            {filter.options.map((opt) => (
                                <option key={opt.value} value={opt.value}>{opt.label}</option>
                            ))}
                        </select>
                    ))}

                    {/* Sort Dropdown */}
                    {sortOptions.length > 0 && (
                        <select
                            value={currentSort ? `${currentSort}:${currentOrder}` : ''}
                            onChange={(e) => {
                                const val = e.target.value;
                                if (!val) {
                                    onMobileApply({ sort: '', order: '' });
                                } else {
                                    const [field] = val.split(':');
                                    onSortChange(field);
                                }
                            }}
                            className={cn(
                                ' flex flex-1 justify-center items-center text-sm px-3 py-2 rounded-lg border outline-none cursor-pointer transition-all appearance-none bg-no-repeat bg-[length:16px] bg-[right_8px_center]',
                                currentSort
                                    ? 'bg-accent-50 text-accent-700 border-accent-200 font-semibold'
                                    : 'bg-white text-surface-600 border-surface-200 hover:border-surface-300'
                            )}
                            style={{
                            }}
                        >
                            <option value="">Sắp xếp</option>
                            {sortOptions.map((opt) => (
                                <option key={opt.value} value={`${opt.value}:asc`}>{opt.label}</option>
                            ))}
                        </select>
                    )}

                    {/* Clear all button */}
                    {totalActiveCount > 0 && (
                        <button
                            onClick={onClearAll}
                            className="text-xs text-surface-500 hover:text-danger-500 px-2 py-1 rounded-md hover:bg-danger-50 transition-colors whitespace-nowrap"
                        >
                            Xóa lọc ({totalActiveCount})
                        </button>
                    )}
                </div>

                {/* Mobile View */}
                <div className="flex md:hidden items-center gap-2 p-3">
                    {/* Search */}
                    <div className="relative flex-1">
                        <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-surface-400" />
                        <input
                            type="text"
                            value={localSearch}
                            onChange={(e) => handleSearchInput(e.target.value)}
                            placeholder={searchPlaceholder}
                            className="w-full pl-9 pr-8 py-2.5 text-sm outline-none bg-surface-50 rounded-lg border border-surface-200 focus:border-accent-300 focus:ring-2 focus:ring-accent-100 transition-all text-surface-700 placeholder-surface-400"
                        />
                        {localSearch && (
                            <button
                                onClick={() => { setLocalSearch(''); onSearchChange(''); }}
                                className="absolute right-2 top-1/2 -translate-y-1/2 p-0.5 rounded hover:bg-surface-200 text-surface-400"
                            >
                                <X className="w-3.5 h-3.5" />
                            </button>
                        )}
                    </div>

                    {/* Filter & Sort Button */}
                    <button
                        onClick={() => setIsDrawerOpen(true)}
                        className={cn(
                            'relative flex items-center gap-1.5 px-3 py-2.5 rounded-lg border text-sm font-medium transition-all shrink-0',
                            totalActiveCount > 0
                                ? 'bg-accent-50 text-accent-700 border-accent-200'
                                : 'bg-white text-surface-600 border-surface-200 hover:bg-surface-50'
                        )}
                    >
                        <SlidersHorizontal className="w-4 h-4" />
                        <span className="hidden sm:inline">Lọc</span>
                        {totalActiveCount > 0 && (
                            <span className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-accent-600 text-white text-[10px] font-bold rounded-full flex items-center justify-center shadow-sm">
                                {totalActiveCount}
                            </span>
                        )}
                    </button>
                </div>
            </div>

            {/* Mobile Drawer */}
            <MobileFilterDrawer
                isOpen={isDrawerOpen}
                onClose={() => setIsDrawerOpen(false)}
                filters={filters}
                sortOptions={sortOptions}
                currentValues={filterValues}
                currentSort={currentSort}
                currentOrder={currentOrder}
                onApply={onMobileApply}
                onClear={onClearAll}
            />
        </>
    );
}

// ─── Sortable Table Header ────────────────────────────────────────
// Helper component for clickable sort headers

interface SortableHeaderProps {
    label: string;
    field: string;
    currentSort: string;
    currentOrder: string;
    onSort: (field: string) => void;
    className?: string;
}

export function SortableHeader({
    label,
    field,
    currentSort,
    currentOrder,
    onSort,
    className,
}: SortableHeaderProps) {
    const isActive = currentSort === field;

    return (
        <th
            className={cn(
                'px-4 py-3.5 font-semibold cursor-pointer select-none group hover:text-accent-600 transition-colors',
                isActive && 'text-accent-700',
                className
            )}
            onClick={() => onSort(field)}
        >
            <div className="flex items-center gap-1 justify-center">
                {label}
                <span className="inline-flex">
                    {isActive ? (
                        currentOrder === 'asc' ? (
                            <ChevronUp className="w-3.5 h-3.5 text-accent-600" />
                        ) : (
                            <ChevronDown className="w-3.5 h-3.5 text-accent-600" />
                        )
                    ) : (
                        <ChevronsUpDown className="w-3.5 h-3.5 text-surface-300 group-hover:text-surface-400" />
                    )}
                </span>
            </div>
        </th>
    );
}
