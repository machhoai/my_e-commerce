'use client';

import { useState, useCallback, useMemo } from 'react';
import type { VoucherCode } from '@/types';
import { Ticket, Phone, Calendar, Gift, Tag, ChevronRight, Clock } from 'lucide-react';
import { cn } from '@/lib/utils';

const REWARD_LABELS: Record<string, string> = {
    discount_percent: 'Giảm %',
    discount_fixed: 'Giảm tiền',
    free_ticket: 'Vé miễn phí',
    free_item: 'Tặng sản phẩm',
};

interface VoucherListSelectorProps {
    phone: string;
    vouchers: VoucherCode[];
    onSelect: (voucher: VoucherCode) => void;
    onClose: () => void;
}

export default function VoucherListSelector({ phone, vouchers, onSelect, onClose }: VoucherListSelectorProps) {
    const [filter, setFilter] = useState('');

    const filtered = useMemo(() => {
        if (!filter) return vouchers;
        const q = filter.toLowerCase();
        return vouchers.filter(v =>
            v.id.toLowerCase().includes(q) ||
            (v.campaignName || '').toLowerCase().includes(q)
        );
    }, [vouchers, filter]);

    if (vouchers.length === 0) {
        return (
            <div className="flex flex-col items-center py-12 px-6">
                <div className="w-16 h-16 rounded-full bg-surface-100 flex items-center justify-center mb-4">
                    <Ticket className="w-8 h-8 text-surface-400" />
                </div>
                <h3 className="text-base font-bold text-surface-800 mb-1">Không có voucher</h3>
                <p className="text-sm text-surface-500 text-center mb-6">
                    Số <span className="font-semibold text-surface-700">{phone}</span> không có voucher nào chưa sử dụng.
                </p>
                <button
                    onClick={onClose}
                    className="w-full py-3 rounded-xl bg-surface-800 text-white font-bold text-sm hover:bg-surface-900 transition-colors"
                >
                    Đóng
                </button>
            </div>
        );
    }

    return (
        <div className="flex flex-col max-h-[70vh]">
            {/* Header */}
            <div className="px-5 pt-5 pb-3">
                <div className="flex items-center gap-2 mb-1">
                    <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-primary-500 to-primary-600 flex items-center justify-center">
                        <Phone className="w-4 h-4 text-white" />
                    </div>
                    <div>
                        <h3 className="text-sm font-bold text-surface-800">Voucher của khách hàng</h3>
                        <p className="text-xs text-surface-500">{phone} • {vouchers.length} voucher</p>
                    </div>
                </div>
            </div>

            {/* Filter */}
            {vouchers.length > 3 && (
                <div className="px-5 pb-3">
                    <input
                        type="text"
                        value={filter}
                        onChange={e => setFilter(e.target.value)}
                        placeholder="Tìm theo mã hoặc chiến dịch..."
                        className="w-full bg-surface-50 border border-surface-200 text-sm rounded-xl px-3.5 py-2.5 focus:ring-accent-500 focus:border-accent-400 placeholder-surface-400"
                    />
                </div>
            )}

            {/* List */}
            <div className="flex-1 overflow-y-auto px-5 pb-5 space-y-2">
                {filtered.map(v => {
                    const isExpired = v.validTo < new Date().toISOString().slice(0, 10);
                    return (
                        <button
                            key={v.id}
                            onClick={() => !isExpired && onSelect(v)}
                            disabled={isExpired}
                            className={cn(
                                'w-full text-left rounded-xl border p-3.5 transition-all duration-200 group',
                                isExpired
                                    ? 'bg-surface-50 border-surface-100 opacity-50 cursor-not-allowed'
                                    : 'bg-white border-surface-200 hover:border-accent-300 hover:shadow-md hover:scale-[1.01]'
                            )}
                        >
                            <div className="flex items-center justify-between gap-2">
                                <div className="flex-1 min-w-0">
                                    <p className="text-sm font-bold text-surface-800 truncate font-mono">{v.id}</p>
                                    <div className="flex items-center gap-3 mt-1.5">
                                        <span className="flex items-center gap-1 text-[11px] text-surface-500">
                                            <Tag className="w-3 h-3" />
                                            {REWARD_LABELS[v.rewardType] || v.rewardType}
                                            {v.rewardType.includes('discount') && ` ${v.rewardValue}${v.rewardType === 'discount_percent' ? '%' : 'đ'}`}
                                        </span>
                                        <span className="flex items-center gap-1 text-[11px] text-surface-500">
                                            <Clock className="w-3 h-3" />
                                            {isExpired ? 'Hết hạn' : `→ ${v.validTo}`}
                                        </span>
                                    </div>
                                    {v.campaignName && (
                                        <p className="text-[10px] text-surface-400 mt-1">{v.campaignName}</p>
                                    )}
                                </div>
                                {!isExpired && (
                                    <ChevronRight className="w-4 h-4 text-surface-300 group-hover:text-accent-500 transition-colors shrink-0" />
                                )}
                            </div>
                        </button>
                    );
                })}
            </div>
        </div>
    );
}
