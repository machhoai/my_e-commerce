'use client';

import { useState, useCallback, useMemo } from 'react';
import { createPortal } from 'react-dom';
import {
    X, Printer, QrCode, Tag, Eye, Grid3X3,
    AlignJustify, ChevronDown, Copy
} from 'lucide-react';
import type { ProductDoc } from '@/types/inventory';
import { PrintableSheet } from './PrintableSheet';
import type { StyleConfig } from './LabelItem';

const GRID_PRESETS = [
    { label: '2 × 2', cols: 2, rows: 2, desc: '4 tem / trang' },
    { label: '3 × 4', cols: 3, rows: 4, desc: '12 tem / trang' },
    { label: '4 × 7', cols: 4, rows: 7, desc: '28 tem / trang' },
];

function Toggle({ checked, onChange, label, icon }: {
    checked: boolean; onChange: (v: boolean) => void; label: string; icon?: React.ReactNode;
}) {
    return (
        <label className="flex items-center justify-between gap-3 cursor-pointer group">
            <span className="flex items-center gap-2 text-sm font-medium text-slate-700">
                {icon} {label}
            </span>
            <button
                role="switch" aria-checked={checked} onClick={() => onChange(!checked)}
                className={`relative inline-flex h-6 w-11 shrink-0 rounded-full border-2 border-transparent transition-colors duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 ${checked ? 'bg-primary-600' : 'bg-slate-200'}`}
            >
                <span className={`pointer-events-none inline-block h-5 w-5 rounded-full bg-white shadow-lg ring-0 transition-transform duration-200 ${checked ? 'translate-x-5' : 'translate-x-0'}`} />
            </button>
        </label>
    );
}

interface Props {
    selectedProducts: ProductDoc[];
    onClose: () => void;
}

