'use client';

import { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import {
    FileSpreadsheet, X, Search, RotateCcw, Download,
    Wand2, Tag, Package, CheckCircle2, AlertCircle, Layers, Save,
} from 'lucide-react';
import type { RevenueRecord, SellCategory, DailyPanel, GoodsTypeStats } from '@/lib/revenue-cache';


// ── Types ────────────────────────────────────────────────────────────────────
type ColumnTarget = 'goods' | 'category';

interface NameMap {
    [originalName: string]: string;
}

interface ExcelExportDialogProps {
    open: boolean;
    onClose: () => void;
    data: RevenueRecord[];
    sellData: SellCategory[];
    dailyPanel: DailyPanel | null;
    activeRange: string;
}

// ── localStorage helpers ─────────────────────────────────────────────────────
const LS_GOODS_KEY = 'revenue_export_goods_name_map';
const LS_CATEGORY_KEY = 'revenue_export_category_name_map';

function loadFromLS(key: string): NameMap {
    if (typeof window === 'undefined') return {};
    try {
        const raw = localStorage.getItem(key);
        return raw ? (JSON.parse(raw) as NameMap) : {};
    } catch {
        return {};
    }
}

function saveToLS(key: string, map: NameMap) {
    if (typeof window === 'undefined') return;
    try {
        const filtered = Object.fromEntries(Object.entries(map).filter(([, v]) => v !== ''));
        localStorage.setItem(key, JSON.stringify(filtered));
    } catch { /* quota exceeded — ignore */ }
}


// ── Helpers ──────────────────────────────────────────────────────────────────
const fmtVND = (v: number) => v.toLocaleString('vi-VN', { style: 'currency', currency: 'VND' });
const fmtShort = (v: number) => {
    if (v >= 1_000_000_000) return `${(v / 1_000_000_000).toFixed(1)} tỷ`;
    if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(1)}M`;
    if (v >= 1_000) return `${(v / 1_000).toFixed(0)}K`;
    return v.toLocaleString('vi-VN');
};

// Extract unique goods names from data
function extractGoodsNames(sellData: SellCategory[], dailyPanel: DailyPanel | null): { name: string; category: string; revenue: number }[] {
    const map = new Map<string, { category: string; revenue: number }>();

    if (dailyPanel?.goodsTypeStats?.length) {
        for (const cat of dailyPanel.goodsTypeStats) {
            for (const item of cat.goodsItems) {
                if (item.realMoney > 0) {
                    const existing = map.get(item.goodsName);
                    if (existing) {
                        existing.revenue += item.realMoney;
                    } else {
                        map.set(item.goodsName, { category: cat.goodsTypeName, revenue: item.realMoney });
                    }
                }
            }
        }
    } else {
        for (const cat of sellData) {
            for (const item of cat.items) {
                if (item.realMoney > 0) {
                    const existing = map.get(item.goodsName);
                    if (existing) {
                        existing.revenue += item.realMoney;
                    } else {
                        map.set(item.goodsName, { category: cat.goodsCategory, revenue: item.realMoney });
                    }
                }
            }
        }
    }

    return Array.from(map.entries())
        .map(([name, { category, revenue }]) => ({ name, category, revenue }))
        .sort((a, b) => b.revenue - a.revenue);
}

function extractCategoryNames(sellData: SellCategory[], dailyPanel: DailyPanel | null): { name: string; revenue: number }[] {
    const map = new Map<string, number>();

    if (dailyPanel?.goodsTypeStats?.length) {
        for (const cat of dailyPanel.goodsTypeStats) {
            if (cat.totalRealMoney > 0) {
                map.set(cat.goodsTypeName, (map.get(cat.goodsTypeName) || 0) + cat.totalRealMoney);
            }
        }
    } else {
        for (const cat of sellData) {
            if (cat.realMoney > 0) {
                map.set(cat.goodsCategory, (map.get(cat.goodsCategory) || 0) + cat.realMoney);
            }
        }
    }

    return Array.from(map.entries())
        .map(([name, revenue]) => ({ name, revenue }))
        .sort((a, b) => b.revenue - a.revenue);
}

// ── Excel Export Logic ────────────────────────────────────────────────────────
async function exportToExcel(
    data: RevenueRecord[],
    sellData: SellCategory[],
    dailyPanel: DailyPanel | null,
    goodsNameMap: NameMap,
    categoryNameMap: NameMap,
    activeRange: string,
) {
    const ExcelJS = (await import('exceljs')).default;
    const { saveAs } = await import('file-saver');

    const wb = new ExcelJS.Workbook();
    wb.creator = 'Revenue Dashboard';
    wb.created = new Date();

    // ── Sheet 1: Doanh thu tổng quan ─────────────────────────────────────────
    const ws1 = wb.addWorksheet('Doanh thu tổng quan', {
        views: [{ state: 'frozen', ySplit: 1 }],
    });

    ws1.columns = [
        { header: 'Ngày', key: 'forDate', width: 14 },
        { header: 'Thực thu', key: 'realMoney', width: 18 },
        { header: 'Phải thu', key: 'sysMoney', width: 18 },
        { header: 'Bán hàng', key: 'saleSubMoney', width: 18 },
        { header: 'Tiền mặt', key: 'cashRealMoney', width: 18 },
        { header: 'Lỗi TM', key: 'cashErrorMoney', width: 16 },
        { header: 'Chuyển khoản', key: 'transferRealMoney', width: 20 },
        { header: 'Xu bán', key: 'sellCoinAmount', width: 14 },
    ];

    // Style header row
    const headerRow1 = ws1.getRow(1);
    headerRow1.eachCell(cell => {
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF4F46E5' } };
        cell.font = { color: { argb: 'FFFFFFFF' }, bold: true, size: 11 };
        cell.alignment = { horizontal: 'center', vertical: 'middle' };
        cell.border = {
            top: { style: 'thin', color: { argb: 'FF6366F1' } },
            bottom: { style: 'thin', color: { argb: 'FF6366F1' } },
        };
    });
    headerRow1.height = 28;

    const sorted = [...data].sort((a, b) => a.forDate.localeCompare(b.forDate));
    sorted.forEach((row, idx) => {
        const r = ws1.addRow({
            forDate: row.forDate,
            realMoney: row.realMoney,
            sysMoney: row.sysMoney,
            saleSubMoney: row.saleSubMoney,
            cashRealMoney: row.cashRealMoney,
            cashErrorMoney: row.cashErrorMoney,
            transferRealMoney: row.transferRealMoney,
            sellCoinAmount: row.sellCoinAmount,
        });
        r.height = 22;
        const bgColor = idx % 2 === 0 ? 'FFFAFAFA' : 'FFFFFFFF';
        r.eachCell((cell, colNum) => {
            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: bgColor } };
            cell.alignment = { vertical: 'middle', horizontal: colNum === 1 ? 'left' : 'right' };
            cell.border = { bottom: { style: 'thin', color: { argb: 'FFF1F5F9' } } };
            if (colNum >= 2 && colNum <= 7) {
                cell.numFmt = '#,##0';
            }
        });
        // Highlight realMoney in green
        r.getCell('realMoney').font = { bold: true, color: { argb: 'FF059669' } };
    });

    // Total row
    const totals = ws1.addRow({
        forDate: 'TỔNG CỘNG',
        realMoney: data.reduce((s, d) => s + d.realMoney, 0),
        sysMoney: data.reduce((s, d) => s + d.sysMoney, 0),
        saleSubMoney: data.reduce((s, d) => s + d.saleSubMoney, 0),
        cashRealMoney: data.reduce((s, d) => s + d.cashRealMoney, 0),
        cashErrorMoney: data.reduce((s, d) => s + d.cashErrorMoney, 0),
        transferRealMoney: data.reduce((s, d) => s + d.transferRealMoney, 0),
        sellCoinAmount: data.reduce((s, d) => s + d.sellCoinAmount, 0),
    });
    totals.height = 26;
    totals.eachCell((cell, colNum) => {
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE0E7FF' } };
        cell.font = { bold: true, color: { argb: 'FF3730A3' } };
        cell.alignment = { vertical: 'middle', horizontal: colNum === 1 ? 'left' : 'right' };
        cell.border = { top: { style: 'medium', color: { argb: 'FF6366F1' } } };
        if (colNum >= 2 && colNum <= 7) cell.numFmt = '#,##0';
    });

    // ── Sheet 2: Chi tiết sản phẩm ───────────────────────────────────────────
    const ws2 = wb.addWorksheet('Chi tiết sản phẩm', {
        views: [{ state: 'frozen', ySplit: 1 }],
    });

    ws2.columns = [
        { header: 'Danh mục', key: 'category', width: 24 },
        { header: 'Tên hàng hóa', key: 'goods', width: 32 },
        { header: 'SL thực', key: 'realQty', width: 12 },
        { header: 'Doanh thu thực', key: 'realMoney', width: 20 },
        { header: 'SL đặt', key: 'totalQty', width: 12 },
        { header: 'Tổng đặt', key: 'totalMoney', width: 20 },
        { header: 'SL hủy', key: 'cancelQty', width: 12 },
        { header: 'Tiền hủy', key: 'cancelMoney', width: 18 },
    ];

    const headerRow2 = ws2.getRow(1);
    headerRow2.eachCell(cell => {
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF065F46' } };
        cell.font = { color: { argb: 'FFFFFFFF' }, bold: true, size: 11 };
        cell.alignment = { horizontal: 'center', vertical: 'middle' };
    });
    headerRow2.height = 28;

    // Build rows from data
    let rowIdx = 0;
    const getGoodsRows = () => {
        if (dailyPanel?.goodsTypeStats?.length) {
            return dailyPanel.goodsTypeStats.flatMap(cat =>
                cat.goodsItems.filter(i => i.realMoney > 0 || i.totalMoney > 0).map(item => ({
                    category: categoryNameMap[cat.goodsTypeName] || cat.goodsTypeName,
                    goods: goodsNameMap[item.goodsName] || item.goodsName,
                    realQty: item.realQty,
                    realMoney: item.realMoney,
                    totalQty: item.totalQty,
                    totalMoney: item.totalMoney,
                    cancelQty: item.cancelQty,
                    cancelMoney: item.cancelMoney,
                    isCategory: false,
                    catName: cat.goodsTypeName,
                }))
            );
        }
        return sellData.flatMap(cat =>
            cat.items.filter(i => i.realMoney > 0 || i.totalMoney > 0).map(item => ({
                category: categoryNameMap[cat.goodsCategory] || cat.goodsCategory,
                goods: goodsNameMap[item.goodsName] || item.goodsName,
                realQty: item.realQty,
                realMoney: item.realMoney,
                totalQty: item.totalQty,
                totalMoney: item.totalMoney,
                cancelQty: item.cancelQty,
                cancelMoney: item.cancelMoney,
                isCategory: false,
                catName: cat.goodsCategory,
            }))
        );
    };

    // Group by category and add subtotals
    const goodsRows = getGoodsRows();
    const groupedByCategory = new Map<string, typeof goodsRows>();
    for (const row of goodsRows) {
        const key = row.catName;
        if (!groupedByCategory.has(key)) groupedByCategory.set(key, []);
        groupedByCategory.get(key)!.push(row);
    }

    for (const [, rows] of groupedByCategory) {
        // Category header row
        const firstRow = rows[0];
        const catR = ws2.addRow({
            category: firstRow.category,
            goods: '',
            realQty: rows.reduce((s, r) => s + r.realQty, 0),
            realMoney: rows.reduce((s, r) => s + r.realMoney, 0),
            totalQty: rows.reduce((s, r) => s + r.totalQty, 0),
            totalMoney: rows.reduce((s, r) => s + r.totalMoney, 0),
            cancelQty: rows.reduce((s, r) => s + r.cancelQty, 0),
            cancelMoney: rows.reduce((s, r) => s + r.cancelMoney, 0),
        });
        catR.height = 24;
        catR.eachCell((cell, colNum) => {
            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF0FDF4' } };
            cell.font = { bold: true, color: { argb: 'FF065F46' } };
            cell.alignment = { vertical: 'middle', horizontal: colNum === 1 ? 'left' : 'right' };
            cell.border = { top: { style: 'thin', color: { argb: 'FFD1FAE5' } }, bottom: { style: 'thin', color: { argb: 'FFD1FAE5' } } };
            if (colNum >= 3) cell.numFmt = '#,##0';
        });

        // Individual items
        for (const row of rows) {
            const r = ws2.addRow({
                category: '',
                goods: row.goods,
                realQty: row.realQty,
                realMoney: row.realMoney,
                totalQty: row.totalQty,
                totalMoney: row.totalMoney,
                cancelQty: row.cancelQty,
                cancelMoney: row.cancelMoney,
            });
            r.height = 20;
            const bg = rowIdx % 2 === 0 ? 'FFFAFAFA' : 'FFFFFFFF';
            r.eachCell((cell, colNum) => {
                cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: bg } };
                cell.alignment = { vertical: 'middle', horizontal: colNum <= 2 ? 'left' : 'right', indent: colNum === 2 ? 2 : 0 };
                cell.border = { bottom: { style: 'thin', color: { argb: 'FFF1F5F9' } } };
                if (colNum >= 3) cell.numFmt = '#,##0';
            });
            // Red for cancel money
            if (row.cancelMoney > 0) r.getCell('cancelMoney').font = { color: { argb: 'FFDC2626' } };
            rowIdx++;
        }
    }

    // ── Sheet 3: Bảng tên tùy chỉnh (reference) ────────────────────────────
    if (Object.keys(goodsNameMap).length > 0 || Object.keys(categoryNameMap).length > 0) {
        const ws3 = wb.addWorksheet('Bảng tên tùy chỉnh');
        ws3.columns = [
            { header: 'Loại', key: 'type', width: 18 },
            { header: 'Tên gốc', key: 'original', width: 36 },
            { header: 'Tên tùy chỉnh', key: 'custom', width: 36 },
        ];
        const headerRow3 = ws3.getRow(1);
        headerRow3.eachCell(cell => {
            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF6D28D9' } };
            cell.font = { color: { argb: 'FFFFFFFF' }, bold: true };
            cell.alignment = { horizontal: 'center', vertical: 'middle' };
        });
        headerRow3.height = 26;

        let ri = 0;
        for (const [orig, custom] of Object.entries(categoryNameMap)) {
            const r = ws3.addRow({ type: 'Danh mục', original: orig, custom });
            r.height = 20;
            r.eachCell(cell => {
                cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: ri % 2 === 0 ? 'FFFAF5FF' : 'FFFFFFFF' } };
                cell.alignment = { vertical: 'middle' };
            });
            ri++;
        }
        for (const [orig, custom] of Object.entries(goodsNameMap)) {
            const r = ws3.addRow({ type: 'Hàng hóa', original: orig, custom });
            r.height = 20;
            r.eachCell(cell => {
                cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: ri % 2 === 0 ? 'FFECFDF5' : 'FFFFFFFF' } };
                cell.alignment = { vertical: 'middle' };
            });
            ri++;
        }
    }

    // ── Generate and download ────────────────────────────────────────────────
    const buf = await wb.xlsx.writeBuffer();
    const blob = new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    const safeName = activeRange.replace(/[^a-zA-Z0-9\-]/g, '_');
    saveAs(blob, `doanh_thu_${safeName}_${new Date().toISOString().slice(0, 10)}.xlsx`);
}

// ── Name Row Component ────────────────────────────────────────────────────────
function NameRow({
    original,
    customized,
    revenue,
    sub,
    onChange,
    onReset,
}: {
    original: string;
    customized: string;
    revenue: number;
    sub?: string;
    onChange: (val: string) => void;
    onReset: () => void;
}) {
    const isChanged = customized !== '' && customized !== original;
    return (
        <div className={`group flex items-center gap-3 p-3 rounded-xl transition-all duration-200 border ${isChanged
            ? 'border-accent-200 bg-accent-50/40'
            : 'border-transparent hover:border-surface-100 hover:bg-surface-50/70'
            }`}>
            {/* Left: original name + revenue */}
            <div className="min-w-0 flex-1">
                <p className="text-xs font-semibold text-surface-700 truncate leading-tight">{original}</p>
                {sub && <p className="text-[10px] text-surface-400 mt-0.5 truncate">{sub}</p>}
                <p className="text-[10px] text-success-600 font-medium mt-0.5">{fmtShort(revenue)}</p>
            </div>

            {/* Arrow */}
            <div className={`shrink-0 text-surface-300 text-[10px] font-mono transition-colors ${isChanged ? 'text-accent-400' : ''}`}>→</div>

            {/* Right: customized input */}
            <div className="flex-1 relative flex items-center gap-1">
                <input
                    type="text"
                    value={customized}
                    onChange={e => onChange(e.target.value)}
                    placeholder={original}
                    className={`w-full text-xs px-3 py-2 rounded-lg border outline-none transition-all
                        ${isChanged
                            ? 'border-accent-300 bg-white text-accent-700 ring-2 ring-accent-100 font-medium'
                            : 'border-surface-200 bg-white/60 text-surface-600 focus:border-accent-300 focus:ring-2 focus:ring-accent-100'
                        }`}
                />
                {isChanged && (
                    <button
                        onClick={onReset}
                        className="shrink-0 w-6 h-6 rounded-md flex items-center justify-center text-surface-300 hover:text-danger-400 hover:bg-danger-50 transition-colors"
                        title="Đặt lại về tên gốc"
                    >
                        <RotateCcw className="size-3" />
                    </button>
                )}
            </div>

            {/* Changed badge */}
            {isChanged && (
                <div className="shrink-0">
                    <CheckCircle2 className="size-3.5 text-accent-500" />
                </div>
            )}
        </div>
    );
}

// ── Main Dialog ───────────────────────────────────────────────────────────────
export default function ExcelExportDialog({
    open, onClose, data, sellData, dailyPanel, activeRange,
}: ExcelExportDialogProps) {
    const [columnTarget, setColumnTarget] = useState<ColumnTarget>('goods');
    // Initialize from localStorage so previous customizations are preserved
    const [goodsNameMap, setGoodsNameMap] = useState<NameMap>(() => loadFromLS(LS_GOODS_KEY));
    const [categoryNameMap, setCategoryNameMap] = useState<NameMap>(() => loadFromLS(LS_CATEGORY_KEY));
    const [search, setSearch] = useState('');
    const [isExporting, setIsExporting] = useState(false);
    const [filterMode, setFilterMode] = useState<'all' | 'customized' | 'uncustomized'>('all');
    const [savedFlash, setSavedFlash] = useState(false);
    const [bypassCustom, setBypassCustom] = useState(false);
    const overlayRef = useRef<HTMLDivElement>(null);

    // Auto-save to localStorage whenever maps change
    useEffect(() => { saveToLS(LS_GOODS_KEY, goodsNameMap); }, [goodsNameMap]);
    useEffect(() => { saveToLS(LS_CATEGORY_KEY, categoryNameMap); }, [categoryNameMap]);

    // Extract unique names
    const goodsItems = useMemo(() => extractGoodsNames(sellData, dailyPanel), [sellData, dailyPanel]);
    const categoryItems = useMemo(() => extractCategoryNames(sellData, dailyPanel), [sellData, dailyPanel]);

    const currentItems = columnTarget === 'goods' ? goodsItems : categoryItems;
    const currentMap = columnTarget === 'goods' ? goodsNameMap : categoryNameMap;
    const setCurrentMap = columnTarget === 'goods' ? setGoodsNameMap : setCategoryNameMap;

    const customizedCount = Object.values(currentMap).filter(v => v !== '').length;

    const filteredItems = useMemo(() => {
        let items = currentItems;

        // Filter by search
        if (search.trim()) {
            const q = search.toLowerCase();
            items = items.filter(i => i.name.toLowerCase().includes(q) || (currentMap[i.name] || '').toLowerCase().includes(q));
        }

        // Filter by mode
        if (filterMode === 'customized') items = items.filter(i => currentMap[i.name] && currentMap[i.name] !== '');
        if (filterMode === 'uncustomized') items = items.filter(i => !currentMap[i.name] || currentMap[i.name] === '');

        return items;
    }, [currentItems, search, currentMap, filterMode]);

    const handleChange = useCallback((name: string, val: string) => {
        setCurrentMap(prev => ({ ...prev, [name]: val }));
    }, [setCurrentMap]);

    const handleReset = useCallback((name: string) => {
        setCurrentMap(prev => {
            const next = { ...prev };
            delete next[name];
            return next;
        });
    }, [setCurrentMap]);

    const handleResetAll = useCallback(() => {
        setCurrentMap({});
    }, [setCurrentMap]);

    // Manual save with flash feedback (auto-save already runs, this is for UX confirmation)
    const handleManualSave = useCallback(() => {
        saveToLS(LS_GOODS_KEY, goodsNameMap);
        saveToLS(LS_CATEGORY_KEY, categoryNameMap);
        setSavedFlash(true);
        setTimeout(() => setSavedFlash(false), 2000);
    }, [goodsNameMap, categoryNameMap]);

    const handleExport = useCallback(async () => {
        setIsExporting(true);
        try {
            // When bypassed, pass empty maps so original names are used
            await exportToExcel(
                data, sellData, dailyPanel,
                bypassCustom ? {} : goodsNameMap,
                bypassCustom ? {} : categoryNameMap,
                activeRange,
            );
        } finally {
            setIsExporting(false);
        }
    }, [data, sellData, dailyPanel, goodsNameMap, categoryNameMap, activeRange, bypassCustom]);

    // Close on overlay click
    const handleOverlayClick = useCallback((e: React.MouseEvent) => {
        if (e.target === overlayRef.current) onClose();
    }, [onClose]);

    // Close on Esc
    useEffect(() => {
        if (!open) return;
        const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
        document.addEventListener('keydown', handler);
        return () => document.removeEventListener('keydown', handler);
    }, [open, onClose]);

    if (!open) return null;

    const totalCustomized = Object.values(goodsNameMap).filter(v => v !== '').length
        + Object.values(categoryNameMap).filter(v => v !== '').length;

    return (
        <div
            ref={overlayRef}
            onClick={handleOverlayClick}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-[2px] animate-in fade-in duration-200"
        >
            <div
                className="relative flex flex-col w-full max-w-3xl max-h-[90vh] bg-white rounded-3xl shadow-2xl shadow-black/20 border border-surface-100 overflow-hidden animate-in zoom-in-95 slide-in-from-bottom-4 duration-300"
                onClick={e => e.stopPropagation()}
            >
                {/* ── Header ─────────────────────────────────────── */}
                <div className="relative flex items-center gap-4 px-6 pt-6 pb-5 border-b border-surface-100">
                    {/* Gradient accent bar */}
                    <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-accent-500 via-violet-500 to-emerald-400 rounded-t-3xl" />

                    <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-accent-500 to-violet-600 flex items-center justify-center shadow-lg shadow-accent-200 shrink-0">
                        <FileSpreadsheet className="size-5 text-white" />
                    </div>
                    <div className="flex-1 min-w-0">
                        <h2 className="text-base font-bold text-surface-800 leading-tight">Tùy chỉnh & Xuất Excel</h2>
                        <p className="text-xs text-surface-400 mt-0.5 truncate">
                            {activeRange} · {goodsItems.length} sản phẩm · {categoryItems.length} danh mục
                        </p>
                    </div>
                    {totalCustomized > 0 && (
                        <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-accent-50 border border-accent-200 shrink-0">
                            <Wand2 className="size-3 text-accent-500" />
                            <span className="text-xs font-semibold text-accent-600">{totalCustomized} đã đổi</span>
                        </div>
                    )}
                    <button
                        onClick={onClose}
                        className="shrink-0 w-8 h-8 rounded-xl flex items-center justify-center text-surface-400 hover:text-surface-700 hover:bg-surface-100 transition-colors"
                    >
                        <X className="size-4" />
                    </button>
                </div>

                {/* ── Column Target Tabs ─────────────────────────── */}
                <div className="flex items-center gap-1.5 px-6 pt-4 pb-0">
                    <span className="text-xs font-semibold text-surface-500 mr-1 whitespace-nowrap">Tùy chỉnh cột:</span>
                    {([
                        { key: 'goods' as ColumnTarget, label: 'Tên hàng hóa', icon: <Package className="size-3.5" />, count: goodsItems.length, customized: Object.values(goodsNameMap).filter(v => v !== '').length },
                        { key: 'category' as ColumnTarget, label: 'Tên danh mục', icon: <Layers className="size-3.5" />, count: categoryItems.length, customized: Object.values(categoryNameMap).filter(v => v !== '').length },
                    ] as { key: ColumnTarget; label: string; icon: React.ReactNode; count: number; customized: number }[]).map(tab => (
                        <button
                            key={tab.key}
                            onClick={() => { setColumnTarget(tab.key); setSearch(''); setFilterMode('all'); }}
                            className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold transition-all ${columnTarget === tab.key
                                ? 'bg-accent-600 text-white shadow-sm shadow-accent-200'
                                : 'text-surface-500 hover:text-surface-700 hover:bg-surface-100'
                                }`}
                        >
                            {tab.icon}
                            {tab.label}
                            <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-bold ${columnTarget === tab.key ? 'bg-white/25 text-white' : 'bg-surface-100 text-surface-500'}`}>
                                {tab.count}
                            </span>
                            {tab.customized > 0 && (
                                <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-bold ${columnTarget === tab.key ? 'bg-emerald-400/30 text-emerald-100' : 'bg-accent-100 text-accent-600'}`}>
                                    ✓ {tab.customized}
                                </span>
                            )}
                        </button>
                    ))}
                </div>

                {/* ── Search + Filter bar ────────────────────────── */}
                <div className="flex items-center gap-2 px-6 py-3">
                    <div className="relative flex-1">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-3.5 text-surface-300 pointer-events-none" />
                        <input
                            type="text"
                            value={search}
                            onChange={e => setSearch(e.target.value)}
                            placeholder={`Tìm ${columnTarget === 'goods' ? 'hàng hóa' : 'danh mục'}...`}
                            className="w-full text-xs pl-8 pr-3 py-2 rounded-xl border border-surface-200 bg-surface-50 text-surface-700 placeholder-surface-300 focus:border-accent-300 focus:ring-2 focus:ring-accent-100 outline-none transition-all"
                        />
                    </div>
                    <div className="flex items-center gap-1 bg-surface-100 rounded-xl p-0.5">
                        {([
                            { key: 'all', label: 'Tất cả' },
                            { key: 'customized', label: '✓ Đã đổi' },
                            { key: 'uncustomized', label: 'Chưa đổi' },
                        ] as { key: typeof filterMode; label: string }[]).map(f => (
                            <button
                                key={f.key}
                                onClick={() => setFilterMode(f.key)}
                                className={`px-2.5 py-1.5 rounded-lg text-[11px] font-medium transition-all ${filterMode === f.key
                                    ? 'bg-white text-accent-600 shadow-sm'
                                    : 'text-surface-400 hover:text-surface-600'
                                    }`}
                            >
                                {f.label}
                            </button>
                        ))}
                    </div>
                    {customizedCount > 0 && (
                        <button
                            onClick={handleResetAll}
                            className="flex items-center gap-1.5 px-2.5 py-2 rounded-xl text-xs text-danger-400 hover:text-danger-600 hover:bg-danger-50 transition-colors border border-transparent hover:border-danger-100"
                        >
                            <RotateCcw className="size-3" />
                            Xóa hết
                        </button>
                    )}
                </div>

                {/* ── Item list info bar ─────────────────────────── */}
                <div className="px-6 pb-2 flex items-center justify-between">
                    <p className="text-[10px] text-surface-400">
                        Hiển thị <strong>{filteredItems.length}</strong> / {currentItems.length} {columnTarget === 'goods' ? 'sản phẩm' : 'danh mục'}
                    </p>
                    {customizedCount > 0 && (
                        <p className="text-[10px] text-accent-500 font-semibold">
                            {customizedCount} tên đã được tùy chỉnh
                        </p>
                    )}
                </div>

                {/* ── Scrollable item list ───────────────────────── */}
                <div className="flex-1 overflow-y-auto px-6 pb-2 space-y-0.5 scrollbar-thin" style={{ minHeight: 0 }}>
                    {filteredItems.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-12 gap-3">
                            <div className="w-12 h-12 rounded-2xl bg-surface-100 flex items-center justify-center">
                                <AlertCircle className="size-6 text-surface-300" />
                            </div>
                            <p className="text-sm text-surface-400 font-medium">Không tìm thấy</p>
                            <p className="text-xs text-surface-300">Thử điều chỉnh bộ lọc hoặc từ khóa tìm kiếm</p>
                        </div>
                    ) : (
                        filteredItems.map((item: { name: string; revenue: number; category?: string }) => (
                            <NameRow
                                key={item.name}
                                original={item.name}
                                customized={currentMap[item.name] ?? ''}
                                revenue={item.revenue}
                                sub={'category' in item ? (item as { name: string; revenue: number; category: string }).category : undefined}
                                onChange={val => handleChange(item.name, val)}
                                onReset={() => handleReset(item.name)}
                            />
                        ))
                    )}
                </div>

                {/* ── Footer ────────────────────────────────────── */}
                <div className="px-6 py-4 border-t border-surface-100 bg-surface-50/50 flex items-center justify-between gap-4 rounded-b-3xl">
                    <div className="flex-1 min-w-0">
                        {totalCustomized > 0 ? (
                            <div className="flex items-start gap-2">
                                <CheckCircle2 className="size-3.5 text-success-500 mt-0.5 shrink-0" />
                                <p className="text-xs text-surface-500 leading-snug">
                                    <span className="font-semibold text-surface-700">{totalCustomized} tên</span> đã tùy chỉnh
                                    {Object.values(goodsNameMap).filter(v => v !== '').length > 0 && ` · ${Object.values(goodsNameMap).filter(v => v !== '').length} hàng hóa`}
                                    {Object.values(categoryNameMap).filter(v => v !== '').length > 0 && ` · ${Object.values(categoryNameMap).filter(v => v !== '').length} danh mục`}
                                    <span className="ml-1.5 text-[10px] text-accent-400 font-medium">· Đã lưu tự động</span>
                                </p>
                            </div>
                        ) : (
                            <div className="flex items-start gap-2">
                                <Tag className="size-3.5 text-surface-300 mt-0.5 shrink-0" />
                                <p className="text-xs text-surface-400 leading-snug">
                                    Tùy chỉnh tên cột trước khi xuất, hoặc xuất ngay với tên gốc.
                                </p>
                            </div>
                        )}
                    </div>
                    {/* Bypass toggle — only visible when there are customizations */}
                    {totalCustomized > 0 && (
                        <label className="flex items-center gap-2 cursor-pointer select-none shrink-0">
                            <div
                                onClick={() => setBypassCustom(v => !v)}
                                className={`relative w-9 h-5 rounded-full transition-colors duration-200 ${bypassCustom ? 'bg-orange-400' : 'bg-surface-200'}`}
                            >
                                <div className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform duration-200 ${bypassCustom ? 'translate-x-4' : 'translate-x-0.5'}`} />
                            </div>
                            <span className={`text-xs font-semibold transition-colors ${bypassCustom ? 'text-orange-600' : 'text-surface-400 hover:text-surface-600'}`}>
                                Xuất tên gốc
                            </span>
                        </label>
                    )}
                    <div className="flex items-center gap-2 shrink-0">
                        {/* Save button with flash feedback */}
                        {totalCustomized > 0 && (
                            <button
                                onClick={handleManualSave}
                                className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold border transition-all ${savedFlash
                                    ? 'bg-success-50 border-success-200 text-success-600'
                                    : 'border-surface-200 text-surface-500 hover:text-surface-700 hover:border-surface-300 hover:bg-surface-50'
                                    }`}
                                title="Lưu cấu hình vào trình duyệt"
                            >
                                <Save className="size-3.5" />
                                {savedFlash ? 'Đã lưu!' : 'Lưu cấu hình'}
                            </button>
                        )}
                        <button
                            onClick={onClose}
                            className="px-4 py-2 rounded-xl text-sm font-medium text-surface-500 hover:text-surface-700 hover:bg-surface-100 transition-colors"
                        >
                            Hủy
                        </button>
                        <button
                            onClick={handleExport}
                            disabled={isExporting || data.length === 0}
                            className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-white text-sm font-semibold shadow-md hover:shadow-lg hover:scale-[1.02] active:scale-[0.98] transition-all disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100 ${bypassCustom
                                ? 'bg-gradient-to-r from-orange-500 to-amber-500 shadow-orange-200 hover:shadow-orange-300'
                                : 'bg-gradient-to-r from-accent-600 to-violet-600 shadow-accent-200 hover:shadow-accent-300'}`}
                        >
                            {isExporting ? (
                                <svg className="size-4 animate-spin" viewBox="0 0 24 24" fill="none">
                                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                                </svg>
                            ) : (
                                <Download className="size-4" />
                            )}
                            {isExporting ? 'Đang xuất...' : bypassCustom ? 'Xuất Excel (tên gốc)' : 'Xuất Excel'}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
