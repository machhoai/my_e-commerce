'use client';

import { useState } from 'react';
import { Download, Loader2 } from 'lucide-react';
import type { PointTransactionDoc, PendingReferralDoc } from '@/types';

type TxWithName = PointTransactionDoc & { employeeName?: string };

function formatVND(n: number) { return n.toLocaleString('vi-VN') + 'đ'; }

function txTypeLabel(tx: PointTransactionDoc) {
    const t = tx.type || 'earned';
    if (t === 'manual_adjustment') return tx.points > 0 ? 'Cộng thủ công' : 'Trừ thủ công';
    if (t === 'refund_revocation') return 'Thu hồi';
    return 'Tích điểm';
}

interface Props {
    txns: TxWithName[];
    pendingRefs: PendingReferralDoc[];
    filterMonth: string;
    filterEmp: string;
    tab: 'personal' | 'store';
}

export default function ExportReferralExcel({ txns, pendingRefs, filterMonth, filterEmp, tab }: Props) {
    const [exporting, setExporting] = useState(false);

    const handleExport = async () => {
        if (exporting || txns.length === 0) return;
        setExporting(true);

        try {
            const excelMod = await import('exceljs');
            const ExcelJS = excelMod.default || excelMod;
            const fileSaverMod = await import('file-saver');
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const saveAs = fileSaverMod.saveAs || (fileSaverMod as any).default?.saveAs || fileSaverMod;

            const workbook = new ExcelJS.Workbook();
            workbook.creator = 'Joyworld ERP';
            workbook.created = new Date();

            const periodLabel = filterMonth
                ? `T${filterMonth.split('-')[1]}/${filterMonth.split('-')[0]}`
                : 'Tất cả';

            if (tab === 'store' && !filterEmp) {
                // ── Export by employee (separate sheets) ─────────────────
                const empMap = new Map<string, TxWithName[]>();
                txns.forEach(tx => {
                    const key = tx.employeeId;
                    if (!empMap.has(key)) empMap.set(key, []);
                    empMap.get(key)!.push(tx);
                });

                // Summary sheet first
                const summary = workbook.addWorksheet('Tổng hợp', { views: [{ state: 'frozen', ySplit: 1 }] });
                summary.columns = [
                    { header: 'STT', key: 'stt', width: 6 },
                    { header: 'Nhân viên', key: 'name', width: 24 },
                    { header: 'Số giao dịch', key: 'count', width: 14 },
                    { header: 'Tổng điểm', key: 'total', width: 14 },
                    { header: 'Điểm ròng', key: 'net', width: 14 },
                ];
                styleHeader(summary);

                let idx = 0;
                for (const [, empTxns] of empMap) {
                    const name = empTxns[0].employeeName || 'Nhân viên';
                    const net = empTxns.reduce((s, tx) => s + (tx.isRevoked ? 0 : tx.points), 0);
                    idx++;
                    const row = summary.addRow({
                        stt: idx,
                        name,
                        count: empTxns.length,
                        total: empTxns.filter(t => t.points > 0 && !t.isRevoked).reduce((s, t) => s + t.points, 0),
                        net,
                    });
                    row.alignment = { vertical: 'middle' };
                    if (idx % 2 === 0) applyAltRow(row);

                    // Individual sheet
                    const sheetName = name.length > 28 ? name.slice(0, 28) + '..' : name;
                    const sheet = workbook.addWorksheet(sheetName, { views: [{ state: 'frozen', ySplit: 1 }] });
                    buildTxSheet(sheet, empTxns);
                }
            } else {
                // ── Single sheet export ──────────────────────────────────
                const sheet = workbook.addWorksheet('Lịch sử tích điểm', { views: [{ state: 'frozen', ySplit: 1 }] });
                buildTxSheet(sheet, txns, tab === 'store');
            }

            // ── Pending referrals sheet (if any) ─────────────────────
            if (pendingRefs.length > 0) {
                const pSheet = workbook.addWorksheet('Phiên chờ', { views: [{ state: 'frozen', ySplit: 1 }] });
                pSheet.columns = [
                    { header: 'STT', key: 'stt', width: 6 },
                    { header: 'Thời gian', key: 'time', width: 18 },
                    { header: 'Nhân viên', key: 'emp', width: 22 },
                    { header: 'Khách hàng', key: 'phone', width: 16 },
                    { header: 'Gói', key: 'pkg', width: 12 },
                    { header: 'Trạng thái', key: 'status', width: 14 },
                    { header: 'Mã đơn', key: 'order', width: 18 },
                    { header: 'Điểm', key: 'pts', width: 10 },
                ];
                styleHeader(pSheet);

                const statusMap: Record<string, string> = {
                    waiting: 'Đang chờ', matched: 'Đã khớp', expired: 'Hết hạn',
                    no_order: 'Không có đơn', revoked: 'Đã thu hồi',
                };

                pendingRefs.forEach((pr, i) => {
                    const row = pSheet.addRow({
                        stt: i + 1,
                        time: new Date(pr.createdAt).toLocaleString('vi-VN'),
                        emp: pr.saleEmployeeName,
                        phone: pr.customerPhone,
                        pkg: pr.expectedPackage,
                        status: statusMap[pr.status] || pr.status,
                        order: pr.matchedOrderCode || '',
                        pts: pr.pointsAwarded || '',
                    });
                    row.alignment = { vertical: 'middle' };
                    if (i % 2 === 1) applyAltRow(row);
                });
            }

            const buffer = await workbook.xlsx.writeBuffer();
            const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
            const dateStr = new Date().toISOString().slice(0, 10);
            saveAs(blob, `Lich_su_diem_${periodLabel}_${dateStr}.xlsx`);
        } catch (err) {
            console.error('Xuất Excel thất bại:', err);
        } finally {
            setExporting(false);
        }
    };

    return (
        <button
            onClick={handleExport}
            disabled={exporting || txns.length === 0}
            className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-emerald-500 text-white text-xs font-bold hover:bg-emerald-600 transition-colors shadow-sm disabled:opacity-50 disabled:cursor-not-allowed shrink-0"
        >
            {exporting ? (
                <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Đang xuất...</>
            ) : (
                <><Download className="w-3.5 h-3.5" /> Xuất Excel</>
            )}
        </button>
    );
}

