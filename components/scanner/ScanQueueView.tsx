'use client';

import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { getMyScansAction, cancelExternalScanAction } from '@/actions/scanner';
import { Trash2, Loader2, Package, SearchX, ShieldCheck } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useRouter } from 'next/navigation';

type QueueScan = {
    id: string;
    product_id: string;
    barcode_scanned?: string;
    barcode?: string;
    warehouse_id: string;
    warehouse_location_id: string;
    quantity: number;
    scan_time: string;
};

export default function ScanQueueView() {
    const { user } = useAuth();
    const router = useRouter();
    const [scans, setScans] = useState<QueueScan[]>([]);
    const [loading, setLoading] = useState(true);

    const fetchQueue = useCallback(async () => {
        if (!user) return;
        setLoading(true);
        try {
            const res = await getMyScansAction(user.uid);
            if (res.success) {
                setScans((res.data || []) as QueueScan[]);
            }
        } catch (err) {
            console.error('Failed to fetch queue', err);
        } finally {
            setLoading(false);
        }
    }, [user]);

    useEffect(() => {
        if (!user) return;
        void fetchQueue();
    }, [fetchQueue, user]);

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

    if (loading) {
        return (
            <div className="flex flex-col items-center justify-center p-12">
                <Loader2 className="w-8 h-8 animate-spin text-accent-500 mb-4" />
                <p className="text-sm font-medium text-surface-500">Đang tải dữ liệu...</p>
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
                <div className="mx-auto flex max-w-lg items-start gap-3 rounded-xl border border-accent-100 bg-accent-50 p-3">
                    <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-accent-600" />
                    <p className="text-xs leading-5 text-surface-600">
                        Hàng đợi của ca hiện tại sẽ tự động được chốt và chuyển sang WMS khi ca kế tiếp hoàn tất kiểm kê đầu ca.
                    </p>
                </div>
            </div>
        </div>
    );
}
