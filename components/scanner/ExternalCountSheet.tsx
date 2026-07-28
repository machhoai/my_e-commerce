'use client';

import { useEffect, useMemo, useState } from 'react';
import {
    AlertTriangle,
    ArrowLeft,
    CheckCircle2,
    ClipboardCheck,
    Camera,
    ImagePlus,
    Loader2,
    Minus,
    Package,
    Plus,
    Search,
    ShieldCheck,
    Trash2,
} from 'lucide-react';
import BottomSheet from '@/components/shared/BottomSheet';
import { cn } from '@/lib/utils';
import { showToast } from '@/lib/utils/toast';
import {
    submitExternalCountCheckpointAction,
    type ExternalCountCheckpointType,
    type ExternalCountItemCondition,
    type PreloadedProduct,
} from '@/actions/scanner';
import { compressImage } from '@/lib/utils/compress-image';
import { uploadImageBase64 } from '@/lib/utils/storage-upload';

type CountDraft = {
    countedQuantity: string;
    condition: ExternalCountItemCondition;
    evidenceUrl: string;
    notes: string;
};

type ExternalCountSheetProps = {
    isOpen: boolean;
    onClose: () => void;
    checkpointType: ExternalCountCheckpointType;
    warehouseId: string;
    warehouseName: string;
    locationId: string;
    locationName: string;
    products: PreloadedProduct[];
    operatorId: string;
    operatorName: string;
    shiftId: string;
    shiftDate: string;
    onSubmitted: () => Promise<void> | void;
};

const checkpointLabels: Record<ExternalCountCheckpointType, { title: string; description: string }> = {
    SHIFT_OPENING: {
        title: 'Kiểm kê đầu ca',
        description: 'Hoàn tất để nhận quyền quét và bàn giao từ ca trước',
    },
    OPTIONAL_CLOSING: {
        title: 'Kiểm kho cuối ngày (tùy chọn)',
        description: 'Lưu minh chứng đối soát; không khóa quét hoặc chuyển quyền',
    },
};

const conditionOptions: Array<{ value: ExternalCountItemCondition; label: string }> = [
    { value: 'GOOD', label: 'Tốt' },
    { value: 'DAMAGED', label: 'Hư hỏng' },
    { value: 'EXPIRED', label: 'Hết hạn' },
    { value: 'MISSING', label: 'Thất lạc' },
];

const createDrafts = (products: PreloadedProduct[]) => Object.fromEntries(
    products.slice(0, 500).map(product => [product.id, {
        countedQuantity: String(product.atpQuantity),
        condition: 'GOOD' as const,
        evidenceUrl: '',
        notes: '',
    }]),
);

const todayInVietnam = () => new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Ho_Chi_Minh',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
}).format(new Date());

const dateTimeInVietnam = (date = new Date()) => new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Ho_Chi_Minh',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
}).format(date).replace(',', '');

