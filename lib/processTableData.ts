/**
 * Generic client-side data processing for tables.
 * Applies search, filtering, and sorting on an array of data.
 */

export interface ProcessOptions<T> {
    searchQuery?: string;
    searchFields?: (keyof T)[];
    filters?: { field: keyof T; value: string }[];
    sortField?: keyof T;
    sortOrder?: 'asc' | 'desc';
}

export function processTableData<T extends Record<string, any>>(
    data: T[],
    options: ProcessOptions<T>
): T[] {
    let result = [...data];

    // 1. Search — case-insensitive substring match on specified fields
    if (options.searchQuery && options.searchFields?.length) {
        const q = options.searchQuery.toLowerCase();
        result = result.filter(item =>
            options.searchFields!.some(field => {
                const value = item[field];
                if (value == null) return false;
                return String(value).toLowerCase().includes(q);
            })
        );
    }

    // 2. Filter — exact match on each filter field (skip empty values)
    if (options.filters?.length) {
        for (const filter of options.filters) {
            if (!filter.value) continue;
            result = result.filter(item => {
                const val = item[filter.field];
                // Support boolean-like filters: 'true'/'false' → compare to boolean
                if (typeof val === 'boolean') {
                    return String(val) === filter.value;
                }
                return String(val) === filter.value;
            });
        }
    }

    // 3. Sort — locale-aware comparison
    if (options.sortField) {
        const field = options.sortField;
        const dir = options.sortOrder === 'desc' ? -1 : 1;

        result.sort((a, b) => {
            const aVal = a[field];
            const bVal = b[field];

            if (aVal == null && bVal == null) return 0;
            if (aVal == null) return 1;
            if (bVal == null) return -1;

            if (typeof aVal === 'number' && typeof bVal === 'number') {
                return (aVal - bVal) * dir;
            }

            if (typeof aVal === 'boolean' && typeof bVal === 'boolean') {
                return ((aVal === bVal) ? 0 : aVal ? -1 : 1) * dir;
            }

            return String(aVal).localeCompare(String(bVal), 'vi') * dir;
        });
    }

    return result;
}