// ── Helpers ──────────────────────────────────────────────────
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function styleHeader(sheet: any) {
    const headerRow = sheet.getRow(1);
    headerRow.height = 28;
    headerRow.eachCell((cell: { font: object; fill: object; alignment: object; border: object }) => {
        cell.font = { bold: true, size: 11, color: { argb: 'FFFFFFFF' } };
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFD97706' } };
        cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
        cell.border = { bottom: { style: 'thin', color: { argb: 'FFB45309' } } };
    });
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function applyAltRow(row: any) {
    row.eachCell((cell: { fill: object }) => {
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFFBEB' } };
    });
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function buildTxSheet(sheet: any, txns: TxWithName[], showEmployee = false) {
    const cols = [
        { header: 'STT', key: 'stt', width: 6 },
        { header: 'Thời gian', key: 'time', width: 20 },
    ];
    if (showEmployee) cols.push({ header: 'Nhân viên', key: 'emp', width: 22 });
    cols.push(
        { header: 'Loại', key: 'type', width: 14 },
        { header: 'Khách hàng', key: 'customer', width: 16 },
        { header: 'Gói', key: 'pkg', width: 12 },
        { header: 'Mã đơn', key: 'order', width: 18 },
        { header: 'Giá trị đơn', key: 'value', width: 16 },
        { header: 'Điểm', key: 'pts', width: 10 },
        { header: 'Lý do', key: 'reason', width: 24 },
        { header: 'Trạng thái', key: 'status', width: 14 },
    );
    sheet.columns = cols;
    styleHeader(sheet);

    txns.forEach((tx, i) => {
        const rowData: Record<string, string | number> = {
            stt: i + 1,
            time: new Date(tx.createdAt).toLocaleString('vi-VN'),
            type: txTypeLabel(tx),
            customer: tx.customerPhone || '',
            pkg: tx.packageName || '',
            order: tx.orderCode || '',
            value: tx.orderValue ? formatVND(tx.orderValue) : '',
            pts: tx.points,
            reason: tx.reason || '',
            status: tx.isRevoked ? 'Đã thu hồi' : 'Hoạt động',
        };
        if (showEmployee) rowData.emp = tx.employeeName || '';

        const row = sheet.addRow(rowData);
        row.alignment = { vertical: 'middle' };
        if (i % 2 === 1) applyAltRow(row);

        // Color points cell
        const ptsCell = row.getCell('pts');
        if (tx.isRevoked) {
            ptsCell.font = { color: { argb: 'FF9CA3AF' }, strike: true };
        } else if (tx.points < 0) {
            ptsCell.font = { bold: true, color: { argb: 'FFDC2626' } };
        } else {
            ptsCell.font = { bold: true, color: { argb: 'FF059669' } };
        }
    });
}
