'use client';

import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { X, ScanLine, Keyboard, SearchX, Camera, RotateCcw, Zap, ZapOff, User, Phone, ChevronDown, Loader2, CheckCircle2, Ticket, Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils';
import { preloadScannerData, voucherSearchAction } from '@/actions/scanner';
import type { PreloadedEmployee, PreloadedProduct } from '@/actions/scanner';
import { createPendingReferral } from '@/actions/referral';
import { ticketLookupAction } from '@/actions/ticket-scan';
import { useAuth } from '@/contexts/AuthContext';
import { useStoreSettings } from '@/hooks/useStoreSettings';
import type { ScanResult } from '@/types';
import type { VoucherCode, TicketPassData, TicketOrderData } from '@/types';
import type { ProductDoc } from '@/types/inventory';
import VoucherListSelector from './VoucherListSelector';
import VoucherDetailsCard from './VoucherDetailsCard';
import VoucherResultCard from './VoucherResultCard';
import ProductInfoCard from './ProductInfoCard';
import TicketPassCard from './TicketPassCard';
import TicketOrderCard from './TicketOrderCard';
import BottomSheet from '@/components/shared/BottomSheet';
import dynamic from 'next/dynamic';

const AIQuickChat = dynamic(() => import('@/components/shared/AIQuickChat'), { ssr: false });

// ── Normalize Vietnamese for diacritics-insensitive search ───
const normalize = (s: string) =>
    s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/g, 'd').replace(/Đ/g, 'D');

type ModalView =
    | { kind: 'scanner' }
    | { kind: 'searching' }
    | { kind: 'phone'; phone: string; vouchers: VoucherCode[] }
    | { kind: 'voucher-detail'; voucher: VoucherCode & { campaignImage?: string; campaignName?: string } }
    | { kind: 'voucher-result'; success: boolean; title: string; details: { label: string; value: string }[] }
    | { kind: 'product'; product: ProductDoc }
    | { kind: 'referral'; employee: { uid: string; name: string; phone: string; storeId: string; referralPoints: number } }
    | { kind: 'ticket-pass'; pass: TicketPassData }
    | { kind: 'ticket-order'; order: TicketOrderData }
    | { kind: 'not-found'; query: string };

// ── Beep via Web Audio API ───────────────────────────────────────
function playBeep(frequency = 1200, duration = 80, volume = 0.4) {
    try {
        const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.type = 'square';
        osc.frequency.value = frequency;
        gain.gain.setValueAtTime(volume, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration / 1000);
        osc.start(ctx.currentTime);
        osc.stop(ctx.currentTime + duration / 1000 + 0.05);
        osc.onended = () => ctx.close();
    } catch { /* AudioContext not supported */ }
}

// ── Referral View ────────────────────────────────────────────────
import type { ReferralPackage } from '@/types';

const PACKAGES: { value: ReferralPackage; label: string; color: string }[] = [
    { value: 'Silver', label: '🥈 Silver', color: 'bg-gray-100 text-gray-700 border-gray-200' },
    { value: 'Gold', label: '🥇 Gold', color: 'bg-amber-50 text-amber-700 border-amber-200' },
    { value: 'Diamond', label: '💎 Diamond', color: 'bg-sky-50 text-sky-700 border-sky-200' },
];

