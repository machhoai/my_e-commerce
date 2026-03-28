'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { db } from '@/lib/firebase';
import { doc, getDoc } from 'firebase/firestore';
import { UserDoc } from '@/types';
import { cn } from '@/lib/utils';
import {
    User, Mail, Phone, Calendar, Briefcase, CreditCard, GraduationCap,
    ShieldCheck, Home, ChevronRight, LogOut, Edit3, X, Loader2,
    CheckCircle2, AlertTriangle, Lock, Camera, ScanLine, ImageIcon, MapPin,
    Shield, Smartphone,
} from 'lucide-react';
import MobilePageShell from '@/components/mobile/MobilePageShell';
import HardResetButton from '@/components/shared/HardResetButton';
import BottomSheet from '@/components/shared/BottomSheet';
import SmartPortraitCamera from '@/components/shared/SmartPortraitCamera';
import CCCDCamera, { CCCDScanResult } from '@/components/hr/CCCDCamera';
import { convertBase64ToWebP } from '@/lib/utils/image';
import { uploadImageBase64 } from '@/lib/utils/storage-upload';
import TwoFactorSetupModal from '@/components/profile/TwoFactorSetupModal';
import ReferralHistorySection from '@/components/referral/ReferralHistorySection';

const ROLE_LABELS: Record<string, string> = {
    admin: 'Quản trị viên',
    store_manager: 'CH Trưởng',
    manager: 'Quản lý',
    employee: 'Nhân viên',
};

