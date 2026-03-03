'use client';

import { ChevronLeft, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';

const PAGE_SIZE_OPTIONS = [10, 20, 50, 100];

interface DataTablePaginationProps {
    totalItems: number;
    page: number;
    pageSize: number;
    onPageChange: (page: number) => void;
    onPageSizeChange: (size: number) => void;
}

export default function DataTablePagination({
    totalItems,
    page,
    pageSize,
    onPageChange,
    onPageSizeChange,
}: DataTablePaginationProps) {
    const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
    const safePage = Math.min(page, totalPages);
    const startItem = totalItems === 0 ? 0 : (safePage - 1) * pageSize + 1;
    const endItem = Math.min(safePage * pageSize, totalItems);

    return (
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 px-4 py-3 border-t border-slate-200 bg-slate-50/50 text-sm">
            {/* Left: page size selector */}
            <div className="flex items-center gap-2 text-slate-600">
                <span className="hidden sm:inline">Hiển thị</span>
                <select
                    value={pageSize}
                    onChange={(e) => onPageSizeChange(Number(e.target.value))}
                    className="border border-slate-200 rounded-lg px-2 py-1.5 text-sm bg-white focus:ring-2 focus:ring-indigo-300 outline-none font-medium cursor-pointer"
                >
                    {PAGE_SIZE_OPTIONS.map((size) => (
                        <option key={size} value={size}>
                            {size}
                        </option>
                    ))}
                </select>
                <span className="text-slate-500">dòng / trang</span>
            </div>

            {/* Right: info + navigation */}
            <div className="flex items-center gap-3">
                <span className="text-slate-500 tabular-nums">
                    {totalItems === 0
                        ? 'Không có dữ liệu'
                        : `${startItem}–${endItem} / ${totalItems}`}
                </span>
                <div className="flex items-center gap-1">
                    <button
                        onClick={() => onPageChange(safePage - 1)}
                        disabled={safePage <= 1}
                        className={cn(
                            'p-1.5 rounded-lg border transition-colors',
                            safePage <= 1
                                ? 'border-slate-100 text-slate-300 cursor-not-allowed'
                                : 'border-slate-200 text-slate-600 hover:bg-white hover:border-slate-300'
                        )}
                        aria-label="Trang trước"
                    >
                        <ChevronLeft className="w-4 h-4" />
                    </button>
                    <span className="min-w-[3rem] text-center font-semibold text-slate-700 tabular-nums">
                        {safePage} / {totalPages}
                    </span>
                    <button
                        onClick={() => onPageChange(safePage + 1)}
                        disabled={safePage >= totalPages}
                        className={cn(
                            'p-1.5 rounded-lg border transition-colors',
                            safePage >= totalPages
                                ? 'border-slate-100 text-slate-300 cursor-not-allowed'
                                : 'border-slate-200 text-slate-600 hover:bg-white hover:border-slate-300'
                        )}
                        aria-label="Trang sau"
                    >
                        <ChevronRight className="w-4 h-4" />
                    </button>
                </div>
            </div>
        </div>
    );
}