function ReferralView({
    employee,
    cashierId,
    onDone,
    onRescan,
}: {
    employee: { uid: string; name: string; phone: string; referralPoints: number };
    cashierId: string;
    onDone: () => void;
    onRescan: () => void;
}) {
    const [customerPhone, setCustomerPhone] = useState('');
    const [pkg, setPkg] = useState<ReferralPackage>('Silver');
    const [submitting, setSubmitting] = useState(false);
    const [done, setDone] = useState(false);
    const [error, setError] = useState('');

    const phoneValid = /^(03|05|07|08|09)\d{8}$/.test(customerPhone.trim());

    const handleSubmit = async () => {
        if (!phoneValid || submitting) return;
        setSubmitting(true);
        setError('');
        try {
            const result = await createPendingReferral({
                saleEmployeeId: employee.uid,
                saleEmployeeName: employee.name,
                cashierId,
                customerPhone: customerPhone.trim(),
                expectedPackage: pkg,
            });
            if (result.success) {
                setDone(true);
            } else {
                setError(result.error || 'Lỗi không xác định');
            }
        } catch {
            setError('Lỗi kết nối. Vui lòng thử lại.');
        } finally {
            setSubmitting(false);
        }
    };

    if (done) {
        return (
            <div className="flex flex-col items-center py-12 px-6">
                <div className="w-16 h-16 rounded-full bg-emerald-100 flex items-center justify-center mb-4">
                    <CheckCircle2 className="w-8 h-8 text-emerald-600" />
                </div>
                <h3 className="text-base font-bold text-surface-800 mb-1">Tạo phiên chờ thành công!</h3>
                <p className="text-sm text-surface-500 text-center mb-1">
                    Phiên chờ sẽ hết hạn sau <span className="font-bold text-amber-600">5 phút</span>
                </p>
                <p className="text-xs text-surface-400 text-center mb-6">
                    NV: {employee.name} · KH: {customerPhone} · Gói: {pkg}
                </p>
                <div className="w-full space-y-2">
                    <button onClick={onRescan} className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-accent-500 text-white font-bold text-sm hover:bg-accent-600 transition-colors">
                        <RotateCcw className="w-4 h-4" /> Quét mã khác
                    </button>
                    <button onClick={onDone} className="w-full py-3 rounded-xl bg-surface-100 text-surface-600 font-semibold text-sm hover:bg-surface-200 transition-colors">
                        Đóng
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="p-5 space-y-4">
            {/* Employee card */}
            <div className="flex items-center gap-3.5 bg-gradient-to-r from-accent-50 to-primary-50 border border-accent-100 rounded-2xl px-4 py-3.5">
                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-accent-500 to-primary-500 flex items-center justify-center text-white text-lg font-black shrink-0 shadow-sm">
                    {employee.name.split(' ').pop()?.[0]?.toUpperCase() || 'N'}
                </div>
                <div className="flex-1 min-w-0">
                    <h3 className="text-sm font-bold text-surface-800 truncate">{employee.name}</h3>
                    <p className="text-[11px] text-surface-500 font-medium">Tích điểm giới thiệu</p>
                </div>
                <div className="text-right shrink-0">
                    <p className="text-lg font-black text-accent-600">{employee.referralPoints}</p>
                    <p className="text-[9px] text-surface-400 font-bold uppercase tracking-wider">Điểm</p>
                </div>
            </div>

            {/* Customer phone */}
            <div>
                <label className="text-xs font-bold text-surface-600 mb-1.5 block">SĐT khách hàng</label>
                <div className="relative">
                    <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-surface-400" />
                    <input
                        type="tel"
                        value={customerPhone}
                        onChange={e => setCustomerPhone(e.target.value.replace(/\D/g, '').slice(0, 10))}
                        placeholder="0912345678"
                        className="w-full pl-10 pr-4 py-3 bg-surface-50 border border-surface-200 rounded-xl text-sm font-semibold outline-none focus:ring-2 focus:ring-accent-300 focus:border-accent-400 placeholder-surface-400"
                    />
                </div>
                {customerPhone.length > 0 && !phoneValid && (
                    <p className="text-[11px] text-red-500 font-medium mt-1">Số điện thoại không hợp lệ</p>
                )}
            </div>

            {/* Package selector */}
            <div>
                <label className="text-xs font-bold text-surface-600 mb-1.5 block">Gói dịch vụ</label>
                <div className="grid grid-cols-3 gap-2">
                    {PACKAGES.map(p => (
                        <button
                            key={p.value}
                            onClick={() => setPkg(p.value)}
                            className={cn(
                                'py-2.5 rounded-xl text-xs font-bold border-2 transition-all',
                                pkg === p.value
                                    ? 'ring-2 ring-accent-400 border-accent-400 scale-[1.02] shadow-sm'
                                    : `${p.color} hover:opacity-80`,
                            )}
                        >
                            {p.label}
                        </button>
                    ))}
                </div>
            </div>

            {error && (
                <p className="text-xs font-medium text-red-500 bg-red-50 border border-red-100 rounded-xl px-3 py-2">{error}</p>
            )}

            {/* Submit */}
            <button
                onClick={handleSubmit}
                disabled={!phoneValid || submitting}
                className={cn(
                    'w-full py-3.5 rounded-xl font-bold text-sm transition-all',
                    phoneValid && !submitting
                        ? 'bg-accent-500 text-white hover:bg-accent-600 active:scale-[0.98] shadow-md shadow-accent-200'
                        : 'bg-surface-200 text-surface-400 cursor-not-allowed',
                )}
            >
                {submitting ? (
                    <span className="flex items-center justify-center gap-2">
                        <Loader2 className="w-4 h-4 animate-spin" /> Đang tạo...
                    </span>
                ) : (
                    'Tạo phiên chờ (5 Phút)'
                )}
            </button>
        </div>
    );
}

// ── Draggable FAB ────────────────────────────────────────────────
const FAB_SIZE = 64; // w-16 = 64px — bigger touch target
const FAB_MARGIN = 12; // distance from screen edge
const IDLE_TIMEOUT = 5000;
const DRAG_THRESHOLD = 12; // px moved to count as drag (not tap) — higher to avoid accidental drags on touchscreens

function DraggableFAB({ onTapScan, onTapAI, hidden, hasAI }: {
    onTapScan: () => void;
    onTapAI: () => void;
    hidden: boolean;
    hasAI: boolean;
}) {
    const btnRef = useRef<HTMLButtonElement>(null);
    const posRef = useRef({ x: 0, y: 0 });
    const dragState = useRef({ dragging: false, startX: 0, startY: 0, startPosX: 0, startPosY: 0, moved: false });
    const idleTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
    const [idle, setIdle] = useState(true);
    const [pos, setPos] = useState<{ x: number; y: number } | null>(null);
    const [snapping, setSnapping] = useState(false);
    const [expanded, setExpanded] = useState(false);

    // Initialize position to bottom-right
    useEffect(() => {
        const x = window.innerWidth - FAB_SIZE - FAB_MARGIN;
        const y = window.innerHeight - FAB_SIZE - FAB_MARGIN - 60;
        posRef.current = { x, y };
        setPos({ x, y });
    }, []);

    // Close expanded when FAB is hidden
    useEffect(() => {
        if (hidden) setExpanded(false);
    }, [hidden]);

    const resetIdleTimer = useCallback(() => {
        setIdle(false);
        if (idleTimer.current) clearTimeout(idleTimer.current);
        idleTimer.current = setTimeout(() => setIdle(true), IDLE_TIMEOUT);
    }, []);

    const snapToCorner = useCallback((cx: number, cy: number) => {
        const sw = window.innerWidth;
        const sh = window.innerHeight;
        const midX = sw / 2;
        const midY = sh / 2;

        const targetX = cx < midX ? FAB_MARGIN : sw - FAB_SIZE - FAB_MARGIN;
        const targetY = cy < midY ? FAB_MARGIN + 40 : sh - FAB_SIZE - FAB_MARGIN - 60;

        posRef.current = { x: targetX, y: targetY };
        setSnapping(true);
        setPos({ x: targetX, y: targetY });
        setTimeout(() => setSnapping(false), 300);
        resetIdleTimer();
    }, [resetIdleTimer]);

    const onPointerDown = useCallback((e: React.PointerEvent) => {
        if (expanded) return; // Don't drag when expanded
        const btn = btnRef.current;
        if (!btn) return;
        btn.setPointerCapture(e.pointerId);
        dragState.current = {
            dragging: true,
            startX: e.clientX,
            startY: e.clientY,
            startPosX: posRef.current.x,
            startPosY: posRef.current.y,
            moved: false,
        };
        resetIdleTimer();
    }, [resetIdleTimer, expanded]);

    const onPointerMove = useCallback((e: React.PointerEvent) => {
        const ds = dragState.current;
        if (!ds.dragging) return;

        const dx = e.clientX - ds.startX;
        const dy = e.clientY - ds.startY;

        if (Math.abs(dx) > DRAG_THRESHOLD || Math.abs(dy) > DRAG_THRESHOLD) {
            ds.moved = true;
        }

        const sw = window.innerWidth;
        const sh = window.innerHeight;
        const newX = Math.max(0, Math.min(sw - FAB_SIZE, ds.startPosX + dx));
        const newY = Math.max(0, Math.min(sh - FAB_SIZE, ds.startPosY + dy));

        posRef.current = { x: newX, y: newY };
        setSnapping(false);
        setPos({ x: newX, y: newY });
    }, []);

    const onPointerUp = useCallback((e: React.PointerEvent) => {
        const ds = dragState.current;
        ds.dragging = false;
        btnRef.current?.releasePointerCapture(e.pointerId);

        if (ds.moved) {
            const centerX = posRef.current.x + FAB_SIZE / 2;
            const centerY = posRef.current.y + FAB_SIZE / 2;
            snapToCorner(centerX, centerY);
        } else {
            // Tap — nếu có quyền AI thì mở menu, không thì mở scan
            if (hasAI) {
                setExpanded(prev => !prev);
            } else {
                onTapScan();
            }
        }
    }, [snapToCorner, onTapScan, hasAI]);

    const handleActionScan = useCallback(() => {
        setExpanded(false);
        onTapScan();
    }, [onTapScan]);

    const handleActionAI = useCallback(() => {
        setExpanded(false);
        onTapAI();
    }, [onTapAI]);

    if (!pos) return null;

    // Sub-button size & spacing
    const SUB_SIZE = 52;
    const SUB_GAP = 12;
    // Position sub buttons above the main FAB, centered
    const subOffsetX = (FAB_SIZE - SUB_SIZE) / 2;

    return (
        <>
            {/* ── Backdrop when expanded ── */}
            {expanded && (
                <div
                    className="fixed inset-0 z-[39] bg-black/20 backdrop-blur-[1px]"
                    onClick={() => setExpanded(false)}
                />
            )}

            {/* ── Sub-action buttons (visible when expanded) ── */}
            {expanded && (
                <>
                    {/* Scan button */}
                    <button
                        onClick={handleActionScan}
                        style={{
                            position: 'fixed',
                            left: pos.x + subOffsetX,
                            top: pos.y + 50 - (SUB_SIZE + SUB_GAP) * 2,
                            width: SUB_SIZE,
                            height: SUB_SIZE,
                            zIndex: 41,
                        }}
                        className="rounded-2xl bg-gradient-to-br from-accent-500 to-accent-600 text-white shadow-xl shadow-accent-500/30 flex flex-col items-center justify-center gap-0.5 animate-in fade-in slide-in-from-bottom-4 duration-200"
                    >
                        <ScanLine className="w-5 h-5 pointer-events-none" />
                        <span className="text-[9px] font-bold leading-none">Quét</span>
                    </button>

                    {/* AI button */}
                    <button
                        onClick={handleActionAI}
                        style={{
                            position: 'fixed',
                            left: pos.x + subOffsetX,
                            top: pos.y + 50 - (SUB_SIZE + SUB_GAP),
                            width: SUB_SIZE,
                            height: SUB_SIZE,
                            zIndex: 41,
                        }}
                        className="rounded-2xl bg-gradient-to-br from-violet-500 to-purple-600 text-white shadow-xl shadow-violet-500/30 flex flex-col items-center justify-center gap-0.5 animate-in fade-in slide-in-from-bottom-2 duration-200 delay-75"
                    >
                        <Sparkles className="w-5 h-5 pointer-events-none" />
                        <span className="text-[9px] font-bold leading-none">AI</span>
                    </button>
                </>
            )}

            {/* ── Main FAB Button ── */}
            <button
                ref={btnRef}
                onPointerDown={onPointerDown}
                onPointerMove={onPointerMove}
                onPointerUp={onPointerUp}
                style={{
                    position: 'fixed',
                    left: pos.x,
                    top: pos.y + 50,
                    width: FAB_SIZE,
                    height: FAB_SIZE,
                    zIndex: 40,
                    touchAction: 'none',
                    transition: snapping ? 'left 0.3s cubic-bezier(.4,0,.2,1), top 0.3s cubic-bezier(.4,0,.2,1), opacity 0.5s' : 'opacity 0.5s',
                    opacity: hidden ? 0 : idle && !expanded ? 0.75 : 1,
                    pointerEvents: hidden ? 'none' : 'auto',
                }}
                className={cn(
                    'rounded-2xl',
                    expanded
                        ? 'bg-surface-700 text-white shadow-xl'
                        : hasAI
                            ? 'bg-gradient-to-br from-violet-500 via-accent-500 to-accent-600 text-white shadow-xl shadow-accent-500/30'
                            : 'bg-gradient-to-br from-accent-500 to-accent-600 text-white shadow-xl shadow-accent-500/30',
                    'flex items-center justify-center',
                    'select-none',
                    'before:content-[\'\'] before:absolute before:-inset-[10px] before:rounded-3xl',
                )}
                title={expanded ? 'Đóng' : hasAI ? 'Quét mã / Hỏi AI' : 'Quét mã'}
            >
                {expanded ? (
                    <X className="w-6 h-6 pointer-events-none" />
                ) : hasAI ? (
                    /* Dual icon: scan + sparkle */
                    <div className="flex items-center gap-0.5 pointer-events-none">
                        <ScanLine className="w-5 h-5" />
                        <span className="text-white/60 text-xs font-bold">/</span>
                        <Sparkles className="w-4 h-4" />
                    </div>
                ) : (
                    <ScanLine className="w-7 h-7 pointer-events-none" />
                )}
            </button>
        </>
    );
}

export default function UniversalScannerModal() {
    const [isOpen, setIsOpen] = useState(false);
    const { user: authUser, hasPermission } = useAuth();

    // Permission gates — admin always bypasses via hasPermission()
    const canSearchVouchers = hasPermission('search_vouchers');
    const canManageReferrals = hasPermission('manage_referrals');
    const canScanTickets = hasPermission('scan_tickets');
    const canUseAI = hasPermission('action.ai.chat');
    const { referralEnabled } = useStoreSettings();
    // Effective referral gate: both permission AND store setting must be true
    const referralActive = canManageReferrals && referralEnabled;
    const [isAIChatOpen, setIsAIChatOpen] = useState(false);
    const [view, setView] = useState<ModalView>({ kind: 'scanner' });
    const [manualInput, setManualInput] = useState('');
    const [showManual, setShowManual] = useState(false);
    const [ticketMode, setTicketMode] = useState(false);
    const [torchOn, setTorchOn] = useState(false);
    const [torchSupported, setTorchSupported] = useState(false);
    const scannerRef = useRef<HTMLDivElement>(null);
    const html5QrRef = useRef<any>(null);
    const scanLock = useRef(false);
    const handleSearchRef = useRef<(input: string) => void>(() => { });
    const [showLabel, setShowLabel] = useState(false);

    // ── Preloaded data (loaded once when modal opens) ────────────
    const [preloadedEmployees, setPreloadedEmployees] = useState<PreloadedEmployee[]>([]);
    const [preloadedProducts, setPreloadedProducts] = useState<PreloadedProduct[]>([]);
    const [preloading, setPreloading] = useState(false);

    useEffect(() => {
        let isMounted = true;

        const fetchPreloadData = async () => {
            // Nếu đã tải rồi hoặc đang tải thì bỏ qua
            if (preloadedEmployees.length > 0 || preloadedProducts.length > 0 || preloading) return;

            setPreloading(true);
            try {
                const data = await preloadScannerData();
                if (isMounted) {
                    setPreloadedEmployees(data.employees);
                    setPreloadedProducts(data.products);
                }
            } catch (err) {
                console.error('[Scanner] Preload failed:', err);
            } finally {
                if (isMounted) setPreloading(false);
            }
        };

        // Đợi 1 giây sau khi render xong giao diện mới bắt đầu tải ngầm
        // Việc này giúp trang web mượt mà, không bị giật lúc mới vào
        const timer = setTimeout(fetchPreloadData, 1000);

        return () => {
            isMounted = false;
            clearTimeout(timer);
        };
    }, []); // Chạy 1 lần duy nhất khi Component mount

    // ── Start camera — QR + Code128 only, high-res, adaptive qrbox ──
    const startCamera = useCallback(async () => {
        if (!scannerRef.current) return;
        scanLock.current = false;
        try {
            const { Html5Qrcode, Html5QrcodeSupportedFormats } = await import('html5-qrcode');
            const scanner = new Html5Qrcode('scanner-container', {
                formatsToSupport: [
                    Html5QrcodeSupportedFormats.QR_CODE,
                    Html5QrcodeSupportedFormats.CODE_128,
                ],
                verbose: false,
                // Use Chrome Android's native BarcodeDetector API (hardware-accelerated).
                // It handles real-world / jagged barcodes MUCH better than ZXing.
                // Falls back to ZXing automatically on browsers that don't support it.
                experimentalFeatures: {
                    useBarCodeDetectorIfSupported: true,
                },
            });
            html5QrRef.current = scanner;

            await scanner.start(
                { facingMode: 'environment' },
                {
                    // 1. Tăng tốc độ chộp ảnh lên 30 khung hình/giây
                    fps: 30,

                    qrbox: (viewW: number, viewH: number) => ({
                        // 2. Thu hẹp vùng quét lại một chút để Camera tập trung đo sáng và lấy nét ở giữa
                        width: Math.round(viewW * 0.80),
                        height: Math.round(viewH * 0.25),
                    }),

                    // 3. Tắt lật gương để giảm tải CPU, giúp FPS duy trì ở mức cao
                    disableFlip: true,

                    videoConstraints: {
                        facingMode: { exact: 'environment' },
                        // Giữ Ideal 1080p là đủ, không nên ép lên quá cao gây lag thuật toán ZXing
                        width: { min: 640, ideal: 1920 },
                        height: { min: 480, ideal: 1080 },
                        // 4. BÍ QUYẾT: Ép ống kính lấy nét liên tục (Hoạt động cực tốt trên Safari iOS 15+ và Chrome)
                        advanced: [{ focusMode: "continuous" }] as any,
                    },
                },
                (text: string) => {
                    if (scanLock.current) return;
                    scanLock.current = true;
                    playBeep();
                    handleSearchRef.current(text);
                },
                () => { },
            );
        } catch (err) {
            console.error('Camera init error:', err);
            setShowManual(true);
        }
    }, []);

    // ── Stop camera ──────────────────────────────────────────────
    const stopCamera = useCallback(async () => {
        try {
            if (html5QrRef.current) {
                const state = html5QrRef.current.getState?.();
                if (state === 2 || state === undefined) await html5QrRef.current.stop();
                html5QrRef.current.clear?.();
                html5QrRef.current = null;
            }
        } catch {
            html5QrRef.current = null;
        }
    }, []);

    // ── Torch / Flash ─────────────────────────────────────────────
    const toggleTorch = useCallback(async () => {
        try {
            const video = document.querySelector<HTMLVideoElement>('#scanner-container video');
            const track = video?.srcObject instanceof MediaStream
                ? (video.srcObject as MediaStream).getVideoTracks()[0]
                : null;
            if (!track) return;
            const newState = !torchOn;
            await track.applyConstraints({ advanced: [{ torch: newState } as any] });
            setTorchOn(newState);
        } catch { /* torch not supported on this device */ }
    }, [torchOn]);

    // Check torch support once camera starts
    const checkTorchSupport = useCallback(() => {
        const video = document.querySelector<HTMLVideoElement>('#scanner-container video');
        const track = video?.srcObject instanceof MediaStream
            ? (video.srcObject as MediaStream).getVideoTracks()[0]
            : null;
        if (!track) return;
        const caps = track.getCapabilities?.() as any;
        setTorchSupported(!!caps?.torch);
    }, []);

    // ── Open / Close ─────────────────────────────────────────────
    const open = async () => {
        setIsOpen(true);
        setView({ kind: 'scanner' });
        setManualInput('');
        setShowManual(false);
        setTorchOn(false);
        scanLock.current = false;
    };

    const close = useCallback(async () => {
        // Turn off torch before stopping camera
        if (torchOn) {
            try {
                const video = document.querySelector<HTMLVideoElement>('#scanner-container video');
                const track = video?.srcObject instanceof MediaStream
                    ? (video.srcObject as MediaStream).getVideoTracks()[0] : null;
                if (track) await track.applyConstraints({ advanced: [{ torch: false } as any] });
            } catch { }
        }
        await stopCamera();
        setIsOpen(false);
        setView({ kind: 'scanner' });
        setManualInput('');
        setShowManual(false);
        setTorchOn(false);
        setTorchSupported(false);
    }, [stopCamera, torchOn]);

    // Start camera when scanner view is active
    useEffect(() => {
        if (isOpen && view.kind === 'scanner') {
            const timer = setTimeout(() => {
                startCamera();
                // Check torch support after camera initializes
                setTimeout(checkTorchSupport, 1200);
            }, 300);
            return () => { clearTimeout(timer); stopCamera(); };
        }
    }, [isOpen, view.kind, startCamera, stopCamera]);

    useEffect(() => {
        // Mỗi khi ticketMode thay đổi, hiện chữ lên
        setShowLabel(true);

        // Đặt hẹn giờ 1.5 giây để ẩn chữ đi
        const timer = setTimeout(() => {
            setShowLabel(false);
        }, 1500);

        // Cleanup: Cực kỳ quan trọng! Nếu user bấm liên tục 2-3 lần,
        // nó sẽ xóa timer cũ đi để không bị giật/nháy chữ.
        return () => clearTimeout(timer);
    }, [ticketMode]);

    // ── Employee suggestions (local, instant — no API call) ──────
    const empSuggestions = useMemo(() => {
        if (!referralActive || !showManual) return [];
        const q = manualInput.trim();
        if (q.length < 2 || /^(03|05|07|08|09)\d/.test(q) || /^REF-/.test(q)) return [];
        const qNorm = normalize(q);
        return preloadedEmployees
            .filter(emp => {
                const nameNorm = normalize(emp.name);
                return nameNorm.includes(qNorm) || nameNorm.split(/\s+/).some(w => w.startsWith(qNorm));
            })
            .slice(0, 5);
    }, [manualInput, showManual, preloadedEmployees, referralActive]);

    // ── Search handler ───────────────────────────────────────────
    const handleSearch = async (input: string) => {
        console.log('[Scanner] handleSearch called with:', JSON.stringify(input), '| ticketMode:', ticketMode);
        let trimmed = input.trim();

        // Extract slug if input is a Joyworld URL from printed labels
        try {
            if (trimmed.startsWith('http')) {
                const url = new URL(trimmed);
                if (url.pathname.startsWith('/p/')) {
                    trimmed = url.pathname.replace('/p/', '');
                }
            }
        } catch { /* ignore valid url check */ }

        if (!trimmed) return;
        await stopCamera();

        // 1. REF- code → find employee (permission-gated)
        if (trimmed.startsWith('REF-')) {
            if (!referralActive) {
                setView({ kind: 'not-found', query: !referralEnabled ? 'Chương trình giới thiệu hiện đang tắt' : 'Bạn không có quyền quét mã nhân viên' });
                return;
            }
            const uid = trimmed.slice(4);
            // Try preloaded cache first
            let emp = preloadedEmployees.find(e => e.uid === uid);
            // Fallback: server lookup if not in cache (e.g. isActive field missing)
            if (!emp) {
                try {
                    const { lookupEmployeeByUid } = await import('@/actions/scanner');
                    const serverEmp = await lookupEmployeeByUid(uid);
                    if (serverEmp) emp = serverEmp;
                } catch { /* ignore */ }
            }
            if (emp) {
                setView({ kind: 'referral', employee: emp });
            } else {
                setView({ kind: 'not-found', query: trimmed });
            }
            return;
        }

        // 2. Ticket mode ON → call external Ticketing API
        if (ticketMode && canScanTickets) {
            setView({ kind: 'searching' });
            try {
                const ticketResult = await ticketLookupAction(trimmed);
                if (ticketResult && ticketResult.success) {
                    if (ticketResult.type === 'pass') {
                        setView({ kind: 'ticket-pass', pass: ticketResult.pass });
                        return;
                    }
                    if (ticketResult.type === 'order') {
                        setView({ kind: 'ticket-order', order: ticketResult.order });
                        return;
                    }
                }
                // API returned not_found or null (not configured)
                setView({ kind: 'not-found', query: trimmed });
            } catch {
                setView({ kind: 'not-found', query: trimmed });
            }
            return;
        }

        // 3. Product barcode / companyCode → local lookup
        const product = preloadedProducts.find(
            p => p.barcode === trimmed || p.companyCode === trimmed
        );
        if (product) {
            setView({
                kind: 'product',
                product: product as ProductDoc,
            });
            return;
        }

        // 4. Phone or Voucher code → must hit server (permission-gated)
        if (!canSearchVouchers) {
            setView({ kind: 'not-found', query: trimmed });
            return;
        }

        setView({ kind: 'searching' });
        try {
            const result: ScanResult = await voucherSearchAction(trimmed);
            switch (result.type) {
                case 'PHONE':
                    setView({ kind: 'phone', phone: result.data.phone, vouchers: result.data.vouchers });
                    break;
                case 'VOUCHER':
                    setView({ kind: 'voucher-detail', voucher: result.data });
                    break;
                default:
                    setView({ kind: 'not-found', query: trimmed });
            }
        } catch {
            setView({ kind: 'not-found', query: trimmed });
        }
    };

    // Keep ref in sync so the camera callback (stale closure) always calls the latest handleSearch
    handleSearchRef.current = handleSearch;

    const handleManualSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (manualInput.trim()) handleSearch(manualInput.trim());
    };

    const resetToScanner = () => {
        setView({ kind: 'scanner' });
        setManualInput('');
        setShowManual(false);
        scanLock.current = false;
    };

    // ── Render view content ──────────────────────────────────────
    const renderContent = () => {
        switch (view.kind) {
            case 'scanner':
                return (
                    <div className="flex flex-col">
                        {/* Manual input */}
                        <div className="p-4 bg-white">
                            {showManual ? (
                                <div className="relative">
                                    <form onSubmit={handleManualSubmit} className="flex gap-2">
                                        <input
                                            type="text"
                                            value={manualInput}
                                            onChange={e => { setManualInput(e.target.value); }}
                                            placeholder="Nhập mã, SĐT hoặc tên nhân viên..."
                                            autoFocus
                                            className="flex-1 bg-surface-50 border border-surface-200 text-sm rounded-xl px-3.5 py-3 focus:ring-accent-500 focus:border-accent-400 placeholder-surface-400 outline-none"
                                        />
                                        <button
                                            type="submit"
                                            disabled={!manualInput.trim()}
                                            className="px-4 py-3 bg-surface-800 text-white rounded-xl font-bold text-sm disabled:opacity-50 hover:bg-surface-900 transition-colors shrink-0"
                                        >Tìm</button>
                                    </form>

                                    {/* Employee suggestions dropdown */}
                                    {empSuggestions.length > 0 && (
                                        <div className="absolute left-0 right-0 top-full mt-1 bg-white border border-surface-200 rounded-xl shadow-xl z-50 overflow-hidden">

                                            {preloading && manualInput.trim().length >= 2 ? (
                                                <div className="flex items-center gap-2 px-4 py-3 text-xs text-surface-500">
                                                    <Loader2 className="w-3.5 h-3.5 animate-spin" /> Đang đồng bộ danh sách...
                                                </div>
                                            ) : empSuggestions.map(emp => (
                                                <button
                                                    key={emp.uid}
                                                    onClick={async () => {
                                                        await stopCamera();
                                                        setManualInput('');
                                                        setView({ kind: 'referral', employee: emp });
                                                    }}
                                                    className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-accent-50 transition-colors text-left border-b border-surface-50 last:border-b-0"
                                                >
                                                    <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-accent-400 to-primary-400 flex items-center justify-center text-white text-xs font-black shrink-0">
                                                        {emp.name.split(' ').pop()?.[0]?.toUpperCase() || 'N'}
                                                    </div>
                                                    <div className="flex-1 min-w-0">
                                                        <p className="text-xs font-bold text-surface-800 truncate">{emp.name}</p>
                                                        <p className="text-[10px] text-surface-400">{emp.phone}</p>
                                                    </div>
                                                    <span className="text-[10px] font-bold text-accent-600 bg-accent-50 px-2 py-0.5 rounded-lg">{emp.referralPoints} điểm</span>
                                                </button>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            ) : (
                                <button
                                    onClick={() => setShowManual(true)}
                                    className="w-full flex items-center justify-center gap-2 py-3 rounded-xl border-2 border-dashed border-surface-200 text-surface-500 hover:border-accent-300 hover:text-accent-600 transition-colors text-sm font-medium"
                                >
                                    <Keyboard className="w-4 h-4" />
                                    Nhập thủ công
                                </button>
                            )}
                            {/* Ticket mode toggle */}
                        </div>
                        {/* Camera viewport */}
                        <div className="relative bg-black overflow-hidden" style={{ height: 500 }}>
                            {canScanTickets && (
                                <label className="flex absolute items-center gap-2 mt-2 cursor-pointer select-none z-50 left-3 top-3">
                                    <div
                                        onClick={() => setTicketMode(v => !v)}
                                        className={cn(
                                            'relative z-30 w-10 h-10 rounded-full flex items-center justify-center transition-all duration-200',
                                            ticketMode ? 'bg-violet-500' : 'bg-surface-300',
                                        )}
                                    >
                                        <Ticket className={cn('w-5 h-5', ticketMode ? 'text-white' : 'text-surface-600')} />
                                    </div>

                                    {/* Container tạo hiệu ứng trượt */}
                                    <div
                                        className={cn(
                                            'overflow-hidden transition-all duration-500 ease-in-out flex items-center',
                                            showLabel
                                                ? 'max-w-[200px] opacity-100 translate-x-0'
                                                : 'max-w-0 opacity-0 -translate-x-4'
                                        )}
                                    >
                                        <span className={cn(
                                            'text-xs font-semibold whitespace-nowrap',
                                            ticketMode ? 'text-violet-300' : 'text-surface-500'
                                        )}>
                                            Chế độ Vé: {ticketMode ? 'Bật' : 'Tắt'}
                                        </span>
                                    </div>
                                </label>
                            )}
                            <div id="scanner-container" ref={scannerRef} className="relative bottom-28 w-full h-full" />

                            {/*
                              Hide html5-qrcode's built-in #qr-shaded-region (the T-shaped border).
                              Our overlay below sits at z-10 and matches the actual qrbox exactly:
                              centered, 88% wide × 30% tall of the viewfinder.
                            */}

                            {/* Dark mask — same proportions as qrbox (88% × 30%) */}
                            <div className="absolute inset-0 pointer-events-none z-10">
                                {/* top dark band */}
                                <div className="absolute top-0 left-0 right-0 bg-black/50" style={{ height: '35%' }} />
                                {/* bottom dark band */}
                                <div className="absolute bottom-0 left-0 right-0 bg-black/50" style={{ height: '35%' }} />
                                {/* left side band */}
                                <div className="absolute bg-black/50" style={{ top: '35%', bottom: '35%', left: 0, width: '6%' }} />
                                {/* right side band */}
                                <div className="absolute bg-black/50" style={{ top: '35%', bottom: '35%', right: 0, width: '6%' }} />
                            </div>

                            {/* Corner marks — centered vertically at 35%–65%, 6%–94% horizontally */}
                            <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-20">
                                <div className="relative" style={{ width: '88%', height: '30%' }}>
                                    <div className="absolute -top-px -left-px w-7 h-7 border-t-[3px] border-l-[3px] border-accent-400 rounded-tl-xl" />
                                    <div className="absolute -top-px -right-px w-7 h-7 border-t-[3px] border-r-[3px] border-accent-400 rounded-tr-xl" />
                                    <div className="absolute -bottom-px -left-px w-7 h-7 border-b-[3px] border-l-[3px] border-accent-400 rounded-bl-xl" />
                                    <div className="absolute -bottom-px -right-px w-7 h-7 border-b-[3px] border-r-[3px] border-accent-400 rounded-br-xl" />
                                    <div className="absolute left-3 right-3 h-0.5 bg-gradient-to-r from-transparent via-accent-400 to-transparent animate-scan" />
                                </div>
                            </div>

                            {/* Flash / Torch button */}
                            {torchSupported && (
                                <button
                                    onClick={toggleTorch}
                                    className={cn(
                                        'absolute top-3 right-3 z-30 w-10 h-10 rounded-full flex items-center justify-center transition-all duration-200',
                                        torchOn
                                            ? 'bg-yellow-400 text-yellow-900 shadow-lg shadow-yellow-400/40'
                                            : 'bg-black/40 text-white/80 hover:bg-black/60',
                                    )}
                                    title={torchOn ? 'Tắt đèn flash' : 'Bật đèn flash'}
                                >
                                    {torchOn ? <Zap className="w-5 h-5 fill-current" /> : <ZapOff className="w-5 h-5" />}
                                </button>
                            )}

                            {/* Hint */}
                            <div className="absolute bottom-3 left-0 right-0 text-center z-20">
                                <p className="text-[11px] text-white/80 font-medium px-4">
                                    Đặt mã vạch / QR nằm ngang trong khung · Giữ cách 10–20cm
                                </p>
                            </div>
                        </div>
                    </div>
                );

            case 'searching':
                return (
                    <div className="flex flex-col items-center justify-center py-20 px-6">
                        <div className="relative mb-4">
                            <div className="w-14 h-14 rounded-full border-4 border-surface-200" />
                            <div className="w-14 h-14 rounded-full border-4 border-accent-500 border-t-transparent animate-spin absolute inset-0" />
                        </div>
                        <p className="text-sm font-medium text-surface-500">Đang tra cứu...</p>
                    </div>
                );

            case 'phone':
                return (
                    <VoucherListSelector
                        phone={view.phone}
                        vouchers={view.vouchers}
                        onSelect={v => setView({ kind: 'voucher-detail', voucher: v })}
                        onClose={close}
                    />
                );

            case 'voucher-detail':
                return (
                    <VoucherDetailsCard
                        voucher={view.voucher}
                        onRedeemed={result => {
                            setView({
                                kind: 'voucher-result',
                                success: result.success,
                                title: result.success ? 'Sử dụng thành công' : 'Không thể sử dụng',
                                details: result.success
                                    ? [
                                        { label: 'Mã voucher', value: view.voucher.id },
                                        { label: 'Thời gian', value: new Date(result.usedAt || '').toLocaleString('vi-VN') },
                                        { label: 'SĐT khách', value: view.voucher.distributedToPhone || '—' },
                                    ]
                                    : [
                                        { label: 'Mã voucher', value: view.voucher.id },
                                        { label: 'Lý do', value: result.message },
                                    ],
                            });
                        }}
                        onClose={close}
                    />
                );

            case 'voucher-result':
                return <VoucherResultCard success={view.success} title={view.title} details={view.details} onClose={close} />;

            case 'product':
                return <ProductInfoCard product={view.product} onClose={close} />;

            case 'ticket-pass':
                return <TicketPassCard pass={view.pass} onClose={close} onRescan={resetToScanner} />;

            case 'ticket-order':
                return <TicketOrderCard order={view.order} onClose={close} onRescan={resetToScanner} />;

            case 'referral':
                return <ReferralView employee={view.employee} cashierId={authUser?.uid || ''} onDone={close} onRescan={resetToScanner} />;

            case 'not-found':
                return (
                    <div className="flex flex-col items-center py-12 px-6">
                        <div className="w-16 h-16 rounded-full bg-surface-100 flex items-center justify-center mb-4">
                            <SearchX className="w-8 h-8 text-surface-400" />
                        </div>
                        <h3 className="text-base font-bold text-surface-800 mb-1">Không tìm thấy</h3>
                        <p className="text-sm text-surface-500 text-center mb-1">Không có kết quả cho:</p>
                        <p className="text-sm font-mono font-semibold text-surface-700 bg-surface-100 px-3 py-1 rounded-lg mb-6">{view.query}</p>
                        <div className="w-full space-y-2">
                            <button onClick={resetToScanner} className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-accent-500 text-white font-bold text-sm hover:bg-accent-600 transition-colors">
                                <RotateCcw className="w-4 h-4" /> Quét lại
                            </button>
                            <button onClick={close} className="w-full py-3 rounded-xl bg-surface-100 text-surface-600 font-semibold text-sm hover:bg-surface-200 transition-colors">
                                Đóng
                            </button>
                        </div>
                    </div>
                );
        }
    };

    return (
        <>
            {/* ── Draggable FAB Button ──────────────────────────── */}
            <DraggableFAB
                onTapScan={open}
                onTapAI={() => setIsAIChatOpen(true)}
                hidden={isOpen || isAIChatOpen}
                hasAI={canUseAI}
            />

            {/* ── AI Chat BottomSheet ─────────────────────────────── */}
            {canUseAI && (
                <AIQuickChat isOpen={isAIChatOpen} onClose={() => setIsAIChatOpen(false)} />
            )}

            {/* ── BottomSheet ──────────────────────────────────────── */}
            <BottomSheet isOpen={isOpen} onClose={close} maxHeightClass="max-h-[92vh] lg:max-h-[40vh]">
                {/* Custom header */}
                <div className="flex items-center justify-between px-5 py-3 border-b border-surface-100">
                    <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-accent-500 to-accent-600 flex items-center justify-center">
                            <ScanLine className="w-4 h-4 text-white" />
                        </div>
                        <div>
                            <h2 className="text-sm font-bold text-surface-800">Quét mã</h2>
                            <p className="text-[10px] text-surface-400">QR • Barcode • Vé • Voucher • SĐT</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        {view.kind !== 'scanner' && view.kind !== 'searching' && (
                            <button
                                onClick={resetToScanner}
                                className="p-1.5 rounded-lg bg-surface-100 text-surface-500 hover:bg-surface-200 transition-colors"
                                title="Quét lại"
                            >
                                <Camera className="w-4 h-4" />
                            </button>
                        )}
                        <button
                            onClick={close}
                            className="p-1.5 rounded-lg bg-surface-100 text-surface-500 hover:bg-surface-200 transition-colors"
                        >
                            <X className="w-4 h-4" />
                        </button>
                    </div>
                </div>

                {/* Content */}
                {renderContent()}
            </BottomSheet>

            {/* ── Scan line animation ─────────────────────────────── */}
            <style jsx global>{`
                @keyframes scan {
                    0%, 100% { top: 8%; opacity: 0; }
                    10% { opacity: 1; }
                    50% { top: 82%; opacity: 1; }
                    60% { opacity: 0; }
                }
                .animate-scan {
                    position: absolute;
                    animation: scan 1.8s ease-in-out infinite;
                }
            `}</style>
        </>
    );
}
