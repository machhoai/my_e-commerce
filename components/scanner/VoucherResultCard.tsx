'use client';

import { CheckCircle2, XCircle, Ticket, Clock, Phone, Tag, User } from 'lucide-react';
import { cn } from '@/lib/utils';

interface VoucherResultCardProps {
    success: boolean;
    title: string;
    details: { label: string; value: string }[];
    onClose: () => void;
}

export default function VoucherResultCard({ success, title, details, onClose }: VoucherResultCardProps) {
    return (
        <div className="flex flex-col items-center px-6 py-8">
            {/* Big Status Icon */}
            <div className={cn(
                'w-20 h-20 rounded-full flex items-center justify-center mb-5',
                success
                    ? 'bg-gradient-to-br from-success-100 to-success-50 shadow-lg shadow-success-200/50'
                    : 'bg-gradient-to-br from-danger-100 to-danger-50 shadow-lg shadow-danger-200/50',
            )}>
                {success ? (
                    <CheckCircle2 className="w-10 h-10 text-success-600" strokeWidth={2.5} />
                ) : (
                    <XCircle className="w-10 h-10 text-danger-600" strokeWidth={2.5} />
                )}
            </div>

            {/* Title */}
            <h3 className={cn(
                'text-xl font-bold mb-1',
                success ? 'text-success-700' : 'text-danger-700',
            )}>
                {title}
            </h3>

            {/* Detail List */}
            <div className="w-full mt-5 bg-surface-50 rounded-xl border border-surface-100 divide-y divide-surface-100">
                {details.map(d => {
                    const IconMap: Record<string, typeof Ticket> = {
                        'Mã voucher': Ticket,
                        'Thời gian': Clock,
                        'SĐT khách': Phone,
                        'Phần thưởng': Tag,
                        'Nhân viên': User,
                        'Lý do': XCircle,
                    };
                    const Icon = IconMap[d.label] || Tag;
                    return (
                        <div key={d.label} className="flex items-center gap-3 px-4 py-3">
                            <Icon className="w-4 h-4 text-surface-400 shrink-0" />
                            <span className="text-xs text-surface-500">{d.label}</span>
                            <span className="text-sm font-semibold text-surface-800 ml-auto text-right max-w-[55%] truncate">
                                {d.value}
                            </span>
                        </div>
                    );
                })}
            </div>

            {/* Full-width Bottom Button */}
            <button
                onClick={onClose}
                className={cn(
                    'w-full mt-6 py-3.5 rounded-xl font-bold text-sm text-white transition-all shadow-lg',
                    success
                        ? 'bg-gradient-to-r from-success-600 to-success-700 hover:from-success-700 hover:to-success-800 shadow-success-600/25'
                        : 'bg-gradient-to-r from-danger-500 to-danger-600 hover:from-danger-600 hover:to-danger-700 shadow-danger-500/25',
                )}
            >
                {success ? 'Hoàn tất' : 'Đóng'}
            </button>
        </div>
    );
}
