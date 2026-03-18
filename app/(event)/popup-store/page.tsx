'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useSearchParams } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { QRCodeSVG } from 'qrcode.react';
import {
    PartyPopper,
    Gift,
    Frown,
    Loader2,
    Sparkles,
    ChevronRight,
    User,
    Phone,
    RotateCcw,
} from 'lucide-react';

// ─── Types ──────────────────────────────────────────────────────
type Step = 'intro' | 'form' | 'play' | 'animating' | 'result';

interface PrizeResult {
    name: string;
    code: string;
    rewardType: string;
    rewardValue: number;
}

const REWARD_LABELS: Record<string, string> = {
    discount_percent: 'Giảm giá',
    discount_fixed: 'Giảm tiền',
    free_ticket: 'Vé miễn phí',
    free_item: 'Quà tặng',
};

// ─── Framer Motion Variants ────────────────────────────────────
const pageVariants = {
    initial: { opacity: 0, y: 30, scale: 0.96 },
    animate: { opacity: 1, y: 0, scale: 1 },
    exit: { opacity: 0, y: -20, scale: 0.96 },
};

const pageTransition = {
    type: 'spring' as const,
    stiffness: 300,
    damping: 30,
};

// ─── Confetti Canvas ───────────────────────────────────────────
function ConfettiCanvas() {
    const canvasRef = useRef<HTMLCanvasElement>(null);

    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        canvas.width = canvas.offsetWidth * 2;
        canvas.height = canvas.offsetHeight * 2;
        ctx.scale(2, 2);

        const W = canvas.offsetWidth;
        const H = canvas.offsetHeight;
        const colors = ['#FFD100', '#FF7900', '#FF3B3B', '#4CAF50', '#2196F3', '#E91E63', '#FFC107'];

        interface Particle {
            x: number;
            y: number;
            w: number;
            h: number;
            color: string;
            vx: number;
            vy: number;
            rot: number;
            rotSpeed: number;
            opacity: number;
        }

        const particles: Particle[] = Array.from({ length: 80 }, () => ({
            x: Math.random() * W,
            y: Math.random() * H * -1.5,
            w: 4 + Math.random() * 6,
            h: 6 + Math.random() * 10,
            color: colors[Math.floor(Math.random() * colors.length)],
            vx: (Math.random() - 0.5) * 3,
            vy: 1.5 + Math.random() * 3,
            rot: Math.random() * 360,
            rotSpeed: (Math.random() - 0.5) * 10,
            opacity: 1,
        }));

        let animId: number;
        const draw = () => {
            ctx.clearRect(0, 0, W, H);
            let alive = false;
            for (const p of particles) {
                if (p.y > H + 20 && p.opacity <= 0) continue;
                alive = true;
                p.x += p.vx;
                p.vy += 0.04;
                p.y += p.vy;
                p.rot += p.rotSpeed;
                if (p.y > H * 0.7) p.opacity = Math.max(0, p.opacity - 0.015);

                ctx.save();
                ctx.translate(p.x, p.y);
                ctx.rotate((p.rot * Math.PI) / 180);
                ctx.globalAlpha = p.opacity;
                ctx.fillStyle = p.color;
                ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
                ctx.restore();
            }
            if (alive) animId = requestAnimationFrame(draw);
        };
        animId = requestAnimationFrame(draw);
        return () => cancelAnimationFrame(animId);
    }, []);

    return (
        <canvas
            ref={canvasRef}
            className="absolute inset-0 pointer-events-none w-full h-full"
            style={{ zIndex: 50 }}
        />
    );
}

