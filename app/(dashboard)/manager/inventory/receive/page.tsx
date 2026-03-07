'use client';

import { useState, useEffect, useCallback, Suspense } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { PackageCheck, Truck, CheckCircle2, ChevronDown, ChevronUp } from 'lucide-react';
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
    const [expandedOrders, setExpandedOrders] = useState<Set<string>>(new Set());

    const getToken = useCallback(() => user?.getIdToken(), [user]);

    const toggleOrder = (orderId: string) => {
        setExpandedOrders(prev => {
            const next = new Set(prev);
            if (next.has(orderId)) next.delete(orderId);
            else next.add(orderId);
            return next;
        });
    };

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

            {loading ? (
                <div className="flex justify-center py-12">
                    <div className="w-6 h-6 border-4 border-slate-300 border-t-slate-700 rounded-full animate-spin" />
                </div>
            ) : orders.length === 0 ? (
                <div className="bg-white rounded-2xl border border-slate-200 shadow-sm text-center py-12 space-y-2">
                    <Truck className="w-8 h-8 text-slate-300 mx-auto" />
                    <p className="text-sm text-slate-400">Chưa có đơn hàng nào đang vận chuyển</p>
                </div>
            ) : (
                <div className="space-y-3">
                    {orders.map(order => {
                        const isExpanded = expandedOrders.has(order.id);
                        const totalItems = order.items.length;
                        const totalQty = order.items.reduce((s, i) => s + (i.dispatchedQty ?? i.approvedQty ?? i.requestedQty), 0);

                        return (
                            <div key={order.id} className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                                {/* Collapsible header */}
                                <button
                                    onClick={() => toggleOrder(order.id)}
                                    className="w-full flex items-center gap-3 px-4 py-3.5 text-left hover:bg-slate-50/80 transition-colors"
                                >
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2 flex-wrap">
                                            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${STATUS_BADGE[order.status] || ''}`}>
                                                {STATUS_LABEL[order.status] || order.status}
                                            </span>
                                            <span className="text-xs text-slate-400">
                                                {order.dispatchedAt ? new Date(order.dispatchedAt).toLocaleString('vi-VN') : '—'}
                                            </span>
                                        </div>
                                        <p className="text-sm text-slate-600 mt-1">
                                            <span className="font-bold text-slate-800">{totalItems}</span> sản phẩm · <span className="font-bold text-slate-800">{totalQty}</span> đơn vị
                                        </p>
                                    </div>

                                    {/* Action button — stop propagation to avoid toggling */}
                                    {order.status === 'IN_TRANSIT' && order.qrCodeToken ? (
                                        <Link
                                            href={`/manager/inventory/receive/${order.id}?token=${order.qrCodeToken}`}
                                            onClick={e => e.stopPropagation()}
                                            className="inline-flex items-center gap-1.5 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-xl text-xs font-bold transition-colors shrink-0"
                                        >
                                            <PackageCheck className="w-3.5 h-3.5" /> Nhận hàng
                                        </Link>
                                    ) : (
                                        <span className="text-xs text-emerald-600 flex items-center gap-1 shrink-0">
                                            <CheckCircle2 className="w-3.5 h-3.5" /> Đã nhận
                                        </span>
                                    )}

                                    {isExpanded
                                        ? <ChevronUp className="w-4 h-4 text-slate-400 shrink-0" />
                                        : <ChevronDown className="w-4 h-4 text-slate-400 shrink-0" />}
                                </button>

                                {/* Collapsible item list */}
                                {isExpanded && (
                                    <div className="border-t border-slate-100 px-4 py-3 bg-slate-50/50">
                                        <div className="space-y-1.5">
                                            {order.items.map((item, i) => (
                                                <div key={i} className="flex items-center justify-between text-xs py-1">
                                                    <div className="flex items-center gap-2 min-w-0">
                                                        <span className="font-mono font-bold text-slate-800 bg-slate-100 px-1.5 py-0.5 rounded text-[11px]">
                                                            {item.productCode || '—'}
                                                        </span>
                                                        <span className="text-slate-500 truncate">{item.productName}</span>
                                                    </div>
                                                    <span className="text-slate-600 font-semibold whitespace-nowrap ml-2">
                                                        ×{item.dispatchedQty ?? item.approvedQty ?? item.requestedQty} {item.unit}
                                                    </span>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
            )}
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
