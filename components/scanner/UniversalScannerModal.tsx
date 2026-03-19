'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { X, ScanLine, Keyboard, Loader2, SearchX, Camera, RotateCcw } from 'lucide-react';
import { cn } from '@/lib/utils';
import { universalSearchAction } from '@/actions/scanner';
import type { ScanResult } from '@/types';
import type { VoucherCode } from '@/types';
import type { ProductDoc } from '@/types/inventory';
import VoucherListSelector from './VoucherListSelector';
import VoucherDetailsCard from './VoucherDetailsCard';
import VoucherResultCard from './VoucherResultCard';
import ProductInfoCard from './ProductInfoCard';

type ModalView =
    | { kind: 'scanner' }
    | { kind: 'searching' }
    | { kind: 'phone'; phone: string; vouchers: VoucherCode[] }
    | { kind: 'voucher-detail'; voucher: VoucherCode & { campaignImage?: string; campaignName?: string } }
    | { kind: 'voucher-result'; success: boolean; title: string; details: { label: string; value: string }[] }
    | { kind: 'product'; product: ProductDoc }
    | { kind: 'not-found'; query: string };

export default function UniversalScannerModal() {
    const [isOpen, setIsOpen] = useState(false);
    const [view, setView] = useState<ModalView>({ kind: 'scanner' });
    const [manualInput, setManualInput] = useState('');
    const [showManual, setShowManual] = useState(false);
    const scannerRef = useRef<HTMLDivElement>(null);
    const html5QrRef = useRef<any>(null);
    const scanLock = useRef(false);

    // ── Start camera ─────────────────────────────────────────────
    const startCamera = useCallback(async () => {
        if (!scannerRef.current) return;
        scanLock.current = false;

        try {
            const { Html5Qrcode } = await import('html5-qrcode');
            const scanner = new Html5Qrcode('scanner-container');
            html5QrRef.current = scanner;

            await scanner.start(
                { facingMode: 'environment' },
                {
                    fps: 10,
                    qrbox: { width: 250, height: 250 },
                    aspectRatio: 1,
                },
                (text: string) => {
                    if (scanLock.current) return;
                    scanLock.current = true;
                    handleSearch(text);
                },
                () => { /* ignore errors, they happen every frame */ },
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
                if (state === 2 /* SCANNING */ || state === undefined) {
                    await html5QrRef.current.stop();
                }
                html5QrRef.current.clear?.();
                html5QrRef.current = null;
            }
        } catch {
            html5QrRef.current = null;
        }
    }, []);

    // ── Open / Close modal ───────────────────────────────────────
    const open = () => {
        setIsOpen(true);
        setView({ kind: 'scanner' });
        setManualInput('');
        setShowManual(false);
        scanLock.current = false;
    };

    const close = async () => {
        await stopCamera();
        setIsOpen(false);
        setView({ kind: 'scanner' });
        setManualInput('');
        setShowManual(false);
    };

    // Start camera when scanner view mounts
    useEffect(() => {
        if (isOpen && view.kind === 'scanner') {
            const timer = setTimeout(() => startCamera(), 300);
            return () => {
                clearTimeout(timer);
                stopCamera();
            };
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
                    setView({
                        kind: 'phone',
                        phone: result.data.phone,
                        vouchers: result.data.vouchers,
                    });
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
                    <div className="flex flex-col h-full">
                        {/* Camera viewport */}
                        <div className="flex-1 relative bg-black rounded-b-xl overflow-hidden">
                            <div id="scanner-container" ref={scannerRef} className="w-full h-full" />

                            {/* Scan overlay frame */}
                            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                                <div className="w-56 h-56 border-2 border-white/30 rounded-2xl relative">
                                    <div className="absolute -top-0.5 -left-0.5 w-8 h-8 border-t-3 border-l-3 border-accent-400 rounded-tl-xl" />
                                    <div className="absolute -top-0.5 -right-0.5 w-8 h-8 border-t-3 border-r-3 border-accent-400 rounded-tr-xl" />
                                    <div className="absolute -bottom-0.5 -left-0.5 w-8 h-8 border-b-3 border-l-3 border-accent-400 rounded-bl-xl" />
                                    <div className="absolute -bottom-0.5 -right-0.5 w-8 h-8 border-b-3 border-r-3 border-accent-400 rounded-br-xl" />
                                    {/* Scan line animation */}
                                    <div className="absolute left-2 right-2 h-0.5 bg-gradient-to-r from-transparent via-accent-400 to-transparent animate-scan" />
                                </div>
                            </div>

                            {/* Camera hint */}
                            <div className="absolute bottom-4 left-0 right-0 text-center">
                                <p className="text-xs text-white/70 font-medium">Hướng camera vào mã QR hoặc Barcode</p>
                            </div>
                        </div>

                        {/* Manual input toggle */}
                        <div className="p-4 bg-white">
                            {showManual ? (
                                <form onSubmit={handleManualSubmit} className="flex gap-2">
                                    <input
                                        type="text"
                                        value={manualInput}
                                        onChange={e => setManualInput(e.target.value)}
                                        placeholder="Nhập mã voucher, SĐT hoặc mã SP..."
                                        autoFocus
                                        className="flex-1 bg-surface-50 border border-surface-200 text-sm rounded-xl px-3.5 py-3 focus:ring-accent-500 focus:border-accent-400 placeholder-surface-400"
                                    />
                                    <button
                                        type="submit"
                                        disabled={!manualInput.trim()}
                                        className="px-4 py-3 bg-surface-800 text-white rounded-xl font-bold text-sm disabled:opacity-50 hover:bg-surface-900 transition-colors shrink-0"
                                    >
                                        Tìm
                                    </button>
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
                            if (result.success) {
                                setView({
                                    kind: 'voucher-result',
                                    success: true,
                                    title: 'Sử dụng thành công',
                                    details: [
                                        { label: 'Mã voucher', value: view.voucher.id },
                                        { label: 'Thời gian', value: new Date(result.usedAt || '').toLocaleString('vi-VN') },
                                        { label: 'SĐT khách', value: view.voucher.distributedToPhone || '—' },
                                    ],
                                });
                            } else {
                                setView({
                                    kind: 'voucher-result',
                                    success: false,
                                    title: 'Không thể sử dụng',
                                    details: [
                                        { label: 'Mã voucher', value: view.voucher.id },
                                        { label: 'Lý do', value: result.message },
                                    ],
                                });
                            }
                        }}
                        onClose={close}
                    />
                );

            case 'voucher-result':
                return (
                    <VoucherResultCard
                        success={view.success}
                        title={view.title}
                        details={view.details}
                        onClose={close}
                    />
                );

            case 'product':
                return (
                    <ProductInfoCard product={view.product} onClose={close} />
                );

            case 'not-found':
                return (
                    <div className="flex flex-col items-center py-12 px-6">
                        <div className="w-16 h-16 rounded-full bg-surface-100 flex items-center justify-center mb-4">
                            <SearchX className="w-8 h-8 text-surface-400" />
                        </div>
                        <h3 className="text-base font-bold text-surface-800 mb-1">Không tìm thấy</h3>
                        <p className="text-sm text-surface-500 text-center mb-1">
                            Không có kết quả cho:
                        </p>
                        <p className="text-sm font-mono font-semibold text-surface-700 bg-surface-100 px-3 py-1 rounded-lg mb-6">
                            {view.query}
                        </p>
                        <div className="w-full space-y-2">
                            <button
                                onClick={resetToScanner}
                                className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-accent-500 text-white font-bold text-sm hover:bg-accent-600 transition-colors"
                            >
                                <RotateCcw className="w-4 h-4" /> Quét lại
                            </button>
                            <button
                                onClick={close}
                                className="w-full py-3 rounded-xl bg-surface-100 text-surface-600 font-semibold text-sm hover:bg-surface-200 transition-colors"
                            >
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

            {/* ── Modal Overlay ───────────────────────────────────── */}
            {isOpen && (
                <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
                    {/* Backdrop */}
                    <div
                        className="absolute inset-0 bg-black/50 backdrop-blur-sm animate-in fade-in duration-200"
                        onClick={close}
                    />

                    {/* Modal Panel */}
                    <div className={cn(
                        'relative z-10 w-full sm:max-w-md bg-white overflow-hidden',
                        'rounded-t-3xl sm:rounded-3xl',
                        'shadow-2xl shadow-black/20',
                        'max-h-[90vh] flex flex-col',
                        'animate-in slide-in-from-bottom-4 duration-300',
                    )}>
                        {/* Header */}
                        <div className="flex items-center justify-between px-5 py-4 border-b border-surface-100">
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
                        <div className="flex-1 overflow-y-auto">
                            {renderContent()}
                        </div>
                    </div>
                </div>
            )}

            {/* ── Scan line animation ─────────────────────────────── */}
            <style jsx global>{`
                @keyframes scan {
                    0%, 100% { top: 10%; opacity: 0; }
                    10% { opacity: 1; }
                    50% { top: 85%; opacity: 1; }
                    60% { opacity: 0; }
                }
                .animate-scan {
                    position: absolute;
                    animation: scan 2.5s ease-in-out infinite;
                }
            `}</style>
        </>
    );
}
