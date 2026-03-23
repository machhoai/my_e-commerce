'use client';

import { useState, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useCounterAssignment } from '@/hooks/useCounterAssignment';
import { ScanBarcode, Lock, CheckCircle2, AlertCircle, Package, Send, Minus, Plus, Camera } from 'lucide-react';
import type { ProductDoc } from '@/types/inventory';
import dynamic from 'next/dynamic';
import { DashboardHeader } from '@/components/inventory/overview/DashboardHeader';

const BarcodeScanner = dynamic(() => import('@/components/inventory/BarcodeScanner'), { ssr: false });

export default function EmployeeUsagePage() {
    const { user } = useAuth();
    const assignment = useCounterAssignment();

    const [barcode, setBarcode] = useState('');
    const [product, setProduct] = useState<ProductDoc | null>(null);
    const [quantity, setQuantity] = useState(1);
    const [note, setNote] = useState('');
    const [loading, setLoading] = useState(false);
    const [lookupLoading, setLookupLoading] = useState(false);
    const [message, setMessage] = useState({ type: '', text: '' });
    const [showScanner, setShowScanner] = useState(false);

    const getToken = useCallback(() => user?.getIdToken(), [user]);

    // Look up product by barcode
    const lookupBarcode = async (code: string) => {
        if (!code.trim() || !user) return;
        setLookupLoading(true);
        setProduct(null);
        setMessage({ type: '', text: '' });
        try {
            const token = await getToken();
            const res = await fetch(`/api/inventory/products?barcode=${encodeURIComponent(code.trim())}`, {
                headers: { Authorization: `Bearer ${token}` },
            });
            const data = await res.json();
            const products: ProductDoc[] = Array.isArray(data) ? data : [];
            const found = products.find(p => p.barcode === code.trim());
            if (found) {
                setProduct(found);
                setQuantity(1);
            } else {
                setMessage({ type: 'error', text: `Không tìm thấy sản phẩm với mã vạch: ${code}` });
            }
        } catch {
            setMessage({ type: 'error', text: 'Lỗi tra cứu sản phẩm' });
        } finally {
            setLookupLoading(false);
        }
    };

    const handleBarcodeKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
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

    const handleSubmit = async () => {
        if (!product || !assignment.counterId) return;
        setLoading(true);
        setMessage({ type: '', text: '' });
        try {
            const token = await getToken();
            const res = await fetch('/api/inventory/usage', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
                body: JSON.stringify({
                    counterId: assignment.counterId,
                    productId: product.id,
                    quantity,
                    note,
                }),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error);
            setMessage({ type: 'success', text: data.message || 'Đã ghi nhận sử dụng!' });
            setProduct(null);
            setBarcode('');
            setQuantity(1);
            setNote('');
        } catch (err: any) {
            setMessage({ type: 'error', text: err.message || 'Có lỗi xảy ra' });
        } finally {
            setLoading(false);
        }
    };

    // ── Loading state ──
    if (assignment.loading) {
        return (
            <div className="flex justify-center py-20">
                <div className="w-8 h-8 border-4 border-surface-300 border-t-accent-600 rounded-full animate-spin" />
            </div>
        );
    }

    // ── Locked state ──
    if (!assignment.isAuthorized) {
        return (
            <div className="space-y-6 mx-auto">
                <div>
                    <h1 className="text-2xl font-bold bg-gradient-to-r from-accent-600 to-danger-600 bg-clip-text text-transparent flex items-center gap-2">
                        <ScanBarcode className="w-7 h-7 text-accent-600" />
                        Quét mã vạch — Sử dụng hàng
                    </h1>
                </div>

                <div className="bg-gradient-to-br from-danger-50 to-accent-50 border-2 border-danger-200 rounded-2xl p-8 text-center space-y-4">
                    <div className="w-16 h-16 mx-auto bg-danger-100 rounded-full flex items-center justify-center">
                        <Lock className="w-8 h-8 text-danger-500" />
                    </div>
                    <h2 className="text-xl font-bold text-danger-700">Đã khoá</h2>
                    <p className="text-danger-600 max-w-md mx-auto leading-relaxed">
                        {assignment.error || 'Bạn không được phân công trực tại quầy nào hôm nay. Quét mã vạch và ghi nhận sử dụng bị khoá.'}
                    </p>
                    <div className="pt-2">
                        <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-danger-500 bg-danger-100 border border-danger-200 px-3 py-1.5 rounded-full">
                            <Lock className="w-3 h-3" />
                            Chức năng bị khoá
                        </span>
                    </div>
                </div>
            </div>
        );
    }

    // ── Authorized state ──
    return (
        <div className="space-y-6 mx-auto">
            <DashboardHeader
                showSelect={false}
                titleChildren={
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 w-full">
                        <div>
                            <h1 className="text-2xl font-bold bg-gradient-to-r from-accent-600 to-primary-600 bg-clip-text text-transparent flex items-center gap-2">
                                <ScanBarcode className="w-7 h-7 text-accent-600" />
                                Quét mã vạch — Sử dụng hàng
                            </h1>
                            <p className="text-surface-500 mt-1 text-sm">
                                Đang trực tại <strong className="text-accent-600">{assignment.counterName}</strong> — {assignment.shiftId}
                            </p>
                        </div>
                    </div>
                }
            />

            {/* Status indicator */}
            <div className="bg-success-50 border border-success-200 rounded-xl p-3 text-sm text-success-700 flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 shrink-0" />
                <span>Bạn đã được phân công tại <strong>{assignment.counterName}</strong>. Sẵn sàng quét mã vạch.</span>
            </div>

            {/* Barcode Input */}
            <div className="bg-white rounded-2xl border border-surface-200 shadow-sm p-6 space-y-4">
                <label className="block text-sm font-semibold text-surface-700">Mã vạch sản phẩm</label>
                <div className="flex gap-2">
                    <div className="flex-1 relative">
                        <ScanBarcode className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-surface-400" />
                        <input
                            id="barcode-input"
                            type="text"
                            value={barcode}
                            onChange={e => setBarcode(e.target.value)}
                            onKeyDown={handleBarcodeKeyDown}
                            placeholder="Quét hoặc nhập mã vạch..."
                            autoFocus
                            className="w-full pl-10 pr-4 py-3 bg-surface-50 border border-surface-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-accent-300 focus:border-accent-300 transition-all"
                        />
                    </div>
                    <button
                        onClick={() => setShowScanner(true)}
                        className="p-3 bg-warning-500 hover:bg-warning-600 text-white rounded-xl transition-colors"
                        title="Quét bằng camera"
                    >
                        <Camera className="w-5 h-5" />
                    </button>
                    <button
                        onClick={() => lookupBarcode(barcode)}
                        disabled={lookupLoading || !barcode.trim()}
                        className="px-5 py-3 bg-accent-600 hover:bg-accent-700 disabled:bg-surface-300 text-white rounded-xl font-bold text-sm transition-colors"
                    >
                        {lookupLoading ? '...' : 'Tra cứu'}
                    </button>
                </div>
            </div>

            {/* Product Card */}
            {product && (
                <div className="bg-white rounded-2xl border border-surface-200 shadow-sm p-6 space-y-5">
                    <div className="flex items-center gap-4">
                        {product.image ? (
                            <img src={product.image} alt="" className="w-16 h-16 rounded-xl object-cover border border-surface-200" />
                        ) : (
                            <div className="w-16 h-16 rounded-xl bg-surface-100 flex items-center justify-center">
                                <Package className="w-6 h-6 text-surface-400" />
                            </div>
                        )}
                        <div className="flex-1 min-w-0">
                            <h3 className="font-bold text-lg text-surface-800 truncate">{product.name}</h3>
                            <p className="text-sm text-surface-500">Mã vạch: {product.barcode} · ĐVT: {product.unit}</p>
                        </div>
                    </div>

                    {/* Quantity */}
                    <div>
                        <label className="block text-sm font-semibold text-surface-700 mb-2">Số lượng sử dụng</label>
                        <div className="flex items-center gap-3">
                            <button onClick={() => setQuantity(q => Math.max(1, q - 1))}
                                className="w-10 h-10 rounded-xl bg-surface-100 hover:bg-surface-200 flex items-center justify-center transition-colors">
                                <Minus className="w-4 h-4" />
                            </button>
                            <input type="number" min={1} value={quantity} onChange={e => setQuantity(Math.max(1, Number(e.target.value)))}
                                className="w-20 text-center text-lg font-bold bg-surface-50 border border-surface-200 rounded-xl py-2 outline-none focus:ring-2 focus:ring-accent-300" />
                            <button onClick={() => setQuantity(q => q + 1)}
                                className="w-10 h-10 rounded-xl bg-surface-100 hover:bg-surface-200 flex items-center justify-center transition-colors">
                                <Plus className="w-4 h-4" />
                            </button>
                        </div>
                    </div>

                    {/* Note */}
                    <div>
                        <label className="block text-sm font-semibold text-surface-700 mb-2">Ghi chú (tuỳ chọn)</label>
                        <input type="text" value={note} onChange={e => setNote(e.target.value)} placeholder="VD: Hết hạn, hư hỏng..."
                            className="w-full bg-surface-50 border border-surface-200 rounded-xl p-3 text-sm outline-none focus:ring-2 focus:ring-accent-300" />
                    </div>

                    {/* Submit */}
                    <button onClick={handleSubmit} disabled={loading}
                        className="w-full bg-gradient-to-r from-accent-600 to-primary-600 hover:from-accent-700 hover:to-primary-700 disabled:from-surface-400 disabled:to-surface-400 text-white py-3 rounded-xl font-bold text-sm flex items-center justify-center gap-2 transition-all shadow-md">
                        {loading ? (
                            <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                        ) : (
                            <><Send className="w-4 h-4" /> Ghi nhận sử dụng</>
                        )}
                    </button>
                </div>
            )}

            {/* Toast message */}
            {message.text && (
                <div className={`p-4 rounded-xl flex items-center gap-2 border text-sm font-medium ${message.type === 'error'
                    ? 'bg-danger-50 text-danger-700 border-danger-200'
                    : 'bg-success-50 text-success-700 border-success-200'
                    }`}>
                    {message.type === 'error' ? <AlertCircle className="w-4 h-4 shrink-0" /> : <CheckCircle2 className="w-4 h-4 shrink-0" />}
                    {message.text}
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
