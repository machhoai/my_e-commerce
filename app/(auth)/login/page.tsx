'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { Phone, Lock, LogIn, AlertCircle } from 'lucide-react';
import { getRoleDefaultRoute, parseLastVisitedPath } from '@/lib/routing';

/**
 * Resolves the redirect destination after successful login.
 * Priority: last_visited_path cookie → userDoc.defaultDashboard → role-based fallback.
 */
function resolveRedirectDestination(
    role: string,
    workplaceType: string | undefined,
    defaultDashboard: string | undefined
): string {
    // 1. Last visited page (client-readable cookie)
    if (typeof document !== 'undefined') {
        const lastVisited = parseLastVisitedPath(document.cookie);
        if (lastVisited) return lastVisited;
    }
    // 2. User-configured default dashboard
    if (defaultDashboard) return defaultDashboard;
    // 3. Role-based fallback
    return getRoleDefaultRoute(role, workplaceType);
}

export default function LoginPage() {
    const [phone, setPhone] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [localLoading, setLocalLoading] = useState(false);
    const { user, userDoc, loading: authLoading, login } = useAuth();
    const router = useRouter();

    // Auto-redirect if user is already authenticated.
    // This is critical for iOS PWA: when the OS restores the standalone
    // WebView, the user may land on /login even though they're still
    // authenticated (via IndexedDB or session cookie recovery).
    // The middleware handles the fast-path redirect for server-rendered hits,
    // but this useEffect covers the client-hydration path.
    useEffect(() => {
        if (authLoading) return;
        if (user && userDoc) {
            const destination = resolveRedirectDestination(
                userDoc.role,
                userDoc.workplaceType,
                userDoc.defaultDashboard
            );
            router.replace(destination);
        }
    }, [user, userDoc, authLoading, router]);

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        setLocalLoading(true);

        try {
            await login(phone, password);
            // userDoc will be populated by onAuthStateChanged → fetchUserDoc,
            // but we can't await it here. The useEffect above will fire once
            // userDoc is ready and handle the navigation.
            // As a safety-net for the edge case where userDoc is already set
            // (e.g., re-login), we also push to the employee dashboard fallback
            // — the useEffect will override this if a better destination exists.
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

    // Show loading spinner while auth state is being determined.
    // This prevents flashing the login form before the redirect kicks in.
    if (authLoading || (user && userDoc)) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-surface-950">
                <div className="flex flex-col items-center gap-3">
                    <div className="w-10 h-10 border-4 border-primary-500 border-t-transparent rounded-full animate-spin" />
                    <p className="text-surface-400 text-sm">Đang kiểm tra phiên đăng nhập...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen flex items-center justify-center bg-surface-950 p-4">
            <div className="max-w-md w-full backdrop-blur-xl bg-surface-900/60 border border-surface-800 rounded-2xl shadow-2xl overflow-hidden text-surface-200">
                <div className="px-8 pt-8 pb-6 text-center border-b border-surface-800">
                    <div className="w-16 h-16 bg-primary-500/10 text-primary-400 rounded-full flex items-center justify-center mx-auto mb-4 border border-primary-500/20">
                        <LogIn className="w-8 h-8" />
                    </div>
                    <h1 className="text-2xl font-bold bg-gradient-to-r from-primary-400 to-accent-400 bg-clip-text text-transparent">
                        Chào Mừng Trở Lại
                    </h1>
                    <p className="text-surface-400 mt-2 text-sm">
                        Đăng nhập vào hệ thống quản lý ca làm
                    </p>
                </div>

                <div className="p-8">
                    <form onSubmit={handleLogin} className="space-y-5">
                        {error && (
                            <div className="p-3 rounded-lg bg-danger-500/10 border border-danger-500/20 flex items-start gap-3 text-danger-400 text-sm">
                                <AlertCircle className="w-5 h-5 shrink-0" />
                                <p>{error}</p>
                            </div>
                        )}

                        <div className="space-y-1.5">
                            <label className="text-sm font-medium text-surface-300 ml-1">Số điện thoại</label>
                            <div className="relative">
                                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-surface-500">
                                    <Phone className="w-4 h-4" />
                                </div>
                                <input
                                    type="text"
                                    required
                                    value={phone}
                                    onChange={(e) => setPhone(e.target.value)}
                                    className="w-full bg-surface-950 border border-surface-800 text-surface-200 text-sm rounded-lg focus:ring-primary-500 focus:border-primary-500 block pl-10 p-2.5 transition-colors"
                                    placeholder="0912345678"
                                />
                            </div>
                        </div>

                        <div className="space-y-1.5">
                            <label className="text-sm font-medium text-surface-300 ml-1">Mật khẩu</label>
                            <div className="relative">
                                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-surface-500">
                                    <Lock className="w-4 h-4" />
                                </div>
                                <input
                                    type="password"
                                    required
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    className="w-full bg-surface-950 border border-surface-800 text-surface-200 text-sm rounded-lg focus:ring-primary-500 focus:border-primary-500 block pl-10 p-2.5 transition-colors"
                                    placeholder="••••••••"
                                />
                                <p className="text-xs text-surface-500 ml-1 mt-1">
                                    Mật khẩu mặc định là 6 số cuối số điện thoại của bạn
                                </p>
                            </div>
                        </div>

                        <button
                            type="submit"
                            disabled={localLoading}
                            className="w-full text-white bg-primary-600 hover:bg-primary-700 focus:ring-4 focus:outline-none focus:ring-primary-800 font-medium rounded-lg text-sm px-5 py-3 text-center transition-all disabled:opacity-50 disabled:cursor-not-allowed mt-4 shadow-lg shadow-primary-900/20"
                        >
                            {localLoading ? 'Đang đăng nhập...' : 'Đăng nhập'}
                        </button>
                    </form>
                </div>
            </div>
        </div>
    );
}
