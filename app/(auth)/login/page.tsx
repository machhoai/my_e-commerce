'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { Phone, Lock, LogIn, AlertCircle, Eye, EyeOff } from 'lucide-react';
import { getRoleDefaultRoute, parseLastVisitedPath } from '@/lib/routing';

/**
 * Resolves the redirect destination after successful login.
 * Priority: last_visited_path cookie → userDoc.defaultDashboard → roleDoc.defaultRoute → role-based fallback.
 */
function resolveRedirectDestination(
    role: string,
    workplaceType: string | undefined,
    defaultDashboard: string | undefined,
    roleDefaultRoute: string | null
): string {
    if (typeof document !== 'undefined') {
        const lastVisited = parseLastVisitedPath(document.cookie);
        if (lastVisited) return lastVisited;
    }
    if (defaultDashboard) return defaultDashboard;
    if (roleDefaultRoute) return roleDefaultRoute;
    return getRoleDefaultRoute(role, workplaceType);
}

export default function LoginPage() {
    const [phone, setPhone] = useState('');
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [error, setError] = useState('');
    const [localLoading, setLocalLoading] = useState(false);
    const { user, userDoc, loading: authLoading, login, roleDefaultRoute } = useAuth();
    const router = useRouter();

    useEffect(() => {
        if (authLoading) return;
        if (user && userDoc) {
            const destination = resolveRedirectDestination(
                userDoc.role,
                userDoc.workplaceType,
                userDoc.defaultDashboard,
                roleDefaultRoute
            );
            router.replace(destination);
        }
    }, [user, userDoc, authLoading, router, roleDefaultRoute]);

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        setLocalLoading(true);
        try {
            await login(phone, password);
            router.push('/employee/dashboard');
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

            {/* ══════════════════════════════════════
                LEFT PANEL — Artboard background
            ══════════════════════════════════════ */}
            <div className="hidden lg:flex lg:w-[55%] relative flex-col items-center justify-end pb-16 overflow-hidden">

                {/* Full-cover artboard image */}
                <img
                    src="/Artboard.png"
                    alt="B.Duck Cityfuns"
                    className="absolute inset-0 w-full h-full object-cover object-center"
                    draggable={false}
                />

                {/* Dark gradient overlay — heavier at bottom so text reads */}
                <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />
                {/* Left-to-right fade to blend into right panel */}
                <div className="absolute inset-0 bg-gradient-to-r from-transparent via-transparent to-black/60" />

                {/* Logo centred vertically */}
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-6 z-10">
                    <img
                        src="/logo.png"
                        alt="B.Duck Cityfuns Vietnam"
                        className="w-64 xl:w-72 object-contain drop-shadow-2xl"
                        draggable={false}
                    />
                    {/* Feature pills */}
                    <div className="flex flex-wrap justify-center gap-2 max-w-xs">
                        {['Quản lý ca làm', 'Kho hàng', 'Nhân sự', 'Doanh thu'].map(feat => (
                            <span
                                key={feat}
                                className="px-3 py-1 rounded-full bg-black/30 backdrop-blur-sm border border-white/20 text-white/80 text-xs font-medium"
                            >
                                {feat}
                            </span>
                        ))}
                    </div>
                </div>

                {/* Bottom caption */}
                <p className="relative z-10 text-white/50 text-xs tracking-widest uppercase">
                    Hệ thống quản lý nội bộ
                </p>
            </div>

            {/* ══════════════════════════════════════
                RIGHT PANEL — Login form
            ══════════════════════════════════════ */}
            <div className="flex-1 flex flex-col items-center justify-center bg-surface-950 p-6 sm:p-10 relative">

                {/* Subtle background glow */}
                <div className="absolute top-0 right-0 w-96 h-96 rounded-full bg-primary-500/5 blur-3xl pointer-events-none" />
                <div className="absolute bottom-0 left-0 w-64 h-64 rounded-full bg-accent-500/5 blur-3xl pointer-events-none" />

                <div className="w-full max-w-sm relative z-10">

                    {/* Brand mark — shown always on mobile, hidden on lg (left panel shows logo) */}
                    <div className="flex flex-col items-center mb-8 lg:mb-10">
                        <img
                            src="/bduck.png"
                            alt="B.Duck"
                            className="w-20 h-20 object-contain"
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
                            <label className="text-xs font-semibold text-surface-400 uppercase tracking-wider">
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
                            <label className="text-xs font-semibold text-surface-400 uppercase tracking-wider">
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
                            <p className="text-xs text-surface-600 mt-1">
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

                    <p className="text-center text-xs text-surface-600 mt-8">
                        © 2026 B.Duck Cityfuns Vietnam · Hệ thống quản lý nội bộ
                    </p>
                </div>
            </div>
        </div>
    );
}