export default function MobileProfilePage() {
    const { user, logout } = useAuth();
    const [profileData, setProfileData] = useState<UserDoc | null>(null);
    const [loading, setLoading] = useState(true);

    // Edit
    const [editSheetOpen, setEditSheetOpen] = useState(false);
    const [editData, setEditData] = useState<Partial<UserDoc>>({});
    const [saving, setSaving] = useState(false);
    const [message, setMessage] = useState({ type: '', text: '' });

    // Logout confirm
    const [logoutConfirmOpen, setLogoutConfirmOpen] = useState(false);
    const [loggingOut, setLoggingOut] = useState(false);

    // Camera / Avatar
    const [isCameraOpen, setIsCameraOpen] = useState(false);
    const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
    const [isProcessing, setIsProcessing] = useState(false);

    // 2FA
    const [is2FAModalOpen, setIs2FAModalOpen] = useState(false);

    // CCCD Scanner
    const [isCCCDOpen, setIsCCCDOpen] = useState(false);
    const [cccdProcessing, setCccdProcessing] = useState(false);

    useEffect(() => {
        if (!user) return;
        (async () => {
            try {
                const snap = await getDoc(doc(db, 'users', user.uid));
                if (snap.exists()) {
                    const data = snap.data() as UserDoc;
                    setProfileData(data);
                    if (data.avatar) setAvatarUrl(data.avatar);
                }
            } catch { /* noop */ }
            finally { setLoading(false); }
        })();
    }, [user]);

    const handleEditChange = (field: keyof UserDoc, value: string) => setEditData(prev => ({ ...prev, [field]: value }));

    const startEditing = () => {
        if (!profileData) return;
        setEditData({
            email: profileData.email || '', dob: profileData.dob || '',
            bankAccount: profileData.bankAccount || '', education: profileData.education || '',
        });
        setMessage({ type: '', text: '' });
        setEditSheetOpen(true);
    };

    const handleSave = async () => {
        if (!user || !profileData) return;
        setSaving(true); setMessage({ type: '', text: '' });
        try {
            const token = await user.getIdToken();
            const res = await fetch('/api/auth/update-user', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
                body: JSON.stringify(editData),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || 'Không thể cập nhật');
            setMessage({ type: 'success', text: 'Cập nhật thành công!' });
            setProfileData(prev => prev ? { ...prev, ...editData } : null);
            setTimeout(() => setEditSheetOpen(false), 800);
        } catch (err: unknown) {
            setMessage({ type: 'error', text: err instanceof Error ? err.message : 'Lỗi' });
        } finally { setSaving(false); }
    };

    const handleLogout = async () => {
        setLoggingOut(true);
        try { await logout(); } catch { setLoggingOut(false); }
    };

    // ── CCCD scan handler ────────────────────────────────────────────────────
    const handleCCCDScanComplete = async (result: CCCDScanResult) => {
        setIsCCCDOpen(false);
        setCccdProcessing(true);
        try {
            if (user) {
                // Upload CCCD photos to Firebase Storage
                const [frontUrl, backUrl] = await Promise.all([
                    uploadImageBase64(user.uid, result.frontPhotoWebP, 'cccd_front'),
                    uploadImageBase64(user.uid, result.backPhotoWebP, 'cccd_back'),
                ]);

                const token = await user.getIdToken();
                const payload = {
                    name: result.parsedData.name,
                    idCard: result.parsedData.idCard,
                    dob: result.parsedData.dob,
                    gender: result.parsedData.gender,
                    permanentAddress: result.parsedData.permanentAddress,
                    idCardFrontPhoto: frontUrl,
                    idCardBackPhoto: backUrl,
                };
                const res = await fetch('/api/auth/update-user', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
                    body: JSON.stringify(payload),
                });
                const data = await res.json();
                if (!res.ok) throw new Error(data.error || 'Cập nhật thất bại');
                setProfileData(prev => prev ? { ...prev, ...payload } : null);
                setMessage({ type: 'success', text: 'Cập nhật CCCD thành công!' });
            }
        } catch (err) {
            console.error('CCCD update failed:', err);
            setMessage({ type: 'error', text: err instanceof Error ? err.message : 'Cập nhật CCCD thất bại' });
        } finally {
            setCccdProcessing(false);
        }
    };
    const handleCapture = async (base64Image: string) => {
        setIsCameraOpen(false);
        setIsProcessing(true);
        try {
            const webpImage = await convertBase64ToWebP(base64Image, 0.8);

            if (user) {
                // Upload to Firebase Storage first
                const avatarStorageUrl = await uploadImageBase64(user.uid, webpImage, 'avatar');
                setAvatarUrl(avatarStorageUrl);

                const token = await user.getIdToken();
                await fetch('/api/auth/update-user', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
                    body: JSON.stringify({ avatar: avatarStorageUrl }),
                });
                setProfileData(prev => prev ? { ...prev, avatar: avatarStorageUrl } : null);
            } else {
                setAvatarUrl(webpImage);
            }
        } catch (err) {
            console.error('Avatar update failed:', err);
        } finally {
            setIsProcessing(false);
        }
    };

    // ── Loading / Error ──────────────────────────────────────────────────────
    if (loading) {
        return (
            <MobilePageShell title="Hồ sơ">
                <div className="flex flex-col items-center py-20">
                    <div className="w-6 h-6 border-2 border-primary-200 border-t-primary-600 rounded-full animate-spin mb-2" />
                    <p className="text-[11px] text-gray-500">Đang tải hồ sơ...</p>
                </div>
            </MobilePageShell>
        );
    }

    if (!profileData) {
        return (
            <MobilePageShell title="Hồ sơ">
                <div className="text-center py-20">
                    <AlertTriangle className="w-8 h-8 text-red-400 mx-auto mb-2" />
                    <p className="text-sm text-red-600 font-bold">Không tìm thấy hồ sơ</p>
                </div>
            </MobilePageShell>
        );
    }

    const firstName = profileData.name?.split(' ').pop() || 'U';

    // ── Info items ────────────────────────────────────────────────────────────
    const infoSections: { title: string; items: { icon: React.ReactNode; label: string; value: string; locked?: boolean }[] }[] = [
        {
            title: 'Thông tin hệ thống',
            items: [
                { icon: <Phone className="w-4 h-4" />, label: 'Số điện thoại', value: profileData.phone || '—', locked: true },
                { icon: <User className="w-4 h-4" />, label: 'Số CCCD', value: profileData.idCard || '—', locked: true },
                { icon: <User className="w-4 h-4" />, label: 'Giới tính', value: profileData.gender || '—', locked: true },
            ],
        },
        {
            title: 'Thông tin cá nhân',
            items: [
                { icon: <Mail className="w-4 h-4" />, label: 'Email', value: profileData.email || 'Chưa cung cấp' },
                { icon: <Calendar className="w-4 h-4" />, label: 'Ngày sinh', value: profileData.dob || 'Chưa cung cấp', locked: true },
                { icon: <MapPin className="w-4 h-4" />, label: 'Địa chỉ thường trú', value: profileData.permanentAddress || 'Chưa cung cấp', locked: true },
                { icon: <CreditCard className="w-4 h-4" />, label: 'Ngân hàng', value: profileData.bankAccount || 'Chưa cung cấp' },
                { icon: <GraduationCap className="w-4 h-4" />, label: 'Học vấn', value: profileData.education || 'Chưa cung cấp' },
            ],
        },
    ];


    return (
        <MobilePageShell title="Hồ sơ" headerRight={
            <button onClick={startEditing} className="w-8 h-8 rounded-lg bg-gray-100 flex items-center justify-center active:scale-95 transition-transform">
                <Edit3 className="w-4 h-4 text-gray-600" />
            </button>
        }>
            {/* ── Profile header ───────────────────────────────────────── */}
            <div className="flex flex-col items-center pt-2 pb-4">
                {/* Avatar with camera overlay */}
                <button
                    onClick={() => setIsCameraOpen(true)}
                    className="relative w-20 h-20 rounded-full mb-3 group"
                    disabled={isProcessing}
                >
                    {avatarUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={avatarUrl} alt="Avatar" className="w-20 h-20 rounded-full object-cover shadow-lg shadow-primary-200" />
                    ) : (
                        <div className="w-20 h-20 bg-gradient-to-br from-primary-400 to-primary-600 rounded-full flex items-center justify-center shadow-lg shadow-primary-200">
                            <span className="text-2xl font-black text-white uppercase">{firstName.charAt(0)}</span>
                        </div>
                    )}

                    {/* Camera badge */}
                    <div className="absolute -bottom-0.5 -right-0.5 w-7 h-7 rounded-full bg-primary-600 border-[2.5px] border-white flex items-center justify-center shadow-md group-active:scale-90 transition-transform">
                        {isProcessing ? (
                            <Loader2 className="w-3 h-3 text-white animate-spin" />
                        ) : (
                            <Camera className="w-3 h-3 text-white" />
                        )}
                    </div>
                </button>

                <h2 className="text-lg font-black text-gray-800">{profileData.name}</h2>
                <div className="flex items-center gap-1.5 mt-1.5 flex-wrap justify-center">
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-100">
                        <ShieldCheck className="w-2.5 h-2.5" />{ROLE_LABELS[profileData.role] || profileData.role}
                    </span>
                    <span className="inline-flex px-2 py-0.5 rounded-full text-[9px] font-bold bg-amber-50 text-amber-700 border border-amber-100">
                        {profileData.type === 'FT' ? 'Toàn thời gian' : 'Bán thời gian'}
                    </span>
                </div>

                {isProcessing && (
                    <p className="text-[10px] text-primary-600 font-medium mt-2">Đang xử lý ảnh...</p>
                )}

                {/* Visible status message for CCCD / profile updates */}
                {message.text && !editSheetOpen && (
                    <div className={cn(
                        'flex items-center gap-2 px-3 py-2 rounded-lg border text-[11px] font-medium mt-2 mx-2',
                        message.type === 'error'
                            ? 'bg-red-50 border-red-200 text-red-700'
                            : 'bg-emerald-50 border-emerald-200 text-emerald-700'
                    )}>
                        {message.type === 'error'
                            ? <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                            : <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />}
                        {message.text}
                        <button onClick={() => setMessage({ type: '', text: '' })} className="ml-auto shrink-0">
                            <X className="w-3 h-3 text-gray-400" />
                        </button>
                    </div>
                )}
            </div>

            {/* ── Info sections ────────────────────────────────────────── */}
            <div className="space-y-3">
                {infoSections.map(section => (
                    <div key={section.title}>
                        <p className="text-[9px] font-bold text-gray-400 uppercase tracking-wider px-1 mb-1.5">{section.title}</p>
                        <div className="bg-white rounded-xl border border-gray-100 shadow-sm divide-y divide-gray-50">
                            {section.items.map(item => (
                                <div key={item.label} className="flex items-center gap-3 px-3 py-2.5">
                                    <span className="text-gray-400 shrink-0">{item.icon}</span>
                                    <div className="flex-1 min-w-0">
                                        <p className="text-[9px] text-gray-400 font-bold uppercase">{item.label}</p>
                                        <p className={cn('text-[11px] font-medium truncate', item.value === 'Chưa cung cấp' || item.value === '—' ? 'text-gray-300 italic' : 'text-gray-700')}>
                                            {item.value}
                                        </p>
                                    </div>
                                    {item.locked && <Lock className="w-3 h-3 text-gray-300 shrink-0" />}
                                </div>
                            ))}
                        </div>
                    </div>
                ))}
            </div>

            {/* ── CCCD Photos ──────────────────────────────────────────── */}
            {(profileData.idCardFrontPhoto || profileData.idCardBackPhoto) && (
                <div className="mt-3">
                    <p className="text-[9px] font-bold text-gray-400 uppercase tracking-wider px-1 mb-1.5">Ảnh CCCD</p>
                    <div className="flex gap-2">
                        {profileData.idCardFrontPhoto && (
                            <div className="flex-1 rounded-xl border border-gray-100 overflow-hidden bg-white shadow-sm">
                                <div className="text-[9px] font-bold text-gray-400 uppercase tracking-wider px-2.5 py-1 bg-gray-50 flex items-center gap-1">
                                    <ImageIcon className="w-2.5 h-2.5" /> Mặt trước
                                </div>
                                {/* eslint-disable-next-line @next/next/no-img-element */}
                                <img src={profileData.idCardFrontPhoto} alt="CCCD Front" className="w-full h-24 object-cover" />
                            </div>
                        )}
                        {profileData.idCardBackPhoto && (
                            <div className="flex-1 rounded-xl border border-gray-100 overflow-hidden bg-white shadow-sm">
                                <div className="text-[9px] font-bold text-gray-400 uppercase tracking-wider px-2.5 py-1 bg-gray-50 flex items-center gap-1">
                                    <ImageIcon className="w-2.5 h-2.5" /> Mặt sau
                                </div>
                                {/* eslint-disable-next-line @next/next/no-img-element */}
                                <img src={profileData.idCardBackPhoto} alt="CCCD Back" className="w-full h-24 object-cover" />
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* ── Referral Points ────────────────────────────────────────── */}
            {user && profileData?.workplaceType === 'STORE' && (
                <div className="mt-3">
                    <p className="text-[9px] font-bold text-gray-400 uppercase tracking-wider px-1 mb-1.5">Điểm giới thiệu</p>
                    <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-3">
                        <ReferralHistorySection employeeId={user.uid} />
                    </div>
                </div>
            )}

            {/* ── Actions ─────────────────────────────────────────────── */}
            <div className="mt-4 space-y-2">
                {/* CCCD Scanner button */}
                <button onClick={() => setIsCCCDOpen(true)}
                    disabled={cccdProcessing}
                    className="w-full flex items-center gap-3 px-4 py-3 bg-white rounded-xl border border-accent-100 shadow-sm active:scale-[0.99] transition-all"
                >
                    <div className="w-8 h-8 rounded-lg bg-accent-50 flex items-center justify-center">
                        {cccdProcessing ? <Loader2 className="w-4 h-4 text-accent-600 animate-spin" /> : <ScanLine className="w-4 h-4 text-accent-600" />}
                    </div>
                    <span className="flex-1 text-left text-xs font-bold text-gray-700">
                        {cccdProcessing ? 'Đang xử lý CCCD...' : profileData.idCard ? 'Quét lại CCCD' : 'Quét CCCD để cập nhật thông tin'}
                    </span>
                    <ChevronRight className="w-4 h-4 text-gray-400" />
                </button>

                <button onClick={startEditing}
                    className="w-full flex items-center gap-3 px-4 py-3 bg-white rounded-xl border border-gray-100 shadow-sm active:scale-[0.99] transition-all">
                    <div className="w-8 h-8 rounded-lg bg-primary-50 flex items-center justify-center"><Edit3 className="w-4 h-4 text-primary-600" /></div>
                    <span className="flex-1 text-left text-xs font-bold text-gray-700">Chỉnh sửa thông tin</span>
                    <ChevronRight className="w-4 h-4 text-gray-400" />
                </button>

                <HardResetButton />

                {/* ── Security & 2FA ──────────────────────────────────── */}
                <div className="pt-2">
                    <p className="text-[9px] font-bold text-gray-400 uppercase tracking-wider px-1 mb-1.5">Bảo mật & Đăng nhập</p>
                    <div className="bg-white rounded-xl border border-gray-100 shadow-sm divide-y divide-gray-50">
                        <button
                            onClick={() => !profileData?.isTwoFactorEnabled && setIs2FAModalOpen(true)}
                            className="w-full flex items-center gap-3 px-3.5 py-3 active:bg-gray-50 transition-colors"
                        >
                            <div className={cn('w-8 h-8 rounded-lg flex items-center justify-center',
                                profileData?.isTwoFactorEnabled ? 'bg-emerald-50' : 'bg-violet-50'
                            )}>
                                {profileData?.isTwoFactorEnabled
                                    ? <ShieldCheck className="w-4 h-4 text-emerald-600" />
                                    : <Shield className="w-4 h-4 text-violet-600" />}
                            </div>
                            <div className="flex-1 min-w-0 text-left">
                                <p className="text-[11px] font-bold text-gray-700">Xác thực 2 bước</p>
                                <p className="text-[9px] text-gray-400">Google Authenticator</p>
                            </div>
                            {profileData?.isTwoFactorEnabled ? (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                                    <CheckCircle2 className="w-2.5 h-2.5" />Đang bật
                                </span>
                            ) : (
                                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[10px] font-bold bg-violet-600 text-white shadow-sm">
                                    <Smartphone className="w-3 h-3" />Thiết lập
                                </span>
                            )}
                        </button>
                    </div>
                </div>

                <button onClick={() => setLogoutConfirmOpen(true)}
                    className="w-full flex items-center gap-3 px-4 py-3 bg-white rounded-xl border border-red-100 shadow-sm active:scale-[0.99] transition-all">
                    <div className="w-8 h-8 rounded-lg bg-red-50 flex items-center justify-center"><LogOut className="w-4 h-4 text-red-600" /></div>
                    <span className="flex-1 text-left text-xs font-bold text-red-600">Đăng xuất</span>
                    <ChevronRight className="w-4 h-4 text-red-300" />
                </button>

                {/* Build version */}
                <p className="text-center text-[9px] text-gray-500 pt-2">
                    Phiên bản: {process.env.NEXT_PUBLIC_BUILD_VERSION || 'dev'}
                </p>
            </div>

            {/* ═══ CAMERA FULLSCREEN ═══ */}
            {isCameraOpen && (
                <SmartPortraitCamera
                    onCapture={handleCapture}
                    onClose={() => setIsCameraOpen(false)}
                />
            )}

            {/* ═══ CCCD CAMERA ═══ */}
            {isCCCDOpen && (
                <CCCDCamera
                    onScanComplete={handleCCCDScanComplete}
                    onClose={() => setIsCCCDOpen(false)}
                />
            )}

            {/* ═══ EDIT BOTTOMSHEET ═══ */}
            <BottomSheet isOpen={editSheetOpen} onClose={() => setEditSheetOpen(false)} title="Chỉnh sửa hồ sơ">
                <div className="px-4 pb-6 space-y-4">
                    {message.text && (
                        <div className={cn('flex items-center gap-2 px-3 py-2 rounded-lg border text-[11px] font-medium',
                            message.type === 'error' ? 'bg-red-50 border-red-200 text-red-700' : 'bg-emerald-50 border-emerald-200 text-emerald-700')}>
                            {message.type === 'error' ? <AlertTriangle className="w-3.5 h-3.5 shrink-0" /> : <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />}
                            {message.text}
                        </div>
                    )}

                    <div>
                        <label className="text-[10px] font-bold text-gray-500 uppercase mb-1 block">Email</label>
                        <input type="email" value={editData.email || ''} onChange={e => handleEditChange('email', e.target.value)}
                            placeholder="your@email.com"
                            className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-xs text-gray-700 bg-gray-50 outline-none focus:border-primary-400" />
                    </div>

                    <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-amber-50 border border-amber-200 text-[10px] text-amber-700 font-medium mb-1">
                        <ScanLine className="w-3.5 h-3.5 shrink-0" />
                        Thông tin CCCD (tên, ngày sinh, giới tính, địa chỉ) chỉ cập nhật qua quét CCCD
                    </div>

                    {['admin', 'store_manager', 'manager'].includes(profileData.role) && (
                        <div>
                            <label className="text-[10px] font-bold text-gray-500 uppercase mb-1 block">Tài khoản ngân hàng</label>
                            <input type="text" value={editData.bankAccount || ''} onChange={e => handleEditChange('bankAccount', e.target.value)}
                                placeholder="Tên NH - Số TK"
                                className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-xs text-gray-700 bg-gray-50 outline-none focus:border-primary-400" />
                        </div>
                    )}

                    <div>
                        <label className="text-[10px] font-bold text-gray-500 uppercase mb-1 block">Trình độ học vấn</label>
                        <input type="text" value={editData.education || ''} onChange={e => handleEditChange('education', e.target.value)}
                            placeholder="VD: Cử nhân CNTT"
                            className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-xs text-gray-700 bg-gray-50 outline-none focus:border-primary-400" />
                    </div>


                    <div className="flex gap-2 pt-2">
                        <button onClick={() => setEditSheetOpen(false)}
                            className="flex-1 py-2.5 rounded-lg border border-gray-200 text-xs font-bold text-gray-600 active:scale-[0.98] transition-all">Hủy</button>
                        <button onClick={handleSave} disabled={saving}
                            className="flex-1 py-2.5 rounded-lg bg-primary-600 text-white text-xs font-bold shadow-sm flex items-center justify-center gap-1.5 disabled:opacity-50 active:scale-[0.98] transition-all">
                            {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle2 className="w-3.5 h-3.5" />}
                            Lưu thay đổi
                        </button>
                    </div>
                </div>
            </BottomSheet>

            {/* ═══ LOGOUT CONFIRM BOTTOMSHEET ═══ */}
            <BottomSheet isOpen={logoutConfirmOpen} onClose={() => setLogoutConfirmOpen(false)} title="Xác nhận đăng xuất">
                <div className="px-4 pb-6">
                    <div className="flex flex-col items-center py-4">
                        <div className="w-14 h-14 rounded-full bg-red-50 flex items-center justify-center mb-3">
                            <LogOut className="w-6 h-6 text-red-500" />
                        </div>
                        <p className="text-sm font-bold text-gray-800 mb-1">Đăng xuất khỏi tài khoản?</p>
                        <p className="text-[11px] text-gray-500 text-center">Bạn sẽ cần đăng nhập lại để tiếp tục sử dụng ứng dụng.</p>
                    </div>
                    <div className="flex gap-2 mt-2">
                        <button onClick={() => setLogoutConfirmOpen(false)}
                            className="flex-1 py-2.5 rounded-lg border border-gray-200 text-xs font-bold text-gray-600 active:scale-[0.98] transition-all">Hủy</button>
                        <button onClick={handleLogout} disabled={loggingOut}
                            className="flex-1 py-2.5 rounded-lg bg-red-600 text-white text-xs font-bold shadow-sm flex items-center justify-center gap-1.5 disabled:opacity-50 active:scale-[0.98] transition-all">
                            {loggingOut ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <LogOut className="w-3.5 h-3.5" />}
                            Đăng xuất
                        </button>
                    </div>
                </div>
            </BottomSheet>

            {/* ═══ 2FA SETUP MODAL ═══ */}
            <TwoFactorSetupModal
                isOpen={is2FAModalOpen}
                onClose={() => setIs2FAModalOpen(false)}
                isTwoFactorEnabled={profileData?.isTwoFactorEnabled}
                onSuccess={() => {
                    setProfileData(prev => prev ? { ...prev, isTwoFactorEnabled: true } : null);
                    setIs2FAModalOpen(false);
                }}
            />
        </MobilePageShell>
    );
}
