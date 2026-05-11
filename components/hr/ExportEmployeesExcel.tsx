'use client';

import { useState } from 'react';
import { UserDoc } from '@/types';
import { Download, Loader2 } from 'lucide-react';
import { showToast } from '@/lib/utils/toast';

interface ExportEmployeesExcelProps {
    employees: UserDoc[];
}

function isProfileComplete(e: UserDoc): boolean {
    const hasValidEmail = !!e.email && e.email.includes('@') && !e.email.endsWith('@company.com');
    if (!hasValidEmail) return false;
    const isAdmin = e.role === 'admin' || e.role === 'super_admin';
    if (isAdmin) return true;
    return !!(e.avatar && e.idCard && e.dob && e.gender && e.permanentAddress && e.idCardFrontPhoto && e.idCardBackPhoto);
}

/** Strip the `data:image/...;base64,` prefix from a data URI and return raw base64 + extension */
function parseBase64Image(dataUri: string): { base64: string; extension: 'png' | 'jpeg' | 'gif' } | null {
    if (!dataUri) return null;
    const match = dataUri.match(/^data:image\/(png|jpe?g|gif|webp);base64,(.+)$/i);
    if (!match) return null;
    const ext = match[1].toLowerCase();
    // ExcelJS doesn't support webp natively; treat it as png for embedding
    const mapped: 'png' | 'jpeg' | 'gif' = (ext === 'webp' || ext === 'jpg') ? 'png' : ext as 'png' | 'jpeg' | 'gif';
    return { base64: match[2], extension: mapped };
}

