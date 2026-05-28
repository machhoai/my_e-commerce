'use client';

import { useCallback, useEffect, useState } from 'react';
import {
    AlertCircle,
    ArrowLeft,
    Check,
    Gift,
    Loader2,
    RefreshCw,
    RotateCw,
    Save,
    Settings,
    Sparkles,
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { cn } from '@/lib/utils';
import type { GreenSMPlayDoc, GreenSMPrize, GreenSMSettingsDoc } from '@/types';

type Variant = 'desktop' | 'mobile';

type Eligibility = {
    allowed: boolean;
    contact: string;
    contactType: 'phone' | 'email';
    monthKey: string;
    monthlyLimit: number;
    usedCount: number;
    remainingPlays: number;
    message: string;
};

type SpinResult = {
    success: boolean;
    limitReached?: boolean;
    monthlyLimit?: number;
    usedCount?: number;
    remainingPlays?: number;
    prize?: GreenSMPrize | null;
    message: string;
};

const segmentColors = ['#00A66C', '#1F7A8C', '#FFD166', '#EF476F', '#6D5DFB', '#F97316', '#14B8A6', '#A3E635'];

/**
 * Maps each physical segment on wheel.png to a prize name.
 * Order: clockwise from the 12-o'clock position.
 * The system matches each name (case-insensitive, trimmed) against the
 * configured prizes to determine which segment to land on.
 *
 * ⚠️  If you change wheel.png, update this array to match the new layout.
 */
const WHEEL_SEGMENT_ORDER: string[] = [
    'Giảm giá 20% cho vé lẻ',
    'Giảm giá 10% cho vé lẻ',
    'Free 1 lượt game',
    'Free 1 lượt boothgame',
    'Free 1 lượt gắp thú',
    'Mua 1 tặng 1 vé lẻ',
];

const SEGMENT_COUNT = WHEEL_SEGMENT_ORDER.length;
const SEGMENT_ANGLE = 360 / SEGMENT_COUNT; // 60° per segment

function prizeImage(src?: string, className?: string) {
    if (src) {
        return <img src={src} alt="" className={cn('object-cover', className)} />;
    }
    return (
        <div className={cn('grid place-items-center bg-emerald-50 text-emerald-600', className)}>
            <Gift className="h-8 w-8" />
        </div>
    );
}

/** Find the segment index on wheel.png that best matches a prize name */
function findWheelSegmentIndex(prizeName: string): number {
    const normalise = (s: string) => s.trim().toLowerCase();
    const target = normalise(prizeName);
    const idx = WHEEL_SEGMENT_ORDER.findIndex(label => normalise(label) === target);
    return idx >= 0 ? idx : 0; // fallback to first segment
}

/**
 * Ensures the draft prizes array has exactly SEGMENT_COUNT entries,
 * one per wheel segment, in the correct order.
 * Merges existing prize data (rate, quantity, etc.) by matching names.
 */
function ensureDraftMatchesWheel(existingPrizes: GreenSMPrize[]): GreenSMPrize[] {
    const normalise = (s: string) => s.trim().toLowerCase();
    const byName = new Map(existingPrizes.map(p => [normalise(p.name), p]));

    return WHEEL_SEGMENT_ORDER.map((segmentName, idx) => {
        const existing = byName.get(normalise(segmentName));
        if (existing) {
            // Keep existing data but ensure name matches segment exactly
            return { ...existing, name: segmentName };
        }
        // Create a new default prize for this segment
        return {
            id: `segment-${idx}`,
            name: segmentName,
            imageUrl: '',
            rate: 0,
            quantity: 0,
            remaining: 0,
            isActive: true,
        };
    });
}

export default function GreenSMPromotion({ variant = 'desktop' }: { variant?: Variant }) {
    const { userDoc, hasPermission, getToken, loading: authLoading } = useAuth();
    const [settings, setSettings] = useState<GreenSMSettingsDoc | null>(null);
    const [draft, setDraft] = useState<GreenSMSettingsDoc | null>(null);
    const [recentPlays, setRecentPlays] = useState<GreenSMPlayDoc[]>([]);
    const [contact, setContact] = useState('');
    const [eligibility, setEligibility] = useState<Eligibility | null>(null);
    const [spinResult, setSpinResult] = useState<SpinResult | null>(null);
    const [loading, setLoading] = useState(true);
    const [checking, setChecking] = useState(false);
    const [spinning, setSpinning] = useState(false);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');
    const [rotation, setRotation] = useState(0);
    const [settingsOpen, setSettingsOpen] = useState(variant === 'desktop');
    const [flowStep, setFlowStep] = useState<'entry' | 'wheel'>('entry');

    const isMobile = variant === 'mobile';
    const canAccess = Boolean(userDoc && hasPermission('page.greensm.promotion'));
    const canConfigure = Boolean(userDoc && hasPermission('action.greensm.settings'));

    const loadData = useCallback(async () => {
        if (!userDoc) return;
        setLoading(true);
        setError('');
        try {
            const token = await getToken();
            const res = await fetch('/api/greensm', { headers: { Authorization: `Bearer ${token}` } });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || 'Không tải được GreenSM.');
            setSettings(data.settings);
            setDraft(data.settings ? {
                ...data.settings,
                prizes: ensureDraftMatchesWheel(data.settings.prizes || []),
            } : data.settings);
            setRecentPlays(data.recentPlays || []);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Không tải được GreenSM.');
        } finally {
            setLoading(false);
        }
    }, [getToken, userDoc]);

    useEffect(() => {
        if (!authLoading && userDoc) void loadData();
    }, [authLoading, userDoc, loadData]);

    const postGreenSM = async <T,>(body: Record<string, unknown>): Promise<T> => {
        const token = await getToken();
        const res = await fetch('/api/greensm', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
            body: JSON.stringify(body),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Yêu cầu thất bại.');
        return data as T;
    };

    const checkEligibility = async () => {
        setChecking(true);
        setError('');
        setSpinResult(null);
        try {
            const result = await postGreenSM<Eligibility>({ action: 'check', contact });
            setEligibility(result);
            setContact(result.contact);
            setFlowStep(result.allowed ? 'wheel' : 'entry');
        } catch (err) {
            setEligibility(null);
            setFlowStep('entry');
            setError(err instanceof Error ? err.message : 'Không kiểm tra được lượt chơi.');
        } finally {
            setChecking(false);
        }
    };

    const spinWheel = async () => {
        if (!eligibility?.allowed || spinning) return;
        setSpinning(true);
        setError('');
        setSpinResult(null);
        try {
            const result = await postGreenSM<SpinResult>({ action: 'spin', contact: eligibility.contact });

            // Find which physical segment on wheel.png to land on
            const segmentIndex = result.prize
                ? findWheelSegmentIndex(result.prize.name)
                : 0;

            // ── Rotation math ──────────────────────────────────────────
            // wheel.png has segment 0 ("Giảm giá 20%") CENTERED at 12-o'clock (0°).
            // Segment N center = N * 60°.  Boundaries are at 30°, 90°, 150°…
            // To place segment N's center under the arrow (at 0°/top),
            // the wheel must stop at absolute angle = -(N * 60°) = (360 - N*60) mod 360.
            const jitter = Math.random() * (SEGMENT_ANGLE * 0.4) - (SEGMENT_ANGLE * 0.2); // ±12°
            const desiredStop = ((360 - segmentIndex * SEGMENT_ANGLE + jitter) % 360 + 360) % 360;

            // Current effective angle (mod 360)
            const currentMod = ((rotation % 360) + 360) % 360;
            // Delta to reach desiredStop from currentMod (always positive / clockwise)
            const delta = ((desiredStop - currentMod) % 360 + 360) % 360;
            // 7 full dramatic spins + precise delta
            setRotation(prev => prev + 360 * 7 + delta);

            // Spin animation = 3.4s via CSS transition
            // Result popup appears 1s after wheel fully stops = 4.5s total
            window.setTimeout(() => {
                setSpinResult(result);
                setEligibility(prev => prev ? {
                    ...prev,
                    allowed: (result.remainingPlays || 0) > 0,
                    usedCount: result.usedCount || prev.usedCount,
                    remainingPlays: result.remainingPlays ?? prev.remainingPlays,
                    message: result.message,
                } : prev);
                setSpinning(false);
                void loadData();
            }, 4500);
        } catch (err) {
            setSpinning(false);
            setError(err instanceof Error ? err.message : 'Không quay được vòng quay.');
        }
    };

    const saveSettings = async () => {
        if (!draft) return;
        setSaving(true);
        setError('');
        try {
            const token = await getToken();
            const res = await fetch('/api/greensm', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
                body: JSON.stringify(draft),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || 'Không lưu được cài đặt.');
            setSettings(data.settings);
            setDraft(data.settings ? {
                ...data.settings,
                prizes: ensureDraftMatchesWheel(data.settings.prizes || []),
            } : data.settings);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Không lưu được cài đặt.');
        } finally {
            setSaving(false);
        }
    };

    const updatePrize = (id: string, patch: Partial<GreenSMPrize>) => {
        setDraft(prev => prev ? {
            ...prev,
            prizes: prev.prizes.map(prize => prize.id === id ? { ...prize, ...patch } : prize),
        } : prev);
    };

    const resetParticipant = () => {
        setFlowStep('entry');
        setContact('');
        setEligibility(null);
        setSpinResult(null);
        setError('');
    };

    if (authLoading || loading) {
        return (
            <div className="grid min-h-[60vh] place-items-center">
                <Loader2 className="h-8 w-8 animate-spin text-emerald-600" />
            </div>
        );
    }

    if (!canAccess) {
        return (
            <div className="rounded-lg border border-red-100 bg-red-50 p-6 text-center text-sm font-medium text-red-700">
                Bạn không có quyền truy cập chương trình GreenSM.
            </div>
        );
    }

    const totalRate = (draft?.prizes || []).filter(p => p.isActive).reduce((sum, prize) => sum + Number(prize.rate || 0), 0);

    return (
        <div className={cn(
            'min-h-full',
            isMobile ? 'bg-[#f5f7f7]' : 'rounded-2xl bg-gradient-to-br from-emerald-950 via-teal-900 to-slate-900 p-5 text-white'
        )}>
            <div className={cn('mx-auto grid max-w-7xl gap-4', isMobile ? 'px-0' : 'lg:grid-cols-[1fr_420px]')}>
                <section className={cn(
                    'overflow-hidden',
                    isMobile ? 'min-h-[calc(100vh-72px)] bg-[#f5f7f7]' : 'rounded-2xl border border-white/10 bg-white/10 p-5 shadow-2xl backdrop-blur'
                )}>
                    <div className={cn('relative grid gap-5', isMobile ? 'p-4' : '')}>
                        <div className={cn(
                            'absolute inset-0 opacity-20',
                            isMobile ? 'bg-[radial-gradient(circle_at_20%_20%,#10b981,transparent_28%),radial-gradient(circle_at_80%_10%,#facc15,transparent_24%)]' : ''
                        )} />

                        <div className="relative z-10">
                            <div className={cn('flex items-center justify-between gap-3', isMobile ? 'mb-4' : 'mb-5')}>
                                <div>
                                    <p className={cn('text-xs font-bold uppercase tracking-[0.24em]', isMobile ? 'text-emerald-700' : 'text-emerald-200')}>
                                        GreenSM
                                    </p>
                                    <h1 className={cn('mt-1 font-black tracking-normal', isMobile ? 'text-2xl text-gray-950' : 'text-4xl text-white')}>
                                        {flowStep === 'entry' ? 'Kiểm tra lượt chơi' : 'Vòng quay khuyến mãi'}
                                    </h1>
                                </div>
                                {canConfigure && isMobile && (
                                    <button
                                        onClick={() => setSettingsOpen(prev => !prev)}
                                        className="grid h-10 w-10 place-items-center rounded-2xl bg-white text-gray-700 shadow-sm active:scale-95"
                                        aria-label="Cài đặt"
                                    >
                                        <Settings className="h-5 w-5" />
                                    </button>
                                )}
                            </div>

                            {flowStep === 'entry' ? (
                                <div className={cn(
                                    'mx-auto max-w-xl space-y-4',
                                    isMobile ? 'rounded-[28px] bg-white p-4 shadow-sm' : 'rounded-2xl bg-black/20 p-6'
                                )}>
                                    <div className="space-y-1">
                                        <label className={cn('text-sm font-semibold', isMobile ? 'text-gray-700' : 'text-white')}>
                                            Email hoặc số điện thoại khách hàng
                                        </label>
                                        <p className={cn('text-xs', isMobile ? 'text-gray-500' : 'text-white/60')}>
                                            Hệ thống sẽ kiểm tra số lượt đã chơi trong tháng trước khi mở màn hình quay.
                                        </p>
                                    </div>
                                    <div className={cn('flex gap-2', isMobile && 'flex-col')}>
                                        <input
                                            value={contact}
                                            onChange={(event) => {
                                                setContact(event.target.value);
                                                setEligibility(null);
                                                setSpinResult(null);
                                            }}
                                            placeholder="0901234567 hoặc khach@email.com"
                                            className={cn(
                                                'min-h-12 flex-1 rounded-xl border px-3 text-sm outline-none transition',
                                                isMobile
                                                    ? 'border-gray-200 bg-gray-50 text-gray-900 focus:border-emerald-500'
                                                    : 'border-white/10 bg-white/10 text-white placeholder:text-white/50 focus:border-emerald-300'
                                            )}
                                        />
                                        <button
                                            onClick={checkEligibility}
                                            disabled={checking || spinning}
                                            className={cn(
                                                'inline-flex min-h-12 items-center justify-center gap-2 rounded-xl px-5 text-sm font-bold transition active:scale-[0.98] disabled:opacity-60',
                                                isMobile ? 'bg-emerald-600 text-white' : 'bg-emerald-300 text-emerald-950'
                                            )}
                                        >
                                            {checking ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                                            Kiểm tra
                                        </button>
                                    </div>

                                    {eligibility && !eligibility.allowed && (
                                        <div className={cn(
                                            'rounded-xl border p-3 text-sm',
                                            isMobile ? 'border-amber-100 bg-amber-50 text-amber-800' : 'border-amber-300/30 bg-amber-300/10 text-amber-50'
                                        )}>
                                            <p className="font-semibold">{eligibility.message}</p>
                                            <p className="mt-1 opacity-80">
                                                Đã chơi {eligibility.usedCount}/{eligibility.monthlyLimit} lượt trong tháng {eligibility.monthKey}.
                                            </p>
                                        </div>
                                    )}

                                    {error && (
                                        <div className="flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                                            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                                            {error}
                                        </div>
                                    )}
                                </div>
                            ) : (
                                <div className="relative z-10 flex max-w-full flex-col items-center justify-center">
                                    <div className={cn(
                                        'mb-4 flex w-full items-center justify-between gap-3 rounded-2xl border p-3',
                                        isMobile ? 'border-gray-100 bg-white shadow-sm' : 'border-white/10 bg-white/10'
                                    )}>
                                        <div className="min-w-0">
                                            <p className={cn('text-xs font-semibold uppercase tracking-wide', isMobile ? 'text-gray-500' : 'text-white/60')}>
                                                Khách đang chơi
                                            </p>
                                            <p className={cn('truncate text-base font-black max-w-[200px]', isMobile ? 'text-gray-950' : 'text-white')}>
                                                {eligibility?.contact}
                                            </p>
                                            <p className={cn('mt-0.5 text-xs', isMobile ? 'text-emerald-700' : 'text-emerald-100')}>
                                                Còn {eligibility?.remainingPlays ?? 0}/{eligibility?.monthlyLimit ?? 0} lượt trong tháng {eligibility?.monthKey}
                                            </p>
                                        </div>
                                        <button
                                            onClick={resetParticipant}
                                            disabled={spinning}
                                            className={cn(
                                                'inline-flex h-10 shrink-0 items-center justify-center gap-2 rounded-xl px-3 text-sm font-bold disabled:opacity-50',
                                                isMobile ? 'bg-gray-100 text-gray-700' : 'bg-white/10 text-white'
                                            )}
                                        >
                                            <ArrowLeft className="h-4 w-4" />
                                            Đổi khách
                                        </button>
                                    </div>

                                    <div className={cn('relative aspect-square w-full max-w-[420px]', isMobile ? 'max-w-[340px]' : '')}>
                                        {/* Arrow frame — STATIC (ring + orange pointer at top) */}
                                        <img
                                            src="/greensm/arrow.png"
                                            alt="Wheel pointer"
                                            className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-10 z-20 size-20 object-contain pointer-events-none"
                                        />

                                        {/* Wheel — SPINS inside the arrow ring */}
                                        <div
                                            className="absolute inset-[7%] will-change-transform"
                                            style={{
                                                transform: `rotate(${rotation}deg)`,
                                                transition: spinning
                                                    ? 'transform 3.4s cubic-bezier(0.17, 0.67, 0.12, 0.99)'
                                                    : 'none',
                                            }}
                                        >
                                            <img
                                                src="/greensm/wheel.png"
                                                alt="GreenSM lucky wheel"
                                                className="h-full w-full object-contain"
                                                draggable={false}
                                            />
                                        </div>
                                    </div>

                                    <button
                                        onClick={spinWheel}
                                        disabled={!eligibility?.allowed || spinning}
                                        className={cn(
                                            'mt-5 inline-flex h-14 min-w-48 items-center justify-center gap-2 rounded-full px-7 text-base font-black shadow-lg transition active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50',
                                            isMobile ? 'bg-gray-950 text-white shadow-gray-950/20' : 'bg-white text-emerald-900'
                                        )}
                                    >
                                        {spinning ? <Loader2 className="h-5 w-5 animate-spin" /> : <RotateCw className="h-5 w-5" />}
                                        {eligibility?.allowed ? 'Quay ngay' : 'Đã hết lượt'}
                                    </button>
                                    {!eligibility?.allowed && (
                                        <p className={cn('mt-3 text-sm font-medium', isMobile ? 'text-amber-700' : 'text-amber-100')}>
                                            Khách hàng đã dùng hết lượt trong tháng này.
                                        </p>
                                    )}
                                </div>
                            )}
                        </div>
                    </div>
                </section>

                {canConfigure && (
                    <aside className={cn(
                        isMobile
                            ? cn('px-4 pb-6', settingsOpen ? 'block' : 'hidden')
                            : 'rounded-2xl border border-white/10 bg-white p-4 text-gray-900 shadow-xl'
                    )}>
                        <div className={cn(isMobile && 'rounded-[28px] bg-white p-4 shadow-sm')}>
                            <div className="mb-4 flex items-center justify-between gap-3">
                                <div>
                                    <h2 className="text-lg font-black text-gray-950">Cài đặt GreenSM</h2>
                                    <p className="text-xs text-gray-500">Giới hạn lượt, tỷ lệ trúng và cơ cấu quà.</p>
                                </div>
                                <button
                                    onClick={loadData}
                                    className="grid h-9 w-9 place-items-center rounded-xl bg-gray-100 text-gray-600"
                                    aria-label="Tải lại"
                                >
                                    <RefreshCw className="h-4 w-4" />
                                </button>
                            </div>

                            {draft && (
                                <div className="space-y-4">
                                    <div>
                                        <label className="text-xs font-bold uppercase tracking-wide text-gray-500">Lượt chơi mỗi tháng</label>
                                        <input
                                            type="number"
                                            min={1}
                                            max={50}
                                            value={draft.monthlyLimit}
                                            onChange={(event) => setDraft(prev => prev ? { ...prev, monthlyLimit: Number(event.target.value) } : prev)}
                                            className="mt-1 h-11 w-full rounded-xl border border-gray-200 px-3 text-sm outline-none focus:border-emerald-500"
                                        />
                                    </div>

                                    <div className="rounded-xl bg-gray-50 p-3 text-sm">
                                        <div className="flex items-center justify-between">
                                            <span className="font-semibold text-gray-700">Tổng tỷ lệ đang bật</span>
                                            <span className={cn('font-black', totalRate > 100 ? 'text-red-600' : 'text-emerald-600')}>{totalRate}%</span>
                                        </div>
                                        <p className="mt-1 text-xs text-gray-500">Nếu tổng nhỏ hơn 100%, phần còn lại là &quot;May mắn lần sau&quot;.</p>
                                    </div>

                                    <div className="space-y-3">
                                        {draft.prizes.map((prize, idx) => (
                                            <div key={prize.id} className="rounded-xl border border-gray-100 bg-white p-3 shadow-sm">
                                                <div className="mb-2 flex items-center gap-2">
                                                    <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-emerald-100 text-[10px] font-black text-emerald-700">
                                                        {idx + 1}
                                                    </span>
                                                    <span className="text-sm font-bold text-gray-800 truncate">{WHEEL_SEGMENT_ORDER[idx]}</span>
                                                </div>
                                                <div className="flex items-start gap-3">
                                                    {prizeImage(prize.imageUrl, 'h-14 w-14 shrink-0 rounded-xl')}
                                                    <div className="min-w-0 flex-1 space-y-2">
                                                        <input
                                                            value={prize.imageUrl || ''}
                                                            onChange={(event) => updatePrize(prize.id, { imageUrl: event.target.value })}
                                                            placeholder="URL hình quà"
                                                            className="h-9 w-full rounded-lg border border-gray-200 px-2 text-xs outline-none focus:border-emerald-500"
                                                        />
                                                    </div>
                                                </div>
                                                <div className="mt-3 grid grid-cols-3 gap-2">
                                                    <label className="text-xs text-gray-500">
                                                        Tỷ lệ %
                                                        <input
                                                            type="number"
                                                            min={0}
                                                            max={100}
                                                            value={prize.rate}
                                                            onChange={(event) => updatePrize(prize.id, { rate: Number(event.target.value) })}
                                                            className="mt-1 h-9 w-full rounded-lg border border-gray-200 px-2 text-sm text-gray-900"
                                                        />
                                                    </label>
                                                    <label className="text-xs text-gray-500">
                                                        Số lượng
                                                        <input
                                                            type="number"
                                                            min={0}
                                                            value={prize.quantity}
                                                            onChange={(event) => {
                                                                const quantity = Number(event.target.value);
                                                                updatePrize(prize.id, { quantity, remaining: Math.min(quantity, prize.remaining) });
                                                            }}
                                                            className="mt-1 h-9 w-full rounded-lg border border-gray-200 px-2 text-sm text-gray-900"
                                                        />
                                                    </label>
                                                    <label className="text-xs text-gray-500">
                                                        Còn lại
                                                        <input
                                                            type="number"
                                                            min={0}
                                                            value={prize.remaining}
                                                            onChange={(event) => updatePrize(prize.id, { remaining: Number(event.target.value) })}
                                                            className="mt-1 h-9 w-full rounded-lg border border-gray-200 px-2 text-sm text-gray-900"
                                                        />
                                                    </label>
                                                </div>
                                                <label className="mt-3 flex items-center gap-2 text-sm font-medium text-gray-700">
                                                    <input
                                                        type="checkbox"
                                                        checked={prize.isActive}
                                                        onChange={(event) => updatePrize(prize.id, { isActive: event.target.checked })}
                                                        className="h-4 w-4 accent-emerald-600"
                                                    />
                                                    Đang bật trong vòng quay
                                                </label>
                                            </div>
                                        ))}
                                    </div>

                                    <div>
                                        <button
                                            onClick={saveSettings}
                                            disabled={saving}
                                            className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 text-sm font-bold text-white disabled:opacity-60"
                                        >
                                            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                                            Lưu cài đặt
                                        </button>
                                    </div>
                                </div>
                            )}
                        </div>
                    </aside>
                )}
            </div>

            {!isMobile && (
                <section className="mx-auto mt-4 max-w-7xl rounded-2xl border border-white/10 bg-white p-4 text-gray-900 shadow-xl">
                    <h2 className="mb-3 text-lg font-black">Lượt chơi gần đây</h2>
                    <div className="overflow-x-auto">
                        <table className="w-full text-left text-sm">
                            <thead className="text-xs uppercase text-gray-500">
                                <tr>
                                    <th className="py-2">Khách</th>
                                    <th className="py-2">Kết quả</th>
                                    <th className="py-2">Nhân viên</th>
                                    <th className="py-2">Thời gian</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100">
                                {recentPlays.map(play => (
                                    <tr key={play.id}>
                                        <td className="py-2 font-medium">{play.contact}</td>
                                        <td className="py-2">{play.won ? play.prizeName : 'May mắn lần sau'}</td>
                                        <td className="py-2 text-gray-500">{play.staffName || play.staffUid}</td>
                                        <td className="py-2 text-gray-500">{new Date(play.createdAt).toLocaleString('vi-VN')}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </section>
            )}

            {spinResult && !spinning && (
                <div className="fixed inset-0 z-[120] grid place-items-center bg-black/60 p-4 backdrop-blur-sm">
                    <div className="pointer-events-none absolute inset-0 overflow-hidden">
                        {Array.from({ length: 46 }).map((_, index) => (
                            <span
                                key={index}
                                className="absolute h-3 w-2 animate-[greensm-confetti_1.8s_ease-out_forwards] rounded-sm"
                                style={{
                                    left: `${(index * 37) % 100}%`,
                                    top: `${(index * 19) % 80}%`,
                                    backgroundColor: segmentColors[index % segmentColors.length],
                                    animationDelay: `${(index % 8) * 0.06}s`,
                                    transform: `rotate(${index * 23}deg)`,
                                }}
                            />
                        ))}
                    </div>
                    <div className={cn('relative w-full max-w-sm overflow-hidden rounded-[28px] bg-white p-5 text-center shadow-2xl', isMobile && 'max-w-[340px]')}>
                        <div className="mx-auto mb-3 grid h-16 w-16 place-items-center rounded-2xl bg-emerald-50 text-emerald-600">
                            {spinResult.prize ? <Sparkles className="h-8 w-8" /> : <Gift className="h-8 w-8" />}
                        </div>
                        <p className="text-xs font-bold uppercase tracking-[0.24em] text-emerald-600">
                            {spinResult.prize ? 'Chúc mừng' : 'GreenSM'}
                        </p>
                        <h3 className="mt-1 text-2xl font-black text-gray-950">
                            {spinResult.prize?.name || 'May mắn lần sau'}
                        </h3>
                        <div className="mx-auto mt-4 h-40 w-40 overflow-hidden rounded-3xl border border-gray-100">
                            {prizeImage(spinResult.prize?.imageUrl, 'h-full w-full')}
                        </div>
                        <p className="mt-4 text-sm text-gray-600">{spinResult.message}</p>
                        <button
                            onClick={() => setSpinResult(null)}
                            className="mt-5 h-11 w-full rounded-xl bg-gray-950 text-sm font-bold text-white"
                        >
                            Đóng
                        </button>
                    </div>
                </div>
            )}

            <style jsx global>{`
                @keyframes greensm-confetti {
                    0% { opacity: 0; transform: translateY(-20px) rotate(0deg); }
                    10% { opacity: 1; }
                    100% { opacity: 0; transform: translateY(240px) rotate(420deg); }
                }
            `}</style>
        </div>
    );
}
