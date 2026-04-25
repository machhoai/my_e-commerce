'use client';

import { useState } from 'react';
import { CheckCircle2, XCircle, Clock, RotateCcw, Loader2, ShieldAlert, CalendarDays, User, Mail, Tag, QrCode } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { TicketPassData } from '@/types';
import { ticketUsePassAction } from '@/actions/ticket-scan';

const STATUS_MAP: Record<string, { label: string; color: string; icon: React.ReactNode }> = {
    active: {
        label: 'Còn hiệu lực',
        color: 'bg-emerald-100 text-emerald-700 border-emerald-200',
        icon: <CheckCircle2 className="w-3.5 h-3.5" />,
    },
    used: {
        label: 'Đã sử dụng',
        color: 'bg-amber-100 text-amber-700 border-amber-200',
        icon: <ShieldAlert className="w-3.5 h-3.5" />,
    },
    voided: {
        label: 'Đã hủy',
        color: 'bg-red-100 text-red-700 border-red-200',
        icon: <XCircle className="w-3.5 h-3.5" />,
    },
};

function formatDate(iso: string | null | undefined) {
    if (!iso) return '—';
    return new Date(iso).toLocaleString('vi-VN', {
        day: '2-digit', month: '2-digit', year: 'numeric',
        hour: '2-digit', minute: '2-digit',
    });
}

export default function TicketPassCard({
    pass: initialPass,
    onClose,
    onRescan,
}: {
    pass: TicketPassData;
    onClose: () => void;
    onRescan: () => void;
}) {
    const [pass, setPass] = useState(initialPass);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState(false);

    const statusInfo = STATUS_MAP[pass.status] ?? STATUS_MAP.active;
    const canUse = pass.status === 'active';

    const handleUsePass = async () => {
        if (loading || !canUse) return;
        setLoading(true);
        setError('');
        try {
            const result = await ticketUsePassAction(pass.id);
            if (!result) {
                setError('Không thể kết nối hệ thống vé.');
                return;
            }
            if (result.success) {
                setPass(result.pass);
                setSuccess(true);
            } else {
                setError(result.message);
                if (result.pass) setPass(result.pass);
            }
        } catch {
            setError('Lỗi kết nối. Vui lòng thử lại.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="p-5 space-y-4">
            {/* Header: Product + Status */}
            <div className="flex items-start gap-3.5">
                {pass.thumbnailUrl ? (
                    <img
                        src={pass.thumbnailUrl}
                        alt={pass.productName}
                        className="w-14 h-14 rounded-xl object-cover shadow-sm border border-surface-100 shrink-0"
                    />
                ) : (
                    <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-violet-500 to-indigo-600 flex items-center justify-center text-white shrink-0 shadow-sm">
                        <QrCode className="w-6 h-6" />
                    </div>
                )}
                <div className="flex-1 min-w-0">
                    <h3 className="text-sm font-bold text-surface-800 leading-tight truncate">{pass.productName}</h3>
                    <p className="text-[11px] text-surface-400 mt-0.5">{pass.productType === 'combo' ? 'Combo' : 'Vé đơn'} · {pass.validityType === 'open-dated' ? 'Không giới hạn ngày' : 'Ngày cố định'}</p>
                    <div className={cn('inline-flex items-center gap-1 mt-1.5 px-2 py-0.5 rounded-full text-[10px] font-bold border', statusInfo.color)}>
                        {statusInfo.icon}
                        {statusInfo.label}
                    </div>
                </div>
            </div>

            {/* Info grid */}
            <div className="bg-surface-50 rounded-2xl p-3.5 space-y-2.5">
                <div className="flex items-center gap-2.5">
                    <User className="w-3.5 h-3.5 text-surface-400 shrink-0" />
                    <span className="text-xs text-surface-500 w-20 shrink-0">Khách hàng</span>
                    <span className="text-xs font-semibold text-surface-800 truncate">{pass.customerName}</span>
                </div>
                {pass.customerEmail && (
                    <div className="flex items-center gap-2.5">
                        <Mail className="w-3.5 h-3.5 text-surface-400 shrink-0" />
                        <span className="text-xs text-surface-500 w-20 shrink-0">Email</span>
                        <span className="text-xs font-medium text-surface-600 truncate">{pass.customerEmail}</span>
                    </div>
                )}
                <div className="flex items-center gap-2.5">
                    <Tag className="w-3.5 h-3.5 text-surface-400 shrink-0" />
                    <span className="text-xs text-surface-500 w-20 shrink-0">Mã đơn</span>
                    <span className="text-xs font-mono font-semibold text-surface-700">{pass.orderNumber}</span>
                </div>
                <div className="flex items-center gap-2.5">
                    <QrCode className="w-3.5 h-3.5 text-surface-400 shrink-0" />
                    <span className="text-xs text-surface-500 w-20 shrink-0">Mã vé</span>
                    <span className="text-xs font-mono font-semibold text-surface-700">{pass.shortCode}</span>
                </div>
                <div className="flex items-center gap-2.5">
                    <CalendarDays className="w-3.5 h-3.5 text-surface-400 shrink-0" />
                    <span className="text-xs text-surface-500 w-20 shrink-0">Hiệu lực</span>
                    <span className="text-xs font-medium text-surface-600">
                        {formatDate(pass.validFrom)} — {formatDate(pass.validUntil)}
                    </span>
                </div>
                {pass.usedAt && (
                    <div className="flex items-center gap-2.5">
                        <Clock className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                        <span className="text-xs text-surface-500 w-20 shrink-0">Đã dùng</span>
                        <span className="text-xs font-semibold text-amber-600">{formatDate(pass.usedAt)}</span>
                    </div>
                )}
            </div>

            {/* Combo items */}
            {pass.comboItems && pass.comboItems.length > 0 && (
                <div className="bg-violet-50 border border-violet-100 rounded-2xl p-3.5">
                    <p className="text-[10px] font-bold text-violet-600 uppercase tracking-wider mb-1.5">Bao gồm</p>
                    <ul className="space-y-1">
                        {pass.comboItems.map((item, i) => (
                            <li key={i} className="text-xs text-violet-700 flex items-center gap-1.5">
                                <span className="w-1 h-1 rounded-full bg-violet-400" />
                                {item}
                            </li>
                        ))}
                    </ul>
                </div>
            )}

            {/* Success message */}
            {success && (
                <div className="flex items-center gap-2 py-2.5 px-3.5 bg-emerald-50 border border-emerald-200 rounded-xl">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                    <p className="text-xs font-semibold text-emerald-700">Vé đã được sử dụng thành công!</p>
                </div>
            )}

            {/* Error message */}
            {error && (
                <p className="text-xs font-medium text-red-500 bg-red-50 border border-red-100 rounded-xl px-3 py-2">{error}</p>
            )}

            {/* Action buttons */}
            <div className="space-y-2 pt-1">
                {canUse && !success && (
                    <button
                        onClick={handleUsePass}
                        disabled={loading}
                        className={cn(
                            'w-full py-3.5 rounded-xl font-bold text-sm transition-all',
                            loading
                                ? 'bg-surface-200 text-surface-400 cursor-not-allowed'
                                : 'bg-emerald-500 text-white hover:bg-emerald-600 active:scale-[0.98] shadow-md shadow-emerald-200',
                        )}
                    >
                        {loading ? (
                            <span className="flex items-center justify-center gap-2">
                                <Loader2 className="w-4 h-4 animate-spin" /> Đang xử lý...
                            </span>
                        ) : (
                            <span className="flex items-center justify-center gap-2">
                                <CheckCircle2 className="w-4 h-4" /> Sử dụng vé
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
