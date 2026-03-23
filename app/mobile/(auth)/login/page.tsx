'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Phone, Lock, LogIn, AlertCircle, Eye, EyeOff, Loader2 } from 'lucide-react';

export default function MobileLoginPage() {
    const [phone, setPhone] = useState('');
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [error, setError] = useState('');
    const [localLoading, setLocalLoading] = useState(false);
    const { user, userDoc, loading: authLoading, login } = useAuth();

    useEffect(() => {
        if (authLoading) return;
        if (user && userDoc) {
            // Use hard redirect so middleware handles device-based rewrite properly
            window.location.replace('/dashboard');
        }
    }, [user, userDoc, authLoading]);

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        setLocalLoading(true);
        try {
            await login(phone, password);
        } catch (err: unknown) {
            if (err instanceof Error) {
                if (err.message.includes('auth/invalid-credential')) {
                    setError('Sai số điện thoại hoặc mật khẩu');
                } else {
                    setError(err.message || 'Đăng nhập thất bại');
                }
            } else {
                setError('Đã xảy ra lỗi không xác định');
            }
        } finally {
            setLocalLoading(false);
        }
    };

    // ── Loading / redirect spinner ──
    if (authLoading || (user && userDoc)) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-white">
                <div className="flex flex-col items-center gap-3">
                    <div className="w-8 h-8 border-2 border-primary-200 border-t-primary-600 rounded-full animate-spin" />
                    <p className="text-gray-500 text-xs">Đang kiểm tra phiên đăng nhập...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gray-50 flex flex-col">
            {/* ── Header branding ── */}
            <div className="flex-1 flex flex-col items-center justify-center px-6 pt-12 pb-6">
                {/* Logo */}
                <div className="mb-6">
                    <img
                        src="/bduck.png"
                        alt="B.Duck"
                        className="w-20 h-20 object-contain"
                        draggable={false}
                    />
                </div>

                {/* Title */}
                <h1 className="text-xl font-black text-gray-800 mb-1">Chào mừng trở lại 👋</h1>
                <p className="text-xs text-gray-500 mb-8">Đăng nhập để tiếp tục vào hệ thống</p>

                {/* ── Form ── */}
                <div className="w-full max-w-sm">
                    {/* Error */}
                    {error && (
                        <div className="mb-4 flex items-start gap-2 bg-red-50 border border-red-200 rounded-xl px-3 py-2.5 text-red-600 text-xs">
                            <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                            <p className="font-medium">{error}</p>
                        </div>
                    )}

                    <form onSubmit={handleLogin} className="space-y-3">
                        {/* Phone field */}
                        <div>
                            <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1 block">
                                Số điện thoại
                            </label>
                            <div className="relative">
                                <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
                                <input
                                    type="text"
                                    required
                                    value={phone}
                                    onChange={e => setPhone(e.target.value)}
                                    className="w-full bg-white border border-gray-200 text-gray-800 text-sm rounded-xl pl-10 pr-4 py-3 outline-none focus:border-primary-400 focus:ring-2 focus:ring-primary-100 transition-all"
                                    placeholder="0912 345 678"
                                    autoComplete="tel"
                                />
                            </div>
                        </div>

                        {/* Password field */}
                        <div>
                            <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1 block">
                                Mật khẩu
                            </label>
                            <div className="relative">
                                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
                                <input
                                    type={showPassword ? 'text' : 'password'}
                                    required
                                    value={password}
                                    onChange={e => setPassword(e.target.value)}
                                    className="w-full bg-white border border-gray-200 text-gray-800 text-sm rounded-xl pl-10 pr-11 py-3 outline-none focus:border-primary-400 focus:ring-2 focus:ring-primary-100 transition-all"
                                    placeholder="••••••••"
                                    autoComplete="current-password"
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowPassword(v => !v)}
                                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 active:text-gray-600"
                                >
                                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                                </button>
                            </div>
                            <p className="text-[10px] text-gray-400 mt-1 ml-1">
                                Mật khẩu mặc định: 6 số cuối số điện thoại
                            </p>
                        </div>

                        {/* Submit */}
                        <button
                            type="submit"
                            disabled={localLoading}
                            className="w-full mt-2 bg-primary-600 hover:bg-primary-700 text-white font-bold rounded-xl py-3.5 text-sm transition-all disabled:opacity-60 shadow-md shadow-primary-200 active:scale-[0.98] flex items-center justify-center gap-2"
                        >
                            {localLoading ? (
                                <>
                                    <Loader2 className="w-4 h-4 animate-spin" />
                                    Đang đăng nhập...
                                </>
                            ) : (
                                <>
                                    <LogIn className="w-4 h-4" />
                                    Đăng nhập
                                </>
                            )}
                        </button>
                    </form>
                </div>
            </div>

            {/* ── Footer ── */}
            <div className="pb-8 pt-4 text-center">
                <p className="text-[10px] text-gray-400">
                    © 2026 B.Duck Cityfuns Vietnam
                </p>
                <p className="text-[9px] text-gray-300 mt-0.5">
                    Hệ thống quản lý nội bộ
                </p>
            </div>
        </div>
    );
}