// ─── Main Component ────────────────────────────────────────────
export default function PopupStorePage() {
    const searchParams = useSearchParams();
    const eventId = searchParams.get('eventId') || '';

    const [step, setStep] = useState<Step>('intro');
    const [name, setName] = useState('');
    const [phone, setPhone] = useState('');
    const [loading, setLoading] = useState(false);
    const [spins, setSpins] = useState(3);
    const [won, setWon] = useState(false);
    const [prize, setPrize] = useState<PrizeResult | null>(null);

    // ─── Registration ───────────────────────────────────────────
    const handleRegister = useCallback(async () => {
        if (!name.trim() || !phone.trim()) return;
        setLoading(true);
        // Simulate a brief registration delay
        await new Promise((r) => setTimeout(r, 800));
        setLoading(false);
        setStep('play');
    }, [name, phone]);

    // ─── Spin (Real API Call) ───────────────────────────────────
    const handleSpin = useCallback(() => {
        if (spins <= 0) return;
        setSpins((s) => s - 1);
        setStep('animating');
    }, [spins]);

    // Auto-transition from animating → result via API
    useEffect(() => {
        if (step !== 'animating') return;

        const timer = setTimeout(async () => {
            try {
                const res = await fetch('/api/events/play', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        eventId,
                        playerName: name.trim(),
                        playerPhone: phone.trim(),
                    }),
                });
                const data = await res.json();

                if (data.won && data.prize) {
                    setWon(true);
                    setPrize(data.prize);
                } else {
                    setWon(false);
                    setPrize(null);
                }
            } catch {
                setWon(false);
                setPrize(null);
            }
            setStep('result');
        }, 2500);

        return () => clearTimeout(timer);
    }, [step, eventId, name, phone]);

    // Prize display name
    const prizeDisplayName = prize
        ? `${REWARD_LABELS[prize.rewardType] || prize.rewardType} ${prize.rewardValue > 0 ? `• ${prize.rewardValue}` : ''}`
        : '';

    return (
        <div className="w-full max-w-md mx-auto relative">
            <AnimatePresence mode="wait">
                {/* ── STATE 1: INTRO ────────────────────────────── */}
                {step === 'intro' && (
                    <motion.div
                        key="intro"
                        variants={pageVariants}
                        initial="initial"
                        animate="animate"
                        exit="exit"
                        transition={pageTransition}
                        className="flex flex-col items-center text-center"
                    >
                        {/* Hero Icons */}
                        <div className="relative mb-6">
                            <motion.div
                                animate={{ rotate: [-8, 8, -8] }}
                                transition={{ repeat: Infinity, duration: 2, ease: 'easeInOut' }}
                            >
                                <div className="w-28 h-28 rounded-full bg-white/80 backdrop-blur-sm shadow-xl flex items-center justify-center">
                                    <PartyPopper className="w-14 h-14 text-bduck-orange" />
                                </div>
                            </motion.div>
                            <motion.div
                                className="absolute -bottom-2 -right-4"
                                animate={{ y: [0, -6, 0] }}
                                transition={{ repeat: Infinity, duration: 1.5, ease: 'easeInOut' }}
                            >
                                <div className="w-12 h-12 rounded-full bg-red-500 shadow-lg flex items-center justify-center">
                                    <Gift className="w-6 h-6 text-white" />
                                </div>
                            </motion.div>
                        </div>

                        {/* Title */}
                        <motion.div
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 0.2 }}
                        >
                            <h1 className="text-3xl font-extrabold text-bduck-dark tracking-tight leading-tight">
                                🎉 Khai Trương
                            </h1>
                            <h2 className="text-2xl font-bold text-bduck-dark mt-1">
                                B.Duck Popup Store
                            </h2>
                        </motion.div>

                        <motion.p
                            className="text-bduck-dark/70 mt-4 text-base font-medium max-w-xs"
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            transition={{ delay: 0.4 }}
                        >
                            Nhận ngay <span className="font-bold text-red-600">3 lượt</span> mở quà may mắn!
                        </motion.p>

                        {/* Decorative sparkles */}
                        <motion.div
                            className="flex gap-2 mt-3 text-bduck-orange"
                            animate={{ scale: [1, 1.15, 1] }}
                            transition={{ repeat: Infinity, duration: 2 }}
                        >
                            <Sparkles className="w-5 h-5" />
                            <Sparkles className="w-5 h-5" />
                            <Sparkles className="w-5 h-5" />
                        </motion.div>

                        {/* CTA Button */}
                        <motion.button
                            onClick={() => setStep('form')}
                            className="mt-8 w-full max-w-xs bg-red-500 hover:bg-red-600 text-white font-bold text-lg py-4 px-8 rounded-2xl shadow-lg shadow-red-500/30 active:scale-95 transition-all duration-150 flex items-center justify-center gap-2"
                            whileHover={{ scale: 1.03 }}
                            whileTap={{ scale: 0.95 }}
                        >
                            Tham Gia Ngay
                            <ChevronRight className="w-5 h-5" />
                        </motion.button>

                        <p className="text-xs text-bduck-dark/40 mt-6">
                            © 2026 B.Duck Cityfuns Vietnam
                        </p>
                    </motion.div>
                )}

                {/* ── STATE 2: REGISTRATION FORM ────────────────── */}
                {step === 'form' && (
                    <motion.div
                        key="form"
                        variants={pageVariants}
                        initial="initial"
                        animate="animate"
                        exit="exit"
                        transition={pageTransition}
                        className="w-full"
                    >
                        <div className="bg-white rounded-3xl shadow-xl p-6 sm:p-8">
                            <div className="text-center mb-6">
                                <div className="w-16 h-16 rounded-full bg-bduck-yellow/30 mx-auto flex items-center justify-center mb-3">
                                    <User className="w-8 h-8 text-bduck-orange" />
                                </div>
                                <h2 className="text-xl font-bold text-slate-800">Đăng ký nhận lượt chơi</h2>
                                <p className="text-sm text-slate-500 mt-1">Điền thông tin để bắt đầu mở quà</p>
                            </div>

                            <form
                                onSubmit={(e) => {
                                    e.preventDefault();
                                    handleRegister();
                                }}
                                className="space-y-4"
                            >
                                {/* Name */}
                                <div>
                                    <label htmlFor="name" className="block text-sm font-semibold text-slate-700 mb-1.5">
                                        Họ và tên
                                    </label>
                                    <div className="relative">
                                        <User className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4.5 h-4.5 text-slate-400" />
                                        <input
                                            id="name"
                                            type="text"
                                            placeholder="Nhập họ và tên"
                                            value={name}
                                            onChange={(e) => setName(e.target.value)}
                                            required
                                            className="w-full pl-11 pr-4 py-3.5 rounded-xl border-2 border-slate-200 bg-slate-50 text-slate-800 placeholder:text-slate-400 focus:border-bduck-orange focus:ring-2 focus:ring-bduck-orange/20 focus:bg-white outline-none transition-all text-base"
                                        />
                                    </div>
                                </div>

                                {/* Phone */}
                                <div>
                                    <label htmlFor="phone" className="block text-sm font-semibold text-slate-700 mb-1.5">
                                        Số điện thoại
                                    </label>
                                    <div className="relative">
                                        <Phone className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4.5 h-4.5 text-slate-400" />
                                        <input
                                            id="phone"
                                            type="tel"
                                            placeholder="0912 345 678"
                                            value={phone}
                                            onChange={(e) => setPhone(e.target.value)}
                                            required
                                            className="w-full pl-11 pr-4 py-3.5 rounded-xl border-2 border-slate-200 bg-slate-50 text-slate-800 placeholder:text-slate-400 focus:border-bduck-orange focus:ring-2 focus:ring-bduck-orange/20 focus:bg-white outline-none transition-all text-base"
                                        />
                                    </div>
                                </div>

                                <motion.button
                                    type="submit"
                                    disabled={loading || !name.trim() || !phone.trim()}
                                    className="w-full bg-red-500 hover:bg-red-600 disabled:bg-slate-300 disabled:cursor-not-allowed text-white font-bold text-base py-4 rounded-xl shadow-lg shadow-red-500/25 active:scale-95 transition-all duration-150 flex items-center justify-center gap-2 mt-2"
                                    whileHover={{ scale: loading ? 1 : 1.02 }}
                                    whileTap={{ scale: loading ? 1 : 0.95 }}
                                >
                                    {loading ? (
                                        <>
                                            <Loader2 className="w-5 h-5 animate-spin" />
                                            Đang xử lý...
                                        </>
                                    ) : (
                                        <>
                                            Xác nhận & Nhận lượt chơi
                                            <ChevronRight className="w-5 h-5" />
                                        </>
                                    )}
                                </motion.button>
                            </form>
                        </div>

                        <button
                            onClick={() => setStep('intro')}
                            className="mt-4 text-sm text-bduck-dark/50 hover:text-bduck-dark/80 transition-colors mx-auto block"
                        >
                            ← Quay lại
                        </button>
                    </motion.div>
                )}

                {/* ── STATE 3: GAME ROOM ────────────────────────── */}
                {step === 'play' && (
                    <motion.div
                        key="play"
                        variants={pageVariants}
                        initial="initial"
                        animate="animate"
                        exit="exit"
                        transition={pageTransition}
                        className="flex flex-col items-center text-center"
                    >
                        {/* Bouncing Gift */}
                        <motion.div
                            animate={{ y: [0, -18, 0] }}
                            transition={{ repeat: Infinity, duration: 1.2, ease: 'easeInOut' }}
                            className="mb-6"
                        >
                            <div className="w-32 h-32 rounded-3xl bg-white shadow-xl flex items-center justify-center relative overflow-hidden">
                                <div className="absolute inset-0 bg-gradient-to-br from-red-500/10 to-bduck-orange/10" />
                                <Gift className="w-16 h-16 text-red-500 relative z-10" />
                            </div>
                        </motion.div>

                        {/* Spins Counter */}
                        <div className="bg-white/80 backdrop-blur-sm rounded-2xl px-6 py-3 shadow-md mb-2">
                            <p className="text-sm text-slate-600 font-medium">Bạn đang có</p>
                            <p className="text-4xl font-black text-red-500 leading-none mt-1">{spins}</p>
                            <p className="text-sm text-slate-600 font-medium">lượt mở quà</p>
                        </div>

                        <p className="text-bduck-dark/60 text-sm mt-2 mb-6 max-w-xs">
                            Mỗi lần mở quà là một cơ hội nhận thưởng 🎁
                        </p>

                        {/* Pulsing Spin Button */}
                        <div className="relative">
                            {/* Pulsing rings */}
                            <motion.div
                                className="absolute inset-0 rounded-2xl bg-red-500/20"
                                animate={{ scale: [1, 1.15, 1], opacity: [0.5, 0, 0.5] }}
                                transition={{ repeat: Infinity, duration: 2 }}
                            />
                            <motion.div
                                className="absolute inset-0 rounded-2xl bg-red-500/15"
                                animate={{ scale: [1, 1.25, 1], opacity: [0.3, 0, 0.3] }}
                                transition={{ repeat: Infinity, duration: 2, delay: 0.3 }}
                            />

                            <motion.button
                                onClick={handleSpin}
                                disabled={spins <= 0}
                                className="relative z-10 bg-gradient-to-b from-red-500 to-red-600 hover:from-red-600 hover:to-red-700 disabled:from-slate-300 disabled:to-slate-400 text-white font-extrabold text-xl py-5 px-12 rounded-2xl shadow-xl shadow-red-500/40 active:scale-95 transition-all duration-150"
                                whileHover={{ scale: 1.05 }}
                                whileTap={{ scale: 0.92 }}
                            >
                                🎁 BẤM MỞ QUÀ NGAY!
                            </motion.button>
                        </div>

                        <p className="text-xs text-bduck-dark/40 mt-8">
                            Quà thưởng được trao ngẫu nhiên
                        </p>
                    </motion.div>
                )}

                {/* ── STATE 4: ANIMATION PLACEHOLDER ────────────── */}
                {step === 'animating' && (
                    <motion.div
                        key="animating"
                        variants={pageVariants}
                        initial="initial"
                        animate="animate"
                        exit="exit"
                        transition={pageTransition}
                        className="flex flex-col items-center justify-center text-center py-12"
                    >
                        {/* Sprite-sheet animation placeholder */}
                        <div className="w-48 h-48 rounded-3xl bg-white/60 backdrop-blur-sm shadow-inner flex items-center justify-center relative overflow-hidden">
                            {/* Spinning gift animation */}
                            <motion.div
                                animate={{ rotateY: [0, 360] }}
                                transition={{
                                    repeat: Infinity,
                                    duration: 0.8,
                                    ease: 'linear',
                                }}
                                style={{ transformStyle: 'preserve-3d' }}
                            >
                                <Gift className="w-20 h-20 text-red-500" />
                            </motion.div>

                            {/* Shimmer overlay */}
                            <motion.div
                                className="absolute inset-0 bg-gradient-to-r from-transparent via-white/40 to-transparent"
                                animate={{ x: ['-100%', '200%'] }}
                                transition={{ repeat: Infinity, duration: 1.5, ease: 'easeInOut' }}
                            />
                        </div>

                        <motion.p
                            className="text-lg font-bold text-bduck-dark mt-6"
                            animate={{ opacity: [1, 0.5, 1] }}
                            transition={{ repeat: Infinity, duration: 1.2 }}
                        >
                            Đang mở quà...
                        </motion.p>

                        <div className="flex gap-1 mt-3">
                            {[0, 1, 2].map((i) => (
                                <motion.div
                                    key={i}
                                    className="w-2.5 h-2.5 rounded-full bg-bduck-orange"
                                    animate={{ y: [0, -8, 0] }}
                                    transition={{
                                        repeat: Infinity,
                                        duration: 0.6,
                                        delay: i * 0.15,
                                    }}
                                />
                            ))}
                        </div>
                    </motion.div>
                )}

                {/* ── STATE 5: RESULT ────────────────────────────── */}
                {step === 'result' && (
                    <motion.div
                        key="result"
                        variants={pageVariants}
                        initial="initial"
                        animate="animate"
                        exit="exit"
                        transition={pageTransition}
                        className="flex flex-col items-center text-center relative"
                    >
                        {won && prize ? (
                            <>
                                {/* Confetti Layer */}
                                <ConfettiCanvas />

                                {/* Win Content */}
                                <motion.div
                                    className="relative z-10 flex flex-col items-center"
                                    initial={{ scale: 0.5 }}
                                    animate={{ scale: 1 }}
                                    transition={{ type: 'spring', stiffness: 200, damping: 15 }}
                                >
                                    <motion.div
                                        animate={{ rotate: [-5, 5, -5] }}
                                        transition={{ repeat: Infinity, duration: 1.5 }}
                                    >
                                        <div className="w-20 h-20 rounded-full bg-gradient-to-br from-yellow-300 to-bduck-orange shadow-lg flex items-center justify-center mb-4">
                                            <PartyPopper className="w-10 h-10 text-white" />
                                        </div>
                                    </motion.div>

                                    <h2 className="text-3xl font-black text-bduck-dark">
                                        🎊 CHÚC MỪNG! 🎊
                                    </h2>
                                    <p className="text-slate-600 mt-2 font-medium">Bạn đã trúng thưởng!</p>

                                    {/* Prize Card */}
                                    <div className="bg-white rounded-2xl shadow-xl p-6 mt-5 w-full max-w-xs">
                                        <p className="text-sm text-slate-500 mb-1">Phần thưởng của bạn</p>
                                        <p className="text-2xl font-black text-red-500 mb-1">{prizeDisplayName}</p>
                                        <p className="text-xs text-slate-400 mb-4">{prize.name}</p>

                                        <div className="border-2 border-dashed border-bduck-orange/30 rounded-xl p-4 bg-bduck-yellow/10">
                                            <QRCodeSVG
                                                value={prize.code}
                                                size={180}
                                                className="mx-auto"
                                                bgColor="transparent"
                                            />
                                        </div>

                                        <p className="text-[11px] font-mono text-slate-500 mt-3 tracking-wide">
                                            {prize.code}
                                        </p>
                                        <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                                            📱 Đưa mã này cho nhân viên để nhận thưởng
                                        </p>
                                    </div>
                                </motion.div>
                            </>
                        ) : (
                            /* Lose Content */
                            <motion.div
                                className="flex flex-col items-center"
                                initial={{ scale: 0.8 }}
                                animate={{ scale: 1 }}
                                transition={{ type: 'spring', stiffness: 200 }}
                            >
                                <motion.div
                                    animate={{ y: [0, -5, 0] }}
                                    transition={{ repeat: Infinity, duration: 2 }}
                                >
                                    <div className="w-20 h-20 rounded-full bg-slate-100 shadow-md flex items-center justify-center mb-4">
                                        <Frown className="w-10 h-10 text-slate-400" />
                                    </div>
                                </motion.div>

                                <h2 className="text-2xl font-bold text-slate-700">
                                    Úi, hụt mất rồi 😢
                                </h2>
                                <p className="text-slate-500 mt-2 text-base">
                                    Chúc bạn may mắn lần sau!
                                </p>
                            </motion.div>
                        )}

                        {/* Continue / Done Actions */}
                        <div className="mt-8 w-full max-w-xs relative z-10">
                            {spins > 0 ? (
                                <motion.button
                                    onClick={() => setStep('play')}
                                    className="w-full bg-bduck-orange hover:bg-bduck-orange/90 text-white font-bold text-base py-4 rounded-xl shadow-lg active:scale-95 transition-all duration-150 flex items-center justify-center gap-2"
                                    whileHover={{ scale: 1.02 }}
                                    whileTap={{ scale: 0.95 }}
                                >
                                    <RotateCcw className="w-5 h-5" />
                                    Chơi tiếp ({spins} lượt còn lại)
                                </motion.button>
                            ) : (
                                <div className="bg-white/60 backdrop-blur-sm rounded-xl p-4 text-center">
                                    <p className="text-slate-600 font-medium text-sm">
                                        Bạn đã hết lượt chơi.
                                    </p>
                                    <p className="text-slate-500 text-xs mt-1">
                                        Cảm ơn bạn đã tham gia! 🎉
                                    </p>
                                </div>
                            )}
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}

