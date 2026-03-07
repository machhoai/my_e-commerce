'use client';

import { useState, useRef, useCallback, useMemo } from 'react';
import { createPortal } from 'react-dom';
import * as XLSX from 'xlsx';
import {
    FileSpreadsheet, Download, Upload, CheckCircle2,
    AlertCircle, X, Eye, Loader2, ChevronRight,
} from 'lucide-react';

// ── Column definitions (required = must not be blank) ─────────────
const COLUMNS = [
    { header: 'Mã nội bộ', key: 'companyCode', required: true, example: 'JWG0000' },
    { header: 'Mã vạch', key: 'barcode', required: true, example: 'JWG0000' },
    { header: 'Tên hàng hóa', key: 'name', required: true, example: 'Sản phẩm thử' },
    { header: 'Đơn vị tính', key: 'unit', required: true, example: 'Cái' },
    { header: 'Danh mục', key: 'category', required: true, example: 'Hàng tặng' },
    { header: 'Giá hóa đơn', key: 'invoicePrice', required: false, example: 120000 },
    { header: 'Giá thực tế', key: 'actualPrice', required: false, example: 150000 },
    { header: 'Xuất xứ', key: 'origin', required: false, example: 'Việt Nam' },
    { header: 'Tồn kho tối thiểu', key: 'minStock', required: false, example: 10 },
] as const;

// Template uses headers with * for required columns
const TEMPLATE_HEADERS = COLUMNS.map(c => c.required ? `${c.header} *` : c.header);
const TEMPLATE_EXAMPLE = COLUMNS.map(c => c.example);

// All accepted header variants: "Tên hàng hóa" OR "Tên hàng hóa *"
function resolveCell(row: Record<string, unknown>, col: typeof COLUMNS[number]): unknown {
    return row[`${col.header} *`] ?? row[col.header] ?? '';
}

// ── Download blank template ───────────────────────────────────────
function downloadTemplate() {
    const ws = XLSX.utils.aoa_to_sheet([TEMPLATE_HEADERS, TEMPLATE_EXAMPLE]);
    ws['!cols'] = COLUMNS.map(() => ({ wch: 22 }));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Sản phẩm');
    XLSX.writeFile(wb, 'mau_nhap_san_pham.xlsx');
}

// ── Types ──────────────────────────────────────────────────────────
interface ValidatedRow {
    [key: string]: unknown;
    isValid: boolean;
    errors: string[];
}

function validateRow(raw: Record<string, unknown>): ValidatedRow {
    const errors: string[] = [];
    for (const col of COLUMNS) {
        if (col.required) {
            const val = String(resolveCell(raw, col)).trim();
            if (!val) errors.push(`Thiếu ${col.header}`);
        }
    }
    return { ...raw, isValid: errors.length === 0, errors };
}

interface ExcelImportModalProps {
    getToken: () => Promise<string | undefined>;
    onSuccess: () => void;
}

