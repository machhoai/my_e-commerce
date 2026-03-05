'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Download, Plus, Trash2, Send, CheckCircle2, AlertCircle, Package } from 'lucide-react';
import type { ProductDoc } from '@/types/inventory';

interface ImportItem {
    productId: string;
    productName: string;
    unit: string;
    quantity: number;
}

export default function ImportPage() {
    const { user, userDoc } = useAuth();
    const [products, setProducts] = useState<ProductDoc[]>([]);
    const [items, setItems] = useState<ImportItem[]>([]);
    const [selectedProduct, setSelectedProduct] = useState('');
    const [qty, setQty] = useState<number>(1);
    const [note, setNote] = useState('');
    const [submitting, setSubmitting] = useState(false);
    const [message, setMessage] = useState({ type: '', text: '' });

    const getToken = useCallback(() => user?.getIdToken(), [user]);

    if (userDoc && userDoc.role !== 'admin') {
        return <div className="flex items-center justify-center h-64 text-red-500 font-bold">Chỉ quản trị viên.</div>;
    }

    // Fetch products
    useEffect(() => {
        if (!user) return;
        (async () => {
            try {
                const token = await getToken();
                const res = await fetch('/api/inventory/products', { headers: { Authorization: `Bearer ${token}` } });
                const data = await res.json();
                setProducts(Array.isArray(data) ? data : []);
            } catch { /* silent */ }
        })();
    }, [user, getToken]);

    const addItem = () => {
        if (!selectedProduct || qty <= 0) return;
        const prod = products.find(p => p.id === selectedProduct);
        if (!prod) return;
        if (items.find(i => i.productId === selectedProduct)) {
            setMessage({ type: 'error', text: 'Sản phẩm đã có trong danh sách' });
            return;
        }
        setItems([...items, { productId: prod.id, productName: prod.name, unit: prod.unit, quantity: qty }]);
        setSelectedProduct('');
        setQty(1);
        setMessage({ type: '', text: '' });
    };

    const removeItem = (productId: string) => {
        setItems(items.filter(i => i.productId !== productId));
    };

    const handleSubmit = async () => {
        if (!items.length) {
            setMessage({ type: 'error', text: 'Vui lòng thêm sản phẩm vào phiếu nhập' });
            return;
        }
        setSubmitting(true);
        setMessage({ type: '', text: '' });
        try {
            const token = await getToken();
            const res = await fetch('/api/inventory/import', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
                body: JSON.stringify({ items, note }),
            });
            if (!res.ok) throw new Error((await res.json()).error);
            const data = await res.json();
            setMessage({ type: 'success', text: `Đã nhập kho thành công! (Mã: ${data.batchId})` });
            setItems([]);
            setNote('');
        } catch (err: any) {
            setMessage({ type: 'error', text: err.message || 'Có lỗi xảy ra' });
        } finally { setSubmitting(false); }
    };

    const totalItems = items.reduce((sum, i) => sum + i.quantity, 0);

    return (
        <div className="space-y-6 mx-auto">
            <div>
                <h1 className="text-2xl font-bold bg-gradient-to-r from-blue-600 to-cyan-600 bg-clip-text text-transparent flex items-center gap-2">
                    <Download className="w-7 h-7 text-blue-600" />
                    Nhập kho tổng
                </h1>
                <p className="text-slate-500 mt-1">Tạo phiếu nhập hàng vào kho trung tâm.</p>
            </div>

            {message.text && (
                <div className={`p-3 rounded-xl flex items-center gap-2 border text-sm font-medium ${message.type === 'error' ? 'bg-red-50 text-red-700 border-red-200' : 'bg-emerald-50 text-emerald-700 border-emerald-200'}`}>
                    {message.type === 'error' ? <AlertCircle className="w-4 h-4" /> : <CheckCircle2 className="w-4 h-4" />}
                    {message.text}
                </div>
            )}

            {/* Add item form */}
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 space-y-4">
                <h2 className="font-bold text-slate-800">Thêm sản phẩm vào phiếu nhập</h2>
                <div className="flex flex-col sm:flex-row gap-3">
                    <select value={selectedProduct} onChange={e => setSelectedProduct(e.target.value)}
                        className="flex-1 bg-slate-50 border border-slate-200 rounded-lg p-2.5 text-sm outline-none focus:ring-2 focus:ring-blue-300">
                        <option value="">-- Chọn sản phẩm --</option>
                        {products.map(p => <option key={p.id} value={p.id}>{p.name} ({p.unit})</option>)}
                    </select>
                    <input type="number" min={1} value={qty} onChange={e => setQty(Number(e.target.value))}
                        className="w-24 bg-slate-50 border border-slate-200 rounded-lg p-2.5 text-sm text-center outline-none focus:ring-2 focus:ring-blue-300"
                        placeholder="SL" />
                    <button onClick={addItem}
                        className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2.5 rounded-lg text-sm font-medium flex items-center gap-1.5 transition-colors">
                        <Plus className="w-4 h-4" /> Thêm
                    </button>
                </div>

                {items.length > 0 && (
                    <div className="space-y-3">
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm">
                                <thead>
                                    <tr className="text-left text-xs text-slate-500 uppercase border-b">
                                        <th className="py-2 pr-4">Sản phẩm</th>
                                        <th className="py-2 pr-4">ĐVT</th>
                                        <th className="py-2 pr-4 text-right">Số lượng</th>
                                        <th className="py-2 w-10"></th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {items.map(item => (
                                        <tr key={item.productId} className="border-b border-slate-100">
                                            <td className="py-2.5 pr-4 font-medium text-slate-700">{item.productName}</td>
                                            <td className="py-2.5 pr-4 text-slate-500">{item.unit}</td>
                                            <td className="py-2.5 pr-4 text-right font-bold">{item.quantity}</td>
                                            <td className="py-2.5">
                                                <button onClick={() => removeItem(item.productId)}
                                                    className="text-slate-400 hover:text-red-500 p-1 rounded transition-colors">
                                                    <Trash2 className="w-4 h-4" />
                                                </button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>

                        <div className="flex items-center justify-between text-sm bg-slate-50 rounded-lg px-4 py-2">
                            <span className="text-slate-500">Tổng cộng:</span>
                            <span className="font-bold text-slate-800">{items.length} sản phẩm — {totalItems} đơn vị</span>
                        </div>

                        <textarea value={note} onChange={e => setNote(e.target.value)} rows={2}
                            placeholder="Ghi chú phiếu nhập (VD: Nhập đợt tháng 3, NCC ABC)..."
                            className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2.5 text-sm outline-none focus:ring-2 focus:ring-blue-300 resize-none" />

                        <button onClick={handleSubmit} disabled={submitting}
                            className="w-full bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-700 hover:to-cyan-700 text-white py-3 rounded-xl font-bold text-sm flex items-center justify-center gap-2 transition-all disabled:opacity-50 shadow-md shadow-blue-500/20">
                            {submitting ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> : <Send className="w-4 h-4" />}
                            Xác nhận nhập kho
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
}
