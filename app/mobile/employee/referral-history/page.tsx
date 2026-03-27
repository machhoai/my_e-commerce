'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import {
    getPointTransactions, getReferralPoints, getStorePointTransactions,
    adjustPoints, revokeTransaction,
} from '@/actions/referral';
import type { PointTransactionDoc } from '@/types';
import {
    Award, Loader2, Clock, Receipt, Copy, Check, Undo2, PlusCircle,
    AlertTriangle, X, CheckCircle2, Calendar, User as UserIcon, ChevronDown,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import MobilePageShell from '@/components/mobile/MobilePageShell';

// ── Helpers ───────────────────────────────────────────────────
type TxWithName = PointTransactionDoc & { employeeName?: string };

function formatVND(n: number) { return n.toLocaleString('vi-VN') + 'đ'; }
function formatTime(iso: string) {
    try { return new Date(iso).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }); }
    catch { return iso; }
}
function formatDate(iso: string) {
    try { return new Date(iso).toLocaleDateString('vi-VN', { weekday: 'long', day: '2-digit', month: '2-digit', year: 'numeric' }); }
    catch { return iso; }
}
function dateKey(iso: string) {
    try { return new Date(iso).toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' }); }
    catch { return iso; }
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

// ── Page ──────────────────────────────────────────────────────
export default function ReferralHistoryPage() {
    const { user, userDoc, hasPermission, loading: authLoading } = useAuth();

    const isAdmin = userDoc?.role === 'admin' || userDoc?.role === 'super_admin';
    const isStoreEmployee = userDoc?.workplaceType === 'STORE';
    const canViewStore = isAdmin || hasPermission('page.referral.history');
    const storeId = userDoc?.storeId || '';

    const [tab, setTab] = useState<'personal' | 'store'>(canViewStore ? 'store' : 'personal');
    const [txns, setTxns] = useState<TxWithName[]>([]);
    const [totalPoints, setTotalPoints] = useState(0);
    const [loading, setLoading] = useState(true);
    const [copied, setCopied] = useState(false);
    const refCode = user?.uid ? `REF-${user.uid}` : '';

    // Admin adj
    const [showAdjust, setShowAdjust] = useState(false);
    const [adjTarget, setAdjTarget] = useState('');
    const [adjAmount, setAdjAmount] = useState('');
    const [adjReason, setAdjReason] = useState('');
    const [adjSubmitting, setAdjSubmitting] = useState(false);

    // Admin revoke
    const [revokeTarget, setRevokeTarget] = useState<PointTransactionDoc | null>(null);
    const [revoking, setRevoking] = useState(false);

    // Feedback
    const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

    // ── Load data
    const loadData = useCallback(async () => {
        if (!user?.uid) return;
        setLoading(true);
        try {
            if (tab === 'personal') {
                const [t, pts] = await Promise.all([
                    getPointTransactions(user.uid, 50),
                    getReferralPoints(user.uid),
                ]);
                setTxns(t);
                setTotalPoints(pts);
            } else if (storeId) {
                const storeTxns = await getStorePointTransactions(storeId, 100);
                setTxns(storeTxns);
                setTotalPoints(0);
            }
        } catch (e) { console.error(e); }
        finally { setLoading(false); }
    }, [user?.uid, tab, storeId]);

    useEffect(() => { loadData(); }, [loadData]);
    useEffect(() => { if (feedback) { const t = setTimeout(() => setFeedback(null), 4000); return () => clearTimeout(t); } }, [feedback]);

    // Unique employees for admin filter (store tab)
    const employees = useMemo(() => {
        const map = new Map<string, string>();
        txns.forEach(tx => {
            if (tx.employeeName && !map.has(tx.employeeId)) map.set(tx.employeeId, tx.employeeName);
        });
        return Array.from(map, ([id, name]) => ({ id, name }));
    }, [txns]);

    const [filterEmp, setFilterEmp] = useState('');

    // Group by date
    const grouped = useMemo(() => {
        const filtered = filterEmp ? txns.filter(t => t.employeeId === filterEmp) : txns;
        const map = new Map<string, TxWithName[]>();
        filtered.forEach(tx => {
            const dk = dateKey(tx.createdAt);
            if (!map.has(dk)) map.set(dk, []);
            map.get(dk)!.push(tx);
        });
        return Array.from(map.entries());
    }, [txns, filterEmp]);

    // Admin adjust
    const handleAdjust = async () => {
        const amount = parseInt(adjAmount, 10);
        const empId = adjTarget || user?.uid;
        if (!empId || isNaN(amount) || amount === 0 || !adjReason.trim() || !user?.uid) return;
        setAdjSubmitting(true);
        const res = await adjustPoints({ employeeId: empId, amount, reason: adjReason.trim(), adminId: user.uid });
        setAdjSubmitting(false);
        if (res.success) {
            setFeedback({ type: 'success', text: `Đã ${amount > 0 ? 'cộng' : 'trừ'} ${Math.abs(amount)} điểm.` });
            setShowAdjust(false); setAdjAmount(''); setAdjReason(''); setAdjTarget('');
            loadData();
        } else setFeedback({ type: 'error', text: res.error || 'Lỗi.' });
    };

    // Admin revoke
    const handleRevoke = async () => {
        if (!revokeTarget || !user?.uid) return;
        setRevoking(true);
        const res = await revokeTransaction({ transactionId: revokeTarget.id, employeeId: revokeTarget.employeeId, originalPoints: revokeTarget.points, adminId: user.uid });
        setRevoking(false);
        if (res.success) {
            setFeedback({ type: 'success', text: `Đã thu hồi ${revokeTarget.points} điểm.` });
            setRevokeTarget(null);
            loadData();
        } else setFeedback({ type: 'error', text: res.error || 'Lỗi.' });
    };

    const copyCode = async () => {
        try { await navigator.clipboard.writeText(refCode); setCopied(true); setTimeout(() => setCopied(false), 2000); }
        catch { /* noop */ }
    };

    if (authLoading) return <MobilePageShell title="Lịch sử tích điểm"><div className="flex justify-center py-20"><Loader2 className="w-6 h-6 animate-spin text-amber-500" /></div></MobilePageShell>;

    if (!isStoreEmployee && !canViewStore) {
        return (
            <MobilePageShell title="Lịch sử tích điểm">
                <div className="flex flex-col items-center justify-center py-20 px-6 gap-3">
                    <AlertTriangle className="w-10 h-10 text-gray-300" />
                    <p className="text-sm text-gray-500 font-medium text-center">Bạn không có quyền truy cập trang này.</p>
                </div>
            </MobilePageShell>
        );
    }

    return (
        <MobilePageShell title="Lịch sử tích điểm">
            <div className="space-y-3">
                {/* Feedback */}
                {feedback && (
                    <div className={cn('flex items-center gap-2 px-3 py-2 rounded-xl border text-xs font-medium', feedback.type === 'error' ? 'bg-red-50 border-red-200 text-red-700' : 'bg-emerald-50 border-emerald-200 text-emerald-700')}>
                        {feedback.type === 'error' ? <AlertTriangle className="w-3.5 h-3.5 shrink-0" /> : <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />}
                        {feedback.text}
                        <button onClick={() => setFeedback(null)} className="ml-auto"><X className="w-3 h-3 text-gray-400" /></button>
                    </div>
                )}

                {/* Points header + REF code */}
                {tab === 'personal' && (
                    <div className="bg-gradient-to-br from-amber-50 via-yellow-50 to-amber-100 border border-amber-200 rounded-2xl p-4 space-y-2.5">
                        <div className="flex items-center gap-3">
                            <span className="w-11 h-11 rounded-xl bg-gradient-to-br from-amber-400 to-yellow-500 flex items-center justify-center shadow-md shadow-amber-200/50 shrink-0">
                                <Award className="w-5 h-5 text-white" />
                            </span>
                            <div>
                                <p className="text-[10px] text-amber-600 font-semibold uppercase tracking-wider">Tổng điểm tích lũy</p>
                                <p className="text-2xl font-black text-amber-800 leading-tight">{totalPoints.toLocaleString('vi-VN')}</p>
                            </div>
                        </div>
                        {refCode && (
                            <button onClick={copyCode} className="w-full flex items-center justify-between bg-white/70 rounded-xl px-3 py-2 border border-amber-200/60">
                                <div>
                                    <p className="text-[9px] text-amber-600/70 font-bold uppercase tracking-wider">Mã giới thiệu</p>
                                    <p className="text-xs font-mono font-black text-amber-800">{refCode}</p>
                                </div>
                                {copied ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5 text-amber-500" />}
                            </button>
                        )}
                    </div>
                )}

                {/* Tabs — personal / store (if can access) */}
                {canViewStore && (
                    <div className="flex gap-1 bg-gray-100 p-1 rounded-xl">
                        <button onClick={() => { setTab('personal'); setFilterEmp(''); }} className={cn('flex-1 py-2 rounded-lg text-xs font-bold transition-all', tab === 'personal' ? 'bg-white shadow text-amber-700' : 'text-gray-500')}>
                            Cá nhân
                        </button>
                        <button onClick={() => { setTab('store'); setFilterEmp(''); }} className={cn('flex-1 py-2 rounded-lg text-xs font-bold transition-all', tab === 'store' ? 'bg-white shadow text-amber-700' : 'text-gray-500')}>
                            Toàn cửa hàng
                        </button>
                    </div>
                )}

                {/* Store tab: employee filter + admin actions */}
                {tab === 'store' && (
                    <div className="flex items-center gap-2">
                        <div className="relative flex-1">
                            <UserIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
                            <select
                                value={filterEmp}
                                onChange={e => setFilterEmp(e.target.value)}
                                className="w-full pl-9 pr-8 py-2.5 bg-white border border-gray-200 rounded-xl text-xs font-semibold appearance-none outline-none"
                            >
                                <option value="">Tất cả nhân viên</option>
                                {employees.map(e => <option key={e.id} value={e.id}>{e.name}</option>)}
                            </select>
                            <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-3 h-3 text-gray-400 pointer-events-none" />
                        </div>
                        {isAdmin && (
                            <button onClick={() => setShowAdjust(true)} className="flex items-center gap-1.5 px-3 py-2.5 rounded-xl bg-accent-500 text-white text-[10px] font-bold hover:bg-accent-600 transition-colors shrink-0 shadow-sm">
                                <PlusCircle className="w-3 h-3" /> Điều chỉnh
                            </button>
                        )}
                    </div>
                )}

                {/* Admin: Adjust modal */}
                {showAdjust && isAdmin && (
                    <div className="bg-white border border-accent-200 rounded-2xl p-4 shadow-lg space-y-3">
                        <div className="flex items-center justify-between">
                            <h4 className="text-xs font-bold text-surface-800">Điều chỉnh điểm</h4>
                            <button onClick={() => setShowAdjust(false)} className="p-1 rounded-lg hover:bg-surface-100"><X className="w-3.5 h-3.5 text-surface-400" /></button>
                        </div>
                        <div>
                            <label className="text-[10px] font-bold text-surface-500 mb-1 block">Nhân viên</label>
                            <div className="relative">
                                <select value={adjTarget} onChange={e => setAdjTarget(e.target.value)} className="w-full bg-surface-50 border border-surface-200 rounded-xl px-3 py-2.5 text-sm font-semibold appearance-none outline-none pr-8">
                                    <option value="">Chọn nhân viên...</option>
                                    {employees.map(e => <option key={e.id} value={e.id}>{e.name}</option>)}
                                </select>
                                <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-3 h-3 text-gray-400 pointer-events-none" />
                            </div>
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                            <div>
                                <label className="text-[10px] font-bold text-surface-500 mb-1 block">Số điểm (+/-)</label>
                                <input type="number" value={adjAmount} onChange={e => setAdjAmount(e.target.value)} placeholder="+10 hoặc -5" className="w-full bg-surface-50 border border-surface-200 rounded-xl px-3 py-2.5 text-sm font-semibold outline-none focus:ring-2 focus:ring-accent-300" />
                            </div>
                            <div>
                                <label className="text-[10px] font-bold text-surface-500 mb-1 block">Lý do *</label>
                                <input type="text" value={adjReason} onChange={e => setAdjReason(e.target.value)} placeholder="VD: Thưởng KPI..." className="w-full bg-surface-50 border border-surface-200 rounded-xl px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-accent-300" />
                            </div>
                        </div>
                        <button onClick={handleAdjust} disabled={!adjTarget || !adjAmount || parseInt(adjAmount) === 0 || !adjReason.trim() || adjSubmitting} className={cn('w-full py-2.5 rounded-xl font-bold text-xs transition-all', adjTarget && adjAmount && parseInt(adjAmount) !== 0 && adjReason.trim() && !adjSubmitting ? 'bg-accent-500 text-white hover:bg-accent-600' : 'bg-surface-200 text-surface-400 cursor-not-allowed')}>
                            {adjSubmitting ? <Loader2 className="w-3.5 h-3.5 animate-spin mx-auto" /> : 'Xác nhận điều chỉnh'}
                        </button>
                    </div>
                )}

                {/* Admin: Revoke confirm */}
                {revokeTarget && (
                    <div className="bg-red-50 border border-red-200 rounded-2xl p-4 space-y-3">
                        <div className="flex items-start gap-2">
                            <AlertTriangle className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
                            <div>
                                <h4 className="text-xs font-bold text-red-800">Thu hồi điểm</h4>
                                <p className="text-[11px] text-red-600 mt-1">Bạn có chắc chắn muốn thu hồi <span className="font-bold">{revokeTarget.points} điểm</span> của đơn hàng này do khách đổi/trả?</p>
                            </div>
                        </div>
                        <div className="flex gap-2">
                            <button onClick={() => setRevokeTarget(null)} className="flex-1 py-2 rounded-xl bg-white border border-red-200 text-red-600 text-xs font-bold">Hủy</button>
                            <button onClick={handleRevoke} disabled={revoking} className="flex-1 py-2 rounded-xl bg-red-500 text-white text-xs font-bold disabled:opacity-50">
                                {revoking ? <Loader2 className="w-3.5 h-3.5 animate-spin mx-auto" /> : 'Xác nhận thu hồi'}
                            </button>
                        </div>
                    </div>
                )}

                {/* Transaction list grouped by date */}
                {loading ? (
                    <div className="flex justify-center py-12"><Loader2 className="w-5 h-5 text-amber-500 animate-spin" /></div>
                ) : grouped.length === 0 ? (
                    <div className="flex flex-col items-center py-12 gap-2">
                        <Receipt className="w-10 h-10 text-gray-200" />
                        <p className="text-sm text-gray-400 font-medium">Chưa có lịch sử tích điểm</p>
                    </div>
                ) : (
                    <div className="space-y-4">
                        {grouped.map(([date, items]) => (
                            <div key={date}>
                                {/* Date header */}
                                <div className="flex items-center gap-2 mb-2">
                                    <Calendar className="w-3 h-3 text-gray-400" />
                                    <p className="text-[10px] font-bold text-gray-500 uppercase">{formatDate(items[0].createdAt)}</p>
                                    <div className="flex-1 border-t border-gray-100" />
                                </div>

                                <div className="space-y-2">
                                    {items.map(tx => {
                                        const txType = tx.type || 'earned';
                                        const canRevoke = isAdmin && txType === 'earned' && !tx.isRevoked && tx.points > 0;
                                        return (
                                            <div key={tx.id} className={cn('rounded-2xl border px-4 py-3', tx.isRevoked ? 'bg-gray-50 border-gray-200 opacity-60' : 'bg-white border-gray-100 shadow-sm')}>
                                                <div className="flex items-center justify-between mb-1.5">
                                                    <div className="flex items-center gap-2">
                                                        <Clock className="w-3 h-3 text-gray-400" />
                                                        <span className="text-[11px] text-gray-500 font-medium">{formatTime(tx.createdAt)}</span>
                                                        {txType !== 'earned' && (
                                                            <span className={cn('text-[9px] font-bold px-1.5 py-0.5 rounded', txType === 'manual_adjustment' ? 'bg-blue-50 text-blue-600' : 'bg-red-50 text-red-600')}>
                                                                {txTypeLabel(tx)}
                                                            </span>
                                                        )}
                                                        {tx.isRevoked && <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-gray-200 text-gray-500">Đã thu hồi</span>}
                                                    </div>
                                                    <span className={cn('text-xs font-black px-2 py-0.5 rounded-lg border', txPointColor(tx))}>
                                                        {tx.points > 0 ? '+' : ''}{tx.points}
                                                    </span>
                                                </div>

                                                <div className="grid grid-cols-2 gap-x-3 gap-y-1">
                                                    {tab === 'store' && tx.employeeName && (
                                                        <div>
                                                            <p className="text-[9px] text-gray-400 font-semibold uppercase">Nhân viên</p>
                                                            <p className="text-xs font-bold text-gray-700">{tx.employeeName}</p>
                                                        </div>
                                                    )}
                                                    {tx.customerPhone && (
                                                        <div>
                                                            <p className="text-[9px] text-gray-400 font-semibold uppercase">Khách hàng</p>
                                                            <p className="text-xs font-bold text-gray-700">{tx.customerPhone}</p>
                                                        </div>
                                                    )}
                                                    {tx.adminId && (
                                                        <div>
                                                            <p className="text-[9px] text-gray-400 font-semibold uppercase">Người thực hiện</p>
                                                            <p className="text-xs font-bold text-gray-700 truncate">{tx.adminId.slice(0, 8)}...</p>
                                                        </div>
                                                    )}
                                                    {tx.reason && (
                                                        <div className="col-span-2">
                                                            <p className="text-[9px] text-gray-400 font-semibold uppercase">Lý do</p>
                                                            <p className="text-xs font-bold text-gray-700 truncate">{tx.reason}</p>
                                                        </div>
                                                    )}
                                                    {tx.orderCode && (
                                                        <div>
                                                            <p className="text-[9px] text-gray-400 font-semibold uppercase">Mã đơn POS</p>
                                                            <p className="text-xs font-bold text-gray-700 truncate">{tx.orderCode}</p>
                                                        </div>
                                                    )}
                                                    {tx.orderValue != null && tx.orderValue > 0 && (
                                                        <div>
                                                            <p className="text-[9px] text-gray-400 font-semibold uppercase">Giá trị đơn</p>
                                                            <p className="text-xs font-bold text-gray-700">{formatVND(tx.orderValue)}</p>
                                                        </div>
                                                    )}
                                                </div>

                                                {canRevoke && (
                                                    <button onClick={() => setRevokeTarget(tx)} className="flex items-center gap-1 mt-2 px-2.5 py-1 rounded-lg bg-red-50 border border-red-100 text-red-600 text-[10px] font-bold hover:bg-red-100 transition-colors">
                                                        <Undo2 className="w-3 h-3" /> Thu hồi
                                                    </button>
                                                )}
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </MobilePageShell>
    );
}
