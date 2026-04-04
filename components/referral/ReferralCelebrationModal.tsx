'use client';

import { useEffect, useState, useRef } from 'react';
import { X } from 'lucide-react';
import Image from 'next/image';
import { db } from '@/lib/firebase';
import { collection, query, where, getDocs } from 'firebase/firestore';

export interface TopEmployee {
    uid: string;
    name: string;
    points: number;
}

// ── Confetti ──────────────────────────────────────────────────────────────────
interface Particle {
    id: number; x: number; color: string; size: number;
    delay: number; duration: number; shape: 'rect' | 'circle' | 'diamond';
}
const COLORS = ['#C9252D', '#E8B923', '#F2E8B0', '#8B1A1A', '#D4AF37', '#FFD700', '#B8860B', '#DC143C'];
const particles: Particle[] = Array.from({ length: 45 }, (_, i) => ({
    id: i, x: Math.random() * 100,
    color: COLORS[i % COLORS.length],
    size: 5 + Math.random() * 7,
    delay: Math.random() * 4,
    duration: 3 + Math.random() * 3,
    shape: (['rect', 'circle', 'diamond'] as const)[i % 3],
}));

const RANK_EMOJI = ['🐉', '🐅', '🦅', '📜', '🏮'];
const RANK_COLOR = ['#C9252D', '#8B7355', '#8B4513', '#4A5568', '#6B7280'];
const RANK_LABEL = ['Trạng Nguyên', 'Bảng Nhãn', 'Thám Hoa', 'Hoàng Giáp', 'Tiến Sĩ'];
const SESSION_KEY = 'referral_celebration_shown';

export async function fetchTop5(): Promise<TopEmployee[]> {
    const now = new Date();
    const mk = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    const snap = await getDocs(query(collection(db, 'users'), where('isActive', '==', true)));
    return snap.docs
        .map(d => {
            const data = d.data();
            const m = (data.monthlyReferralPoints as Record<string, number> | undefined)?.[mk] ?? 0;
            const t = (data.referralPoints ?? 0) as number;
            return { uid: d.id, name: (data.name ?? 'Nhân viên') as string, points: m > 0 ? m : t };
        })
        .filter(e => e.points > 0)
        .sort((a, b) => b.points - a.points)
        .slice(0, 5);
}

// Decorative border SVG pattern
function BorderPattern({ side }: { side: 'left' | 'right' }) {
    return (
        <div className={`absolute top-0 bottom-0 ${side === 'left' ? 'left-0' : 'right-0'} w-7 flex flex-col items-center justify-around py-2 overflow-hidden`}>
            {Array.from({ length: 8 }).map((_, i) => (
                <svg key={i} width="24" height="24" viewBox="0 0 24 24" fill="none">
                    <path d="M12 3 C7 3 3 7 3 12 C3 17 7 21 12 21 C17 21 21 17 21 12"
                        stroke="#8B1A1A" strokeWidth="1.5" strokeLinecap="round" fill="none" opacity="0.6" />
                    <path d="M12 6 C9 6 6 9 6 12" stroke="#C9252D" strokeWidth="1" strokeLinecap="round" opacity="0.5" />
                    <circle cx="12" cy="12" r="1.5" fill="#C9252D" opacity="0.7" />
                </svg>
            ))}
        </div>
    );
}

// Scroll roll bar (top or bottom)
function ScrollRoll() {
    return (
        <div className="relative z-20" style={{ height: 36 }}>
            <div className="absolute inset-x-0 top-0 bottom-0 rounded-full overflow-hidden shadow-xl" style={{
                background: 'linear-gradient(to bottom, #6B3A1F 0%, #3D1F0A 30%, #7A4520 50%, #3D1F0A 70%, #6B3A1F 100%)',
                boxShadow: '0 4px 12px rgba(0,0,0,0.6), inset 0 2px 4px rgba(255,200,100,0.15)',
            }}>
                <div className="absolute inset-0" style={{
                    background: 'repeating-linear-gradient(90deg, transparent 0px, rgba(255,180,80,0.07) 2px, transparent 4px)',
                }} />
                <div className="absolute left-1/2 top-0 bottom-0 -translate-x-1/2" style={{
                    width: 60,
                    background: 'linear-gradient(to bottom, rgba(180,30,30,0.9), rgba(120,0,0,0.95), rgba(180,30,30,0.9))',
                }} />
            </div>
            <div className="absolute left-0 top-0 bottom-0 rounded-full" style={{
                width: 28,
                background: 'radial-gradient(circle at 40% 50%, #8B4A20 0%, #3D1F0A 100%)',
                boxShadow: '2px 0 6px rgba(0,0,0,0.5)',
            }} />
            <div className="absolute right-0 top-0 bottom-0 rounded-full" style={{
                width: 28,
                background: 'radial-gradient(circle at 60% 50%, #8B4A20 0%, #3D1F0A 100%)',
                boxShadow: '-2px 0 6px rgba(0,0,0,0.5)',
            }} />
        </div>
    );
}

