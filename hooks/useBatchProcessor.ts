'use client';

import { useState, useCallback, useRef } from 'react';

// ═════════════════════════════════════════════════════════════════
// Universal Batch Processor Hook
// Handles three chunking strategies for massive Firestore operations:
//   1. processByQuantity — loop by quantity (create/add codes)
//   2. processByCursor   — server cursor pagination (update expiry)
//   3. processByArray    — array slicing (bulk revoke)
// ═════════════════════════════════════════════════════════════════

export interface BatchProcessorState {
    isProcessing: boolean;
    progress: number;         // 0–100
    processedCount: number;
    totalCount: number;
    currentAction: string;
    error: string | null;
    isComplete: boolean;
}

interface BatchResult {
    success: boolean;
    totalProcessed: number;
    error?: string;
}

export function useBatchProcessor() {
    const [state, setState] = useState<BatchProcessorState>({
        isProcessing: false,
        progress: 0,
        processedCount: 0,
        totalCount: 0,
        currentAction: '',
        error: null,
        isComplete: false,
    });

    const abortRef = useRef(false);

    const reset = useCallback(() => {
        abortRef.current = false;
        setState({
            isProcessing: false,
            progress: 0,
            processedCount: 0,
            totalCount: 0,
            currentAction: '',
            error: null,
            isComplete: false,
        });
    }, []);

    const abort = useCallback(() => {
        abortRef.current = true;
    }, []);

    // ── Strategy 1: Process by quantity chunks ──────────────────
    // For: creating/adding voucher codes in batches of `chunkSize`
    const processByQuantity = useCallback(async (
        endpoint: string,
        payload: Record<string, unknown>,
        totalQuantity: number,
        chunkSize: number,
        getToken: () => Promise<string | undefined>,
    ): Promise<BatchResult> => {
        abortRef.current = false;
        setState({
            isProcessing: true,
            progress: 0,
            processedCount: 0,
            totalCount: totalQuantity,
            currentAction: 'Đang tạo mã voucher...',
            error: null,
            isComplete: false,
        });

        let totalProcessed = 0;
        let remaining = totalQuantity;

        try {
            while (remaining > 0 && !abortRef.current) {
                const qty = Math.min(remaining, chunkSize);
                const token = await getToken();
                const res = await fetch(endpoint, {
                    method: 'PATCH',
                    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
                    body: JSON.stringify({ ...payload, quantity: qty }),
                });

                if (!res.ok) {
                    const data = await res.json();
                    throw new Error(data.error || `HTTP ${res.status}`);
                }

                const data = await res.json();
                const generated = data.generatedCount || qty;
                totalProcessed += generated;
                remaining -= generated;

                setState(prev => ({
                    ...prev,
                    processedCount: totalProcessed,
                    progress: Math.round((totalProcessed / totalQuantity) * 100),
                    currentAction: `Đang tạo mã voucher... (${totalProcessed.toLocaleString()}/${totalQuantity.toLocaleString()})`,
                }));
            }

            setState(prev => ({ ...prev, isProcessing: false, isComplete: true, progress: 100, currentAction: 'Hoàn tất!' }));
            return { success: true, totalProcessed };
        } catch (err) {
            const msg = err instanceof Error ? err.message : 'Lỗi không xác định';
            setState(prev => ({ ...prev, isProcessing: false, error: msg }));
            return { success: false, totalProcessed, error: msg };
        }
    }, []);

    // ── Strategy 2: Process by server cursor ────────────────────
    // For: update_expiry where server returns nextCursor + isComplete
    const processByCursor = useCallback(async (
        endpoint: string,
        payload: Record<string, unknown>,
        expectedTotal: number,
        getToken: () => Promise<string | undefined>,
    ): Promise<BatchResult> => {
        abortRef.current = false;
        setState({
            isProcessing: true,
            progress: 0,
            processedCount: 0,
            totalCount: expectedTotal,
            currentAction: 'Đang cập nhật...',
            error: null,
            isComplete: false,
        });

        let totalProcessed = 0;
        let cursor: string | null = null;

        try {
            let complete = false;
            while (!complete && !abortRef.current) {
                const token = await getToken();
                const body: Record<string, unknown> = { ...payload };
                if (cursor) body.lastDocId = cursor;

                const res = await fetch(endpoint, {
                    method: 'PATCH',
                    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
                    body: JSON.stringify(body),
                });

                if (!res.ok) {
                    const data = await res.json();
                    throw new Error(data.error || `HTTP ${res.status}`);
                }

                const data = await res.json();
                totalProcessed += data.updatedCount || 0;
                cursor = data.nextCursor || null;
                complete = data.isComplete === true;

                const pct = expectedTotal > 0
                    ? Math.min(Math.round((totalProcessed / expectedTotal) * 100), complete ? 100 : 99)
                    : (complete ? 100 : 50);

                setState(prev => ({
                    ...prev,
                    processedCount: totalProcessed,
                    progress: pct,
                    currentAction: `Đang cập nhật... (${totalProcessed.toLocaleString()}/${expectedTotal.toLocaleString()})`,
                }));
            }

            setState(prev => ({ ...prev, isProcessing: false, isComplete: true, progress: 100, currentAction: 'Hoàn tất!' }));
            return { success: true, totalProcessed };
        } catch (err) {
            const msg = err instanceof Error ? err.message : 'Lỗi không xác định';
            setState(prev => ({ ...prev, isProcessing: false, error: msg }));
            return { success: false, totalProcessed, error: msg };
        }
    }, []);

    // ── Strategy 3: Process by array slicing ────────────────────
    // For: bulk revoke where we slice an array of IDs into chunks
    const processByArray = useCallback(async (
        endpoint: string,
        payloadTemplate: Record<string, unknown>,
        items: string[],
        chunkSize: number,
        getToken: () => Promise<string | undefined>,
    ): Promise<BatchResult> => {
        abortRef.current = false;
        const total = items.length;
        setState({
            isProcessing: true,
            progress: 0,
            processedCount: 0,
            totalCount: total,
            currentAction: 'Đang xử lý...',
            error: null,
            isComplete: false,
        });

        let totalProcessed = 0;

        try {
            for (let i = 0; i < total && !abortRef.current; i += chunkSize) {
                const chunk = items.slice(i, i + chunkSize);
                const token = await getToken();
                const res = await fetch(endpoint, {
                    method: 'PATCH',
                    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
                    body: JSON.stringify({ ...payloadTemplate, codeIds: chunk }),
                });

                if (!res.ok) {
                    const data = await res.json();
                    throw new Error(data.error || `HTTP ${res.status}`);
                }

                const data = await res.json();
                totalProcessed += data.revoked || chunk.length;

                setState(prev => ({
                    ...prev,
                    processedCount: totalProcessed,
                    progress: Math.round(((i + chunk.length) / total) * 100),
                    currentAction: `Đang xử lý... (${totalProcessed.toLocaleString()}/${total.toLocaleString()})`,
                }));
            }

            setState(prev => ({ ...prev, isProcessing: false, isComplete: true, progress: 100, currentAction: 'Hoàn tất!' }));
            return { success: true, totalProcessed };
        } catch (err) {
            const msg = err instanceof Error ? err.message : 'Lỗi không xác định';
            setState(prev => ({ ...prev, isProcessing: false, error: msg }));
            return { success: false, totalProcessed, error: msg };
        }
    }, []);

    return {
        ...state,
        reset,
        abort,
        processByQuantity,
        processByCursor,
        processByArray,
    };
}
