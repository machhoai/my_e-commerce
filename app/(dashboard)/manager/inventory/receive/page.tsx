'use client';

import { useState, useEffect, useCallback, Suspense } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { PackageCheck, Truck, CheckCircle2, Clock, ExternalLink } from 'lucide-react';
import type { PurchaseOrderDoc } from '@/types/inventory';
import Link from 'next/link';

const STATUS_BADGE: Record<string, string> = {
    PENDING: 'bg-amber-100 text-amber-700 border-amber-200',
    IN_TRANSIT: 'bg-blue-100 text-blue-700 border-blue-200',
    COMPLETED: 'bg-emerald-100 text-emerald-700 border-emerald-200',
    DISPATCHED: 'bg-emerald-100 text-emerald-700 border-emerald-200',
    REJECTED: 'bg-red-100 text-red-700 border-red-200',
};
const STATUS_LABEL: Record<string, string> = {
    PENDING: 'Chờ duyệt',
    IN_TRANSIT: 'Đang vận chuyển',
    COMPLETED: 'Đã nhận hàng',
    DISPATCHED: 'Đã xuất kho',
    REJECTED: 'Từ chối',
};

function ReceiveIndexContent() {
    const { user, userDoc } = useAuth();
    const [orders, setOrders] = useState<PurchaseOrderDoc[]>([]);
    const [loading, setLoading] = useState(true);

    const getToken = useCallback(() => user?.getIdToken(), [user]);

    useEffect(() => {
        if (!user || !userDoc) return;
        (async () => {
            setLoading(true);
            try {
                const token = await getToken();
                const storeId = userDoc.storeId || '';
                const res = await fetch(`/api/inventory/orders?storeId=${storeId}`, {
                    headers: { Authorization: `Bearer ${token}` },
                });
                const data = await res.json();
                const all: PurchaseOrderDoc[] = Array.isArray(data) ? data : [];
                // Show IN_TRANSIT first, then COMPLETED
                setOrders(all.filter(o => o.status === 'IN_TRANSIT' || o.status === 'COMPLETED'));
            } catch { /* silent */ } finally { setLoading(false); }
        })();
    }, [user, userDoc, getToken]);

    return (
        <div className="space-y-6 mx-auto">
            <div>
                <h1 className="text-2xl font-bold bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent flex items-center gap-2">
                    <PackageCheck className="w-7 h-7 text-blue-600" />
                    Nhận hàng
                </h1>
                <p className="text-slate-500 mt-1">Xác nhận nhận hàng từ kho trung tâm. Quét mã QR trên phiếu xuất kho hoặc chọn đơn từ danh sách bên dưới.</p>
            </div>

            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                {loading ? (
                    <div className="flex justify-center py-12">
                        <div className="w-6 h-6 border-4 border-slate-300 border-t-slate-700 rounded-full animate-spin" />
                    </div>
                ) : orders.length === 0 ? (
                    <div className="text-center py-12 space-y-2">
                        <Truck className="w-8 h-8 text-slate-300 mx-auto" />
                        <p className="text-sm text-slate-400">Chưa có đơn hàng nào đang vận chuyển</p>
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="text-left text-xs text-slate-500 uppercase bg-slate-50 border-b">
                                    <th className="px-6 py-3">Ngày xuất</th>
                                    <th className="px-6 py-3">Sản phẩm</th>
                                    <th className="px-6 py-3">Trạng thái</th>
                                    <th className="px-6 py-3 text-right">Hành động</th>
                                </tr>
                            </thead>
                            <tbody>
                                {orders.map(order => (
                                    <tr key={order.id} className="border-b border-slate-100 hover:bg-slate-50/50">
                                        <td className="px-6 py-3 text-slate-500 whitespace-nowrap">
                                            {order.dispatchedAt ? new Date(order.dispatchedAt).toLocaleString('vi-VN') : '—'}
                                        </td>
                                        <td className="px-6 py-3 text-slate-600">
                                            <div className="space-y-0.5">
                                                {order.items.map((item, i) => (
                                                    <div key={i} className="text-xs">
                                                        <span className="text-slate-700">{item.productName}</span>
                                                        <span className="text-slate-400 ml-1">
                                                            ×{item.dispatchedQty ?? item.approvedQty ?? item.requestedQty} {item.unit}
                                                        </span>
                                                    </div>
                                                ))}
                                            </div>
                                        </td>
                                        <td className="px-6 py-3">
                                            <span className={`text-xs font-bold px-2 py-1 rounded border ${STATUS_BADGE[order.status] || ''}`}>
                                                {STATUS_LABEL[order.status] || order.status}
                                            </span>
                                        </td>
                                        <td className="px-6 py-3 text-right">
                                            {order.status === 'IN_TRANSIT' && order.qrCodeToken ? (
                                                <Link
                                                    href={`/manager/inventory/receive/${order.id}?token=${order.qrCodeToken}`}
                                                    className="inline-flex items-center gap-1.5 bg-blue-600 hover:bg-blue-700 text-white px-4 py-1.5 rounded-lg text-xs font-bold transition-colors"
                                                >
                                                    <PackageCheck className="w-3.5 h-3.5" /> Nhận hàng
                                                </Link>
                                            ) : (
                                                <span className="text-xs text-slate-400 flex items-center justify-end gap-1">
                                                    <CheckCircle2 className="w-3.5 h-3.5" /> Đã nhận
                                                </span>
                                            )}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>
        </div>
    );
}

export default function ReceiveIndexPage() {
    return (
        <Suspense fallback={
            <div className="flex justify-center py-12">
                <div className="w-8 h-8 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin" />
            </div>
        }>
            <ReceiveIndexContent />
        </Suspense>
    );
}
