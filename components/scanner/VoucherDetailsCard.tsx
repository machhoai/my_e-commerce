'use client';

import { useState } from 'react';
import type { VoucherCode } from '@/types';
import { redeemVoucherAction } from '@/actions/vouchers';
import { useAuth } from '@/contexts/AuthContext';
import {
    Ticket, Calendar, Phone, Tag, Gift, Loader2, ShieldCheck, AlertTriangle,
} from 'lucide-react';
import { cn } from '@/lib/utils';

const REWARD_LABELS: Record<string, string> = {
    discount_percent: 'Giảm %',
    discount_fixed: 'Giảm tiền',
    free_ticket: 'Vé miễn phí',
    free_item: 'Tặng sản phẩm',
};

interface VoucherData extends VoucherCode {
    campaignImage?: string;
    campaignName?: string;
}

interface VoucherDetailsCardProps {
    voucher: VoucherData;
    onRedeemed: (result: { success: boolean; message: string; usedAt?: string }) => void;
    onClose: () => void;
}

export default function VoucherDetailsCard({ voucher, onRedeemed, onClose }: VoucherDetailsCardProps) {
    const { user } = useAuth();
    const [redeeming, setRedeeming] = useState(false);

    const isExpired = voucher.validTo < new Date().toISOString().slice(0, 10);
    const isUsable = voucher.status === 'distributed' && !isExpired;

    const handleRedeem = async () => {
        if (!user || !isUsable) return;
        setRedeeming(true);
        try {
            const result = await redeemVoucherAction(voucher.id, user.uid);
            onRedeemed(result);
        } catch {
            onRedeemed({ success: false, message: 'Lỗi kết nối. Vui lòng thử lại.' });
        } finally {
            setRedeeming(false);
        }
    };

    const rewardText = (() => {
        const label = REWARD_LABELS[voucher.rewardType] || voucher.rewardType;
        if (voucher.rewardType === 'discount_percent') return `${label} ${voucher.rewardValue}%`;
        if (voucher.rewardType === 'discount_fixed') return `${label} ${voucher.rewardValue.toLocaleString()}đ`;
        return label;
    })();

    return (
        <div className="flex flex-col">
            {/* Campaign Image */}
            {voucher.campaignImage && (
                <div className="w-full h-40 bg-surface-100 overflow-hidden rounded-t-xl">
                    <img src={voucher.campaignImage} alt="" className="w-full h-full object-cover" />
                </div>
            )}

            {/* Content */}
            <div className="p-5 space-y-4">
                {/* Header */}
                <div className="text-center">
                    <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-gradient-to-br from-accent-100 to-accent-50 mb-3">
                        <Ticket className="w-7 h-7 text-accent-600" />
                    </div>
                    <h3 className="text-lg font-bold text-surface-800">Chi tiết Voucher</h3>
                    {voucher.campaignName && (
                        <p className="text-sm text-surface-500 mt-0.5">{voucher.campaignName}</p>
                    )}
                </div>

                {/* Status pills */}
                <div className="flex justify-center gap-2">
                    <span className={cn(
                        'text-[11px] font-bold px-2.5 py-1 rounded-lg border',
                        voucher.status === 'distributed' ? 'bg-success-50 text-success-700 border-success-200'
                            : voucher.status === 'used' ? 'bg-surface-100 text-surface-600 border-surface-200'
                                : 'bg-danger-50 text-danger-700 border-danger-200',
                    )}>
                        {voucher.status === 'distributed' ? 'Chưa sử dụng' : voucher.status === 'used' ? 'Đã sử dụng' : voucher.status}
                    </span>
                    {isExpired && (
                        <span className="text-[11px] font-bold px-2.5 py-1 rounded-lg border bg-warning-50 text-warning-700 border-warning-200">
                            Hết hạn
                        </span>
                    )}
                </div>

                {/* Details List */}
                <div className="bg-surface-50 rounded-xl border border-surface-100 divide-y divide-surface-100">
                    {[
                        { icon: Ticket, label: 'Mã voucher', value: voucher.id, mono: true },
                        { icon: Gift, label: 'Phần thưởng', value: rewardText },
                        { icon: Calendar, label: 'Hết hạn', value: voucher.validTo },
                        { icon: Phone, label: 'SĐT nhận', value: voucher.distributedToPhone || '—' },
                        { icon: Tag, label: 'Ngày phát', value: voucher.distributedAt?.slice(0, 10) || '—' },
                    ].map(item => (
                        <div key={item.label} className="flex items-center gap-3 px-4 py-3">
                            <item.icon className="w-4 h-4 text-surface-400 shrink-0" />
                            <span className="text-xs text-surface-500 min-w-[80px]">{item.label}</span>
                            <span className={cn('text-sm font-semibold text-surface-800 ml-auto text-right', item.mono && 'font-mono text-xs')}>
                                {item.value}
                            </span>
                        </div>
                    ))}
                </div>

                {/* Action Buttons */}
                {isUsable ? (
                    <button
                        onClick={handleRedeem}
                        disabled={redeeming}
                        className="w-full flex items-center justify-center gap-2 py-3.5 rounded-xl bg-gradient-to-r from-accent-500 to-accent-600 hover:from-accent-600 hover:to-accent-700 disabled:opacity-50 text-white font-bold text-sm shadow-lg shadow-accent-500/25 transition-all"
                    >
                        {redeeming ? (
                            <><Loader2 className="w-4 h-4 animate-spin" /> Đang xử lý...</>
                        ) : (
                            <><ShieldCheck className="w-4 h-4" /> Xác nhận Sử dụng</>
                        )}
                    </button>
                ) : (
                    <div className="space-y-2">
                        <div className="flex items-center justify-center gap-2 py-3.5 rounded-xl bg-surface-100 text-surface-500 font-semibold text-sm">
                            <AlertTriangle className="w-4 h-4" />
                            {isExpired ? 'Voucher đã hết hạn' : voucher.status === 'used' ? 'Voucher đã sử dụng' : 'Không thể sử dụng'}
                        </div>
                        <button
                            onClick={onClose}
                            className="w-full py-3 rounded-xl bg-surface-800 text-white font-bold text-sm hover:bg-surface-900 transition-colors"
                        >
                            Đóng
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
}
