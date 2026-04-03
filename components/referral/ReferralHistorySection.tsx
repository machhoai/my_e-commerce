'use client';

import { useState, useEffect, useCallback } from 'react';
import { getPointTransactions, getReferralPoints, adjustPoints, revokeTransaction } from '@/actions/referral';
import type { PointTransactionDoc } from '@/types';
import { Award, Loader2, Clock, Receipt, PlusCircle, Undo2, AlertTriangle, X, CheckCircle2 } from 'lucide-react';
import { cn } from '@/lib/utils';

function formatVND(n: number) {
    return n.toLocaleString('vi-VN') + 'đ';
}
function formatTime(iso: string) {
    try {
        return new Date(iso).toLocaleDateString('vi-VN', {
            day: '2-digit', month: '2-digit', year: '2-digit',
            hour: '2-digit', minute: '2-digit',
        });
    } catch { return iso; }
}

function txTypeLabel(tx: PointTransactionDoc) {
    const t = tx.type || 'earned';
    if (t === 'manual_adjustment') return tx.points > 0 ? 'Cộng thủ công' : 'Trừ thủ công';
    if (t === 'refund_revocation') return 'Thu hồi';
    return 'Tích điểm';
}

function txPointColor(tx: PointTransactionDoc) {
    if (tx.isRevoked) return 'text-gray-400 bg-gray-100 border-gray-200 line-through';
    if (tx.points < 0) return 'text-red-600 bg-red-50 border-red-100';
    return 'text-emerald-600 bg-emerald-50 border-emerald-100';
}

interface Props {
    employeeId: string;
    showTotal?: boolean;
    compact?: boolean;
    isAdmin?: boolean;
    adminId?: string;
}

