'use client';

import { useState, useEffect } from 'react';
import { X, SlidersHorizontal } from 'lucide-react';
import { cn } from '@/lib/utils';
import Portal from '@/components/Portal';

export interface FilterOption {
    value: string;
    label: string;
}

export interface FilterConfig {
    key: string;
    label: string;
    options: FilterOption[];
}

export interface SortOption {
    value: string;
    label: string;
}

interface MobileFilterDrawerProps {
    isOpen: boolean;
    onClose: () => void;
    filters: FilterConfig[];
    sortOptions: SortOption[];
    currentValues: Record<string, string>;
    currentSort: string;
    currentOrder: string;
    onApply: (values: Record<string, string>) => void;
    onClear: () => void;
}

export default function MobileFilterDrawer({
    isOpen,
    onClose,
    filters,
    sortOptions,
    currentValues,
    currentSort,
    currentOrder,
    onApply,
    onClear,
}: MobileFilterDrawerProps) {
    const [localValues, setLocalValues] = useState<Record<string, string>>({});
    const [localSort, setLocalSort] = useState('');
    const [localOrder, setLocalOrder] = useState('asc');
    const [visible, setVisible] = useState(false);
    const [animating, setAnimating] = useState(false);

    // Sync local state when drawer opens
    useEffect(() => {
        if (isOpen) {
            setLocalValues({ ...currentValues });
            setLocalSort(currentSort);
            setLocalOrder(currentOrder);
            // Trigger enter animation
            requestAnimationFrame(() => {
                setVisible(true);
                setAnimating(true);
            });
        } else {
            setAnimating(false);
            const timer = setTimeout(() => setVisible(false), 300);
            return () => clearTimeout(timer);
        }
    }, [isOpen, currentValues, currentSort, currentOrder]);

    const handleApply = () => {
        const merged: Record<string, string> = { ...localValues };
        merged.sort = localSort;
        merged.order = localSort ? localOrder : '';
        onApply(merged);
        onClose();
    };

    const handleClear = () => {
        setLocalValues({});
        setLocalSort('');
        setLocalOrder('asc');
        onClear();
        onClose();
    };

    if (!isOpen && !visible) return null;

    return (
        <Portal>
            <div className="fixed inset-0 z-[110] md:hidden">
                {/* Backdrop */}
                <div
                    className={cn(
                        'absolute inset-0 bg-black/40 backdrop-blur-sm transition-opacity duration-300',
                        animating ? 'opacity-100' : 'opacity-0'
                    )}
                    onClick={onClose}
                />

                {/* Drawer */}
                <div
                    className={cn(
                        'absolute bottom-0 left-0 right-0 bg-white rounded-t-2xl shadow-2xl transition-transform duration-300 ease-out max-h-[85vh] overflow-y-auto',
                        animating ? 'translate-y-0' : 'translate-y-full'
                    )}
                >
                    {/* Header */}
                    <div className="flex flex-col items-center sticky top-0 justify-between bg-white px-5 py-1 border-b border-slate-100">
                        <div className="flex justify-center pt-3 pb-1">
                            <div className="w-10 h-1 rounded-full bg-slate-300" />
                        </div>
                        <div className='flex w-full justify-between py-2'>
                            <div className="flex items-center gap-2">
                                <SlidersHorizontal className="w-5 h-5 text-indigo-600" />
                                <h3 className="text-lg font-bold text-slate-800">Lọc & Sắp xếp</h3>
                            </div>
                            <button
                                onClick={onClose}
                                className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 transition-colors"
                            >
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                    </div>

                    <div className="p-5 space-y-5">
                        {/* Filters */}
                        {filters.map((filter) => (
                            <div key={filter.key}>
                                <label className="block text-sm font-semibold text-slate-700 mb-2">
                                    {filter.label}
                                </label>
                                <div className="flex flex-wrap gap-2">
                                    <button
                                        onClick={() => setLocalValues(prev => {
                                            const next = { ...prev };
                                            delete next[filter.key];
                                            return next;
                                        })}
                                        className={cn(
                                            'px-3 py-1.5 rounded-lg text-sm font-medium border transition-all',
                                            !localValues[filter.key]
                                                ? 'bg-indigo-50 text-indigo-700 border-indigo-200 shadow-sm'
                                                : 'bg-white text-slate-500 border-slate-200 hover:bg-slate-50'
                                        )}
                                    >
                                        Tất cả
                                    </button>
                                    {filter.options.map((opt) => (
                                        <button
                                            key={opt.value}
                                            onClick={() => setLocalValues(prev => ({ ...prev, [filter.key]: opt.value }))}
                                            className={cn(
                                                'px-3 py-1.5 rounded-lg text-sm font-medium border transition-all',
                                                localValues[filter.key] === opt.value
                                                    ? 'bg-indigo-50 text-indigo-700 border-indigo-200 shadow-sm'
                                                    : 'bg-white text-slate-500 border-slate-200 hover:bg-slate-50'
                                            )}
                                        >
                                            {opt.label}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        ))}

                        {/* Sort Options */}
                        {sortOptions.length > 0 && (
                            <div>
                                <label className="block text-sm font-semibold text-slate-700 mb-2">
                                    Sắp xếp theo
                                </label>
                                <div className="space-y-2">
                                    {sortOptions.map((opt) => (
                                        <label
                                            key={opt.value}
                                            className={cn(
                                                'flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-all',
                                                localSort === opt.value
                                                    ? 'bg-indigo-50 border-indigo-200'
                                                    : 'bg-white border-slate-200 hover:bg-slate-50'
                                            )}
                                        >
                                            <input
                                                type="radio"
                                                name="sort"
                                                checked={localSort === opt.value}
                                                onChange={() => setLocalSort(opt.value)}
                                                className="w-4 h-4 text-indigo-600 focus:ring-indigo-500"
                                            />
                                            <span className="text-sm font-medium text-slate-700">{opt.label}</span>
                                        </label>
                                    ))}
                                </div>

                                {/* Sort direction */}
                                {localSort && (
                                    <div className="flex gap-2 mt-3">
                                        <button
                                            onClick={() => setLocalOrder('asc')}
                                            className={cn(
                                                'flex-1 px-3 py-2 rounded-lg text-sm font-medium border transition-all',
                                                localOrder === 'asc'
                                                    ? 'bg-indigo-50 text-indigo-700 border-indigo-200'
                                                    : 'bg-white text-slate-500 border-slate-200'
                                            )}
                                        >
                                            ↑ Tăng dần
                                        </button>
                                        <button
                                            onClick={() => setLocalOrder('desc')}
                                            className={cn(
                                                'flex-1 px-3 py-2 rounded-lg text-sm font-medium border transition-all',
                                                localOrder === 'desc'
                                                    ? 'bg-indigo-50 text-indigo-700 border-indigo-200'
                                                    : 'bg-white text-slate-500 border-slate-200'
                                            )}
                                        >
                                            ↓ Giảm dần
                                        </button>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>

                    {/* Action buttons */}
                    <div className="sticky bottom-0 bg-white border-t border-slate-100 px-5 py-4 flex gap-3">
                        <button
                            onClick={handleClear}
                            className="flex-1 px-4 py-2.5 rounded-xl text-sm font-semibold text-slate-600 bg-slate-100 hover:bg-slate-200 transition-colors"
                        >
                            Xóa bộ lọc
                        </button>
                        <button
                            onClick={handleApply}
                            className="flex-1 px-4 py-2.5 rounded-xl text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-700 transition-colors shadow-sm"
                        >
                            Áp dụng
                        </button>
                    </div>
                </div>
            </div>
        </Portal>
    );
}
