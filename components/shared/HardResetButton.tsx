'use client';

import { useState } from 'react';
import { RefreshCw, ChevronRight, Loader2 } from 'lucide-react';

/**
 * HardResetButton — nuclear option for users stuck on a stale cached version.
 *
 * Actions:
 * 1. Unregister ALL service workers
 * 2. Delete ALL caches
 * 3. Force-reload bypassing the cache
 */
export default function HardResetButton() {
    const [isResetting, setIsResetting] = useState(false);

    const handleHardReset = async () => {
        setIsResetting(true);

        try {
            // 1. Unregister all service workers
            if (typeof navigator !== 'undefined' && 'serviceWorker' in navigator) {
                const registrations = await navigator.serviceWorker.getRegistrations();
                await Promise.all(registrations.map((r) => r.unregister()));
            }

            // 2. Clear all caches
            if (typeof caches !== 'undefined') {
                const keys = await caches.keys();
                await Promise.all(keys.map((key) => caches.delete(key)));
            }

            // 3. Force reload bypassing cache
            window.location.href =
                window.location.origin + '?refresh=' + Date.now();
        } catch (err) {
            console.error('[HardReset] Failed:', err);
            // Even if something fails, try to reload
            window.location.reload();
        }
    };

    return (
        <button
            onClick={handleHardReset}
            disabled={isResetting}
            className="w-full flex items-center gap-3 px-4 py-3 bg-white rounded-xl border border-amber-100 shadow-sm active:scale-[0.99] transition-all disabled:opacity-60"
        >
            <div className="w-8 h-8 rounded-lg bg-amber-50 flex items-center justify-center">
                {isResetting ? (
                    <Loader2 className="w-4 h-4 text-amber-600 animate-spin" />
                ) : (
                    <RefreshCw className="w-4 h-4 text-amber-600" />
                )}
            </div>
            <div className="flex-1 text-left">
                <span className="text-xs font-bold text-gray-700">
                    {isResetting ? 'Đang làm mới...' : 'Làm mới ứng dụng'}
                </span>
                <p className="text-[9px] text-gray-400 mt-0.5">
                    Xóa cache và cập nhật phiên bản mới nhất
                </p>
            </div>
            <ChevronRight className="w-4 h-4 text-amber-300" />
        </button>
    );
}