export default function ExternalCountSheet({
    isOpen,
    onClose,
    checkpointType,
    warehouseId,
    warehouseName,
    locationId,
    locationName,
    products,
    operatorId,
    operatorName,
    shiftId,
    shiftDate,
    onSubmitted,
}: ExternalCountSheetProps) {
    const [drafts, setDrafts] = useState<Record<string, CountDraft>>({});
    const [query, setQuery] = useState('');
    const [step, setStep] = useState<'edit' | 'confirm'>('edit');
    const [submitting, setSubmitting] = useState(false);
    const [uploadingEvidence, setUploadingEvidence] = useState<Record<string, boolean>>({});
    const [confirmedAt, setConfirmedAt] = useState('');
    const [snapshotAt, setSnapshotAt] = useState('');
    const labels = checkpointLabels[checkpointType];
    const countableProducts = useMemo(() => products.slice(0, 500), [products]);

    useEffect(() => {
        if (!isOpen) return;
        setDrafts(createDrafts(countableProducts));
        setQuery('');
        setStep('edit');
        setUploadingEvidence({});
        setConfirmedAt('');
        setSnapshotAt(new Date().toISOString());
    }, [countableProducts, isOpen, checkpointType]);

    const updateDraft = (productId: string, patch: Partial<CountDraft>) => {
        setDrafts(previous => ({
            ...previous,
            [productId]: { ...previous[productId], ...patch },
        }));
    };

    const adjustQuantity = (productId: string, current: string, delta: number) => {
        const parsed = parseInt(current, 10);
        const base = isNaN(parsed) ? 0 : parsed;
        const next = Math.max(0, base + delta);
        updateDraft(productId, { countedQuantity: String(next) });
    };

    const handleEvidenceFile = async (productId: string, file?: File) => {
        if (!file) return;
        if (!file.type.startsWith('image/')) {
            showToast.warning('Tệp không hợp lệ', 'Vui lòng chọn một tệp hình ảnh.');
            return;
        }
        if (file.size > 10 * 1024 * 1024) {
            showToast.warning('Ảnh quá lớn', 'Vui lòng chọn ảnh nhỏ hơn 10 MB.');
            return;
        }

        setUploadingEvidence(previous => ({ ...previous, [productId]: true }));
        try {
            const compressed = await compressImage(file);
            updateDraft(productId, { evidenceUrl: compressed });
            const downloadUrl = await uploadImageBase64(operatorId, compressed, 'stock_count_evidence');
            updateDraft(productId, { evidenceUrl: downloadUrl });
            navigator.vibrate?.(20);
        } catch (error) {
            updateDraft(productId, { evidenceUrl: '' });
            showToast.error(
                'Không thể tải ảnh lên',
                error instanceof Error ? error.message : 'Vui lòng thử lại với ảnh khác.',
            );
        } finally {
            setUploadingEvidence(previous => ({ ...previous, [productId]: false }));
        }
    };

    const rows = useMemo(() => countableProducts.map(product => {
        const draft = drafts[product.id] ?? {
            countedQuantity: '',
            condition: 'GOOD' as const,
            evidenceUrl: '',
            notes: '',
        };
        const counted = Number(draft.countedQuantity);
        const discrepancy = Number.isFinite(counted) ? counted - product.atpQuantity : 0;
        const hasIssue = discrepancy !== 0 || draft.condition !== 'GOOD';
        return { product, draft, counted, discrepancy, hasIssue };
    }), [countableProducts, drafts]);

    const filteredRows = useMemo(() => {
        const normalized = query.trim().toLowerCase();
        if (!normalized) return rows;
        return rows.filter(({ product }) =>
            product.name.toLowerCase().includes(normalized) ||
            product.barcode.toLowerCase().includes(normalized) ||
            product.companyCode.toLowerCase().includes(normalized),
        );
    }, [query, rows]);

    const issueRows = useMemo(() => rows.filter(row => row.hasIssue), [rows]);
    const hasUploadingEvidence = Object.values(uploadingEvidence).some(Boolean);
    const invalidQuantity = rows.some(row =>
        row.draft.countedQuantity.trim() === '' ||
        !Number.isInteger(row.counted) ||
        row.counted < 0,
    );
    const invalidEvidence = issueRows.some(row => {
        const value = row.draft.evidenceUrl.trim();
        if (!value) return true;
        try {
            const url = new URL(value);
            return url.protocol !== 'http:' && url.protocol !== 'https:';
        } catch {
            return true;
        }
    });

    const goToConfirmation = () => {
        if (countableProducts.length === 0) {
            showToast.warning('Chưa có sản phẩm', 'Vị trí này không có sản phẩm ATP để kiểm đếm.');
            return;
        }
        if (invalidQuantity) {
            showToast.warning('Kiểm tra số lượng', 'Số lượng thực tế phải là số nguyên từ 0 trở lên.');
            return;
        }
        if (hasUploadingEvidence) {
            showToast.warning('Ảnh đang được tải lên', 'Vui lòng chờ tải ảnh hoàn tất trước khi tiếp tục.');
            return;
        }
        if (invalidEvidence) {
            showToast.warning('Kiểm tra bằng chứng', 'Mỗi dòng bất thường cần một URL hình ảnh http/https hợp lệ.');
            return;
        }
        navigator.vibrate?.(20);
        setConfirmedAt(dateTimeInVietnam());
        setStep('confirm');
    };

    const submit = async () => {
        setSubmitting(true);
        try {
            const now = new Date();
            const result = await submitExternalCountCheckpointAction({
                warehouse_id: warehouseId,
                warehouse_location_id: locationId,
                checkpoint_type: checkpointType,
                business_date: shiftDate || todayInVietnam(),
                shift_id: shiftId,
                shift_date: shiftDate || todayInVietnam(),
                idempotency_key: `${operatorId}-${checkpointType}-${locationId}-${now.getTime()}`,
                external_operator_name: operatorName,
                external_operator_id: operatorId,
                device_id: typeof navigator !== 'undefined' ? navigator.userAgent.slice(0, 120) : null,
                action_time: snapshotAt || now.toISOString(),
                items: rows.map(({ product, draft, counted }) => ({
                    product_id: product.id,
                    barcode: product.barcode || null,
                    counted_quantity: counted,
                    base_atp: product.atpQuantity,
                    condition: draft.condition,
                    evidence_urls: draft.evidenceUrl.trim() ? [draft.evidenceUrl.trim()] : [],
                    notes: draft.notes.trim() || null,
                })),
            });

            if (!result.success) {
                throw new Error(result.messages?.vi || 'WMS không thể ghi nhận kiểm đếm.');
            }

            navigator.vibrate?.([30, 40, 60]);
            showToast.success('Đã gửi kiểm đếm', issueRows.length
                ? `Đã ghi nhận ${issueRows.length} dòng cần đối soát.`
                : 'Checkpoint đã được WMS xác nhận.');
            await onSubmitted();
            onClose();
        } catch (error) {
            showToast.error('Gửi kiểm đếm thất bại', error instanceof Error ? error.message : 'Vui lòng thử lại.');
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <BottomSheet
            isOpen={isOpen}
            onClose={submitting || hasUploadingEvidence ? () => undefined : onClose}
            title={labels.title}
            maxHeightClass="max-h-[94dvh]"
            className="lg:max-w-2xl"
        >
            <div className="flex min-h-0 flex-col">
                <div className="border-b border-surface-100 px-4 py-3 sm:px-6">
                    <div className="flex items-start gap-3 rounded-2xl bg-accent-100 p-2">
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white text-accent-600 shadow-sm">
                            <ClipboardCheck className="h-5 w-5" />
                        </div>
                        <div className="min-w-0">
                            <p className="text-sm font-bold text-surface-900">{locationName}</p>
                            <p className="mt-0.5 text-xs text-surface-500">{warehouseName}</p>
                        </div>
                    </div>
                </div>

                {step === 'edit' ? (
                    <>
                        <div className="sticky top-0 z-10 bg-white px-4 py-3 sm:px-6">
                            <div className="relative">
                                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-surface-400" />
                                <input
                                    value={query}
                                    onChange={event => setQuery(event.target.value)}
                                    placeholder="Tìm tên, mã hoặc barcode"
                                    className="h-11 w-full rounded-xl border border-surface-200 bg-surface-50 pl-10 pr-3 text-sm outline-none focus:border-accent-400 focus:ring-2 focus:ring-accent-100"
                                />
                            </div>
                            <div className="mt-2 flex items-center justify-between text-xs">
                                <span className="text-surface-500">{rows.length} sản phẩm cần xác nhận</span>
                                <span className={cn('font-bold', issueRows.length ? 'text-warning-700' : 'text-success-700')}>
                                    {issueRows.length ? `${issueRows.length} chênh lệch` : 'Chưa có chênh lệch'}
                                </span>
                            </div>
                        </div>

                        <div className="space-y-3 px-4 pb-28 sm:px-6">
                            {filteredRows.map(({ product, draft, discrepancy, hasIssue }) => (
                                <article key={product.id} className={cn(
                                    'rounded-2xl border p-3 transition-colors',
                                    hasIssue ? 'border-warning-200 bg-warning-50/40' : 'border-surface-100 bg-white',
                                )}>
                                    <div className="flex items-center gap-3">
                                        <div className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-surface-100 bg-white">
                                            {product.image
                                                ? <img src={product.image} alt="" className="h-full w-full object-contain p-1" />
                                                : <Package className="h-5 w-5 text-surface-300" />}
                                        </div>
                                        <div className="min-w-0 flex-1">
                                            <h3 className="line-clamp-2 text-xs font-bold text-surface-900">{product.name}</h3>
                                            <p className="mt-1 truncate text-[11px] text-surface-400">
                                                {product.companyCode || product.barcode} · ATP {product.atpQuantity}
                                            </p>
                                        </div>
                                    </div>

                                    <div className="mt-3 w-full shrink-0">
                                        <label className="mb-1 block text-[10px] font-bold text-surface-500">Thực tế</label>
                                        <div className="flex h-11 items-center rounded-xl border border-surface-200 bg-white px-1 focus-within:border-accent-400 focus-within:ring-2 focus-within:ring-accent-100">
                                            <button
                                                type="button"
                                                onClick={() => adjustQuantity(product.id, draft.countedQuantity, -1)}
                                                disabled={Number(draft.countedQuantity) <= 0}
                                                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-surface-500 transition hover:bg-surface-50 active:scale-95 disabled:opacity-30"
                                            >
                                                <Minus className="h-4 w-4" />
                                            </button>
                                            <input
                                                type="number"
                                                min="0"
                                                inputMode="numeric"
                                                value={draft.countedQuantity}
                                                onChange={event => updateDraft(product.id, { countedQuantity: event.target.value })}
                                                className="h-full w-full min-w-0 bg-transparent text-center text-sm font-bold text-surface-900 outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                                            />
                                            <button
                                                type="button"
                                                onClick={() => adjustQuantity(product.id, draft.countedQuantity, 1)}
                                                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-surface-500 transition hover:bg-surface-50 active:scale-95"
                                            >
                                                <Plus className="h-4 w-4" />
                                            </button>
                                        </div>
                                    </div>

                                    <div className="mt-3 grid grid-cols-[1fr_auto] gap-2">
                                        <select
                                            value={draft.condition}
                                            onChange={event => updateDraft(product.id, { condition: event.target.value as ExternalCountItemCondition })}
                                            className="h-10 rounded-xl border border-surface-200 bg-white px-3 text-xs font-semibold text-surface-700 outline-none focus:border-accent-400"
                                        >
                                            {conditionOptions.map(option => (
                                                <option key={option.value} value={option.value}>{option.label}</option>
                                            ))}
                                        </select>
                                        <span className={cn(
                                            'flex h-10 min-w-20 items-center justify-center rounded-xl px-3 text-xs font-bold',
                                            discrepancy === 0 ? 'bg-success-50 text-success-700' : 'bg-warning-100 text-warning-800',
                                        )}>
                                            {discrepancy > 0 ? '+' : ''}{discrepancy}
                                        </span>
                                    </div>

                                    {hasIssue && (
                                        <div className="mt-2 space-y-2">
                                            <div className="flex items-center gap-1.5 text-[11px] font-semibold text-warning-800">
                                                <AlertTriangle className="h-3.5 w-3.5" />
                                                WMS yêu cầu ảnh bằng chứng cho dòng này
                                            </div>
                                            {draft.evidenceUrl ? (
                                                <div className="relative overflow-hidden rounded-2xl border border-warning-200 bg-white">
                                                    <img
                                                        src={draft.evidenceUrl}
                                                        alt={`Ảnh bằng chứng ${product.name}`}
                                                        className="h-40 w-full object-cover"
                                                    />
                                                    {uploadingEvidence[product.id] && (
                                                        <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-black/50 text-xs font-bold text-white backdrop-blur-sm">
                                                            <Loader2 className="h-6 w-6 animate-spin" />
                                                            Đang tải ảnh lên...
                                                        </div>
                                                    )}
                                                    {!uploadingEvidence[product.id] && (
                                                        <button
                                                            type="button"
                                                            onClick={() => updateDraft(product.id, { evidenceUrl: '' })}
                                                            aria-label={`Xóa ảnh bằng chứng của ${product.name}`}
                                                            className="absolute right-2 top-2 flex h-10 w-10 items-center justify-center rounded-full bg-black/60 text-white backdrop-blur active:scale-95"
                                                        >
                                                            <Trash2 className="h-4 w-4" />
                                                        </button>
                                                    )}
                                                </div>
                                            ) : (
                                                <div className="grid grid-cols-2 gap-2">
                                                    <label
                                                        htmlFor={`count-camera-${product.id}`}
                                                        className="flex min-h-12 cursor-pointer items-center justify-center gap-2 rounded-xl bg-warning-500 px-3 text-xs font-bold text-white shadow-sm active:scale-[0.98]"
                                                    >
                                                        <Camera className="h-4 w-4" />
                                                        Chụp ảnh
                                                    </label>
                                                    <input
                                                        id={`count-camera-${product.id}`}
                                                        type="file"
                                                        accept="image/*"
                                                        capture="environment"
                                                        className="sr-only"
                                                        onChange={event => {
                                                            void handleEvidenceFile(product.id, event.target.files?.[0]);
                                                            event.target.value = '';
                                                        }}
                                                    />

                                                    <label
                                                        htmlFor={`count-upload-${product.id}`}
                                                        className="flex min-h-12 cursor-pointer items-center justify-center gap-2 rounded-xl border border-warning-200 bg-white px-3 text-xs font-bold text-warning-800 active:scale-[0.98]"
                                                    >
                                                        <ImagePlus className="h-4 w-4" />
                                                        Chọn từ máy
                                                    </label>
                                                    <input
                                                        id={`count-upload-${product.id}`}
                                                        type="file"
                                                        accept="image/*"
                                                        className="sr-only"
                                                        onChange={event => {
                                                            void handleEvidenceFile(product.id, event.target.files?.[0]);
                                                            event.target.value = '';
                                                        }}
                                                    />
                                                </div>
                                            )}
                                            <input
                                                value={draft.notes}
                                                onChange={event => updateDraft(product.id, { notes: event.target.value })}
                                                maxLength={500}
                                                placeholder="Ghi chú nguyên nhân (không bắt buộc)"
                                                className="h-10 w-full rounded-xl border border-surface-200 bg-white px-3 text-xs outline-none focus:border-accent-400"
                                            />
                                        </div>
                                    )}
                                </article>
                            ))}
                        </div>

                        <div className="sticky bottom-0 z-20 border-t border-surface-100 bg-white/95 px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-3 backdrop-blur sm:px-6">
                            <button
                                type="button"
                                onClick={goToConfirmation}
                                disabled={!countableProducts.length}
                                className="flex h-12 w-full items-center justify-center gap-2 rounded-2xl bg-accent-500 text-sm font-bold text-white shadow-lg shadow-accent-500/20 transition active:scale-[0.98] disabled:opacity-50"
                            >
                                <ShieldCheck className="h-5 w-5" />
                                Xem lại trước khi gửi
                            </button>
                        </div>
                    </>
                ) : (
                    <div className="px-4 pb-[max(1rem,env(safe-area-inset-bottom))] sm:px-6">
                        <button
                            type="button"
                            onClick={() => setStep('edit')}
                            disabled={submitting}
                            className="mb-5 flex min-h-11 items-center gap-2 text-sm font-bold text-surface-600"
                        >
                            <ArrowLeft className="h-4 w-4" /> Chỉnh sửa kiểm đếm
                        </button>

                        <div className="text-center">
                            <div className={cn(
                                'mx-auto flex h-16 w-16 items-center justify-center rounded-full',
                                issueRows.length ? 'bg-warning-100 text-warning-700' : 'bg-success-100 text-success-700',
                            )}>
                                {issueRows.length ? <AlertTriangle className="h-8 w-8" /> : <CheckCircle2 className="h-8 w-8" />}
                            </div>
                            <h3 className="mt-4 text-lg font-bold text-surface-900">Xác nhận gửi</h3>
                            <p className="mx-auto mt-2 max-w-sm text-sm leading-relaxed text-surface-500">
                                Bạn sắp gửi {rows.length} sản phẩm tại {locationName}.
                                {issueRows.length
                                    ? ` Có ${issueRows.length} dòng chênh lệch sẽ được tạo phiếu đối soát.`
                                    : ' Tất cả số lượng đang khớp ATP.'}
                            </p>
                        </div>

                        <div className="mt-6 grid grid-cols-3 gap-2">
                            <div className="rounded-2xl bg-surface-50 p-3 text-center">
                                <p className="text-lg font-black text-surface-900">{rows.length}</p>
                                <p className="mt-1 text-[10px] font-semibold uppercase text-surface-400">Sản phẩm</p>
                            </div>
                            <div className="rounded-2xl bg-surface-50 p-3 text-center">
                                <p className="text-lg font-black text-surface-900">{rows.reduce((sum, row) => sum + row.counted, 0)}</p>
                                <p className="mt-1 text-[10px] font-semibold uppercase text-surface-400">Thực tế</p>
                            </div>
                            <div className={cn('rounded-2xl p-3 text-center', issueRows.length ? 'bg-warning-50' : 'bg-success-50')}>
                                <p className={cn('text-lg font-black', issueRows.length ? 'text-warning-800' : 'text-success-700')}>{issueRows.length}</p>
                                <p className="mt-1 text-[10px] font-semibold uppercase text-surface-400">Chênh lệch</p>
                            </div>
                        </div>

                        <div className="mt-6 rounded-2xl border border-surface-100 bg-surface-50 p-4 text-xs text-surface-600">
                            <p><span className="font-bold">Checkpoint:</span> {labels.title}</p>
                            <p className="mt-2"><span className="font-bold">Người thực hiện:</span> {operatorName}</p>
                            <p className="mt-2"><span className="font-bold">Thời gian thực hiện:</span> {confirmedAt || dateTimeInVietnam()}</p>
                            <p className="mt-2 font-bold text-warning-800">Bạn hoàn toàn chịu trách nhiệm với số liệu này.</p>
                        </div>

                        <div className="mt-6 grid grid-cols-[0.8fr_1.2fr] gap-3">
                            <button
                                type="button"
                                onClick={() => setStep('edit')}
                                disabled={submitting}
                                className="h-12 rounded-2xl bg-surface-100 text-sm font-bold text-surface-700 active:scale-[0.98] disabled:opacity-50"
                            >
                                Quay lại
                            </button>
                            <button
                                type="button"
                                onClick={submit}
                                disabled={submitting}
                                className="flex h-12 items-center justify-center gap-2 rounded-2xl bg-accent-500 text-sm font-bold text-white shadow-lg shadow-accent-500/20 active:scale-[0.98] disabled:opacity-60"
                            >
                                {submitting ? <Loader2 className="h-5 w-5 animate-spin" /> : <CheckCircle2 className="h-5 w-5" />}
                                {submitting ? 'Đang gửi...' : 'Xác nhận gửi'}
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </BottomSheet>
    );
}
