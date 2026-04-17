'use client';

import { useState, useEffect } from 'react';
import { Star } from 'lucide-react';
import { db } from '@/lib/firebase';
import { collection, query, where, getDocs } from 'firebase/firestore';

interface TopEmployee {
    uid: string;
    name: string;
    points: number;
}

interface TopReferralMarqueeProps {
    className?: string;
    initialData?: TopEmployee[];
    onClick?: () => void;
    /** Language code — 'vi' (default) or 'zh' */
    lang?: 'vi' | 'zh';
}

const RANK_LABELS = ['🥇', '🥈', '🥉'];

// ── Mini bilingual dictionary ─────────────────────────────────────────────────
const MARQUEE_DICT = {
    vi: {
        title: (month: string) => `🏆 Bảng vàng chiến thần vịt vàng tháng ${month} 🦆`,
        points: 'điểm',
        ariaLabel: 'Xem bảng vàng thánh chỉ',
        monthLocale: 'vi-VN',
    },
    zh: {
        title: (month: string) => `🏆 ${month}黄金鸭销售精英榜 🦆`,
        points: '积分',
        ariaLabel: '查看荣誉榜单',
        monthLocale: 'zh-CN',
    },
} as const;

/** Fetch top referral employees trực tiếp từ Firestore client-side (luôn fresh) */
async function fetchTopReferralLive(): Promise<TopEmployee[]> {
    const now = new Date();
    const mk = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    const snap = await getDocs(
        query(collection(db, 'users'), where('isActive', '==', true))
    );
    return snap.docs
        .map(d => {
            const data = d.data();
            const monthly = (data.monthlyReferralPoints as Record<string, number> | undefined)?.[mk] ?? 0;
            const total   = (data.referralPoints ?? 0) as number;
            return {
                uid:    d.id,
                name:   (data.name ?? 'Nhân viên') as string,
                points: monthly > 0 ? monthly : total,
            };
        })
        .filter(e => e.points > 0)
        .sort((a, b) => b.points - a.points)
        .slice(0, 5);
}

export default function TopReferralMarquee({
    className,
    initialData = [],
    onClick,
    lang = 'vi',
}: TopReferralMarqueeProps) {
    const [data, setData] = useState<TopEmployee[]>(initialData);

    useEffect(() => {
        fetchTopReferralLive()
            .then(live => { if (live.length > 0) setData(live); })
            .catch(() => { });
    }, []);

    if (data.length === 0) return <div className={className} />;

    const dict = MARQUEE_DICT[lang];
    const now = new Date();
    const monthName = now.toLocaleDateString(dict.monthLocale, { month: 'long' }).toUpperCase();

    const marqueeContent = data
        .slice(0, 3)
        .map((emp, i) => `${RANK_LABELS[i]} ${emp.name} — ${emp.points.toLocaleString('vi-VN')} ${dict.points}`)
        .join('   ✦   ');

    const fullText = `${dict.title(monthName)}   ${marqueeContent}`;

    return (
        <div
            className={`relative overflow-hidden rounded-xl ${className ?? ''} ${onClick ? 'cursor-pointer active:scale-[0.98] transition-transform' : ''}`}
            onClick={onClick}
            role={onClick ? 'button' : undefined}
            aria-label={onClick ? dict.ariaLabel : undefined}
        >
            {/* Gradient background */}
            <div className="absolute inset-0 bg-gradient-to-r from-amber-500 via-yellow-500 to-amber-500 opacity-95" />
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_-20%,_rgba(255,255,255,0.3)_0%,_transparent_60%)]" />

            {/* Star pattern overlay */}
            <div className="absolute inset-0 opacity-[0.08]" style={{
                backgroundImage: 'radial-gradient(circle, white 1px, transparent 1px)',
                backgroundSize: '14px 14px',
            }} />

            <div className="relative flex items-center h-9 px-2">
                {/* Trophy icon */}
                <div className="flex-shrink-0 flex items-center justify-center w-6 h-6 rounded-full bg-white/20 mr-2 z-10">
                    <Star className="w-3.5 h-3.5 text-white" fill="currentColor" />
                </div>

                {/* Scrolling text */}
                <div className="flex-1 overflow-hidden relative">
                    <div className="absolute left-0 top-0 bottom-0 w-6 bg-gradient-to-r from-amber-500 to-transparent z-10" />
                    <div className="absolute right-0 top-0 bottom-0 w-6 bg-gradient-to-l from-amber-500 to-transparent z-10" />

                    <div className="w-full overflow-hidden flex">
                        <div className="animate-marquee [animation-duration:15s] whitespace-nowrap flex w-max items-center">
                            {[fullText, fullText, fullText, fullText].map((text, i) => (
                                <span key={i} className="inline-block text-[12px] font-bold text-white tracking-wide drop-shadow-sm mx-8">
                                    {text}
                                </span>
                            ))}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
