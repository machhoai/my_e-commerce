'use client';

import { useRouter, usePathname, useSearchParams } from 'next/navigation';
import { useCallback, useMemo } from 'react';

export type SortOrder = 'asc' | 'desc';

export interface TableParams {
    q: string;
    sort: string;
    order: SortOrder;
    page: string;
    pageSize: string;
    [key: string]: string;
}

/**
 * URL-based state management hook for data tables.
 * Reads/writes search, filter, and sort state from URL search params.
 */
export function useTableParams() {
    const router = useRouter();
    const pathname = usePathname();
    const searchParams = useSearchParams();

    const RESERVED_KEYS = ['q', 'sort', 'order', 'page', 'pageSize'];

    const params = useMemo<TableParams>(() => ({
        q: searchParams.get('q') || '',
        sort: searchParams.get('sort') || '',
        order: (searchParams.get('order') as SortOrder) || 'asc',
        page: searchParams.get('page') || '1',
        pageSize: searchParams.get('pageSize') || '10',
        // Spread all other params as generic filters
        ...Object.fromEntries(
            Array.from(searchParams.entries()).filter(
                ([key]) => !RESERVED_KEYS.includes(key)
            )
        ),
    }), [searchParams]);

    const createQueryString = useCallback(
        (updates: Record<string, string>) => {
            const current = new URLSearchParams(searchParams.toString());
            Object.entries(updates).forEach(([key, value]) => {
                if (value) {
                    current.set(key, value);
                } else {
                    current.delete(key);
                }
            });
            return current.toString();
        },
        [searchParams]
    );

    const setParam = useCallback(
        (key: string, value: string) => {
            // Auto-reset to page 1 when changing any filter/search/sort
            const updates: Record<string, string> = { [key]: value };
            if (key !== 'page' && key !== 'pageSize') {
                updates.page = '';
            }
            const qs = createQueryString(updates);
            router.replace(`${pathname}${qs ? `?${qs}` : ''}`, { scroll: false });
        },
        [router, pathname, createQueryString]
    );

    const setParams = useCallback(
        (updates: Record<string, string>) => {
            // Auto-reset to page 1 unless page or pageSize is explicitly being set
            const hasPageKey = 'page' in updates || 'pageSize' in updates;
            if (!hasPageKey) {
                updates = { ...updates, page: '' };
            }
            const qs = createQueryString(updates);
            router.replace(`${pathname}${qs ? `?${qs}` : ''}`, { scroll: false });
        },
        [router, pathname, createQueryString]
    );

    const clearAll = useCallback(() => {
        router.replace(pathname, { scroll: false });
    }, [router, pathname]);

    const toggleSort = useCallback(
        (field: string) => {
            const currentSort = searchParams.get('sort');
            const currentOrder = searchParams.get('order') || 'asc';

            if (currentSort === field) {
                // Toggle order
                setParams({
                    sort: field,
                    order: currentOrder === 'asc' ? 'desc' : 'asc',
                });
            } else {
                // New sort field, default asc
                setParams({ sort: field, order: 'asc' });
            }
        },
        [searchParams, setParams]
    );

    const setPage = useCallback(
        (page: number) => {
            const qs = createQueryString({ page: page <= 1 ? '' : String(page) });
            router.replace(`${pathname}${qs ? `?${qs}` : ''}`, { scroll: false });
        },
        [router, pathname, createQueryString]
    );

    const setPageSize = useCallback(
        (size: number) => {
            const qs = createQueryString({ pageSize: String(size), page: '' });
            router.replace(`${pathname}${qs ? `?${qs}` : ''}`, { scroll: false });
        },
        [router, pathname, createQueryString]
    );

    const activeFilterCount = useMemo(() => {
        let count = 0;
        searchParams.forEach((value, key) => {
            if (!RESERVED_KEYS.includes(key) && value) {
                count++;
            }
        });
        return count;
    }, [searchParams]);

    return {
        params,
        setParam,
        setParams,
        clearAll,
        toggleSort,
        setPage,
        setPageSize,
        activeFilterCount,
    };
}
