'use client';

import { useRef, useState, useEffect, useCallback } from 'react';
import { Html5Qrcode } from 'html5-qrcode';
import { X, Loader2, CheckCircle2, RotateCcw, Camera } from 'lucide-react';
import { cn } from '@/lib/utils';
import { parseCCCDQR, CCCDParsedData } from '@/lib/utils/cccd';
import { convertBase64ToWebP } from '@/lib/utils/image';

// ── Types ────────────────────────────────────────────────────────────────────
export interface CCCDScanResult {
    parsedData: CCCDParsedData;
    frontPhotoWebP: string;
    backPhotoWebP: string;
}

interface CCCDCameraProps {
    onScanComplete: (result: CCCDScanResult) => void;
    onClose: () => void;
}

type Step = 'SCAN_QR' | 'CAPTURE_FRONT' | 'CAPTURE_BACK' | 'PROCESSING';

const BEEP_FREQ = 1800;
const BEEP_MS = 150;

// ── Component ────────────────────────────────────────────────────────────────
export default function CCCDCamera({ onScanComplete, onClose }: CCCDCameraProps) {
    const videoRef = useRef<HTMLVideoElement>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const streamRef = useRef<MediaStream | null>(null);
    const qrScannerRef = useRef<Html5Qrcode | null>(null);
    const qrContainerRef = useRef<HTMLDivElement>(null);
    const qrFoundRef = useRef(false);

    const [step, setStep] = useState<Step>('SCAN_QR');
    const [error, setError] = useState('');
    const [cameraReady, setCameraReady] = useState(false);
    const [parsedData, setParsedData] = useState<CCCDParsedData | null>(null);
    const [frontPhoto, setFrontPhoto] = useState<string | null>(null);
    const [processingMsg, setProcessingMsg] = useState('');

    // ── Beep sound ───────────────────────────────────────────────────────────
    const playBeep = useCallback(() => {
        try {
            const ctx = new AudioContext();
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.connect(gain);
            gain.connect(ctx.destination);
            osc.frequency.value = BEEP_FREQ;
            gain.gain.value = 0.3;
            osc.start();
            osc.stop(ctx.currentTime + BEEP_MS / 1000);
        } catch { /* silent */ }
    }, []);

    // ── Start QR Scanner (Step 1) ────────────────────────────────────────────
    useEffect(() => {
        if (step !== 'SCAN_QR') return;

        const containerId = 'cccd-qr-live-region';
        let mounted = true;
        let scanner: Html5Qrcode | null = null;
        qrFoundRef.current = false;

        const startScanner = async () => {
            if (!qrContainerRef.current) return;

            try {
                scanner = new Html5Qrcode(containerId, { verbose: false });
                qrScannerRef.current = scanner;

                await scanner.start(
                    { facingMode: 'environment' },
                    {
                        fps: 15, // Giữ nguyên 15 để máy xử lý kịp
                        // SỬA ĐOẠN NÀY: Dùng hàm để tự tính toán độ rộng vùng quét
                        qrbox: (viewW, viewH) => {
                            const size = Math.floor(Math.min(viewW, viewH) * 0.7);
                            return { width: size, height: size };
                        },
                        aspectRatio: 1.0,
                        disableFlip: true, // Nhớ đổi thành true để giảm tải CPU
                        // Ép ống kính lấy nét
                        videoConstraints: {
                            facingMode: { exact: 'environment' },
                            width: { min: 1280, ideal: 1920 },
                            height: { min: 720, ideal: 1080 },
                            advanced: [{ focusMode: "continuous" }] as any,
                        }
                    },
                    (decodedText) => {
                        // Guard: only process once
                        if (!mounted || qrFoundRef.current) return;

                        const parsed = parseCCCDQR(decodedText);
                        if (parsed) {
                            // Set flag IMMEDIATELY to prevent re-entry
                            qrFoundRef.current = true;
                            playBeep();
                            setParsedData(parsed);

                            // Stop scanner safely
                            const s = scanner;
                            if (s) {
                                try {
                                    const state = s.getState();
                                    // Only stop if actually running (state 2 = SCANNING)
                                    if (state === 2) {
                                        s.stop().then(() => {
                                            try { s.clear(); } catch { }
                                            qrScannerRef.current = null;
                                            if (mounted) setStep('CAPTURE_FRONT');
                                        }).catch(() => {
                                            qrScannerRef.current = null;
                                            if (mounted) setStep('CAPTURE_FRONT');
                                        });
                                    } else {
                                        qrScannerRef.current = null;
                                        if (mounted) setStep('CAPTURE_FRONT');
                                    }
                                } catch {
                                    qrScannerRef.current = null;
                                    if (mounted) setStep('CAPTURE_FRONT');
                                }
                            }
                        }
                    },
                    () => { /* QR not found in frame — keep scanning */ },
                );

                if (mounted) setCameraReady(true);
            } catch (err) {
                console.error('[CCCD] QR scanner start failed:', err);
                if (mounted) setError('Không thể truy cập camera. Vui lòng cấp quyền camera.');
            }
        };

        startScanner();

        return () => {
            mounted = false;
            if (scanner) {
                try {
                    const state = scanner.getState();
                    if (state === 2) {
                        scanner.stop().catch(() => { });
                    }
                    scanner.clear();
                } catch { /* ignore */ }
                qrScannerRef.current = null;
            }
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [step]);

    // ── Start manual camera (Steps 2 & 3) ────────────────────────────────────
    useEffect(() => {
        if (step !== 'CAPTURE_FRONT' && step !== 'CAPTURE_BACK') return;

        let mounted = true;

        const startCamera = async () => {
            setCameraReady(false);

            // Stop any existing stream
            streamRef.current?.getTracks().forEach(t => t.stop());

            const constraintsList = [
                {
                    video: {
                        facingMode: { exact: 'environment' as const },
                        width: { min: 1280, ideal: 1920 },
                        height: { min: 720, ideal: 1080 },
                    },
                    audio: false,
                },
                { video: { facingMode: 'environment' as const }, audio: false },
                { video: true, audio: false },
            ];

            let stream: MediaStream | null = null;
            for (const constraints of constraintsList) {
                try {
                    stream = await navigator.mediaDevices.getUserMedia(constraints);
                    break;
                } catch {
                    continue;
                }
            }

            if (!stream || !mounted) {
                if (!mounted) { stream?.getTracks().forEach(t => t.stop()); return; }
                setError('Không thể truy cập camera.');
                return;
            }

            streamRef.current = stream;

            if (videoRef.current) {
                const video = videoRef.current;
                video.srcObject = null;
                await new Promise<void>(r => requestAnimationFrame(() => r()));
                video.srcObject = stream;

                await new Promise<void>((resolve) => {
                    const timeout = setTimeout(() => resolve(), 3000);
                    video.onloadeddata = () => { clearTimeout(timeout); resolve(); };
                });

                try { await video.play(); } catch { /* ignore */ }
            }

            if (mounted) setCameraReady(true);
        };

        startCamera();

        return () => {
            mounted = false;
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [step]);

    // ── Cleanup on unmount ───────────────────────────────────────────────────
    useEffect(() => {
        return () => {
            streamRef.current?.getTracks().forEach(t => t.stop());
            if (qrScannerRef.current) {
                qrScannerRef.current.stop().catch(() => { });
                try { qrScannerRef.current.clear(); } catch { }
            }
        };
    }, []);

    // ── Capture frame from video ─────────────────────────────────────────────
    const captureFrame = useCallback((): string | null => {
        const video = videoRef.current;
        const canvas = canvasRef.current;
        if (!video || !canvas || video.videoWidth === 0) return null;

        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        const ctx = canvas.getContext('2d');
        if (!ctx) return null;
        ctx.drawImage(video, 0, 0);
        return canvas.toDataURL('image/png');
    }, []);

    // ── Handle front capture ─────────────────────────────────────────────────
    const handleCaptureFront = () => {
        const photo = captureFrame();
        if (!photo) return;
        setFrontPhoto(photo);

        // Stop current stream before switching to back
        streamRef.current?.getTracks().forEach(t => t.stop());
        streamRef.current = null;

        setStep('CAPTURE_BACK');
    };

    // ── Handle back capture → process ────────────────────────────────────────
    const handleCaptureBack = async () => {
        const backPhoto = captureFrame();
        if (!backPhoto || !frontPhoto || !parsedData) return;

        // Stop camera
        streamRef.current?.getTracks().forEach(t => t.stop());
        streamRef.current = null;

        setStep('PROCESSING');
        setProcessingMsg('Đang xử lý ảnh...');

        try {
            // Resize & compress — must be under ~700KB for Firestore's 1MB base64 field limit
            const compressPhoto = (src: string): Promise<string> => {
                return new Promise((resolve, reject) => {
                    const img = new Image();
                    img.onload = () => {
                        const MAX_W = 480;
                        let w = img.naturalWidth;
                        let h = img.naturalHeight;
                        if (w > MAX_W) { h = Math.round(h * (MAX_W / w)); w = MAX_W; }
                        const c = document.createElement('canvas');
                        c.width = w; c.height = h;
                        const ctx = c.getContext('2d');
                        if (!ctx) return reject(new Error('no ctx'));
                        ctx.drawImage(img, 0, 0, w, h);

                        // Try WebP first, check if browser actually produced WebP
                        let result = c.toDataURL('image/webp', 0.3);
                        if (!result.startsWith('data:image/webp')) {
                            // Browser doesn't support WebP canvas — use JPEG fallback
                            result = c.toDataURL('image/jpeg', 0.3);
                        }

                        // Safety: if still too large (>500KB), keep reducing
                        let quality = 0.2;
                        while (result.length > 500_000 && quality > 0.05) {
                            const fmt = result.startsWith('data:image/webp') ? 'image/webp' : 'image/jpeg';
                            result = c.toDataURL(fmt, quality);
                            quality -= 0.05;
                        }

                        resolve(result);
                    };
                    img.onerror = reject;
                    img.src = src;
                });
            };

            const [frontWebP, backWebP] = await Promise.all([
                compressPhoto(frontPhoto),
                compressPhoto(backPhoto),
            ]);

            setProcessingMsg('Hoàn tất!');

            onScanComplete({
                parsedData,
                frontPhotoWebP: frontWebP,
                backPhotoWebP: backWebP,
            });
        } catch (err) {
            console.error('[CCCD] Processing failed:', err);
            setError('Xử lý ảnh thất bại. Vui lòng thử lại.');
        }
    };

    // ── Close handler ────────────────────────────────────────────────────────
    const handleClose = () => {
        streamRef.current?.getTracks().forEach(t => t.stop());
        if (qrScannerRef.current) {
            qrScannerRef.current.stop().catch(() => { });
            try { qrScannerRef.current.clear(); } catch { }
        }
        onClose();
    };

    // ── Step config ──────────────────────────────────────────────────────────
    const steps = [
        { num: 1, key: 'SCAN_QR', label: 'Quét QR', icon: '📷', instruction: 'Dí sát mã QR vào giữa khung vuông' },
        { num: 2, key: 'CAPTURE_FRONT', label: 'Mặt trước', icon: '🪪', instruction: 'Lùi ra xa để chụp toàn bộ mặt TRƯỚC' },
        { num: 3, key: 'CAPTURE_BACK', label: 'Mặt sau', icon: '🔄', instruction: 'Lật thẻ lại và chụp mặt SAU' },
    ];
    const currentStepIdx = step === 'PROCESSING' ? 2 : steps.findIndex(s => s.key === step);
    const currentStep = steps[currentStepIdx] || steps[0];

    return (
        <div className="fixed inset-0 z-[200] bg-black flex flex-col">
            {/* ── Header ──────────────────────────────────────────────── */}
            <div className="relative z-10 bg-gradient-to-b from-black/90 via-black/80 to-transparent pb-4">
                {/* Close + Title row */}
                <div className="flex items-center px-4 pt-3 pb-2">
                    <button onClick={handleClose} className="w-9 h-9 rounded-full bg-white/10 backdrop-blur-sm flex items-center justify-center active:scale-90 transition-transform">
                        <X className="w-4.5 h-4.5 text-white" />
                    </button>
                    <div className="flex-1 text-center">
                        <p className="text-white text-[11px] font-black tracking-[0.15em] uppercase">Xác thực CCCD</p>
                    </div>
                    <div className="w-9" /> {/* Spacer for centering */}
                </div>

                {/* ── Stepper ──────────────────────────────────────────── */}
                <div className="px-6 mt-1">
                    <div className="flex items-center justify-between">
                        {steps.map((s, i) => {
                            const isCompleted = currentStepIdx > i;
                            const isCurrent = currentStepIdx === i;
                            return (
                                <div key={s.num} className="flex items-center flex-1 last:flex-initial">
                                    {/* Step circle */}
                                    <div className="flex flex-col items-center gap-1 relative">
                                        <div className={cn(
                                            'w-8 h-8 rounded-full flex items-center justify-center text-sm transition-all duration-500',
                                            isCompleted ? 'bg-emerald-500 shadow-[0_0_12px_rgba(16,185,129,0.4)]' :
                                            isCurrent ? 'bg-white/15 ring-2 ring-white/50 shadow-[0_0_16px_rgba(255,255,255,0.15)]' :
                                            'bg-white/5 ring-1 ring-white/10'
                                        )}>
                                            {isCompleted ? (
                                                <CheckCircle2 className="w-4 h-4 text-white" />
                                            ) : (
                                                <span className={cn('text-xs', isCurrent ? 'grayscale-0' : 'grayscale opacity-40')}>
                                                    {s.icon}
                                                </span>
                                            )}
                                        </div>
                                        <span className={cn(
                                            'text-[8px] font-bold tracking-wider uppercase whitespace-nowrap transition-colors duration-300',
                                            isCompleted ? 'text-emerald-400' :
                                            isCurrent ? 'text-white' :
                                            'text-white/25'
                                        )}>
                                            {s.label}
                                        </span>
                                    </div>
                                    {/* Connector line */}
                                    {i < steps.length - 1 && (
                                        <div className="flex-1 h-[2px] mx-2 mb-4 rounded-full overflow-hidden bg-white/10">
                                            <div className={cn(
                                                'h-full rounded-full transition-all duration-700 ease-out',
                                                currentStepIdx > i ? 'w-full bg-emerald-500' :
                                                currentStepIdx === i ? 'w-1/2 bg-white/30' :
                                                'w-0'
                                            )} />
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                </div>

                {/* ── Instruction pill ─────────────────────────────────── */}
                {step !== 'PROCESSING' && (
                    <div className="mx-6 mt-3">
                        <div className={cn(
                            'flex items-center gap-2.5 px-3.5 py-2 rounded-xl border backdrop-blur-md transition-colors duration-500',
                            step === 'SCAN_QR'
                                ? 'bg-amber-500/10 border-amber-500/20'
                                : 'bg-emerald-500/10 border-emerald-500/20'
                        )}>
                            <span className="text-base">{currentStep.icon}</span>
                            <p className={cn(
                                'text-[10px] font-bold leading-tight',
                                step === 'SCAN_QR' ? 'text-amber-300' : 'text-emerald-300'
                            )}>
                                {currentStep.instruction}
                            </p>
                        </div>
                    </div>
                )}

                {/* ── Parsed data banner (after QR success) ────────────── */}
                {parsedData && step !== 'SCAN_QR' && step !== 'PROCESSING' && (
                    <div className="mx-6 mt-2">
                        <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-emerald-500/15 border border-emerald-500/20">
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                            <p className="text-emerald-300 text-[9px] font-medium truncate">
                                <span className="font-bold">{parsedData.name}</span> · {parsedData.idCard} · {parsedData.dob}
                            </p>
                        </div>
                    </div>
                )}
            </div>

            {/* ── Camera / Scanner area ────────────────────────────── */}
            <div className="flex-1 relative flex items-center justify-center overflow-hidden bg-black">
                {error ? (
                    <div className="text-center px-8">
                        <div className="w-16 h-16 rounded-full bg-red-500/10 flex items-center justify-center mx-auto mb-4">
                            <X className="w-8 h-8 text-red-400" />
                        </div>
                        <p className="text-red-300 text-sm font-medium mb-4">{error}</p>
                        <button
                            onClick={() => { setError(''); setStep('SCAN_QR'); }}
                            className="flex items-center gap-2 px-6 py-2.5 bg-white/10 text-white text-sm font-semibold rounded-xl mx-auto active:scale-95 transition-transform"
                        >
                            <RotateCcw className="w-4 h-4" /> Thử lại
                        </button>
                    </div>
                ) : step === 'PROCESSING' ? (
                    <div className="flex flex-col items-center gap-4">
                        <div className="w-16 h-16 rounded-2xl bg-white/5 flex items-center justify-center">
                            <Loader2 className="w-8 h-8 text-emerald-400 animate-spin" />
                        </div>
                        <p className="text-white text-sm font-bold">{processingMsg}</p>
                    </div>
                ) : step === 'SCAN_QR' ? (
                    <>
                        <div
                            ref={qrContainerRef}
                            id="cccd-qr-live-region"
                            className="w-full h-full [&>video]:object-cover [&>video]:w-full [&>video]:h-full"
                        />

                        {/* --- BẮT ĐẦU THÊM KHUNG NGẮM LASER TẠI ĐÂY --- */}
                        <div className="absolute inset-0 pointer-events-none z-10 flex items-center justify-center overflow-hidden">
                            {/* Khung vuông tự giãn nở chiếm 70% màn hình */}
                            <div className="relative w-[70vw] max-w-[300px] aspect-square rounded-xl shadow-[0_0_0_9999px_rgba(0,0,0,0.65)]">
                                {/* 4 Góc viền màu xanh lá */}
                                <div className="absolute -top-1 -left-1 w-8 h-8 border-t-4 border-l-4 border-emerald-400 rounded-tl-xl" />
                                <div className="absolute -top-1 -right-1 w-8 h-8 border-t-4 border-r-4 border-emerald-400 rounded-tr-xl" />
                                <div className="absolute -bottom-1 -left-1 w-8 h-8 border-b-4 border-l-4 border-emerald-400 rounded-bl-xl" />
                                <div className="absolute -bottom-1 -right-1 w-8 h-8 border-b-4 border-r-4 border-emerald-400 rounded-br-xl" />

                                {/* Tia laser quét lên xuống */}
                                <div className="absolute left-0 right-0 h-0.5 bg-emerald-400 shadow-[0_0_8px_2px_rgba(16,185,129,0.5)] animate-[scan_2s_ease-in-out_infinite]" />
                            </div>
                        </div>
                        {/* --- KẾT THÚC KHUNG NGẮM --- */}

                        {!cameraReady && (
                            <div className="absolute inset-0 flex items-center justify-center bg-black/80 z-20">
                                <Loader2 className="w-8 h-8 text-white animate-spin" />
                            </div>
                        )}

                        {/* Text hướng dẫn */}
                        {cameraReady && (
                            <div className="absolute bottom-8 left-0 right-0 flex justify-center pointer-events-none z-20">
                                <div className="bg-black/60 backdrop-blur-sm rounded-2xl px-5 py-2.5">
                                    <p className="text-emerald-400 text-xs font-bold text-center animate-pulse">
                                        📲 Đưa mã QR vào giữa khung vuông
                                    </p>
                                </div>
                            </div>
                        )}
                    </>
                ) : (
                    <>
                        {/* Manual capture video */}
                        <video
                            ref={videoRef}
                            playsInline
                            muted
                            className="w-full h-full object-cover"
                        />

                        {/* Card-shaped rectangle overlay */}
                        <div className="absolute inset-0 pointer-events-none">
                            <svg className="w-full h-full" viewBox="0 0 400 700" preserveAspectRatio="xMidYMid slice">
                                <defs>
                                    <mask id="cccd-card-mask">
                                        <rect width="400" height="700" fill="white" />
                                        <rect x="30" y="215" width="340" height="215" rx="14" fill="black" />
                                    </mask>
                                </defs>
                                <rect width="400" height="700" fill="rgba(0,0,0,0.55)" mask="url(#cccd-card-mask)" />
                                <rect
                                    x="30" y="215" width="340" height="215" rx="14"
                                    fill="none" stroke="#10b981" strokeWidth="3" strokeDasharray="14 6" opacity="0.85"
                                />
                                {/* Corner accents */}
                                {/* {[
                                    [30, 215], [340, 215], [30, 416], [340, 416],
                                ].map(([cx, cy], i) => (
                                    <g key={i}>
                                        <rect x={cx} y={cy} width="28" height="3" rx="1.5" fill="#10b981" />
                                        <rect x={cx} y={i >= 2 ? cy - 25 : cy} width="3" height="28" rx="1.5" fill="#10b981" />
                                    </g>
                                ))} */}
                            </svg>
                        </div>

                        {!cameraReady && (
                            <div className="absolute inset-0 flex items-center justify-center bg-black/80">
                                <Loader2 className="w-8 h-8 text-white animate-spin" />
                            </div>
                        )}
                    </>
                )}
            </div>

            {/* ── Bottom controls ──────────────────────────────────── */}
            {(step === 'CAPTURE_FRONT' || step === 'CAPTURE_BACK') && !error && (
                <div className="bg-black/80 backdrop-blur-sm px-6 py-5 safe-area-bottom">
                    <div className="flex flex-col items-center gap-3">
                        <button
                            onClick={step === 'CAPTURE_FRONT' ? handleCaptureFront : handleCaptureBack}
                            disabled={!cameraReady}
                            className={cn(
                                'w-[72px] h-[72px] rounded-full border-[4px] border-white flex items-center justify-center transition-all active:scale-90',
                                !cameraReady ? 'opacity-30 cursor-not-allowed' : 'bg-white/20'
                            )}
                        >
                            <div className={cn('w-14 h-14 rounded-full flex items-center justify-center',
                                !cameraReady ? 'bg-white/50' : 'bg-white'
                            )}>
                                <Camera className="w-6 h-6 text-gray-800" />
                            </div>
                        </button>
                        <p className="text-white/40 text-[10px] font-medium">
                            {step === 'CAPTURE_FRONT' ? 'Chụp mặt trước' : 'Chụp mặt sau'}
                        </p>
                    </div>
                </div>
            )}

            {/* Hidden canvas for frame capture */}
            <canvas ref={canvasRef} className="hidden" />
        </div>
    );
}
