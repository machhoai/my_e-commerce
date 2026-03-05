'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';

interface CounterAssignmentResult {
    isAuthorized: boolean;
    counterId: string;
    counterName: string;
    shiftId: string;
    storeId: string;
    loading: boolean;
    error: string;
}

/**
 * Hook to check if the current user has an active counter assignment
 * for today (assigned by manager). Used to determine locked/authorized
 * state on inventory usage and handover pages.
 */
export function useCounterAssignment(): CounterAssignmentResult {
    const { user } = useAuth();
    const [state, setState] = useState<Omit<CounterAssignmentResult, 'loading' | 'error'>>({
        isAuthorized: false,
        counterId: '',
        counterName: '',
        shiftId: '',
        storeId: '',
    });
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    const fetchAssignment = useCallback(async () => {
        if (!user) { setLoading(false); return; }
        setLoading(true);
        setError('');
        try {
            const token = await user.getIdToken();
            const res = await fetch('/api/inventory/my-assignment', {
                headers: { Authorization: `Bearer ${token}` },
            });
            const data = await res.json();

            if (data.isAuthorized) {
                setState({
                    isAuthorized: true,
                    counterId: data.counterId || '',
                    counterName: data.counterName || '',
                    shiftId: data.shiftId || '',
                    storeId: data.storeId || '',
                });
            } else {
                setState(prev => ({ ...prev, isAuthorized: false }));
                setError(data.message || 'Không có quyền truy cập');
            }
        } catch {
            setError('Không thể kiểm tra phân công. Vui lòng thử lại.');
        } finally {
            setLoading(false);
        }
    }, [user]);

    useEffect(() => {
        fetchAssignment();
    }, [fetchAssignment]);

    return { ...state, loading, error };
}
