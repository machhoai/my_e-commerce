'use client';

import { useEffect, useState } from 'react';
import type { User } from 'firebase/auth';
import type { UserDoc } from '@/types';
import { fetchStoreMembers } from '@/lib/workplace/client';
import { showToast } from '@/lib/utils/toast';
import { useMobileTranslation } from '@/lib/i18n/useMobileTranslation';

/** Mapping candidates use effective store memberships, including secondary stores. */
export function useAttendanceMappingEmployees(user: User | null, storeId: string, enabled: boolean) {
    const { t } = useMobileTranslation();
    const [result, setResult] = useState<{ storeId: string; callerUid: string; employees: UserDoc[] } | null>(null);

    useEffect(() => {
        if (!user || !storeId || !enabled) return;
        const controller = new AbortController();
        void (async () => {
            try {
                const members = await fetchStoreMembers(user, storeId, controller.signal);
                if (controller.signal.aborted) return;
                const employees = members
                    .filter(employee => employee.isActive !== false && employee.role !== 'admin')
                    .sort((a, b) => a.name.localeCompare(b.name, 'vi'));
                setResult({ storeId, callerUid: user.uid, employees });
            } catch (error) {
                if (controller.signal.aborted) return;
                setResult(null);
                console.error('[Mapping] Failed to load store employees:', error);
                showToast.error(t('common.error'), error instanceof Error ? error.message : t('attendance.mappingEmployeesLoadError'));
            }
        })();
        return () => controller.abort();
    }, [enabled, storeId, t, user]);

    return enabled && result?.storeId === storeId && result.callerUid === user?.uid ? result.employees : [];
}
