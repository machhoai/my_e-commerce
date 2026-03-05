'use client';

import { useEffect, useRef, useState } from 'react';
import { Camera, X, SwitchCamera } from 'lucide-react';
import { Html5Qrcode } from 'html5-qrcode';

interface BarcodeScannerProps {
    onScanSuccess: (decodedText: string) => void;
    onClose: () => void;
}

export default function BarcodeScanner({ onScanSuccess, onClose }: BarcodeScannerProps) {
    const scannerRef = useRef<Html5Qrcode | null>(null);
    const [error, setError] = useState('');
    const [facingMode, setFacingMode] = useState<'environment' | 'user'>('environment');
    const containerId = 'barcode-scanner-region';

    const startScanner = async (facing: 'environment' | 'user') => {
        try {
            // Stop existing scanner if running
            if (scannerRef.current?.isScanning) {
                await scannerRef.current.stop();
            }

            const scanner = new Html5Qrcode(containerId);
            scannerRef.current = scanner;
            setError('');

            await scanner.start(
                { facingMode: facing },
                {
                    fps: 10,
                    qrbox: { width: 280, height: 150 },
                    aspectRatio: 1.5,
                },
                (decodedText) => {
                    // Barcode detected — stop scanner and return result
                    scanner.stop().then(() => {
                        onScanSuccess(decodedText);
                    }).catch(() => {
                        onScanSuccess(decodedText);
                    });
                },
                () => { /* ignore scan failures (each frame that doesn't find a barcode) */ }
            );
        } catch (err: any) {
            const msg = err?.message || String(err);
            if (msg.includes('NotAllowedError') || msg.includes('Permission')) {
                setError('Quyền truy cập camera bị từ chối. Vui lòng cho phép truy cập camera trong cài đặt trình duyệt.');
            } else if (msg.includes('NotFoundError') || msg.includes('Requested device not found')) {
                setError('Không tìm thấy camera trên thiết bị này.');
            } else {
                setError('Không thể khởi động camera. Vui lòng thử lại.');
            }
        }
    };

    useEffect(() => {
        startScanner(facingMode);

        return () => {
            if (scannerRef.current?.isScanning) {
                scannerRef.current.stop().catch(() => { });
            }
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const handleSwitchCamera = async () => {
        const newFacing = facingMode === 'environment' ? 'user' : 'environment';
        setFacingMode(newFacing);
        await startScanner(newFacing);
    };

    const handleClose = async () => {
        if (scannerRef.current?.isScanning) {
            await scannerRef.current.stop().catch(() => { });
        }
        onClose();
    };

    return (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
                {/* Header */}
                <div className="flex items-center justify-between px-5 py-3 border-b border-slate-200">
                    <h3 className="font-bold text-slate-800 flex items-center gap-2">
                        <Camera className="w-5 h-5 text-indigo-600" />
                        Quét mã vạch
                    </h3>
                    <div className="flex items-center gap-1">
                        <button
                            onClick={handleSwitchCamera}
                            className="p-2 rounded-lg hover:bg-slate-100 text-slate-500 transition-colors"
                            title="Đổi camera"
                        >
                            <SwitchCamera className="w-5 h-5" />
                        </button>
                        <button
                            onClick={handleClose}
                            className="p-2 rounded-lg hover:bg-red-50 text-slate-500 hover:text-red-600 transition-colors"
                        >
                            <X className="w-5 h-5" />
                        </button>
                    </div>
                </div>

                {/* Scanner viewport */}
                <div className="relative bg-black">
                    <div id={containerId} className="w-full" />
                    {!error && (
                        <p className="text-center text-white/70 text-xs py-2 bg-black/50">
                            Hướng camera vào mã vạch sản phẩm
                        </p>
                    )}
                </div>

                {/* Error */}
                {error && (
                    <div className="px-5 py-4">
                        <div className="bg-red-50 border border-red-200 rounded-xl p-3 text-sm text-red-700">
                            {error}
                        </div>
                    </div>
                )}

                {/* Footer */}
                <div className="px-5 py-3 border-t border-slate-200">
                    <button
                        onClick={handleClose}
                        className="w-full py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-sm transition-colors"
                    >
                        Đóng
                    </button>
                </div>
            </div>
        </div>
    );
}
