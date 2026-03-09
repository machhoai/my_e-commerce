'use client';

import { useState, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import {
    ScanBarcode, Package, Camera, AlertCircle, Tag, Hash,
    Layers, Scale, X, Search,
} from 'lucide-react';
import type { ProductDoc } from '@/types/inventory';
import dynamic from 'next/dynamic';

const BarcodeScanner = dynamic(() => import('@/components/inventory/BarcodeScanner'), { ssr: false });

export default function ProductScanPage() {
    const { user, getToken } = useAuth();
    const [barcode, setBarcode] = useState('');
    const [product, setProduct] = useState<ProductDoc | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [showScanner, setShowScanner] = useState(false);
    const [scanHistory, setScanHistory] = useState<ProductDoc[]>([]);

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

    return (
        <div className="space-y-5 mx-auto max-w-lg pb-24">
            {/* Header */}
            <div>
                <h1 className="text-2xl font-bold bg-gradient-to-r from-violet-600 to-indigo-600 bg-clip-text text-transparent flex items-center gap-2">
                    <ScanBarcode className="w-7 h-7 text-violet-600" />
                    Tra cứu sản phẩm
                </h1>
                <p className="text-slate-500 mt-1 text-sm">
                    Quét mã vạch hoặc QR để xem thông tin sản phẩm.
                </p>
            </div>

            {/* Scan Input */}
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4 space-y-3">
                <div className="flex gap-2">
                    <div className="flex-1 relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                        <input
                            type="text"
                            value={barcode}
                            onChange={e => setBarcode(e.target.value)}
                            onKeyDown={handleKeyDown}
                            placeholder="Quét hoặc nhập mã vạch / QR..."
                            autoFocus
                            className="w-full pl-10 pr-4 py-3.5 bg-slate-50 border border-slate-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-violet-300 transition-all"
                        />
                    </div>
                    <button
                        onClick={() => setShowScanner(true)}
                        className="px-4 bg-gradient-to-br from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white rounded-xl transition-all shadow-md shadow-amber-500/20 active:scale-95"
                        title="Quét bằng camera"
                    >
                        <Camera className="w-5 h-5" />
                    </button>
                </div>

                {/* Quick scan button */}
                <button
                    onClick={() => lookupBarcode(barcode)}
                    disabled={loading || !barcode.trim()}
                    className="w-full bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-700 hover:to-indigo-700 disabled:from-slate-300 disabled:to-slate-400 text-white py-3 rounded-xl font-bold text-sm flex items-center justify-center gap-2 transition-all shadow-md shadow-violet-500/20"
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
                <div className="p-3 rounded-xl flex items-center gap-2 border text-sm font-medium bg-red-50 text-red-700 border-red-200">
                    <AlertCircle className="w-4 h-4 shrink-0" /> {error}
                </div>
            )}

            {/* Product Info Card */}
            {product && (
                <div className="bg-white rounded-2xl border border-slate-200 shadow-lg overflow-hidden animate-in fade-in slide-in-from-bottom-3 duration-300">
                    {/* Product image banner */}
                    {product.image && (
                        <div className="w-full h-48 bg-slate-100 overflow-hidden">
                            <img src={product.image} alt={product.name} className="w-full h-full object-cover" />
                        </div>
                    )}

                    <div className="p-5 space-y-4">
                        {/* Name & category */}
                        <div>
                            <h2 className="text-xl font-black text-slate-800">{product.name}</h2>
                            {product.category && (
                                <span className="inline-flex items-center gap-1 text-xs font-bold text-violet-600 bg-violet-50 border border-violet-200 px-2 py-0.5 rounded-full mt-1">
                                    <Layers className="w-3 h-3" /> {product.category}
                                </span>
                            )}
                        </div>

                        {/* Info grid */}
                        <div className="grid grid-cols-2 gap-3">
                            {product.barcode && (
                                <div className="bg-slate-50 rounded-xl p-3 border border-slate-100">
                                    <p className="text-[10px] uppercase font-bold text-slate-400 flex items-center gap-1">
                                        <ScanBarcode className="w-3 h-3" /> Mã vạch
                                    </p>
                                    <p className="text-sm font-black text-slate-800 mt-0.5 font-mono">{product.barcode}</p>
                                </div>
                            )}
                            {product.companyCode && (
                                <div className="bg-slate-50 rounded-xl p-3 border border-slate-100">
                                    <p className="text-[10px] uppercase font-bold text-slate-400 flex items-center gap-1">
                                        <Hash className="w-3 h-3" /> Mã nội bộ
                                    </p>
                                    <p className="text-sm font-black text-indigo-700 mt-0.5 font-mono">{product.companyCode}</p>
                                </div>
                            )}
                            <div className="bg-slate-50 rounded-xl p-3 border border-slate-100">
                                <p className="text-[10px] uppercase font-bold text-slate-400 flex items-center gap-1">
                                    <Scale className="w-3 h-3" /> Đơn vị tính
                                </p>
                                <p className="text-sm font-bold text-slate-800 mt-0.5">{product.unit || '—'}</p>
                            </div>
                            {product.actualPrice != null && (
                                <div className="bg-slate-50 rounded-xl p-3 border border-slate-100">
                                    <p className="text-[10px] uppercase font-bold text-slate-400 flex items-center gap-1">
                                        <Tag className="w-3 h-3" /> Giá bán
                                    </p>
                                    <p className="text-sm font-black text-emerald-700 mt-0.5">
                                        {product.actualPrice.toLocaleString('vi-VN')}đ
                                    </p>
                                </div>
                            )}
                        </div>

                        {/* Description */}
                        {product.origin && (
                            <div className="bg-amber-50 rounded-xl p-3 border border-amber-100">
                                <p className="text-xs text-amber-800"><strong>Xuất xứ:</strong> {product.origin}</p>
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* Scan History */}
            {scanHistory.length > 0 && !product && (
                <div className="space-y-2">
                    <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Đã quét gần đây</h3>
                    {scanHistory.map(p => (
                        <button
                            key={p.id}
                            onClick={() => { setProduct(p); setBarcode(p.barcode || p.companyCode || ''); }}
                            className="w-full bg-white rounded-xl border border-slate-200 p-3 flex items-center gap-3 hover:bg-slate-50 transition-colors text-left"
                        >
                            {p.image ? (
                                <img src={p.image} alt="" className="w-10 h-10 rounded-lg object-cover border border-slate-200" />
                            ) : (
                                <div className="w-10 h-10 rounded-lg bg-slate-100 flex items-center justify-center shrink-0">
                                    <Package className="w-4 h-4 text-slate-400" />
                                </div>
                            )}
                            <div className="flex-1 min-w-0">
                                <p className="text-sm font-bold text-slate-800 truncate">{p.name}</p>
                                <p className="text-[11px] text-slate-400 font-mono">{p.companyCode || p.barcode}</p>
                            </div>
                        </button>
                    ))}
                </div>
            )}

            {/* Camera Scanner Modal */}
            {showScanner && (
                <BarcodeScanner
                    onScanSuccess={handleCameraScan}
                    onClose={() => setShowScanner(false)}
                />
            )}
        </div>
    );
}