// ── Props ─────────────────────────────────────────────────────────────────────
interface ReferralCelebrationModalProps {
    /** If true, bypass sessionStorage check and show immediately */
    forceOpen?: boolean;
    /** Called when the modal is dismissed */
    onClose?: () => void;
    /** Pre-loaded data (optional, fetched client-side if not provided) */
    initialData?: TopEmployee[];
}

export default function ReferralCelebrationModal({
    forceOpen = false,
    onClose,
    initialData,
}: ReferralCelebrationModalProps) {
    const [visible, setVisible] = useState(false);
    const [unrolling, setUnrolling] = useState(false); // scroll-open animation
    const [closing, setClosing] = useState(false);
    const [employees, setEmployees] = useState<TopEmployee[]>(initialData ?? []);
    const checked = useRef(false);

    useEffect(() => {
        // Luôn fetch dữ liệu mới nhất từ Firestore khi mount — không cache
        fetchTop5().then(data => { if (data.length > 0) setEmployees(data); }).catch(() => {});
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    useEffect(() => {
        if (forceOpen) {
            // Opened via user tap — fetch fresh data then show
            fetchTop5()
                .then(data => { if (data.length > 0) setEmployees(data); })
                .catch(() => {})
                .finally(() => triggerOpen());
            return;
        }

        // Auto-open: only once per session
        if (checked.current) return;
        checked.current = true;
        if (sessionStorage.getItem(SESSION_KEY)) return;

        fetchTop5().then(data => {
            if (data.length > 0) {
                setEmployees(data);
                setTimeout(() => triggerOpen(), 700);
            }
        }).catch(() => {});
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [forceOpen]);

    /** Start the scroll-unroll entrance sequence */
    const triggerOpen = () => {
        setVisible(true);
        setUnrolling(true);
        // After unroll animation completes, remove the unrolling flag
        setTimeout(() => setUnrolling(false), 800);
    };

    const handleClose = () => {
        setClosing(true);
        if (!forceOpen) sessionStorage.setItem(SESSION_KEY, '1');
        setTimeout(() => {
            setVisible(false);
            setClosing(false);
            onClose?.();
        }, 450);
    };

    if (!visible || employees.length === 0) return null;

    const now = new Date();
    const monthName = now.toLocaleDateString('vi-VN', { month: 'long', year: 'numeric' });

    return (
        <div
            className="fixed inset-0 z-[999] flex items-center justify-center"
            style={{
                background: 'radial-gradient(ellipse at center, rgba(80,0,0,0.75) 0%, rgba(0,0,0,0.85) 100%)',
                backdropFilter: 'blur(6px)',
                transition: 'opacity 0.45s',
                opacity: closing ? 0 : 1,
            }}
            onClick={handleClose}
        >
            {/* ── Confetti (only visible when fully open) ──────────── */}
            {!unrolling && (
                <div className="absolute inset-0 overflow-hidden pointer-events-none">
                    {particles.map(p => (
                        <div key={p.id} className="absolute top-0" style={{
                            left: `${p.x}%`,
                            animation: `imperialFall ${p.duration}s ${p.delay}s linear infinite`,
                        }}>
                            {p.shape === 'circle'
                                ? <div style={{ width: p.size, height: p.size, borderRadius: '50%', background: p.color, opacity: 0.9 }} />
                                : p.shape === 'diamond'
                                    ? <div style={{ width: p.size, height: p.size, background: p.color, transform: 'rotate(45deg)', opacity: 0.85 }} />
                                    : <div style={{ width: p.size, height: p.size * 0.45, background: p.color, opacity: 0.85, borderRadius: 1 }} />
                            }
                        </div>
                    ))}
                </div>
            )}

            {/* ── Scroll container ────────────────────────────────── */}
            <div
                className="relative mx-4 w-full"
                style={{
                    maxWidth: 360,
                    transition: closing
                        ? 'transform 0.45s cubic-bezier(0.4,0,1,1), opacity 0.45s'
                        : 'none',
                    transform: closing ? 'scale(0.9) translateY(24px)' : 'scale(1)',
                }}
                onClick={e => e.stopPropagation()}
            >
                {/* ═══ TOP SCROLL ROLL ═════════════════════════════
                    During unroll: starts overlapping the body, slides UP to its
                    natural position using translateY animation               */}
                <div
                    className="relative z-20 w-[395px] right-5"
                    style={{
                        transform: unrolling ? 'translateY(50%)' : 'translateY(0)',
                        transition: unrolling ? 'none' : 'transform 0.75s cubic-bezier(0.34,1.56,0.64,1)',
                    }}
                >
                    <ScrollRoll />
                </div>

                {/* ═══ MAIN SCROLL BODY ════════════════════════════
                    During unroll: scaleY(0) → scaleY(1), origin = top center */}
                <div
                    className="relative -mt-2 -mb-2 z-10 overflow-hidden"
                    style={{
                        background: 'linear-gradient(160deg, #FFF8E7 0%, #F5E6C0 20%, #EDD89A 50%, #F2E8B0 80%, #FFF8E7 100%)',
                        boxShadow: '0 0 40px rgba(180,100,0,0.4), inset 0 0 30px rgba(180,130,50,0.1)',
                        borderLeft: '3px solid rgba(139,90,0,0.3)',
                        borderRight: '3px solid rgba(139,90,0,0.3)',
                        transformOrigin: 'top center',
                        transform: unrolling ? 'scaleY(0)' : 'scaleY(1)',
                        transition: unrolling
                            ? 'none'
                            : 'transform 0.75s cubic-bezier(0.34,1.2,0.64,1)',
                    }}
                >
                    {/* Aged texture */}
                    <div className="absolute inset-0 pointer-events-none" style={{
                        backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='4' height='4'%3E%3Crect width='4' height='4' fill='%23f5e6c0'/%3E%3Ccircle cx='1' cy='1' r='0.5' fill='%23c8a84b' opacity='0.15'/%3E%3C/svg%3E")`,
                        backgroundSize: '4px 4px',
                    }} />

                    <BorderPattern side="left" />
                    <BorderPattern side="right" />

                    {/* Top ornament */}
                    <div className="mx-4 mt-3 flex items-center gap-1">
                        <div className="flex-1 h-px" style={{ background: 'linear-gradient(to right, transparent, #8B1A1A, transparent)' }} />
                        <svg width="12" height="12" viewBox="0 0 12 12"><polygon points="6,0 12,6 6,12 0,6" fill="#8B1A1A" opacity="0.8" /></svg>
                        <div className="flex-1 h-px" style={{ background: 'linear-gradient(to right, transparent, #8B1A1A, transparent)' }} />
                    </div>

                    {/* Content */}
                    <div className="px-6 py-3 relative">
                        {/* Logo + sub-brand */}
                        <div className="flex flex-col items-center mb-3 gap-1">
                            <Image src="/bduck.png" alt="B.Duck" width={48} height={48}
                                style={{ filter: 'drop-shadow(0 2px 4px rgba(139,26,26,0.4))' }}
                            />
                            <p className="text-[9px] font-black uppercase tracking-[0.3em] px-3 py-0.5 rounded-full border"
                                style={{ color: '#8B1A1A', borderColor: 'rgba(139,26,26,0.4)', background: 'rgba(255,255,255,0.5)' }}>
                                B.Duck Cityfuns Vietnam
                            </p>
                        </div>

                        <div className="text-center mb-3">
                            <h1 className="text-xl font-black tracking-widest" style={{
                                color: '#8B1A1A',
                                textShadow: '0 1px 2px rgba(139,26,26,0.25)',
                                fontFamily: 'Georgia, serif',
                            }}>
                                KIM BẢNG ĐỀ DANH
                            </h1>
                            <p className="text-[10px] mt-0.5 font-bold" style={{ color: '#6B3A1F', letterSpacing: '0.15em' }}>
                                TUYÊN DƯƠNG CÔNG TRẠNG
                            </p>
                        </div>

                        {/* Divider */}
                        <div className="flex items-center gap-2 mb-3">
                            <div className="flex-1" style={{ borderTop: '1.5px solid rgba(139,26,26,0.5)', borderBottom: '0.5px solid rgba(139,26,26,0.3)', paddingTop: 2 }} />
                            <span style={{ color: '#8B1A1A', fontSize: 14 }}>❧</span>
                            <div className="flex-1" style={{ borderTop: '1.5px solid rgba(139,26,26,0.5)', borderBottom: '0.5px solid rgba(139,26,26,0.3)', paddingTop: 2 }} />
                        </div>

                        {/* Intro text */}
                        <p className="text-center text-[10px] leading-relaxed mb-3 font-medium" style={{ color: '#5C3317' }}>
                            Phụng thiên thừa vận, B.Duck chiếu viết:<br />
                            Xét thấy tháng <span className="font-black" style={{ color: '#8B1A1A' }}>{monthName}</span> bá tánh nô nức vui chơi. Nay lập bảng vàng này để phong thưởng cho các vị đại thần có công lớn chiêu mộ anh hào:
                        </p>

                        {/* Leaderboard */}
                        <div className="flex flex-col gap-2">
                            {employees.map((emp, i) => (
                                <div key={emp.uid} className="flex items-center gap-2.5 rounded-xl px-3 py-2.5 relative overflow-hidden" style={{
                                    background: i === 0 ? 'linear-gradient(135deg, rgba(201,37,45,0.08), rgba(212,175,55,0.18))' : 'rgba(180,140,60,0.07)',
                                    border: i === 0 ? '1px solid rgba(180,30,30,0.35)' : '1px solid rgba(139,90,0,0.2)',
                                }}>
                                    {i === 0 && <div className="absolute inset-0 pointer-events-none" style={{ background: 'radial-gradient(ellipse at left, rgba(212,175,55,0.1) 0%, transparent 70%)' }} />}
                                    <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0 text-base"
                                        style={{ background: `${RANK_COLOR[i]}15`, border: `1px solid ${RANK_COLOR[i]}40`, fontSize: 20 }}>
                                        {RANK_EMOJI[i]}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <p className="font-black text-sm truncate leading-tight" style={{ color: i === 0 ? '#8B1A1A' : '#3D1F0A' }}>{emp.name}</p>
                                        <p className="text-[9px] font-semibold uppercase tracking-wider" style={{ color: RANK_COLOR[i], opacity: 0.8 }}>{RANK_LABEL[i]}</p>
                                    </div>
                                    <div className="text-right shrink-0">
                                        <p className="font-black tabular-nums" style={{ color: i === 0 ? '#8B1A1A' : '#5C3317', fontSize: i === 0 ? 16 : 13 }}>
                                            {emp.points.toLocaleString('vi-VN')}
                                        </p>
                                        <p className="text-[8px] font-bold uppercase tracking-wider" style={{ color: '#8B6914' }}>
                                            công trạng
                                        </p>
                                    </div>
                                </div>
                            ))}
                        </div>

                        {/* Imperial seal */}
                        <div className="flex justify-center mt-4 mb-1">
                            <div className="relative w-16 h-16 flex items-center justify-center">
                                <div className="absolute inset-0 rounded-full border-2 border-dashed" style={{ borderColor: 'rgba(180,30,30,0.5)' }} />
                                <div className="w-12 h-12 rounded-full flex flex-col items-center justify-center"
                                    style={{ background: 'rgba(180,30,30,0.12)', border: '1.5px solid rgba(180,30,30,0.45)' }}>
                                    <p className="text-[8px] font-black leading-tight tracking-widest text-center" style={{ color: '#8B1A1A' }}>玉<br />璽</p>
                                </div>
                            </div>
                        </div>
                        <p className="text-center text-[9px] leading-relaxed" style={{ color: '#8B6914', letterSpacing: '0.1em' }}>Khâm thử ! 欽此</p>
                    </div>

                    {/* Bottom ornament */}
                    <div className="mx-7 mb-3 flex items-center gap-1">
                        <div className="flex-1 h-px" style={{ background: 'linear-gradient(to right, transparent, #8B1A1A, transparent)' }} />
                        <svg width="12" height="12" viewBox="0 0 12 12"><polygon points="6,0 12,6 6,12 0,6" fill="#8B1A1A" opacity="0.8" /></svg>
                        <div className="flex-1 h-px" style={{ background: 'linear-gradient(to right, transparent, #8B1A1A, transparent)' }} />
                    </div>
                </div>

                {/* ═══ BOTTOM SCROLL ROLL — slides DOWN during unroll ═ */}
                <div
                    className="relative z-20 w-[395px] right-5"
                    style={{
                        transform: unrolling ? 'translateY(-50%)' : 'translateY(0)',
                        transition: unrolling ? 'none' : 'transform 0.75s cubic-bezier(0.34,1.56,0.64,1)',
                    }}
                >
                    <ScrollRoll />
                </div>

                {/* Close button */}
                <button onClick={handleClose}
                    className="absolute -top-3 -right-3 z-30 w-9 h-9 rounded-full flex items-center justify-center active:scale-90 transition-transform shadow-lg"
                    style={{ background: 'linear-gradient(135deg, #8B1A1A, #C9252D)', border: '2px solid rgba(255,220,100,0.6)' }}
                    aria-label="Đóng thánh chỉ">
                    <X className="w-4 h-4 text-yellow-100" />
                </button>
            </div>

            <style>{`
                @keyframes imperialFall {
                    0%   { transform: translateY(-30px) rotate(0deg); opacity: 0; }
                    5%   { opacity: 1; }
                    90%  { opacity: 0.8; }
                    100% { transform: translateY(105vh) rotate(540deg); opacity: 0; }
                }
            `}</style>
        </div>
    );
}
