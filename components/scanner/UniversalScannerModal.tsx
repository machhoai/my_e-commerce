'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { X, ScanLine, Keyboard, SearchX, Camera, RotateCcw, Zap, ZapOff } from 'lucide-react';
import { cn } from '@/lib/utils';
import { universalSearchAction } from '@/actions/scanner';
import type { ScanResult } from '@/types';
import type { VoucherCode } from '@/types';
import type { ProductDoc } from '@/types/inventory';
import VoucherListSelector from './VoucherListSelector';
import VoucherDetailsCard from './VoucherDetailsCard';
import VoucherResultCard from './VoucherResultCard';
import ProductInfoCard from './ProductInfoCard';
import BottomSheet from '@/components/shared/BottomSheet';

type ModalView =
    | { kind: 'scanner' }
    | { kind: 'searching' }
    | { kind: 'phone'; phone: string; vouchers: VoucherCode[] }
    | { kind: 'voucher-detail'; voucher: VoucherCode & { campaignImage?: string; campaignName?: string } }
    | { kind: 'voucher-result'; success: boolean; title: string; details: { label: string; value: string }[] }
    | { kind: 'product'; product: ProductDoc }
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

export default function UniversalScannerModal() {
    const [isOpen, setIsOpen] = useState(false);
    const [view, setView] = useState<ModalView>({ kind: 'scanner' });
    const [manualInput, setManualInput] = useState('');
    const [showManual, setShowManual] = useState(false);
    const [torchOn, setTorchOn] = useState(false);
    const [torchSupported, setTorchSupported] = useState(false);
    const scannerRef = useRef<HTMLDivElement>(null);
    const html5QrRef = useRef<any>(null);
    const scanLock = useRef(false);

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
                    handleSearch(text);
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
    const open = () => {
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

    // ── Search handler ───────────────────────────────────────────
    const handleSearch = async (input: string) => {
        const trimmed = input.trim();
        if (!trimmed) return;
        await stopCamera();
        setView({ kind: 'searching' });
        try {
            const result: ScanResult = await universalSearchAction(trimmed);
            switch (result.type) {
                case 'PHONE':
                    setView({ kind: 'phone', phone: result.data.phone, vouchers: result.data.vouchers });
                    break;
                case 'VOUCHER':
                    setView({ kind: 'voucher-detail', voucher: result.data });
                    break;
                case 'PRODUCT':
                    setView({ kind: 'product', product: result.data });
                    break;
                default:
                    setView({ kind: 'not-found', query: trimmed });
            }
        } catch {
            setView({ kind: 'not-found', query: trimmed });
        }
    };

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
                        {/* Camera viewport */}
                        <div className="relative bg-black overflow-hidden" style={{ height: 500 }}>
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

                        {/* Manual input */}
                        <div className="p-4 bg-white">
                            {showManual ? (
                                <form onSubmit={handleManualSubmit} className="flex gap-2">
                                    <input
                                        type="text"
                                        value={manualInput}
                                        onChange={e => setManualInput(e.target.value)}
                                        placeholder="Nhập mã voucher, SĐT hoặc mã SP..."
                                        autoFocus
                                        className="flex-1 bg-surface-50 border border-surface-200 text-sm rounded-xl px-3.5 py-3 focus:ring-accent-500 focus:border-accent-400 placeholder-surface-400 outline-none"
                                    />
                                    <button
                                        type="submit"
                                        disabled={!manualInput.trim()}
                                        className="px-4 py-3 bg-surface-800 text-white rounded-xl font-bold text-sm disabled:opacity-50 hover:bg-surface-900 transition-colors shrink-0"
                                    >Tìm</button>
                                </form>
                            ) : (
                                <button
                                    onClick={() => setShowManual(true)}
                                    className="w-full flex items-center justify-center gap-2 py-3 rounded-xl border-2 border-dashed border-surface-200 text-surface-500 hover:border-accent-300 hover:text-accent-600 transition-colors text-sm font-medium"
                                >
                                    <Keyboard className="w-4 h-4" />
                                    Nhập thủ công
                                </button>
                            )}
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
            {/* ── FAB Button ──────────────────────────────────────── */}
            <button
                onClick={open}
                className={cn(
                    'fixed bottom-6 right-6 z-40 w-14 h-14 rounded-2xl',
                    'bg-gradient-to-br from-accent-500 to-accent-600 text-white',
                    'shadow-xl shadow-accent-500/30 hover:shadow-accent-500/50',
                    'hover:scale-110 active:scale-95 transition-all duration-200',
                    'flex items-center justify-center',
                    isOpen && 'opacity-0 pointer-events-none',
                )}
                title="Quét mã"
            >
                <ScanLine className="w-6 h-6" />
            </button>

            {/* ── BottomSheet ──────────────────────────────────────── */}
            <BottomSheet isOpen={isOpen} onClose={close} maxHeightClass="max-h-[92vh]">
                {/* Custom header */}
                <div className="flex items-center justify-between px-5 py-3 border-b border-surface-100">
                    <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-accent-500 to-accent-600 flex items-center justify-center">
                            <ScanLine className="w-4 h-4 text-white" />
                        </div>
                        <div>
                            <h2 className="text-sm font-bold text-surface-800">Quét mã</h2>
                            <p className="text-[10px] text-surface-400">QR • Barcode • Voucher • SĐT</p>
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
