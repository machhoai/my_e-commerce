'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useParams, useSearchParams } from 'next/navigation';
import { PackageCheck, AlertCircle, CheckCircle2, ShieldAlert, Package, Loader2 } from 'lucide-react';
import type { PurchaseOrderDoc, PurchaseOrderItem } from '@/types/inventory';

interface ReceiveItem extends PurchaseOrderItem {
    receivedQty: number;
}

export default function ReceiveOrderPage() {
    const { user } = useAuth();
    const params = useParams();
    const searchParams = useSearchParams();
    const orderId = params.orderId as string;
    const qrToken = searchParams.get('token') || '';

    const [order, setOrder] = useState<PurchaseOrderDoc | null>(null);
    const [receiveItems, setReceiveItems] = useState<ReceiveItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');
    const [discrepancies, setDiscrepancies] = useState<string[]>([]);

    const getToken = useCallback(() => user?.getIdToken(), [user]);

    // Fetch order and validate
    useEffect(() => {
        if (!user || !orderId) return;
        (async () => {
            setLoading(true);
            setError('');
            try {
                const token = await getToken();
                const res = await fetch(`/api/inventory/orders?id=${orderId}`, {
                    headers: { Authorization: `Bearer ${token}` },
                });
                const data = await res.json();

                // Find the specific order
                const orders = Array.isArray(data) ? data : [];
                const found = orders.find((o: PurchaseOrderDoc) => o.id === orderId);

                if (!found) {
                    setError('Không tìm thấy đơn hàng');
                    return;
                }

                // Validate QR token
                if (found.qrCodeToken !== qrToken) {
                    setError('Mã QR không hợp lệ hoặc đã hết hạn. Vui lòng liên hệ kho trung tâm.');
                    return;
                }

                // Validate status
                if (found.status !== 'IN_TRANSIT') {
                    if (found.status === 'COMPLETED') {
                        setError('Đơn hàng này đã được xác nhận nhận hàng trước đó.');
                    } else {
                        setError(`Đơn hàng không ở trạng thái vận chuyển (hiện tại: ${found.status}).`);
                    }
                    return;
                }

                setOrder(found);
                setReceiveItems(
                    found.items.map((item: PurchaseOrderItem) => ({
                        ...item,
                        receivedQty: item.dispatchedQty ?? item.approvedQty ?? item.requestedQty,
                    }))
                );
            } catch (err: any) {
                setError(err.message || 'Có lỗi khi tải đơn hàng');
            } finally {
                setLoading(false);
            }
        })();
    }, [user, orderId, qrToken, getToken]);

    const handleSubmit = async () => {
        if (!order) return;
        setSubmitting(true);
        setError('');
        setSuccess('');

        try {
            const token = await getToken();
            const res = await fetch('/api/inventory/receive', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
                body: JSON.stringify({
                    orderId: order.id,
                    qrCodeToken: qrToken,
                    receivedItems: receiveItems.map(item => ({
                        productId: item.productId,
                        receivedQty: item.receivedQty,
                    })),
                }),
            });

            const data = await res.json();
            if (!res.ok) throw new Error(data.error);

            setSuccess('Đã xác nhận nhận hàng thành công! Tồn kho cửa hàng đã được cập nhật.');
            if (data.discrepancies?.length) {
                setDiscrepancies(data.discrepancies);
            }
            setOrder(null); // Prevent re-submit
        } catch (err: any) {
            setError(err.message || 'Có lỗi xảy ra');
        } finally {
            setSubmitting(false);
        }
    };

    if (loading) {
        return (
            <div className="flex flex-col items-center justify-center py-24 space-y-4">
                <Loader2 className="w-8 h-8 text-indigo-500 animate-spin" />
                <p className="text-sm text-slate-500">Đang xác thực mã QR và tải đơn hàng...</p>
            </div>
        );
    }

    // Token/status validation error
    if (error && !order) {
        return (
            <div className="max-w-md mx-auto mt-12">
                <div className="bg-red-50 border-2 border-red-200 rounded-2xl p-8 text-center space-y-4">
                    <ShieldAlert className="w-16 h-16 text-red-400 mx-auto" />
                    <h1 className="text-xl font-bold text-red-700">Mã QR không hợp lệ</h1>
                    <p className="text-sm text-red-600">{error}</p>
                </div>
            </div>
        );
    }

    // Success state
    if (success) {
        return (
            <div className="max-w-md mx-auto mt-12">
                <div className="bg-emerald-50 border-2 border-emerald-200 rounded-2xl p-8 text-center space-y-4">
                    <CheckCircle2 className="w-16 h-16 text-emerald-500 mx-auto" />
                    <h1 className="text-xl font-bold text-emerald-700">Nhận hàng thành công!</h1>
                    <p className="text-sm text-emerald-600">{success}</p>
                    {discrepancies.length > 0 && (
                        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-left mt-4">
                            <p className="text-sm font-bold text-amber-700 mb-2">⚠️ Chênh lệch ghi nhận:</p>
                            <ul className="space-y-1">
                                {discrepancies.map((d, i) => (
                                    <li key={i} className="text-xs text-amber-600">• {d}</li>
                                ))}
                            </ul>
                        </div>
                    )}
                </div>
            </div>
        );
    }

    if (!order) return null;

    return (
        <div className="space-y-6 mx-auto max-w-2xl">
            <div>
                <h1 className="text-2xl font-bold bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent flex items-center gap-2">
                    <PackageCheck className="w-7 h-7 text-blue-600" />
                    Xác nhận nhận hàng
                </h1>
                <p className="text-slate-500 mt-1">
                    Kiểm tra số lượng thực nhận và xác nhận. Tồn kho sẽ được cập nhật sau khi bạn xác nhận.
                </p>
            </div>

            {/* Order info */}
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 space-y-2">
                <div className="flex items-center gap-2 mb-3">
                    <Package className="w-5 h-5 text-indigo-500" />
                    <h2 className="font-bold text-slate-800">Thông tin đơn hàng</h2>
                </div>
                <div className="grid grid-cols-2 gap-2 text-sm">
                    <div className="text-slate-500">Mã đơn:</div>
                    <div className="font-mono text-xs text-slate-700 truncate">{order.id}</div>
                    <div className="text-slate-500">Cửa hàng:</div>
                    <div className="font-medium text-slate-700">{order.storeName || order.storeId}</div>
                    <div className="text-slate-500">Người đặt:</div>
                    <div className="text-slate-700">{order.createdByName}</div>
                    <div className="text-slate-500">Ngày xuất kho:</div>
                    <div className="text-slate-700">{order.dispatchedAt ? new Date(order.dispatchedAt).toLocaleString('vi-VN') : '—'}</div>
                </div>
                <div className="mt-2">
                    <span className="inline-flex items-center gap-1.5 text-blue-700 bg-blue-100 px-2.5 py-1 rounded-lg text-xs font-bold border border-blue-200">
                        🚚 Đang vận chuyển
                    </span>
                </div>
            </div>

            {error && (
                <div className="bg-red-50 text-red-700 p-3 rounded-xl text-sm border border-red-200 flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 shrink-0" /> {error}
                </div>
            )}

            {/* Items table */}
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                <div className="p-4 border-b border-slate-100">
                    <h2 className="font-bold text-slate-800">Danh sách sản phẩm</h2>
                    <p className="text-xs text-slate-400 mt-1">Điều chỉnh "Số thực nhận" nếu có chênh lệch với số thực xuất.</p>
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                        <thead>
                            <tr className="text-left text-xs text-slate-500 uppercase bg-slate-50 border-b">
                                <th className="px-6 py-3">Sản phẩm</th>
                                <th className="px-4 py-3">ĐVT</th>
                                <th className="px-4 py-3 text-right">Yêu cầu</th>
                                <th className="px-4 py-3 text-right">Thực xuất</th>
                                <th className="px-4 py-3 text-right">Thực nhận</th>
                            </tr>
                        </thead>
                        <tbody>
                            {receiveItems.map((item, idx) => {
                                const dispatched = item.dispatchedQty ?? item.approvedQty ?? item.requestedQty;
                                const hasDiscrepancy = item.receivedQty !== dispatched;
                                return (
                                    <tr key={item.productId} className={`border-b border-slate-100 ${hasDiscrepancy ? 'bg-amber-50/50' : ''}`}>
                                        <td className="px-6 py-3 font-medium text-slate-700">{item.productName}</td>
                                        <td className="px-4 py-3 text-slate-500">{item.unit}</td>
                                        <td className="px-4 py-3 text-right text-slate-500">{item.requestedQty}</td>
                                        <td className="px-4 py-3 text-right font-bold text-slate-700">{dispatched}</td>
                                        <td className="px-4 py-3 text-right">
                                            <input
                                                type="number"
                                                min={0}
                                                value={item.receivedQty}
                                                onChange={e => {
                                                    const updated = [...receiveItems];
                                                    updated[idx] = { ...updated[idx], receivedQty: Number(e.target.value) || 0 };
                                                    setReceiveItems(updated);
                                                }}
                                                className={`w-20 border rounded-lg p-2 text-sm text-center font-bold outline-none focus:ring-2 ${hasDiscrepancy
                                                    ? 'border-amber-300 bg-amber-50 focus:ring-amber-300 text-amber-700'
                                                    : 'border-slate-200 bg-white focus:ring-blue-300'
                                                    }`}
                                            />
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>

                {/* Discrepancy summary */}
                {receiveItems.some(item => {
                    const dispatched = item.dispatchedQty ?? item.approvedQty ?? item.requestedQty;
                    return item.receivedQty !== dispatched;
                }) && (
                        <div className="p-4 bg-amber-50 border-t border-amber-200">
                            <p className="text-xs text-amber-700 font-medium">
                                ⚠️ Có chênh lệch giữa số thực xuất và số thực nhận. Chênh lệch sẽ được ghi nhận vào đơn hàng.
                            </p>
                        </div>
                    )}
            </div>

            <button
                onClick={handleSubmit}
                disabled={submitting}
                className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white py-4 rounded-xl font-bold text-sm flex items-center justify-center gap-2 transition-all disabled:opacity-50 shadow-md shadow-blue-500/20"
            >
                {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <PackageCheck className="w-5 h-5" />}
                Xác nhận nhận hàng
            </button>
        </div>
    );
}
