'use client';

import { useRouter } from 'next/navigation';
import { ShieldOff, Home, ArrowLeft } from 'lucide-react';

export default function ForbiddenPage() {
    const router = useRouter();

    return (
        <div className="min-h-screen flex items-center justify-center bg-surface-950">
            {/* Background glow */}
            <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-96 h-96 rounded-full bg-danger-500/10 blur-3xl pointer-events-none" />

            <div className="relative z-10 flex flex-col items-center gap-6 text-center px-6">
                {/* Icon */}
                <div className="relative">
                    <div className="absolute inset-0 rounded-full bg-danger-500/20 blur-xl scale-150" />
                    <div className="relative w-20 h-20 rounded-2xl bg-danger-500/10 border border-danger-500/20 flex items-center justify-center">
                        <ShieldOff className="w-10 h-10 text-danger-400" />
                    </div>
                </div>

                {/* Text */}
                <div className="space-y-2">
                    <p className="text-danger-400 text-sm font-bold uppercase tracking-widest">Lỗi 403</p>
                    <h1 className="text-3xl font-extrabold text-white tracking-tight">Không có quyền truy cập</h1>
                    <p className="text-surface-400 text-sm max-w-xs leading-relaxed">
                        Trang này chỉ dành cho <span className="text-white font-semibold">Quản trị viên</span>. Tài khoản của bạn không có quyền truy cập khu vực này.
                    </p>
                </div>

                {/* Actions */}
                <div className="flex flex-col sm:flex-row gap-3 w-full max-w-xs">
                    <button
                        onClick={() => router.back()}
                        className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl border border-surface-700 text-surface-300 hover:bg-surface-800 transition-colors text-sm font-medium"
                    >
                        <ArrowLeft className="w-4 h-4" />
                        Quay lại
                    </button>
                    <button
                        onClick={() => router.replace('/')}
                        className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-primary-500 hover:bg-primary-400 text-surface-950 font-bold transition-colors text-sm"
                    >
                        <Home className="w-4 h-4" />
                        Trang chủ
                    </button>
                </div>
            </div>
        </div>
    );
}
