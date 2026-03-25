'use client';

import { CheckCircle2, AlertCircle, Loader2, X } from 'lucide-react';
import type { BatchProcessorState } from '@/hooks/useBatchProcessor';

// ═════════════════════════════════════════════════════════════════
// Universal Batch Progress Modal
// Consumes state from useBatchProcessor hook
// Blocks interaction while processing, shows animated progress
// ═════════════════════════════════════════════════════════════════

interface BatchProgressModalProps {
    state: BatchProcessorState;
    onClose: () => void;
    title?: string;
}

export default function BatchProgressModal({ state, onClose, title }: BatchProgressModalProps) {
    const { isProcessing, progress, processedCount, totalCount, currentAction, error, isComplete } = state;

    // Don't render if nothing is happening
    if (!isProcessing && !isComplete && !error) return null;

    const canClose = isComplete || !!error;

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            {/* Backdrop — blocks pointer events */}
            <div
                className="absolute inset-0 bg-black/50 backdrop-blur-sm"
                onClick={canClose ? onClose : undefined}
                style={{ cursor: canClose ? 'pointer' : 'not-allowed' }}
            />

            {/* Modal */}
            <div className="relative bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden">
                {/* Header */}
                <div className="flex items-center justify-between px-6 py-4 border-b border-surface-100">
                    <h2 className="text-sm font-bold text-surface-800">
                        {title || 'Đang xử lý dữ liệu'}
                    </h2>
                    {canClose && (
                        <button
                            onClick={onClose}
                            className="p-1.5 rounded-lg hover:bg-surface-100 text-surface-400 transition-colors"
                        >
                            <X className="w-4 h-4" />
                        </button>
                    )}
                </div>

                {/* Body */}
                <div className="px-6 py-8 space-y-6">
                    {/* Icon / Status */}
                    <div className="flex flex-col items-center gap-3">
                        {error ? (
                            <div className="w-16 h-16 rounded-full bg-danger-50 flex items-center justify-center">
                                <AlertCircle className="w-8 h-8 text-danger-500" />
                            </div>
                        ) : isComplete ? (
                            <div className="w-16 h-16 rounded-full bg-success-50 flex items-center justify-center animate-in zoom-in-50 duration-300">
                                <CheckCircle2 className="w-8 h-8 text-success-500" />
                            </div>
                        ) : (
                            <div className="w-16 h-16 rounded-full bg-accent-50 flex items-center justify-center">
                                <Loader2 className="w-8 h-8 text-accent-500 animate-spin" />
                            </div>
                        )}

                        <p className="text-sm font-semibold text-surface-700 text-center">
                            {error ? 'Đã xảy ra lỗi' : currentAction}
                        </p>

                        {error && (
                            <p className="text-xs text-danger-600 bg-danger-50 px-3 py-2 rounded-xl border border-danger-200 text-center max-w-full">
                                {error}
                            </p>
                        )}
                    </div>

                    {/* Progress Bar */}
                    <div className="space-y-2">
                        <div className="h-3 bg-surface-100 rounded-full overflow-hidden">
                            <div
                                className={`h-full rounded-full transition-all duration-500 ease-out ${
                                    error
                                        ? 'bg-danger-400'
                                        : isComplete
                                            ? 'bg-success-500'
                                            : 'bg-gradient-to-r from-accent-400 to-accent-600'
                                }`}
                                style={{ width: `${progress}%` }}
                            />
                        </div>
                        <div className="flex items-center justify-between">
                            <span className="text-xs text-surface-500">
                                {processedCount.toLocaleString()} / {totalCount.toLocaleString()}
                            </span>
                            <span className={`text-xs font-bold ${
                                error ? 'text-danger-600' : isComplete ? 'text-success-600' : 'text-accent-600'
                            }`}>
                                {progress}%
                            </span>
                        </div>
                    </div>
                </div>

                {/* Footer */}
                {canClose && (
                    <div className="px-6 py-4 border-t border-surface-100 bg-surface-50/50">
                        <button
                            onClick={onClose}
                            className={`w-full py-2.5 rounded-xl text-sm font-semibold transition-all ${
                                error
                                    ? 'bg-danger-500 text-white hover:bg-danger-600'
                                    : 'bg-success-500 text-white hover:bg-success-600'
                            }`}
                        >
                            {error ? 'Đóng' : 'Hoàn tất'}
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
}
