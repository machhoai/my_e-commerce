'use client';

import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useStoreSettings } from '@/hooks/useStoreSettings';
import {
    getPointTransactions, getReferralPoints, getStorePointTransactions,
    adjustPoints, revokeTransaction, getPendingReferrals, getStorePendingReferrals,
    getAllPendingReferrals, getAllPointTransactions,
} from '@/actions/referral';
import type { PointTransactionDoc, PendingReferralDoc } from '@/types';
import {
    Award, Loader2, Clock, Receipt, Copy, Check, Undo2, PlusCircle,
    AlertTriangle, X, CheckCircle2, Calendar, User as UserIcon, ChevronDown, Star, Hourglass, CheckCircle as CheckCircleIcon, XCircle, RefreshCw, Ban, Download, QrCode,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { DashboardHeader } from '@/components/inventory/overview/DashboardHeader';
import { QRCodeCanvas } from 'qrcode.react';
import ExportReferralExcel from '@/components/referral/ExportReferralExcel';

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
function txTypeBadge(tx: PointTransactionDoc) {
    const t = tx.type || 'earned';
    if (t === 'manual_adjustment') return 'bg-blue-50 text-blue-600 border-blue-100';
    if (t === 'refund_revocation') return 'bg-red-50 text-red-600 border-red-100';
    return 'bg-emerald-50 text-emerald-600 border-emerald-100';
}

function pendingStatusConfig(status: PendingReferralDoc['status']) {
    if (status === 'waiting') return { label: 'Đang chờ', color: 'bg-amber-50 text-amber-700 border-amber-200', icon: Hourglass };
    if (status === 'matched') return { label: 'Đã khớp', color: 'bg-emerald-50 text-emerald-700 border-emerald-200', icon: CheckCircleIcon };
    if (status === 'no_order') return { label: 'Không có đơn', color: 'bg-orange-50 text-orange-600 border-orange-200', icon: XCircle };
    if (status === 'revoked') return { label: 'Đã thu hồi', color: 'bg-red-50 text-red-600 border-red-200', icon: Ban };
    return { label: 'Hết hạn', color: 'bg-gray-100 text-gray-500 border-gray-200', icon: XCircle };
}

export default function DesktopReferralHistoryPage() {
    const { user, userDoc, hasPermission, loading: authLoading } = useAuth();
    const { referralEnabled, loading: settingsLoading } = useStoreSettings();

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

    const loadData = useCallback(async () => {
        if (!user?.uid) return;
        setLoading(true);
        try {
            if (tab === 'personal') {
                const [t, pts, pending] = await Promise.all([getPointTransactions(user.uid, 50), getReferralPoints(user.uid), getPendingReferrals(user.uid, 50)]);
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

    const employees = useMemo(() => {
        const map = new Map<string, string>();
        txns.forEach(tx => { if (tx.employeeName && !map.has(tx.employeeId)) map.set(tx.employeeId, tx.employeeName); });
        return Array.from(map, ([id, name]) => ({ id, name }));
    }, [txns]);

    const [filterEmp, setFilterEmp] = useState('');
    const [filterMonth, setFilterMonth] = useState<string>('');

    // Available months from data
    const availableMonths = useMemo(() => {
        const set = new Set<string>();
        txns.forEach(tx => { try { set.add(tx.createdAt.slice(0, 7)); } catch {} });
        pendingRefs.forEach(pr => { try { set.add(pr.createdAt.slice(0, 7)); } catch {} });
        return Array.from(set).sort().reverse();
    }, [txns, pendingRefs]);

    const grouped = useMemo(() => {
        let filtered = txns;
        if (filterEmp) filtered = filtered.filter(t => t.employeeId === filterEmp);
        if (filterMonth) filtered = filtered.filter(t => t.createdAt.startsWith(filterMonth));
        const map = new Map<string, TxWithName[]>();
        filtered.forEach(tx => { const dk = dateKey(tx.createdAt); if (!map.has(dk)) map.set(dk, []); map.get(dk)!.push(tx); });
        return Array.from(map.entries());
    }, [txns, filterEmp, filterMonth]);

    // Filtered pending refs
    const filteredPendingRefs = useMemo(() => {
        let refs = pendingRefs;
        if (filterEmp) refs = refs.filter(r => r.saleEmployeeId === filterEmp);
        if (filterMonth) refs = refs.filter(r => r.createdAt.startsWith(filterMonth));
        return refs;
    }, [pendingRefs, filterEmp, filterMonth]);

    // Summary stats
    const filteredStats = useMemo(() => {
        const allFiltered = grouped.flatMap(([, items]) => items);
        const totalPts = allFiltered.reduce((s, tx) => s + (tx.isRevoked ? 0 : tx.points), 0);
        return { count: allFiltered.length, totalPts };
    }, [grouped]);
    const handleAdjust = async () => {
        const amount = parseInt(adjAmount, 10);
        const empId = adjTarget || user?.uid;
        if (!empId || isNaN(amount) || amount === 0 || !adjReason.trim() || !user?.uid) return;
        setAdjSubmitting(true);
        const res = await adjustPoints({ employeeId: empId, amount, reason: adjReason.trim(), adminId: user.uid });
        setAdjSubmitting(false);
        if (res.success) { setFeedback({ type: 'success', text: `Đã ${amount > 0 ? 'cộng' : 'trừ'} ${Math.abs(amount)} điểm.` }); setShowAdjust(false); setAdjAmount(''); setAdjReason(''); setAdjTarget(''); loadData(); }
        else setFeedback({ type: 'error', text: res.error || 'Lỗi.' });
    };
    const handleRevoke = async () => {
        if (!revokeTarget || !user?.uid) return;
        setRevoking(true);
        const res = await revokeTransaction({ transactionId: revokeTarget.id, employeeId: revokeTarget.employeeId, originalPoints: revokeTarget.points, adminId: user.uid });
        setRevoking(false);
        if (res.success) { setFeedback({ type: 'success', text: `Đã thu hồi ${revokeTarget.points} điểm.` }); setRevokeTarget(null); loadData(); }
        else setFeedback({ type: 'error', text: res.error || 'Lỗi.' });
    };
    const copyCode = async () => { try { await navigator.clipboard.writeText(refCode); setCopied(true); setTimeout(() => setCopied(false), 2000); } catch { /* */ } };

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
                if (r.matched > 0) parts.push(`✅ ${r.matched} khớp mới`);
                if (r.rematched > 0) parts.push(`🔄 ${r.rematched} khớp lại`);
                if (r.expired > 0) parts.push(`⏰ ${r.expired} hết hạn`);
                if (r.revoked > 0) parts.push(`❌ ${r.revoked} thu hồi`);
                const msg = parts.length > 0
                    ? `Đồng bộ xong (${data.totalOrders} đơn): ${parts.join(', ')}`
                    : `Đã kiểm tra ${data.totalOrders} đơn hàng. Không có thay đổi.`;
                setFeedback({ type: (r.matched > 0 || r.rematched > 0) ? 'success' : 'error', text: msg });
                loadData();
            } else {
                setFeedback({ type: 'error', text: data.error || 'Lỗi đồng bộ.' });
            }
        } catch {
            setFeedback({ type: 'error', text: 'Không thể kết nối đến Joy World.' });
        } finally {
            setSyncing(false);
        }
    };

    if (authLoading || settingsLoading) return <div className="flex justify-center py-20"><Loader2 className="w-6 h-6 animate-spin text-amber-500" /></div>;

    if (!referralEnabled) {
        return (
            <div className="flex flex-col items-center justify-center py-20 gap-4">
                <Award className="w-16 h-16 text-gray-200" />
                <p className="text-lg font-bold text-gray-400">Chương trình Referral đang tắt</p>
                <p className="text-sm text-gray-400">Quản trị viên đã tạm ngưng chương trình giới thiệu tích điểm.</p>
            </div>
        );
    }

    return (<>
        <div className="space-y-6 w-full mx-auto">
            <DashboardHeader
                showSelect={false}
                titleChildren={
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 w-full">
                        <div>
                            <h1 className="text-2xl font-bold bg-gradient-to-r from-amber-500 to-yellow-600 bg-clip-text text-transparent flex items-center gap-2">
                                <Star className="w-7 h-7 text-amber-500" />
                                Lịch sử tích điểm giới thiệu
                            </h1>
                            <p className="text-surface-500 mt-1 text-sm">
                                {canViewStore ? 'Theo dõi lịch sử tích điểm toàn cửa hàng' : 'Theo dõi điểm giới thiệu cá nhân'}
                            </p>
                        </div>

                        {/* Tabs + actions */}
                        <div className="flex items-center gap-3 shrink-0">
                            {canViewStore && (
                                <div className="flex gap-1 bg-surface-100 p-1 rounded-xl">
                                    <button onClick={() => { setTab('personal'); setFilterEmp(''); }} className={cn('px-4 py-2 rounded-lg text-xs font-bold transition-all', tab === 'personal' ? 'bg-white shadow text-amber-700' : 'text-gray-500')}>Cá nhân</button>
                                    <button onClick={() => { setTab('store'); setFilterEmp(''); }} className={cn('px-4 py-2 rounded-lg text-xs font-bold transition-all', tab === 'store' ? 'bg-white shadow text-amber-700' : 'text-gray-500')}>Toàn cửa hàng</button>
                                </div>
                            )}
                            {isAdmin && tab === 'store' && (
                                <>
                                    <button onClick={handleSync} disabled={syncing} className={cn('flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-xs font-bold transition-colors shadow-sm', syncing ? 'bg-blue-400 text-white' : 'bg-blue-500 text-white hover:bg-blue-600')}>
                                        <RefreshCw className={cn('w-3.5 h-3.5', syncing && 'animate-spin')} /> {syncing ? 'Đang đồng bộ...' : 'Đồng bộ Joy World'}
                                    </button>
                                    <button onClick={() => setShowAdjust(!showAdjust)} className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-accent-500 text-white text-xs font-bold hover:bg-accent-600 transition-colors shadow-sm">
                                        <PlusCircle className="w-3.5 h-3.5" /> Điều chỉnh điểm
                                    </button>
                                    <ExportReferralExcel txns={grouped.flatMap(([,items]) => items)} pendingRefs={filteredPendingRefs} filterMonth={filterMonth} filterEmp={filterEmp} tab={tab} />
                                </>
                            )}
                        </div>
                    </div>
                }
            />

            {/* Feedback */}
            {feedback && (
                <div className={cn('flex items-center gap-2 px-4 py-3 rounded-xl border text-sm font-medium max-w-xl', feedback.type === 'error' ? 'bg-red-50 border-red-200 text-red-700' : 'bg-emerald-50 border-emerald-200 text-emerald-700')}>
                    {feedback.type === 'error' ? <AlertTriangle className="w-4 h-4 shrink-0" /> : <CheckCircle2 className="w-4 h-4 shrink-0" />}
                    {feedback.text}
                    <button onClick={() => setFeedback(null)} className="ml-auto"><X className="w-3.5 h-3.5 text-gray-400" /></button>
                </div>
            )}

            {/* Month quick filter */}
            {!loading && availableMonths.length > 0 && (
                <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="text-xs font-bold text-gray-400 mr-1">Tháng:</span>
                    <button onClick={() => setFilterMonth('')} className={cn('px-3 py-1.5 rounded-lg text-xs font-bold transition-colors', !filterMonth ? 'bg-amber-500 text-white shadow-sm' : 'bg-gray-100 text-gray-500 hover:bg-gray-200')}>Tất cả</button>
                    {availableMonths.map(m => (
                        <button key={m} onClick={() => setFilterMonth(m)} className={cn('px-3 py-1.5 rounded-lg text-xs font-bold transition-colors', filterMonth === m ? 'bg-amber-500 text-white shadow-sm' : 'bg-gray-100 text-gray-500 hover:bg-gray-200')}>T{m.split('-')[1]}/{m.split('-')[0]}</button>
                    ))}
                </div>
            )}

            {/* Personal: Points + REF code */}
            {tab === 'personal' && (
                <div className="flex items-center gap-6 bg-gradient-to-br from-amber-50 via-yellow-50 to-amber-100 border border-amber-200 rounded-2xl p-5 max-w-2xl">
                    <span className="w-14 h-14 rounded-2xl bg-gradient-to-br from-amber-400 to-yellow-500 flex items-center justify-center shadow-lg shadow-amber-200/50 shrink-0">
                        <Award className="w-7 h-7 text-white" />
                    </span>
                    <div>
                        <p className="text-[11px] text-amber-600 font-semibold uppercase tracking-wider">Tổng điểm tích lũy</p>
                        <p className="text-3xl font-black text-amber-800 leading-tight">{totalPoints.toLocaleString('vi-VN')}</p>
                    </div>
                    {refCode && (
                        <div className="ml-auto flex items-center gap-2">
                            <button onClick={copyCode} className="flex items-center gap-3 bg-white/70 rounded-xl px-4 py-3 border border-amber-200/60 hover:bg-white transition-colors">
                                <div>
                                    <p className="text-[9px] text-amber-600/70 font-bold uppercase tracking-wider text-left">Mã giới thiệu</p>
                                    <p className="text-sm font-mono font-black text-amber-800">{refCode}</p>
                                </div>
                                {copied ? <Check className="w-4 h-4 text-emerald-500" /> : <Copy className="w-4 h-4 text-amber-500" />}
                            </button>
                            <button onClick={() => setShowQR(true)} className="flex items-center gap-2 bg-white/80 rounded-xl px-4 py-3 border border-amber-200/60 hover:bg-white transition-colors text-sm font-bold text-amber-700">
                                <QrCode className="w-5 h-5" /> QR
                            </button>
                        </div>
                    )}
                </div>
            )}

            {/* Store filter */}
            {tab === 'store' && (
                <div className="flex items-center gap-3 max-w-md">
                    <div className="relative flex-1">
                        <UserIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                        <select value={filterEmp} onChange={e => setFilterEmp(e.target.value)} className="w-full pl-10 pr-8 py-2.5 bg-white border border-gray-200 rounded-xl text-sm font-semibold appearance-none outline-none focus:ring-2 focus:ring-accent-300">
                            <option value="">Tất cả nhân viên</option>
                            {employees.map(e => <option key={e.id} value={e.id}>{e.name}</option>)}
                        </select>
                        <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400 pointer-events-none" />
                    </div>
                    {/* Month filter */}
                    <div className="relative">
                        <select value={filterMonth} onChange={e => setFilterMonth(e.target.value)} className="pl-3 pr-8 py-2.5 bg-white border border-gray-200 rounded-xl text-sm font-semibold appearance-none outline-none focus:ring-2 focus:ring-accent-300">
                            <option value="">Tất cả tháng</option>
                            {availableMonths.map(m => <option key={m} value={m}>T{m.split('-')[1]}/{m.split('-')[0]}</option>)}
                        </select>
                        <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400 pointer-events-none" />
                    </div>
                </div>
            )}

            {/* Admin: Adjust row */}
            {showAdjust && isAdmin && (
                <div className="bg-white border border-accent-200 rounded-2xl p-5 shadow-lg max-w-2xl flex flex-wrap gap-3 items-end">
                    <div className="w-48">
                        <label className="text-[10px] font-bold text-surface-500 mb-1 block">Nhân viên</label>
                        <select value={adjTarget} onChange={e => setAdjTarget(e.target.value)} className="w-full bg-surface-50 border border-surface-200 rounded-xl px-3 py-2.5 text-sm font-semibold appearance-none outline-none">
                            <option value="">Chọn NV...</option>
                            {employees.map(e => <option key={e.id} value={e.id}>{e.name}</option>)}
                        </select>
                    </div>
                    <div className="w-28">
                        <label className="text-[10px] font-bold text-surface-500 mb-1 block">Số điểm</label>
                        <input type="number" value={adjAmount} onChange={e => setAdjAmount(e.target.value)} placeholder="+10" className="w-full bg-surface-50 border border-surface-200 rounded-xl px-3 py-2.5 text-sm font-semibold outline-none" />
                    </div>
                    <div className="flex-1 min-w-[200px]">
                        <label className="text-[10px] font-bold text-surface-500 mb-1 block">Lý do *</label>
                        <input type="text" value={adjReason} onChange={e => setAdjReason(e.target.value)} placeholder="VD: Thưởng KPI..." className="w-full bg-surface-50 border border-surface-200 rounded-xl px-3 py-2.5 text-sm outline-none" />
                    </div>
                    <button onClick={handleAdjust} disabled={!adjTarget || !adjAmount || parseInt(adjAmount) === 0 || !adjReason.trim() || adjSubmitting} className={cn('px-5 py-2.5 rounded-xl font-bold text-sm transition-all', adjTarget && adjAmount && parseInt(adjAmount) !== 0 && adjReason.trim() ? 'bg-accent-500 text-white hover:bg-accent-600' : 'bg-surface-200 text-surface-400 cursor-not-allowed')}>
                        {adjSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Xác nhận'}
                    </button>
                    <button onClick={() => setShowAdjust(false)} className="p-2.5 rounded-xl hover:bg-surface-100"><X className="w-4 h-4 text-surface-400" /></button>
                </div>
            )}

            {/* Revoke confirm */}
            {revokeTarget && (
                <div className="bg-red-50 border border-red-200 rounded-2xl p-5 max-w-xl flex items-center gap-4">
                    <AlertTriangle className="w-5 h-5 text-red-500 shrink-0" />
                    <p className="text-sm text-red-700 flex-1">Thu hồi <span className="font-bold">{revokeTarget.points} điểm</span>?</p>
                    <button onClick={() => setRevokeTarget(null)} className="px-3 py-1.5 rounded-lg bg-white border border-red-200 text-red-600 text-xs font-bold">Hủy</button>
                    <button onClick={handleRevoke} disabled={revoking} className="px-3 py-1.5 rounded-lg bg-red-500 text-white text-xs font-bold disabled:opacity-50">
                        {revoking ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : 'Xác nhận'}
                    </button>
                </div>
            )}

            {/* Summary stats */}
            {!loading && grouped.length > 0 && (
                <div className="flex items-center gap-6 bg-white border border-gray-100 rounded-2xl px-6 py-4 shadow-sm max-w-2xl">
                    <div>
                        <p className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">Giao dịch</p>
                        <p className="text-xl font-black text-gray-700">{filteredStats.count}</p>
                    </div>
                    <div className="w-px h-8 bg-gray-100" />
                    <div>
                        <p className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">Điểm ròng</p>
                        <p className={cn('text-xl font-black', filteredStats.totalPts >= 0 ? 'text-emerald-600' : 'text-red-600')}>
                            {filteredStats.totalPts > 0 ? '+' : ''}{filteredStats.totalPts}
                        </p>
                    </div>
                    {filterMonth && (
                        <>
                            <div className="w-px h-8 bg-gray-100" />
                            <div>
                                <p className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">Kỳ lọc</p>
                                <p className="text-sm font-bold text-amber-600">T{filterMonth.split('-')[1]}/{filterMonth.split('-')[0]}</p>
                            </div>
                        </>
                    )}
                </div>
            )}

            {/* Pending referrals section */}
            {!loading && filteredPendingRefs.length > 0 && (
                <div>
                    <div className="flex items-center gap-2 mb-3">
                        <Hourglass className="w-4 h-4 text-amber-500" />
                        <p className="text-xs font-bold text-amber-700">Phiên giới thiệu ({filteredPendingRefs.length})</p>
                        <div className="flex-1 border-t border-amber-100" />
                    </div>
                    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="border-b border-gray-100 bg-gray-50/50">
                                    <th className="text-left px-4 py-2.5 text-[10px] font-bold text-gray-400 uppercase">Giờ</th>
                                    {tab === 'store' && <th className="text-left px-4 py-2.5 text-[10px] font-bold text-gray-400 uppercase">Nhân viên</th>}
                                    <th className="text-left px-4 py-2.5 text-[10px] font-bold text-gray-400 uppercase">Trạng thái</th>
                                    <th className="text-left px-4 py-2.5 text-[10px] font-bold text-gray-400 uppercase">Khách hàng</th>
                                    <th className="text-left px-4 py-2.5 text-[10px] font-bold text-gray-400 uppercase">Gói</th>
                                    <th className="text-left px-4 py-2.5 text-[10px] font-bold text-gray-400 uppercase">Chi tiết</th>
                                </tr>
                            </thead>
                            <tbody>
                                {filteredPendingRefs.map(pr => {
                                    const cfg = pendingStatusConfig(pr.status);
                                    const StatusIcon = cfg.icon;
                                    return (
                                        <tr key={pr.id} className={cn('border-b border-gray-50 last:border-b-0 transition-colors hover:bg-gray-50/50', pr.status === 'expired' && 'opacity-50')}>
                                            <td className="px-4 py-3">
                                                <div className="flex items-center gap-1.5">
                                                    <Clock className="w-3 h-3 text-gray-400" />
                                                    <span className="text-xs font-medium text-gray-600">{formatTime(pr.createdAt)}</span>
                                                </div>
                                            </td>
                                            {tab === 'store' && <td className="px-4 py-3 text-xs font-bold text-gray-700">{pr.saleEmployeeName}</td>}
                                            <td className="px-4 py-3">
                                                <span className={cn('text-[10px] font-bold px-2 py-0.5 rounded-full border inline-flex items-center gap-1', cfg.color)}>
                                                    <StatusIcon className="w-2.5 h-2.5" />
                                                    {cfg.label}
                                                </span>
                                            </td>
                                            <td className="px-4 py-3 text-xs font-semibold text-gray-700">{pr.customerPhone}</td>
                                            <td className="px-4 py-3">
                                                <span className="text-[10px] font-bold px-2 py-0.5 rounded-lg border bg-purple-50 text-purple-600 border-purple-100">
                                                    {pr.expectedPackage}
                                                </span>
                                            </td>
                                            <td className="px-4 py-3">
                                                <div className="text-xs text-gray-600 space-y-0.5">
                                                    {pr.matchedOrderCode && <p>Đơn: <span className="font-semibold">{pr.matchedOrderCode}</span></p>}
                                                    {pr.pointsAwarded != null && pr.pointsAwarded > 0 && <p className="text-emerald-600 font-bold">+{pr.pointsAwarded} điểm</p>}
                                                </div>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {/* Grouped table */}
            {loading ? (
                <div className="flex justify-center py-12"><Loader2 className="w-5 h-5 text-amber-500 animate-spin" /></div>
            ) : grouped.length === 0 && filteredPendingRefs.length === 0 ? (
                <div className="flex flex-col items-center py-16 gap-3">
                    <Receipt className="w-12 h-12 text-gray-200" />
                    <p className="text-sm text-gray-400 font-medium">Chưa có lịch sử tích điểm</p>
                </div>
            ) : (
                <div className="space-y-6">
                    {grouped.map(([date, items]) => (
                        <div key={date}>
                            <div className="flex items-center gap-2 mb-3">
                                <Calendar className="w-4 h-4 text-gray-400" />
                                <p className="text-xs font-bold text-gray-600">{formatDate(items[0].createdAt)}</p>
                                <div className="flex-1 border-t border-gray-100" />
                                <span className="text-[10px] font-bold text-gray-400">{items.length} giao dịch</span>
                            </div>

                            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                                <table className="w-full text-sm">
                                    <thead>
                                        <tr className="border-b border-gray-100 bg-gray-50/50">
                                            <th className="text-left px-4 py-2.5 text-[10px] font-bold text-gray-400 uppercase">Giờ</th>
                                            {tab === 'store' && <th className="text-left px-4 py-2.5 text-[10px] font-bold text-gray-400 uppercase">Nhân viên</th>}
                                            <th className="text-left px-4 py-2.5 text-[10px] font-bold text-gray-400 uppercase">Loại</th>
                                            <th className="text-left px-4 py-2.5 text-[10px] font-bold text-gray-400 uppercase">Chi tiết</th>
                                            <th className="text-right px-4 py-2.5 text-[10px] font-bold text-gray-400 uppercase">Điểm</th>
                                            {isAdmin && <th className="text-center px-4 py-2.5 text-[10px] font-bold text-gray-400 uppercase w-20"></th>}
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {items.map(tx => {
                                            const txType = tx.type || 'earned';
                                            const canRevoke = isAdmin && txType === 'earned' && !tx.isRevoked && tx.points > 0;
                                            return (
                                                <tr key={tx.id} className={cn('border-b border-gray-50 last:border-b-0 transition-colors hover:bg-gray-50/50', tx.isRevoked && 'opacity-50')}>
                                                    <td className="px-4 py-3">
                                                        <div className="flex items-center gap-1.5">
                                                            <Clock className="w-3 h-3 text-gray-400" />
                                                            <span className="text-xs font-medium text-gray-600">{formatTime(tx.createdAt)}</span>
                                                        </div>
                                                    </td>
                                                    {tab === 'store' && <td className="px-4 py-3 text-xs font-bold text-gray-700">{tx.employeeName || '—'}</td>}
                                                    <td className="px-4 py-3">
                                                        <div className="flex items-center gap-1.5">
                                                            <span className={cn('text-[10px] font-bold px-2 py-0.5 rounded-full border', txTypeBadge(tx))}>{txTypeLabel(tx)}</span>
                                                            {tx.isRevoked && <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-gray-200 text-gray-500">Đã thu hồi</span>}
                                                        </div>
                                                    </td>
                                                    <td className="px-4 py-3">
                                                        <div className="text-xs text-gray-600 space-y-0.5">
                                                            {tx.customerPhone && <p>KH: <span className="font-semibold">{tx.customerPhone}</span></p>}
                                                            {tx.packageName && (
                                                                <span className="inline-block text-[10px] font-bold px-2 py-0.5 rounded-lg border bg-purple-50 text-purple-600 border-purple-100">{tx.packageName}</span>
                                                            )}
                                                            {tx.orderCode && <p>Đơn: <span className="font-semibold">{tx.orderCode}</span></p>}
                                                            {tx.reason && <p className="text-gray-500 truncate max-w-[200px]">{tx.reason}</p>}
                                                        </div>
                                                    </td>
                                                    <td className="px-4 py-3 text-right">
                                                        <span className={cn('text-sm font-black', tx.isRevoked ? 'text-gray-400 line-through' : tx.points < 0 ? 'text-red-600' : 'text-emerald-600')}>
                                                            {tx.points > 0 ? '+' : ''}{tx.points}
                                                        </span>
                                                    </td>
                                                    {isAdmin && (
                                                        <td className="px-4 py-3 text-center">
                                                            {canRevoke && (
                                                                <button onClick={() => setRevokeTarget(tx)} className="text-[10px] font-bold text-red-500 hover:text-red-700 flex items-center gap-1 mx-auto">
                                                                    <Undo2 className="w-3 h-3" /> Thu hồi
                                                                </button>
                                                            )}
                                                        </td>
                                                    )}
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>

            {/* QR Code Modal */}
            {showQR && (
                <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-6" onClick={() => setShowQR(false)}>
                    <div className="bg-white rounded-3xl p-8 w-full max-w-sm text-center shadow-2xl" onClick={e => e.stopPropagation()}>
                        <p className="text-xl font-bold text-gray-800 mb-1">{userDoc?.name || 'Nhân viên'}</p>
                        <p className="text-sm text-gray-400 mb-5">Mã giới thiệu</p>
                        <div className="flex justify-center mb-4">
                            <QRCodeCanvas ref={qrRef} value={refCode} size={240} level="H" marginSize={2} />
                        </div>
                        <p className="text-base font-mono font-bold text-gray-700 mb-5">{refCode}</p>
                        <div className="flex gap-3">
                            <button onClick={downloadQR} className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl bg-amber-500 text-white text-sm font-bold hover:bg-amber-600 transition-colors shadow-md">
                                <Download className="w-4 h-4" /> Tải về
                            </button>
                            <button onClick={() => setShowQR(false)} className="flex-1 py-3 rounded-xl bg-gray-100 text-gray-600 text-sm font-bold hover:bg-gray-200 transition-colors">
                                Đóng
                            </button>
                        </div>
                    </div>
                </div>
            )}
    </>);
}
