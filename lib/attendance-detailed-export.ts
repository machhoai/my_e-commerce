import ExcelJS from 'exceljs';
import type { DailyAttendance } from '@/types';
// @ts-expect-error Explicit extension also allows the Node strip-types verification runner.
import { detailedAttendanceShifts } from './attendance-rules.ts';
import type { RuleContainer } from './attendance-rules';

interface ExportEmployee { uid: string; name: string }
interface Summary {
    name: string;
    weekday: number;
    weekend: number;
    short: number;
    pending: number;
    late: number;
    early: number;
    missing: number;
    outside: number;
}
type CellValue = string | number | null;

const detailHeaders = ['STT', 'Ngày', 'Thứ', 'Ca', 'Loại ngày', 'Giờ vào', 'Giờ ra',
    'Giờ chuẩn ca', 'Tổng giờ làm', 'Giờ làm trong ca', 'Phút thiếu', 'Phút ngoài ca',
    'Trạng thái vào', 'Trạng thái ra', 'Nguồn'];
const summaryHeaders = ['STT', 'Họ tên', 'Số ca ngày thường có làm', 'Số ca cuối tuần/lễ có làm',
    'Số ca thiếu giờ', 'Số ca chờ xác nhận', 'Số ngày trễ', 'Số ngày về sớm', 'Tổng phút thiếu', 'Tổng phút ngoài ca'];
const note = 'Ca có làm: có đủ giờ vào/ra hợp lệ và có thời gian trong ca; ca thiếu giờ vẫn tính 1 ca. '
    + 'Thiếu và ngoài ca không bù trừ. Ngoài ca chưa đồng nghĩa tăng ca được duyệt. '
    + 'Chỉ xuất ngày có chấm công. Ca xác định theo giờ vào và chính sách chấm công của ngày, không theo lịch đăng ký. '
    + 'Tổng giờ làm = giờ ra trừ giờ vào. Ngày đặc biệt cấu hình cho ca được xếp vào cuối tuần/lễ. '
    + 'Phút hiển thị 2 số thập phân; phép tính giữ độ chính xác gốc.';
const inLabels = { EARLY: 'Đến sớm', ON_TIME: 'Đúng giờ', LATE: 'Trễ', UNKNOWN: '' };
const outLabels = { EARLY_OUT: 'Về sớm', ON_TIME_OUT: 'Đúng giờ', OVERTIME: 'Ngoài ca', UNKNOWN: '' };
const clock = (value?: string | null) => value && Number.isFinite(Date.parse(value))
    ? new Date(value).toLocaleTimeString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh', hour: '2-digit', minute: '2-digit' }) : null;

function styleRow(row: ExcelJS.Row, fill: string, header = false) {
    row.height = header ? 38 : 24;
    row.eachCell({ includeEmpty: true }, (cell) => {
        cell.font = { name: 'Arial', size: 10, bold: header, color: { argb: header ? 'FFFFFFFF' : 'FF1F2937' } };
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: fill } };
        const border: ExcelJS.Border = { style: 'thin', color: { argb: 'FFD1D5DB' } };
        cell.border = { top: border, bottom: border, left: border, right: border };
        cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
    });
}

function title(sheet: ExcelJS.Worksheet, text: string, columns: number, fill = 'FF1E3A5F') {
    const row = sheet.addRow([text]);
    sheet.mergeCells(row.number, 1, row.number, columns);
    styleRow(row, fill, true);
    row.getCell(1).font = { name: 'Arial', size: 14, bold: true, color: { argb: 'FFFFFFFF' } };
    return row;
}

function addNote(sheet: ExcelJS.Worksheet, columns: number) {
    sheet.addRow([]);
    const row = sheet.addRow([note]);
    sheet.mergeCells(row.number, 1, row.number, columns);
    row.height = 70;
    row.getCell(1).font = { name: 'Arial', size: 10, color: { argb: 'FF4B5563' } };
    row.getCell(1).alignment = { wrapText: true, vertical: 'middle' };
}

