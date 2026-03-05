'use client';

import { useState, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useCounterAssignment } from '@/hooks/useCounterAssignment';
import { ScanBarcode, Lock, CheckCircle2, AlertCircle, Package, Send, Minus, Plus } from 'lucide-react';
import type { ProductDoc } from '@/types/inventory';

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
                <div className="w-8 h-8 border-4 border-slate-300 border-t-indigo-600 rounded-full animate-spin" />
            </div>
        );
    }

    // ── Locked state ──
    if (!assignment.isAuthorized) {
        return (
            <div className="space-y-6 mx-auto">
                <div>
                    <h1 className="text-2xl font-bold bg-gradient-to-r from-orange-600 to-red-600 bg-clip-text text-transparent flex items-center gap-2">
                        <ScanBarcode className="w-7 h-7 text-orange-600" />
                        Quét mã vạch — Sử dụng hàng
                    </h1>
                </div>

                <div className="bg-gradient-to-br from-red-50 to-orange-50 border-2 border-red-200 rounded-2xl p-8 text-center space-y-4">
                    <div className="w-16 h-16 mx-auto bg-red-100 rounded-full flex items-center justify-center">
                        <Lock className="w-8 h-8 text-red-500" />
                    </div>
                    <h2 className="text-xl font-bold text-red-700">Đã khoá</h2>
                    <p className="text-red-600 max-w-md mx-auto leading-relaxed">
                        {assignment.error || 'Bạn không được phân công trực tại quầy nào hôm nay. Quét mã vạch và ghi nhận sử dụng bị khoá.'}
                    </p>
                    <div className="pt-2">
                        <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-red-500 bg-red-100 border border-red-200 px-3 py-1.5 rounded-full">
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
            <div>
                <h1 className="text-2xl font-bold bg-gradient-to-r from-indigo-600 to-blue-600 bg-clip-text text-transparent flex items-center gap-2">
                    <ScanBarcode className="w-7 h-7 text-indigo-600" />
                    Quét mã vạch — Sử dụng hàng
                </h1>
                <p className="text-slate-500 mt-1">
                    Đang trực tại <strong className="text-indigo-600">{assignment.counterName}</strong> — {assignment.shiftId}
                </p>
            </div>

            {/* Status indicator */}
            <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3 text-sm text-emerald-700 flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 shrink-0" />
                <span>Bạn đã được phân công tại <strong>{assignment.counterName}</strong>. Sẵn sàng quét mã vạch.</span>
            </div>

            {/* Barcode Input */}
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 space-y-4">
                <label className="block text-sm font-semibold text-slate-700">Mã vạch sản phẩm</label>
                <div className="flex gap-2">
                    <div className="flex-1 relative">
                        <ScanBarcode className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                        <input
                            id="barcode-input"
                            type="text"
                            value={barcode}
                            onChange={e => setBarcode(e.target.value)}
                            onKeyDown={handleBarcodeKeyDown}
                            placeholder="Quét hoặc nhập mã vạch..."
                            autoFocus
                            className="w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-indigo-300 focus:border-indigo-300 transition-all"
                        />
                    </div>
                    <button
                        onClick={() => lookupBarcode(barcode)}
                        disabled={lookupLoading || !barcode.trim()}
                        className="px-5 py-3 bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-300 text-white rounded-xl font-bold text-sm transition-colors"
                    >
                        {lookupLoading ? '...' : 'Tra cứu'}
                    </button>
                </div>
            </div>

            {/* Product Card */}
            {product && (
                <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 space-y-5">
                    <div className="flex items-center gap-4">
                        {product.image ? (
                            <img src={product.image} alt="" className="w-16 h-16 rounded-xl object-cover border border-slate-200" />
                        ) : (
                            <div className="w-16 h-16 rounded-xl bg-slate-100 flex items-center justify-center">
                                <Package className="w-6 h-6 text-slate-400" />
                            </div>
                        )}
                        <div className="flex-1 min-w-0">
                            <h3 className="font-bold text-lg text-slate-800 truncate">{product.name}</h3>
                            <p className="text-sm text-slate-500">Mã vạch: {product.barcode} · ĐVT: {product.unit}</p>
                        </div>
                    </div>

                    {/* Quantity */}
                    <div>
                        <label className="block text-sm font-semibold text-slate-700 mb-2">Số lượng sử dụng</label>
                        <div className="flex items-center gap-3">
                            <button onClick={() => setQuantity(q => Math.max(1, q - 1))}
                                className="w-10 h-10 rounded-xl bg-slate-100 hover:bg-slate-200 flex items-center justify-center transition-colors">
                                <Minus className="w-4 h-4" />
                            </button>
                            <input type="number" min={1} value={quantity} onChange={e => setQuantity(Math.max(1, Number(e.target.value)))}
                                className="w-20 text-center text-lg font-bold bg-slate-50 border border-slate-200 rounded-xl py-2 outline-none focus:ring-2 focus:ring-indigo-300" />
                            <button onClick={() => setQuantity(q => q + 1)}
                                className="w-10 h-10 rounded-xl bg-slate-100 hover:bg-slate-200 flex items-center justify-center transition-colors">
                                <Plus className="w-4 h-4" />
                            </button>
                        </div>
                    </div>

                    {/* Note */}
                    <div>
                        <label className="block text-sm font-semibold text-slate-700 mb-2">Ghi chú (tuỳ chọn)</label>
                        <input type="text" value={note} onChange={e => setNote(e.target.value)} placeholder="VD: Hết hạn, hư hỏng..."
                            className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-sm outline-none focus:ring-2 focus:ring-indigo-300" />
                    </div>

                    {/* Submit */}
                    <button onClick={handleSubmit} disabled={loading}
                        className="w-full bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-700 hover:to-blue-700 disabled:from-slate-400 disabled:to-slate-400 text-white py-3 rounded-xl font-bold text-sm flex items-center justify-center gap-2 transition-all shadow-md">
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
                    ? 'bg-red-50 text-red-700 border-red-200'
                    : 'bg-emerald-50 text-emerald-700 border-emerald-200'
                    }`}>
                    {message.type === 'error' ? <AlertCircle className="w-4 h-4 shrink-0" /> : <CheckCircle2 className="w-4 h-4 shrink-0" />}
                    {message.text}
                </div>
            )}
        </div>
    );
}
