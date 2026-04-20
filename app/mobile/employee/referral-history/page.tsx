'use client';

import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import {
    getPointTransactions, getReferralPoints, getStorePointTransactions,
    adjustPoints, revokeTransaction, getPendingReferrals, getStorePendingReferrals,
    getAllPendingReferrals, getAllPointTransactions,
} from '@/actions/referral';
import type { PointTransactionDoc, PendingReferralDoc } from '@/types';
import {
    Award, Loader2, Clock, Receipt, Copy, Check, Undo2, PlusCircle,
    AlertTriangle, X, CheckCircle2, Calendar, User as UserIcon, ChevronDown, Hourglass, CheckCircle, XCircle, RefreshCw, Ban, Download, QrCode,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import MobilePageShell from '@/components/mobile/MobilePageShell';
import { QRCodeCanvas } from 'qrcode.react';
import BottomSheet from '@/components/shared/BottomSheet';
import { useMobileTranslation } from '@/lib/i18n';

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

function txTypeLabel(tx: PointTransactionDoc, tr: (key: string) => string) {
    const t = tx.type || 'earned';
    if (t === 'manual_adjustment') return tx.points > 0 ? tr('referral.typeManualAdd') : tr('referral.typeManualSubtract');
    if (t === 'refund_revocation') return tr('referral.typeRevocation');
    return tr('referral.typeEarned');
}

function pendingStatusConfig(status: PendingReferralDoc['status'], tr: (key: string) => string) {
    if (status === 'waiting') return { label: tr('referral.statusWaiting'), color: 'bg-amber-50 text-amber-700 border-amber-200', icon: Hourglass };
    if (status === 'matched') return { label: tr('referral.statusMatched'), color: 'bg-emerald-50 text-emerald-700 border-emerald-200', icon: CheckCircle };
    if (status === 'no_order') return { label: tr('referral.statusNoOrder'), color: 'bg-orange-50 text-orange-600 border-orange-200', icon: XCircle };
    if (status === 'revoked') return { label: tr('referral.statusRevoked'), color: 'bg-red-50 text-red-600 border-red-200', icon: Ban };
    return { label: tr('referral.statusExpired'), color: 'bg-gray-100 text-gray-500 border-gray-200', icon: XCircle };
}

function txPointColor(tx: PointTransactionDoc) {
    if (tx.isRevoked) return 'text-gray-400 bg-gray-100 border-gray-200 line-through';
    if (tx.points < 0) return 'text-red-600 bg-red-50 border-red-100';
    return 'text-emerald-600 bg-emerald-50 border-emerald-100';
}

// ── Page ──────────────────────────────────────────────────────
export default function ReferralHistoryPage() {
    const { user, userDoc, hasPermission, loading: authLoading } = useAuth();
    const { t } = useMobileTranslation();

    const isAdmin = userDoc?.role === 'admin' || userDoc?.role === 'super_admin';
    const canViewStore = isAdmin || hasPermission('page.referral.history');
    const storeId = userDoc?.storeId || '';

    const [tab, setTab] = useState<'personal' | 'store'>('personal');
    const [txns, setTxns] = useState<TxWithName[]>([]);
    const [pendingRefs, setPendingRefs] = useState<PendingReferralDoc[]>([]);
    const [totalPoints, setTotalPoints] = useState(0);
    const [loading, setLoading] = useState(true);
    const [copied, setCopied] = useState(false);
    const refCode = user?.uid ? `REF-${user.uid}` : '';
    const [showQR, setShowQR] = useState(false);
    const qrRef = useRef<HTMLCanvasElement>(null);

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

    // Sync
    const [syncing, setSyncing] = useState(false);

    // Bottom sheet filter
    const [filterSheetOpen, setFilterSheetOpen] = useState(false);
    const [filterStatus, setFilterStatus] = useState<string>('');

    // ── Load data
    const loadData = useCallback(async () => {
        if (!user?.uid) return;
        setLoading(true);
        try {
            if (tab === 'personal') {
                const [t, pts, pending] = await Promise.all([
                    getPointTransactions(user.uid, 50),
                    getReferralPoints(user.uid),
                    getPendingReferrals(user.uid, 50),
                ]);
                setTxns(t);
                setTotalPoints(pts);
                setPendingRefs(pending);
            } else {
                // Store-wide or global (admin without storeId)
                const fetchTxns = storeId ? getStorePointTransactions(storeId, 100) : getAllPointTransactions(100);
                const fetchPending = storeId ? getStorePendingReferrals(storeId, 100) : getAllPendingReferrals(100);
                const [storeTxns, storePending] = await Promise.all([fetchTxns, fetchPending]);
                setTxns(storeTxns);
                setTotalPoints(0);
                setPendingRefs(storePending);
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

    // Filtered pending refs (by employee + status)
    const filteredPendingRefs = useMemo(() => {
        let refs = pendingRefs;
        if (filterEmp) refs = refs.filter(r => r.saleEmployeeId === filterEmp);
        if (filterStatus) refs = refs.filter(r => r.status === filterStatus);
        return refs;
    }, [pendingRefs, filterEmp, filterStatus]);

    // Admin adjust
    const handleAdjust = async () => {
        const amount = parseInt(adjAmount, 10);
        const empId = adjTarget || user?.uid;
        if (!empId || isNaN(amount) || amount === 0 || !adjReason.trim() || !user?.uid) return;
        setAdjSubmitting(true);
        const res = await adjustPoints({ employeeId: empId, amount, reason: adjReason.trim(), adminId: user.uid });
        setAdjSubmitting(false);
        if (res.success) {
            setFeedback({ type: 'success', text: t('referral.adjustedPoints', { action: amount > 0 ? t('referral.adjustAdd') : t('referral.adjustSubtract'), amount: String(Math.abs(amount)) }) });
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
            setFeedback({ type: 'success', text: t('referral.revokedPoints', { points: String(revokeTarget.points) }) });
            setRevokeTarget(null);
            loadData();
        } else setFeedback({ type: 'error', text: res.error || 'Lỗi.' });
    };

    const copyCode = async () => {
        try { await navigator.clipboard.writeText(refCode); setCopied(true); setTimeout(() => setCopied(false), 2000); }
        catch { /* noop */ }
    };

    // Download QR as image with employee name
    const downloadQR = () => {
        const qrCanvas = qrRef.current;
        if (!qrCanvas) return;
        const size = 400;
        const padding = 40;
        const textHeight = 60;
        const canvas = document.createElement('canvas');
        canvas.width = size + padding * 2;
        canvas.height = size + padding * 2 + textHeight;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(qrCanvas, padding, padding, size, size);
        ctx.fillStyle = '#1a1a1a';
        ctx.font = 'bold 22px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(userDoc?.name || 'Nhân viên', canvas.width / 2, size + padding + 30);
        ctx.fillStyle = '#888888';
        ctx.font = '14px monospace';
        ctx.fillText(refCode, canvas.width / 2, size + padding + 52);
        const link = document.createElement('a');
        link.download = `QR_${userDoc?.name || 'referral'}.png`;
        link.href = canvas.toDataURL('image/png');
        link.click();
    };

    // Joy World sync
    const handleSync = async () => {
        setSyncing(true);
        try {
            const res = await fetch('/api/joyworld/referral-sync', { method: 'POST' });
            const data = await res.json();
            if (data.success) {
                const r = data.results || {};
                const parts: string[] = [];
                if (r.matched > 0) parts.push(`✅ ${r.matched} ${t('referral.matched')}`);
                if (r.rematched > 0) parts.push(`🔄 ${r.rematched} ${t('referral.rematched')}`);
                if (r.expired > 0) parts.push(`⏰ ${r.expired} ${t('referral.expired')}`);
                if (r.revoked > 0) parts.push(`❌ ${r.revoked} ${t('referral.revoked')}`);
                const msg = parts.length > 0
                    ? t('referral.syncDone', { totalOrders: String(data.totalOrders), details: parts.join(', ') })
                    : t('referral.syncNoChanges', { totalOrders: String(data.totalOrders) });
                setFeedback({ type: (r.matched > 0 || r.rematched > 0) ? 'success' : 'error', text: msg });
                loadData();
            } else {
                setFeedback({ type: 'error', text: data.error || t('referral.syncError') });
            }
        } catch {
            setFeedback({ type: 'error', text: t('referral.syncConnectionError') });
        } finally {
            setSyncing(false);
        }
    };

    if (authLoading) return <MobilePageShell title={t('referral.title')}><div className="flex justify-center py-20"><Loader2 className="w-6 h-6 animate-spin text-amber-500" /></div></MobilePageShell>;

    return (
        <MobilePageShell title={t('referral.title')}>
            <div className="space-y-3">
                {/* Feedback */}
                {feedback && (
                    <div className={cn('flex items-center gap-2 px-3 py-2 rounded-xl border text-xs font-medium', feedback.type === 'error' ? 'bg-red-50 border-red-200 text-red-700' : 'bg-emerald-50 border-emerald-200 text-emerald-700')}>
                        {feedback.type === 'error' ? <AlertTriangle className="w-3.5 h-3.5 shrink-0" /> : <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />}
                        {feedback.text}
                        <button onClick={() => setFeedback(null)} className="ml-auto"><X className="w-3 h-3 text-gray-400" /></button>
                    </div>
                )}

                {/* Points header + REF code + QR */}
                {tab === 'personal' && (
                    <div className="bg-gradient-to-br from-amber-50 via-yellow-50 to-amber-100 border border-amber-200 rounded-2xl p-4 space-y-2.5">
                        <div className="flex items-center gap-3">
                            <span className="w-11 h-11 rounded-xl bg-gradient-to-br from-amber-400 to-yellow-500 flex items-center justify-center shadow-md shadow-amber-200/50 shrink-0">
                                <Award className="w-5 h-5 text-white" />
                            </span>
                            <div>
                                <p className="text-[10px] text-amber-600 font-semibold uppercase tracking-wider">{t('referral.totalPoints')}</p>
                                <p className="text-2xl font-black text-amber-800 leading-tight">{totalPoints.toLocaleString('vi-VN')}</p>
                            </div>
                        </div>
                        {refCode && (
                            <div className="space-y-2">
                                <button onClick={copyCode} className="w-full flex items-center justify-between bg-white/70 rounded-xl px-3 py-2 border border-amber-200/60">
                                    <div>
                                        <p className="text-[9px] text-amber-600/70 font-bold uppercase tracking-wider">{t('referral.refCode')}</p>
                                        <p className="text-xs font-mono font-black text-amber-800">{refCode}</p>
                                    </div>
                                    {copied ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5 text-amber-500" />}
                                </button>
                                <button onClick={() => setShowQR(true)} className="w-full flex items-center justify-center gap-2 bg-white/80 rounded-xl px-3 py-2.5 border border-amber-200/60 text-xs font-bold text-amber-700 active:scale-[0.98] transition-transform">
                                    <QrCode className="w-4 h-4" /> {t('referral.viewQR')}
                                </button>
                            </div>
                        )}
                    </div>
                )}

                {/* Tabs — personal / store (if can access) */}
                {canViewStore && (
                    <div className="flex gap-1 bg-gray-100 p-1 rounded-xl">
                        <button onClick={() => { setTab('personal'); setFilterEmp(''); }} className={cn('flex-1 py-2 rounded-lg text-xs font-bold transition-all', tab === 'personal' ? 'bg-white shadow text-amber-700' : 'text-gray-500')}>
                            {t('referral.tabPersonal')}
                        </button>
                        <button onClick={() => { setTab('store'); setFilterEmp(''); }} className={cn('flex-1 py-2 rounded-lg text-xs font-bold transition-all', tab === 'store' ? 'bg-white shadow text-amber-700' : 'text-gray-500')}>
                            {t('referral.tabStore')}
                        </button>
                    </div>
                )}

                {/* Store tab: filter pill + admin actions */}
                {tab === 'store' && (
                    <div className="flex items-center gap-2">
                        <button
                            onClick={() => setFilterSheetOpen(true)}
                            className="flex-1 flex items-center gap-2 px-3 py-2.5 bg-white border border-gray-200 rounded-xl text-xs font-semibold text-gray-600 active:scale-[0.98] transition-transform"
                        >
                            <UserIcon className="w-3.5 h-3.5 text-gray-400" />
                            {filterEmp ? employees.find(e => e.id === filterEmp)?.name || t('common.filter') : t('referral.allEmployees')}
                            {filterStatus && <span className="ml-1 px-1.5 py-0.5 rounded bg-amber-100 text-amber-700 text-[9px] font-bold">{pendingStatusConfig(filterStatus as any, t).label}</span>}
                            <ChevronDown className="w-3 h-3 text-gray-400 ml-auto" />
                        </button>
                        {isAdmin && (
                            <div className="flex items-center gap-2">
                                <button onClick={handleSync} disabled={syncing} className={cn('flex items-center gap-1.5 px-3 py-2.5 rounded-xl text-[10px] font-bold transition-colors shrink-0 shadow-sm', syncing ? 'bg-blue-400 text-white' : 'bg-blue-500 text-white hover:bg-blue-600')}>
                                    <RefreshCw className={cn('w-3 h-3', syncing && 'animate-spin')} /> {syncing ? t('common.syncing') : t('common.sync')}
                                </button>
                                <button onClick={() => setShowAdjust(true)} className="flex items-center gap-1.5 px-3 py-2.5 rounded-xl bg-accent-500 text-white text-[10px] font-bold hover:bg-accent-600 transition-colors shrink-0 shadow-sm">
                                    <PlusCircle className="w-3 h-3" /> {t('referral.adjust')}
                                </button>
                            </div>
                        )}
                    </div>
                )}

                {/* Admin: Adjust modal */}
                {showAdjust && isAdmin && (
                    <div className="bg-white border border-accent-200 rounded-2xl p-4 shadow-lg space-y-3">
                        <div className="flex items-center justify-between">
                            <h4 className="text-xs font-bold text-surface-800">{t('referral.adjustTitle')}</h4>
                            <button onClick={() => setShowAdjust(false)} className="p-1 rounded-lg hover:bg-surface-100"><X className="w-3.5 h-3.5 text-surface-400" /></button>
                        </div>
                        <div>
                            <label className="text-[10px] font-bold text-surface-500 mb-1 block">{t('common.employee')}</label>
                            <div className="relative">
                                <select value={adjTarget} onChange={e => setAdjTarget(e.target.value)} className="w-full bg-surface-50 border border-surface-200 rounded-xl px-3 py-2.5 text-sm font-semibold appearance-none outline-none pr-8">
                                    <option value="">{t('referral.selectEmployee')}</option>
                                    {employees.map(e => <option key={e.id} value={e.id}>{e.name}</option>)}
                                </select>
                                <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-3 h-3 text-gray-400 pointer-events-none" />
                            </div>
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                            <div>
                                <label className="text-[10px] font-bold text-surface-500 mb-1 block">{t('referral.pointsAmount')}</label>
                                <input type="number" value={adjAmount} onChange={e => setAdjAmount(e.target.value)} placeholder={t('referral.pointsPlaceholder')} className="w-full bg-surface-50 border border-surface-200 rounded-xl px-3 py-2.5 text-sm font-semibold outline-none focus:ring-2 focus:ring-accent-300" />
                            </div>
                            <div>
                                <label className="text-[10px] font-bold text-surface-500 mb-1 block">{t('common.reason')} *</label>
                                <input type="text" value={adjReason} onChange={e => setAdjReason(e.target.value)} placeholder={t('referral.reasonPlaceholder')} className="w-full bg-surface-50 border border-surface-200 rounded-xl px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-accent-300" />
                            </div>
                        </div>
                        <button onClick={handleAdjust} disabled={!adjTarget || !adjAmount || parseInt(adjAmount) === 0 || !adjReason.trim() || adjSubmitting} className={cn('w-full py-2.5 rounded-xl font-bold text-xs transition-all', adjTarget && adjAmount && parseInt(adjAmount) !== 0 && adjReason.trim() && !adjSubmitting ? 'bg-accent-500 text-white hover:bg-accent-600' : 'bg-surface-200 text-surface-400 cursor-not-allowed')}>
                            {adjSubmitting ? <Loader2 className="w-3.5 h-3.5 animate-spin mx-auto" /> : t('referral.confirmAdjust')}
                        </button>
                    </div>
                )}

                {/* Admin: Revoke confirm */}
                {revokeTarget && (
                    <div className="bg-red-50 border border-red-200 rounded-2xl p-4 space-y-3">
                        <div className="flex items-start gap-2">
                            <AlertTriangle className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
                            <div>
                                <h4 className="text-xs font-bold text-red-800">{t('referral.revokeTitle')}</h4>
                                <p className="text-[11px] text-red-600 mt-1">{t('referral.revokeConfirm', { points: String(revokeTarget.points) })}</p>
                            </div>
                        </div>
                        <div className="flex gap-2">
                            <button onClick={() => setRevokeTarget(null)} className="flex-1 py-2 rounded-xl bg-white border border-red-200 text-red-600 text-xs font-bold">{t('common.cancel')}</button>
                            <button onClick={handleRevoke} disabled={revoking} className="flex-1 py-2 rounded-xl bg-red-500 text-white text-xs font-bold disabled:opacity-50">
                                {revoking ? <Loader2 className="w-3.5 h-3.5 animate-spin mx-auto" /> : t('referral.confirmRevoke')}
                            </button>
                        </div>
                    </div>
                )}

                {/* Pending referrals section */}
                {!loading && filteredPendingRefs.length > 0 && (
                    <div className="space-y-2">
                        <p className="text-[10px] text-amber-600 font-semibold uppercase tracking-wider px-1 flex items-center gap-1.5">
                            <Hourglass className="w-3 h-3" /> {t('referral.pendingSessions', { count: String(filteredPendingRefs.length) })}
                        </p>
                        {filteredPendingRefs.map(pr => {
                            const cfg = pendingStatusConfig(pr.status, t);
                            const StatusIcon = cfg.icon;
                            return (
                                <div key={pr.id} className={cn('rounded-2xl border px-4 py-3', pr.status === 'expired' ? 'bg-gray-50 border-gray-200 opacity-60' : 'bg-white border-gray-100 shadow-sm')}>
                                    <div className="flex items-center justify-between mb-1.5">
                                        <div className="flex items-center gap-2">
                                            <Clock className="w-3 h-3 text-gray-400" />
                                            <span className="text-[11px] text-gray-500 font-medium">{formatTime(pr.createdAt)}</span>
                                            <span className={cn('text-[9px] font-bold px-1.5 py-0.5 rounded-full border flex items-center gap-1', cfg.color)}>
                                                <StatusIcon className="w-2.5 h-2.5" />
                                                {cfg.label}
                                            </span>
                                        </div>
                                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-lg border bg-purple-50 text-purple-600 border-purple-100">
                                            {pr.expectedPackage}
                                        </span>
                                    </div>
                                    <div className="grid grid-cols-2 gap-x-3 gap-y-1">
                                        {tab === 'store' && (
                                            <div>
                                                <p className="text-[9px] text-gray-400 font-semibold uppercase">{t('common.employee')}</p>
                                                <p className="text-xs font-bold text-gray-700">{pr.saleEmployeeName}</p>
                                            </div>
                                        )}
                                        <div>
                                            <p className="text-[9px] text-gray-400 font-semibold uppercase">{t('common.customer')}</p>
                                            <p className="text-xs font-bold text-gray-700">{pr.customerPhone}</p>
                                        </div>
                                        {pr.matchedOrderCode && (
                                            <div>
                                                <p className="text-[9px] text-gray-400 font-semibold uppercase">{t('referral.posOrderCode')}</p>
                                                <p className="text-xs font-bold text-gray-700 truncate">{pr.matchedOrderCode}</p>
                                            </div>
                                        )}
                                        {pr.pointsAwarded != null && pr.pointsAwarded > 0 && (
                                            <div>
                                                <p className="text-[9px] text-gray-400 font-semibold uppercase">{t('referral.points')}</p>
                                                <p className="text-xs font-bold text-emerald-600">+{pr.pointsAwarded}</p>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}

                {/* Transaction list grouped by date */}
                {loading ? (
                    <div className="flex justify-center py-12"><Loader2 className="w-5 h-5 text-amber-500 animate-spin" /></div>
                ) : grouped.length === 0 && pendingRefs.length === 0 ? (
                    <div className="flex flex-col items-center py-12 gap-2">
                        <Receipt className="w-10 h-10 text-gray-200" />
                        <p className="text-sm text-gray-400 font-medium">{t('referral.emptyHistory')}</p>
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
                                                                {txTypeLabel(tx, t)}
                                                            </span>
                                                        )}
                                                        {tx.isRevoked && <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-gray-200 text-gray-500">{t('referral.statusRevoked')}</span>}
                                                    </div>
                                                    <span className={cn('text-xs font-black px-2 py-0.5 rounded-lg border', txPointColor(tx))}>
                                                        {tx.points > 0 ? '+' : ''}{tx.points}
                                                    </span>
                                                </div>

                                                <div className="grid grid-cols-2 gap-x-3 gap-y-1">
                                                    {tab === 'store' && tx.employeeName && (
                                                        <div>
                                                            <p className="text-[9px] text-gray-400 font-semibold uppercase">{t('common.employee')}</p>
                                                            <p className="text-xs font-bold text-gray-700">{tx.employeeName}</p>
                                                        </div>
                                                    )}
                                                    {tx.customerPhone && (
                                                        <div>
                                                            <p className="text-[9px] text-gray-400 font-semibold uppercase">{t('common.customer')}</p>
                                                            <p className="text-xs font-bold text-gray-700">{tx.customerPhone}</p>
                                                        </div>
                                                    )}
                                                    {tx.packageName && (
                                                        <div>
                                                            <p className="text-[9px] text-gray-400 font-semibold uppercase">{t('referral.package')}</p>
                                                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-lg border bg-purple-50 text-purple-600 border-purple-100">{tx.packageName}</span>
                                                        </div>
                                                    )}
                                                    {tx.adminId && (
                                                        <div>
                                                            <p className="text-[9px] text-gray-400 font-semibold uppercase">{t('referral.performedBy')}</p>
                                                            <p className="text-xs font-bold text-gray-700 truncate">{tx.adminId.slice(0, 8)}...</p>
                                                        </div>
                                                    )}
                                                    {tx.reason && (
                                                        <div className="col-span-2">
                                                            <p className="text-[9px] text-gray-400 font-semibold uppercase">{t('common.reason')}</p>
                                                            <p className="text-xs font-bold text-gray-700 truncate">{tx.reason}</p>
                                                        </div>
                                                    )}
                                                    {tx.orderCode && (
                                                        <div>
                                                            <p className="text-[9px] text-gray-400 font-semibold uppercase">{t('referral.posOrderCode')}</p>
                                                            <p className="text-xs font-bold text-gray-700 truncate">{tx.orderCode}</p>
                                                        </div>
                                                    )}
                                                    {tx.orderValue != null && tx.orderValue > 0 && (
                                                        <div>
                                                            <p className="text-[9px] text-gray-400 font-semibold uppercase">{t('referral.orderValue')}</p>
                                                            <p className="text-xs font-bold text-gray-700">{formatVND(tx.orderValue)}</p>
                                                        </div>
                                                    )}
                                                </div>

                                                {canRevoke && (
                                                    <button onClick={() => setRevokeTarget(tx)} className="flex items-center gap-1 mt-2 px-2.5 py-1 rounded-lg bg-red-50 border border-red-100 text-red-600 text-[10px] font-bold hover:bg-red-100 transition-colors">
                                                        <Undo2 className="w-3 h-3" /> {t('referral.revoke')}
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

            {/* QR Code Modal */}
            {showQR && (
                <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-6" onClick={() => setShowQR(false)}>
                    <div className="bg-white rounded-3xl p-6 w-full max-w-xs text-center shadow-2xl" onClick={e => e.stopPropagation()}>
                        <p className="text-lg font-bold text-gray-800 mb-1">{userDoc?.name || t('common.employee')}</p>
                        <p className="text-xs text-gray-400 mb-4">{t('referral.refCode')}</p>
                        <div className="flex justify-center mb-3">
                            <QRCodeCanvas ref={qrRef} value={refCode} size={200} level="H" marginSize={2} />
                        </div>
                        <p className="text-sm font-mono font-bold text-gray-700 mb-4">{refCode}</p>
                        <div className="flex gap-2">
                            <button onClick={downloadQR} className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl bg-amber-500 text-white text-xs font-bold active:scale-[0.98] transition-transform shadow-md">
                                <Download className="w-4 h-4" /> {t('common.download')}
                            </button>
                            <button onClick={() => setShowQR(false)} className="flex-1 py-2.5 rounded-xl bg-gray-100 text-gray-600 text-xs font-bold active:scale-[0.98] transition-transform">
                                {t('common.close')}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Filter Bottom Sheet */}
            <BottomSheet isOpen={filterSheetOpen} onClose={() => setFilterSheetOpen(false)} title={t('common.filter')}>
                <div className="px-4 pb-6 space-y-5">
                    {/* Employee filter */}
                    <div>
                        <p className="text-xs font-bold text-gray-600 mb-2">{t('common.employee')}</p>
                        <div className="flex flex-wrap gap-1.5">
                            <button
                                onClick={() => setFilterEmp('')}
                                className={cn('px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors', !filterEmp ? 'bg-primary-600 text-white' : 'bg-gray-100 text-gray-600')}
                            >{t('common.all')}</button>
                            {employees.map(e => (
                                <button
                                    key={e.id}
                                    onClick={() => setFilterEmp(e.id)}
                                    className={cn('px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors', filterEmp === e.id ? 'bg-primary-600 text-white' : 'bg-gray-100 text-gray-600')}
                                >{e.name}</button>
                            ))}
                        </div>
                    </div>
                    {/* Status filter */}
                    <div>
                        <p className="text-xs font-bold text-gray-600 mb-2">{t('referral.sessionStatus')}</p>
                        <div className="flex flex-wrap gap-1.5">
                            {(['', 'waiting', 'matched', 'expired', 'revoked'] as const).map(s => {
                                const label = s ? pendingStatusConfig(s, t).label : t('common.all');
                                return (
                                    <button
                                        key={s}
                                        onClick={() => setFilterStatus(s)}
                                        className={cn('px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors', filterStatus === s ? 'bg-amber-500 text-white' : 'bg-gray-100 text-gray-600')}
                                    >{label}</button>
                                );
                            })}
                        </div>
                    </div>
                    {/* Apply */}
                    <button
                        onClick={() => setFilterSheetOpen(false)}
                        className="w-full py-3 rounded-xl bg-primary-600 text-white text-sm font-bold active:scale-[0.98] transition-transform"
                    >{t('common.apply')}
                    </button>
                </div>
            </BottomSheet>
        </MobilePageShell>
    );
}
