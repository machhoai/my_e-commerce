'use client';

/**
 * QRDownloadSection — Client Component
 *
 * Co-located with the admin product detail page (prefixed _ to indicate it is
 * a private sub-component, not a standalone route or shared component).
 *
 * Responsible for:
 *   - Rendering the public QR code SVG via qrcode.react
 *   - Converting the SVG to a high-res PNG (2× / 400px) for box sticker printing
 *   - Copying the public URL to clipboard
 */

import { useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { Download, QrCode, Copy, CheckCircle2 } from 'lucide-react';

export function QRDownloadSection({ sku }: { sku: string }) {
    const publicUrl = `${process.env.NEXT_PUBLIC_SITE_URL}/p/${sku}`;
    const [downloading, setDownloading] = useState(false);
    const [copied, setCopied] = useState(false);

    const handleDownloadPng = async () => {
        setDownloading(true);
        try {
            const svgEl = document.getElementById('qr-product-code') as SVGSVGElement | null;
            if (!svgEl) return;

            // Serialize SVG → Blob URL
            const serializer = new XMLSerializer();
            const svgStr = serializer.serializeToString(svgEl);
            const svgBlob = new Blob([svgStr], { type: 'image/svg+xml;charset=utf-8' });
            const svgUrl = URL.createObjectURL(svgBlob);

            // Draw onto offscreen canvas at 2× for print quality
            const canvas = document.createElement('canvas');
            const size = 400;
            canvas.width = size;
            canvas.height = size;
            const ctx = canvas.getContext('2d')!;

            await new Promise<void>((resolve, reject) => {
                const img = new Image();
                img.onload = () => {
                    ctx.fillStyle = '#ffffff';
                    ctx.fillRect(0, 0, size, size);
                    ctx.drawImage(img, 0, 0, size, size);
                    URL.revokeObjectURL(svgUrl);
                    resolve();
                };
                img.onerror = reject;
                img.src = svgUrl;
            });

            // Trigger PNG download
            const pngUrl = canvas.toDataURL('image/png');
            const a = document.createElement('a');
            a.href = pngUrl;
            a.download = `qr-${sku}.png`;
            a.click();
        } catch (err) {
            console.error('[QRDownload] Failed:', err);
        } finally {
            setDownloading(false);
        }
    };

    const handleCopyUrl = async () => {
        try {
            await navigator.clipboard.writeText(publicUrl);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        } catch { /* silent */ }
    };

    return (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden sticky top-6">
            {/* Header */}
            <div className="px-5 py-4 border-b border-slate-100 flex items-center gap-2">
                <QrCode className="w-4 h-4 text-slate-500" />
                <span className="text-sm font-bold text-slate-700">QR Công Khai</span>
            </div>

            {/* QR Code + Actions */}
            <div className="flex flex-col items-center gap-4 p-5">
                <div className="bg-white p-3 rounded-xl border-2 border-slate-100 shadow-inner">
                    <QRCodeSVG
                        id="qr-product-code"
                        value={publicUrl}
                        size={180}
                        marginSize={2}
                        level="M"
                    />
                </div>

                {/* Public URL preview + copy */}
                <div className="w-full bg-slate-50 rounded-lg p-2.5 flex items-center gap-2 border border-slate-200">
                    <p className="flex-1 text-[11px] text-slate-500 font-mono break-all leading-snug">
                        {publicUrl}
                    </p>
                    <button
                        onClick={handleCopyUrl}
                        title="Sao chép URL"
                        className="flex-shrink-0 text-slate-400 hover:text-primary-600 transition-colors"
                    >
                        {copied
                            ? <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                            : <Copy className="w-4 h-4" />}
                    </button>
                </div>

                {/* Download button */}
                <button
                    onClick={handleDownloadPng}
                    disabled={downloading}
                    className="w-full flex items-center justify-center gap-2 bg-gradient-to-r from-primary-600 to-accent-600 hover:from-primary-700 hover:to-accent-700 text-white py-2.5 px-4 rounded-xl font-semibold text-sm shadow-md shadow-primary-500/20 transition-all active:scale-95 disabled:opacity-60 disabled:cursor-not-allowed"
                >
                    {downloading ? (
                        <>
                            <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                            Đang tạo PNG...
                        </>
                    ) : (
                        <>
                            <Download className="w-4 h-4" />
                            Tải QR dán thùng (PNG)
                        </>
                    )}
                </button>

                <p className="text-[10px] text-slate-400 text-center leading-relaxed">
                    QR này trỏ đến trang công khai — không chứa giá hay tồn kho
                </p>
            </div>
        </div>
    );
}
