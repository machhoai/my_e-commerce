'use client';

import { useRef, useState, useCallback, useEffect } from 'react';
import { Camera, X, SwitchCamera, ImagePlus, AlertTriangle, ShieldAlert, Loader2 } from 'lucide-react';
import { Html5Qrcode } from 'html5-qrcode';
import Portal from '@/components/Portal';

interface BarcodeScannerProps {
    onScanSuccess: (decodedText: string) => void;
    onClose: () => void;
    autoStart?: boolean;
}

export default function BarcodeScanner({ onScanSuccess, onClose, autoStart = false }: BarcodeScannerProps) {
    const scannerRef = useRef<Html5Qrcode | null>(null);
    const [scanError, setScanError] = useState('');
    const [cameraActive, setCameraActive] = useState(false);
    const [cameraLoading, setCameraLoading] = useState(false);
    const [facingMode, setFacingMode] = useState<'environment' | 'user'>('environment');
    const [fileProcessing, setFileProcessing] = useState(false);
    const containerId = 'barcode-scanner-region';
    const autoStarted = useRef(false);

    // ── Rule 1 & 2 & 4: User-triggered, error handling, secure context ──
    const startCamera = useCallback(async (facing: 'environment' | 'user') => {
        // Rule 4: Secure context check
        if (typeof window !== 'undefined' && !window.isSecureContext) {
            setScanError('Tính năng quét mã yêu cầu HTTPS hoặc localhost. Vui lòng sử dụng kết nối an toàn.');
            return;
        }

        setCameraLoading(true);
        setScanError('');

        try {
            // Stop existing scanner if running
            if (scannerRef.current?.isScanning) {
                await scannerRef.current.stop();
            }

            const scanner = new Html5Qrcode(containerId);
            scannerRef.current = scanner;

            await scanner.start(
                { facingMode: facing },
                {
                    fps: 10,
                    qrbox: { width: 280, height: 150 },
                    aspectRatio: 1.5,
                },
                (decodedText) => {
                    scanner.stop().then(() => {
                        onScanSuccess(decodedText);
                    }).catch(() => {
                        onScanSuccess(decodedText);
                    });
                },
                () => { /* ignore per-frame scan failures */ }
            );

            setCameraActive(true);
        } catch (err: any) {
            const msg = err?.message || String(err);
            if (msg.includes('NotAllowedError') || msg.includes('Permission')) {
                setScanError(
                    'Quyền truy cập camera bị từ chối. Vui lòng kiểm tra quyền trong Cài đặt trình duyệt hoặc Cài đặt ứng dụng (Settings > Safari/Chrome > Camera).'
                );
            } else if (msg.includes('NotFoundError') || msg.includes('Requested device not found')) {
                setScanError('Không tìm thấy camera trên thiết bị này.');
            } else if (msg.includes('NotReadableError') || msg.includes('Could not start')) {
                setScanError(
                    'Camera đang được sử dụng bởi ứng dụng khác hoặc không thể truy cập. Vui lòng đóng các ứng dụng camera khác và thử lại.'
                );
            } else if (msg.includes('OverconstrainedError')) {
                setScanError('Camera không hỗ trợ cấu hình yêu cầu. Vui lòng thử đổi camera.');
            } else {
                setScanError(
                    `Không thể truy cập Camera. Vui lòng kiểm tra quyền trong Cài đặt hoặc đảm bảo bạn đang dùng HTTPS. (${msg})`
                );
            }
            setCameraActive(false);
        } finally {
            setCameraLoading(false);
        }
    }, [onScanSuccess]);

    // Auto-start camera if requested
    useEffect(() => {
        if (autoStart && !autoStarted.current) {
            autoStarted.current = true;
            // Small delay to ensure the DOM container is mounted
            const timer = setTimeout(() => startCamera(facingMode), 150);
            return () => clearTimeout(timer);
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [autoStart]);

    const handleSwitchCamera = async () => {
        const newFacing = facingMode === 'environment' ? 'user' : 'environment';
        setFacingMode(newFacing);
        await startCamera(newFacing);
    };

    const handleClose = async () => {
        if (scannerRef.current?.isScanning) {
            await scannerRef.current.stop().catch(() => { });
        }
        onClose();
    };

    // ── Rule 3: Scan from image file (PWA fallback) ──
    const handleScanFromFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        setFileProcessing(true);
        setScanError('');

        try {
            const scanner = new Html5Qrcode('file-scan-region', /* verbose= */ false);
            const result = await scanner.scanFile(file, /* showImage= */ false);
            scanner.clear();
            onScanSuccess(result);
        } catch {
            setScanError('Không thể đọc mã vạch/QR từ ảnh. Vui lòng chụp rõ hơn và thử lại.');
        } finally {
            setFileProcessing(false);
            // Reset input so same file can be re-selected
            e.target.value = '';
        }
    };

    return (
        <Portal>
            <div className="fixed inset-0 z-[110] bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
                <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
                    {/* Header */}
                    <div className="flex items-center justify-between px-5 py-3 border-b border-surface-200">
                        <h3 className="font-bold text-surface-800 flex items-center gap-2">
                            <Camera className="w-5 h-5 text-accent-600" />
                            Quét mã vạch
                        </h3>
                        <div className="flex items-center gap-1">
                            {cameraActive && (
                                <button
                                    onClick={handleSwitchCamera}
                                    className="p-2 rounded-lg hover:bg-surface-100 text-surface-500 transition-colors"
                                    title="Đổi camera"
                                >
                                    <SwitchCamera className="w-5 h-5" />
                                </button>
                            )}
                            <button
                                onClick={handleClose}
                                className="p-2 rounded-lg hover:bg-danger-50 text-surface-500 hover:text-danger-600 transition-colors"
                            >
                                <X className="w-5 h-5" />
                            </button>
                        </div>
                    </div>

                    {/* Scanner viewport */}
                    <div className="relative bg-black min-h-[200px]">
                        <div id={containerId} className="w-full" />

                        {/* Rule 1: Manual start button — shown when camera is NOT active */}
                        {!cameraActive && !cameraLoading && (
                            <div className="absolute inset-0 flex flex-col items-center justify-center bg-surface-900 gap-4 p-6">
                                <div className="w-20 h-20 rounded-full bg-accent-600/20 flex items-center justify-center">
                                    <Camera className="w-10 h-10 text-accent-400" />
                                </div>
                                <button
                                    onClick={() => startCamera(facingMode)}
                                    className="px-6 py-3 bg-accent-600 hover:bg-accent-700 text-white rounded-xl font-bold text-sm transition-all shadow-lg shadow-accent-600/30 active:scale-95 flex items-center gap-2"
                                >
                                    <Camera className="w-4 h-4" />
                                    Bật Camera Quét Mã
                                </button>
                                <p className="text-white/40 text-xs text-center">
                                    Nhấn nút để bật camera quét mã vạch / QR
                                </p>
                            </div>
                        )}

                        {/* Loading state */}
                        {cameraLoading && (
                            <div className="absolute inset-0 flex flex-col items-center justify-center bg-surface-900 gap-3">
                                <Loader2 className="w-8 h-8 text-accent-400 animate-spin" />
                                <p className="text-white/60 text-sm">Đang khởi động camera...</p>
                            </div>
                        )}

                        {/* Active scanner hint */}
                        {cameraActive && !scanError && (
                            <p className="text-center text-white/70 text-xs py-2 bg-black/50">
                                Hướng camera vào mã vạch sản phẩm
                            </p>
                        )}
                    </div>

                    {/* Error display */}
                    {scanError && (
                        <div className="px-5 py-4">
                            <div className="bg-danger-50 border border-danger-200 rounded-xl p-4 text-sm text-danger-700 flex items-start gap-3">
                                <ShieldAlert className="w-5 h-5 text-danger-500 shrink-0 mt-0.5" />
                                <div>
                                    <p className="font-bold mb-1">Không thể truy cập Camera</p>
                                    <p className="text-danger-600">{scanError}</p>
                                    {cameraActive === false && (
                                        <button
                                            onClick={() => { setScanError(''); startCamera(facingMode); }}
                                            className="mt-2 text-xs font-bold text-accent-600 hover:text-accent-800 underline"
                                        >
                                            Thử lại
                                        </button>
                                    )}
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Rule 3: Image file fallback (critical for iOS PWA) */}
                    <div className="px-5 py-4 border-t border-surface-100">
                        <p className="text-xs text-surface-400 text-center mb-2 flex items-center justify-center gap-1.5">
                            <AlertTriangle className="w-3 h-3" />
                            Camera không hoạt động? Chụp ảnh mã vạch trực tiếp:
                        </p>
                        <label className="cursor-pointer flex items-center justify-center gap-2 w-full py-2.5 bg-sky-50 hover:bg-sky-100 text-sky-700 border border-sky-200 rounded-xl font-bold text-sm transition-colors active:scale-[0.98]">
                            {fileProcessing ? (
                                <Loader2 className="w-4 h-4 animate-spin" />
                            ) : (
                                <ImagePlus className="w-4 h-4" />
                            )}
                            {fileProcessing ? 'Đang xử lý...' : 'Chụp ảnh mã vạch'}
                            <input
                                type="file"
                                accept="image/*"
                                capture="environment"
                                className="hidden"
                                onChange={handleScanFromFile}
                                disabled={fileProcessing}
                            />
                        </label>
                    </div>

                    {/* Hidden element for file scanning */}
                    <div id="file-scan-region" className="hidden" />

                    {/* Footer */}
                    <div className="px-5 py-3 border-t border-surface-200">
                        <button
                            onClick={handleClose}
                            className="w-full py-2.5 rounded-xl bg-surface-100 hover:bg-surface-200 text-surface-700 font-semibold text-sm transition-colors"
                        >
                            Đóng
                        </button>
                    </div>
                </div>
            </div>
        </Portal>
    );
}
