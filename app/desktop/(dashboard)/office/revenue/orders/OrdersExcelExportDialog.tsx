'use client';

import { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import {
    FileSpreadsheet, X, Search, RotateCcw, Download,
    Wand2, Tag, Package, CheckCircle2, AlertCircle, Layers,
    ShoppingCart, Save, FileDown, RefreshCw,
    FileBarChart,
} from 'lucide-react';
import type { OrderRecord, GoodsRecord, ProductCatalogItem, GiftCatalogItem } from './actions';
import { fetchProductCatalog, fetchGiftCatalog } from './actions';

// ── Types ────────────────────────────────────────────────────────────────────
type ColumnTarget = 'goods' | 'category';
type ViewMode = 'orders' | 'goods';

interface NameMap { [originalName: string]: string; }

interface Props {
    open: boolean;
    onClose: () => void;
    orders: OrderRecord[];
    goods: GoodsRecord[];
    viewMode: ViewMode;
    activeRange: string;
}

// ── localStorage helpers ─────────────────────────────────────────────────────
const LS_GOODS_KEY = 'orders_export_goods_name_map';
const LS_CATEGORY_KEY = 'orders_export_category_name_map';

function loadFromLS(key: string): NameMap {
    if (typeof window === 'undefined') return {};
    try {
        const raw = localStorage.getItem(key);
        return raw ? (JSON.parse(raw) as NameMap) : {};
    } catch { return {}; }
}

function saveToLS(key: string, map: NameMap) {
    if (typeof window === 'undefined') return;
    try {
        const filtered = Object.fromEntries(Object.entries(map).filter(([, v]) => v !== ''));
        localStorage.setItem(key, JSON.stringify(filtered));
    } catch { /* quota exceeded */ }
}

// ── Helpers ──────────────────────────────────────────────────────────────────
const fmtVND = (v: number) => v.toLocaleString('vi-VN', { style: 'currency', currency: 'VND', maximumFractionDigits: 0 });
const fmtShort = (v: number) => {
    if (v >= 1_000_000_000) return `${(v / 1_000_000_000).toFixed(1)} tỷ`;
    if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(1)}M`;
    if (v >= 1_000) return `${(v / 1_000).toFixed(0)}K`;
    return v.toLocaleString('vi-VN');
};

// ── Extract unique items ──────────────────────────────────────────────────────
function extractGoodsFromOrders(goods: GoodsRecord[]): { name: string; category: string; revenue: number }[] {
    const map = new Map<string, { category: string; revenue: number }>();
    for (const g of goods) {
        if (g.realMoney > 0) {
            const ex = map.get(g.goodsName);
            if (ex) {
                ex.revenue += g.realMoney;
            } else {
                map.set(g.goodsName, { category: g.showCategoryName, revenue: g.realMoney });
            }
        }
    }
    return Array.from(map.entries())
        .map(([name, { category, revenue }]) => ({ name, category, revenue }))
        .sort((a, b) => b.revenue - a.revenue);
}

function extractCategoriesFromOrders(goods: GoodsRecord[]): { name: string; revenue: number }[] {
    const map = new Map<string, number>();
    for (const g of goods) {
        if (g.realMoney > 0 && g.showCategoryName) {
            map.set(g.showCategoryName, (map.get(g.showCategoryName) || 0) + g.realMoney);
        }
    }
    return Array.from(map.entries())
        .map(([name, revenue]) => ({ name, revenue }))
        .sort((a, b) => b.revenue - a.revenue);
}

// ── Excel Export Logic ────────────────────────────────────────────────────────
async function exportOrdersExcel(
    orders: OrderRecord[],
    goods: GoodsRecord[],
    viewMode: ViewMode,
    goodsNameMap: NameMap,
    categoryNameMap: NameMap,
    activeRange: string,
) {
    const ExcelJS = (await import('exceljs')).default;
    const { saveAs } = await import('file-saver');
    const wb = new ExcelJS.Workbook();
    wb.creator = 'Orders Dashboard';
    wb.created = new Date();

    const HEADER_STYLE = (argb: string) => ({
        fill: { type: 'pattern' as const, pattern: 'solid' as const, fgColor: { argb } },
        font: { color: { argb: 'FFFFFFFF' }, bold: true, size: 11 },
        alignment: { horizontal: 'center' as const, vertical: 'middle' as const },
    });

    if (viewMode === 'orders') {
        // ── Sheet: Danh sách đơn hàng ─────────────────────────────────────
        const ws = wb.addWorksheet('Đơn hàng', { views: [{ state: 'frozen', ySplit: 1 }] });
        ws.columns = [
            { header: 'Mã Đơn Hàng', key: 'orderNumber', width: 22 },
            { header: 'Thời Gian', key: 'createTime', width: 20 },
            { header: 'Nhân Viên', key: 'employeeName', width: 18 },
            { header: 'Sản Phẩm', key: 'goodsNames', width: 36 },
            { header: 'SL', key: 'totalQty', width: 8 },
            { header: 'Thực Thu (VND)', key: 'realMoney', width: 20 },
            { header: 'Giảm Giá (VND)', key: 'discountMoney', width: 18 },
            { header: 'Hoàn Huỷ (VND)', key: 'cancelMoney', width: 18 },
            { header: 'Tiền Thuế (VND)', key: 'taxMoney', width: 18 },
            { header: 'Thanh Toán', key: 'payModeNames', width: 20 },
            { header: 'Trạng Thái', key: 'statusName', width: 14 },
            { header: 'Quầy', key: 'terminalName', width: 14 },
        ];

        const hr = ws.getRow(1);
        hr.eachCell(cell => Object.assign(cell, HEADER_STYLE('FF4F46E5')));
        hr.height = 28;

        orders.forEach((o, idx) => {
            const r = ws.addRow({
                orderNumber: o.orderNumber,
                createTime: o.createTime.slice(0, 16),
                employeeName: o.employeeName,
                goodsNames: o.goodsNames,
                totalQty: o.totalQty,
                realMoney: o.realMoney,
                discountMoney: o.discountMoney,
                cancelMoney: o.cancelMoney,
                taxMoney: o.taxMoney,
                payModeNames: o.payModeNames,
                statusName: o.statusName,
                terminalName: o.terminalName,
            });
            r.height = 20;
            const bg = idx % 2 === 0 ? 'FFFAFAFA' : 'FFFFFFFF';
            r.eachCell((cell, col) => {
                cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: bg } };
                cell.alignment = { vertical: 'middle', horizontal: col <= 2 || col >= 10 ? 'left' : 'right' };
                cell.border = { bottom: { style: 'thin', color: { argb: 'FFF1F5F9' } } };
                if (col >= 6 && col <= 9) cell.numFmt = '#,##0';
            });
            if (o.status === 3) r.getCell('realMoney').font = { bold: true, color: { argb: 'FF059669' } };
            if (o.status === 4) r.getCell('realMoney').font = { color: { argb: 'FFD1D5DB' }, italic: true };
        });

        // Total row
        const total = ws.addRow({
            orderNumber: 'TỔNG CỘNG',
            totalQty: orders.reduce((s, o) => s + o.totalQty, 0),
            realMoney: orders.reduce((s, o) => s + o.realMoney, 0),
            discountMoney: orders.reduce((s, o) => s + o.discountMoney, 0),
            cancelMoney: orders.reduce((s, o) => s + o.cancelMoney, 0),
            taxMoney: orders.reduce((s, o) => s + o.taxMoney, 0),
        });
        total.height = 26;
        total.eachCell((cell, col) => {
            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE0E7FF' } };
            cell.font = { bold: true, color: { argb: 'FF3730A3' } };
            cell.alignment = { vertical: 'middle', horizontal: col === 1 ? 'left' : 'right' };
            cell.border = { top: { style: 'medium', color: { argb: 'FF6366F1' } } };
            if (col >= 6 && col <= 9) cell.numFmt = '#,##0';
        });

    } else {
        // ── Sheet 1: Hàng hóa (by goods line) ────────────────────────────
        const ws = wb.addWorksheet('Hàng hóa', { views: [{ state: 'frozen', ySplit: 1 }] });
        ws.columns = [
            { header: 'Mã Đơn Hàng', key: 'orderNumber', width: 22 },
            { header: 'Thời Gian', key: 'createTime', width: 20 },
            { header: 'Tên Sản Phẩm', key: 'goodsName', width: 32 },
            { header: 'Danh Mục', key: 'showCategoryName', width: 22 },
            { header: 'Đơn Giá (VND)', key: 'price', width: 18 },
            { header: 'SL', key: 'qty', width: 8 },
            { header: 'Thành Tiền Trước Thuế (VND)', key: 'totalBeforeTax', width: 28 },
            { header: 'Thuế (VND)', key: 'taxMoney', width: 16 },
            { header: 'Thực Thu (VND)', key: 'realMoney', width: 20 },
            { header: 'Thanh Toán', key: 'payModeNames', width: 20 },
            { header: 'Nhân Viên', key: 'employeeName', width: 16 },
            { header: 'Trạng Thái', key: 'statusName', width: 14 },
        ];

        const hr = ws.getRow(1);
        hr.eachCell(cell => Object.assign(cell, HEADER_STYLE('FF065F46')));
        hr.height = 28;

        goods.forEach((g, idx) => {
            const r = ws.addRow({
                orderNumber: g.orderNumber,
                createTime: g.createTime.slice(0, 16),
                goodsName: goodsNameMap[g.goodsName] || g.goodsName,
                showCategoryName: categoryNameMap[g.showCategoryName] || g.showCategoryName,
                price: g.price,
                qty: g.qty,
                totalBeforeTax: g.totalBeforeTax,
                taxMoney: g.taxMoney,
                realMoney: g.realMoney,
                payModeNames: g.payModeNames,
                employeeName: g.employeeName,
                statusName: g.statusName,
            });
            r.height = 20;
            const bg = idx % 2 === 0 ? 'FFFAFAFA' : 'FFFFFFFF';
            r.eachCell((cell, col) => {
                cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: bg } };
                cell.alignment = { vertical: 'middle', horizontal: col <= 2 || col >= 10 ? 'left' : 'right' };
                cell.border = { bottom: { style: 'thin', color: { argb: 'FFF1F5F9' } } };
                if ([5, 7, 8, 9].includes(col)) cell.numFmt = '#,##0';
            });
            r.getCell('realMoney').font = { bold: true, color: { argb: 'FF059669' } };
        });

        // Total row
        const total = ws.addRow({
            orderNumber: 'TỔNG CỘNG',
            qty: goods.reduce((s, g) => s + g.qty, 0),
            totalBeforeTax: goods.reduce((s, g) => s + g.totalBeforeTax, 0),
            taxMoney: goods.reduce((s, g) => s + g.taxMoney, 0),
            realMoney: goods.reduce((s, g) => s + g.realMoney, 0),
        });
        total.height = 26;
        total.eachCell((cell, col) => {
            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFD1FAE5' } };
            cell.font = { bold: true, color: { argb: 'FF065F46' } };
            cell.alignment = { vertical: 'middle', horizontal: col === 1 ? 'left' : 'right' };
            cell.border = { top: { style: 'medium', color: { argb: 'FF10B981' } } };
            if ([5, 7, 8, 9].includes(col)) cell.numFmt = '#,##0';
        });

        // ── Sheet 2: Tổng hợp theo sản phẩm ─────────────────────────────
        const ws2 = wb.addWorksheet('Tổng hợp SP', { views: [{ state: 'frozen', ySplit: 1 }] });
        ws2.columns = [
            { header: 'Danh Mục', key: 'category', width: 24 },
            { header: 'Tên Sản Phẩm', key: 'goodsName', width: 32 },
            { header: 'Tổng SL', key: 'qty', width: 12 },
            { header: 'Tổng Thực Thu (VND)', key: 'realMoney', width: 22 },
        ];
        const hr2 = ws2.getRow(1);
        hr2.eachCell(cell => Object.assign(cell, HEADER_STYLE('FF7C3AED')));
        hr2.height = 28;

        // Group by category then goodsName
        const catMap = new Map<string, Map<string, { qty: number; realMoney: number }>>();
        for (const g of goods) {
            const catKey = categoryNameMap[g.showCategoryName] || g.showCategoryName;
            const goodsKey = goodsNameMap[g.goodsName] || g.goodsName;
            if (!catMap.has(catKey)) catMap.set(catKey, new Map());
            const inner = catMap.get(catKey)!;
            const ex = inner.get(goodsKey);
            if (ex) { ex.qty += g.qty; ex.realMoney += g.realMoney; }
            else inner.set(goodsKey, { qty: g.qty, realMoney: g.realMoney });
        }

        let ri = 0;
        for (const [catName, items] of catMap) {
            const catTotal = Array.from(items.values()).reduce((s, v) => ({ qty: s.qty + v.qty, realMoney: s.realMoney + v.realMoney }), { qty: 0, realMoney: 0 });
            const catRow = ws2.addRow({ category: catName, goodsName: '', qty: catTotal.qty, realMoney: catTotal.realMoney });
            catRow.height = 24;
            catRow.eachCell((cell, col) => {
                cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFEDE9FE' } };
                cell.font = { bold: true, color: { argb: 'FF5B21B6' } };
                cell.alignment = { vertical: 'middle', horizontal: col <= 2 ? 'left' : 'right' };
                if (col >= 3) cell.numFmt = '#,##0';
            });

            const sorted = Array.from(items.entries()).sort((a, b) => b[1].realMoney - a[1].realMoney);
            for (const [goodsName, { qty, realMoney }] of sorted) {
                const r = ws2.addRow({ category: '', goodsName, qty, realMoney });
                r.height = 20;
                const bg = ri % 2 === 0 ? 'FFFAFAFA' : 'FFFFFFFF';
                r.eachCell((cell, col) => {
                    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: bg } };
                    cell.alignment = { vertical: 'middle', horizontal: col <= 2 ? 'left' : 'right', indent: col === 2 ? 2 : 0 };
                    cell.border = { bottom: { style: 'thin', color: { argb: 'FFF1F5F9' } } };
                    if (col >= 3) cell.numFmt = '#,##0';
                });
                ri++;
            }
        }
    }

    // ── Reference sheet: name map (if any) ──────────────────────────────
    const hasCustom = Object.keys(goodsNameMap).length > 0 || Object.keys(categoryNameMap).length > 0;
    if (hasCustom) {
        const ws3 = wb.addWorksheet('Bảng tên tùy chỉnh');
        ws3.columns = [
            { header: 'Loại', key: 'type', width: 16 },
            { header: 'Tên gốc', key: 'original', width: 36 },
            { header: 'Tên tùy chỉnh', key: 'custom', width: 36 },
        ];
        const hr3 = ws3.getRow(1);
        hr3.eachCell(cell => Object.assign(cell, HEADER_STYLE('FF6D28D9')));
        hr3.height = 26;

        let ri3 = 0;
        for (const [orig, custom] of Object.entries(categoryNameMap)) {
            const r = ws3.addRow({ type: 'Danh mục', original: orig, custom });
            r.eachCell(cell => {
                cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: ri3 % 2 === 0 ? 'FFFAF5FF' : 'FFFFFFFF' } };
                cell.alignment = { vertical: 'middle' };
            });
            ri3++;
        }
        for (const [orig, custom] of Object.entries(goodsNameMap)) {
            const r = ws3.addRow({ type: 'Hàng hóa', original: orig, custom });
            r.eachCell(cell => {
                cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: ri3 % 2 === 0 ? 'FFECFDF5' : 'FFFFFFFF' } };
                cell.alignment = { vertical: 'middle' };
            });
            ri3++;
        }
    }

    const buf = await wb.xlsx.writeBuffer();
    const blob = new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    const safeName = activeRange.replace(/[^a-zA-Z0-9\-]/g, '_');
    const prefix = viewMode === 'orders' ? 'don_hang' : 'hang_hoa';
    saveAs(blob, `${prefix}_${safeName}_${new Date().toISOString().slice(0, 10)}.xlsx`);
}


// ── Payment classification helper ─────────────────────────────────────────────
function classifyPayment(payModeNames: string): { cash: boolean; transfer: boolean } {
    const s = (payModeNames ?? '').toLowerCase();
    const cash = s.includes('tiền mặt') || s.includes('tien mat') || s.includes('cash');
    const transfer = s.includes('chuyển khoản') || s.includes('chuyen khoan')
        || s.includes('ck') || s.includes('banking') || s.includes('zalopay')
        || s.includes('momo') || s.includes('vnpay') || s.includes('payme');
    return { cash, transfer };
}

// ── Qty-Count Export (with full catalog + revenue breakdown + souvenir) ────────
async function exportQtySummary(
    goods: GoodsRecord[],
    catalog: ProductCatalogItem[],
    giftCatalog: GiftCatalogItem[],
    goodsNameMap: NameMap,
    categoryNameMap: NameMap,
    activeRange: string,
) {
    const ExcelJS = (await import('exceljs')).default;
    const { saveAs } = await import('file-saver');
    const wb = new ExcelJS.Workbook();
    wb.creator = 'Orders Dashboard';
    wb.created = new Date();

    // ── Colour palette ────────────────────────────────────────────────────────
    const TEAL = 'FF0F766E';
    const ORANGE = 'FFB45309';     // for souvenir row
    const numFmtMoney = '#,##0';
    const numFmtQty = '#,##0';

    // ── Helper: style a header row ────────────────────────────────────────────
    const styleHeader = (row: import('exceljs').Row, color: string) => {
        row.height = 36;
        row.eachCell(cell => {
            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: color } };
            cell.font = { color: { argb: 'FFFFFFFF' }, bold: true, size: 11 };
            cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
        });
    };

    // ── Build stats per product from GoodsRecord — ONLY status === 3 ──────────
    interface PStats { qty: number; revenue: number; cash: number; transfer: number }
    const statsMap = new Map<string, PStats>();              // key = goodsName (original)

    // Set of gift goodsNames for souvenir detection
    const giftNameSet = new Set(giftCatalog.map(g => g.giftName));

    // Souvenir aggregates (physical goods not in setmeal catalog)
    let souvenirQty = 0, souvenirRevenue = 0, souvenirCash = 0, souvenirTransfer = 0;

    // Build set of setmeal catalog names for quick lookup
    const setmealNameSet = new Set(catalog.map(c => c.name));

    for (const g of goods) {
        if (g.status !== 3) continue;

        const { cash: isCash, transfer: isTransfer } = classifyPayment(g.payModeNames);
        let cashAmt = 0, transferAmt = 0;
        if (isCash && isTransfer) { cashAmt = g.realMoney / 2; transferAmt = g.realMoney / 2; }
        else if (isCash) { cashAmt = g.realMoney; }
        else if (isTransfer) { transferAmt = g.realMoney; }
        else { cashAmt = g.realMoney; } // default → cash

        // Detect souvenir: in gift catalog OR showCategoryName contains physical-goods keywords
        const catLower = (g.showCategoryName ?? '').toLowerCase();
        const isPhysical = giftNameSet.has(g.goodsName)
            || catLower.includes('vật lý')
            || catLower.includes('lưu niệm')
            || catLower.includes('hàng hóa')
            || catLower.includes('quà tặng')
            || (!setmealNameSet.has(g.goodsName) && g.goodsName !== '');

        if (isPhysical) {
            souvenirQty += g.qty;
            souvenirRevenue += g.realMoney;
            souvenirCash += cashAmt;
            souvenirTransfer += transferAmt;
        } else {
            const prev = statsMap.get(g.goodsName) ?? { qty: 0, revenue: 0, cash: 0, transfer: 0 };
            statsMap.set(g.goodsName, {
                qty: prev.qty + g.qty,
                revenue: prev.revenue + g.realMoney,
                cash: prev.cash + cashAmt,
                transfer: prev.transfer + transferAmt,
            });
        }
    }

    // Build per-gift stats map for Sheet 2
    const giftStatsMap = new Map<string, PStats>();
    for (const g of goods) {
        if (g.status !== 3) continue;
        const catLower = (g.showCategoryName ?? '').toLowerCase();
        const isPhysical = giftNameSet.has(g.goodsName)
            || catLower.includes('vật lý') || catLower.includes('lưu niệm')
            || catLower.includes('hàng hóa') || catLower.includes('quà tặng')
            || (!setmealNameSet.has(g.goodsName) && g.goodsName !== '');
        if (!isPhysical) continue;

        const { cash: isCash, transfer: isTransfer } = classifyPayment(g.payModeNames);
        let cashAmt = 0, transferAmt = 0;
        if (isCash && isTransfer) { cashAmt = g.realMoney / 2; transferAmt = g.realMoney / 2; }
        else if (isCash) { cashAmt = g.realMoney; }
        else if (isTransfer) { transferAmt = g.realMoney; }
        else { cashAmt = g.realMoney; }

        const prev = giftStatsMap.get(g.goodsName) ?? { qty: 0, revenue: 0, cash: 0, transfer: 0 };
        giftStatsMap.set(g.goodsName, {
            qty: prev.qty + g.qty,
            revenue: prev.revenue + g.realMoney,
            cash: prev.cash + cashAmt,
            transfer: prev.transfer + transferAmt,
        });
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // SHEET 1 — Thống kê số lượng
    // ═══════════════════════════════════════════════════════════════════════════
    const ws = wb.addWorksheet('Thống kê số lượng', { views: [{ state: 'frozen', ySplit: 1 }] });
    ws.columns = [
        { header: 'Loại', key: 'kind', width: 14 },
        { header: 'Danh Mục', key: 'category', width: 26 },
        { header: 'Tên Sản Phẩm', key: 'goodsName', width: 38 },
        { header: 'SL Bán', key: 'qty', width: 10 },
        { header: 'Doanh Thu (VND)', key: 'revenue', width: 20 },
        { header: 'Tiền Mặt (VND)', key: 'cash', width: 18 },
        { header: 'Chuyển Khoản (VND)', key: 'transfer', width: 20 },
    ];
    styleHeader(ws.getRow(1), TEAL);

    // ── Group setmeal catalog by typeName ────────────────────────────────────
    const typeMap = new Map<string, ProductCatalogItem[]>();
    for (const item of catalog) {
        const t = item.typeName || 'Khác';
        if (!typeMap.has(t)) typeMap.set(t, []);
        typeMap.get(t)!.push(item);
    }

    const sortedTypes = Array.from(typeMap.entries())
        .map(([typeName, items]) => ({
            typeName,
            items,
            totalRevenue: items.reduce((s, i) => s + (statsMap.get(i.name)?.revenue ?? 0), 0),
        }))
        .sort((a, b) => b.totalRevenue - a.totalRevenue || a.typeName.localeCompare(b.typeName));

    let gQty = 0, gRevenue = 0, gCash = 0, gTransfer = 0;
    let rowIdx = 0;

    for (const { typeName, items, totalRevenue } of sortedTypes) {
        const displayCat = categoryNameMap[typeName] || typeName;
        const kindLabel = items[0]?.categoryType === 'coin' ? 'Gói thẻ' : 'Vé';

        const catQty = items.reduce((s, i) => s + (statsMap.get(i.name)?.qty ?? 0), 0);
        const catCash = items.reduce((s, i) => s + (statsMap.get(i.name)?.cash ?? 0), 0);
        const catTransfer = items.reduce((s, i) => s + (statsMap.get(i.name)?.transfer ?? 0), 0);

        // Category header
        const catRow = ws.addRow({ kind: kindLabel, category: displayCat, goodsName: '', qty: catQty, revenue: totalRevenue, cash: catCash, transfer: catTransfer });
        catRow.height = 26;
        catRow.eachCell((cell, col) => {
            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE6FFFA' } };
            cell.font = { bold: true, color: { argb: TEAL }, size: 11 };
            cell.alignment = { vertical: 'middle', horizontal: col <= 3 ? 'left' : 'right' };
            cell.border = { top: { style: 'thin', color: { argb: 'FF99F6E4' } }, bottom: { style: 'thin', color: { argb: 'FF99F6E4' } } };
            if (col === 4) cell.numFmt = numFmtQty;
            if (col >= 5) cell.numFmt = numFmtMoney;
        });

        const sortedItems = [...items].sort((a, b) => {
            const ra = statsMap.get(a.name)?.revenue ?? 0;
            const rb = statsMap.get(b.name)?.revenue ?? 0;
            return rb - ra || a.name.localeCompare(b.name);
        });

        for (const item of sortedItems) {
            const st = statsMap.get(item.name);
            const qty = st?.qty ?? 0;
            const revenue = st?.revenue ?? 0;
            const cash = st?.cash ?? 0;
            const transfer = st?.transfer ?? 0;
            const displayName = goodsNameMap[item.name] || item.name;
            const isSold = qty > 0;
            const isDisabled = !item.isEnabled;

            const r = ws.addRow({ kind: '', category: '', goodsName: displayName, qty, revenue, cash, transfer });
            r.height = 22;
            const bg = rowIdx % 2 === 0 ? 'FFFAFAFA' : 'FFFFFFFF';
            r.eachCell((cell, col) => {
                cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: bg } };
                cell.alignment = { vertical: 'middle', horizontal: col >= 4 ? 'right' : 'left', indent: col === 3 ? 2 : 0 };
                cell.border = { bottom: { style: 'thin', color: { argb: 'FFF1F5F9' } } };
                if (col === 4) { cell.numFmt = numFmtQty; cell.font = isSold ? { bold: true, color: { argb: TEAL } } : { color: { argb: 'FFCBD5E1' }, italic: true }; }
                if (col >= 5) { cell.numFmt = numFmtMoney; cell.font = isSold ? { color: { argb: 'FF065F46' } } : { color: { argb: 'FFCBD5E1' }, italic: true }; }
                if (col === 3 && isDisabled) { cell.font = { color: { argb: 'FFCBD5E1' }, italic: true, strike: true }; }
            });
            rowIdx++;
        }

        gQty += catQty;
        gRevenue += totalRevenue;
        gCash += catCash;
        gTransfer += catTransfer;
    }

    // ── Souvenir summary row (single aggregated row, no sub-items) ────────────
    if (souvenirRevenue > 0 || souvenirQty > 0) {
        // Separator
        const sepRow = ws.addRow({ kind: '', category: '', goodsName: '', qty: '', revenue: '', cash: '', transfer: '' });
        sepRow.height = 8;

        const souvenirRow = ws.addRow({
            kind: 'Lưu niệm',
            category: 'Hàng hóa lưu niệm',
            goodsName: `(Chi tiết xem sheet "Hàng Lưu Niệm")`,
            qty: souvenirQty,
            revenue: souvenirRevenue,
            cash: souvenirCash,
            transfer: souvenirTransfer,
        });
        souvenirRow.height = 28;
        souvenirRow.eachCell((cell, col) => {
            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFF7ED' } };
            cell.font = { bold: col <= 4, color: { argb: ORANGE }, size: col === 3 ? 10 : 11, italic: col === 3 };
            cell.alignment = { vertical: 'middle', horizontal: col >= 4 ? 'right' : 'left' };
            cell.border = { top: { style: 'thin', color: { argb: 'FFFBBF24' } }, bottom: { style: 'thin', color: { argb: 'FFFBBF24' } } };
            if (col === 4) cell.numFmt = numFmtQty;
            if (col >= 5) cell.numFmt = numFmtMoney;
        });

        gQty += souvenirQty;
        gRevenue += souvenirRevenue;
        gCash += souvenirCash;
        gTransfer += souvenirTransfer;
    }

    // ── Grand total ───────────────────────────────────────────────────────────
    const totalRow = ws.addRow({ kind: '', category: 'TỔNG CỘNG', goodsName: '', qty: gQty, revenue: gRevenue, cash: gCash, transfer: gTransfer });
    totalRow.height = 32;
    totalRow.eachCell((cell, col) => {
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: TEAL } };
        cell.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 12 };
        cell.alignment = { vertical: 'middle', horizontal: col <= 3 ? 'left' : 'right' };
        cell.border = { top: { style: 'medium', color: { argb: 'FF0D9488' } } };
        if (col === 4) cell.numFmt = numFmtQty;
        if (col >= 5) cell.numFmt = numFmtMoney;
    });

    // ═══════════════════════════════════════════════════════════════════════════
    // SHEET 2 — Hàng Lưu Niệm (full gift catalog + sold qty/revenue)
    // ═══════════════════════════════════════════════════════════════════════════
    if (giftCatalog.length > 0) {
        const ws2 = wb.addWorksheet('Hàng Lưu Niệm', { views: [{ state: 'frozen', ySplit: 1 }] });
        ws2.columns = [
            { header: 'Mã', key: 'code', width: 12 },
            { header: 'Tên Hàng Hóa', key: 'name', width: 44 },
            { header: 'Nhóm', key: 'typeName', width: 16 },
            { header: 'Giá Bán (VND)', key: 'price', width: 16 },
            { header: 'Tồn Kho', key: 'stock', width: 12 },
            { header: 'SL Bán', key: 'qty', width: 10 },
            { header: 'Doanh Thu (VND)', key: 'revenue', width: 20 },
            { header: 'Tiền Mặt (VND)', key: 'cash', width: 18 },
            { header: 'CK (VND)', key: 'transfer', width: 16 },
            { header: 'Trạng thái', key: 'status', width: 14 },
        ];
        styleHeader(ws2.getRow(1), ORANGE);

        // Group by typeName, sort sold items first
        const giftTypeMap = new Map<string, GiftCatalogItem[]>();
        for (const g of giftCatalog) {
            const t = g.typeName || 'Khác';
            if (!giftTypeMap.has(t)) giftTypeMap.set(t, []);
            giftTypeMap.get(t)!.push(g);
        }

        let gi = 0;
        for (const [typeName, items] of Array.from(giftTypeMap.entries()).sort(([a], [b]) => a.localeCompare(b))) {
            // Type header
            const typeRevenue = items.reduce((s, i) => s + (giftStatsMap.get(i.giftName)?.revenue ?? 0), 0);
            const typeQty = items.reduce((s, i) => s + (giftStatsMap.get(i.giftName)?.qty ?? 0), 0);
            const typeRow = ws2.addRow({ code: '', name: typeName, typeName: '', price: '', stock: '', qty: typeQty, revenue: typeRevenue, cash: '', transfer: '', status: '' });
            typeRow.height = 24;
            typeRow.eachCell((cell, col) => {
                cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFF7ED' } };
                cell.font = { bold: true, color: { argb: ORANGE }, size: 11 };
                cell.alignment = { vertical: 'middle', horizontal: col >= 4 ? 'right' : 'left' };
                cell.border = { top: { style: 'thin', color: { argb: 'FFFBBF24' } }, bottom: { style: 'thin', color: { argb: 'FFFBBF24' } } };
                if (col === 6) cell.numFmt = numFmtQty;
                if (col === 7 || col === 8 || col === 9) cell.numFmt = numFmtMoney;
            });

            // Sort: sold items first, then by name
            const sortedGifts = [...items].sort((a, b) => {
                const ra = giftStatsMap.get(a.giftName)?.revenue ?? 0;
                const rb = giftStatsMap.get(b.giftName)?.revenue ?? 0;
                return rb - ra || a.giftName.localeCompare(b.giftName);
            });

            for (const gift of sortedGifts) {
                const st = giftStatsMap.get(gift.giftName);
                const qty = st?.qty ?? 0;
                const revenue = st?.revenue ?? 0;
                const cash = st?.cash ?? 0;
                const transfer = st?.transfer ?? 0;
                const isSold = qty > 0;
                const statusText = !gift.isEnabled ? 'Tắt' : gift.isOpenSales ? 'Đang bán' : 'Chờ';

                const r = ws2.addRow({ code: gift.giftNo, name: gift.giftName, typeName: gift.typeName, price: gift.price, stock: gift.stockAmount, qty, revenue, cash, transfer, status: statusText });
                r.height = 22;
                const bg = gi % 2 === 0 ? 'FFFAFAFA' : 'FFFFFFFF';
                r.eachCell((cell, col) => {
                    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: bg } };
                    cell.alignment = { vertical: 'middle', horizontal: col >= 4 ? 'right' : col === 10 ? 'center' : 'left', indent: col === 2 ? 1 : 0 };
                    cell.border = { bottom: { style: 'thin', color: { argb: 'FFF1F5F9' } } };
                    if (col === 4 || col === 5) cell.numFmt = numFmtMoney;
                    if (col === 6) { cell.numFmt = numFmtQty; if (isSold) cell.font = { bold: true, color: { argb: ORANGE } }; }
                    if (col >= 7 && col <= 9) { cell.numFmt = numFmtMoney; if (isSold) cell.font = { color: { argb: ORANGE } }; }
                    if (col === 10) {
                        const fg = !gift.isEnabled ? 'FFCBD5E1' : gift.isOpenSales ? 'FF059669' : 'FFD97706';
                        cell.font = { color: { argb: fg }, bold: true, size: 10 };
                    }
                });
                gi++;
            }
        }

        // Gift grand total
        const giftTotalRow = ws2.addRow({
            code: '', name: 'TỔNG CỘNG', typeName: '', price: '',
            stock: giftCatalog.reduce((s, g) => s + g.stockAmount, 0),
            qty: souvenirQty,
            revenue: souvenirRevenue,
            cash: souvenirCash,
            transfer: souvenirTransfer,
            status: '',
        });
        giftTotalRow.height = 32;
        giftTotalRow.eachCell((cell, col) => {
            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: ORANGE } };
            cell.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 12 };
            cell.alignment = { vertical: 'middle', horizontal: col >= 4 ? 'right' : 'left' };
            cell.border = { top: { style: 'medium', color: { argb: 'FFD97706' } } };
            if (col === 5 || col === 4) cell.numFmt = numFmtMoney;
            if (col === 6) cell.numFmt = numFmtQty;
            if (col >= 7 && col <= 9) cell.numFmt = numFmtMoney;
        });
    }

    const buf = await wb.xlsx.writeBuffer();
    const blob = new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    const safeName = activeRange.replace(/[^a-zA-Z0-9\-]/g, '_');
    saveAs(blob, `thong_ke_so_luong_${safeName}_${new Date().toISOString().slice(0, 10)}.xlsx`);
}

// ── NameRow Component ─────────────────────────────────────────────────────────
function NameRow({ original, customized, revenue, sub, onChange, onReset }: {
    original: string; customized: string; revenue: number;
    sub?: string; onChange: (v: string) => void; onReset: () => void;
}) {
    const isChanged = customized !== '' && customized !== original;
    return (
        <div className={`group flex items-center gap-3 p-3 rounded-xl transition-all duration-200 border ${isChanged
            ? 'border-emerald-200 bg-emerald-50/40' : 'border-transparent hover:border-surface-100 hover:bg-surface-50/70'}`}>
            <div className="min-w-0 flex-1">
                <p className="text-xs font-semibold text-surface-700 truncate leading-tight">{original}</p>
                {sub && <p className="text-[10px] text-surface-400 mt-0.5 truncate">{sub}</p>}
                <p className="text-[10px] text-success-600 font-medium mt-0.5">{fmtShort(revenue)}</p>
            </div>
            <div className={`shrink-0 text-surface-300 text-[10px] font-mono transition-colors ${isChanged ? 'text-emerald-400' : ''}`}>→</div>
            <div className="flex-1 relative flex items-center gap-1">
                <input
                    type="text"
                    value={customized}
                    onChange={e => onChange(e.target.value)}
                    placeholder={original}
                    className={`w-full text-xs px-3 py-2 rounded-lg border outline-none transition-all ${isChanged
                        ? 'border-emerald-300 bg-white text-emerald-700 ring-2 ring-emerald-100 font-medium'
                        : 'border-surface-200 bg-white/60 text-surface-600 focus:border-emerald-300 focus:ring-2 focus:ring-emerald-100'}`}
                />
                {isChanged && (
                    <button onClick={onReset}
                        className="shrink-0 w-6 h-6 rounded-md flex items-center justify-center text-surface-300 hover:text-danger-400 hover:bg-danger-50 transition-colors"
                        title="Đặt lại về tên gốc">
                        <RotateCcw className="size-3" />
                    </button>
                )}
            </div>
            {isChanged && <CheckCircle2 className="size-3.5 text-emerald-500 shrink-0" />}
        </div>
    );
}

// ── Main Dialog ───────────────────────────────────────────────────────────────
export default function OrdersExcelExportDialog({ open, onClose, orders, goods, viewMode, activeRange }: Props) {
    const [columnTarget, setColumnTarget] = useState<ColumnTarget>('goods');
    const [goodsNameMap, setGoodsNameMap] = useState<NameMap>(() => loadFromLS(LS_GOODS_KEY));
    const [categoryNameMap, setCategoryNameMap] = useState<NameMap>(() => loadFromLS(LS_CATEGORY_KEY));
    const [search, setSearch] = useState('');
    const [isExporting, setIsExporting] = useState(false);
    const [isExportingQty, setIsExportingQty] = useState(false);
    const [catalog, setCatalog] = useState<ProductCatalogItem[]>([]);
    const [catalogLoading, setCatalogLoading] = useState(false);
    const [catalogError, setCatalogError] = useState<string | null>(null);
    const [giftCatalog, setGiftCatalog] = useState<GiftCatalogItem[]>([]);
    const [filterMode, setFilterMode] = useState<'all' | 'customized' | 'uncustomized'>('all');
    const [savedFlash, setSavedFlash] = useState(false);
    const [bypassCustom, setBypassCustom] = useState(false);
    const overlayRef = useRef<HTMLDivElement>(null);

    // Auto-save on every change
    useEffect(() => { saveToLS(LS_GOODS_KEY, goodsNameMap); }, [goodsNameMap]);
    useEffect(() => { saveToLS(LS_CATEGORY_KEY, categoryNameMap); }, [categoryNameMap]);

    // Load product catalog + gift catalog in parallel when dialog opens (only once)
    useEffect(() => {
        if (!open || catalogLoading) return;
        if (catalog.length > 0 && giftCatalog.length > 0) return;
        setCatalogLoading(true);
        setCatalogError(null);
        Promise.all([
            catalog.length === 0
                ? fetchProductCatalog()
                : Promise.resolve({ data: catalog } as { data: ProductCatalogItem[]; error?: string }),
            giftCatalog.length === 0
                ? fetchGiftCatalog()
                : Promise.resolve({ data: giftCatalog } as { data: GiftCatalogItem[]; error?: string }),
        ]).then(([setmealRes, giftRes]) => {
            if (setmealRes.error) setCatalogError(setmealRes.error);
            else setCatalog(setmealRes.data);
            if (!giftRes.error) setGiftCatalog(giftRes.data);
        }).finally(() => setCatalogLoading(false));
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [open]);

    const goodsItems = useMemo(() => extractGoodsFromOrders(goods), [goods]);
    const categoryItems = useMemo(() => extractCategoriesFromOrders(goods), [goods]);

    const currentItems = columnTarget === 'goods' ? goodsItems : categoryItems;
    const currentMap = columnTarget === 'goods' ? goodsNameMap : categoryNameMap;
    const setCurrentMap = columnTarget === 'goods' ? setGoodsNameMap : setCategoryNameMap;
    const customizedCount = Object.values(currentMap).filter(v => v !== '').length;

    const filteredItems = useMemo(() => {
        let items = currentItems;
        if (search.trim()) {
            const q = search.toLowerCase();
            items = items.filter(i => i.name.toLowerCase().includes(q) || (currentMap[i.name] || '').toLowerCase().includes(q));
        }
        if (filterMode === 'customized') items = items.filter(i => currentMap[i.name] && currentMap[i.name] !== '');
        if (filterMode === 'uncustomized') items = items.filter(i => !currentMap[i.name] || currentMap[i.name] === '');
        return items;
    }, [currentItems, search, currentMap, filterMode]);

    const handleChange = useCallback((name: string, val: string) => {
        setCurrentMap(prev => ({ ...prev, [name]: val }));
    }, [setCurrentMap]);

    const handleReset = useCallback((name: string) => {
        setCurrentMap(prev => { const n = { ...prev }; delete n[name]; return n; });
    }, [setCurrentMap]);

    const handleResetAll = useCallback(() => { setCurrentMap({}); }, [setCurrentMap]);

    const handleManualSave = useCallback(() => {
        saveToLS(LS_GOODS_KEY, goodsNameMap);
        saveToLS(LS_CATEGORY_KEY, categoryNameMap);
        setSavedFlash(true);
        setTimeout(() => setSavedFlash(false), 2000);
    }, [goodsNameMap, categoryNameMap]);

    const handleExport = useCallback(async () => {
        setIsExporting(true);
        try {
            await exportOrdersExcel(
                orders, goods, viewMode,
                bypassCustom ? {} : goodsNameMap,
                bypassCustom ? {} : categoryNameMap,
                activeRange,
            );
        } finally {
            setIsExporting(false);
        }
    }, [orders, goods, viewMode, goodsNameMap, categoryNameMap, activeRange, bypassCustom]);

    const handleExportQty = useCallback(async () => {
        setIsExportingQty(true);
        try {
            await exportQtySummary(
                goods,
                catalog,
                giftCatalog,
                bypassCustom ? {} : goodsNameMap,
                bypassCustom ? {} : categoryNameMap,
                activeRange,
            );
        } finally {
            setIsExportingQty(false);
        }
    }, [goods, catalog, giftCatalog, goodsNameMap, categoryNameMap, activeRange, bypassCustom]);

    const handleOverlayClick = useCallback((e: React.MouseEvent) => {
        if (e.target === overlayRef.current) onClose();
    }, [onClose]);

    useEffect(() => {
        if (!open) return;
        const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
        document.addEventListener('keydown', handler);
        return () => document.removeEventListener('keydown', handler);
    }, [open, onClose]);

    if (!open) return null;

    const totalCustomized = Object.values(goodsNameMap).filter(v => v !== '').length
        + Object.values(categoryNameMap).filter(v => v !== '').length;

    const dataCount = viewMode === 'orders' ? orders.length : goods.length;
    const dataLabel = viewMode === 'orders' ? 'đơn hàng' : 'dòng hàng hóa';

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
                {/* ── Header ────────────────────────────────────────── */}
                <div className="relative flex items-center gap-4 px-6 pt-6 pb-5 border-b border-surface-100">
                    <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-emerald-500 via-teal-500 to-cyan-400 rounded-t-3xl" />
                    <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center shadow-lg shadow-emerald-200 shrink-0">
                        <FileSpreadsheet className="size-5 text-white" />
                    </div>
                    <div className="flex-1 min-w-0">
                        <h2 className="text-base font-bold text-surface-800 leading-tight">Tùy chỉnh & Xuất Excel</h2>
                        <p className="text-xs text-surface-400 mt-0.5 truncate">
                            {activeRange} · {dataCount.toLocaleString()} {dataLabel}
                            {goods.length > 0 && ` · ${goodsItems.length} sản phẩm · ${categoryItems.length} danh mục`}
                        </p>
                    </div>
                    {totalCustomized > 0 && (
                        <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-50 border border-emerald-200 shrink-0">
                            <Wand2 className="size-3 text-emerald-500" />
                            <span className="text-xs font-semibold text-emerald-600">{totalCustomized} đã đổi</span>
                        </div>
                    )}
                    <button onClick={onClose}
                        className="shrink-0 w-8 h-8 rounded-xl flex items-center justify-center text-surface-400 hover:text-surface-700 hover:bg-surface-100 transition-colors">
                        <X className="size-4" />
                    </button>
                </div>

                {/* ── Info banner (goods tab only) ───────────────────── */}
                {goods.length === 0 && (
                    <div className="mx-6 mt-4 flex items-center gap-2 rounded-xl bg-amber-50 border border-amber-200 px-4 py-2.5">
                        <AlertCircle className="size-4 text-amber-500 shrink-0" />
                        <p className="text-xs text-amber-700">Không có dữ liệu hàng hóa. Tùy chỉnh tên sẽ được áp dụng khi có dữ liệu.</p>
                    </div>
                )}

                {/* ── Column Target Tabs ─────────────────────────────── */}
                <div className="flex items-center gap-1.5 px-6 pt-4 pb-0 justify-between">
                    <div className="flex items-center gap-2">
                        <span className="text-xs font-semibold text-surface-500 mr-1 whitespace-nowrap">Tùy chỉnh tên:</span>
                        {([
                            { key: 'goods' as ColumnTarget, label: 'Tên sản phẩm', icon: <Package className="size-3.5" />, count: goodsItems.length, customized: Object.values(goodsNameMap).filter(v => v !== '').length },
                            { key: 'category' as ColumnTarget, label: 'Tên danh mục', icon: <Layers className="size-3.5" />, count: categoryItems.length, customized: Object.values(categoryNameMap).filter(v => v !== '').length },
                        ]).map(tab => (
                            <button
                                key={tab.key}
                                onClick={() => { setColumnTarget(tab.key); setSearch(''); setFilterMode('all'); }}
                                className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold transition-all ${columnTarget === tab.key
                                    ? 'bg-emerald-600 text-white shadow-sm shadow-emerald-200'
                                    : 'text-surface-500 hover:text-surface-700 hover:bg-surface-100'}`}
                            >
                                {tab.icon}
                                {tab.label}
                                <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-bold ${columnTarget === tab.key ? 'bg-white/25 text-white' : 'bg-surface-100 text-surface-500'}`}>
                                    {tab.count}
                                </span>
                                {tab.customized > 0 && (
                                    <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-bold ${columnTarget === tab.key ? 'bg-white/20 text-white' : 'bg-emerald-100 text-emerald-700'}`}>
                                        ✓ {tab.customized}
                                    </span>
                                )}
                            </button>
                        ))}
                    </div>
                    {totalCustomized > 0 && (
                        <button
                            onClick={handleManualSave}
                            className={`
      flex items-center gap-2 px-4 py-2 text-xs rounded-xl text-sm font-semibold transition-all border
      ${savedFlash
                                    ? 'bg-emerald-50 border-emerald-200 text-emerald-600 shadow-sm'
                                    : 'bg-white border-slate-200 text-slate-600 hover:border-slate-300 hover:bg-slate-50 hover:shadow-sm active:scale-95'
                                }
    `}
                            title="Lưu cấu hình vào trình duyệt"
                        >
                            {savedFlash ? (
                                <CheckCircle2 className="size-4 animate-in zoom-in duration-300" />
                            ) : (
                                <Save className="size-4 text-slate-400" />
                            )}
                            <span>{savedFlash ? 'Đã lưu cấu hình' : 'Lưu thiết lập'}</span>
                        </button>
                    )}
                </div>

                {/* ── Search + Filter bar ────────────────────────────── */}
                <div className="flex items-center gap-2 px-6 py-3">
                    <div className="relative flex-1">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-3.5 text-surface-300 pointer-events-none" />
                        <input
                            type="text"
                            value={search}
                            onChange={e => setSearch(e.target.value)}
                            placeholder={`Tìm ${columnTarget === 'goods' ? 'sản phẩm' : 'danh mục'}...`}
                            className="w-full text-xs pl-8 pr-3 py-2 rounded-xl border border-surface-200 bg-surface-50 text-surface-700 placeholder-surface-300 focus:border-emerald-300 focus:ring-2 focus:ring-emerald-100 outline-none transition-all"
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
                                    ? 'bg-white text-emerald-600 shadow-sm' : 'text-surface-400 hover:text-surface-600'}`}
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

                {/* ── Item list info bar ─────────────────────────────── */}
                <div className="px-6 pb-2 flex items-center justify-between">
                    <p className="text-[10px] text-surface-400">
                        Hiển thị <strong>{filteredItems.length}</strong> / {currentItems.length} {columnTarget === 'goods' ? 'sản phẩm' : 'danh mục'}
                    </p>
                    {customizedCount > 0 && (
                        <p className="text-[10px] text-emerald-500 font-semibold">{customizedCount} tên đã tùy chỉnh</p>
                    )}
                </div>

                {/* ── Scrollable item list ───────────────────────────── */}
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

                {/* ── Footer ────────────────────────────────────────── */}
                <div className="px-6 py-4 border-t border-surface-100 bg-surface-50/50 flex items-center justify-between gap-4 rounded-b-3xl flex-col">
                    <div className="flex-1 min-w-0">
                        {totalCustomized > 0 ? (
                            <div className="flex items-start gap-2">
                                <CheckCircle2 className="size-3.5 text-success-500 mt-0.5 shrink-0" />
                                <p className="text-xs text-surface-500 leading-snug">
                                    <span className="font-semibold text-surface-700">{totalCustomized} tên</span> đã tùy chỉnh
                                    {Object.values(goodsNameMap).filter(v => v !== '').length > 0 && ` · ${Object.values(goodsNameMap).filter(v => v !== '').length} sản phẩm`}
                                    {Object.values(categoryNameMap).filter(v => v !== '').length > 0 && ` · ${Object.values(categoryNameMap).filter(v => v !== '').length} danh mục`}
                                    <span className="ml-1.5 text-[10px] text-emerald-400 font-medium">· Đã lưu tự động</span>
                                </p>
                            </div>
                        ) : (
                            <div className="flex items-start gap-2">
                                <Tag className="size-3.5 text-surface-300 mt-0.5 shrink-0" />
                                <p className="text-xs text-surface-400 leading-snug">
                                    Tùy chỉnh tên sản phẩm/danh mục trước khi xuất, hoặc xuất ngay với tên gốc.
                                </p>
                            </div>
                        )}
                    </div>
                    <div className='w-full justify-between flex'>
                        {/* Bypass toggle — only visible when there are customizations */}

                        <button
                            onClick={onClose}
                            className="px-5 py-2.5 rounded-xl text-sm font-semibold text-slate-500 hover:text-slate-700 hover:bg-slate-100/80 transition-all active:scale-95"
                        >
                            Đóng
                        </button>
                        <div className="flex flex-col items-center gap-2 w-fit">
                            {totalCustomized > 0 && (
                                <label className="flex w-full items-center gap-2.5 py-1">
                                    <div className="flex w-full items-center gap-4">
                                        <span className={`text-[11px] font-bold truncate transition-colors text-slate-600`}>
                                            Dùng tên hệ thống?
                                        </span>
                                        <div className='flex gap-3 flex-1'>
                                            <button key={'true'} onClick={() => setBypassCustom(true)} className={`text-[11px] flex-1 p-1 rounded-lg font-medium ${bypassCustom ? 'text-orange-600 bg-orange-100' : 'text-slate-400 hover:bg-slate-100'}`}>
                                                Có
                                            </button>
                                            <button key={'false'} onClick={() => setBypassCustom(false)} className={`text-[11px] flex-1 p-1 rounded-lg font-medium ${!bypassCustom ? 'text-orange-600 bg-orange-100' : 'text-slate-400 hover:bg-slate-100'}`}>
                                                Không
                                            </button>
                                        </div>
                                    </div>
                                </label>
                            )}
                            {/* Qty summary export — always available when goods data exists */}
                            <div className="flex items-center gap-2">
                                {goods.length > 0 && (
                                    <button
                                        onClick={handleExportQty}
                                        disabled={isExportingQty || isExporting || catalogLoading}
                                        title={catalogError ? `Lỗi: ${catalogError}` : "Xuất thống kê số lượng sản phẩm"}
                                        className="group relative flex items-center justify-center gap-2 min-w-[160px] px-5 py-2.5 rounded-xl bg-slate-500 text-white text-sm font-medium transition-all hover:bg-slate-800 active:scale-95 disabled:opacity-70 disabled:cursor-not-allowed overflow-hidden"
                                    >
                                        {/* Trạng thái Loading (Cả tải catalog và đang xuất) */}
                                        {(isExportingQty || catalogLoading) ? (
                                            <>
                                                <svg className="size-4 animate-spin text-teal-400" viewBox="0 0 24 24" fill="none">
                                                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                                                </svg>
                                                <span>{catalogLoading ? 'Đang tải...' : 'Đang xuất...'}</span>
                                            </>
                                        ) : catalogError ? (
                                            <>
                                                <RefreshCw className="size-4 text-orange-400" />
                                                <span>Thử lại</span>
                                            </>
                                        ) : (
                                            <>
                                                <FileDown className="size-4 text-teal-400" />
                                                <span>Tệp thống kê</span>
                                                {/* Badge số lượng nhỏ gọn phía sau */}
                                                {catalog.length > 0 && (
                                                    <span className="ml-1 text-[10px] bg-slate-700 px-1.5 py-0.5 rounded-md text-slate-300">
                                                        {catalog.length}
                                                    </span>
                                                )}
                                            </>
                                        )}
                                    </button>
                                )}
                                <button
                                    onClick={handleExport}
                                    disabled={isExporting || dataCount === 0}
                                    className={`
    relative flex items-center justify-center gap-2 min-w-[170px] px-5 py-2.5 rounded-xl 
    text-sm font-semibold transition-all shadow-md active:scale-95 
    disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100
    ${bypassCustom
                                            ? 'bg-indigo-600 text-white hover:bg-indigo-700 shadow-indigo-200' // Màu nổi bật cho Bypass
                                            : 'bg-indigo-600 text-white hover:bg-indigo-700 shadow-indigo-200'  // Màu chính (Indigo) khác biệt với Teal/Slate
                                        }
  `}
                                >
                                    {isExporting ? (
                                        <>
                                            <svg className="size-4 animate-spin" viewBox="0 0 24 24" fill="none">
                                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                                            </svg>
                                            <span>Đang xuất...</span>
                                        </>
                                    ) : (
                                        <>
                                            <Download className={`size-4 ${bypassCustom ? 'text-white' : 'text-indigo-200'}`} />
                                            <span>Tệp hóa đơn</span>
                                            {dataCount > 0 && (
                                                <span className={`
          ml-1 px-1.5 py-0.5 rounded text-[10px]
          ${bypassCustom ? 'bg-white text-indigo-800' : 'bg-indigo-500 text-indigo-100'}
        `}>
                                                    {dataCount > 999 ? `${(dataCount / 1000).toFixed(1)}k` : dataCount}
                                                </span>
                                            )}
                                        </>
                                    )}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
