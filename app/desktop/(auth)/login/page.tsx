'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Phone, Lock, LogIn, AlertCircle, Eye, EyeOff } from 'lucide-react';


export default function LoginPage() {
    const [phone, setPhone] = useState('');
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [error, setError] = useState('');
    const [localLoading, setLocalLoading] = useState(false);
    const { user, userDoc, loading: authLoading, login } = useAuth();

    useEffect(() => {
        if (authLoading) return;
        if (user && userDoc) {
            window.location.replace('/dashboard');
        }
    }, [user, userDoc, authLoading]);

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        setLocalLoading(true);
        try {
            await login(phone, password);
            // ✅ Tidak redirect cứng ở đây.
            // useEffect bên trên sẽ tự redirect đúng trang theo role
            // khi user + userDoc được load xong từ AuthContext.
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
            <div className="min-h-screen flex items-center justify-center bg-surface-950">
                <div className="flex flex-col items-center gap-3">
                    <div className="relative w-12 h-12">
                        <div className="absolute inset-0 rounded-full border-2 border-primary-500/20" />
                        <div className="absolute inset-0 rounded-full border-2 border-primary-500 border-t-transparent animate-spin" />
                    </div>
                    <p className="text-surface-400 text-sm">Đang kiểm tra phiên đăng nhập...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen flex">

            <img
                src="/summer_backdrops.png"
                alt="B.Duck Cityfuns"
                className="absolute inset-0 w-full h-full object-cover object-center"
                draggable={false}
            />

            {/* Dark gradient overlay — heavier at bottom so text reads */}
            <div className="absolute inset-0 bg-black/50" />

            {/* ══════════════════════════════════════
                RIGHT PANEL — Login form
            ══════════════════════════════════════ */}
            <div className="flex-1 flex flex-col items-center justify-center p-6 sm:p-10 relative">

                {/* Subtle background glow */}
                <div className="absolute top-0 right-0 w-96 h-96 rounded-full bg-primary-500/5 blur-3xl pointer-events-none" />
                <div className="absolute bottom-0 left-0 w-64 h-64 rounded-full bg-accent-500/5 blur-3xl pointer-events-none" />

                <div className="w-full max-w-sm relative z-10">

                    {/* Brand mark — shown always on mobile, hidden on lg (left panel shows logo) */}
                    <div className="flex flex-col items-center mb-8 lg:mb-10">
                        <img
                            src="/summer_logo.png"
                            alt="B.Duck"
                            className="w-40 h-40 object-contain rounded-3xl"
                            draggable={false}
                        />
                        {/* Only visible on mobile where left panel is hidden */}
                        <span className="lg:hidden mt-2 text-lg font-black text-white tracking-tight">
                            B.Duck Cityfuns Vietnam
                        </span>
                    </div>

                    {/* Heading */}
                    <div className="mb-7 text-center">
                        <h1 className="text-2xl font-bold text-white mb-1">Chào mừng trở lại 👋</h1>
                        <p className="text-surface-400 text-sm">Đăng nhập để tiếp tục vào hệ thống</p>
                    </div>

                    {/* Error */}
                    {error && (
                        <div className="mb-5 p-3.5 rounded-xl bg-danger-500/10 border border-danger-500/20 flex items-start gap-3 text-danger-400 text-sm">
                            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                            <p>{error}</p>
                        </div>
                    )}

                    <form onSubmit={handleLogin} className="space-y-4">

                        {/* Phone */}
                        <div className="space-y-1.5">
                            <label className="text-xs font-semibold text-surface-200 uppercase tracking-wider">
                                Số điện thoại
                            </label>
                            <div className="relative group">
                                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-surface-500 group-focus-within:text-primary-400 transition-colors">
                                    <Phone className="w-4 h-4" />
                                </div>
                                <input
                                    type="text"
                                    required
                                    value={phone}
                                    onChange={(e) => setPhone(e.target.value)}
                                    className="w-full bg-surface-900 border border-surface-800 text-surface-100 text-sm rounded-xl focus:ring-2 focus:ring-primary-500/30 focus:border-primary-500/60 block pl-10 pr-4 py-3 transition-all outline-none placeholder-surface-600"
                                    placeholder="0912 345 678"
                                    autoComplete="tel"
                                />
                            </div>
                        </div>

                        {/* Password */}
                        <div className="space-y-1.5">
                            <label className="text-xs font-semibold text-surface-200 uppercase tracking-wider">
                                Mật khẩu
                            </label>
                            <div className="relative group">
                                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-surface-500 group-focus-within:text-primary-400 transition-colors">
                                    <Lock className="w-4 h-4" />
                                </div>
                                <input
                                    type={showPassword ? 'text' : 'password'}
                                    required
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    className="w-full bg-surface-900 border border-surface-800 text-surface-100 text-sm rounded-xl focus:ring-2 focus:ring-primary-500/30 focus:border-primary-500/60 block pl-10 pr-11 py-3 transition-all outline-none placeholder-surface-600"
                                    placeholder="••••••••"
                                    autoComplete="current-password"
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowPassword(v => !v)}
                                    className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-surface-500 hover:text-surface-300 transition-colors"
                                >
                                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                                </button>
                            </div>
                            <p className="text-xs text-surface-300 mt-1">
                                Mật khẩu mặc định: 6 số cuối số điện thoại
                            </p>
                        </div>

                        {/* Submit */}
                        <button
                            type="submit"
                            disabled={localLoading}
                            className="w-full mt-2 bg-gradient-to-r from-primary-500 to-primary-400 hover:from-primary-400 hover:to-accent-400 text-surface-950 font-bold rounded-xl py-3.5 text-sm transition-all duration-300 disabled:opacity-60 disabled:cursor-not-allowed shadow-lg shadow-primary-500/20 hover:shadow-primary-500/40 hover:-translate-y-0.5 active:translate-y-0 flex items-center justify-center gap-2"
                        >
                            {localLoading ? (
                                <>
                                    <div className="w-4 h-4 border-2 border-surface-900 border-t-transparent rounded-full animate-spin" />
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

                    <p className="text-center text-xs text-white/50 mt-8">
                        © 2026 B.Duck Cityfuns Vietnam · Hệ thống quản lý nội bộ
                    </p>
                </div>
            </div>
        </div>
    );
}
