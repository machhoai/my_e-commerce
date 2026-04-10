'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import {
    X, Send, Loader2, CheckCircle2, XCircle, AlertTriangle,
    Mail, MailCheck, ChevronLeft, ChevronRight,
    RefreshCw, PlusCircle, CheckSquare, Square,
    Pencil, User, MessageSquare, AtSign, Sparkles,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import type { VoucherCampaign, VoucherCode, TicketTemplateConfig } from '@/types';

type EmailFilter = 'all' | 'unsent' | 'sent';
type EmailMode = 'single' | 'multi';
type Step = 1 | 2 | 3 | 4;

interface SendResult {
    id: string;
    email: string;
    success: boolean;
    error?: string;
}

const PAGE_SIZE = 50;

// ═══════════════════════════════════════════════════════════════
// BulkEmailModal
// ═══════════════════════════════════════════════════════════════
export default function BulkEmailModal({
    campaign,
    templateConfig,
    getToken,
    onClose,
    onAddCodes,
}: {
    campaign: VoucherCampaign;
    templateConfig: TicketTemplateConfig;
    getToken: () => Promise<string | undefined>;
    onClose: () => void;
    /**
     * Triggers parent to create more codes.
     * Returns when done (resolve = số mã đã tạo thêm).
     */
    onAddCodes: (quantity: number) => Promise<void>;
}) {
    const [step, setStep] = useState<Step>(1);

    // ── Step 1 state ─────────────────────────────────────────
    const [selectionMode, setSelectionMode] = useState<'checkbox' | 'qty'>('checkbox');
    const [emailFilter, setEmailFilter] = useState<EmailFilter>('unsent');
    const [codes, setCodes] = useState<VoucherCode[]>([]);
    const [loadingCodes, setLoadingCodes] = useState(false);
    const [page, setPage] = useState(0);
    const [selected, setSelected] = useState<Set<string>>(new Set());

    // qty mode
    const [qty, setQty] = useState(10);
    const [unsentCount, setUnsentCount] = useState<number | null>(null);
    const [creatingMore, setCreatingMore] = useState(false);

    // ── Step 2: email recipients ──────────────────────────────
    const [emailMode, setEmailMode] = useState<EmailMode>('single');
    const [singleEmail, setSingleEmail] = useState('');
    const [multiEmails, setMultiEmails] = useState('');

    // ── Step 3: email composition ─────────────────────────────
    const [customSubject, setCustomSubject] = useState('');
    const [senderName, setSenderName] = useState(templateConfig.title || campaign.name);
    const [introText, setIntroText] = useState(`Chào bạn,\n\nBạn đã nhận được một voucher ưu đãi từ chúng tôi. Hãy sử dụng mã bên dưới để nhận ưu đãi đặc biệt nhé!\n\nTrân trọng,\n${templateConfig.title || campaign.name}`);

    // ── Step 4 state ─────────────────────────────────────────
    const [sending, setSending] = useState(false);
    const [results, setResults] = useState<SendResult[]>([]);
    const [sendDone, setSendDone] = useState(false);
    const [emailsSent, setEmailsSent] = useState(0);

    // ── Fetch codes for this campaign ─────────────────────────
    const fetchCodes = useCallback(async () => {
        setLoadingCodes(true);
        try {
            const token = await getToken();
            const params = new URLSearchParams({
                mode: 'codes',
                campaignId: campaign.id,
                status: 'distributed',
                pageSize: '5000', // fetch all distributed for this campaign
            });
            const res = await fetch(`/api/vouchers?${params}`, { headers: { Authorization: `Bearer ${token}` } });
            const data = await res.json();
            const allCodes: VoucherCode[] = data.codes || [];
            setCodes(allCodes);
            setUnsentCount(allCodes.filter(c => !c.emailedAt).length);
        } catch {
            // silent
        } finally {
            setLoadingCodes(false);
        }
    }, [campaign.id, getToken]);

    useEffect(() => { fetchCodes(); }, [fetchCodes]);

    // ── Filtered + paginated codes ────────────────────────────
    const filteredCodes = useMemo(() => {
        if (emailFilter === 'unsent') return codes.filter(c => !c.emailedAt);
        if (emailFilter === 'sent') return codes.filter(c => !!c.emailedAt);
        return codes;
    }, [codes, emailFilter]);

    const totalPages = Math.max(1, Math.ceil(filteredCodes.length / PAGE_SIZE));
    const pageCodes = filteredCodes.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

    // Auto-select for qty mode
    const qtySelectedIds = useMemo(() => {
        const unsent = codes.filter(c => !c.emailedAt);
        return unsent.slice(0, qty).map(c => c.id);
    }, [codes, qty]);

    const activeIds: string[] = selectionMode === 'checkbox' ? [...selected] : qtySelectedIds;
    const insufficient = selectionMode === 'qty' && qty > (unsentCount ?? 0);
    const shortage = insufficient ? qty - (unsentCount ?? 0) : 0;

    // ── Select helpers ────────────────────────────────────────
    const toggleOne = (id: string) => setSelected(prev => {
        const next = new Set(prev);
        next.has(id) ? next.delete(id) : next.add(id);
        return next;
    });
    const togglePage = () => {
        const pageIds = pageCodes.map(c => c.id);
        const allOnPage = pageIds.every(id => selected.has(id));
        setSelected(prev => {
            const next = new Set(prev);
            pageIds.forEach(id => allOnPage ? next.delete(id) : next.add(id));
            return next;
        });
    };

    // ── Validate step 2 emails ────────────────────────────────
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    const parsedEmails = useMemo(() => {
        if (emailMode === 'single') return singleEmail ? [singleEmail] : [];
        return multiEmails.split('\n').map(e => e.trim()).filter(Boolean);
    }, [emailMode, singleEmail, multiEmails]);

    const emailsValid = useMemo(() => {
        if (emailMode === 'single') return emailRegex.test(singleEmail);
        return parsedEmails.length > 0 && parsedEmails.every(e => emailRegex.test(e));
    }, [emailMode, singleEmail, parsedEmails]);

    const emailCountMismatch = emailMode === 'multi' && parsedEmails.length > 0 && parsedEmails.length !== activeIds.length;

    // ── Step 4: Send ──────────────────────────────────────────
    const handleSend = async () => {
        setSending(true);
        setSendDone(false);
        setResults([]);
        try {
            const token = await getToken();
            const body: Record<string, unknown> = {
                voucherCodeIds: activeIds,
                campaignId: campaign.id,
                templateConfig,
                // Composition fields
                customSubject: customSubject.trim() || undefined,
                senderName: senderName.trim() || undefined,
                introText: introText.trim() || undefined,
            };
            if (emailMode === 'single') {
                body.singleEmail = singleEmail;
            } else {
                body.emails = parsedEmails;
            }
            const res = await fetch('/api/vouchers/send-email', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
                body: JSON.stringify(body),
            });
            const data = await res.json();
            setResults(data.results || []);
            setEmailsSent(data.emailsSent ?? 0);
        } catch {
            setResults([{ id: '?', email: '?', success: false, error: 'Lỗi kết nối' }]);
        } finally {
            setSending(false);
            setSendDone(true);
            await fetchCodes();
        }
    };

    // ── Handle create more codes ──────────────────────────────
    const handleCreateMore = async () => {
        setCreatingMore(true);
        try {
            await onAddCodes(shortage);
            await fetchCodes();
        } finally {
            setCreatingMore(false);
        }
    };

    // ── UI ────────────────────────────────────────────────────
    const stepLabels = ['Chọn voucher', 'Địa chỉ email', 'Soạn nội dung', 'Gửi & Kết quả'];

    return (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl max-h-[92vh] flex flex-col overflow-hidden">

                {/* Header */}
                <div className="flex items-center justify-between px-6 py-4 border-b border-surface-100">
                    <div className="flex items-center gap-3">
                        <Send className="w-5 h-5 text-accent-500" />
                        <h2 className="text-base font-bold text-surface-800">Gửi Email hàng loạt</h2>
                        <span className="text-xs text-surface-400 font-medium">{campaign.name}</span>
                    </div>
                    <button onClick={onClose} className="p-2 rounded-xl hover:bg-surface-100 text-surface-400 transition-colors">
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Step indicator */}
                <div className="flex items-center gap-0 px-6 py-3 bg-surface-50 border-b border-surface-100">
                    {stepLabels.map((label, i) => {
                        const s = (i + 1) as Step;
                        return (
                            <div key={s} className="flex items-center flex-1">
                                <div className={cn(
                                    'flex items-center gap-2 text-xs font-semibold px-3 py-1.5 rounded-full transition-all',
                                    step === s ? 'bg-accent-500 text-white' : step > s ? 'text-success-600' : 'text-surface-400',
                                )}>
                                    {step > s ? <CheckCircle2 className="w-3.5 h-3.5" /> : <span className="w-4 h-4 rounded-full border-2 flex items-center justify-center text-[10px]">{s}</span>}
                                    {label}
                                </div>
                                {i < 2 && <div className="flex-1 h-px bg-surface-200 mx-2" />}
                            </div>
                        );
                    })}
                </div>

                {/* Body */}
                <div className="flex-1 overflow-y-auto">
                    {/* ════ STEP 1 ════ */}
                    {step === 1 && (
                        <div className="p-5 space-y-4">
                            {/* Mode tabs */}
                            <div className="flex gap-2 p-1 bg-surface-100 rounded-xl w-fit">
                                {[['checkbox', 'Chọn thủ công'] as const, ['qty', 'Nhập số lượng'] as const].map(([mode, label]) => (
                                    <button key={mode} onClick={() => setSelectionMode(mode)}
                                        className={cn('px-4 py-2 text-sm rounded-lg font-semibold transition-all',
                                            selectionMode === mode ? 'bg-white text-surface-800 shadow-sm' : 'text-surface-500')}>
                                        {label}
                                    </button>
                                ))}
                            </div>

                            {/* ── Checkbox mode ── */}
                            {selectionMode === 'checkbox' && (
                                <>
                                    {/* Filter + stats */}
                                    <div className="flex items-center justify-between">
                                        <div className="flex gap-1.5">
                                            {(['all', 'unsent', 'sent'] as EmailFilter[]).map(f => (
                                                <button key={f} onClick={() => { setEmailFilter(f); setPage(0); }}
                                                    className={cn('px-3 py-1.5 text-xs rounded-lg font-semibold border transition-all',
                                                        emailFilter === f ? 'bg-accent-500 text-white border-accent-500' : 'bg-white text-surface-600 border-surface-200')}>
                                                    {f === 'all' ? 'Tất cả' : f === 'unsent' ? 'Chưa gửi' : 'Đã gửi'}
                                                    <span className="ml-1.5 opacity-70">
                                                        ({f === 'all' ? codes.length : f === 'unsent' ? (unsentCount ?? '…') : codes.filter(c => !!c.emailedAt).length})
                                                    </span>
                                                </button>
                                            ))}
                                        </div>
                                        <span className="text-xs text-surface-500">
                                            <strong>{selected.size}</strong> đã chọn
                                        </span>
                                    </div>

                                    {/* Table */}
                                    <div className="border border-surface-200 rounded-xl overflow-hidden">
                                        {loadingCodes ? (
                                            <div className="p-8 text-center text-surface-400">
                                                <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2" />
                                                Đang tải...
                                            </div>
                                        ) : (
                                            <table className="w-full text-sm">
                                                <thead className="bg-surface-50 text-xs text-surface-500 border-b border-surface-100">
                                                    <tr>
                                                        <th className="pl-4 pr-2 py-3 w-10">
                                                            <button onClick={togglePage}>
                                                                {pageCodes.every(c => selected.has(c.id))
                                                                    ? <CheckSquare className="w-4 h-4 text-accent-500" />
                                                                    : <Square className="w-4 h-4 text-surface-400" />}
                                                            </button>
                                                        </th>
                                                        <th className="px-3 py-3 font-semibold text-left">Mã voucher</th>
                                                        <th className="px-3 py-3 font-semibold text-center">Trạng thái email</th>
                                                    </tr>
                                                </thead>
                                                <tbody className="divide-y divide-surface-50">
                                                    {pageCodes.map(c => (
                                                        <tr key={c.id}
                                                            onClick={() => toggleOne(c.id)}
                                                            className={cn('cursor-pointer transition-colors', selected.has(c.id) ? 'bg-accent-50/40' : 'hover:bg-surface-50/60')}>
                                                            <td className="pl-4 pr-2 py-2.5">
                                                                {selected.has(c.id)
                                                                    ? <CheckSquare className="w-4 h-4 text-accent-500" />
                                                                    : <Square className="w-4 h-4 text-surface-300" />}
                                                            </td>
                                                            <td className="px-3 py-2.5 font-mono font-bold text-surface-800 text-xs tracking-wide">
                                                                {c.id}
                                                            </td>
                                                            <td className="px-3 py-2.5 text-center">
                                                                {c.emailedAt ? (
                                                                    <div className="flex flex-col items-center gap-0.5">
                                                                        <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-success-600 bg-success-50 border border-success-200 rounded-full px-2 py-0.5">
                                                                            <MailCheck className="w-3 h-3" /> Đã gửi
                                                                        </span>
                                                                        <span className="text-[10px] text-surface-400">{c.emailedTo}</span>
                                                                    </div>
                                                                ) : (
                                                                    <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-surface-400 bg-surface-100 border border-surface-200 rounded-full px-2 py-0.5">
                                                                        <Mail className="w-3 h-3" /> Chưa gửi
                                                                    </span>
                                                                )}
                                                            </td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                        )}
                                    </div>

                                    {/* Pagination */}
                                    {totalPages > 1 && (
                                        <div className="flex items-center justify-center gap-3">
                                            <button onClick={() => setPage(p => Math.max(0, p - 1))} disabled={page === 0}
                                                className="p-1.5 rounded-lg border border-surface-200 disabled:opacity-40 hover:bg-surface-50">
                                                <ChevronLeft className="w-4 h-4" />
                                            </button>
                                            <span className="text-xs text-surface-500">Trang {page + 1}/{totalPages}</span>
                                            <button onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))} disabled={page >= totalPages - 1}
                                                className="p-1.5 rounded-lg border border-surface-200 disabled:opacity-40 hover:bg-surface-50">
                                                <ChevronRight className="w-4 h-4" />
                                            </button>
                                        </div>
                                    )}
                                </>
                            )}

                            {/* ── Qty mode ── */}
                            {selectionMode === 'qty' && (
                                <div className="space-y-4">
                                    <div className="flex items-center gap-4">
                                        <div className="flex-1">
                                            <label className="text-sm font-semibold text-surface-700 block mb-1.5">Số lượng cần gửi</label>
                                            <input
                                                type="number" min={1} value={qty}
                                                onChange={e => setQty(Math.max(1, Number(e.target.value)))}
                                                className="w-full bg-surface-50 border border-surface-200 rounded-xl p-3 text-lg font-bold text-surface-800 focus:ring-accent-500 focus:border-accent-400"
                                            />
                                        </div>
                                        <div className="flex-1 bg-surface-50 rounded-xl border border-surface-200 p-4">
                                            <p className="text-xs text-surface-500 mb-1">Voucher chưa gửi</p>
                                            <p className="text-2xl font-black text-surface-800">{unsentCount ?? '…'}</p>
                                        </div>
                                    </div>

                                    {/* Insufficient warning */}
                                    {insufficient && (
                                        <div className="bg-warning-50 border border-warning-200 rounded-xl p-4">
                                            <div className="flex items-start gap-3">
                                                <AlertTriangle className="w-5 h-5 text-warning-600 mt-0.5 shrink-0" />
                                                <div className="flex-1">
                                                    <p className="text-sm font-bold text-warning-700">
                                                        Chỉ còn {unsentCount} voucher chưa gửi, thiếu <strong>{shortage}</strong> mã.
                                                    </p>
                                                    <p className="text-xs text-warning-600 mt-0.5">Bạn muốn tạo thêm {shortage} mã mới?</p>
                                                    <div className="flex gap-2 mt-3">
                                                        <button onClick={handleCreateMore} disabled={creatingMore}
                                                            className="flex items-center gap-1.5 px-4 py-2 bg-warning-500 hover:bg-warning-600 disabled:opacity-60 text-white text-xs font-bold rounded-lg transition-colors">
                                                            {creatingMore ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <PlusCircle className="w-3.5 h-3.5" />}
                                                            Tạo thêm {shortage} mã
                                                        </button>
                                                        <button onClick={() => setQty(unsentCount ?? 0)}
                                                            className="px-4 py-2 bg-white border border-warning-200 text-warning-700 text-xs font-bold rounded-lg hover:bg-warning-50 transition-colors">
                                                            Dùng {unsentCount} mã có sẵn
                                                        </button>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    )}

                                    {/* Preview selected */}
                                    {!insufficient && qtySelectedIds.length > 0 && (
                                        <div className="bg-success-50 border border-success-200 rounded-xl p-3">
                                            <p className="text-xs font-medium text-success-700">
                                                ✓ Sẽ gửi <strong>{qtySelectedIds.length}</strong> mã (chưa từng gửi email), chọn FIFO.
                                            </p>
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    )}

                    {/* ════ STEP 2: Email Recipients ════ */}
                    {step === 2 && (
                        <div className="p-5 space-y-5">
                            <div className="flex items-center gap-3 bg-accent-50 border border-accent-100 rounded-xl p-4">
                                <AtSign className="w-5 h-5 text-accent-600 shrink-0" />
                                <p className="text-sm text-surface-700">
                                    Sẽ gửi <strong className="text-accent-600">{activeIds.length}</strong> voucher — nhập địa chỉ email nhận.
                                </p>
                            </div>

                            {/* Mode select */}
                            <div>
                                <label className="text-xs font-bold text-surface-500 uppercase tracking-wide block mb-2">Chế độ nhập email</label>
                                <div className="flex gap-2 p-1 bg-surface-100 rounded-xl w-fit">
                                    {[['single', 'Một địa chỉ (gửi tất cả)'] as const, ['multi', 'Từng địa chỉ (map theo thứ tự)'] as const].map(([m, label]) => (
                                        <button key={m} onClick={() => setEmailMode(m)}
                                            className={cn('px-3 py-2 text-xs font-semibold rounded-lg transition-all',
                                                emailMode === m ? 'bg-white text-surface-800 shadow-sm' : 'text-surface-500')}>
                                            {label}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {emailMode === 'single' ? (
                                <div>
                                    <label className="text-xs font-bold text-surface-500 uppercase tracking-wide block mb-1.5">Địa chỉ email</label>
                                    <div className="relative">
                                        <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-surface-400" />
                                        <input
                                            type="email" value={singleEmail}
                                            onChange={e => setSingleEmail(e.target.value)}
                                            placeholder="nguoinhận@email.com"
                                            className="w-full bg-surface-50 border border-surface-200 rounded-xl pl-10 pr-4 py-3 text-sm focus:ring-1 focus:ring-accent-300 focus:border-accent-400 outline-none transition-all"
                                        />
                                    </div>
                                    <p className="text-xs text-surface-400 mt-1.5">
                                        Tất cả {activeIds.length} voucher sẽ được gửi đến địa chỉ này (mỗi voucher 1 email riêng).
                                    </p>
                                </div>
                            ) : (
                                <div>
                                    <label className="text-xs font-bold text-surface-500 uppercase tracking-wide block mb-1.5">
                                        Danh sách email <span className="text-surface-400 font-normal normal-case">(1 dòng = 1 email)</span>
                                    </label>
                                    <textarea
                                        value={multiEmails}
                                        onChange={e => setMultiEmails(e.target.value)}
                                        placeholder={"email1@gmail.com\nemail2@gmail.com\nemail3@gmail.com"}
                                        rows={8}
                                        className="w-full bg-surface-50 border border-surface-200 rounded-xl p-3 text-sm font-mono resize-none focus:ring-1 focus:ring-accent-300 focus:border-accent-400 outline-none transition-all"
                                    />
                                    <div className="flex items-center justify-between mt-1">
                                        <p className="text-xs text-surface-400">{parsedEmails.length} địa chỉ đã nhập</p>
                                        {emailCountMismatch && (
                                            <p className="text-xs text-danger-500 font-semibold">
                                                ⚠ Cần đúng {activeIds.length} email (đang có {parsedEmails.length})
                                            </p>
                                        )}
                                    </div>
                                </div>
                            )}
                        </div>
                    )}

                    {/* ════ STEP 3: Email Composition ════ */}
                    {step === 3 && (
                        <div className="p-5 space-y-5">
                            <div className="flex items-center gap-3 bg-primary-50 border border-primary-100 rounded-xl p-4">
                                <Pencil className="w-5 h-5 text-primary-500 shrink-0" />
                                <div>
                                    <p className="text-sm font-semibold text-surface-700">Soạn nội dung email</p>
                                    <p className="text-xs text-surface-400 mt-0.5">Tùy chỉnh chủ đề, tên người gửi và nội dung giới thiệu.</p>
                                </div>
                            </div>

                            {/* Sender name */}
                            <div>
                                <label className="text-xs font-bold text-surface-500 uppercase tracking-wide flex items-center gap-1.5 mb-2">
                                    <User className="w-3.5 h-3.5" /> Tên người gửi
                                </label>
                                <input
                                    type="text"
                                    value={senderName}
                                    onChange={e => setSenderName(e.target.value)}
                                    placeholder={campaign.name}
                                    className="w-full bg-surface-50 border border-surface-200 rounded-xl px-4 py-3 text-sm focus:ring-1 focus:ring-accent-300 focus:border-accent-400 outline-none transition-all"
                                />
                                <p className="text-xs text-surface-400 mt-1">Hiển thị là: <em>{senderName || campaign.name} &lt;noreply@...&gt;</em></p>
                            </div>

                            {/* Subject */}
                            <div>
                                <label className="text-xs font-bold text-surface-500 uppercase tracking-wide flex items-center gap-1.5 mb-2">
                                    <Sparkles className="w-3.5 h-3.5" /> Chủ đề email
                                </label>
                                <input
                                    type="text"
                                    value={customSubject}
                                    onChange={e => setCustomSubject(e.target.value)}
                                    placeholder={`Voucher ưu đãi — ${templateConfig.title || campaign.name}`}
                                    className="w-full bg-surface-50 border border-surface-200 rounded-xl px-4 py-3 text-sm focus:ring-1 focus:ring-accent-300 focus:border-accent-400 outline-none transition-all"
                                />
                                <p className="text-xs text-surface-400 mt-1">Để trống sẽ dùng chủ đề mặc định theo loại ưu đãi.</p>
                            </div>

                            {/* Intro text */}
                            <div>
                                <label className="text-xs font-bold text-surface-500 uppercase tracking-wide flex items-center gap-1.5 mb-2">
                                    <MessageSquare className="w-3.5 h-3.5" /> Nội dung giới thiệu
                                </label>
                                <textarea
                                    value={introText}
                                    onChange={e => setIntroText(e.target.value)}
                                    rows={7}
                                    placeholder="Nhập nội dung lời chào, giới thiệu voucher..."
                                    className="w-full bg-surface-50 border border-surface-200 rounded-xl px-4 py-3 text-sm resize-none focus:ring-1 focus:ring-accent-300 focus:border-accent-400 outline-none transition-all"
                                />
                                <p className="text-xs text-surface-400 mt-1">Nội dung này sẽ xuất hiện phía trên vé trong email. Để trống nếu không muốn thêm lời chào.</p>
                            </div>
                        </div>
                    )}

                    {/* ════ STEP 4: Send & Results ════ */}
                    {step === 4 && (
                        <div className="p-5 space-y-4">
                            {!sendDone ? (
                                <div className="text-center py-10">
                                    <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-accent-400 to-accent-600 flex items-center justify-center mx-auto mb-5 shadow-lg shadow-accent-200">
                                        <Send className="w-9 h-9 text-white" />
                                    </div>
                                    <h3 className="text-lg font-bold text-surface-800 mb-2">Xác nhận gửi email</h3>
                                    <div className="text-sm text-surface-500 mb-2 space-y-1">
                                        <p>Gửi <strong className="text-accent-600">{activeIds.length}</strong> voucher đến{' '}
                                        <strong>{emailMode === 'single' ? singleEmail : `${parsedEmails.length} địa chỉ`}</strong></p>
                                        {emailMode === 'single' && activeIds.length > 1 && (
                                            <p className="text-xs text-primary-600 bg-primary-50 border border-primary-100 rounded-lg px-3 py-1.5">
                                                ✦ {activeIds.length} voucher sẽ được gộp vào <strong>1 email duy nhất</strong>
                                            </p>
                                        )}
                                        {senderName && <p>Người gửi: <em>{senderName}</em></p>}
                                        {customSubject && <p>Chủ đề: <em>{customSubject}</em></p>}
                                    </div>
                                    <button onClick={handleSend} disabled={sending}
                                        className="flex items-center gap-2 mx-auto mt-6 px-8 py-3 bg-gradient-to-r from-accent-500 to-amber-500 hover:from-accent-600 hover:to-amber-600 disabled:bg-surface-300 text-white font-bold rounded-xl transition-all shadow-md shadow-accent-200 active:scale-95">
                                        {sending ? <><Loader2 className="w-5 h-5 animate-spin" /> Đang gửi...</> : <><Send className="w-5 h-5" /> Gửi ngay</>}
                                    </button>
                                </div>
                            ) : (
                                <>
                                    {/* Summary */}
                                    <div className="grid grid-cols-3 gap-3">
                                        <div className="bg-primary-50 border border-primary-200 rounded-xl p-4 text-center">
                                            <Mail className="w-6 h-6 text-primary-500 mx-auto mb-1" />
                                            <p className="text-2xl font-black text-primary-700">{emailsSent}</p>
                                            <p className="text-xs text-primary-600 font-medium">Email đã gửi</p>
                                        </div>
                                        <div className="bg-success-50 border border-success-200 rounded-xl p-4 text-center">
                                            <CheckCircle2 className="w-6 h-6 text-success-500 mx-auto mb-1" />
                                            <p className="text-2xl font-black text-success-700">{results.filter(r => r.success).length}</p>
                                            <p className="text-xs text-success-600 font-medium">Voucher thành công</p>
                                        </div>
                                        <div className="bg-danger-50 border border-danger-200 rounded-xl p-4 text-center">
                                            <XCircle className="w-6 h-6 text-danger-500 mx-auto mb-1" />
                                            <p className="text-2xl font-black text-danger-700">{results.filter(r => !r.success).length}</p>
                                            <p className="text-xs text-danger-600 font-medium">Voucher thất bại</p>
                                        </div>
                                    </div>

                                    {/* Result table */}
                                    {results.length > 0 && (
                                        <div className="border border-surface-200 rounded-xl overflow-hidden max-h-60 overflow-y-auto">
                                            <table className="w-full text-xs">
                                                <thead className="bg-surface-50 text-surface-500 sticky top-0">
                                                    <tr>
                                                        <th className="px-3 py-2.5 text-left font-semibold">Mã</th>
                                                        <th className="px-3 py-2.5 text-left font-semibold">Email</th>
                                                        <th className="px-3 py-2.5 text-center font-semibold">Kết quả</th>
                                                    </tr>
                                                </thead>
                                                <tbody className="divide-y divide-surface-50">
                                                    {results.map(r => (
                                                        <tr key={r.id} className={r.success ? '' : 'bg-danger-50/30'}>
                                                            <td className="px-3 py-2 font-mono font-bold text-surface-700">{r.id}</td>
                                                            <td className="px-3 py-2 text-surface-500">{r.email}</td>
                                                            <td className="px-3 py-2 text-center">
                                                                {r.success
                                                                    ? <span className="text-success-600 font-semibold">✓ OK</span>
                                                                    : <span className="text-danger-500" title={r.error}>✗ Lỗi</span>}
                                                            </td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                        </div>
                                    )}

                                    {/* Retry failed */}
                                    {results.some(r => !r.success) && (
                                        <button
                                            onClick={() => {
                                                const failedIds = results.filter(r => !r.success).map(r => r.id);
                                                // rebuild selection from failed
                                                setSelected(new Set(failedIds));
                                                setSelectionMode('checkbox');
                                                setSendDone(false);
                                                setResults([]);
                                                setStep(2);
                                            }}
                                            className="flex items-center gap-2 px-4 py-2 bg-danger-500 hover:bg-danger-600 text-white text-sm font-semibold rounded-xl transition-colors"
                                        >
                                            <RefreshCw className="w-4 h-4" />
                                            Gửi lại {results.filter(r => !r.success).length} mã lỗi
                                        </button>
                                    )}
                                </>
                            )}
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="flex items-center justify-between px-6 py-4 border-t border-surface-100 bg-surface-50/50">
                    <button
                        onClick={() => step > 1 ? setStep(s => (s - 1) as Step) : onClose()}
                        className="flex items-center gap-2 px-4 py-2.5 bg-white hover:bg-surface-100 text-surface-700 border border-surface-200 text-sm font-semibold rounded-xl transition-all active:scale-95"
                    >
                        <ChevronLeft className="w-4 h-4" />
                        {step === 1 ? 'Hủy' : 'Quay lại'}
                    </button>

                    <div className="flex items-center gap-2">
                        {step === 1 && (
                            <button
                                onClick={() => setStep(2)}
                                disabled={activeIds.length === 0 || (insufficient && !creatingMore)}
                                className="flex items-center gap-2 px-6 py-2.5 bg-accent-500 hover:bg-accent-600 disabled:bg-surface-300 text-white text-sm font-semibold rounded-xl transition-all active:scale-95"
                            >
                                Tiếp theo ({activeIds.length} mã)
                                <ChevronRight className="w-4 h-4" />
                            </button>
                        )}
                        {step === 2 && (
                            <button
                                onClick={() => setStep(3)}
                                disabled={!emailsValid || emailCountMismatch}
                                className="flex items-center gap-2 px-6 py-2.5 bg-accent-500 hover:bg-accent-600 disabled:bg-surface-300 text-white text-sm font-semibold rounded-xl transition-all active:scale-95"
                            >
                                Tiếp theo: Soạn nội dung
                                <ChevronRight className="w-4 h-4" />
                            </button>
                        )}
                        {step === 3 && (
                            <button
                                onClick={() => setStep(4)}
                                className="flex items-center gap-2 px-6 py-2.5 bg-accent-500 hover:bg-accent-600 text-white text-sm font-semibold rounded-xl transition-all active:scale-95"
                            >
                                Xem trước & Gửi
                                <ChevronRight className="w-4 h-4" />
                            </button>
                        )}
                        {step === 4 && sendDone && (
                            <button onClick={onClose}
                                className="px-6 py-2.5 bg-surface-800 hover:bg-surface-900 text-white text-sm font-semibold rounded-xl transition-all active:scale-95">
                                Đóng
                            </button>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