/** Builds all three detail views from the same rows and summary, avoiding divergent counts. */
export function buildDetailedAttendanceWorkbook(
    month: string,
    attendance: DailyAttendance[],
    employees: ExportEmployee[],
    settings?: RuleContainer | null,
    now = new Date(),
) {
    const [year, monthNumber] = month.split('-').map(Number);
    const numDays = new Date(Date.UTC(year, monthNumber, 0)).getUTCDate();
    const label = `${String(monthNumber).padStart(2, '0')}/${year}`;
    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'B.Duck Cityfuns ERP';
    workbook.created = now;
    const summarySheet = workbook.addWorksheet('Tổng kết', { views: [{ state: 'frozen', ySplit: 2 }] });
    const combinedSheet = workbook.addWorksheet('Tổng hợp chi tiết', { views: [{ state: 'frozen', ySplit: 1 }] });
    summarySheet.columns = [6, 28, 23, 25, 18, 20, 17, 20, 20, 22].map(width => ({ width }));
    const widths = [6, 15, 8, 16, 18, 12, 12, 15, 23, 17, 14, 16, 18, 18, 18];
    combinedSheet.columns = widths.map(width => ({ width }));
    title(summarySheet, `TỔNG KẾT CHẤM CÔNG — Tháng ${label}`, summaryHeaders.length, 'FF065F46');
    styleRow(summarySheet.addRow(summaryHeaders), 'FF065F46', true);
    title(combinedSheet, `TỔNG HỢP CHI TIẾT CHẤM CÔNG — Tháng ${label}`, detailHeaders.length, 'FF065F46');

    const records = new Map<string, DailyAttendance>();
    const names = new Map<string, string>();
    const employeeNames = new Map(employees.map(employee => [employee.uid, employee.name]));
    for (const record of attendance) {
        if (!record.mapped_system_uid || !record.date.startsWith(`${month}-`)
            || (!record.checkIn && !record.checkOut)) continue;
        records.set(`${record.mapped_system_uid}|${record.date}`, record);
        names.set(record.mapped_system_uid, employeeNames.get(record.mapped_system_uid)
            ?? record.mapped_system_name ?? record.zk_name ?? record.mapped_system_uid);
    }
    const summaries: Summary[] = [];
    const exportEmployees = [...names].sort((a, b) => a[1].localeCompare(b[1], 'vi'));
    for (const [uid, name] of exportEmployees) {
        const base = name.replace(/[\[\]*?/\\:]/g, '').slice(0, 31) || uid.slice(0, 8);
        let sheetName = base;
        let suffix = 1;
        while (workbook.worksheets.some(sheet => sheet.name.toLocaleLowerCase() === sheetName.toLocaleLowerCase())) {
            const ending = ` (${suffix++})`;
            sheetName = base.slice(0, 31 - ending.length) + ending;
        }
        const sheet = workbook.addWorksheet(sheetName, { views: [{ state: 'frozen', ySplit: 3 }] });
        sheet.columns = widths.map(width => ({ width }));
        title(sheet, `BẢNG CHẤM CÔNG — ${name}`, detailHeaders.length);
        title(sheet, `Tháng ${label}`, detailHeaders.length);
        styleRow(sheet.addRow(detailHeaders), 'FF1E3A5F', true);
        if (summaries.length) combinedSheet.addRow([]);
        title(combinedSheet, `BẢNG CHẤM CÔNG — ${name}`, detailHeaders.length);
        styleRow(combinedSheet.addRow(detailHeaders), 'FF1E3A5F', true);

        const summary: Summary = { name, weekday: 0, weekend: 0, short: 0, pending: 0, late: 0, early: 0, missing: 0, outside: 0 };
        let ordinal = 0;
        for (let day = 1; day <= numDays; day++) {
            const date = `${month}-${String(day).padStart(2, '0')}`;
            const record = records.get(`${uid}|${date}`);
            const shifts = detailedAttendanceShifts(date, record, settings);
            let late = false;
            let early = false;
            for (const shift of shifts) {
                if (shift.counted) {
                    if (shift.dayType === 'Ngày thường') summary.weekday++;
                    else summary.weekend++;
                    if ((shift.missingMinutes ?? 0) > 0) summary.short++;
                    summary.missing += shift.missingMinutes ?? 0;
                    summary.outside += shift.outsideMinutes ?? 0;
                }
                if (shift.pending) summary.pending++;
                late ||= shift.statusIn === 'LATE';
                early ||= shift.statusOut === 'EARLY_OUT';
                const inMs = record?.checkIn ? Date.parse(record.checkIn) : NaN;
                const outMs = record?.checkOut ? Date.parse(record.checkOut) : NaN;
                const totalHours: CellValue = !record?.checkOut ? 'Thiếu checkout'
                    : !record?.checkIn ? 'Thiếu checkin'
                        : Number.isFinite(inMs) && Number.isFinite(outMs) && outMs > inMs
                            ? (outMs - inMs) / 3_600_000 : 'Giờ vào/ra không hợp lệ';
                const values: CellValue[] = [++ordinal, `${String(day).padStart(2, '0')}/${label}`,
                    ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'][new Date(`${date}T00:00:00Z`).getUTCDay()],
                    shift.shift || null, shift.dayType, clock(record?.checkIn), clock(record?.checkOut),
                    shift.standardMinutes === null ? null : shift.standardMinutes / 60,
                    totalHours,
                    shift.workedMinutes === null ? null : shift.workedMinutes / 60,
                    shift.missingMinutes, shift.outsideMinutes,
                    inLabels[shift.statusIn] || null, outLabels[shift.statusOut] || null,
                    record?.methods?.map(method => method === 'BIOMETRIC' ? 'Máy' : method).join('/') || null];
                for (const target of [sheet, combinedSheet]) {
                    const row = target.addRow(values);
                    styleRow(row, shift.dayType === 'Cuối tuần/lễ' ? 'FFFFF7ED' : day % 2 ? 'FFFAFAFA' : 'FFFFFFFF');
                    for (const column of [8, 9, 10, 11, 12]) row.getCell(column).numFmt = '0.00';
                    if (shift.pending || (shift.missingMinutes ?? 0) > 0) {
                        row.getCell(shift.pending ? 9 : 11).font = { name: 'Arial', size: 10, bold: true, color: { argb: shift.pending ? 'FFF59E0B' : 'FFEF4444' } };
                        row.height = 32;
                    }
                    if (shift.statusIn === 'LATE') row.getCell(13).font = { name: 'Arial', bold: true, color: { argb: 'FFEF4444' } };
                    if (shift.statusOut === 'EARLY_OUT') row.getCell(14).font = { name: 'Arial', bold: true, color: { argb: 'FFF59E0B' } };
                }
            }
            if (late) summary.late++;
            if (early) summary.early++;
        }
        for (const target of [sheet, combinedSheet]) {
            title(target, `TỔNG KẾT: Ngày thường ${summary.weekday} ca · Cuối tuần/lễ ${summary.weekend} ca · `
                + `Thiếu giờ ${summary.short} ca · Chờ xác nhận ${summary.pending} ca · `
                + `Thiếu ${summary.missing.toFixed(2)} phút · Ngoài ca ${summary.outside.toFixed(2)} phút`, detailHeaders.length, 'FF065F46');
        }
        addNote(sheet, detailHeaders.length);
        summaries.push(summary);
        const row = summarySheet.addRow([summaries.length, name, summary.weekday, summary.weekend,
            summary.short, summary.pending, summary.late, summary.early, summary.missing, summary.outside]);
        styleRow(row, summaries.length % 2 ? 'FFFAFAFA' : 'FFFFFFFF');
        row.getCell(2).alignment = { horizontal: 'left', vertical: 'middle' };
        row.getCell(9).numFmt = row.getCell(10).numFmt = '0.00';
    }
    const totals = summarySheet.addRow([null, 'TỔNG CỘNG', ...(['weekday', 'weekend', 'short', 'pending', 'late', 'early', 'missing', 'outside'] as const)
        .map(key => summaries.reduce((sum, employee) => sum + employee[key], 0))]);
    styleRow(totals, 'FF065F46', true);
    totals.getCell(9).numFmt = totals.getCell(10).numFmt = '0.00';
    if (summaries.length) summarySheet.autoFilter = { from: 'A2', to: `J${summaries.length + 2}` };
    addNote(summarySheet, summaryHeaders.length);
    addNote(combinedSheet, detailHeaders.length);
    return workbook;
}
