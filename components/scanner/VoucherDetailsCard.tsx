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
                    {/* Animated status icon */}
                    {isUsable ? (
                        <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-success-100 to-success-50 mb-3 animate-pulse">
                            <ShieldCheck className="w-8 h-8 text-success-600" />
                        </div>
                    ) : voucher.status === 'used' ? (
                        <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-surface-200 to-surface-100 mb-3">
                            <Ticket className="w-8 h-8 text-surface-400 line-through" />
                            <style jsx>{`@keyframes stamp{0%{transform:scale(0) rotate(-30deg);opacity:0}60%{transform:scale(1.2) rotate(5deg);opacity:1}100%{transform:scale(1) rotate(0deg);opacity:1}}`}</style>
                            <div className="absolute inset-0 flex items-center justify-center" style={{ animation: 'stamp 0.5s ease-out forwards' }}>
                                <div className="w-10 h-10 rounded-full border-[3px] border-surface-400 flex items-center justify-center rotate-[-15deg] opacity-60">
                                    <span className="text-[8px] font-black text-surface-500 uppercase tracking-widest">Đã dùng</span>
                                </div>
                            </div>
                        </div>
                    ) : isExpired ? (
                        <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-warning-100 to-warning-50 mb-3 animate-bounce" style={{ animationDuration: '2s' }}>
                            <AlertTriangle className="w-8 h-8 text-warning-600" />
                        </div>
                    ) : (
                        <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-danger-100 to-danger-50 mb-3">
                            <AlertTriangle className="w-8 h-8 text-danger-500" />
                        </div>
                    )}
                    <h3 className="text-lg font-bold text-surface-800">Chi tiết Voucher</h3>
                    {voucher.campaignName && (
                        <p className="text-sm text-surface-500 mt-0.5">{voucher.campaignName}</p>
                    )}
                </div>

                {/* Reason banner for unusable vouchers */}
                {!isUsable && (
                    <div className={cn(
                        'flex items-start gap-2.5 px-3.5 py-2.5 rounded-xl border text-xs',
                        isExpired
                            ? 'bg-warning-50 border-warning-200 text-warning-800'
                            : voucher.status === 'used'
                                ? 'bg-surface-50 border-surface-200 text-surface-600'
                                : 'bg-danger-50 border-danger-200 text-danger-700'
                    )}>
                        <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                        <div>
                            <p className="font-bold">
                                {voucher.status === 'used'
                                    ? 'Voucher đã được sử dụng'
                                    : isExpired
                                        ? 'Voucher đã hết hạn'
                                        : 'Voucher không khả dụng'}
                            </p>
                            <p className="mt-0.5 opacity-75">
                                {voucher.status === 'used' && voucher.usedAt
                                    ? `Đã sử dụng lúc ${new Date(voucher.usedAt).toLocaleString('vi-VN')}`
                                    : isExpired
                                        ? `Hạn sử dụng đến ${voucher.validTo}. Voucher đã quá hạn và không thể sử dụng.`
                                        : 'Voucher này không ở trạng thái có thể sử dụng.'}
                            </p>
                        </div>
                    </div>
                )}

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
