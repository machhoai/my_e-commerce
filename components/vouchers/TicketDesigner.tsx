'use client';

import { useState, useRef, useCallback } from 'react';
import { ref as storageRef, uploadBytes, getDownloadURL } from 'firebase/storage';
import { storage } from '@/lib/firebase';
import { QRCodeSVG } from 'qrcode.react';
import html2canvas from 'html2canvas';
import {
    X, Palette, Save, Download, Printer, Send,
    Eye, CheckCircle2, Loader2, Sparkles, LayoutTemplate,
    Type, ImagePlus, ZoomIn, UploadCloud, Link2, Trash2,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import type { VoucherCampaign, TicketTemplateConfig, VoucherRewardType } from '@/types';

const QR_SIZES = { sm: 88, md: 120, lg: 160 } as const;

const REWARD_LABELS: Record<VoucherRewardType, string> = {
    discount_percent: 'Giảm %',
    discount_fixed: 'Giảm tiền',
    free_ticket: 'Vé miễn phí',
    free_item: 'Tặng sản phẩm',
};

function formatReward(type: VoucherRewardType, value: number) {
    if (type === 'discount_percent') return `–${value}%`;
    if (type === 'discount_fixed') return `–${value.toLocaleString('vi-VN')}đ`;
    if (type === 'free_ticket') return 'Vé miễn phí';
    return 'Tặng sản phẩm';
}

const DEFAULT_TPL = (campaign: VoucherCampaign): TicketTemplateConfig => ({
    bgColor: '#0f172a',
    accentColor: '#f59e0b',
    logoUrl: campaign.image || '',
    title: campaign.name,
    showExpiry: true,
    showDescription: true,
    showRewardValue: true,
    qrSize: 'md',
});

// ── Preset palette swatches ────────────────────────────────────────────────
const PRESETS: Array<Pick<TicketTemplateConfig, 'bgColor' | 'accentColor'> & { label: string }> = [
    { label: 'Midnight Gold',   bgColor: '#0f172a', accentColor: '#f59e0b' },
    { label: 'Ocean Pulse',     bgColor: '#0c4a6e', accentColor: '#38bdf8' },
    { label: 'Rose Noir',       bgColor: '#1a0a12', accentColor: '#f472b6' },
    { label: 'Emerald Dark',    bgColor: '#052e16', accentColor: '#4ade80' },
    { label: 'Royal Violet',    bgColor: '#1e1b4b', accentColor: '#a78bfa' },
    { label: 'Burnt Orange',    bgColor: '#1c0a00', accentColor: '#fb923c' },
];

// ── Ticket Preview ────────────────────────────────────────────────────────
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
        ? new Date(campaign.validTo + 'T00:00:00').toLocaleDateString('vi-VN', {
              day: '2-digit', month: '2-digit', year: 'numeric',
          })
        : '';
    const rewardText = formatReward(campaign.rewardType, campaign.rewardValue);

    // Derive a lighter tint from bgColor for gradient
    return (
        <div
            ref={previewRef}
            style={{
                width: '100%',
                maxWidth: 480,
                margin: '0 auto',
                borderRadius: 20,
                overflow: 'hidden',
                boxShadow: `0 24px 64px ${tpl.bgColor}60, 0 4px 16px rgba(0,0,0,0.2)`,
                fontFamily: "'Segoe UI', -apple-system, Arial, sans-serif",
            }}
        >
            {/* ── Header band ─────────────────────────────── */}
            <div
                style={{
                    background: `linear-gradient(135deg, ${tpl.bgColor} 0%, ${tpl.bgColor}dd 100%)`,
                    padding: '28px 28px 24px',
                    position: 'relative',
                    overflow: 'hidden',
                }}
            >
                {/* Decorative circles */}
                <div style={{
                    position: 'absolute', top: -40, right: -40,
                    width: 160, height: 160, borderRadius: '50%',
                    background: `${tpl.accentColor}18`,
                    border: `2px solid ${tpl.accentColor}20`,
                }} />
                <div style={{
                    position: 'absolute', bottom: -20, right: 60,
                    width: 80, height: 80, borderRadius: '50%',
                    background: `${tpl.accentColor}10`,
                }} />

                {/* Logo */}
                {tpl.logoUrl && (
                    <img
                        src={tpl.logoUrl}
                        alt="logo"
                        style={{ height: 36, marginBottom: 14, display: 'block', objectFit: 'contain', position: 'relative' }}
                    />
                )}

                {/* Accent badge */}
                <div style={{
                    display: 'inline-flex', alignItems: 'center', gap: 6,
                    background: `${tpl.accentColor}22`,
                    border: `1px solid ${tpl.accentColor}50`,
                    borderRadius: 20, padding: '4px 12px', marginBottom: 10,
                    position: 'relative',
                }}>
                    <div style={{ width: 6, height: 6, borderRadius: '50%', background: tpl.accentColor }} />
                    <span style={{ color: tpl.accentColor, fontSize: 10, fontWeight: 700, letterSpacing: 1.5, textTransform: 'uppercase' }}>
                        Voucher độc quyền
                    </span>
                </div>

                <h2 style={{
                    margin: 0, color: '#fff', fontSize: 20, fontWeight: 800,
                    letterSpacing: -0.5, lineHeight: 1.2, position: 'relative',
                }}>
                    {tpl.title || campaign.name}
                </h2>
                {tpl.showDescription && campaign.description && (
                    <p style={{
                        margin: '8px 0 0', color: 'rgba(255,255,255,0.6)',
                        fontSize: 12, lineHeight: 1.5, position: 'relative',
                    }}>
                        {campaign.description}
                    </p>
                )}
            </div>

            {/* ── Ticket tear perforation ──────────────────── */}
            <div style={{
                background: '#f8fafc',
                display: 'flex', alignItems: 'center',
                position: 'relative',
                padding: '0',
            }}>
                {/* Left notch */}
                <div style={{
                    width: 20, height: 20, borderRadius: '50%',
                    background: '#e8edf4', flexShrink: 0, marginLeft: -10, zIndex: 1,
                }} />
                {/* Dashed line */}
                <div style={{
                    flex: 1, borderTop: `2px dashed ${tpl.accentColor}40`,
                    margin: '0 8px',
                }} />
                {/* Right notch */}
                <div style={{
                    width: 20, height: 20, borderRadius: '50%',
                    background: '#e8edf4', flexShrink: 0, marginRight: -10, zIndex: 1,
                }} />
            </div>

            {/* ── Body ─────────────────────────────────────── */}
            <div style={{ background: '#fff', padding: '24px 28px 20px' }}>
                <div style={{ display: 'flex', gap: 20, alignItems: 'flex-start' }}>
                    {/* Left info */}
                    <div style={{ flex: 1, minWidth: 0 }}>
                        {/* Reward badge */}
                        {tpl.showRewardValue && (
                            <div style={{
                                background: `linear-gradient(135deg, ${tpl.accentColor} 0%, ${tpl.accentColor}cc 100%)`,
                                borderRadius: 12, padding: '10px 16px', marginBottom: 18,
                                display: 'inline-block',
                                boxShadow: `0 4px 12px ${tpl.accentColor}40`,
                            }}>
                                <span style={{ color: '#fff', fontWeight: 900, fontSize: 22, letterSpacing: -0.5 }}>
                                    {rewardText}
                                </span>
                            </div>
                        )}

                        {/* Code */}
                        <p style={{ margin: '0 0 3px', fontSize: 9, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: 1.5 }}>
                            Mã voucher
                        </p>
                        <div style={{
                            background: '#f1f5f9', borderRadius: 10,
                            padding: '10px 14px', marginBottom: 16,
                            border: `1px solid #e2e8f0`,
                            display: 'inline-block',
                        }}>
                            <p style={{
                                margin: 0, fontSize: 16, fontWeight: 900,
                                color: tpl.bgColor, letterSpacing: 3,
                                fontFamily: "'Courier New', monospace",
                            }}>
                                {sampleCode}
                            </p>
                        </div>

                        {/* Expiry */}
                        {tpl.showExpiry && expiryDisplay && (
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                <div style={{
                                    width: 3, height: 32, borderRadius: 2,
                                    background: tpl.accentColor,
                                }} />
                                <div>
                                    <p style={{ margin: 0, fontSize: 9, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: 1 }}>
                                        Hết hạn ngày
                                    </p>
                                    <p style={{ margin: 0, fontSize: 13, fontWeight: 700, color: '#334155' }}>
                                        {expiryDisplay}
                                    </p>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Right QR */}
                    <div style={{ flexShrink: 0, textAlign: 'center' }}>
                        <div style={{
                            background: '#fff',
                            padding: 8, borderRadius: 12,
                            border: `2px solid ${tpl.accentColor}30`,
                            boxShadow: `0 2px 12px ${tpl.bgColor}18`,
                            display: 'inline-block',
                        }}>
                            <QRCodeSVG
                                value={sampleCode}
                                size={qrPx}
                                bgColor="#FFFFFF"
                                fgColor={tpl.bgColor}
                                level="M"
                            />
                        </div>
                        <p style={{ margin: '8px 0 0', fontSize: 10, color: '#94a3b8', fontWeight: 600 }}>
                            Quét để sử dụng
                        </p>
                    </div>
                </div>
            </div>

            {/* ── Footer ───────────────────────────────────── */}
            <div style={{
                background: `linear-gradient(135deg, ${tpl.bgColor}0a 0%, ${tpl.bgColor}18 100%)`,
                borderTop: '1px solid #f1f5f9',
                padding: '12px 28px',
                textAlign: 'center',
            }}>
                <p style={{ margin: 0, fontSize: 10, color: '#94a3b8', letterSpacing: 0.3 }}>
                    🔒 Voucher này chỉ dành cho bạn. Vui lòng không chia sẻ mã với người khác.
                </p>
            </div>
        </div>
    );
}

// ── Sidebar section header ─────────────────────────────────────────────────
function SideSection({ icon: Icon, label, children }: { icon: React.ElementType; label: string; children: React.ReactNode }) {
    return (
        <div className="space-y-3">
            <div className="flex items-center gap-2 pb-2 border-b border-surface-100">
                <div className="w-6 h-6 rounded-lg bg-accent-50 flex items-center justify-center shrink-0">
                    <Icon className="w-3.5 h-3.5 text-accent-600" />
                </div>
                <span className="text-xs font-bold text-surface-600 uppercase tracking-wider">{label}</span>
            </div>
            {children}
        </div>
    );
}

// ── Toggle switch ──────────────────────────────────────────────────────────
function Toggle({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
    return (
        <label className="flex items-center justify-between cursor-pointer group">
            <span className="text-sm text-surface-700 group-hover:text-surface-900 transition-colors">{label}</span>
            <button
                type="button"
                onClick={() => onChange(!checked)}
                className={cn(
                    'relative w-9 h-5 rounded-full transition-all duration-200 shrink-0',
                    checked ? 'bg-accent-500' : 'bg-surface-200',
                )}
            >
                <div className={cn(
                    'absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-all duration-200',
                    checked ? 'left-4' : 'left-0.5',
                )} />
            </button>
        </label>
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
    const logoFileRef = useRef<HTMLInputElement | null>(null);
    const [logoUploading, setLogoUploading] = useState(false);
    const [logoUrlMode, setLogoUrlMode] = useState(false); // toggle paste-URL vs upload

    const up = <K extends keyof TicketTemplateConfig>(key: K, val: TicketTemplateConfig[K]) =>
        setTpl(p => ({ ...p, [key]: val }));

    // ── Logo upload to Firebase Storage ───────────────────────────
    const handleLogoUpload = useCallback(async (file: File) => {
        // Validate type
        if (!file.type.startsWith('image/')) return;
        // Instant local preview via data URL
        const reader = new FileReader();
        reader.onload = e => up('logoUrl', e.target?.result as string);
        reader.readAsDataURL(file);
        // Upload to Firebase Storage
        setLogoUploading(true);
        try {
            const path = `ticket-logos/${campaign.id}/${Date.now()}-${file.name.replace(/\s+/g, '_')}`;
            const sRef = storageRef(storage, path);
            const snapshot = await uploadBytes(sRef, file);
            const url = await getDownloadURL(snapshot.ref);
            up('logoUrl', url); // replace data URL with permanent URL
        } catch {
            // keep data URL preview if upload fails
        } finally {
            setLogoUploading(false);
        }
    }, [campaign.id]);

    const handleLogoFilePick = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) handleLogoUpload(file);
        e.target.value = '';
    };

    const handleLogoDrop = (e: React.DragEvent) => {
        e.preventDefault();
        const file = e.dataTransfer.files[0];
        if (file) handleLogoUpload(file);
    };

    // ── Save ────────────────────────────────────────────────────
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

    // ── Export PNG ──────────────────────────────────────────────
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

    // ── Print ───────────────────────────────────────────────────
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
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-5xl max-h-[92vh] flex flex-col overflow-hidden">

                {/* ── Header ───────────────────────────────── */}
                <div className="flex items-center justify-between px-6 py-4 border-b border-surface-100 bg-gradient-to-r from-surface-50 to-white">
                    <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-accent-500 to-accent-600 flex items-center justify-center shadow-sm shadow-accent-200">
                            <Sparkles className="w-4.5 h-4.5 text-white" />
                        </div>
                        <div>
                            <h2 className="text-base font-bold text-surface-800 leading-tight">Thiết kế vé</h2>
                            <p className="text-xs text-surface-400">{campaign.name}</p>
                        </div>
                    </div>
                    <button onClick={onClose} className="p-2 rounded-xl hover:bg-surface-100 text-surface-400 hover:text-surface-700 transition-colors">
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* ── Body ─────────────────────────────────── */}
                <div className="flex flex-1 overflow-hidden">

                    {/* LEFT — Design Config ─────────────────── */}
                    <div className="w-72 shrink-0 overflow-y-auto border-r border-surface-100 bg-white">
                        <div className="p-5 space-y-6">

                            {/* Presets */}
                            <SideSection icon={Palette} label="Bộ màu nhanh">
                                <div className="grid grid-cols-3 gap-2">
                                    {PRESETS.map(p => (
                                        <button
                                            key={p.label}
                                            onClick={() => setTpl(prev => ({ ...prev, bgColor: p.bgColor, accentColor: p.accentColor }))}
                                            title={p.label}
                                            className={cn(
                                                'h-10 rounded-xl border-2 flex items-center justify-center gap-1.5 transition-all active:scale-95',
                                                tpl.bgColor === p.bgColor && tpl.accentColor === p.accentColor
                                                    ? 'border-accent-500 shadow-md shadow-accent-100'
                                                    : 'border-transparent hover:border-surface-200',
                                            )}
                                            style={{ background: `linear-gradient(135deg, ${p.bgColor} 50%, ${p.accentColor} 50%)` }}
                                        >
                                            {tpl.bgColor === p.bgColor && tpl.accentColor === p.accentColor && (
                                                <CheckCircle2 className="w-4 h-4 text-white drop-shadow" />
                                            )}
                                        </button>
                                    ))}
                                </div>
                            </SideSection>

                            {/* Colors */}
                            <SideSection icon={LayoutTemplate} label="Màu tùy chỉnh">
                                <div className="space-y-3">
                                    {[
                                        { key: 'bgColor' as const, label: 'Màu nền header' },
                                        { key: 'accentColor' as const, label: 'Màu nhấn' },
                                    ].map(({ key, label }) => (
                                        <div key={key}>
                                            <label className="text-[10px] font-bold text-surface-500 uppercase tracking-wide block mb-1.5">{label}</label>
                                            <div className="flex items-center gap-2">
                                                <div className="relative">
                                                    <input
                                                        type="color"
                                                        value={tpl[key]}
                                                        onChange={e => up(key, e.target.value)}
                                                        className="sr-only"
                                                        id={`color-${key}`}
                                                    />
                                                    <label
                                                        htmlFor={`color-${key}`}
                                                        className="w-9 h-9 rounded-lg border-2 border-surface-200 cursor-pointer block shadow-sm hover:scale-105 transition-transform"
                                                        style={{ background: tpl[key] }}
                                                    />
                                                </div>
                                                <input
                                                    type="text"
                                                    value={tpl[key]}
                                                    onChange={e => up(key, e.target.value)}
                                                    className="flex-1 bg-surface-50 border border-surface-200 text-xs rounded-lg px-2.5 py-2 font-mono focus:ring-1 focus:ring-accent-300 focus:border-accent-400 outline-none transition-all"
                                                />
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </SideSection>

                            {/* Content */}
                            <SideSection icon={Type} label="Nội dung">
                                <div className="space-y-3">
                                    <div>
                                        <label className="text-[10px] font-bold text-surface-500 uppercase tracking-wide block mb-1.5">Tiêu đề vé</label>
                                        <input
                                            type="text"
                                            value={tpl.title}
                                            onChange={e => up('title', e.target.value)}
                                            className="w-full bg-surface-50 border border-surface-200 text-sm rounded-lg px-3 py-2.5 focus:ring-1 focus:ring-accent-300 focus:border-accent-400 outline-none transition-all"
                                        />
                                    </div>

                                    {/* Logo upload zone */}
                                    <div>
                                        <div className="flex items-center justify-between mb-1.5">
                                            <label className="text-[10px] font-bold text-surface-500 uppercase tracking-wide">Logo</label>
                                            <button
                                                type="button"
                                                onClick={() => setLogoUrlMode(m => !m)}
                                                className="flex items-center gap-1 text-[10px] font-semibold text-primary-500 hover:text-primary-700 transition-colors"
                                            >
                                                <Link2 className="w-3 h-3" />
                                                {logoUrlMode ? 'Upload' : 'Dán URL'}
                                            </button>
                                        </div>

                                        {logoUrlMode ? (
                                            /* URL paste mode */
                                            <input
                                                type="text"
                                                value={tpl.logoUrl || ''}
                                                onChange={e => up('logoUrl', e.target.value)}
                                                placeholder="https://..."
                                                className="w-full bg-surface-50 border border-surface-200 text-xs rounded-lg px-3 py-2.5 font-mono focus:ring-1 focus:ring-accent-300 focus:border-accent-400 outline-none transition-all"
                                            />
                                        ) : (
                                            /* Upload zone */
                                            <div>
                                                <input
                                                    ref={logoFileRef}
                                                    type="file"
                                                    accept="image/*"
                                                    className="sr-only"
                                                    onChange={handleLogoFilePick}
                                                />
                                                {tpl.logoUrl ? (
                                                    /* Preview */
                                                    <div className="relative group rounded-xl overflow-hidden border-2 border-surface-200 bg-surface-50">
                                                        <img
                                                            src={tpl.logoUrl}
                                                            alt="Logo preview"
                                                            className="w-full h-20 object-contain p-2"
                                                        />
                                                        {/* Overlay on hover */}
                                                        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-all flex items-center justify-center gap-2 opacity-0 group-hover:opacity-100">
                                                            <button
                                                                type="button"
                                                                onClick={() => logoFileRef.current?.click()}
                                                                className="flex items-center gap-1 px-3 py-1.5 bg-white text-surface-800 text-xs font-bold rounded-lg shadow transition-all active:scale-95"
                                                            >
                                                                <UploadCloud className="w-3.5 h-3.5" />
                                                                Thay
                                                            </button>
                                                            <button
                                                                type="button"
                                                                onClick={() => up('logoUrl', '')}
                                                                className="flex items-center gap-1 px-3 py-1.5 bg-red-500 text-white text-xs font-bold rounded-lg shadow transition-all active:scale-95"
                                                            >
                                                                <Trash2 className="w-3.5 h-3.5" />
                                                                Xóa
                                                            </button>
                                                        </div>
                                                        {/* Upload spinner */}
                                                        {logoUploading && (
                                                            <div className="absolute inset-0 bg-white/80 flex flex-col items-center justify-center gap-1">
                                                                <Loader2 className="w-5 h-5 animate-spin text-accent-500" />
                                                                <span className="text-[10px] text-surface-500 font-semibold">Đang tải lên...</span>
                                                            </div>
                                                        )}
                                                    </div>
                                                ) : (
                                                    /* Drop zone */
                                                    <button
                                                        type="button"
                                                        onClick={() => logoFileRef.current?.click()}
                                                        onDragOver={e => e.preventDefault()}
                                                        onDrop={handleLogoDrop}
                                                        className="w-full border-2 border-dashed border-surface-300 hover:border-accent-400 bg-surface-50 hover:bg-accent-50/30 rounded-xl p-5 flex flex-col items-center gap-2 transition-all group cursor-pointer"
                                                    >
                                                        <div className="w-9 h-9 rounded-full bg-accent-100 group-hover:bg-accent-200 flex items-center justify-center transition-colors">
                                                            <ImagePlus className="w-4.5 h-4.5 text-accent-600" />
                                                        </div>
                                                        <div className="text-center">
                                                            <p className="text-xs font-semibold text-surface-600">Click hoặc kéo thả ảnh</p>
                                                            <p className="text-[10px] text-surface-400 mt-0.5">PNG, JPG, SVG — tối đa 5MB</p>
                                                        </div>
                                                    </button>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </SideSection>

                            {/* QR Size */}
                            <SideSection icon={ZoomIn} label="Kích thước QR">
                                <div className="grid grid-cols-3 gap-2">
                                    {(['sm', 'md', 'lg'] as const).map(sz => (
                                        <button
                                            key={sz}
                                            onClick={() => up('qrSize', sz)}
                                            className={cn(
                                                'py-2.5 rounded-xl text-xs font-bold border-2 transition-all active:scale-95',
                                                tpl.qrSize === sz
                                                    ? 'border-accent-500 bg-accent-50 text-accent-700 shadow-sm'
                                                    : 'border-surface-200 bg-surface-50 text-surface-500 hover:border-surface-300',
                                            )}
                                        >
                                            {sz === 'sm' ? 'Nhỏ' : sz === 'md' ? 'Vừa' : 'Lớn'}
                                        </button>
                                    ))}
                                </div>
                            </SideSection>

                            {/* Visibility toggles */}
                            <SideSection icon={Eye} label="Hiển thị">
                                <div className="space-y-3">
                                    {([
                                        { key: 'showRewardValue', label: 'Giá trị ưu đãi' },
                                        { key: 'showExpiry', label: 'Ngày hết hạn' },
                                        { key: 'showDescription', label: 'Mô tả chiến dịch' },
                                    ] as const).map(({ key, label }) => (
                                        <Toggle
                                            key={key}
                                            label={label}
                                            checked={tpl[key]}
                                            onChange={v => up(key, v)}
                                        />
                                    ))}
                                </div>
                            </SideSection>

                            {/* Reward info read-only */}
                            <div className="bg-gradient-to-br from-surface-50 to-surface-100 rounded-xl border border-surface-200 p-3">
                                <p className="text-[9px] font-bold text-surface-400 uppercase tracking-widest mb-1.5">Loại ưu đãi</p>
                                <p className="text-sm font-bold text-surface-700">{REWARD_LABELS[campaign.rewardType]}</p>
                                <p className="text-xs text-surface-500 mt-0.5">{formatReward(campaign.rewardType, campaign.rewardValue)}</p>
                            </div>
                        </div>
                    </div>

                    {/* RIGHT — Preview ─────────────────────── */}
                    <div className="flex-1 overflow-y-auto p-8 flex items-center justify-center"
                        style={{ background: 'radial-gradient(ellipse at 60% 40%, #dbeafe20 0%, #e8edf4 100%)' }}>
                        <div className="w-full max-w-lg">
                            <div className="flex items-center gap-2 mb-5">
                                <div className="flex items-center gap-1.5 bg-white/80 backdrop-blur-sm rounded-full px-3 py-1.5 border border-surface-200 shadow-sm">
                                    <Eye className="w-3.5 h-3.5 text-surface-400" />
                                    <span className="text-xs font-semibold text-surface-500">Xem trước</span>
                                </div>
                                <div className="flex items-center gap-1.5 bg-amber-50 rounded-full px-3 py-1.5 border border-amber-200">
                                    <ImagePlus className="w-3 h-3 text-amber-500" />
                                    <span className="text-xs font-semibold text-amber-600">Mã mẫu</span>
                                </div>
                            </div>
                            <TicketPreview campaign={campaign} tpl={tpl} previewRef={previewRef} />
                        </div>
                    </div>
                </div>

                {/* ── Footer Actions ────────────────────────── */}
                <div className="flex items-center justify-between px-6 py-4 border-t border-surface-100 bg-surface-50/50">
                    <button
                        onClick={handleSave}
                        disabled={saving}
                        className="flex items-center gap-2 px-5 py-2.5 bg-surface-800 hover:bg-surface-900 disabled:bg-surface-400 text-white text-sm font-semibold rounded-xl transition-all active:scale-95 shadow-sm"
                    >
                        {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : saved ? <CheckCircle2 className="w-4 h-4 text-green-400" /> : <Save className="w-4 h-4" />}
                        {saved ? 'Đã lưu!' : 'Lưu mẫu'}
                    </button>

                    <div className="flex items-center gap-2">
                        <button
                            onClick={handleExportPng}
                            disabled={exporting}
                            className="flex items-center gap-2 px-4 py-2.5 bg-white hover:bg-primary-50 text-primary-700 border border-primary-200 text-sm font-semibold rounded-xl transition-all active:scale-95"
                        >
                            {exporting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
                            Xuất PNG
                        </button>
                        <button
                            onClick={handlePrint}
                            className="flex items-center gap-2 px-4 py-2.5 bg-white hover:bg-surface-100 text-surface-700 border border-surface-200 text-sm font-semibold rounded-xl transition-all active:scale-95"
                        >
                            <Printer className="w-4 h-4" />
                            In
                        </button>
                        <button
                            onClick={() => onOpenBulkEmail(tpl)}
                            className="flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-accent-500 to-amber-500 hover:from-accent-600 hover:to-amber-600 text-white text-sm font-semibold rounded-xl transition-all active:scale-95 shadow-md shadow-accent-200"
                        >
                            <Send className="w-4 h-4" />
                            Gửi Email
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
