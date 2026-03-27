'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { getReferralPoints } from '@/actions/referral';
import { Star, ChevronRight, Copy, Check } from 'lucide-react';

export default function ReferralPointsWidget() {
    const router = useRouter();
    const { user, userDoc } = useAuth();
    const [points, setPoints] = useState<number | null>(null);
    const [copied, setCopied] = useState(false);

    // Only render for STORE employees (nhân viên vận hành)
    const isStoreEmployee = userDoc?.workplaceType === 'STORE';
    const refCode = user?.uid ? `REF-${user.uid}` : '';

    useEffect(() => {
        if (!user?.uid || !isStoreEmployee) return;
        getReferralPoints(user.uid).then(setPoints);
    }, [user?.uid, isStoreEmployee]);

    if (!isStoreEmployee || points === null) return null;

    const copyCode = async (e: React.MouseEvent) => {
        e.stopPropagation();
        try {
            await navigator.clipboard.writeText(refCode);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        } catch { /* clipboard not supported */ }
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
                            {points.toLocaleString('vi-VN')}
                            <span className="text-sm font-bold text-amber-600 ml-1">điểm</span>
                        </p>
                    </div>
                    <div className="flex items-center gap-1 text-amber-600 shrink-0">
                        <span className="text-[10px] font-bold">Xem lịch sử</span>
                        <ChevronRight className="w-3.5 h-3.5" />
                    </div>
                </div>

                {/* Employee referral code */}
                <div
                    onClick={copyCode}
                    className="flex items-center justify-between bg-white/70 rounded-xl px-3 py-2 border border-amber-200/60"
                >
                    <div className="min-w-0">
                        <p className="text-[9px] text-amber-600/70 font-bold uppercase tracking-wider">Mã giới thiệu</p>
                        <p className="text-xs font-mono font-black text-amber-800 truncate">{refCode}</p>
                    </div>
                    <span className="shrink-0 ml-2 text-amber-500">
                        {copied ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
                    </span>
                </div>
            </div>
        </button>
    );
}
