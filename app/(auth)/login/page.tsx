'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { Phone, Lock, LogIn, AlertCircle } from 'lucide-react';

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
    useEffect(() => {
        if (authLoading) return; // Wait for onAuthStateChanged to resolve
        if (user && userDoc) {
            // Redirect based on role
            const roleRoutes: Record<string, string> = {
                admin: '/admin/users',
                store_manager: '/admin/users',
                manager: '/manager/scheduling/overview',
                employee: '/employee/dashboard',
            };
            router.replace(roleRoutes[userDoc.role] || '/employee/dashboard');
        }
    }, [user, userDoc, authLoading, router]);

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        setLocalLoading(true);

        try {
            await login(phone, password);
            router.push('/employee/dashboard'); // Default redirect
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
            <div className="min-h-screen flex items-center justify-center bg-slate-950">
                <div className="flex flex-col items-center gap-3">
                    <div className="w-10 h-10 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
                    <p className="text-slate-400 text-sm">Đang kiểm tra phiên đăng nhập...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen flex items-center justify-center bg-slate-950 p-4">
            <div className="max-w-md w-full backdrop-blur-xl bg-slate-900/60 border border-slate-800 rounded-2xl shadow-2xl overflow-hidden text-slate-200">
                <div className="px-8 pt-8 pb-6 text-center border-b border-slate-800">
                    <div className="w-16 h-16 bg-blue-500/10 text-blue-400 rounded-full flex items-center justify-center mx-auto mb-4 border border-blue-500/20">
                        <LogIn className="w-8 h-8" />
                    </div>
                    <h1 className="text-2xl font-bold bg-gradient-to-r from-blue-400 to-indigo-400 bg-clip-text text-transparent">
                        Chào Mừng Trở Lại
                    </h1>
                    <p className="text-slate-400 mt-2 text-sm">
                        Đăng nhập vào hệ thống quản lý ca làm
                    </p>
                </div>

                <div className="p-8">
                    <form onSubmit={handleLogin} className="space-y-5">
                        {error && (
                            <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20 flex items-start gap-3 text-red-400 text-sm">
                                <AlertCircle className="w-5 h-5 shrink-0" />
                                <p>{error}</p>
                            </div>
                        )}

                        <div className="space-y-1.5">
                            <label className="text-sm font-medium text-slate-300 ml-1">Số điện thoại</label>
                            <div className="relative">
                                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-500">
                                    <Phone className="w-4 h-4" />
                                </div>
                                <input
                                    type="text"
                                    required
                                    value={phone}
                                    onChange={(e) => setPhone(e.target.value)}
                                    className="w-full bg-slate-950 border border-slate-800 text-slate-200 text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 block pl-10 p-2.5 transition-colors"
                                    placeholder="0912345678"
                                />
                            </div>
                        </div>

                        <div className="space-y-1.5">
                            <label className="text-sm font-medium text-slate-300 ml-1">Mật khẩu</label>
                            <div className="relative">
                                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-500">
                                    <Lock className="w-4 h-4" />
                                </div>
                                <input
                                    type="password"
                                    required
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    className="w-full bg-slate-950 border border-slate-800 text-slate-200 text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 block pl-10 p-2.5 transition-colors"
                                    placeholder="••••••••"
                                />
                            </div>
                            <p className="text-xs text-slate-500 ml-1 mt-1">
                                Mật khẩu mặc định là 6 số cuối số điện thoại của bạn
                            </p>
                        </div>

                        <button
                            type="submit"
                            disabled={localLoading}
                            className="w-full text-white bg-blue-600 hover:bg-blue-700 focus:ring-4 focus:outline-none focus:ring-blue-800 font-medium rounded-lg text-sm px-5 py-3 text-center transition-all disabled:opacity-50 disabled:cursor-not-allowed mt-4 shadow-lg shadow-blue-900/20"
                        >
                            {localLoading ? 'Đang đăng nhập...' : 'Đăng nhập'}
                        </button>
                    </form>
                </div>
            </div>
        </div>
    );
}
