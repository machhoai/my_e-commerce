'use client';

import { useState, useMemo } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { submitMandatoryProfile } from '@/lib/actions/profile';
import CCCDCamera, { CCCDScanResult } from '@/components/hr/CCCDCamera';
import SmartPortraitCamera from '@/components/shared/SmartPortraitCamera';
import { convertBase64ToWebP } from '@/lib/utils/image';
import {
    Mail, Camera, ScanLine, Loader2, CheckCircle2,
    User, Calendar, MapPin, CreditCard, ShieldAlert, LogOut,
} from 'lucide-react';
import { cn } from '@/lib/utils';

export default function MandatoryUpdateForm() {
    const { user, userDoc, refreshUserDoc, logout } = useAuth();

    // Determine if user is admin (only needs email)
    const isAdmin = userDoc?.role === 'admin' || userDoc?.role === 'super_admin';

    // ── Form state ───────────────────────────────────────────────────────────
    const [email, setEmail] = useState(
        userDoc?.email && !userDoc.email.endsWith('@company.com')
            ? userDoc.email
            : ''
    );
    const [avatar, setAvatar] = useState<string>(userDoc?.avatar || '');
    const [idCard, setIdCard] = useState(userDoc?.idCard || '');
    const [dob, setDob] = useState(userDoc?.dob || '');
    const [gender, setGender] = useState(userDoc?.gender || '');
    const [permanentAddress, setPermanentAddress] = useState(userDoc?.permanentAddress || '');
    const [idCardFrontPhoto, setIdCardFrontPhoto] = useState(userDoc?.idCardFrontPhoto || '');
    const [idCardBackPhoto, setIdCardBackPhoto] = useState(userDoc?.idCardBackPhoto || '');

    // ── UI state ─────────────────────────────────────────────────────────────
    const [isCCCDOpen, setIsCCCDOpen] = useState(false);
    const [isAvatarCameraOpen, setIsAvatarCameraOpen] = useState(false);
    const [isProcessingAvatar, setIsProcessingAvatar] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState('');
    const [cccdScanned, setCccdScanned] = useState(false);

    // ── Validation ───────────────────────────────────────────────────────────
    const isEmailValid = email.includes('@') && !email.endsWith('@company.com');

    const isFormValid = useMemo(() => {
        if (!isEmailValid) return false;
        if (isAdmin) return true;

        // Employee checks
        return !!(
            avatar &&
            idCard &&
            dob &&
            gender &&
            permanentAddress &&
            idCardFrontPhoto &&
            idCardBackPhoto
        );
    }, [isEmailValid, isAdmin, avatar, idCard, dob, gender, permanentAddress, idCardFrontPhoto, idCardBackPhoto]);

    // ── Handlers ─────────────────────────────────────────────────────────────
    const handleCCCDComplete = (result: CCCDScanResult) => {
        setIdCard(result.parsedData.idCard || '');
        setDob(result.parsedData.dob || '');
        setGender(result.parsedData.gender || '');
        setPermanentAddress(result.parsedData.permanentAddress || '');
        setIdCardFrontPhoto(result.frontPhotoWebP);
        setIdCardBackPhoto(result.backPhotoWebP);
        setCccdScanned(true);
        setIsCCCDOpen(false);
    };

    const handleAvatarCapture = async (base64Image: string) => {
        setIsAvatarCameraOpen(false);
        setIsProcessingAvatar(true);
        try {
            const webpImage = await convertBase64ToWebP(base64Image, 0.8);
            setAvatar(webpImage);
        } catch (err) {
            console.error('Avatar processing failed:', err);
        } finally {
            setIsProcessingAvatar(false);
        }
    };

    const handleSubmit = async () => {
        if (!user || !userDoc || !isFormValid) return;

        setSubmitting(true);
        setError('');

        const payload = {
            uid: user.uid,
            email,
            ...(!isAdmin ? {
                avatar,
                idCard,
                dob,
                gender,
                permanentAddress,
                idCardFrontPhoto,
                idCardBackPhoto,
            } : {}),
        };

        const result = await submitMandatoryProfile(payload);

        if (result.success) {
            // Re-fetch userDoc so the guard re-evaluates
            await refreshUserDoc();
        } else {
            setError(result.error || 'Đã xảy ra lỗi. Vui lòng thử lại.');
            setSubmitting(false);
        }
    };

    // ── Render ────────────────────────────────────────────────────────────────
    return (
        <div className="min-h-dvh bg-gradient-to-br from-slate-50 via-blue-50/40 to-indigo-50/30 flex items-center justify-center p-4 sm:p-6">
            <div className="w-full max-w-lg">
                {/* ── Header card ─────────────────────────────────────────── */}
                <div className="text-center mb-6 relative">
                    {/* Logout button */}
                    <button
                        onClick={() => logout()}
                        className="absolute top-0 right-0 flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold text-slate-500 hover:text-red-600 hover:bg-red-50 border border-slate-200 hover:border-red-200 transition-all active:scale-95"
                    >
                        <LogOut className="w-3.5 h-3.5" />
                        Đăng xuất
                    </button>
                    <div className="w-14 h-14 bg-gradient-to-br from-amber-400 to-orange-500 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg shadow-orange-200/50">
                        <ShieldAlert className="w-7 h-7 text-white" />
                    </div>
                    <h1 className="text-xl sm:text-2xl font-black text-slate-800 tracking-tight">
                        Cập nhật thông tin bắt buộc
                    </h1>
                    <p className="text-sm text-slate-500 mt-1.5 max-w-xs mx-auto">
                        Vui lòng hoàn thành hồ sơ để bắt đầu sử dụng hệ thống.
                    </p>
                </div>

                {/* ── Form card ───────────────────────────────────────────── */}
                <div className="bg-white rounded-2xl shadow-xl shadow-slate-200/50 border border-slate-100 overflow-hidden">
                    <div className="p-5 sm:p-7 space-y-6">

                        {/* Error message */}
                        {error && (
                            <div className="flex items-start gap-2.5 p-3.5 rounded-xl bg-red-50 border border-red-100 text-red-700 text-sm">
                                <ShieldAlert className="w-4 h-4 shrink-0 mt-0.5" />
                                <p className="font-medium">{error}</p>
                            </div>
                        )}

                        {/* ── Email (All users) ────────────────────────────── */}
                        <div className="space-y-2">
                            <label className="text-sm font-bold text-slate-700 flex items-center gap-2">
                                <Mail className="w-4 h-4 text-indigo-500" />
                                Địa chỉ Email <span className="text-red-400">*</span>
                            </label>
                            <input
                                type="email"
                                value={email}
                                onChange={e => setEmail(e.target.value)}
                                placeholder="your.email@example.com"
                                className={cn(
                                    'w-full px-4 py-3 rounded-xl border text-sm font-medium transition-all duration-200 outline-none',
                                    'focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400',
                                    isEmailValid
                                        ? 'border-emerald-200 bg-emerald-50/40'
                                        : 'border-slate-200 bg-slate-50/50'
                                )}
                            />
                            {email && !isEmailValid && (
                                <p className="text-xs text-amber-600 font-medium ml-1">
                                    Email không hợp lệ hoặc đang sử dụng email hệ thống.
                                </p>
                            )}
                        </div>

                        {/* ── Employee-only sections ───────────────────────── */}
                        {!isAdmin && (
                            <>
                                {/* ── Avatar ───────────────────────────────── */}
                                <div className="space-y-2">
                                    <label className="text-sm font-bold text-slate-700 flex items-center gap-2">
                                        <Camera className="w-4 h-4 text-indigo-500" />
                                        Ảnh đại diện <span className="text-red-400">*</span>
                                    </label>
                                    <div className="flex items-center gap-4">
                                        <button
                                            type="button"
                                            onClick={() => setIsAvatarCameraOpen(true)}
                                            disabled={isProcessingAvatar}
                                            className="relative w-20 h-20 rounded-full shrink-0 group cursor-pointer border-2 border-dashed border-slate-200 hover:border-indigo-300 transition-colors overflow-hidden"
                                        >
                                            {avatar ? (
                                                // eslint-disable-next-line @next/next/no-img-element
                                                <img src={avatar} alt="Avatar" className="w-full h-full object-cover" />
                                            ) : (
                                                <div className="w-full h-full bg-gradient-to-br from-slate-100 to-slate-50 flex items-center justify-center">
                                                    <User className="w-8 h-8 text-slate-300" />
                                                </div>
                                            )}
                                            <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors flex items-center justify-center">
                                                {isProcessingAvatar ? (
                                                    <Loader2 className="w-5 h-5 text-white animate-spin" />
                                                ) : (
                                                    <Camera className="w-5 h-5 text-white opacity-0 group-hover:opacity-100 transition-opacity" />
                                                )}
                                            </div>
                                        </button>
                                        <div className="flex-1">
                                            <button
                                                type="button"
                                                onClick={() => setIsAvatarCameraOpen(true)}
                                                disabled={isProcessingAvatar}
                                                className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-sm font-semibold text-slate-600 hover:bg-slate-50 active:scale-[0.98] transition-all flex items-center justify-center gap-2"
                                            >
                                                <Camera className="w-4 h-4" />
                                                {avatar ? 'Chụp lại' : 'Chụp ảnh đại diện'}
                                            </button>
                                            {avatar && (
                                                <p className="text-xs text-emerald-600 font-medium mt-1.5 flex items-center gap-1 ml-1">
                                                    <CheckCircle2 className="w-3 h-3" /> Đã có ảnh
                                                </p>
                                            )}
                                        </div>
                                    </div>
                                </div>

                                {/* ── CCCD Section ─────────────────────────── */}
                                <div className="space-y-3">
                                    <div className="flex items-center justify-between">
                                        <label className="text-sm font-bold text-slate-700 flex items-center gap-2">
                                            <CreditCard className="w-4 h-4 text-indigo-500" />
                                            Thông tin CCCD <span className="text-red-400">*</span>
                                        </label>
                                        {cccdScanned && (
                                            <span className="text-xs font-bold text-emerald-600 flex items-center gap-1">
                                                <CheckCircle2 className="w-3 h-3" /> Đã quét
                                            </span>
                                        )}
                                    </div>

                                    {/* Scan CCCD Button */}
                                    <button
                                        type="button"
                                        onClick={() => setIsCCCDOpen(true)}
                                        className={cn(
                                            'w-full py-3.5 rounded-xl text-sm font-bold flex items-center justify-center gap-2.5 active:scale-[0.98] transition-all',
                                            cccdScanned
                                                ? 'bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100'
                                                : 'bg-gradient-to-r from-indigo-500 to-blue-500 text-white shadow-lg shadow-indigo-200/50 hover:shadow-xl hover:shadow-indigo-300/50'
                                        )}
                                    >
                                        <ScanLine className="w-5 h-5" />
                                        {cccdScanned ? 'Quét lại CCCD' : 'Quét CCCD bằng Camera'}
                                    </button>

                                    {/* Read-only CCCD fields */}
                                    <div className="grid grid-cols-2 gap-3">
                                        <div className="space-y-1">
                                            <label className="text-[11px] font-semibold text-slate-500 flex items-center gap-1">
                                                <CreditCard className="w-3 h-3" /> Số CCCD
                                            </label>
                                            <input
                                                type="text"
                                                value={idCard}
                                                disabled
                                                placeholder="Chưa quét"
                                                className="w-full px-3 py-2.5 rounded-lg border border-slate-100 bg-slate-50/80 text-sm text-slate-700 font-medium disabled:opacity-70"
                                            />
                                        </div>
                                        <div className="space-y-1">
                                            <label className="text-[11px] font-semibold text-slate-500 flex items-center gap-1">
                                                <Calendar className="w-3 h-3" /> Ngày sinh
                                            </label>
                                            <input
                                                type="text"
                                                value={dob}
                                                disabled
                                                placeholder="Chưa quét"
                                                className="w-full px-3 py-2.5 rounded-lg border border-slate-100 bg-slate-50/80 text-sm text-slate-700 font-medium disabled:opacity-70"
                                            />
                                        </div>
                                        <div className="space-y-1">
                                            <label className="text-[11px] font-semibold text-slate-500 flex items-center gap-1">
                                                <User className="w-3 h-3" /> Giới tính
                                            </label>
                                            <input
                                                type="text"
                                                value={gender}
                                                disabled
                                                placeholder="Chưa quét"
                                                className="w-full px-3 py-2.5 rounded-lg border border-slate-100 bg-slate-50/80 text-sm text-slate-700 font-medium disabled:opacity-70"
                                            />
                                        </div>
                                        <div className="col-span-2 space-y-1">
                                            <label className="text-[11px] font-semibold text-slate-500 flex items-center gap-1">
                                                <MapPin className="w-3 h-3" /> Địa chỉ thường trú
                                            </label>
                                            <input
                                                type="text"
                                                value={permanentAddress}
                                                disabled
                                                placeholder="Chưa quét"
                                                className="w-full px-3 py-2.5 rounded-lg border border-slate-100 bg-slate-50/80 text-sm text-slate-700 font-medium disabled:opacity-70"
                                            />
                                        </div>
                                    </div>
                                </div>
                            </>
                        )}
                    </div>

                    {/* ── Submit button ─── sticky on mobile ──────────────── */}
                    <div className="sticky bottom-0 p-5 sm:p-7 pt-0 sm:pt-0 bg-gradient-to-t from-white via-white to-white/0">
                        <button
                            type="button"
                            onClick={handleSubmit}
                            disabled={!isFormValid || submitting}
                            className={cn(
                                'w-full py-3.5 sm:py-4 rounded-xl text-sm sm:text-base font-bold flex items-center justify-center gap-2.5 transition-all active:scale-[0.98]',
                                isFormValid && !submitting
                                    ? 'bg-gradient-to-r from-emerald-500 to-teal-500 text-white shadow-lg shadow-emerald-200/50 hover:shadow-xl hover:shadow-emerald-300/50'
                                    : 'bg-slate-100 text-slate-400 cursor-not-allowed'
                            )}
                        >
                            {submitting ? (
                                <>
                                    <Loader2 className="w-5 h-5 animate-spin" />
                                    Đang cập nhật...
                                </>
                            ) : (
                                <>
                                    <CheckCircle2 className="w-5 h-5" />
                                    Cập nhật & Bắt đầu làm việc
                                </>
                            )}
                        </button>
                    </div>
                </div>
            </div>

            {/* ── Fullscreen Camera Modals ─────────────────────────────────── */}
            {isAvatarCameraOpen && (
                <SmartPortraitCamera
                    onCapture={handleAvatarCapture}
                    onClose={() => setIsAvatarCameraOpen(false)}
                />
            )}

            {isCCCDOpen && (
                <CCCDCamera
                    onScanComplete={handleCCCDComplete}
                    onClose={() => setIsCCCDOpen(false)}
                />
            )}
        </div>
    );
}