export default function ExcelImportModal({ getToken, onSuccess }: ExcelImportModalProps) {
    const [open, setOpen] = useState(false);
    const [step, setStep] = useState<'upload' | 'preview' | 'done'>('upload');
    const [previewData, setPreviewData] = useState<ValidatedRow[]>([]);
    const [parsing, setParsing] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const [message, setMessage] = useState({ type: '', text: '' });
    const fileInputRef = useRef<HTMLInputElement>(null);

    const hasErrors = useMemo(() => previewData.some(r => !r.isValid), [previewData]);
    const invalidCount = useMemo(() => previewData.filter(r => !r.isValid).length, [previewData]);
    const previewRows = previewData.slice(0, 10);

    const resetModal = () => {
        setStep('upload');
        setPreviewData([]);
        setMessage({ type: '', text: '' });
        if (fileInputRef.current) fileInputRef.current.value = '';
    };

    const openModal = () => { resetModal(); setOpen(true); };
    const closeModal = () => { setOpen(false); resetModal(); };

    // ── Parse + validate file ──────────────────────────────────────
    const handleFile = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        setParsing(true);
        setMessage({ type: '', text: '' });

        const reader = new FileReader();
        reader.onload = (evt) => {
            try {
                const binaryStr = evt.target?.result as string;
                const wb = XLSX.read(binaryStr, { type: 'binary' });
                const ws = wb.Sheets[wb.SheetNames[0]];
                const json = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws, { defval: '' });

                if (!json.length) {
                    setMessage({ type: 'error', text: 'File không có dữ liệu.' });
                    setParsing(false);
                    return;
                }

                // Quick structural check — must have at least the name column
                const first = json[0];
                const hasNameCol = first['Tên hàng hóa *'] !== undefined || first['Tên hàng hóa'] !== undefined;
                if (!hasNameCol) {
                    setMessage({ type: 'error', text: 'Không tìm thấy cột "Tên hàng hóa". Vui lòng dùng đúng file template.' });
                    setParsing(false);
                    return;
                }

                // Validate every row
                const validated = json.map(raw => validateRow(raw));
                setPreviewData(validated);
                setStep('preview');
            } catch {
                setMessage({ type: 'error', text: 'Lỗi đọc file. Hãy kiểm tra định dạng .xlsx.' });
            } finally {
                setParsing(false);
            }
        };
        reader.readAsBinaryString(file);
    }, []);

    // ── Bulk submit ────────────────────────────────────────────────
    // IMPORTANT: Map starred Excel headers → clean English DB schema here.
    // Sending raw previewData (with 'Tên hàng hóa *', isValid, errors, etc.)
    // would cause the API to receive 0 recognisable fields → 0 inserts.
    const handleSubmit = async () => {
        if (!previewData.length || hasErrors) return;
        setSubmitting(true);
        setMessage({ type: '', text: '' });
        try {
            // Helper: read a cell by starred OR unstarred header
            const cell = (row: ValidatedRow, starred: string, plain?: string): string =>
                String(row[starred] ?? (plain ? row[plain] : '') ?? '').trim();

            const productsToCreate = previewData
                .filter(row => row.isValid)   // safety: only send valid rows
                .map(row => ({
                    companyCode: cell(row, 'Mã nội bộ *', 'Mã nội bộ'),
                    barcode: cell(row, 'Mã vạch *', 'Mã vạch'),
                    name: cell(row, 'Tên hàng hóa *', 'Tên hàng hóa'),
                    unit: cell(row, 'Đơn vị tính *', 'Đơn vị tính'),
                    category: cell(row, 'Danh mục *', 'Danh mục'),
                    origin: cell(row, 'Xuất xứ', 'Xuất xứ'),
                    invoicePrice: Number(row['Giá hóa đơn']) || 0,
                    actualPrice: Number(row['Giá thực tế']) || 0,
                    minStock: Number(row['Tồn kho tối thiểu']) || 0,
                    image: cell(row, 'Hình ảnh (Link)'),
                }));

            console.log('[ExcelImport] Sending', productsToCreate.length, 'mapped products to API');

            const token = await getToken();
            const res = await fetch('/api/inventory/products/bulk', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
                body: JSON.stringify({ products: productsToCreate }),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error);
            setMessage({ type: 'success', text: data.message });
            setStep('done');
            onSuccess();
        } catch (err: unknown) {
            setMessage({ type: 'error', text: err instanceof Error ? err.message : 'Có lỗi xảy ra' });
        } finally {
            setSubmitting(false);
        }
    };

    // ── Modal markup ───────────────────────────────────────────────
    const modalContent = (
        <>
            {open && <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[110]" onClick={closeModal} />}

            {open && (
                <div className="fixed inset-0 z-[120] flex items-center justify-center p-4">
                    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-5xl max-h-[90vh] flex flex-col">

                        {/* Header */}
                        <div className="p-6 border-b border-slate-100 flex items-center justify-between shrink-0">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-xl bg-emerald-100 flex items-center justify-center">
                                    <FileSpreadsheet className="w-5 h-5 text-emerald-700" />
                                </div>
                                <div>
                                    <h2 className="text-lg font-bold text-slate-800">Nhập sản phẩm từ Excel</h2>
                                    <p className="text-xs text-slate-400">Tải template → điền dữ liệu → upload → xác nhận</p>
                                </div>
                            </div>
                            <button onClick={closeModal} className="text-slate-400 hover:text-slate-700 p-1 rounded-lg transition-colors">
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        {/* Step indicator */}
                        <div className="px-6 pt-4 flex items-center gap-2 text-xs shrink-0">
                            {[
                                { id: 'upload', label: '1. Upload file' },
                                { id: 'preview', label: '2. Xem trước' },
                                { id: 'done', label: '3. Hoàn tất' },
                            ].map((s, i, arr) => (
                                <div key={s.id} className="flex items-center gap-2">
                                    <span className={`font-bold px-2.5 py-1 rounded-full ${step === s.id ? 'bg-blue-600 text-white'
                                        : (step === 'done' || (step === 'preview' && i === 0)) ? 'bg-emerald-100 text-emerald-700'
                                            : 'bg-slate-100 text-slate-400'
                                        }`}>{s.label}</span>
                                    {i < arr.length - 1 && <ChevronRight className="w-3 h-3 text-slate-300" />}
                                </div>
                            ))}
                        </div>

                        {/* Body */}
                        <div className="flex-1 overflow-y-auto p-6 space-y-5">

                            {/* ── UPLOAD step ── */}
                            {step === 'upload' && (
                                <div className="space-y-5">
                                    {/* Template download */}
                                    <div className="bg-blue-50 border border-blue-200 rounded-2xl p-4 flex items-start gap-3">
                                        <Download className="w-5 h-5 text-blue-600 mt-0.5 shrink-0" />
                                        <div className="flex-1">
                                            <p className="text-sm font-bold text-blue-800">Bước 1: Tải file mẫu</p>
                                            <p className="text-xs text-blue-600 mt-0.5">
                                                Cột có dấu <span className="font-bold text-red-500">*</span> là <strong>bắt buộc</strong>. Dùng đúng template để tránh lỗi parse.
                                            </p>
                                        </div>
                                        <button
                                            onClick={downloadTemplate}
                                            className="shrink-0 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold px-4 py-2 rounded-xl flex items-center gap-1.5 transition-colors"
                                        >
                                            <Download className="w-3.5 h-3.5" /> Tải template
                                        </button>
                                    </div>

                                    {/* Column reference */}
                                    <div>
                                        <p className="text-xs font-bold text-slate-600 mb-2">Cột trong file Excel → trường dữ liệu</p>
                                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                                            {COLUMNS.map(col => (
                                                <div key={col.key} className={`rounded-xl p-2.5 border ${col.required ? 'bg-red-50 border-red-200' : 'bg-slate-50 border-slate-200'}`}>
                                                    <p className="text-[10px] text-slate-400 font-medium">{col.key}</p>
                                                    <p className="text-xs font-bold text-slate-700">
                                                        {col.header}
                                                        {col.required && <span className="text-red-500 ml-0.5">*</span>}
                                                    </p>
                                                </div>
                                            ))}
                                        </div>
                                    </div>

                                    {/* File picker */}
                                    <div>
                                        <p className="text-xs font-bold text-slate-600 mb-2">Bước 2: Upload file đã điền</p>
                                        <div
                                            onClick={() => fileInputRef.current?.click()}
                                            className="border-2 border-dashed border-slate-200 hover:border-blue-400 hover:bg-blue-50/40 rounded-2xl p-8 flex flex-col items-center gap-3 cursor-pointer transition-colors"
                                        >
                                            {parsing ? <Loader2 className="w-8 h-8 text-blue-500 animate-spin" /> : <Upload className="w-8 h-8 text-slate-300" />}
                                            <div className="text-center">
                                                <p className="text-sm font-bold text-slate-600">{parsing ? 'Đang đọc file...' : 'Nhấn để chọn file'}</p>
                                                <p className="text-xs text-slate-400 mt-0.5">Chấp nhận .xlsx và .xls</p>
                                            </div>
                                        </div>
                                        <input ref={fileInputRef} type="file" accept=".xlsx,.xls" className="hidden" onChange={handleFile} />
                                    </div>
                                </div>
                            )}

                            {/* ── PREVIEW step ── */}
                            {step === 'preview' && (
                                <div className="space-y-4">
                                    {/* Row count + back link */}
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-2">
                                            <Eye className="w-4 h-4 text-slate-500" />
                                            <span className="text-sm font-bold text-slate-700">
                                                {previewData.length} hàng{previewData.length > 10 ? ' (hiển thị 10 đầu)' : ''}
                                                {invalidCount > 0 && (
                                                    <span className="ml-2 text-red-600">— {invalidCount} hàng lỗi</span>
                                                )}
                                            </span>
                                        </div>
                                        <button
                                            onClick={() => { setStep('upload'); setPreviewData([]); if (fileInputRef.current) fileInputRef.current.value = ''; }}
                                            className="text-xs text-slate-500 hover:text-slate-700"
                                        >
                                            ← Chọn lại file
                                        </button>
                                    </div>

                                    {/* Error banner — blocks submit */}
                                    {hasErrors && (
                                        <div className="p-3 bg-red-50 border border-red-200 rounded-xl flex items-start gap-2 text-sm text-red-700">
                                            <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
                                            <span>
                                                Có <strong>{invalidCount} hàng</strong> bị lỗi (nền đỏ). Vui lòng sửa các dòng bị lỗi trong file Excel và tải lên lại.
                                            </span>
                                        </div>
                                    )}

                                    {/* Over-500 warning */}
                                    {previewData.length > 500 && (
                                        <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-700 font-medium">
                                            ⚠️ File có {previewData.length} hàng — vượt giới hạn 500. Chỉ 500 hàng đầu sẽ được nhập.
                                        </div>
                                    )}

                                    {/* Preview table */}
                                    <div className="overflow-x-auto rounded-xl border border-slate-200">
                                        <table className="w-full text-xs border-collapse">
                                            <thead>
                                                <tr className="bg-slate-50">
                                                    <th className="p-2.5 text-left font-bold text-slate-500 border-b border-slate-200 whitespace-nowrap">#</th>
                                                    {COLUMNS.map(col => (
                                                        <th key={col.key} className="p-2.5 text-left font-bold border-b border-slate-200 whitespace-nowrap">
                                                            <span className={col.required ? 'text-slate-700' : 'text-slate-500'}>
                                                                {col.header}{col.required && <span className="text-red-500 ml-0.5">*</span>}
                                                            </span>
                                                        </th>
                                                    ))}
                                                    {/* Status column */}
                                                    <th className="p-2.5 text-left font-bold text-slate-500 border-b border-slate-200 whitespace-nowrap">Trạng thái</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {previewRows.map((row, i) => (
                                                    <tr key={i} className={row.isValid ? (i % 2 === 0 ? 'bg-white' : 'bg-slate-50/50') : 'bg-red-50'}>
                                                        <td className="p-2.5 text-slate-400 border-b border-slate-100">{i + 1}</td>
                                                        {COLUMNS.map(col => {
                                                            const val = String(resolveCell(row as Record<string, unknown>, col));
                                                            const missing = col.required && !val.trim();
                                                            return (
                                                                <td key={col.key} className={`p-2.5 border-b border-slate-100 whitespace-nowrap max-w-[150px] overflow-hidden text-ellipsis ${missing ? 'text-red-400 font-bold' : 'text-slate-700'}`}>
                                                                    {val || (missing ? '—' : '')}
                                                                </td>
                                                            );
                                                        })}
                                                        <td className="p-2.5 border-b border-slate-100 whitespace-nowrap">
                                                            {row.isValid ? (
                                                                <span className="inline-flex items-center gap-1 text-emerald-700 font-bold">
                                                                    <CheckCircle2 className="w-3 h-3" /> Hợp lệ
                                                                </span>
                                                            ) : (
                                                                <span className="text-red-600 font-medium">{(row.errors as string[]).join(', ')}</span>
                                                            )}
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                            )}

                            {/* ── DONE step ── */}
                            {step === 'done' && (
                                <div className="flex flex-col items-center justify-center py-12 gap-4">
                                    <div className="w-16 h-16 rounded-full bg-emerald-100 flex items-center justify-center">
                                        <CheckCircle2 className="w-9 h-9 text-emerald-600" />
                                    </div>
                                    <div className="text-center">
                                        <p className="text-lg font-bold text-slate-800">Nhập thành công!</p>
                                        <p className="text-sm text-slate-500 mt-1">{message.text}</p>
                                    </div>
                                    <button onClick={closeModal} className="mt-2 bg-emerald-600 hover:bg-emerald-700 text-white px-6 py-2.5 rounded-xl font-bold text-sm transition-colors">
                                        Đóng
                                    </button>
                                </div>
                            )}

                            {/* General error/info toast */}
                            {message.text && step !== 'done' && (
                                <div className={`p-3 rounded-xl flex items-start gap-2 text-sm border ${message.type === 'error' ? 'bg-red-50 text-red-700 border-red-200' : 'bg-emerald-50 text-emerald-700 border-emerald-200'}`}>
                                    {message.type === 'error' ? <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" /> : <CheckCircle2 className="w-4 h-4 mt-0.5 shrink-0" />}
                                    <span>{message.text}</span>
                                </div>
                            )}
                        </div>

                        {/* Footer (preview step only) */}
                        {step === 'preview' && (
                            <div className="p-6 border-t border-slate-100 flex gap-3 shrink-0">
                                <button onClick={closeModal} className="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-700 py-2.5 rounded-xl font-medium text-sm transition-colors">
                                    Hủy
                                </button>
                                <button
                                    onClick={handleSubmit}
                                    disabled={submitting || hasErrors}
                                    title={hasErrors ? 'Sửa các dòng lỗi trước khi xác nhận' : undefined}
                                    className="flex-1 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white py-2.5 rounded-xl font-bold text-sm flex items-center justify-center gap-2 transition-all disabled:opacity-40 disabled:cursor-not-allowed shadow-md shadow-emerald-500/20"
                                >
                                    {submitting ? (
                                        <><Loader2 className="w-4 h-4 animate-spin" /> Đang nhập...</>
                                    ) : hasErrors ? (
                                        <><AlertCircle className="w-4 h-4" /> Có {invalidCount} hàng lỗi — không thể nhập</>
                                    ) : (
                                        <><CheckCircle2 className="w-4 h-4" /> Xác nhận nhập {Math.min(previewData.length, 500)} sản phẩm</>
                                    )}
                                </button>
                            </div>
                        )}
                    </div>
                </div>
            )}
        </>
    );

    return (
        <>
            <button
                onClick={openModal}
                className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2.5 rounded-xl font-medium text-sm shadow-md transition-colors"
            >
                <FileSpreadsheet className="w-4 h-4" />
                Import Excel
            </button>
            {typeof window !== 'undefined' && createPortal(modalContent, document.body)}
        </>
    );
}