export default function ExportEmployeesExcel({ employees }: ExportEmployeesExcelProps) {
    const [exporting, setExporting] = useState(false);

    const handleExport = async () => {
        if (exporting || employees.length === 0) return;
        setExporting(true);

        try {
            // Dynamic imports to keep bundle size small
            const excelMod = await import('exceljs');
            const ExcelJS = excelMod.default || excelMod;
            const fileSaverMod = await import('file-saver');
            const saveAs = fileSaverMod.saveAs || (fileSaverMod as any).default?.saveAs || fileSaverMod;

            const workbook = new ExcelJS.Workbook();
            workbook.creator = 'Joyworld ERP';
            workbook.created = new Date();

            const sheet = workbook.addWorksheet('Danh sách nhân viên', {
                views: [{ state: 'frozen', ySplit: 1 }],
            });

            // ── Define columns ──────────────────────────────────────────────
            sheet.columns = [
                { header: 'STT', key: 'stt', width: 6 },
                { header: 'Họ tên', key: 'name', width: 22 },
                { header: 'SĐT', key: 'phone', width: 14 },
                { header: 'Email', key: 'email', width: 26 },
                { header: 'Ngày sinh', key: 'dob', width: 14 },
                { header: 'Giới tính', key: 'gender', width: 10 },
                { header: 'Số CCCD', key: 'idCard', width: 16 },
                { header: 'Địa chỉ thường trú', key: 'permanentAddress', width: 32 },
                { header: 'Loại HĐ', key: 'type', width: 10 },
                { header: 'Vai trò', key: 'role', width: 14 },
                { header: 'Chức danh', key: 'jobTitle', width: 18 },
                { header: 'Tài khoản NH', key: 'bankAccount', width: 22 },
                { header: 'Học vấn', key: 'education', width: 14 },
                { header: 'Trạng thái', key: 'status', width: 14 },
                { header: 'Hồ sơ', key: 'profile', width: 12 },
                { header: 'Ảnh đại diện', key: 'avatar', width: 16 },
                { header: 'CCCD Mặt trước', key: 'cccdFront', width: 22 },
                { header: 'CCCD Mặt sau', key: 'cccdBack', width: 22 },
            ];

            // ── Style header row ────────────────────────────────────────────
            const headerRow = sheet.getRow(1);
            headerRow.height = 28;
            headerRow.eachCell(cell => {
                cell.font = { bold: true, size: 11, color: { argb: 'FFFFFFFF' } };
                cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF4F46E5' } };
                cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
                cell.border = {
                    bottom: { style: 'thin', color: { argb: 'FF3730A3' } },
                };
            });

            // ── Add data rows ───────────────────────────────────────────────
            const IMAGE_ROW_HEIGHT = 80; // px

            for (let i = 0; i < employees.length; i++) {
                const e = employees[i];
                const rowIndex = i + 2; // 1-based, header is row 1

                const roleLabel = e.role === 'store_manager' ? 'CH Trưởng'
                    : e.role === 'manager' ? 'Quản lý'
                    : e.role === 'admin' ? 'Admin'
                    : 'Nhân viên';

                sheet.addRow({
                    stt: i + 1,
                    name: e.name,
                    phone: e.phone,
                    email: e.email || '',
                    dob: e.dob || '',
                    gender: e.gender || '',
                    idCard: e.idCard || '',
                    permanentAddress: e.permanentAddress || '',
                    type: e.type === 'FT' ? 'Toàn thời gian' : 'Bán thời gian',
                    role: roleLabel,
                    jobTitle: e.jobTitle || '',
                    bankAccount: e.bankAccount || '',
                    education: e.education || '',
                    status: e.isActive !== false ? 'Đang làm việc' : 'Nghỉ việc',
                    profile: isProfileComplete(e) ? 'Đầy đủ' : 'Thiếu',
                    avatar: '',
                    cccdFront: '',
                    cccdBack: '',
                });

                const row = sheet.getRow(rowIndex);
                row.alignment = { vertical: 'middle', wrapText: true };

                // Alternate row colors
                if (i % 2 === 1) {
                    row.eachCell(cell => {
                        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF8FAFC' } };
                    });
                }

                // Profile status coloring
                const profileCell = row.getCell('profile');
                if (isProfileComplete(e)) {
                    profileCell.font = { bold: true, color: { argb: 'FF059669' } };
                } else {
                    profileCell.font = { bold: true, color: { argb: 'FFD97706' } };
                }

                // ── Embed images ────────────────────────────────────────────
                let hasImage = false;

                const addImageToCell = (dataUri: string | undefined, colNumber: number) => {
                    if (!dataUri) return;
                    const parsed = parseBase64Image(dataUri);
                    if (!parsed) return;
                    hasImage = true;
                    const imageId = workbook.addImage({
                        base64: parsed.base64,
                        extension: parsed.extension,
                    });
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    sheet.addImage(imageId, {
                        tl: { col: colNumber - 1 + 0.1, row: rowIndex - 1 + 0.1 },
                        br: { col: colNumber - 1 + 0.9, row: rowIndex - 1 + 0.9 },
                    } as any);
                };

                addImageToCell(e.avatar, 16);           // Col P = 16
                addImageToCell(e.idCardFrontPhoto, 17);  // Col Q = 17
                addImageToCell(e.idCardBackPhoto, 18);   // Col R = 18

                if (hasImage) {
                    row.height = IMAGE_ROW_HEIGHT;
                }
            }

            // ── Generate and save ───────────────────────────────────────────
            const buffer = await workbook.xlsx.writeBuffer();
            const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
            const dateStr = new Date().toISOString().slice(0, 10);
            saveAs(blob, `Nhan_vien_${dateStr}.xlsx`);
            showToast.success('Xuất Excel thành công', `Đã xuất danh sách ${employees.length} nhân viên ra file Excel.`);
        } catch (err) {
            console.error('[ExportExcel] Xuất Excel thất bại:', err);
            showToast.error('Xuất Excel thất bại', 'Đã xảy ra lỗi khi tạo file. Vui lòng thử lại.');
        } finally {
            setExporting(false);
        }
    };

    return (
        <button
            onClick={handleExport}
            disabled={exporting || employees.length === 0}
            className="flex items-center gap-2 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white px-5 py-2.5 rounded-xl font-medium shadow-lg shadow-emerald-500/20 transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
            title="Xuất tất cả nhân viên ra file Excel"
        >
            {exporting ? (
                <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Đang xuất...
                </>
            ) : (
                <>
                    <Download className="w-4 h-4" />
                    Xuất Excel
                </>
            )}
        </button>
    );
}
