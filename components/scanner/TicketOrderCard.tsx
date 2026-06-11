'use client';

import { useState } from 'react';
import { CheckCircle2, XCircle, Clock, RotateCcw, Loader2, CreditCard, ShoppingBag, User, Phone, Mail, Tag, QrCode, Receipt } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { TicketOrderData, TicketConfirmPaymentPass } from '@/types';
import { ticketConfirmPaymentAction } from '@/actions/ticket-scan';

const ORDER_STATUS_MAP: Record<string, { label: string; color: string; icon: React.ReactNode }> = {
    pending: {
        label: 'Chờ thanh toán',
        color: 'bg-amber-100 text-amber-700 border-amber-200',
        icon: <Clock className="w-3.5 h-3.5" />,
    },
    paid: {
        label: 'Đã thanh toán',
        color: 'bg-emerald-100 text-emerald-700 border-emerald-200',
        icon: <CheckCircle2 className="w-3.5 h-3.5" />,
    },
    cancelled: {
        label: 'Đã hủy',
        color: 'bg-red-100 text-red-700 border-red-200',
        icon: <XCircle className="w-3.5 h-3.5" />,
    },
};

function formatVND(amount: number) {
    return new Intl.NumberFormat('vi-VN').format(amount) + 'đ';
}

function formatDate(iso: string | null | undefined) {
    if (!iso) return '—';
    return new Date(iso).toLocaleString('vi-VN', {
        day: '2-digit', month: '2-digit', year: 'numeric',
        hour: '2-digit', minute: '2-digit',
    });
}

