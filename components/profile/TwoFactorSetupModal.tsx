'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { cn } from '@/lib/utils';
import {
    Shield, ShieldCheck, ShieldAlert, X, Loader2,
    QrCode, KeyRound, CheckCircle2, AlertCircle,
    Copy, Check, Smartphone, ArrowRight,
} from 'lucide-react';

type Step = 'idle' | 'loading_qr' | 'scanning' | 'verifying' | 'success';

interface TwoFactorSetupModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSuccess?: () => void;
    isTwoFactorEnabled?: boolean;
}

export default function TwoFactorSetupModal({
    isOpen,
    onClose,
    onSuccess,
    isTwoFactorEnabled = false,
}: TwoFactorSetupModalProps) {
    const { getToken } = useAuth();

    const [step, setStep] = useState<Step>('idle');
    const [qrCodeUrl, setQrCodeUrl] = useState('');
    const [secret, setSecret] = useState('');
    const [otpCode, setOtpCode] = useState('');
    const [error, setError] = useState('');
    const [copied, setCopied] = useState(false);

    // OTP input refs (6 individual inputs)
    const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

    // Reset on open/close
    useEffect(() => {
        if (!isOpen) {
            setStep('idle');
            setQrCodeUrl('');
            setSecret('');
            setOtpCode('');
            setError('');
            setCopied(false);
        }
    }, [isOpen]);

    // ── Generate QR ──
    const handleGenerate = useCallback(async () => {
        setStep('loading_qr');
        setError('');
        try {
            const token = await getToken();
            const res = await fetch('/api/auth/2fa/generate', {
                headers: { Authorization: `Bearer ${token}` },
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || 'Lỗi tạo mã QR');

            setQrCodeUrl(data.qrCodeUrl);
            setSecret(data.secret);
            setStep('scanning');

            // Auto-focus the first OTP input after rendering
            setTimeout(() => inputRefs.current[0]?.focus(), 100);
        } catch (err: unknown) {
            setError(err instanceof Error ? err.message : 'Lỗi hệ thống');
            setStep('idle');
        }
    }, [getToken]);

    // ── Verify OTP ──
    const handleVerify = useCallback(async () => {
        if (otpCode.length !== 6) {
            setError('Vui lòng nhập đủ 6 chữ số');
            return;
        }

        setStep('verifying');
        setError('');
        try {
            const token = await getToken();
            const res = await fetch('/api/auth/2fa/verify-setup', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${token}`,
                },
                body: JSON.stringify({ token: otpCode, secret }),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || 'Xác thực thất bại');

            setStep('success');
            onSuccess?.();
        } catch (err: unknown) {
            setError(err instanceof Error ? err.message : 'Lỗi hệ thống');
            setStep('scanning');
            setOtpCode('');
            // Re-focus first input
            setTimeout(() => inputRefs.current[0]?.focus(), 100);
        }
    }, [otpCode, secret, getToken, onSuccess]);

    // ── OTP Input Handlers ──
    const handleOtpChange = (index: number, value: string) => {
        if (!/^\d?$/.test(value)) return; // only single digit

        const newCode = otpCode.split('');
        newCode[index] = value;
        const joined = newCode.join('').slice(0, 6);
        setOtpCode(joined);
        setError('');

        // Auto-advance to next input
        if (value && index < 5) {
            inputRefs.current[index + 1]?.focus();
        }
    };

    const handleOtpKeyDown = (index: number, e: React.KeyboardEvent) => {
        if (e.key === 'Backspace' && !otpCode[index] && index > 0) {
            inputRefs.current[index - 1]?.focus();
        }
        if (e.key === 'Enter' && otpCode.length === 6) {
            handleVerify();
        }
    };

    const handleOtpPaste = (e: React.ClipboardEvent) => {
        e.preventDefault();
        const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
        if (pasted.length > 0) {
            setOtpCode(pasted);
            const focusIdx = Math.min(pasted.length, 5);
            inputRefs.current[focusIdx]?.focus();
        }
    };

    // ── Copy secret ──
    const copySecret = () => {
        navigator.clipboard.writeText(secret);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center">
            {/* Backdrop */}
            <div
                className="absolute inset-0 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200"
                onClick={step !== 'verifying' ? onClose : undefined}
            />

            {/* Modal */}
            <div className="relative bg-white rounded-2xl shadow-2xl w-[95vw] max-w-md max-h-[90vh] overflow-y-auto animate-in zoom-in-95 slide-in-from-bottom-4 duration-300 m-4">
                {/* Header */}
                <div className="sticky top-0 bg-white rounded-t-2xl border-b border-gray-100 px-6 py-4 flex items-center gap-3 z-10">
                    <div className={cn(
                        'w-10 h-10 rounded-xl flex items-center justify-center',
                        step === 'success' ? 'bg-emerald-100' : 'bg-gradient-to-br from-violet-100 to-indigo-100'
                    )}>
                        {step === 'success'
                            ? <ShieldCheck className="w-5 h-5 text-emerald-600" />
                            : <Shield className="w-5 h-5 text-violet-600" />}
                    </div>
                    <div className="flex-1">
                        <h2 className="font-bold text-gray-800 text-lg leading-tight">Xác thực 2 bước</h2>
                        <p className="text-xs text-gray-400">Google Authenticator / TOTP</p>
                    </div>
                    <button
                        onClick={onClose}
                        className="w-8 h-8 rounded-lg hover:bg-gray-100 flex items-center justify-center transition-colors"
                    >
                        <X className="w-4 h-4 text-gray-400" />
                    </button>
                </div>

                <div className="px-6 py-5 space-y-5">
                    {/* ═══ STEP: IDLE ═══ */}
                    {step === 'idle' && !isTwoFactorEnabled && (
                        <>
                            <div className="text-center space-y-3">
                                <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-violet-50 to-indigo-100 flex items-center justify-center mx-auto">
                                    <Smartphone className="w-10 h-10 text-violet-500" />
                                </div>
                                <h3 className="font-bold text-gray-800 text-lg">Bảo vệ tài khoản của bạn</h3>
                                <p className="text-sm text-gray-500 leading-relaxed max-w-xs mx-auto">
                                    Thêm lớp bảo mật với Google Authenticator. Mỗi lần đăng nhập, bạn sẽ cần nhập mã 6 số từ ứng dụng.
                                </p>
                            </div>

                            {/* Steps preview */}
                            <div className="space-y-3 bg-gray-50 rounded-xl p-4">
                                {[
                                    { icon: QrCode, text: 'Quét mã QR bằng Google Authenticator' },
                                    { icon: KeyRound, text: 'Nhập mã 6 chữ số để xác nhận' },
                                    { icon: ShieldCheck, text: 'Tài khoản được bảo vệ 2 lớp' },
                                ].map((item, i) => (
                                    <div key={i} className="flex items-center gap-3">
                                        <div className="w-8 h-8 rounded-lg bg-white shadow-sm flex items-center justify-center shrink-0">
                                            <item.icon className="w-4 h-4 text-violet-500" />
                                        </div>
                                        <span className="text-sm text-gray-600">{item.text}</span>
                                    </div>
                                ))}
                            </div>

                            <button
                                onClick={handleGenerate}
                                className="w-full py-3 px-4 rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600 text-white font-bold text-sm shadow-lg shadow-violet-500/25 hover:shadow-violet-500/40 active:scale-[0.98] transition-all flex items-center justify-center gap-2"
                            >
                                <Shield className="w-4 h-4" />
                                Bật xác thực 2 bước
                                <ArrowRight className="w-4 h-4" />
                            </button>
                        </>
                    )}

                    {/* ═══ STEP: ALREADY ENABLED ═══ */}
                    {step === 'idle' && isTwoFactorEnabled && (
                        <div className="text-center space-y-4 py-4">
                            <div className="w-20 h-20 rounded-2xl bg-emerald-50 flex items-center justify-center mx-auto">
                                <ShieldCheck className="w-10 h-10 text-emerald-500" />
                            </div>
                            <h3 className="font-bold text-gray-800 text-lg">Đã bật xác thực 2 bước</h3>
                            <p className="text-sm text-gray-500">
                                Tài khoản của bạn đang được bảo vệ bằng Google Authenticator.
                            </p>
                            <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-emerald-50 text-emerald-700 text-xs font-bold">
                                <CheckCircle2 className="w-3.5 h-3.5" />
                                Đang hoạt động
                            </div>
                        </div>
                    )}

                    {/* ═══ STEP: LOADING QR ═══ */}
                    {step === 'loading_qr' && (
                        <div className="flex flex-col items-center justify-center py-12 gap-4">
                            <div className="relative">
                                <div className="w-16 h-16 border-4 border-violet-200 border-t-violet-600 rounded-full animate-spin" />
                                <QrCode className="w-6 h-6 text-violet-400 absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2" />
                            </div>
                            <p className="text-sm text-gray-500 font-medium">Đang tạo mã QR...</p>
                        </div>
                    )}

                    {/* ═══ STEP: SCANNING ═══ */}
                    {(step === 'scanning' || step === 'verifying') && (
                        <>
                            {/* QR Code */}
                            <div className="text-center space-y-3">
                                <p className="text-sm text-gray-600 font-medium">
                                    Mở <span className="font-bold text-violet-600">Google Authenticator</span> và quét mã QR bên dưới
                                </p>
                                <div className="bg-white border-2 border-dashed border-violet-200 rounded-2xl p-4 inline-block mx-auto">
                                    {/* eslint-disable-next-line @next/next/no-img-element */}
                                    <img
                                        src={qrCodeUrl}
                                        alt="QR Code for 2FA setup"
                                        className="w-[220px] h-[220px] mx-auto"
                                    />
                                </div>
                            </div>

                            {/* Manual secret */}
                            <div className="bg-gray-50 rounded-xl p-3.5 space-y-2">
                                <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider">
                                    Hoặc nhập thủ công mã bí mật
                                </p>
                                <div className="flex items-center gap-2">
                                    <code className="flex-1 text-xs font-mono font-bold text-gray-700 bg-white px-3 py-2 rounded-lg border border-gray-200 break-all select-all">
                                        {secret}
                                    </code>
                                    <button
                                        onClick={copySecret}
                                        className={cn(
                                            'shrink-0 w-9 h-9 rounded-lg flex items-center justify-center transition-all',
                                            copied
                                                ? 'bg-emerald-100 text-emerald-600'
                                                : 'bg-white border border-gray-200 text-gray-500 hover:bg-gray-100'
                                        )}
                                        title="Sao chép"
                                    >
                                        {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                                    </button>
                                </div>
                            </div>

                            {/* OTP Input */}
                            <div className="space-y-3">
                                <p className="text-sm font-semibold text-gray-700 text-center">
                                    Nhập mã 6 chữ số từ ứng dụng
                                </p>
                                <div className="flex justify-center gap-2" onPaste={handleOtpPaste}>
                                    {Array.from({ length: 6 }).map((_, i) => (
                                        <input
                                            key={i}
                                            ref={el => { inputRefs.current[i] = el; }}
                                            type="text"
                                            inputMode="numeric"
                                            maxLength={1}
                                            value={otpCode[i] || ''}
                                            onChange={e => handleOtpChange(i, e.target.value)}
                                            onKeyDown={e => handleOtpKeyDown(i, e)}
                                            disabled={step === 'verifying'}
                                            className={cn(
                                                'w-11 h-13 text-center text-xl font-black rounded-xl border-2 outline-none transition-all',
                                                'focus:border-violet-500 focus:ring-4 focus:ring-violet-100',
                                                error ? 'border-red-300 bg-red-50/50' : 'border-gray-200 bg-white',
                                                step === 'verifying' && 'opacity-50 cursor-not-allowed'
                                            )}
                                        />
                                    ))}
                                </div>

                                {/* Error message */}
                                {error && (
                                    <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-red-50 border border-red-100 animate-in slide-in-from-top-1 duration-200">
                                        <AlertCircle className="w-4 h-4 text-red-500 shrink-0" />
                                        <span className="text-xs font-medium text-red-600">{error}</span>
                                    </div>
                                )}
                            </div>

                            {/* Verify button */}
                            <button
                                onClick={handleVerify}
                                disabled={otpCode.length !== 6 || step === 'verifying'}
                                className={cn(
                                    'w-full py-3 px-4 rounded-xl font-bold text-sm transition-all flex items-center justify-center gap-2',
                                    otpCode.length === 6
                                        ? 'bg-gradient-to-r from-violet-600 to-indigo-600 text-white shadow-lg shadow-violet-500/25 hover:shadow-violet-500/40 active:scale-[0.98]'
                                        : 'bg-gray-100 text-gray-400 cursor-not-allowed',
                                    step === 'verifying' && 'opacity-70 cursor-wait'
                                )}
                            >
                                {step === 'verifying' ? (
                                    <>
                                        <Loader2 className="w-4 h-4 animate-spin" />
                                        Đang xác thực...
                                    </>
                                ) : (
                                    <>
                                        <ShieldCheck className="w-4 h-4" />
                                        Xác nhận
                                    </>
                                )}
                            </button>
                        </>
                    )}

                    {/* ═══ STEP: SUCCESS ═══ */}
                    {step === 'success' && (
                        <div className="text-center space-y-4 py-4">
                            <div className="w-20 h-20 rounded-2xl bg-emerald-50 flex items-center justify-center mx-auto animate-in zoom-in duration-300">
                                <ShieldCheck className="w-10 h-10 text-emerald-500" />
                            </div>
                            <h3 className="font-bold text-gray-800 text-lg">Thiết lập thành công! 🎉</h3>
                            <p className="text-sm text-gray-500 leading-relaxed max-w-xs mx-auto">
                                Xác thực 2 bước đã được bật. Từ bây giờ, mỗi lần đăng nhập bạn sẽ cần nhập mã từ Google Authenticator.
                            </p>
                            <div className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full bg-emerald-50 text-emerald-700 text-xs font-bold border border-emerald-200">
                                <CheckCircle2 className="w-3.5 h-3.5" />
                                Đang hoạt động
                            </div>
                            <div>
                                <button
                                    onClick={onClose}
                                    className="px-8 py-2.5 rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold text-sm transition-colors"
                                >
                                    Đóng
                                </button>
                            </div>
                        </div>
                    )}
                </div>

                {/* Warning footer */}
                {(step === 'scanning' || step === 'verifying') && (
                    <div className="px-6 pb-5">
                        <div className="flex items-start gap-2.5 px-3.5 py-2.5 rounded-xl bg-amber-50 border border-amber-100">
                            <ShieldAlert className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
                            <p className="text-[11px] text-amber-700 leading-relaxed">
                                <span className="font-bold">Lưu ý:</span> Hãy lưu lại mã bí mật ở nơi an toàn. Nếu mất điện thoại, bạn sẽ cần mã này để khôi phục truy cập.
                            </p>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
