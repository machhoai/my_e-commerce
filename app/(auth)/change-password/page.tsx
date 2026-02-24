'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { KeyRound, ShieldCheck, AlertCircle, ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import AuthGuard from '@/components/layout/AuthGuard';

export default function ChangePasswordPage() {
    const [currentPassword, setCurrentPassword] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [error, setError] = useState('');
    const [success, setSuccess] = useState(false);
    const [loading, setLoading] = useState(false);

    const { changePassword } = useAuth();
    const router = useRouter();

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');

        if (newPassword !== confirmPassword) {
            return setError('New passwords do not match');
        }

        if (newPassword.length < 6) {
            return setError('New password must be at least 6 characters');
        }

        setLoading(true);

        try {
            await changePassword(currentPassword, newPassword);
            setSuccess(true);
            setTimeout(() => {
                router.push('/employee/dashboard');
            }, 2000);
        } catch (err: unknown) {
            if (err instanceof Error) {
                if (err.message.includes('auth/invalid-credential')) {
                    setError('Incorrect current password');
                } else {
                    setError(err.message || 'Failed to change password');
                }
            } else {
                setError('An unknown error occurred');
            }
        } finally {
            setLoading(false);
        }
    };

    return (
        <AuthGuard>
            <div className="min-h-screen flex items-center justify-center bg-slate-950 p-4">
                <div className="max-w-md w-full backdrop-blur-xl bg-slate-900/60 border border-slate-800 rounded-2xl shadow-2xl overflow-hidden text-slate-200">
                    <div className="px-8 pt-8 pb-6 text-center border-b border-slate-800 relative">
                        <Link
                            href="/employee/dashboard"
                            className="absolute left-6 top-8 text-slate-400 hover:text-white transition-colors flex items-center gap-1 text-sm font-medium"
                        >
                            <ArrowLeft className="w-4 h-4" /> Back
                        </Link>
                        <div className="w-16 h-16 bg-emerald-500/10 text-emerald-400 rounded-full flex items-center justify-center mx-auto mb-4 border border-emerald-500/20">
                            <ShieldCheck className="w-8 h-8" />
                        </div>
                        <h1 className="text-2xl font-bold bg-gradient-to-r from-emerald-400 to-teal-400 bg-clip-text text-transparent">
                            Change Password
                        </h1>
                        <p className="text-slate-400 mt-2 text-sm">
                            Update your account security credentials
                        </p>
                    </div>

                    <div className="p-8">
                        {success ? (
                            <div className="text-center py-6">
                                <div className="w-16 h-16 bg-green-500/20 text-green-500 rounded-full flex items-center justify-center mx-auto mb-4">
                                    <ShieldCheck className="w-8 h-8" />
                                </div>
                                <h3 className="text-lg font-medium text-white mb-2">Password Updated!</h3>
                                <p className="text-slate-400 text-sm">Redirecting you to dashboard...</p>
                            </div>
                        ) : (
                            <form onSubmit={handleSubmit} className="space-y-5">
                                {error && (
                                    <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20 flex items-start gap-3 text-red-400 text-sm">
                                        <AlertCircle className="w-5 h-5 shrink-0" />
                                        <p>{error}</p>
                                    </div>
                                )}

                                <div className="space-y-1.5">
                                    <label className="text-sm font-medium text-slate-300 ml-1">Current Password</label>
                                    <div className="relative">
                                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-500">
                                            <KeyRound className="w-4 h-4" />
                                        </div>
                                        <input
                                            type="password"
                                            required
                                            value={currentPassword}
                                            onChange={(e) => setCurrentPassword(e.target.value)}
                                            className="w-full bg-slate-950 border border-slate-800 text-slate-200 text-sm rounded-lg focus:ring-emerald-500 focus:border-emerald-500 block pl-10 p-2.5 transition-colors"
                                            placeholder="••••••••"
                                        />
                                    </div>
                                </div>

                                <div className="space-y-1.5 pt-2 border-t border-slate-800">
                                    <label className="text-sm font-medium text-slate-300 ml-1">New Password</label>
                                    <div className="relative">
                                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-500">
                                            <Lock className="w-4 h-4" />
                                        </div>
                                        <input
                                            type="password"
                                            required
                                            value={newPassword}
                                            onChange={(e) => setNewPassword(e.target.value)}
                                            className="w-full bg-slate-950 border border-slate-800 text-slate-200 text-sm rounded-lg focus:ring-emerald-500 focus:border-emerald-500 block pl-10 p-2.5 transition-colors"
                                            placeholder="••••••••"
                                        />
                                    </div>
                                </div>

                                <div className="space-y-1.5">
                                    <label className="text-sm font-medium text-slate-300 ml-1">Confirm New Password</label>
                                    <div className="relative">
                                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-500">
                                            <Lock className="w-4 h-4" />
                                        </div>
                                        <input
                                            type="password"
                                            required
                                            value={confirmPassword}
                                            onChange={(e) => setConfirmPassword(e.target.value)}
                                            className="w-full bg-slate-950 border border-slate-800 text-slate-200 text-sm rounded-lg focus:ring-emerald-500 focus:border-emerald-500 block pl-10 p-2.5 transition-colors"
                                            placeholder="••••••••"
                                        />
                                    </div>
                                </div>

                                <button
                                    type="submit"
                                    disabled={loading}
                                    className="w-full text-white bg-emerald-600 hover:bg-emerald-700 focus:ring-4 focus:outline-none focus:ring-emerald-800 font-medium rounded-lg text-sm px-5 py-3 text-center transition-all disabled:opacity-50 disabled:cursor-not-allowed mt-4 shadow-lg shadow-emerald-900/20"
                                >
                                    {loading ? 'Updating...' : 'Update Password'}
                                </button>
                            </form>
                        )}
                    </div>
                </div>
            </div>
        </AuthGuard>
    );
}
