'use client';

import { useState, useEffect } from 'react';
import { Package, Tag, Barcode, DollarSign, MapPin, Layers, Loader2, Plus, Minus, CheckCircle2 } from 'lucide-react';
import type { PreloadedProduct } from '@/actions/scanner';
import { submitExternalScanAction, getWmsLocationsAction } from '@/actions/scanner';
import { useAuth } from '@/contexts/AuthContext';
import { cn } from '@/lib/utils';

interface ProductScanConfirmCardProps {
    product: PreloadedProduct;
    wmsWarehouseId: string | null;
    onClose: () => void;
}

export default function ProductScanConfirmCard({ product, wmsWarehouseId, onClose }: ProductScanConfirmCardProps) {
    const { user } = useAuth();
    const [quantity, setQuantity] = useState<number>(1);
    const [submitting, setSubmitting] = useState(false);
    const [done, setDone] = useState(false);

    const [locations, setLocations] = useState<any[]>([]);
    const [selectedLocationId, setSelectedLocationId] = useState<string>('');
    const [loadingLocs, setLoadingLocs] = useState(true);

    useEffect(() => {
        if (!wmsWarehouseId) {
            setLoadingLocs(false);
            return;
        }
        let isMounted = true;
        getWmsLocationsAction(wmsWarehouseId).then(res => {
            if (isMounted) {
                if (res.success && res.data) {
                    setLocations(res.data);
                    if (res.data.length > 0) {
                        setSelectedLocationId(res.data[0].id);
                    }
                }
                setLoadingLocs(false);
            }
        });
        return () => { isMounted = false; };
    }, [wmsWarehouseId]);

    const handleIncrement = () => setQuantity(q => q + 1);
    const handleDecrement = () => setQuantity(q => Math.max(1, q - 1));

    const handleSubmit = async () => {
        if (submitting || !user) return;
        if (!wmsWarehouseId) {
            alert('Lỗi: Cửa hàng này chưa được liên kết với kho WMS nào.');
            return;
        }
        if (!selectedLocationId) {
            alert('Lỗi: Vui lòng chọn vị trí/kệ hàng trước khi thêm.');
            return;
        }
        setSubmitting(true);
        
        const action = submitExternalScanAction({
            warehouse_id: wmsWarehouseId,
            barcode: product.barcode,
            product_id: product.id,
            warehouse_location_id: selectedLocationId,
            quantity,
            operator_name: user.displayName || user.email || 'Unknown',
            operator_id_external: user.uid,
            device_id: null,
        });

        try {
            const result = await action;
            if (result.success) {
                setDone(true);
            } else {
                alert('Đã xảy ra lỗi: ' + (result.messages?.vi || 'Không thể gửi lên WMS'));
            }
        } catch (error) {
            console.error(error);
            alert('Đã xảy ra lỗi hệ thống khi lưu');
        } finally {
            setSubmitting(false);
        }
    };

    if (done) {
        return (
            <div className="flex flex-col items-center py-12 px-6">
                <div className="w-16 h-16 rounded-full bg-emerald-100 flex items-center justify-center mb-4">
                    <CheckCircle2 className="w-8 h-8 text-emerald-600" />
                </div>
                <h3 className="text-base font-bold text-surface-800 mb-1">Đã thêm vào hàng đợi!</h3>
                <p className="text-sm text-surface-500 text-center mb-6">
                    Sản phẩm {product.name} (SL: {quantity})
                </p>
                <div className="w-full space-y-2">
                    <button onClick={onClose} className="w-full py-3 rounded-xl bg-surface-100 text-surface-600 font-semibold text-sm hover:bg-surface-200 transition-colors">
                        Quét tiếp
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="flex flex-col">
            {/* Product Image */}
            {product.image ? (
                <div className="w-full h-32 bg-surface-100 overflow-hidden rounded-t-xl flex items-center justify-center">
                    <img src={product.image} alt={product.name} className="max-w-full max-h-full object-contain p-2" />
                </div>
            ) : (
                <div className="w-full h-24 bg-surface-100 rounded-t-xl flex items-center justify-center">
                    <Package className="w-10 h-10 text-surface-400" />
                </div>
            )}

            <div className="p-4 space-y-4">
                {/* Header */}
                <div className="text-center">
                    <h3 className="text-sm font-bold text-surface-800 line-clamp-2">{product.name}</h3>
                    <p className="text-xs text-surface-500 mt-1">{product.barcode || product.companyCode}</p>
                </div>

                {/* Quantity Input */}
                <div className="bg-surface-50 rounded-xl p-3 border border-surface-200 flex flex-col items-center">
                    <span className="text-xs font-bold text-surface-500 uppercase mb-2">Số lượng</span>
                    <div className="flex items-center gap-4">
                        <button 
                            onClick={handleDecrement}
                            className="w-10 h-10 rounded-full bg-white border border-surface-200 flex items-center justify-center text-surface-600 active:scale-95 transition-transform"
                        >
                            <Minus className="w-5 h-5" />
                        </button>
                        <span className="text-2xl font-black text-surface-800 w-12 text-center">{quantity}</span>
                        <button 
                            onClick={handleIncrement}
                            className="w-10 h-10 rounded-full bg-white border border-surface-200 flex items-center justify-center text-surface-600 active:scale-95 transition-transform"
                        >
                            <Plus className="w-5 h-5" />
                        </button>
                    </div>
                </div>

                {/* Location Selection */}
                <div className="bg-surface-50 rounded-xl p-3 border border-surface-200">
                    <span className="text-xs font-bold text-surface-500 uppercase mb-1 block">Vị trí lưu trữ</span>
                    {loadingLocs ? (
                        <div className="text-xs text-surface-400 flex items-center gap-2 py-2">
                            <Loader2 className="w-4 h-4 animate-spin" /> Đang tải vị trí...
                        </div>
                    ) : !wmsWarehouseId ? (
                        <div className="text-xs text-danger-500 font-medium py-2">
                            Lỗi: Chưa liên kết với kho WMS.
                        </div>
                    ) : locations.length === 0 ? (
                        <div className="text-xs text-warning-600 font-medium py-2">
                            Kho này chưa có vị trí (Location) nào được cấu hình.
                        </div>
                    ) : (
                        <select 
                            value={selectedLocationId}
                            onChange={(e) => setSelectedLocationId(e.target.value)}
                            className="w-full bg-white border border-surface-200 rounded-lg p-2 text-sm outline-none focus:ring-2 focus:ring-accent-500 font-medium"
                        >
                            {locations.map(loc => (
                                <option key={loc.id} value={loc.id}>{loc.name} ({loc.code})</option>
                            ))}
                        </select>
                    )}
                </div>

                {/* Actions */}
                <div className="flex gap-2 pt-2">
                    <button
                        onClick={onClose}
                        disabled={submitting}
                        className="flex-1 py-3.5 rounded-xl bg-surface-100 text-surface-600 font-bold text-sm hover:bg-surface-200 transition-colors"
                    >
                        Hủy
                    </button>
                    <button
                        onClick={handleSubmit}
                        disabled={submitting}
                        className={cn(
                            "flex-[2] py-3.5 rounded-xl font-bold text-sm text-white transition-all shadow-md shadow-accent-200",
                            submitting ? "bg-accent-400 cursor-wait" : "bg-accent-500 hover:bg-accent-600 active:scale-95"
                        )}
                    >
                        {submitting ? <Loader2 className="w-5 h-5 animate-spin mx-auto" /> : 'Thêm vào hàng đợi'}
                    </button>
                </div>
            </div>
        </div>
    );
}
