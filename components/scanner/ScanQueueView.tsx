'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { getMyScansAction, cancelExternalScanAction, submitBatchAction } from '@/actions/scanner';
import { Trash2, Send, Loader2, Package, CheckCircle2, SearchX } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useRouter } from 'next/navigation';

export default function ScanQueueView() {
    const { user, userDoc } = useAuth();
    const router = useRouter();
    const [scans, setScans] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);
    const [notes, setNotes] = useState('');
    const [isDone, setIsDone] = useState(false);

    useEffect(() => {
        if (!user) return;
        fetchQueue();
    }, [user]);

    const fetchQueue = async () => {
        if (!user) return;
        setLoading(true);
        try {
            const res = await getMyScansAction(user.uid);
            if (res.success) {
                setScans(res.data);
            }
        } catch (err) {
            console.error('Failed to fetch queue', err);
        } finally {
            setLoading(false);
        }
    };

    const handleRemove = async (scanId: string) => {
        const action = cancelExternalScanAction(scanId);
        const res = await action;
        if (res.success) {
            setScans(s => s.filter(x => x.id !== scanId));
            alert('Đã xóa khỏi hàng đợi');
        } else {
            alert('Lỗi khi xóa: ' + (res.messages?.vi || 'Không thể xóa'));
        }
    };

    const handleSubmitBatch = async () => {
        if (!user || scans.length === 0 || submitting) return;
        setSubmitting(true);

        const shiftDate = new Date().toISOString().split('T')[0];

        // Group scans by warehouse_id + warehouse_location_id
        const groups = new Map<string, { warehouse_id: string, warehouse_location_id: string }>();
        for (const scan of scans) {
            const key = `${scan.warehouse_id}_${scan.warehouse_location_id}`;
            if (!groups.has(key)) {
                groups.set(key, { warehouse_id: scan.warehouse_id, warehouse_location_id: scan.warehouse_location_id });
            }
        }

        try {
            let allSuccess = true;
            for (const group of Array.from(groups.values())) {
                const action = submitBatchAction({
                    warehouse_id: group.warehouse_id,
                    warehouse_location_id: group.warehouse_location_id,
                    shift_date: shiftDate,
                    operator_name: userDoc?.name || user.email || 'Unknown',
                    operator_id_external: user.uid,
                    notes: notes || null
                });

                const res = await action;
                if (!res.success) {
                    allSuccess = false;
                    console.error('Failed to submit group:', group);
                    alert(`Lỗi khi gửi phiếu kho cho vị trí ${group.warehouse_location_id}: ` + (res.messages?.vi || 'Lỗi hệ thống'));
                }
            }

            if (allSuccess) {
                setIsDone(true);
            }
        } catch (err) {
            console.error('Batch submit error', err);
            alert('Không thể gửi phiếu kho. Vui lòng thử lại.');
        } finally {
            setSubmitting(false);
        }
    };

    if (loading) {
        return (
            <div className="flex flex-col items-center justify-center p-12">
                <Loader2 className="w-8 h-8 animate-spin text-accent-500 mb-4" />
                <p className="text-sm font-medium text-surface-500">Đang tải dữ liệu...</p>
            </div>
        );
    }

    if (isDone) {
        return (
            <div className="flex flex-col items-center justify-center p-12 bg-white rounded-2xl border border-surface-100 shadow-sm m-4">
                <div className="w-16 h-16 rounded-full bg-emerald-100 flex items-center justify-center mb-4">
                    <CheckCircle2 className="w-8 h-8 text-emerald-600" />
                </div>
                <h3 className="text-lg font-bold text-surface-800 mb-2">Đã gửi phiếu kho thành công!</h3>
                <p className="text-sm text-surface-500 text-center mb-6">
                    Hàng đợi của bạn đã được đóng gói thành phiếu kho và chuyển sang WMS chờ duyệt.
                </p>
                <button
                    onClick={() => router.push('/')}
                    className="px-6 py-3 rounded-xl bg-accent-500 text-white font-bold text-sm hover:bg-accent-600 transition-colors"
                >
                    Quay về Trang chủ
                </button>
            </div>
        );
    }

    if (scans.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center p-12 bg-white rounded-2xl border border-surface-100 shadow-sm m-4">
                <div className="w-16 h-16 rounded-full bg-surface-50 flex items-center justify-center mb-4">
                    <SearchX className="w-8 h-8 text-surface-300" />
                </div>
                <h3 className="text-base font-bold text-surface-800 mb-1">Hàng đợi trống</h3>
                <p className="text-sm text-surface-500 text-center mb-6">
                    Bạn chưa quét sản phẩm nào, hoặc tất cả sản phẩm đã được gửi lên WMS.
                </p>
                <button
                    onClick={() => router.push('/')}
                    className="px-6 py-3 rounded-xl bg-surface-100 text-surface-600 font-bold text-sm hover:bg-surface-200 transition-colors"
                >
                    Quay về Trang chủ
                </button>
            </div>
        );
    }

    const totalQty = scans.reduce((acc, s) => acc + s.quantity, 0);

    return (
        <div className="flex flex-col w-full max-w-lg mx-auto bg-surface-50 min-h-screen pb-24">
            <div className="p-4 bg-white border-b border-surface-100 flex items-center justify-between sticky top-0 z-10">
                <div>
                    <h1 className="text-lg font-bold text-surface-800">Hàng đợi quét kho</h1>
                    <p className="text-xs text-surface-500">{scans.length} sản phẩm · Tổng {totalQty} đơn vị</p>
                </div>
                <button onClick={fetchQueue} className="p-2 bg-surface-100 text-surface-600 rounded-lg hover:bg-surface-200">
                    <Loader2 className={cn("w-4 h-4", loading && "animate-spin")} />
                </button>
            </div>

            <div className="p-4 space-y-3 flex-1 overflow-y-auto">
                {scans.map(scan => (
                    <div key={scan.id} className="bg-white p-3 rounded-xl shadow-sm border border-surface-100 flex items-center gap-3">
                        <div className="w-12 h-12 bg-surface-50 rounded-lg flex items-center justify-center shrink-0">
                            <Package className="w-6 h-6 text-surface-400" />
                        </div>
                        <div className="flex-1 min-w-0">
                            <p className="text-sm font-bold text-surface-800 truncate">{scan.product_id}</p>
                            <p className="text-xs text-surface-500">Mã: {scan.barcode_scanned || scan.barcode}</p>
                            <p className="text-xs text-surface-500">Vị trí: <span className="font-semibold text-accent-600">{scan.warehouse_location_id}</span></p>
                            <p className="text-xs text-surface-500 mt-0.5">Thời gian: {new Date(scan.scan_time).toLocaleTimeString()}</p>
                        </div>
                        <div className="flex flex-col items-end gap-2 shrink-0">
                            <span className="text-sm font-black text-accent-600 px-2 py-1 bg-accent-50 rounded-lg">x{scan.quantity}</span>
                            <button
                                onClick={() => handleRemove(scan.id)}
                                className="p-1.5 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                            >
                                <Trash2 className="w-4 h-4" />
                            </button>
                        </div>
                    </div>
                ))}
            </div>

            <div className="fixed bottom-0 left-0 right-0 p-4 bg-white border-t border-surface-100 shadow-[0_-4px_12px_rgba(0,0,0,0.05)]">
                <div className="max-w-lg mx-auto">
                    <input
                        type="text"
                        placeholder="Ghi chú thêm (tùy chọn)..."
                        value={notes}
                        onChange={e => setNotes(e.target.value)}
                        className="w-full px-4 py-2.5 bg-surface-50 border border-surface-200 rounded-xl text-sm mb-3 focus:outline-none focus:ring-2 focus:ring-accent-500"
                    />
                    <button
                        onClick={handleSubmitBatch}
                        disabled={submitting}
                        className={cn(
                            "w-full flex items-center justify-center gap-2 py-3.5 rounded-xl text-white font-bold text-sm shadow-lg shadow-accent-200 transition-all",
                            submitting ? "bg-accent-400 cursor-not-allowed" : "bg-accent-500 hover:bg-accent-600 active:scale-95"
                        )}
                    >
                        {submitting ? <Loader2 className="w-5 h-5 animate-spin" /> : <Send className="w-5 h-5" />}
                        Gửi {scans.length} sản phẩm lên WMS
                    </button>
                </div>
            </div>
        </div>
    );
}
