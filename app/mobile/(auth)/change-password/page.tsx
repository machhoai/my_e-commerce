'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { cn } from '@/lib/utils';
import {
    KeyRound, ShieldCheck, AlertCircle, ArrowLeft, Lock, Eye, EyeOff,
    CheckCircle2, Loader2,
} from 'lucide-react';
import Link from 'next/link';
import AuthGuard from '@/components/layout/AuthGuard';
import { useMobileTranslation } from '@/lib/i18n';

export default function MobileChangePasswordPage() {
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
    const { t } = useMobileTranslation();

    // Password strength
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

    const strengthLabel = ['', t('auth.strengthWeak'), t('auth.strengthFair'), t('auth.strengthGood'), t('auth.strengthStrong'), t('auth.strengthVeryStrong')][strength] ?? '';
    const strengthColors = ['', 'bg-red-500', 'bg-amber-500', 'bg-amber-400', 'bg-emerald-500', 'bg-emerald-400'];
    const passwordsMatch = newPassword && confirmPassword && newPassword === confirmPassword;

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        if (newPassword !== confirmPassword) return setError(t('auth.passwordMismatch'));
        if (newPassword.length < 6) return setError(t('auth.passwordTooShort'));

        setLoading(true);
        try {
            await changePassword(currentPassword, newPassword);
            setSuccess(true);
            setTimeout(() => router.push('/dashboard'), 2000);
        } catch (err: unknown) {
            if (err instanceof Error) {
                setError(err.message.includes('auth/invalid-credential') ? t('auth.wrongCurrentPassword') : err.message || t('auth.changePasswordFailed'));
            } else { setError(t('auth.unknownError')); }
        } finally { setLoading(false); }
    };

    return (
        <AuthGuard>
            <div className="min-h-screen bg-gray-50 flex flex-col">
                {/* Header */}
                <div className="sticky top-0 z-10 bg-white border-b border-gray-100 px-4 py-3 flex items-center gap-3">
                    <Link href="/dashboard" className="w-8 h-8 rounded-lg bg-gray-100 flex items-center justify-center active:scale-95 transition-transform">
                        <ArrowLeft className="w-4 h-4 text-gray-600" />
                    </Link>
                    <h1 className="text-sm font-bold text-gray-800">{t('auth.changePassword')}</h1>
                </div>

                <div className="flex-1 px-4 py-6">
                    {/* Icon + subtitle */}
                    <div className="flex flex-col items-center mb-6">
                        <div className="w-14 h-14 rounded-full bg-emerald-50 flex items-center justify-center mb-3">
                            <ShieldCheck className="w-6 h-6 text-emerald-500" />
                        </div>
                        <p className="text-xs text-gray-500 text-center">{t('auth.protectAccount')}</p>
                    </div>

                    {success ? (
                        <div className="text-center py-8">
                            <div className="w-16 h-16 bg-emerald-50 rounded-full flex items-center justify-center mx-auto mb-4 border border-emerald-200">
                                <CheckCircle2 className="w-8 h-8 text-emerald-500" />
                            </div>
                            <h3 className="text-sm font-bold text-gray-800 mb-1">{t('auth.passwordUpdated')}</h3>
                            <p className="text-xs text-gray-500">{t('auth.redirecting')}</p>
                        </div>
                    ) : (
                        <form onSubmit={handleSubmit} className="space-y-4 max-w-sm mx-auto w-full">
                            {error && (
                                <div className="flex items-start gap-2 bg-red-50 border border-red-200 rounded-xl px-3 py-2.5 text-red-600 text-xs">
                                    <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                                    <p className="font-medium">{error}</p>
                                </div>
                            )}

                            {/* Current password */}
                            <div>
                                <label className="text-[10px] font-bold text-gray-500 uppercase mb-1 block">{t('auth.currentPassword')}</label>
                                <div className="relative">
                                    <KeyRound className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
                                    <input type={showCurrent ? 'text' : 'password'} required value={currentPassword}
                                        onChange={e => setCurrentPassword(e.target.value)}
                                        className="w-full bg-white border border-gray-200 text-gray-800 text-sm rounded-xl pl-10 pr-11 py-3 outline-none focus:border-primary-400 focus:ring-2 focus:ring-primary-100"
                                        placeholder="••••••••" />
                                    <button type="button" onClick={() => setShowCurrent(v => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400">
                                        {showCurrent ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                                    </button>
                                </div>
                            </div>

                            <div className="border-t border-gray-100" />

                            {/* New password */}
                            <div>
                                <label className="text-[10px] font-bold text-gray-500 uppercase mb-1 block">{t('auth.newPassword')}</label>
                                <div className="relative">
                                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
                                    <input type={showNew ? 'text' : 'password'} required value={newPassword}
                                        onChange={e => setNewPassword(e.target.value)}
                                        className="w-full bg-white border border-gray-200 text-gray-800 text-sm rounded-xl pl-10 pr-11 py-3 outline-none focus:border-primary-400 focus:ring-2 focus:ring-primary-100"
                                        placeholder="••••••••" />
                                    <button type="button" onClick={() => setShowNew(v => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400">
                                        {showNew ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                                    </button>
                                </div>
                                {newPassword && (
                                    <div className="mt-2">
                                        <div className="flex gap-1">
                                            {Array.from({ length: 5 }).map((_, i) => (
                                                <div key={i} className={cn('h-1 flex-1 rounded-full transition-all', i < strength ? strengthColors[strength] : 'bg-gray-200')} />
                                            ))}
                                        </div>
                                        <p className="text-[10px] text-gray-500 mt-1">
                                            {t('auth.passwordStrength')}: <span className={cn('font-bold', strength >= 4 ? 'text-emerald-500' : strength >= 2 ? 'text-amber-500' : 'text-red-500')}>{strengthLabel}</span>
                                        </p>
                                    </div>
                                )}
                            </div>

                            {/* Confirm password */}
                            <div>
                                <label className="text-[10px] font-bold text-gray-500 uppercase mb-1 block">{t('auth.confirmNewPassword')}</label>
                                <div className="relative">
                                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
                                    <input type={showConfirm ? 'text' : 'password'} required value={confirmPassword}
                                        onChange={e => setConfirmPassword(e.target.value)}
                                        className={cn('w-full bg-white border text-gray-800 text-sm rounded-xl pl-10 pr-11 py-3 outline-none focus:ring-2 transition-all',
                                            confirmPassword ? (passwordsMatch ? 'border-emerald-300 focus:ring-emerald-100' : 'border-red-300 focus:ring-red-100') : 'border-gray-200 focus:ring-primary-100 focus:border-primary-400')}
                                        placeholder="••••••••" />
                                    <button type="button" onClick={() => setShowConfirm(v => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400">
                                        {showConfirm ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                                    </button>
                                </div>
                                {confirmPassword && !passwordsMatch && <p className="text-[10px] text-red-500 mt-1 ml-1">{t('auth.passwordNotMatch')}</p>}
                                {passwordsMatch && <p className="text-[10px] text-emerald-500 mt-1 ml-1 flex items-center gap-0.5"><CheckCircle2 className="w-2.5 h-2.5" /> {t('auth.passwordMatch')}</p>}
                            </div>

                            {/* Submit */}
                            <button type="submit" disabled={loading}
                                className="w-full mt-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl py-3.5 text-sm transition-all disabled:opacity-60 shadow-md shadow-emerald-200 active:scale-[0.98] flex items-center justify-center gap-2">
                                {loading ? (
                                    <><Loader2 className="w-4 h-4 animate-spin" /> {t('auth.updating')}</>
                                ) : (
                                    <><ShieldCheck className="w-4 h-4" /> {t('auth.updatePassword')}</>
                                )}
                            </button>
                        </form>
                    )}
                </div>
            </div>
        </AuthGuard>
    );
}
