import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';

interface KpiRow {
    name: string;
    count: number;
    avgSelf: number;
    avgOfficial: number;
}

export function exportKpiToPdf(rows: KpiRow[], month: string) {
    const doc = new jsPDF();

    doc.setFontSize(16);
    doc.text(`Báo cáo KPI - Tháng ${month}`, 14, 20);

    doc.setFontSize(10);
    doc.text(`Xuất lúc: ${new Date().toLocaleString('vi-VN')}`, 14, 28);

    autoTable(doc, {
        startY: 35,
        head: [['#', 'Nhân viên', 'Số ca', 'TB Tự chấm', 'TB Chính thức', 'Chênh lệch']],
        body: rows.map((r, i) => [
            i + 1,
            r.name,
            r.count,
            r.avgSelf,
            r.avgOfficial || '—',
            r.avgOfficial ? (r.avgOfficial - r.avgSelf > 0 ? `+${r.avgOfficial - r.avgSelf}` : r.avgOfficial - r.avgSelf) : '—',
        ]),
        styles: { fontSize: 10 },
        headStyles: { fillColor: [79, 70, 229] },
    });

    doc.save(`KPI_${month}.pdf`);
}

export function exportKpiToExcel(rows: KpiRow[], month: string) {
    const data = rows.map((r, i) => ({
        '#': i + 1,
        'Nhân viên': r.name,
        'Số ca': r.count,
        'TB Tự chấm': r.avgSelf,
        'TB Chính thức': r.avgOfficial || '',
        'Chênh lệch': r.avgOfficial ? r.avgOfficial - r.avgSelf : '',
    }));

    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, `KPI_${month}`);

    // Auto-width columns
    const colWidths = Object.keys(data[0] || {}).map(key => ({
        wch: Math.max(key.length, ...data.map(r => String((r as any)[key]).length)) + 2,
    }));
    ws['!cols'] = colWidths;

    XLSX.writeFile(wb, `KPI_${month}.xlsx`);
}

export interface KpiDetailedRecord {
    employeeName: string;
    date: string;
    shiftId: string;
    criteriaScores: { name: string; officialScore: number; maxScore: number }[];
    officialTotal: number;
    scorerName: string;
}

/**
 * Export detailed KPI records to Excel with individual criteria columns.
 * Only OFFICIAL records are included.
 *
 * Sheets produced:
 *  1. "Tổng hợp"         – flat table of every record (original summary)
 *  2. "Tất cả nhân viên" – all employee tables stacked vertically on one sheet
 *  3. One sheet per employee with their own table
 */
export function exportKpiDetailedExcel(
    records: KpiDetailedRecord[],
    label: string, // e.g. "2026-03" or "01/03 - 15/03/2026"
) {
    if (records.length === 0) return;

    // Collect all unique criteria names (in order of first appearance)
    const criteriaNames: string[] = [];
    records.forEach(r => {
        r.criteriaScores.forEach(c => {
            if (!criteriaNames.includes(c.name)) criteriaNames.push(c.name);
        });
    });

    // Column headers for per-employee tables
    const perEmpHeaders = ['#', 'Ngày', 'Ca', ...criteriaNames, 'Tổng điểm', 'Người chấm'];

    // Group records by employee name (preserving insertion order)
    const byEmployee = new Map<string, KpiDetailedRecord[]>();
    records.forEach(r => {
        if (!byEmployee.has(r.employeeName)) byEmployee.set(r.employeeName, []);
        byEmployee.get(r.employeeName)!.push(r);
    });

    const wb = XLSX.utils.book_new();

    // ── Sheet 1: "Tổng hợp" ────────────────────────────────────────────────
    {
        const data = records.map((r, i) => {
            const row: Record<string, string | number> = {
                '#': i + 1,
                'Nhân viên': r.employeeName,
                'Ngày': r.date,
                'Ca': r.shiftId,
            };
            criteriaNames.forEach(name => {
                const cs = r.criteriaScores.find(c => c.name === name);
                row[name] = cs ? cs.officialScore : '';
            });
            row['Tổng điểm'] = r.officialTotal;
            row['Người chấm'] = r.scorerName;
            return row;
        });

        const ws = XLSX.utils.json_to_sheet(data);
        const keys = Object.keys(data[0] || {});
        ws['!cols'] = keys.map(key => ({
            wch: Math.max(key.length, ...data.map(r => String(r[key] ?? '').length)) + 2,
        }));
        XLSX.utils.book_append_sheet(wb, ws, 'Tổng hợp');
    }

    // ── Sheet 2: "Tất cả nhân viên" ────────────────────────────────────────
    // Stacks each employee's table vertically with a name header row + gap
    {
        const allRows: (string | number)[][] = [];
        let isFirst = true;

        byEmployee.forEach((empRecords, empName) => {
            // Blank row separator between employees (skip for first)
            if (!isFirst) allRows.push([]);
            isFirst = false;

            // Employee name header row (merged visually by spanning one cell)
            allRows.push([empName]);

            // Table header row
            allRows.push(perEmpHeaders);

            // Data rows
            empRecords.forEach((r, i) => {
                const row: (string | number)[] = [
                    i + 1,
                    r.date,
                    r.shiftId,
                ];
                criteriaNames.forEach(name => {
                    const cs = r.criteriaScores.find(c => c.name === name);
                    row.push(cs ? cs.officialScore : '');
                });
                row.push(r.officialTotal);
                row.push(r.scorerName);
                allRows.push(row);
            });
        });

        const ws = XLSX.utils.aoa_to_sheet(allRows);

        // Auto-width based on header length & content
        ws['!cols'] = perEmpHeaders.map((h, ci) => ({
            wch: Math.max(
                h.length,
                ...allRows.map(r => String(r[ci] ?? '').length)
            ) + 2,
        }));

        XLSX.utils.book_append_sheet(wb, ws, 'Tất cả nhân viên');
    }

    // ── Sheets 3+: one per employee ────────────────────────────────────────
    byEmployee.forEach((empRecords, empName) => {
        const data = empRecords.map((r, i) => {
            const row: Record<string, string | number> = {
                '#': i + 1,
                'Ngày': r.date,
                'Ca': r.shiftId,
            };
            criteriaNames.forEach(name => {
                const cs = r.criteriaScores.find(c => c.name === name);
                row[name] = cs ? cs.officialScore : '';
            });
            row['Tổng điểm'] = r.officialTotal;
            row['Người chấm'] = r.scorerName;
            return row;
        });

        const ws = XLSX.utils.json_to_sheet(data);
        const keys = Object.keys(data[0] || {});
        ws['!cols'] = keys.map(key => ({
            wch: Math.max(key.length, ...data.map(r => String(r[key] ?? '').length)) + 2,
        }));

        // Sheet name max 31 chars, strip invalid chars
        const safeName = empName.replace(/[/\\?*[\]:]/g, '').slice(0, 31);
        XLSX.utils.book_append_sheet(wb, ws, safeName || 'NV');
    });

    const safeLabel = label.replace(/[/\\?*[\]]/g, '-');
    XLSX.writeFile(wb, `KPI_ChiTiet_${safeLabel}.xlsx`);
}
