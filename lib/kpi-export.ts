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

    // Build rows
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
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'KPI Chi Tiết');

    // Auto-width columns
    const keys = Object.keys(data[0] || {});
    ws['!cols'] = keys.map(key => ({
        wch: Math.max(key.length, ...data.map(r => String(r[key] ?? '').length)) + 2,
    }));

    const safeLabel = label.replace(/[/\\?*[\]]/g, '-');
    XLSX.writeFile(wb, `KPI_ChiTiet_${safeLabel}.xlsx`);
}
