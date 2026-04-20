'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Phone, Lock, LogIn, AlertCircle, Eye, EyeOff, Loader2 } from 'lucide-react';
import { useMobileTranslation } from '@/lib/i18n';
import MobileLanguageSwitcher from '@/components/mobile/MobileLanguageSwitcher';

export default function MobileLoginPage() {
    const [phone, setPhone] = useState('');
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [error, setError] = useState('');
    const [localLoading, setLocalLoading] = useState(false);
    const { user, userDoc, loading: authLoading, login } = useAuth();
    const { t } = useMobileTranslation();

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
                    setError(t('auth.invalidCredentials'));
                } else {
                    setError(err.message || t('auth.loginFailed'));
                }
            } else {
                setError(t('auth.unknownError'));
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
                    <p className="text-gray-500 text-xs">{t('auth.checkingSession')}</p>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gray-50 flex flex-col relative overflow-hidden">
            {/* ── Summer background ── */}
            <img
                src="/summer_backdrops.png"
                alt=""
                className="absolute inset-0 w-full h-full object-cover opacity-15 pointer-events-none"
                draggable={false}
            />

            {/* ── Language switcher — top right ── */}
            <div className="absolute top-4 right-4 z-20">
                <MobileLanguageSwitcher />
            </div>

            {/* ── Header branding ── */}
            <div className="flex-1 flex flex-col items-center justify-center px-6 pt-12 pb-6 relative z-10">
                {/* Logo */}
                <div className="mb-6">
                    <img
                        src="/summer_logo.png"
                        alt="B.Duck"
                        className="w-24 h-24 object-contain drop-shadow-lg"
                        draggable={false}
                    />
                </div>

                {/* Title */}
                <h1 className="text-xl font-black text-gray-800 mb-1">{t('auth.welcomeBack')}</h1>
                <p className="text-xs text-gray-500 mb-8">{t('auth.loginSubtitle')}</p>

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
                                {t('auth.phoneLabel')}
                            </label>
                            <div className="relative">
                                <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
                                <input
                                    type="text"
                                    required
                                    value={phone}
                                    onChange={e => setPhone(e.target.value)}
                                    className="w-full bg-white border border-gray-200 text-gray-800 text-sm rounded-xl pl-10 pr-4 py-3 outline-none focus:border-primary-400 focus:ring-2 focus:ring-primary-100 transition-all"
                                    placeholder={t('auth.phonePlaceholder')}
                                    autoComplete="tel"
                                />
                            </div>
                        </div>

                        {/* Password field */}
                        <div>
                            <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1 block">
                                {t('auth.passwordLabel')}
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
                                {t('auth.passwordHint')}
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
                                    {t('auth.loggingIn')}
                                </>
                            ) : (
                                <>
                                    <LogIn className="w-4 h-4" />
                                    {t('auth.loginButton')}
                                </>
                            )}
                        </button>
                    </form>
                </div>
            </div>

            {/* ── Footer ── */}
            <div className="pb-8 pt-4 text-center">
                <p className="text-[10px] text-gray-400">
                    {t('auth.copyright')}
                </p>
                <p className="text-[9px] text-gray-300 mt-0.5">
                    {t('auth.systemLabel')}
                </p>
            </div>
        </div>
    );
}
