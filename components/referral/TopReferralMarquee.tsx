'use client';

import { Star } from 'lucide-react';

interface TopEmployee {
    uid: string;
    name: string;
    points: number;
}

const RANK_LABELS = ['🥇', '🥈', '🥉'];

interface TopReferralMarqueeProps {
    className?: string;
    initialData?: TopEmployee[];
}

export default function TopReferralMarquee({ className, initialData = [] }: TopReferralMarqueeProps) {
    // Don't render marquee if no employees have points, but render a spacer
    if (initialData.length === 0) return <div className={className} />;

    const now = new Date();
    const monthName = now.toLocaleDateString('vi-VN', { month: 'long' });

    // Build the marquee text
    const marqueeContent = initialData.map((emp, i) => (
        `${RANK_LABELS[i]} ${emp.name} — ${emp.points.toLocaleString('vi-VN')} điểm`
    )).join('   ✦   ');

    const fullText = `🏆 TOP NHÂN VIÊN GIỚI THIỆU XUẤT SẮC NHẤT ${monthName.toUpperCase()}   ⭐   ${marqueeContent}`;

    return (
        <div className={`relative overflow-hidden rounded-xl ${className ?? ''}`}>
            {/* Gradient background */}
            <div className="absolute inset-0 bg-gradient-to-r from-amber-500 via-yellow-500 to-amber-500 opacity-95" />
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_-20%,_rgba(255,255,255,0.3)_0%,_transparent_60%)]" />

            {/* Star pattern overlay */}
            <div className="absolute inset-0 opacity-[0.08]" style={{
                backgroundImage: 'radial-gradient(circle, white 1px, transparent 1px)',
                backgroundSize: '14px 14px',
            }} />

            <div className="relative flex items-center h-9 px-2">
                {/* Trophy icon - fixed left */}
                <div className="flex-shrink-0 flex items-center justify-center w-6 h-6 rounded-full bg-white/20 mr-2 z-10">
                    <Star className="w-3.5 h-3.5 text-white" fill="currentColor" />
                </div>

                {/* Scrolling text container */}
                <div className="flex-1 overflow-hidden relative">
                    {/* Fade edges */}
                    <div className="absolute left-0 top-0 bottom-0 w-6 bg-gradient-to-r from-amber-500 to-transparent z-10" />
                    <div className="absolute right-0 top-0 bottom-0 w-6 bg-gradient-to-l from-amber-500 to-transparent z-10" />

                    {/* Scrolling content - duplicate for seamless loop */}
                    <div className="w-full overflow-hidden flex">

                        {/* Khung chuyển động: Thêm w-max để nó tính toán đúng -50% chiều dài */}
                        <div className="animate-marquee [animation-duration:15s] whitespace-nowrap flex w-max items-center">

                            {/* Cục 1 */}
                            <span className="inline-block text-[12px] font-bold text-white tracking-wide drop-shadow-sm mx-8">
                                {fullText}
                            </span>

                            {/* Cục 2 (Bản sao hoàn hảo để đánh lừa thị giác) */}
                            <span className="inline-block text-[12px] font-bold text-white tracking-wide drop-shadow-sm mx-8">
                                {fullText}
                            </span>

                            <span className="inline-block text-[12px] font-bold text-white tracking-wide drop-shadow-sm mx-8">
                                {fullText}
                            </span>

                            <span className="inline-block text-[12px] font-bold text-white tracking-wide drop-shadow-sm mx-8">
                                {fullText}
                            </span>

                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
