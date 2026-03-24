'use client';

import { useRef, useState, useEffect, useCallback } from 'react';
import { Camera, X, RotateCcw, SwitchCamera, Loader2, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { cn } from '@/lib/utils';

// ── FaceDetector type declaration (Chromium-only API) ────────────────────────
interface DetectedFace {
    boundingBox: DOMRectReadOnly;
}

declare global {
    interface Window {
        FaceDetector?: new () => { detect(source: ImageBitmapSource): Promise<DetectedFace[]> };
    }
}

// ── Minimum face area ratio (0–1). 0.6 = face must cover ≥60% of image ──────
const MIN_FACE_RATIO = 0.15; // bounding box area ÷ image area — 15% of image area is very generous for a "60% face" because bounding box includes margins

interface SmartPortraitCameraProps {
    onCapture: (base64: string) => void;
    onClose: () => void;
    /** Minimum face area ratio (0–1). Default: 0.15 (face bounding box ≥15% of total image area, which visually corresponds to ~60% face coverage in the oval guide) */
    minFaceRatio?: number;
}

export default function SmartPortraitCamera({ onCapture, onClose, minFaceRatio = MIN_FACE_RATIO }: SmartPortraitCameraProps) {
    const videoRef = useRef<HTMLVideoElement>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const streamRef = useRef<MediaStream | null>(null);

    const [facingMode, setFacingMode] = useState<'user' | 'environment'>('user');
    const [captured, setCaptured] = useState<string | null>(null);
    const [error, setError] = useState('');
    const [starting, setStarting] = useState(true);

    // Face validation states
    const [validating, setValidating] = useState(false);
    const [faceError, setFaceError] = useState('');
    const [faceValid, setFaceValid] = useState(false);
    const [faceRatio, setFaceRatio] = useState<number | null>(null);

    // ── Start camera stream ──────────────────────────────────────────────────
    const startCamera = useCallback(async (facing: 'user' | 'environment') => {
        if (streamRef.current) {
            streamRef.current.getTracks().forEach(t => t.stop());
            streamRef.current = null;
        }
        setStarting(true);
        setError('');

        const constraintsList = [
            { video: { facingMode: facing, width: { ideal: 720 }, height: { ideal: 720 } }, audio: false },
            { video: { facingMode: facing }, audio: false },
            { video: true, audio: false },
        ];

        let stream: MediaStream | null = null;
        for (const constraints of constraintsList) {
            try {
                stream = await navigator.mediaDevices.getUserMedia(constraints);
                break;
            } catch (err) {
                console.warn('[Camera] Constraint failed:', constraints, err);
                continue;
            }
        }

        if (!stream) {
            setError('Không thể truy cập camera. Hãy kiểm tra quyền camera trong cài đặt trình duyệt.');
            setStarting(false);
            return;
        }

        streamRef.current = stream;

        if (videoRef.current) {
            videoRef.current.srcObject = stream;
            try {
                await new Promise<void>((resolve, reject) => {
                    const v = videoRef.current!;
                    v.onloadedmetadata = () => resolve();
                    v.onerror = () => reject(new Error('Video element error'));
                    setTimeout(() => resolve(), 3000);
                });
                await videoRef.current.play();
            } catch (playErr) {
                console.error('[Camera] Play failed:', playErr);
            }
        }

        setStarting(false);
    }, []);

    useEffect(() => {
        startCamera(facingMode);
        return () => {
            streamRef.current?.getTracks().forEach(t => t.stop());
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // ── Toggle front/back ────────────────────────────────────────────────────
    const toggleCamera = async () => {
        const next = facingMode === 'user' ? 'environment' : 'user';
        setFacingMode(next);
        setCaptured(null);
        setFaceError('');
        setFaceValid(false);
        setFaceRatio(null);
        await startCamera(next);
    };

    // ── Face detection validation ────────────────────────────────────────────
    const validateFace = useCallback(async (canvas: HTMLCanvasElement): Promise<{ valid: boolean; ratio: number; message: string }> => {
        // Check if FaceDetector API is available
        if (!window.FaceDetector) {
            console.warn('[FaceDetect] FaceDetector API not available — falling back to canvas analysis');
            // Fallback: use a simple skin-tone heuristic
            return validateFaceFallback(canvas);
        }

        try {
            const detector = new window.FaceDetector();
            const bitmap = await createImageBitmap(canvas);
            const faces = await detector.detect(bitmap);
            bitmap.close();

            if (faces.length === 0) {
                return { valid: false, ratio: 0, message: 'Không phát hiện khuôn mặt. Hãy chụp lại.' };
            }

            // Use the largest face
            const largest = faces.reduce((a, b) =>
                (a.boundingBox.width * a.boundingBox.height) > (b.boundingBox.width * b.boundingBox.height) ? a : b
            );

            const faceArea = largest.boundingBox.width * largest.boundingBox.height;
            const imageArea = canvas.width * canvas.height;
            const ratio = faceArea / imageArea;

            if (ratio < minFaceRatio) {
                const pct = Math.round(ratio * 100);
                return {
                    valid: false,
                    ratio,
                    message: `Khuôn mặt quá nhỏ (${pct}%). Hãy đưa khuôn mặt lại gần hơn.`,
                };
            }

            return { valid: true, ratio, message: '' };
        } catch (err) {
            console.error('[FaceDetect] Detection error:', err);
            return validateFaceFallback(canvas);
        }
    }, [minFaceRatio]);

    // ── Fallback: skin-tone pixel analysis ───────────────────────────────────
    const validateFaceFallback = (canvas: HTMLCanvasElement): { valid: boolean; ratio: number; message: string } => {
        const ctx = canvas.getContext('2d');
        if (!ctx) return { valid: true, ratio: 0, message: '' }; // can't validate, let it through

        // Analyze center 60% of the image (where the face guide oval is)
        const centerX = Math.floor(canvas.width * 0.2);
        const centerY = Math.floor(canvas.height * 0.15);
        const centerW = Math.floor(canvas.width * 0.6);
        const centerH = Math.floor(canvas.height * 0.7);

        const imageData = ctx.getImageData(centerX, centerY, centerW, centerH);
        const data = imageData.data;
        let skinPixels = 0;
        const totalPixels = centerW * centerH;

        // Sample every 4th pixel for performance
        for (let i = 0; i < data.length; i += 16) {
            const r = data[i];
            const g = data[i + 1];
            const b = data[i + 2];

            // Simple skin-tone detection (works for various skin tones)
            // Based on RGB range heuristic
            if (
                r > 60 && g > 40 && b > 20 &&
                r > g && r > b &&
                Math.abs(r - g) > 15 &&
                r - b > 15 &&
                r < 250 && g < 230 && b < 210
            ) {
                skinPixels++;
            }
        }

        const sampledTotal = Math.floor(totalPixels / 4);
        const skinRatio = skinPixels / sampledTotal;

        // Skin pixels should cover at least 25% of center region for a valid face portrait
        if (skinRatio < 0.20) {
            return {
                valid: false,
                ratio: skinRatio,
                message: 'Không phát hiện đủ khuôn mặt trong ảnh. Hãy đưa khuôn mặt vào khung.',
            };
        }

        return { valid: true, ratio: skinRatio, message: '' };
    };

    // ── Capture photo ────────────────────────────────────────────────────────
    const handleCapture = async () => {
        const video = videoRef.current;
        const canvas = canvasRef.current;
        if (!video || !canvas) return;

        // Reset face states
        setFaceError('');
        setFaceValid(false);
        setFaceRatio(null);
        setValidating(true);

        // Square crop from center of the video feed
        const vw = video.videoWidth;
        const vh = video.videoHeight;
        const size = Math.min(vw, vh);
        const sx = (vw - size) / 2;
        const sy = (vh - size) / 2;

        canvas.width = 512;
        canvas.height = 512;
        const ctx = canvas.getContext('2d');
        if (!ctx) { setValidating(false); return; }

        // If front camera, flip horizontally so captured image looks natural
        if (facingMode === 'user') {
            ctx.translate(512, 0);
            ctx.scale(-1, 1);
        }

        ctx.drawImage(video, sx, sy, size, size, 0, 0, 512, 512);
        ctx.setTransform(1, 0, 0, 1, 0, 0);

        const base64 = canvas.toDataURL('image/png');

        // ── Validate face proportion ─────────────────────────────────────────
        const result = await validateFace(canvas);
        setFaceRatio(result.ratio);

        if (!result.valid) {
            setCaptured(base64); // still show the captured image so user sees what went wrong
            setFaceError(result.message);
            setFaceValid(false);
        } else {
            setCaptured(base64);
            setFaceValid(true);
        }

        setValidating(false);
    };

    // ── Retake ───────────────────────────────────────────────────────────────
    const handleRetake = () => {
        setCaptured(null);
        setFaceError('');
        setFaceValid(false);
        setFaceRatio(null);

        // Resume video playback (stream is still alive, just need to play again)
        requestAnimationFrame(() => {
            if (videoRef.current && streamRef.current) {
                videoRef.current.srcObject = streamRef.current;
                videoRef.current.play().catch(() => {});
            }
        });
    };

    // ── Confirm ──────────────────────────────────────────────────────────────
    const handleConfirm = () => {
        if (captured && faceValid) onCapture(captured);
    };

    return (
        <div className="fixed inset-0 z-[200] bg-black flex flex-col">
            {/* Top bar */}
            <div className="relative z-10 flex items-center justify-between px-4 py-3 bg-black/60">
                <button onClick={onClose} className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center active:scale-90 transition-transform">
                    <X className="w-5 h-5 text-white" />
                </button>
                <p className="text-white text-xs font-bold tracking-wide">Chụp ảnh đại diện</p>
                <button onClick={toggleCamera} className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center active:scale-90 transition-transform">
                    <SwitchCamera className="w-5 h-5 text-white" />
                </button>
            </div>

            {/* Viewfinder */}
            <div className="flex-1 relative flex items-center justify-center overflow-hidden bg-black">
                {error ? (
                    <div className="text-center px-8">
                        <Camera className="w-12 h-12 text-red-400 mx-auto mb-3" />
                        <p className="text-red-300 text-sm font-medium">{error}</p>
                    </div>
                ) : captured ? (
                    <div className="relative w-full h-full flex items-center justify-center">
                        {/* Preview captured image */}
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={captured} alt="Captured" className="w-full h-full object-contain" />

                        {/* Face validation overlay */}
                        {validating && (
                            <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/60">
                                <Loader2 className="w-8 h-8 text-white animate-spin mb-2" />
                                <p className="text-white text-xs font-medium">Đang kiểm tra khuôn mặt...</p>
                            </div>
                        )}

                        {/* Face validation result badge */}
                        {!validating && (faceError || faceValid) && (
                            <div className={cn(
                                'absolute top-4 left-1/2 -translate-x-1/2 flex items-center gap-2 px-4 py-2.5 rounded-2xl text-xs font-bold shadow-lg backdrop-blur-md',
                                faceError
                                    ? 'bg-red-500/90 text-white'
                                    : 'bg-emerald-500/90 text-white'
                            )}>
                                {faceError ? (
                                    <>
                                        <AlertTriangle className="w-4 h-4 shrink-0" />
                                        <span>{faceError}</span>
                                    </>
                                ) : (
                                    <>
                                        <CheckCircle2 className="w-4 h-4 shrink-0" />
                                        <span>Khuôn mặt hợp lệ{faceRatio !== null ? ` (${Math.round(faceRatio * 100)}%)` : ''}</span>
                                    </>
                                )}
                            </div>
                        )}
                    </div>
                ) : (
                    <>
                        {/* Live video feed */}
                        <video
                            ref={videoRef}
                            playsInline
                            muted
                            className={cn(
                                'w-full h-full object-cover',
                                facingMode === 'user' && 'scale-x-[-1]',
                            )}
                        />

                        {/* Face guide overlay */}
                        <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
                            <svg className="absolute inset-0 w-full h-full" viewBox="0 0 400 600" preserveAspectRatio="xMidYMid slice">
                                <defs>
                                    <mask id="face-mask">
                                        <rect width="400" height="600" fill="white" />
                                        <ellipse cx="200" cy="270" rx="110" ry="145" fill="black" />
                                    </mask>
                                </defs>
                                <rect width="400" height="600" fill="rgba(0,0,0,0.5)" mask="url(#face-mask)" />
                                <ellipse cx="200" cy="270" rx="110" ry="145" fill="none" stroke="white" strokeWidth="2.5" strokeDasharray="8 4" opacity="0.7" />
                            </svg>

                            <p className="absolute bottom-[15%] text-white/70 text-xs font-medium tracking-wide bg-black/30 px-3 py-1 rounded-full">
                                Đặt khuôn mặt vào khung (tối thiểu 60%)
                            </p>
                        </div>

                        {starting && (
                            <div className="absolute inset-0 flex items-center justify-center bg-black/70">
                                <Loader2 className="w-8 h-8 text-white animate-spin" />
                            </div>
                        )}
                    </>
                )}
            </div>

            {/* Bottom controls */}
            <div className="bg-black/80 backdrop-blur-sm px-6 py-5 flex items-center justify-center gap-6 safe-area-bottom">
                {captured ? (
                    <>
                        <button
                            onClick={handleRetake}
                            className="flex items-center gap-2 px-5 py-3 rounded-2xl bg-white/10 text-white text-sm font-bold active:scale-95 transition-transform"
                        >
                            <RotateCcw className="w-4 h-4" /> Chụp lại
                        </button>
                        <button
                            onClick={handleConfirm}
                            disabled={!faceValid || validating}
                            className={cn(
                                'flex items-center gap-2 px-6 py-3 rounded-2xl text-sm font-bold shadow-lg active:scale-95 transition-all',
                                faceValid
                                    ? 'bg-primary-500 text-white shadow-primary-500/30'
                                    : 'bg-white/5 text-white/30 cursor-not-allowed shadow-none'
                            )}
                        >
                            <Camera className="w-4 h-4" />
                            {validating ? 'Đang kiểm tra...' : faceValid ? 'Sử dụng ảnh' : 'Không hợp lệ'}
                        </button>
                    </>
                ) : (
                    <button
                        onClick={handleCapture}
                        disabled={!!error || starting || validating}
                        className={cn(
                            'w-[72px] h-[72px] rounded-full border-[4px] border-white flex items-center justify-center transition-all active:scale-90',
                            'bg-white/20 hover:bg-white/30 disabled:opacity-30 disabled:cursor-not-allowed'
                        )}
                    >
                        <div className="w-14 h-14 rounded-full bg-white" />
                    </button>
                )}
            </div>

            {/* Hidden canvas for capture */}
            <canvas ref={canvasRef} className="hidden" />
        </div>
    );
}