export default function TicketOrderCard({
    order: initialOrder,
    onClose,
    onRescan,
}: {
    order: TicketOrderData;
    onClose: () => void;
    onRescan: () => void;
}) {
    const [order, setOrder] = useState(initialOrder);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [confirmedPasses, setConfirmedPasses] = useState<TicketConfirmPaymentPass[] | null>(null);

    const statusInfo = ORDER_STATUS_MAP[order.status] ?? ORDER_STATUS_MAP.pending;
    const canConfirmPayment = order.status === 'pending' && order.paymentProvider === 'counter';

    const handleConfirmPayment = async () => {
        if (loading || !canConfirmPayment) return;
        setLoading(true);
        setError('');
        try {
            const result = await ticketConfirmPaymentAction(order.id);
            if (!result) {
                setError('Không thể kết nối hệ thống vé.');
                return;
            }
            if (result.success) {
                setOrder(prev => ({
                    ...prev,
                    status: 'paid' as const,
                    paidAt: result.order.paidAt,
                }));
                setConfirmedPasses(result.passes);
            } else {
                setError(result.message);
            }
        } catch {
            setError('Lỗi kết nối. Vui lòng thử lại.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="p-5 space-y-4">
            {/* Header */}
            <div className="flex items-start gap-3.5">
                <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white shrink-0 shadow-sm">
                    <ShoppingBag className="w-6 h-6" />
                </div>
                <div className="flex-1 min-w-0">
                    <h3 className="text-sm font-bold text-surface-800 leading-tight">Đơn hàng</h3>
                    <p className="text-xs font-mono font-semibold text-surface-600 mt-0.5">{order.orderNumber}</p>
                    <div className={cn('inline-flex items-center gap-1 mt-1.5 px-2 py-0.5 rounded-full text-[10px] font-bold border', statusInfo.color)}>
                        {statusInfo.icon}
                        {statusInfo.label}
                    </div>
                </div>
                {/* Total amount */}
                <div className="text-right shrink-0">
                    <p className="text-lg font-black text-surface-800">{formatVND(order.finalAmount)}</p>
                    {order.discountAmount > 0 && (
                        <p className="text-[10px] text-emerald-600 font-bold">-{formatVND(order.discountAmount)}</p>
                    )}
                </div>
            </div>

            {/* Customer info */}
            <div className="bg-surface-50 rounded-2xl p-3.5 space-y-2.5">
                <div className="flex items-center gap-2.5">
                    <User className="w-3.5 h-3.5 text-surface-400 shrink-0" />
                    <span className="text-xs text-surface-500 w-20 shrink-0">Khách hàng</span>
                    <span className="text-xs font-semibold text-surface-800 truncate">{order.customerName}</span>
                </div>
                {order.customerPhone && (
                    <div className="flex items-center gap-2.5">
                        <Phone className="w-3.5 h-3.5 text-surface-400 shrink-0" />
                        <span className="text-xs text-surface-500 w-20 shrink-0">SĐT</span>
                        <span className="text-xs font-medium text-surface-600">{order.customerPhone}</span>
                    </div>
                )}
                {order.customerEmail && (
                    <div className="flex items-center gap-2.5">
                        <Mail className="w-3.5 h-3.5 text-surface-400 shrink-0" />
                        <span className="text-xs text-surface-500 w-20 shrink-0">Email</span>
                        <span className="text-xs font-medium text-surface-600 truncate">{order.customerEmail}</span>
                    </div>
                )}
                <div className="flex items-center gap-2.5">
                    <Tag className="w-3.5 h-3.5 text-surface-400 shrink-0" />
                    <span className="text-xs text-surface-500 w-20 shrink-0">Mã đơn</span>
                    <span className="text-xs font-mono font-semibold text-surface-700">{order.orderCode}</span>
                </div>
                <div className="flex items-center gap-2.5">
                    <Receipt className="w-3.5 h-3.5 text-surface-400 shrink-0" />
                    <span className="text-xs text-surface-500 w-20 shrink-0">Thanh toán</span>
                    <span className="text-xs font-medium text-surface-600 capitalize">{order.paymentProvider}</span>
                </div>
                {order.paidAt && (
                    <div className="flex items-center gap-2.5">
                        <Clock className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                        <span className="text-xs text-surface-500 w-20 shrink-0">Đã TT lúc</span>
                        <span className="text-xs font-semibold text-emerald-600">{formatDate(order.paidAt)}</span>
                    </div>
                )}
                {order.promotionCode && (
                    <div className="flex items-center gap-2.5">
                        <Tag className="w-3.5 h-3.5 text-violet-500 shrink-0" />
                        <span className="text-xs text-surface-500 w-20 shrink-0">Mã KM</span>
                        <span className="text-xs font-mono font-semibold text-violet-600">{order.promotionCode}</span>
                    </div>
                )}
            </div>

            {/* Order items */}
            <div className="bg-blue-50 border border-blue-100 rounded-2xl p-3.5">
                <p className="text-[10px] font-bold text-blue-600 uppercase tracking-wider mb-2">Sản phẩm ({order.items.length})</p>
                <div className="space-y-2">
                    {order.items.map((item, i) => (
                        <div key={i} className="flex items-center justify-between">
                            <div className="flex-1 min-w-0">
                                <p className="text-xs font-semibold text-surface-800 truncate">{item.productName}</p>
                                <p className="text-[10px] text-surface-400">
                                    {item.quantity} × {formatVND(item.unitPrice)}
                                </p>
                            </div>
                            <span className="text-xs font-bold text-surface-700 shrink-0 ml-3">
                                {formatVND(item.subtotal)}
                            </span>
                        </div>
                    ))}
                </div>
                {/* Subtotal / discount / total */}
                <div className="mt-2.5 pt-2.5 border-t border-blue-200 space-y-1">
                    {order.discountAmount > 0 && (
                        <>
                            <div className="flex justify-between text-xs text-surface-500">
                                <span>Tạm tính</span>
                                <span>{formatVND(order.subtotal)}</span>
                            </div>
                            <div className="flex justify-between text-xs text-emerald-600">
                                <span>Giảm giá</span>
                                <span>-{formatVND(order.discountAmount)}</span>
                            </div>
                        </>
                    )}
                    <div className="flex justify-between text-sm font-bold text-surface-800">
                        <span>Tổng cộng</span>
                        <span>{formatVND(order.finalAmount)}</span>
                    </div>
                </div>
            </div>

            {/* Generated passes after payment confirmation */}
            {confirmedPasses && confirmedPasses.length > 0 && (
                <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-3.5">
                    <div className="flex items-center gap-2 mb-2">
                        <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                        <p className="text-xs font-bold text-emerald-700">Thanh toán thành công — {confirmedPasses.length} vé đã được tạo</p>
                    </div>
                    <div className="space-y-1.5">
                        {confirmedPasses.map((p, i) => (
                            <div key={i} className="flex items-center gap-2 bg-white rounded-lg px-2.5 py-1.5">
                                <QrCode className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                                <span className="text-[11px] font-mono font-semibold text-surface-700">{p.shortCode}</span>
                                <span className="text-[9px] px-1.5 py-0.5 bg-emerald-100 text-emerald-700 rounded-full font-bold">{p.status}</span>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Error */}
            {error && (
                <p className="text-xs font-medium text-red-500 bg-red-50 border border-red-100 rounded-xl px-3 py-2">{error}</p>
            )}

            {/* Action buttons */}
            <div className="space-y-2 pt-1">
                {canConfirmPayment && !confirmedPasses && (
                    <button
                        onClick={handleConfirmPayment}
                        disabled={loading}
                        className={cn(
                            'w-full py-3.5 rounded-xl font-bold text-sm transition-all',
                            loading
                                ? 'bg-surface-200 text-surface-400 cursor-not-allowed'
                                : 'bg-blue-500 text-white hover:bg-blue-600 active:scale-[0.98] shadow-md shadow-blue-200',
                        )}
                    >
                        {loading ? (
                            <span className="flex items-center justify-center gap-2">
                                <Loader2 className="w-4 h-4 animate-spin" /> Đang xử lý...
                            </span>
                        ) : (
                            <span className="flex items-center justify-center gap-2">
                                <CreditCard className="w-4 h-4" /> Xác nhận thanh toán — {formatVND(order.finalAmount)}
                            </span>
                        )}
                    </button>
                )}
                <button
                    onClick={onRescan}
                    className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-accent-500 text-white font-bold text-sm hover:bg-accent-600 transition-colors"
                >
                    <RotateCcw className="w-4 h-4" /> Quét mã khác
                </button>
                <button
                    onClick={onClose}
                    className="w-full py-3 rounded-xl bg-surface-100 text-surface-600 font-semibold text-sm hover:bg-surface-200 transition-colors"
                >
                    Đóng
                </button>
            </div>
        </div>
    );
}
