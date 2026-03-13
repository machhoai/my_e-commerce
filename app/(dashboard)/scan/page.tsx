'use client';

import { useState, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import {
    ScanBarcode, Package, Camera, AlertCircle, Tag, Hash,
    Layers, Scale, X, Search, MapPin, ZoomIn,
} from 'lucide-react';
import type { ProductDoc } from '@/types/inventory';
import dynamic from 'next/dynamic';
import Portal from '@/components/Portal';

const BarcodeScanner = dynamic(() => import('@/components/inventory/BarcodeScanner'), { ssr: false });

export default function ProductScanPage() {
    const { user, getToken } = useAuth();
    const [barcode, setBarcode] = useState('');
    const [product, setProduct] = useState<ProductDoc | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [showScanner, setShowScanner] = useState(false);
    const [scanHistory, setScanHistory] = useState<ProductDoc[]>([]);
    const [lightboxImage, setLightboxImage] = useState<string | null>(null);

    const lookupBarcode = useCallback(async (code: string) => {
        if (!code.trim() || !user) return;
        setLoading(true);
        setProduct(null);
        setError('');
        try {
            const token = await getToken();
            const res = await fetch(`/api/inventory/products?barcode=${encodeURIComponent(code.trim())}`, {
                headers: { Authorization: `Bearer ${token}` },
            });
            const data = await res.json();
            const products: ProductDoc[] = Array.isArray(data) ? data : [];
            const found = products.find(p => p.barcode === code.trim() || p.companyCode === code.trim());
            if (found) {
                setProduct(found);
                setScanHistory(prev => {
                    const filtered = prev.filter(p => p.id !== found.id);
                    return [found, ...filtered].slice(0, 10);
                });
            } else {
                setError(`Không tìm thấy sản phẩm với mã: ${code}`);
            }
        } catch {
            setError('Lỗi tra cứu sản phẩm');
        } finally {
            setLoading(false);
        }
    }, [user, getToken]);

    const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            lookupBarcode(barcode);
        }
    };

    const handleCameraScan = (decodedText: string) => {
        setShowScanner(false);
        setBarcode(decodedText);
        lookupBarcode(decodedText);
    };

    const infoItems = product ? [
        product.barcode && { icon: ScanBarcode, label: 'Mã vạch', value: product.barcode, mono: true },
        product.companyCode && { icon: Hash, label: 'Mã nội bộ', value: product.companyCode, mono: true, accent: true },
        { icon: Scale, label: 'Đơn vị tính', value: product.unit || '—' },
        product.actualPrice != null && { icon: Tag, label: 'Giá bán', value: `${product.actualPrice.toLocaleString('vi-VN')}đ`, success: true },
    ].filter(Boolean) as { icon: typeof ScanBarcode; label: string; value: string; mono?: boolean; accent?: boolean; success?: boolean }[] : [];

    return (
        <div className="space-y-5 mx-auto max-w-lg pb-24">
            {/* Header */}
            <div>
                <h1 className="text-2xl font-bold bg-gradient-to-r from-primary-600 to-accent-600 bg-clip-text text-transparent flex items-center gap-2">
                    <ScanBarcode className="w-7 h-7 text-primary-600" />
                    Tra cứu sản phẩm
                </h1>
                <p className="text-surface-500 mt-1 text-sm">
                    Quét mã vạch hoặc QR để xem thông tin sản phẩm.
                </p>
            </div>

            {/* Scan Input */}
            <div className="bg-white rounded-2xl border border-surface-200 shadow-sm p-4 space-y-3">
                <div className="flex gap-2">
                    <div className="flex-1 relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-surface-400" />
                        <input
                            type="text"
                            value={barcode}
                            onChange={e => setBarcode(e.target.value)}
                            onKeyDown={handleKeyDown}
                            placeholder="Quét hoặc nhập mã vạch / QR..."
                            autoFocus
                            className="w-full pl-10 pr-4 py-3.5 bg-surface-50 border border-surface-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-primary-300 transition-all"
                        />
                    </div>
                    <button
                        onClick={() => setShowScanner(true)}
                        className="px-4 bg-gradient-to-br from-accent-500 to-accent-600 hover:from-accent-600 hover:to-accent-700 text-white rounded-xl transition-all shadow-md shadow-accent-500/20 active:scale-95"
                        title="Quét bằng camera"
                    >
                        <Camera className="w-5 h-5" />
                    </button>
                </div>

                {/* Quick search button */}
                <button
                    onClick={() => lookupBarcode(barcode)}
                    disabled={loading || !barcode.trim()}
                    className="w-full bg-gradient-to-r from-primary-600 to-accent-600 hover:from-primary-700 hover:to-accent-700 disabled:from-surface-300 disabled:to-surface-400 text-white py-3 rounded-xl font-bold text-sm flex items-center justify-center gap-2 transition-all shadow-md shadow-primary-500/20"
                >
                    {loading ? (
                        <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    ) : (
                        <><ScanBarcode className="w-4 h-4" /> Tra cứu</>
                    )}
                </button>
            </div>

            {/* Error */}
            {error && (
                <div className="p-3 rounded-xl flex items-center gap-2 border text-sm font-medium bg-danger-50 text-danger-700 border-danger-200">
                    <AlertCircle className="w-4 h-4 shrink-0" /> {error}
                </div>
            )}

            {/* Product Info Card — Redesigned */}
            {product && (
                <div className="bg-white rounded-2xl border border-surface-200 shadow-lg overflow-hidden animate-in fade-in slide-in-from-bottom-3 duration-300">
                    {/* Product image - clickable for full-size */}
                    {product.image && (
                        <button
                            onClick={() => setLightboxImage(product.image!)}
                            className="relative w-full h-56 bg-surface-100 overflow-hidden group cursor-zoom-in"
                        >
                            <img
                                src={product.image}
                                alt={product.name}
                                className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                            />
                            <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors flex items-center justify-center">
                                <div className="bg-white/80 backdrop-blur-sm rounded-full p-2.5 opacity-0 group-hover:opacity-100 transition-opacity shadow-lg">
                                    <ZoomIn className="w-5 h-5 text-surface-700" />
                                </div>
                            </div>
                        </button>
                    )}

                    <div className="p-5 space-y-4">
                        {/* Name & category */}
                        <div>
                            <h2 className="text-xl font-black text-surface-800">{product.name}</h2>
                            <div className="flex flex-wrap items-center gap-2 mt-2">
                                {product.category && (
                                    <span className="inline-flex items-center gap-1 text-xs font-bold text-accent-600 bg-accent-50 border border-accent-200 px-2.5 py-1 rounded-lg">
                                        <Layers className="w-3 h-3" /> {product.category}
                                    </span>
                                )}
                                {product.origin && (
                                    <span className="inline-flex items-center gap-1 text-xs font-bold text-warning-700 bg-warning-50 border border-warning-200 px-2.5 py-1 rounded-lg">
                                        <MapPin className="w-3 h-3" /> {product.origin}
                                    </span>
                                )}
                            </div>
                        </div>

                        {/* Info grid — compact cards */}
                        <div className="grid grid-cols-2 gap-2.5">
                            {infoItems.map((item) => (
                                <div key={item.label} className="bg-surface-50/80 rounded-xl p-3 border border-surface-100">
                                    <p className="text-[10px] uppercase font-bold text-surface-400 flex items-center gap-1">
                                        <item.icon className="w-3 h-3" /> {item.label}
                                    </p>
                                    <p className={`text-sm font-black mt-0.5 ${item.mono ? 'font-mono' : ''} ${item.accent ? 'text-accent-700' : item.success ? 'text-success-700' : 'text-surface-800'}`}>
                                        {item.value}
                                    </p>
                                </div>
                            ))}
                        </div>

                        {/* Scan again */}
                        <button
                            onClick={() => { setProduct(null); setBarcode(''); }}
                            className="w-full py-2.5 rounded-xl bg-surface-100 hover:bg-surface-200 text-surface-600 font-semibold text-sm transition-colors flex items-center justify-center gap-2"
                        >
                            <ScanBarcode className="w-4 h-4" /> Quét sản phẩm khác
                        </button>
                    </div>
                </div>
            )}

            {/* Scan History */}
            {scanHistory.length > 0 && !product && (
                <div className="space-y-2">
                    <h3 className="text-xs font-bold text-surface-400 uppercase tracking-wider">Đã quét gần đây</h3>
                    {scanHistory.map(p => (
                        <button
                            key={p.id}
                            onClick={() => { setProduct(p); setBarcode(p.barcode || p.companyCode || ''); }}
                            className="w-full bg-white rounded-xl border border-surface-200 p-3 flex items-center gap-3 hover:bg-primary-50/30 transition-colors text-left group"
                        >
                            {p.image ? (
                                <img src={p.image} alt="" className="w-10 h-10 rounded-lg object-cover border border-surface-200" />
                            ) : (
                                <div className="w-10 h-10 rounded-lg bg-surface-100 flex items-center justify-center shrink-0">
                                    <Package className="w-4 h-4 text-surface-400" />
                                </div>
                            )}
                            <div className="flex-1 min-w-0">
                                <p className="text-sm font-bold text-surface-800 truncate group-hover:text-primary-700 transition-colors">{p.name}</p>
                                <p className="text-[11px] text-surface-400 font-mono">{p.companyCode || p.barcode}</p>
                            </div>
                        </button>
                    ))}
                </div>
            )}

            {/* Camera Scanner Modal — auto-start enabled */}
            {showScanner && (
                <BarcodeScanner
                    onScanSuccess={handleCameraScan}
                    onClose={() => setShowScanner(false)}
                    autoStart
                />
            )}

            {/* Image Lightbox */}
            {lightboxImage && (
                <Portal>
                    <div
                        className="fixed inset-0 z-[120] bg-black/90 backdrop-blur-md flex items-center justify-center p-4 cursor-zoom-out animate-in fade-in duration-200"
                        onClick={() => setLightboxImage(null)}
                    >
                        <button
                            onClick={() => setLightboxImage(null)}
                            className="absolute top-4 right-4 z-10 w-10 h-10 bg-white/10 hover:bg-white/20 text-white rounded-full flex items-center justify-center transition-colors"
                        >
                            <X className="w-5 h-5" />
                        </button>
                        <img
                            src={lightboxImage}
                            alt="Product full size"
                            className="max-w-full max-h-[85vh] object-contain rounded-lg shadow-2xl animate-in zoom-in-95 duration-300"
                            onClick={e => e.stopPropagation()}
                        />
                    </div>
                </Portal>
            )}
        </div>
    );
}