export function LabelPrintConfigurator({ selectedProducts, onClose }: Props) {
    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://joyworld.vn';

    const [gridPreset, setGridPreset] = useState(1);
    const [qrSize, setQrSize] = useState(80);
    const [styleConfig, setStyleConfig] = useState<StyleConfig>({
        showLogo: true, showName: true, showSku: true, showPublicUrlText: false,
    });

    const [printFullPagePerItem, setPrintFullPagePerItem] = useState(false);

    const { cols, rows } = GRID_PRESETS[gridPreset];

    const updateStyle = useCallback((key: keyof StyleConfig, val: boolean) => {
        setStyleConfig(prev => ({ ...prev, [key]: val }));
    }, []);

    const finalProductsToPrint = useMemo(() => {
        if (!printFullPagePerItem) return selectedProducts;

        const itemsPerPage = cols * rows;
        return selectedProducts.flatMap(product => Array(itemsPerPage).fill(product));
    }, [selectedProducts, printFullPagePerItem, cols, rows]);

    const totalPages = Math.ceil(finalProductsToPrint.length / (cols * rows));

    const handlePrint = () => window.print();

    // SỬA Ở ĐÂY: Dùng Fragment (<>...</>) để bọc cả Modal (trên màn hình) và Bản in (ẩn)
    const modalContent = (
        <div className='jw-print-root'>
            <div className="jw-screen-only fixed inset-0 z-[200] flex items-center justify-center bg-black/60 backdrop-blur-sm p-3">
                <div className="bg-white rounded-2xl shadow-2xl w-full max-w-5xl h-[90vh] flex flex-col overflow-hidden">

                    {/* Header */}
                    <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-gradient-to-r from-primary-600 to-accent-600">
                        <div className="flex items-center gap-3 text-white">
                            <Printer className="w-5 h-5" />
                            <div>
                                <h2 className="font-bold text-lg leading-tight">Cấu hình In Tem</h2>
                                <p className="text-white/70 text-xs">{selectedProducts.length} sản phẩm gốc · {totalPages} trang A4</p>
                            </div>
                        </div>
                        <button onClick={onClose} className="text-white/70 hover:text-white p-1.5 rounded-xl hover:bg-white/10 transition-colors">
                            <X className="w-5 h-5" />
                        </button>
                    </div>

                    {/* Body */}
                    <div className="flex-1 flex overflow-hidden">

                        {/* Bảng điều khiển */}
                        <div className="w-72 shrink-0 border-r border-slate-100 overflow-y-auto flex flex-col">
                            <div className="p-5 space-y-6 flex-1">
                                <section>
                                    <div className="flex items-center gap-2 mb-3">
                                        <Copy className="w-4 h-4 text-primary-500" />
                                        <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider">Chế độ In</h3>
                                    </div>
                                    <Toggle checked={printFullPagePerItem} onChange={setPrintFullPagePerItem} label={`Lặp full trang (${cols * rows} tem/mã)`} />
                                    <p className="text-[10px] text-slate-400 mt-2 leading-relaxed">
                                        {printFullPagePerItem ? `Mỗi sản phẩm sẽ được in phủ kín 1 tờ A4 (${cols * rows} tem giống hệt nhau).` : "In nối tiếp danh sách các sản phẩm khác nhau."}
                                    </p>
                                </section>

                                <section>
                                    <div className="flex items-center gap-2 mb-3">
                                        <Grid3X3 className="w-4 h-4 text-primary-500" />
                                        <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider">Lưới tem</h3>
                                    </div>
                                    <div className="space-y-2">
                                        {GRID_PRESETS.map((preset, i) => (
                                            <button key={i} onClick={() => setGridPreset(i)} className={`w-full flex items-center justify-between px-4 py-2.5 rounded-xl border-2 text-sm font-semibold transition-all ${gridPreset === i ? 'border-primary-500 bg-primary-50 text-primary-700' : 'border-slate-200 text-slate-600 hover:border-slate-300 hover:bg-slate-50'}`}>
                                                <span>{preset.label}</span>
                                                <span className={`text-xs font-normal ${gridPreset === i ? 'text-primary-500' : 'text-slate-400'}`}>{preset.desc}</span>
                                            </button>
                                        ))}
                                    </div>
                                </section>

                                <section>
                                    <div className="flex items-center gap-2 mb-3">
                                        <QrCode className="w-4 h-4 text-primary-500" />
                                        <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider">Cỡ QR</h3>
                                        <span className="ml-auto text-xs font-bold text-primary-600">{qrSize}px</span>
                                    </div>
                                    <input type="range" min={48} max={140} step={8} value={qrSize} onChange={e => setQrSize(Number(e.target.value))} className="w-full h-2 rounded-full accent-primary-600 cursor-pointer" />
                                </section>

                                <section>
                                    <div className="flex items-center gap-2 mb-3">
                                        <AlignJustify className="w-4 h-4 text-primary-500" />
                                        <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider">Nội dung tem</h3>
                                    </div>
                                    <div className="space-y-4">
                                        <Toggle checked={styleConfig.showLogo} onChange={v => updateStyle('showLogo', v)} label="Logo Joyworld" icon={<span className="text-base">🏷️</span>} />
                                        <Toggle checked={styleConfig.showName} onChange={v => updateStyle('showName', v)} label="Tên sản phẩm" icon={<Tag className="w-4 h-4 text-slate-400" />} />
                                        <Toggle checked={styleConfig.showSku} onChange={v => updateStyle('showSku', v)} label="Mã nội bộ (SKU)" icon={<span className="text-base font-mono text-slate-400 text-xs">#</span>} />
                                        <Toggle checked={styleConfig.showPublicUrlText} onChange={v => updateStyle('showPublicUrlText', v)} label="URL văn bản" icon={<Eye className="w-4 h-4 text-slate-400" />} />
                                    </div>
                                </section>
                            </div>

                            <div className="p-5 border-t border-slate-100">
                                <button onClick={handlePrint} className="w-full flex items-center justify-center gap-2 bg-gradient-to-r from-primary-600 to-accent-600 hover:from-primary-700 hover:to-accent-700 text-white py-3.5 rounded-xl font-bold text-sm shadow-lg shadow-primary-500/20 transition-all active:scale-95">
                                    <Printer className="w-4 h-4" /> Thực hiện In ({finalProductsToPrint.length} tem)
                                </button>
                            </div>
                        </div>

                        {/* Preview */}
                        <div className="flex-1 bg-slate-100 overflow-auto flex flex-col">
                            <div className="px-5 py-3 border-b border-slate-200 bg-white/80 flex items-center gap-2">
                                <Eye className="w-4 h-4 text-slate-400" />
                                <span className="text-sm font-semibold text-slate-600">Xem trước — Trang 1/{totalPages}</span>
                            </div>

                            <div className="flex-1 flex items-start justify-center p-8 overflow-auto">
                                <div className="bg-white shadow-2xl rounded-sm border border-slate-300"
                                    style={{ width: '210mm', minHeight: '297mm', padding: '8mm', boxSizing: 'border-box', transform: 'scale(0.5)', transformOrigin: 'top center', marginBottom: 'calc((297mm * 0.5) - 297mm)' }}
                                >
                                    {/* Preview chỉ render 1 trang (cắt mảng bằng cols * rows) */}
                                    <PrintableSheet
                                        products={finalProductsToPrint.slice(0, cols * rows)}
                                        cols={cols} rows={rows} qrSize={qrSize} styleConfig={styleConfig} siteUrl={siteUrl} previewMode
                                    />
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* 2. KHU VỰC BẢN IN THỰC TẾ (Ẩn trên màn hình, bung ra khi in) */}
            <PrintableSheet
                products={finalProductsToPrint}
                cols={cols}
                rows={rows}
                qrSize={qrSize}
                styleConfig={styleConfig}
                siteUrl={siteUrl}
                previewMode={false}
            />
        </div>
    );

    if (typeof document === 'undefined') return null;
    return createPortal(modalContent, document.body);
}