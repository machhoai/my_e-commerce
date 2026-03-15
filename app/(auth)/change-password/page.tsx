'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { KeyRound, ShieldCheck, AlertCircle, ArrowLeft, Lock, Eye, EyeOff, CheckCircle2 } from 'lucide-react';
import Link from 'next/link';
import AuthGuard from '@/components/layout/AuthGuard';

export default function ChangePasswordPage() {
    const [currentPassword, setCurrentPassword] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [showCurrent, setShowCurrent] = useState(false);
    const [showNew, setShowNew] = useState(false);
    const [showConfirm, setShowConfirm] = useState(false);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState(false);
    const [loading, setLoading] = useState(false);

    const { changePassword } = useAuth();
    const router = useRouter();

    // Password strength indicator
    const strength = (() => {
        if (!newPassword) return 0;
        let score = 0;
        if (newPassword.length >= 6) score++;
        if (newPassword.length >= 10) score++;
        if (/[A-Z]/.test(newPassword)) score++;
        if (/[0-9]/.test(newPassword)) score++;
        if (/[^A-Za-z0-9]/.test(newPassword)) score++;
        return score;
    })();

    const strengthLabel = ['', 'Yếu', 'Trung bình', 'Khá', 'Mạnh', 'Rất mạnh'][strength] ?? '';
    const strengthColor = ['', 'bg-danger-500', 'bg-warning-500', 'bg-warning-400', 'bg-success-500', 'bg-success-400'][strength] ?? '';

    const passwordsMatch = newPassword && confirmPassword && newPassword === confirmPassword;

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');

        if (newPassword !== confirmPassword) {
            return setError('Mật khẩu mới không khớp');
        }
        if (newPassword.length < 6) {
            return setError('Mật khẩu mới phải có ít nhất 6 ký tự');
        }

        setLoading(true);
        try {
            await changePassword(currentPassword, newPassword);
            setSuccess(true);
            setTimeout(() => {
                router.push('/employee/dashboard');
            }, 2500);
        } catch (err: unknown) {
            if (err instanceof Error) {
                if (err.message.includes('auth/invalid-credential')) {
                    setError('Mật khẩu hiện tại không đúng');
                } else {
                    setError(err.message || 'Đổi mật khẩu thất bại');
                }
            } else {
                setError('Đã xảy ra lỗi không xác định');
            }
        } finally {
            setLoading(false);
        }
    };

    return (
        <AuthGuard>
            <div className="min-h-screen flex bg-surface-950">
                {/* ── Left panel: Branding ── */}
                <div className="hidden lg:flex lg:w-2/5 xl:w-1/2 relative flex-col items-center justify-center overflow-hidden">
                    <div className="absolute inset-0 bg-gradient-to-br from-surface-900 via-surface-950 to-[#0a0f1e]" />
                    {/* Glowing orb — success tint for this page */}
                    <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[420px] h-[420px] rounded-full bg-success-500/6 blur-3xl pointer-events-none" />
                    <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[280px] h-[280px] rounded-full bg-primary-500/5 blur-2xl pointer-events-none" />
                    {/* Grid */}
                    <div
                        className="absolute inset-0 opacity-[0.03]"
                        style={{
                            backgroundImage: `linear-gradient(rgba(255,209,0,0.8) 1px, transparent 1px), linear-gradient(90deg, rgba(255,209,0,0.8) 1px, transparent 1px)`,
                            backgroundSize: '60px 60px',
                        }}
                    />

                    <div className="relative flex flex-col items-center z-10">
                        <div className="relative mb-10">
                            <div className="absolute inset-0 rounded-full border border-success-500/20 scale-150 animate-ping" style={{ animationDuration: '3s' }} />
                            <div className="absolute inset-0 rounded-full border border-success-500/10 scale-125" />
                            <div className="w-32 h-32 rounded-full border-2 border-success-500/30 bg-gradient-to-br from-surface-800 to-surface-900 flex items-center justify-center shadow-2xl shadow-success-500/10">
                                <ShieldCheck className="w-16 h-16 text-success-400" strokeWidth={1.5} />
                            </div>
                        </div>

                        <h1 className="text-4xl font-black tracking-tight mb-2">
                            <span className="bg-gradient-to-r from-success-400 to-teal-300 bg-clip-text text-transparent">
                                Đổi Mật Khẩu
                            </span>
                        </h1>
                        <p className="text-surface-400 text-sm font-medium text-center max-w-xs px-4">
                            Bảo vệ tài khoản của bạn với một mật khẩu mạnh và duy nhất
                        </p>

                        {/* Security tips */}
                        <div className="mt-10 space-y-3 max-w-xs w-full">
                            {[
                                { tip: 'Ít nhất 8 ký tự', met: newPassword.length >= 8 },
                                { tip: 'Kết hợp chữ hoa & chữ số', met: /[A-Z]/.test(newPassword) && /[0-9]/.test(newPassword) },
                                { tip: 'Không dùng thông tin cá nhân', met: true },
                            ].map(({ tip, met }) => (
                                <div key={tip} className="flex items-center gap-2.5 text-xs">
                                    <div className={`w-4 h-4 rounded-full flex items-center justify-center flex-shrink-0 transition-colors ${met && newPassword ? 'bg-success-500/20 text-success-400' : 'bg-surface-800 text-surface-600'}`}>
                                        {met && newPassword ? '✓' : '·'}
                                    </div>
                                    <span className={`transition-colors ${met && newPassword ? 'text-surface-300' : 'text-surface-500'}`}>{tip}</span>
                                </div>
                            ))}
                        </div>
                    </div>

                    <div className="absolute right-0 inset-y-0 w-px bg-gradient-to-b from-transparent via-success-500/20 to-transparent" />
                </div>

                {/* ── Right panel: Form ── */}
                <div className="flex-1 flex flex-col items-center justify-center p-6 sm:p-10">
                    <div className="w-full max-w-md">
                        {/* Back link */}
                        <Link
                            href="/employee/dashboard"
                            className="inline-flex items-center gap-1.5 text-surface-500 hover:text-surface-300 transition-colors text-sm mb-8 group"
                        >
                            <ArrowLeft className="w-4 h-4 group-hover:-translate-x-0.5 transition-transform" />
                            Quay lại trang chủ
                        </Link>

                        {/* Mobile icon */}
                        <div className="lg:hidden w-12 h-12 rounded-2xl bg-success-500/10 border border-success-500/20 flex items-center justify-center mb-6">
                            <ShieldCheck className="w-6 h-6 text-success-400" />
                        </div>

                        <div className="mb-8">
                            <h2 className="text-3xl font-bold text-white mb-1.5">Đổi Mật Khẩu</h2>
                            <p className="text-surface-400 text-sm">Cập nhật thông tin bảo mật tài khoản của bạn</p>
                        </div>

                        {success ? (
                            /* ── Success state ── */
                            <div className="text-center py-8 animate-in fade-in zoom-in-95 duration-300">
                                <div className="w-20 h-20 bg-success-500/15 rounded-full flex items-center justify-center mx-auto mb-5 border border-success-500/30">
                                    <CheckCircle2 className="w-10 h-10 text-success-400" />
                                </div>
                                <h3 className="text-xl font-bold text-white mb-2">Cập nhật thành công!</h3>
                                <p className="text-surface-400 text-sm">Đang chuyển hướng về trang chủ...</p>
                                <div className="mt-6 h-1 bg-surface-800 rounded-full overflow-hidden">
                                    <div className="h-full bg-gradient-to-r from-success-500 to-teal-400 rounded-full animate-[grow_2.5s_linear_forwards]" style={{ width: '100%', transformOrigin: 'left' }} />
                                </div>
                            </div>
                        ) : (
                            <form onSubmit={handleSubmit} className="space-y-4">
                                {error && (
                                    <div className="p-3.5 rounded-xl bg-danger-500/10 border border-danger-500/20 flex items-start gap-3 text-danger-400 text-sm">
                                        <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                                        <p>{error}</p>
                                    </div>
                                )}

                                {/* Current password */}
                                <div className="space-y-1.5">
                                    <label className="text-xs font-semibold text-surface-400 uppercase tracking-wider">
                                        Mật khẩu hiện tại
                                    </label>
                                    <div className="relative group">
                                        <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-surface-500 group-focus-within:text-primary-400 transition-colors">
                                            <KeyRound className="w-4 h-4" />
                                        </div>
                                        <input
                                            type={showCurrent ? 'text' : 'password'}
                                            required
                                            value={currentPassword}
                                            onChange={(e) => setCurrentPassword(e.target.value)}
                                            className="w-full bg-surface-900 border border-surface-800 text-surface-100 text-sm rounded-xl focus:ring-2 focus:ring-primary-500/30 focus:border-primary-500/60 block pl-10 pr-11 py-3 transition-all outline-none placeholder-surface-600"
                                            placeholder="••••••••"
                                        />
                                        <button type="button" onClick={() => setShowCurrent(v => !v)} className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-surface-500 hover:text-surface-300 transition-colors">
                                            {showCurrent ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                                        </button>
                                    </div>
                                </div>

                                {/* Divider */}
                                <div className="border-t border-surface-800 pt-2" />

                                {/* New password */}
                                <div className="space-y-1.5">
                                    <label className="text-xs font-semibold text-surface-400 uppercase tracking-wider">
                                        Mật khẩu mới
                                    </label>
                                    <div className="relative group">
                                        <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-surface-500 group-focus-within:text-primary-400 transition-colors">
                                            <Lock className="w-4 h-4" />
                                        </div>
                                        <input
                                            type={showNew ? 'text' : 'password'}
                                            required
                                            value={newPassword}
                                            onChange={(e) => setNewPassword(e.target.value)}
                                            className="w-full bg-surface-900 border border-surface-800 text-surface-100 text-sm rounded-xl focus:ring-2 focus:ring-primary-500/30 focus:border-primary-500/60 block pl-10 pr-11 py-3 transition-all outline-none placeholder-surface-600"
                                            placeholder="••••••••"
                                        />
                                        <button type="button" onClick={() => setShowNew(v => !v)} className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-surface-500 hover:text-surface-300 transition-colors">
                                            {showNew ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                                        </button>
                                    </div>
                                    {/* Strength bar */}
                                    {newPassword && (
                                        <div className="mt-2 space-y-1.5">
                                            <div className="flex gap-1">
                                                {Array.from({ length: 5 }).map((_, i) => (
                                                    <div
                                                        key={i}
                                                        className={`h-1 flex-1 rounded-full transition-all duration-300 ${i < strength ? strengthColor : 'bg-surface-800'}`}
                                                    />
                                                ))}
                                            </div>
                                            <p className="text-xs text-surface-500">
                                                Độ mạnh: <span className={`font-medium ${strength >= 4 ? 'text-success-400' : strength >= 2 ? 'text-warning-400' : 'text-danger-400'}`}>{strengthLabel}</span>
                                            </p>
                                        </div>
                                    )}
                                </div>

                                {/* Confirm password */}
                                <div className="space-y-1.5">
                                    <label className="text-xs font-semibold text-surface-400 uppercase tracking-wider">
                                        Xác nhận mật khẩu mới
                                    </label>
                                    <div className="relative group">
                                        <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-surface-500 group-focus-within:text-primary-400 transition-colors">
                                            <Lock className="w-4 h-4" />
                                        </div>
                                        <input
                                            type={showConfirm ? 'text' : 'password'}
                                            required
                                            value={confirmPassword}
                                            onChange={(e) => setConfirmPassword(e.target.value)}
                                            className={`w-full bg-surface-900 border text-surface-100 text-sm rounded-xl focus:ring-2 focus:border-primary-500/60 block pl-10 pr-11 py-3 transition-all outline-none placeholder-surface-600 ${
                                                confirmPassword
                                                    ? passwordsMatch
                                                        ? 'border-success-500/50 focus:ring-success-500/20'
                                                        : 'border-danger-500/50 focus:ring-danger-500/20'
                                                    : 'border-surface-800 focus:ring-primary-500/30'
                                            }`}
                                            placeholder="••••••••"
                                        />
                                        <button type="button" onClick={() => setShowConfirm(v => !v)} className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-surface-500 hover:text-surface-300 transition-colors">
                                            {showConfirm ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                                        </button>
                                    </div>
                                    {confirmPassword && !passwordsMatch && (
                                        <p className="text-xs text-danger-400 mt-1">Mật khẩu không khớp</p>
                                    )}
                                    {passwordsMatch && (
                                        <p className="text-xs text-success-400 mt-1 flex items-center gap-1">
                                            <CheckCircle2 className="w-3 h-3" /> Mật khẩu khớp
                                        </p>
                                    )}
                                </div>

                                {/* Submit */}
                                <button
                                    type="submit"
                                    disabled={loading}
                                    className="w-full mt-2 relative overflow-hidden bg-gradient-to-r from-success-600 to-teal-500 hover:from-success-500 hover:to-teal-400 text-white font-bold rounded-xl py-3.5 text-sm transition-all duration-300 disabled:opacity-60 disabled:cursor-not-allowed shadow-lg shadow-success-900/30 hover:shadow-success-500/30 hover:-translate-y-0.5 active:translate-y-0"
                                >
                                    <span className="relative flex items-center justify-center gap-2">
                                        {loading ? (
                                            <>
                                                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                                                Đang cập nhật...
                                            </>
                                        ) : (
                                            <>
                                                <ShieldCheck className="w-4 h-4" />
                                                Cập nhật Mật khẩu
                                            </>
                                        )}
                                    </span>
                                </button>
                            </form>
                        )}

                        <p className="text-center text-xs text-surface-600 mt-8">
                            © 2025 B.Duck Vietnam · Hệ thống quản lý nội bộ
                        </p>
                    </div>
                </div>
            </div>
        </AuthGuard>
    );
}
