'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import html2canvas from 'html2canvas';
import {
    X, Palette, Save, Download, Printer, Send,
    ImagePlus, Eye, CheckCircle2, Loader2,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import type { VoucherCampaign, TicketTemplateConfig, VoucherRewardType } from '@/types';

const QR_SIZES = { sm: 100, md: 140, lg: 180 } as const;

const REWARD_LABELS: Record<VoucherRewardType, string> = {
    discount_percent: 'Giảm %',
    discount_fixed: 'Giảm tiền',
    free_ticket: 'Vé miễn phí',
    free_item: 'Tặng sản phẩm',
};

function formatReward(type: VoucherRewardType, value: number) {
    if (type === 'discount_percent') return `Giảm ${value}%`;
    if (type === 'discount_fixed') return `Giảm ${value.toLocaleString('vi-VN')}đ`;
    if (type === 'free_ticket') return 'Vé miễn phí';
    return `Tặng sản phẩm`;
}

const DEFAULT_TPL = (campaign: VoucherCampaign): TicketTemplateConfig => ({
    bgColor: '#1e293b',
    accentColor: '#f59e0b',
    logoUrl: campaign.image || '',
    title: campaign.name,
    showExpiry: true,
    showDescription: true,
    showRewardValue: true,
    qrSize: 'md',
});

// ── Ticket Preview Card ──────────────────────────────────────────
function TicketPreview({
    campaign,
    tpl,
    sampleCode = 'DEMO-XXXX-00',
    previewRef,
}: {
    campaign: VoucherCampaign;
    tpl: TicketTemplateConfig;
    sampleCode?: string;
    previewRef?: React.RefObject<HTMLDivElement | null>;
}) {
    const qrPx = QR_SIZES[tpl.qrSize];
    const expiryDisplay = campaign.validTo
        ? new Date(campaign.validTo + 'T00:00:00').toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' })
        : '';

    return (
        <div
            ref={previewRef}
            style={{ background: '#f1f5f9', borderRadius: 16, padding: 2 }}
        >
            <div
                style={{
                    background: '#fff',
                    borderRadius: 14,
                    overflow: 'hidden',
                    boxShadow: '0 8px 32px rgba(0,0,0,0.12)',
                    width: '100%',
                    maxWidth: 520,
                    margin: '0 auto',
                }}
            >
                {/* Header */}
                <div style={{ background: tpl.bgColor, padding: '20px 24px' }}>
                    {tpl.logoUrl && (
                        <img src={tpl.logoUrl} alt="logo" style={{ height: 36, marginBottom: 10, display: 'block', objectFit: 'contain' }} />
                    )}
                    <h2 style={{ margin: 0, color: '#fff', fontSize: 18, fontWeight: 800, letterSpacing: -0.3 }}>
                        {tpl.title || campaign.name}
                    </h2>
                    {tpl.showDescription && campaign.description && (
                        <p style={{ margin: '4px 0 0', color: 'rgba(255,255,255,0.7)', fontSize: 12 }}>
                            {campaign.description}
                        </p>
                    )}
                </div>

                {/* Body */}
                <div style={{ padding: '20px 24px', display: 'flex', gap: 20, alignItems: 'flex-start' }}>
                    {/* Info */}
                    <div style={{ flex: 1 }}>
                        {tpl.showRewardValue && (
                            <div style={{
                                background: `${tpl.accentColor}20`,
                                border: `2px solid ${tpl.accentColor}`,
                                borderRadius: 8,
                                padding: '8px 14px',
                                display: 'inline-block',
                                marginBottom: 14,
                            }}>
                                <span style={{ color: tpl.accentColor, fontWeight: 800, fontSize: 16 }}>
                                    {formatReward(campaign.rewardType, campaign.rewardValue)}
                                </span>
                            </div>
                        )}
                        <p style={{ margin: '0 0 4px', fontSize: 10, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: 0.5 }}>
                            Mã voucher
                        </p>
                        <p style={{ margin: '0 0 14px', fontSize: 18, fontWeight: 900, color: '#1e293b', letterSpacing: 2, fontFamily: 'monospace' }}>
                            {sampleCode}
                        </p>
                        {tpl.showExpiry && expiryDisplay && (
                            <>
                                <p style={{ margin: '0 0 2px', fontSize: 10, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: 0.5 }}>
                                    Hết hạn
                                </p>
                                <p style={{ margin: 0, fontSize: 12, fontWeight: 600, color: '#475569' }}>
                                    {expiryDisplay}
                                </p>
                            </>
                        )}
                    </div>

                    {/* QR */}
                    <div style={{ textAlign: 'center', flexShrink: 0 }}>
                        <div style={{ background: '#fff', padding: 6, borderRadius: 8, border: '1px solid #e2e8f0', display: 'inline-block' }}>
                            <QRCodeSVG value={sampleCode} size={qrPx} bgColor="#FFFFFF" fgColor={tpl.bgColor} />
                        </div>
                        <p style={{ margin: '6px 0 0', fontSize: 10, color: '#94a3b8' }}>Quét để sử dụng</p>
                    </div>
                </div>

                {/* Dashed divider */}
                <div style={{ padding: '0 24px' }}>
                    <div style={{ borderTop: '2px dashed #e2e8f0' }} />
                </div>
                <div style={{ padding: '12px 24px 20px', textAlign: 'center' }}>
                    <p style={{ margin: 0, fontSize: 11, color: '#94a3b8' }}>
                        Vui lòng không chia sẻ mã với người khác.
                    </p>
                </div>
            </div>
        </div>
    );
}

// ═══════════════════════════════════════════════════════════════
// TicketDesigner Modal
// ═══════════════════════════════════════════════════════════════
export default function TicketDesigner({
    campaign,
    getToken,
    onClose,
    onOpenBulkEmail,
}: {
    campaign: VoucherCampaign;
    getToken: () => Promise<string | undefined>;
    onClose: () => void;
    onOpenBulkEmail: (tpl: TicketTemplateConfig) => void;
}) {
    const [tpl, setTpl] = useState<TicketTemplateConfig>(() => campaign.ticketTemplate ?? DEFAULT_TPL(campaign));
    const [saving, setSaving] = useState(false);
    const [exporting, setExporting] = useState(false);
    const [saved, setSaved] = useState(false);
    const previewRef = useRef<HTMLDivElement | null>(null);

    const up = <K extends keyof TicketTemplateConfig>(key: K, val: TicketTemplateConfig[K]) =>
        setTpl(p => ({ ...p, [key]: val }));

    // ── Save template to Firestore ───────────────────────────
    const handleSave = async () => {
        setSaving(true);
        try {
            const token = await getToken();
            const res = await fetch('/api/vouchers', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
                body: JSON.stringify({ action: 'update_campaign', campaignId: campaign.id, ticketTemplate: tpl }),
            });
            if (!res.ok) throw new Error();
            setSaved(true);
            setTimeout(() => setSaved(false), 2500);
        } catch {
            alert('Lưu mẫu thất bại!');
        } finally {
            setSaving(false);
        }
    };

    // ── Export PNG ───────────────────────────────────────────
    const handleExportPng = async () => {
        if (!previewRef.current) return;
        setExporting(true);
        try {
            const canvas = await html2canvas(previewRef.current, { scale: 2, useCORS: true, backgroundColor: null });
            const link = document.createElement('a');
            link.download = `voucher-${campaign.name.replace(/\s+/g, '-')}.png`;
            link.href = canvas.toDataURL('image/png');
            link.click();
        } finally {
            setExporting(false);
        }
    };

    // ── Print ────────────────────────────────────────────────
    const handlePrint = () => {
        if (!previewRef.current) return;
        const html = previewRef.current.innerHTML;
        const win = window.open('', '_blank', 'width=700,height=500');
        if (!win) return;
        win.document.write(`<!DOCTYPE html><html><head><title>In Voucher</title><style>body{margin:0;padding:16px;font-family:'Segoe UI',Arial,sans-serif;}@media print{body{padding:0;}}</style></head><body>${html}</body></html>`);
        win.document.close();
        win.onload = () => { win.print(); win.close(); };
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-5xl max-h-[92vh] flex flex-col overflow-hidden">
                {/* Modal Header */}
                <div className="flex items-center justify-between px-6 py-4 border-b border-surface-100">
                    <div className="flex items-center gap-2">
                        <Palette className="w-5 h-5 text-accent-500" />
                        <h2 className="text-lg font-bold text-surface-800">Thiết kế vé — {campaign.name}</h2>
                    </div>
                    <button onClick={onClose} className="p-2 rounded-xl hover:bg-surface-100 text-surface-400 hover:text-surface-700 transition-colors">
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Body */}
                <div className="flex flex-1 overflow-hidden divide-x divide-surface-100">
                    {/* LEFT — Config */}
                    <div className="w-72 shrink-0 overflow-y-auto p-5 space-y-5 bg-surface-50/50">
                        {/* Màu nền */}
                        <div>
                            <label className="text-xs font-bold text-surface-600 uppercase tracking-wider block mb-2">Màu nền header</label>
                            <div className="flex items-center gap-3">
                                <input type="color" value={tpl.bgColor} onChange={e => up('bgColor', e.target.value)}
                                    className="w-10 h-10 rounded-lg border border-surface-200 cursor-pointer" />
                                <input type="text" value={tpl.bgColor} onChange={e => up('bgColor', e.target.value)}
                                    className="flex-1 bg-white border border-surface-200 text-sm rounded-lg p-2 font-mono" />
                            </div>
                        </div>

                        {/* Màu accent */}
                        <div>
                            <label className="text-xs font-bold text-surface-600 uppercase tracking-wider block mb-2">Màu nhấn (accent)</label>
                            <div className="flex items-center gap-3">
                                <input type="color" value={tpl.accentColor} onChange={e => up('accentColor', e.target.value)}
                                    className="w-10 h-10 rounded-lg border border-surface-200 cursor-pointer" />
                                <input type="text" value={tpl.accentColor} onChange={e => up('accentColor', e.target.value)}
                                    className="flex-1 bg-white border border-surface-200 text-sm rounded-lg p-2 font-mono" />
                            </div>
                        </div>

                        {/* Tiêu đề */}
                        <div>
                            <label className="text-xs font-bold text-surface-600 uppercase tracking-wider block mb-2">Tiêu đề vé</label>
                            <input type="text" value={tpl.title} onChange={e => up('title', e.target.value)}
                                className="w-full bg-white border border-surface-200 text-sm rounded-lg p-2.5" />
                        </div>

                        {/* Logo URL */}
                        <div>
                            <label className="text-xs font-bold text-surface-600 uppercase tracking-wider block mb-2">Logo URL (tuỳ chọn)</label>
                            <input type="text" value={tpl.logoUrl || ''} onChange={e => up('logoUrl', e.target.value)}
                                placeholder="https://..."
                                className="w-full bg-white border border-surface-200 text-sm rounded-lg p-2.5 font-mono" />
                            <p className="text-[10px] text-surface-400 mt-1">Dùng ảnh campaign nếu để trống</p>
                        </div>

                        {/* Cỡ QR */}
                        <div>
                            <label className="text-xs font-bold text-surface-600 uppercase tracking-wider block mb-2">Kích thước QR</label>
                            <div className="grid grid-cols-3 gap-2">
                                {(['sm', 'md', 'lg'] as const).map(sz => (
                                    <button key={sz} onClick={() => up('qrSize', sz)}
                                        className={cn('py-2 rounded-lg text-xs font-bold border-2 transition-all',
                                            tpl.qrSize === sz ? 'border-accent-500 bg-accent-50 text-accent-700' : 'border-surface-200 bg-white text-surface-500')}>
                                        {sz === 'sm' ? 'Nhỏ' : sz === 'md' ? 'Vừa' : 'Lớn'}
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* Toggles */}
                        <div>
                            <label className="text-xs font-bold text-surface-600 uppercase tracking-wider block mb-2">Hiển thị</label>
                            <div className="space-y-2">
                                {[
                                    { key: 'showRewardValue', label: 'Giá trị ưu đãi' },
                                    { key: 'showExpiry', label: 'Ngày hết hạn' },
                                    { key: 'showDescription', label: 'Mô tả chiến dịch' },
                                ].map(({ key, label }) => (
                                    <label key={key} className="flex items-center gap-3 cursor-pointer">
                                        <input type="checkbox"
                                            checked={tpl[key as 'showRewardValue' | 'showExpiry' | 'showDescription']}
                                            onChange={e => up(key as 'showRewardValue', e.target.checked)}
                                            className="w-4 h-4 rounded accent-accent-500" />
                                        <span className="text-sm text-surface-700">{label}</span>
                                    </label>
                                ))}
                            </div>
                        </div>

                        {/* Reward info (read-only) */}
                        <div className="bg-white rounded-xl border border-surface-100 p-3">
                            <p className="text-[10px] text-surface-400 font-semibold uppercase tracking-wider mb-1">Loại ưu đãi</p>
                            <p className="text-sm font-bold text-surface-700">{REWARD_LABELS[campaign.rewardType]} — {formatReward(campaign.rewardType, campaign.rewardValue)}</p>
                        </div>
                    </div>

                    {/* RIGHT — Preview */}
                    <div className="flex-1 overflow-y-auto p-8 flex items-center justify-center bg-[#e8edf4]">
                        <div className="w-full max-w-lg">
                            <div className="flex items-center gap-2 mb-4 text-surface-500">
                                <Eye className="w-4 h-4" />
                                <span className="text-xs font-semibold">Xem trước (mã mẫu)</span>
                            </div>
                            <TicketPreview campaign={campaign} tpl={tpl} previewRef={previewRef} />
                        </div>
                    </div>
                </div>

                {/* Footer Actions */}
                <div className="flex items-center justify-between px-6 py-4 border-t border-surface-100 bg-white">
                    <button onClick={handleSave} disabled={saving}
                        className="flex items-center gap-2 px-5 py-2.5 bg-surface-800 hover:bg-surface-900 disabled:bg-surface-400 text-white text-sm font-semibold rounded-xl transition-colors">
                        {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : saved ? <CheckCircle2 className="w-4 h-4 text-green-400" /> : <Save className="w-4 h-4" />}
                        {saved ? 'Đã lưu!' : 'Lưu mẫu'}
                    </button>

                    <div className="flex items-center gap-2">
                        <button onClick={handleExportPng} disabled={exporting}
                            className="flex items-center gap-2 px-4 py-2.5 bg-primary-50 hover:bg-primary-100 text-primary-700 border border-primary-200 text-sm font-semibold rounded-xl transition-colors">
                            {exporting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
                            Xuất PNG
                        </button>
                        <button onClick={handlePrint}
                            className="flex items-center gap-2 px-4 py-2.5 bg-surface-50 hover:bg-surface-100 text-surface-700 border border-surface-200 text-sm font-semibold rounded-xl transition-colors">
                            <Printer className="w-4 h-4" />
                            In
                        </button>
                        <button onClick={() => onOpenBulkEmail(tpl)}
                            className="flex items-center gap-2 px-5 py-2.5 bg-accent-500 hover:bg-accent-600 text-white text-sm font-semibold rounded-xl transition-colors shadow-sm">
                            <Send className="w-4 h-4" />
                            Gửi Email
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
