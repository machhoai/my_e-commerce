'use client';

import { Package, Tag, Barcode, DollarSign, MapPin, Layers } from 'lucide-react';
import type { ProductDoc } from '@/types/inventory';

interface ProductInfoCardProps {
    product: ProductDoc;
    onClose: () => void;
}

export default function ProductInfoCard({ product, onClose }: ProductInfoCardProps) {
    return (
        <div className="flex flex-col">
            {/* Product Image */}
            {product.image && (
                <div className="w-full h-44 bg-surface-100 overflow-hidden rounded-t-xl">
                    <img src={product.image} alt={product.name} className="w-full h-full object-contain p-4" />
                </div>
            )}

            <div className="p-5 space-y-4">
                {/* Header */}
                <div className="text-center">
                    {!product.image && (
                        <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-gradient-to-br from-primary-100 to-primary-50 mb-3">
                            <Package className="w-7 h-7 text-primary-600" />
                        </div>
                    )}
                    <h3 className="text-lg font-bold text-surface-800">{product.name}</h3>
                    <p className="text-sm text-surface-500 mt-0.5">{product.category}</p>
                </div>

                {/* Price Row */}
                <div className="flex items-center justify-center gap-4">
                    <div className="text-center">
                        <p className="text-[10px] text-surface-400 uppercase tracking-wide">Giá bán</p>
                        <p className="text-xl font-black text-accent-600">{product.actualPrice.toLocaleString()}đ</p>
                    </div>
                    {product.invoicePrice !== product.actualPrice && (
                        <div className="text-center">
                            <p className="text-[10px] text-surface-400 uppercase tracking-wide">Giá nhập</p>
                            <p className="text-base font-bold text-surface-500">{product.invoicePrice.toLocaleString()}đ</p>
                        </div>
                    )}
                </div>

                {/* Details */}
                <div className="bg-surface-50 rounded-xl border border-surface-100 divide-y divide-surface-100">
                    {[
                        { icon: Barcode, label: 'Mã vạch', value: product.barcode },
                        { icon: Tag, label: 'Mã nội bộ', value: product.companyCode },
                        { icon: Layers, label: 'Đơn vị', value: product.unit },
                        { icon: MapPin, label: 'Xuất xứ', value: product.origin },
                        { icon: DollarSign, label: 'Tồn tối thiểu', value: String(product.minStock) },
                    ].map(item => (
                        <div key={item.label} className="flex items-center gap-3 px-4 py-3">
                            <item.icon className="w-4 h-4 text-surface-400 shrink-0" />
                            <span className="text-xs text-surface-500">{item.label}</span>
                            <span className="text-sm font-semibold text-surface-800 ml-auto text-right">
                                {item.value || '—'}
                            </span>
                        </div>
                    ))}
                </div>

                <button
                    onClick={onClose}
                    className="w-full py-3.5 rounded-xl bg-surface-800 text-white font-bold text-sm hover:bg-surface-900 transition-colors"
                >
                    Đóng
                </button>
            </div>
        </div>
    );
}
