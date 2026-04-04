'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { getReferralPoints, syncReferralPoints } from '@/actions/referral';
import { Star, ChevronRight, Copy, Check, RefreshCw, AlertCircle } from 'lucide-react';

type SyncState = 'idle' | 'syncing' | 'done' | 'error';

export default function ReferralPointsWidget() {
    const router = useRouter();
    const { user, userDoc } = useAuth();
    const [points, setPoints] = useState<number | null>(null);
    const [copied, setCopied] = useState(false);
    const [sync, setSync] = useState<SyncState>('idle');
    const [result, setResult] = useState<{ matched: number; expired: number } | null>(null);

    // Only render for STORE employees (nhân viên vận hành)
    const isStoreEmployee = userDoc?.storeId !== null;
    const refCode = user?.uid ? `REF-${user.uid}` : '';

    const loadPoints = useCallback(async () => {
        if (!user?.uid || !isStoreEmployee) return;
        const pts = await getReferralPoints(user.uid);
        setPoints(pts);
    }, [user?.uid, isStoreEmployee]);

    useEffect(() => {
        loadPoints();
    }, [loadPoints]);

    if (!isStoreEmployee) return null;

    const copyCode = async (e: React.MouseEvent) => {
        e.stopPropagation();
        try {
            await navigator.clipboard.writeText(refCode);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        } catch { /* clipboard not supported */ }
    };

    const handleSync = async (e: React.MouseEvent) => {
        e.stopPropagation();          // không trigger router.push
        if (sync === 'syncing') return;

        setSync('syncing');
        setResult(null);

        try {
            const res = await syncReferralPoints();
            if (res.error) {
                setSync('error');
            } else {
                setSync('done');
                setResult({ matched: res.matched, expired: res.expired });
                // Reload điểm ngay sau khi sync xong
                await loadPoints();
            }
        } catch {
            setSync('error');
        }

        // Reset trạng thái icon sau 4s
        setTimeout(() => {
            setSync('idle');
            setResult(null);
        }, 4000);
    };

    return (
        <button
            onClick={() => router.push('/employee/referral-history')}
            className="w-full text-left rounded-2xl overflow-hidden bg-gradient-to-br from-amber-50 via-yellow-50 to-amber-100 border border-amber-200 shadow-sm active:scale-[0.98] transition-transform duration-100"
        >
            <div className="h-1 bg-gradient-to-r from-amber-400 via-yellow-400 to-amber-500" />
            <div className="p-4 space-y-2.5">
                <div className="flex items-center gap-3.5">
                    <span className="w-12 h-12 rounded-xl bg-gradient-to-br from-amber-400 to-yellow-500 flex items-center justify-center shadow-md shadow-amber-200/50 shrink-0">
                        <Star className="w-6 h-6 text-white" fill="currentColor" strokeWidth={1.5} />
                    </span>
                    <div className="flex-1 min-w-0">
                        <p className="text-[11px] font-semibold text-amber-700/70 uppercase tracking-wider">
                            Điểm giới thiệu
                        </p>
                        <p className="text-2xl font-black text-amber-800 leading-tight">
                            {points?.toLocaleString('vi-VN') || '0'}
                            <span className="text-sm font-bold text-amber-600 ml-1">điểm</span>
                        </p>
                    </div>

                    {/* Right side: sync button + chevron */}
                    <div className="flex items-center gap-2 shrink-0">
                        {/* Sync button */}
                        <button
                            onClick={handleSync}
                            disabled={sync === 'syncing'}
                            title="Đồng bộ điểm giới thiệu"
                            className="w-12 h-12 rounded-xl flex items-center justify-center transition-all active:scale-90
                                bg-amber-200 hover:bg-amber-200 disabled:opacity-60"
                            aria-label="Đồng bộ điểm"
                        >
                            {sync === 'error' ? (
                                <AlertCircle className="w-4 h-4 text-red-500" />
                            ) : sync === 'done' ? (
                                <Check className="w-4 h-4 text-emerald-500" />
                            ) : (
                                <RefreshCw className={`w-4 h-4 text-amber-600 ${sync === 'syncing' ? 'animate-spin' : ''}`} />
                            )}
                        </button>
                    </div>
                </div>

                {/* Sync result toast */}
                {result && sync === 'done' && (
                    <div className="flex items-center gap-2 px-3 py-1.5 bg-emerald-50 rounded-xl border border-emerald-100 text-[11px] text-emerald-700 font-medium"
                        onClick={e => e.stopPropagation()}>
                        <Check className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                        Đồng bộ xong — {result.matched > 0
                            ? `+${result.matched} đơn khớp, cộng điểm thành công`
                            : 'Không có đơn mới để khớp'}
                    </div>
                )}
                {sync === 'error' && (
                    <div className="flex items-center gap-2 px-3 py-1.5 bg-red-50 rounded-xl border border-red-100 text-[11px] text-red-600 font-medium"
                        onClick={e => e.stopPropagation()}>
                        <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                        Không thể kết nối hệ thống. Thử lại sau.
                    </div>
                )}

                {/* Employee referral code */}
            </div>
        </button>
    );
}
