'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import {
    ClipboardCheck, CheckCircle2, XCircle, ExternalLink, Package,
    Search, RefreshCw, FileText, Clock, Store, X,
} from 'lucide-react';
import type { PurchaseOrderDoc } from '@/types/inventory';

const STATUS_BADGE: Record<string, string> = {
    PENDING_OFFICE: 'bg-amber-100 text-amber-700 border-amber-200',
    APPROVED_BY_OFFICE: 'bg-sky-100 text-sky-700 border-sky-200',
    IN_TRANSIT: 'bg-indigo-100 text-indigo-700 border-indigo-200',
    COMPLETED: 'bg-emerald-100 text-emerald-700 border-emerald-200',
    REJECTED: 'bg-red-100 text-red-700 border-red-200',
    CANCELED: 'bg-slate-100 text-slate-500 border-slate-200',
};

export default function OfficeApprovalsPage() {
    const { user, userDoc, getToken } = useAuth();
    const [orders, setOrders] = useState<PurchaseOrderDoc[]>([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');

    // Approve state
    const [approvingId, setApprovingId] = useState<string | null>(null);
    const [isApproving, setIsApproving] = useState(false);

    // Reject state
    const [rejectingId, setRejectingId] = useState<string | null>(null);
    const [rejectReason, setRejectReason] = useState('');
    const [isRejecting, setIsRejecting] = useState(false);

    const fetchOrders = useCallback(async () => {
        setLoading(true);
        try {
            const token = await getToken();
            const res = await fetch('/api/inventory/orders?status=PENDING_OFFICE&limit=100', {
                headers: { Authorization: `Bearer ${token}` },
            });
            const data = await res.json();
            // API returns a direct array, not {orders: []}
            setOrders(Array.isArray(data) ? data : []);
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    }, [getToken]);

    useEffect(() => {
        if (user) fetchOrders();
    }, [user, fetchOrders]);

    // Guard: only office or admin
    if (userDoc && userDoc.role !== 'office' && userDoc.role !== 'admin') {
        return (
            <div className="flex items-center justify-center h-[60vh] text-slate-400">
                <p>Bạn không có quyền truy cập trang này.</p>
            </div>
        );
    }

    const filteredOrders = orders.filter(o => {
        const q = search.toLowerCase();
        return (
            o.storeName?.toLowerCase().includes(q) ||
            o.createdByName?.toLowerCase().includes(q) ||
            o.id?.toLowerCase().includes(q)
        );
    });

    const handleApprove = async () => {
        if (!approvingId) return;
        setIsApproving(true);
        try {
            const token = await getToken();
            const res = await fetch('/api/inventory/orders', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
                body: JSON.stringify({ orderId: approvingId, action: 'office_approve' }),
            });
            if (!res.ok) throw new Error((await res.json()).error);
            setApprovingId(null);
            fetchOrders();
        } catch (err: any) {
            alert(err.message);
        } finally { setIsApproving(false); }
    };

    const handleReject = async () => {
        if (!rejectingId || !rejectReason.trim()) return;
        setIsRejecting(true);
        try {
            const token = await getToken();
            const res = await fetch('/api/inventory/orders', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
                body: JSON.stringify({ orderId: rejectingId, action: 'office_reject', reason: rejectReason }),
            });
            if (!res.ok) throw new Error((await res.json()).error);
            setRejectingId(null);
            setRejectReason('');
            fetchOrders();
        } catch (err: any) {
            alert(err.message);
        } finally { setIsRejecting(false); }
    };

    return (
        <div className="space-y-6 py-6 max-w-6xl mx-auto">
            {/* Header */}
            <div className="flex items-start justify-between flex-wrap gap-3">
                <div>
                    <h1 className="text-2xl font-bold bg-gradient-to-r from-amber-600 to-orange-600 bg-clip-text text-transparent flex items-center gap-2">
                        <ClipboardCheck className="w-7 h-7 text-amber-600" />
                        Duyệt lệnh đặt hàng — Văn phòng
                    </h1>
                    <p className="text-sm text-slate-500 mt-1">
                        Xem xét và phê duyệt các lệnh đặt hàng từ cửa hàng trước khi chuyển kho xuất.
                    </p>
                </div>
                <button
                    onClick={fetchOrders}
                    className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 rounded-xl text-sm font-medium text-slate-600 hover:bg-slate-50 transition-colors shadow-sm"
                >
                    <RefreshCw className="w-4 h-4" /> Làm mới
                </button>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="bg-white rounded-2xl border border-amber-100 p-5 shadow-sm flex items-center gap-4">
                    <div className="w-12 h-12 rounded-xl bg-amber-50 flex items-center justify-center">
                        <Clock className="w-6 h-6 text-amber-600" />
                    </div>
                    <div>
                        <p className="text-2xl font-bold text-slate-800">{orders.length}</p>
                        <p className="text-xs text-slate-500">Đơn chờ duyệt</p>
                    </div>
                </div>
                <div className="bg-white rounded-2xl border border-slate-100 p-5 shadow-sm flex items-center gap-4">
                    <div className="w-12 h-12 rounded-xl bg-slate-50 flex items-center justify-center">
                        <Store className="w-6 h-6 text-slate-500" />
                    </div>
                    <div>
                        <p className="text-2xl font-bold text-slate-800">
                            {new Set(orders.map(o => o.storeId)).size}
                        </p>
                        <p className="text-xs text-slate-500">Cửa hàng gửi đơn</p>
                    </div>
                </div>
                <div className="bg-white rounded-2xl border border-slate-100 p-5 shadow-sm flex items-center gap-4">
                    <div className="w-12 h-12 rounded-xl bg-slate-50 flex items-center justify-center">
                        <Package className="w-6 h-6 text-slate-500" />
                    </div>
                    <div>
                        <p className="text-2xl font-bold text-slate-800">
                            {orders.reduce((s, o) => s + o.items.length, 0)}
                        </p>
                        <p className="text-xs text-slate-500">Tổng mặt hàng</p>
                    </div>
                </div>
            </div>

            {/* Search */}
            <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                    type="text"
                    placeholder="Tìm theo cửa hàng, người tạo, mã đơn..."
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                    className="w-full pl-10 pr-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-amber-300 shadow-sm"
                />
            </div>

            {/* Orders list */}
            {loading ? (
                <div className="flex justify-center py-16">
                    <div className="w-8 h-8 border-4 border-slate-200 border-t-amber-500 rounded-full animate-spin" />
                </div>
            ) : filteredOrders.length === 0 ? (
                <div className="bg-white rounded-2xl border border-slate-200 shadow-sm text-center py-16">
                    <ClipboardCheck className="w-12 h-12 text-slate-200 mx-auto mb-3" />
                    <p className="text-slate-500 font-medium">Không có đơn nào chờ duyệt</p>
                    <p className="text-sm text-slate-400 mt-1">Cửa hàng chưa gửi đơn hoặc đã được xử lý hết</p>
                </div>
            ) : (
                <div className="space-y-3">
                    {filteredOrders.map(order => {
                        const createdAt = new Date(order.timestamp);
                        const totalQty = order.items.reduce((s, i) => s + i.requestedQty, 0);

                        return (
                            <div
                                key={order.id}
                                className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden hover:shadow-md transition-shadow"
                            >
                                {/* Card Header */}
                                <div className="px-5 py-4 flex items-start gap-4">
                                    <div className="w-10 h-10 rounded-xl bg-amber-50 flex items-center justify-center shrink-0">
                                        <Store className="w-5 h-5 text-amber-600" />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2 flex-wrap">
                                            <h3 className="font-bold text-slate-800">{order.storeName || '—'}</h3>
                                            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${STATUS_BADGE['PENDING_OFFICE']}`}>
                                                Chờ VP duyệt
                                            </span>
                                        </div>
                                        <div className="flex items-center gap-3 mt-1 text-xs text-slate-500 flex-wrap">
                                            <span>Người tạo: <strong className="text-slate-700">{order.createdByName}</strong></span>
                                            <span>{createdAt.toLocaleString('vi-VN')}</span>
                                            <span className="font-medium text-slate-600">{order.items.length} SP · {totalQty} đơn vị</span>
                                        </div>
                                    </div>

                                    {/* Actions */}
                                    <div className="flex items-center gap-2 shrink-0">
                                        {order.attachmentUrl ? (
                                            <a
                                                href={order.attachmentUrl}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="flex items-center gap-1.5 text-xs font-bold text-indigo-600 hover:text-indigo-800 border border-indigo-200 hover:border-indigo-400 px-2.5 py-1.5 rounded-xl transition-colors"
                                            >
                                                <FileText className="w-3.5 h-3.5" />
                                                Xem file
                                                <ExternalLink className="w-3 h-3" />
                                            </a>
                                        ) : (
                                            <span className="text-xs text-slate-300 italic px-2.5 py-1.5 border border-dashed border-slate-200 rounded-xl">
                                                Không có file
                                            </span>
                                        )}
                                        <button
                                            onClick={() => setApprovingId(order.id)}
                                            className="flex items-center gap-1.5 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 px-3 py-1.5 rounded-xl transition-colors shadow-sm"
                                        >
                                            <CheckCircle2 className="w-3.5 h-3.5" /> Duyệt
                                        </button>
                                        <button
                                            onClick={() => { setRejectingId(order.id); setRejectReason(''); }}
                                            className="flex items-center gap-1.5 text-xs font-bold text-white bg-red-500 hover:bg-red-600 px-3 py-1.5 rounded-xl transition-colors shadow-sm"
                                        >
                                            <XCircle className="w-3.5 h-3.5" /> Từ chối
                                        </button>
                                    </div>
                                </div>

                                {/* Items preview */}
                                <div className="px-5 pb-4 flex flex-wrap gap-2">
                                    {order.items.slice(0, 5).map((item, i) => (
                                        <span key={i} className="text-xs bg-slate-100 text-slate-600 px-2 py-0.5 rounded-lg">
                                            {item.productCode && <span className="font-mono font-bold mr-1">{item.productCode}</span>}
                                            {item.productName} × {item.requestedQty}
                                        </span>
                                    ))}
                                    {order.items.length > 5 && (
                                        <span className="text-xs text-slate-400">+{order.items.length - 5} mặt hàng nữa</span>
                                    )}
                                </div>

                                {order.note && (
                                    <div className="px-5 pb-4">
                                        <p className="text-xs text-slate-400 italic">Ghi chú: {order.note}</p>
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
            )}

            {/* Approve Confirm Modal */}
            {approvingId && (
                <div className="fixed inset-0 z-[110] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
                    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm">
                        <div className="p-6 text-center">
                            <div className="w-14 h-14 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-4">
                                <CheckCircle2 className="w-7 h-7 text-emerald-600" />
                            </div>
                            <h2 className="text-lg font-bold text-slate-800">Xác nhận duyệt lệnh</h2>
                            <p className="text-sm text-slate-500 mt-2">
                                Đơn hàng sẽ được chuyển sang kho tổng để xuất hàng.
                            </p>
                        </div>
                        <div className="p-6 border-t border-slate-100 flex gap-3">
                            <button
                                onClick={() => setApprovingId(null)}
                                className="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-700 py-2.5 rounded-xl font-medium text-sm transition-colors"
                            >
                                Hủy
                            </button>
                            <button
                                onClick={handleApprove}
                                disabled={isApproving}
                                className="flex-1 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-40 text-white py-2.5 rounded-xl font-bold text-sm flex items-center justify-center gap-2 transition-all"
                            >
                                {isApproving
                                    ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                                    : <CheckCircle2 className="w-4 h-4" />}
                                Duyệt lệnh
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Reject Modal */}
            {rejectingId && (
                <div className="fixed inset-0 z-[110] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
                    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
                        <div className="p-6 border-b border-slate-100 flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <XCircle className="w-5 h-5 text-red-500" />
                                <h2 className="text-lg font-bold text-slate-800">Từ chối đơn hàng</h2>
                            </div>
                            <button onClick={() => setRejectingId(null)} className="text-slate-400 hover:text-slate-700 p-1">
                                <X className="w-5 h-5" />
                            </button>
                        </div>
                        <div className="p-6 space-y-4">
                            <p className="text-sm text-slate-600">Đơn sẽ bị từ chối và cửa hàng sẽ được thông báo. Lý do sẽ hiển thị trong lịch sử đặt hàng của họ.</p>
                            <div>
                                <label className="text-xs font-bold text-slate-600 block mb-1.5">
                                    Lý do từ chối <span className="text-red-500">*</span>
                                </label>
                                <textarea
                                    value={rejectReason}
                                    onChange={e => setRejectReason(e.target.value)}
                                    rows={3}
                                    placeholder="VD: Cơ cấu không phù hợp, thiếu file đề xuất, vượt ngân sách..."
                                    className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-sm outline-none focus:ring-2 focus:ring-red-300 resize-none"
                                />
                            </div>
                        </div>
                        <div className="p-6 border-t border-slate-100 flex gap-3">
                            <button
                                onClick={() => setRejectingId(null)}
                                className="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-700 py-2.5 rounded-xl font-medium text-sm transition-colors"
                            >
                                Quay lại
                            </button>
                            <button
                                onClick={handleReject}
                                disabled={isRejecting || !rejectReason.trim()}
                                className="flex-1 bg-red-600 hover:bg-red-700 disabled:opacity-40 text-white py-2.5 rounded-xl font-bold text-sm flex items-center justify-center gap-2 transition-all"
                            >
                                {isRejecting
                                    ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                                    : <XCircle className="w-4 h-4" />}
                                Xác nhận từ chối
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