export default function ReferralHistorySection({ employeeId, showTotal = true, compact = false, isAdmin = false, adminId }: Props) {
    const [transactions, setTransactions] = useState<PointTransactionDoc[]>([]);
    const [totalPoints, setTotalPoints] = useState<number>(0);
    const [loading, setLoading] = useState(true);

    // Admin: Adjust modal
    const [showAdjust, setShowAdjust] = useState(false);
    const [adjAmount, setAdjAmount] = useState('');
    const [adjReason, setAdjReason] = useState('');
    const [adjSubmitting, setAdjSubmitting] = useState(false);

    // Admin: Revoke confirm
    const [revokeTarget, setRevokeTarget] = useState<PointTransactionDoc | null>(null);
    const [revoking, setRevoking] = useState(false);

    // Feedback
    const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

    const loadData = useCallback(async () => {
        if (!employeeId) return;
        setLoading(true);
        const [txns, pts] = await Promise.all([
            getPointTransactions(employeeId),
            showTotal ? getReferralPoints(employeeId) : Promise.resolve(0),
        ]);
        setTransactions(txns);
        setTotalPoints(pts);
        setLoading(false);
    }, [employeeId, showTotal]);

    useEffect(() => { loadData(); }, [loadData]);

    // Auto-clear feedback
    useEffect(() => {
        if (!feedback) return;
        const t = setTimeout(() => setFeedback(null), 4000);
        return () => clearTimeout(t);
    }, [feedback]);

    // ── Admin: Submit adjustment ──────────────────────────────
    const handleAdjust = async () => {
        const amount = parseInt(adjAmount, 10);
        if (isNaN(amount) || amount === 0 || !adjReason.trim() || !adminId) return;
        setAdjSubmitting(true);
        const res = await adjustPoints({ employeeId, amount, reason: adjReason.trim(), adminId });
        setAdjSubmitting(false);
        if (res.success) {
            setFeedback({ type: 'success', text: `Đã ${amount > 0 ? 'cộng' : 'trừ'} ${Math.abs(amount)} điểm.` });
            setShowAdjust(false);
            setAdjAmount('');
            setAdjReason('');
            loadData();
        } else {
            setFeedback({ type: 'error', text: res.error || 'Lỗi không xác định.' });
        }
    };

    // ── Admin: Revoke ────────────────────────────────────────
    const handleRevoke = async () => {
        if (!revokeTarget || !adminId) return;
        setRevoking(true);
        const res = await revokeTransaction({
            transactionId: revokeTarget.id,
            employeeId,
            originalPoints: revokeTarget.points,
            adminId,
        });
        setRevoking(false);
        if (res.success) {
            setFeedback({ type: 'success', text: `Đã thu hồi ${revokeTarget.points} điểm.` });
            setRevokeTarget(null);
            loadData();
        } else {
            setFeedback({ type: 'error', text: res.error || 'Lỗi không xác định.' });
        }
    };

    if (loading) {
        return (
            <div className="flex justify-center py-8">
                <Loader2 className="w-5 h-5 text-amber-500 animate-spin" />
            </div>
        );
    }

    return (
        <div className="space-y-3">
            {/* Feedback toast */}
            {feedback && (
                <div className={cn(
                    'flex items-center gap-2 px-3 py-2 rounded-xl border text-xs font-medium animate-in fade-in slide-in-from-top-2',
                    feedback.type === 'error'
                        ? 'bg-red-50 border-red-200 text-red-700'
                        : 'bg-emerald-50 border-emerald-200 text-emerald-700',
                )}>
                    {feedback.type === 'error'
                        ? <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                        : <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />}
                    {feedback.text}
                    <button onClick={() => setFeedback(null)} className="ml-auto shrink-0">
                        <X className="w-3 h-3 text-gray-400" />
                    </button>
                </div>
            )}

            {/* Total points header */}
            {showTotal && (
                <div className="flex items-center gap-3 bg-gradient-to-r from-amber-50 to-yellow-50 border border-amber-200 rounded-2xl px-4 py-3">
                    <span className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-400 to-yellow-500 flex items-center justify-center shadow-sm shrink-0">
                        <Award className="w-5 h-5 text-white" />
                    </span>
                    <div className="flex-1">
                        <p className="text-[10px] text-amber-600 font-semibold uppercase tracking-wider">
                            Tổng điểm tích lũy
                        </p>
                        <p className="text-2xl font-black text-amber-800 leading-tight">
                            {totalPoints.toLocaleString('vi-VN')}
                        </p>
                    </div>
                    {isAdmin && (
                        <button
                            onClick={() => setShowAdjust(true)}
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-accent-500 text-white text-[10px] font-bold hover:bg-accent-600 transition-colors shrink-0 shadow-sm"
                        >
                            <PlusCircle className="w-3 h-3" /> Điều chỉnh
                        </button>
                    )}
                </div>
            )}

            {/* Admin: Adjust Points modal */}
            {showAdjust && (
                <div className="bg-white border border-accent-200 rounded-2xl p-4 shadow-lg space-y-3">
                    <div className="flex items-center justify-between">
                        <h4 className="text-xs font-bold text-surface-800">Điều chỉnh điểm</h4>
                        <button onClick={() => setShowAdjust(false)} className="p-1 rounded-lg hover:bg-surface-100">
                            <X className="w-3.5 h-3.5 text-surface-400" />
                        </button>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                        <div>
                            <label className="text-[10px] font-bold text-surface-500 mb-1 block">Số điểm (+/-)</label>
                            <input
                                type="number"
                                value={adjAmount}
                                onChange={e => setAdjAmount(e.target.value)}
                                placeholder="+10 hoặc -5"
                                className="w-full bg-surface-50 border border-surface-200 rounded-xl px-3 py-2.5 text-sm font-semibold outline-none focus:ring-2 focus:ring-accent-300"
                            />
                        </div>
                        <div>
                            <label className="text-[10px] font-bold text-surface-500 mb-1 block">Lý do *</label>
                            <input
                                type="text"
                                value={adjReason}
                                onChange={e => setAdjReason(e.target.value)}
                                placeholder="VD: Thưởng KPI..."
                                className="w-full bg-surface-50 border border-surface-200 rounded-xl px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-accent-300"
                            />
                        </div>
                    </div>
                    <button
                        onClick={handleAdjust}
                        disabled={!adjAmount || parseInt(adjAmount) === 0 || !adjReason.trim() || adjSubmitting}
                        className={cn(
                            'w-full py-2.5 rounded-xl font-bold text-xs transition-all',
                            adjAmount && parseInt(adjAmount) !== 0 && adjReason.trim() && !adjSubmitting
                                ? 'bg-accent-500 text-white hover:bg-accent-600'
                                : 'bg-surface-200 text-surface-400 cursor-not-allowed',
                        )}
                    >
                        {adjSubmitting ? <Loader2 className="w-3.5 h-3.5 animate-spin mx-auto" /> : 'Xác nhận điều chỉnh'}
                    </button>
                </div>
            )}

            {/* Admin: Revoke confirmation */}
            {revokeTarget && (
                <div className="bg-red-50 border border-red-200 rounded-2xl p-4 space-y-3">
                    <div className="flex items-start gap-2">
                        <AlertTriangle className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
                        <div>
                            <h4 className="text-xs font-bold text-red-800">Thu hồi điểm</h4>
                            <p className="text-[11px] text-red-600 mt-1">
                                Bạn có chắc chắn muốn thu hồi <span className="font-bold">{revokeTarget.points} điểm</span> của đơn hàng này do khách đổi/trả?
                            </p>
                        </div>
                    </div>
                    <div className="flex gap-2">
                        <button
                            onClick={() => setRevokeTarget(null)}
                            className="flex-1 py-2 rounded-xl bg-white border border-red-200 text-red-600 text-xs font-bold hover:bg-red-100 transition-colors"
                        >
                            Hủy
                        </button>
                        <button
                            onClick={handleRevoke}
                            disabled={revoking}
                            className="flex-1 py-2 rounded-xl bg-red-500 text-white text-xs font-bold hover:bg-red-600 transition-colors disabled:opacity-50"
                        >
                            {revoking ? <Loader2 className="w-3.5 h-3.5 animate-spin mx-auto" /> : 'Xác nhận thu hồi'}
                        </button>
                    </div>
                </div>
            )}

            {/* History table */}
            {transactions.length === 0 ? (
                <div className="flex flex-col items-center py-8 gap-2">
                    <Receipt className="w-10 h-10 text-gray-200" />
                    <p className="text-sm text-gray-400 font-medium">Chưa có lịch sử tích điểm</p>
                </div>
            ) : (
                <div className={compact ? 'space-y-2' : 'space-y-2.5'}>
                    <p className="text-[10px] text-gray-400 font-semibold uppercase tracking-wider px-1 flex items-center gap-1.5">
                        <Clock className="w-3 h-3" /> Lịch sử gần đây
                    </p>
                    {transactions.map(tx => {
                        const txType = tx.type || 'earned';
                        const canRevoke = isAdmin && txType === 'earned' && !tx.isRevoked && tx.points > 0;
                        return (
                            <div
                                key={tx.id}
                                className={cn(
                                    'rounded-2xl border px-4 py-3',
                                    tx.isRevoked ? 'bg-gray-50 border-gray-200 opacity-60' : 'bg-gray-50 border-gray-100',
                                )}
                            >
                                <div className="flex items-center justify-between mb-1.5">
                                    <div className="flex items-center gap-2">
                                        <span className="text-[11px] text-gray-500 font-medium">
                                            {formatTime(tx.createdAt)}
                                        </span>
                                        {txType !== 'earned' && (
                                            <span className={cn(
                                                'text-[9px] font-bold px-1.5 py-0.5 rounded',
                                                txType === 'manual_adjustment' ? 'bg-blue-50 text-blue-600' : 'bg-red-50 text-red-600',
                                            )}>
                                                {txTypeLabel(tx)}
                                            </span>
                                        )}
                                        {tx.isRevoked && (
                                            <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-gray-200 text-gray-500">
                                                Đã thu hồi
                                            </span>
                                        )}
                                    </div>
                                    <span className={cn('text-xs font-black px-2 py-0.5 rounded-lg border', txPointColor(tx))}>
                                        {tx.points > 0 ? '+' : ''}{tx.points}
                                    </span>
                                </div>
                                <div className={`grid ${compact ? 'grid-cols-2' : 'grid-cols-3'} gap-2`}>
                                    {tx.customerPhone && (
                                        <div>
                                            <p className="text-[9px] text-gray-400 font-semibold uppercase">Khách hàng</p>
                                            <p className="text-xs font-bold text-gray-700">{tx.customerPhone}</p>
                                        </div>
                                    )}
                                    {tx.packageName && (
                                        <div>
                                            <p className="text-[9px] text-gray-400 font-semibold uppercase">Gói</p>
                                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-lg border bg-purple-50 text-purple-600 border-purple-100">{tx.packageName}</span>
                                        </div>
                                    )}
                                    {tx.orderCode && (
                                        <div>
                                            <p className="text-[9px] text-gray-400 font-semibold uppercase">Mã đơn POS</p>
                                            <p className="text-xs font-bold text-gray-700 truncate">{tx.orderCode}</p>
                                        </div>
                                    )}
                                    {tx.reason && (
                                        <div className={!compact ? 'col-span-2' : ''}>
                                            <p className="text-[9px] text-gray-400 font-semibold uppercase">Lý do</p>
                                            <p className="text-xs font-bold text-gray-700 truncate">{tx.reason}</p>
                                        </div>
                                    )}
                                    {!compact && tx.orderValue != null && tx.orderValue > 0 && (
                                        <div className="text-right">
                                            <p className="text-[9px] text-gray-400 font-semibold uppercase">Giá trị đơn</p>
                                            <p className="text-xs font-bold text-gray-700">{formatVND(tx.orderValue)}</p>
                                        </div>
                                    )}
                                </div>

                                {/* Admin: Revoke button */}
                                {canRevoke && (
                                    <button
                                        onClick={() => setRevokeTarget(tx)}
                                        className="flex items-center gap-1 mt-2 px-2.5 py-1 rounded-lg bg-red-50 border border-red-100 text-red-600 text-[10px] font-bold hover:bg-red-100 transition-colors"
                                    >
                                        <Undo2 className="w-3 h-3" /> Thu hồi
                                    </button>
                                )}
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
}
