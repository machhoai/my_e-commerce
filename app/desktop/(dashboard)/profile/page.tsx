'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { db } from '@/lib/firebase';
import { doc, getDoc } from 'firebase/firestore';
import { UserDoc } from '@/types';
import {
    User, Mail, Phone, Calendar, Briefcase, CreditCard, GraduationCap,
    ShieldCheck, Camera, Loader2, Shield, Smartphone, CheckCircle2, FileText,
} from 'lucide-react';
import SmartPortraitCamera from '@/components/shared/SmartPortraitCamera';
import { convertBase64ToWebP } from '@/lib/utils/image';
import { uploadImageBase64 } from '@/lib/utils/storage-upload';
import TwoFactorSetupModal from '@/components/profile/TwoFactorSetupModal';
import { showToast } from '@/lib/utils/toast';

export default function ProfilePage() {
    const { user } = useAuth();
    const [profileData, setProfileData] = useState<UserDoc | null>(null);
    const [loading, setLoading] = useState(true);

    // Edit states
    const [isEditing, setIsEditing] = useState(false);
    const [editData, setEditData] = useState<Partial<UserDoc>>({});
    const [saving, setSaving] = useState(false);


    // Camera / Avatar
    const [isCameraOpen, setIsCameraOpen] = useState(false);
    const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
    const [isProcessing, setIsProcessing] = useState(false);

    // 2FA
    const [is2FAModalOpen, setIs2FAModalOpen] = useState(false);

    useEffect(() => {
        const fetchProfile = async () => {
            if (!user) return;
            try {
                const docRef = doc(db, 'users', user.uid);
                const docSnap = await getDoc(docRef);
                if (docSnap.exists()) {
                    const data = docSnap.data() as UserDoc;
                    setProfileData(data);
                    if (data.avatar) setAvatarUrl(data.avatar);
                }
            } catch (error) {
                console.error("Lỗi khi tải hồ sơ:", error);
            } finally {
                setLoading(false);
            }
        };
        fetchProfile();
    }, [user]);

    const handleEditChange = (field: keyof UserDoc, value: string) => {
        setEditData(prev => ({ ...prev, [field]: value }));
    };

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!user || !profileData) return;

        setSaving(true);


        try {
            const token = await user.getIdToken();
            const res = await fetch('/api/auth/update-user', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify(editData)
            });

            const data = await res.json();
            if (!res.ok) throw new Error(data.error || 'Không thể cập nhật hồ sơ');

            showToast.success('Cập nhật hồ sơ', 'Cập nhật hồ sơ thành công!');
            setProfileData(prev => prev ? { ...prev, ...editData } : null);
            setIsEditing(false);
        } catch (err: unknown) {
            const msg = err instanceof Error ? err.message : 'Đã xảy ra lỗi';
            showToast.error('Lỗi cập nhật', msg);
        } finally {
            setSaving(false);
        }
    };

    const startEditing = () => {
        if (profileData) {
            setEditData({
                email: profileData.email || '',
                dob: profileData.dob || '',
                bankAccount: profileData.bankAccount || '',
                education: profileData.education || '',
            });
            setIsEditing(true);
        }
    };

    // ── Camera capture handler ───────────────────────────────────────────────
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

    if (loading) {
        return (
            <div className="flex justify-center items-center h-full">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
                <p className="ml-3 text-surface-600">Đang tải hồ sơ...</p>
            </div>
        );
    }

    if (!profileData) {
        return <div className="p-6 text-center text-danger-500">Không tìm thấy dữ liệu hồ sơ.</div>;
    }



    return (
        <div className=" mx-auto space-y-6 animate-in fade-in duration-500 ">
            {/* Header */}
            <div className='mt-4'>
                <h1 className="text-2xl font-bold tracking-tight text-surface-900 border-l-4 border-primary-600 pl-3">Hồ sơ của tôi</h1>
                <p className="text-surface-500 mt-2 text-sm">Xem và quản lý thông tin cá nhân của bạn.</p>
            </div>



            <div className="bg-white rounded-2xl border border-surface-200 shadow-sm overflow-hidden">
                <div className="p-6 sm:p-8">
                    {/* Basic Info Read-Only Header */}
                    <div className="flex flex-col sm:flex-row items-start sm:items-center gap-6 mb-8 pb-8 border-b border-surface-100">
                        {/* Avatar with camera overlay */}
                        <button
                            onClick={() => setIsCameraOpen(true)}
                            className="relative w-24 h-24 rounded-full shrink-0 group cursor-pointer"
                            disabled={isProcessing}
                        >
                            {avatarUrl ? (
                                // eslint-disable-next-line @next/next/no-img-element
                                <img src={avatarUrl} alt="Avatar" className="w-24 h-24 rounded-full object-cover" />
                            ) : (
                                <div className="w-24 h-24 bg-gradient-to-br from-primary-100 to-accent-100 text-primary-600 rounded-full flex justify-center items-center">
                                    <span className="text-3xl font-bold uppercase">{profileData.name?.charAt(0) || 'U'}</span>
                                </div>
                            )}

                            {/* Camera badge */}
                            <div className="absolute -bottom-0.5 -right-0.5 w-8 h-8 rounded-full bg-primary-600 border-[3px] border-white flex items-center justify-center shadow-md opacity-80 group-hover:opacity-100 group-hover:scale-110 transition-all">
                                {isProcessing ? (
                                    <Loader2 className="w-3.5 h-3.5 text-white animate-spin" />
                                ) : (
                                    <Camera className="w-3.5 h-3.5 text-white" />
                                )}
                            </div>
                        </button>

                        <div className="flex-1 space-y-2">
                            <h2 className="text-2xl font-bold text-surface-900">{profileData.name}</h2>
                            <div className="flex flex-wrap gap-3">
                                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-success-50 text-success-700 border border-success-100">
                                    <ShieldCheck className="w-3.5 h-3.5" /> {profileData.role === 'admin' ? 'Quản trị viên' : profileData.role === 'manager' ? 'Quản lý' : 'Nhân viên'}
                                </span>
                                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-accent-50 text-accent-700 border border-accent-100">
                                    {profileData.type === 'FT' ? 'Toàn thời gian' : 'Bán thời gian'}
                                </span>
                            </div>
                            {isProcessing && (
                                <p className="text-xs text-primary-600 font-medium">Đang xử lý ảnh...</p>
                            )}
                        </div>
                        {!isEditing && (
                            <button
                                onClick={startEditing}
                                className="px-5 py-2 bg-surface-900 hover:bg-surface-800 text-white text-sm font-medium rounded-xl transition-all shadow-sm focus:ring-4 focus:ring-surface-200"
                            >
                                Chỉnh sửa thông tin
                            </button>
                        )}
                    </div>

                    {/* Profile Form / Read-Only List */}
                    <form onSubmit={handleSave} className="grid grid-cols-1 md:grid-cols-2 gap-x-12 gap-y-8">
                        {/* Column 1 */}
                        <div className="space-y-6">
                            {/* Read-only system lock fields */}
                            <div className="space-y-1.5">
                                <label className="text-sm font-semibold text-surface-500 flex items-center gap-2">
                                    <Phone className="w-4 h-4 text-surface-400" /> Số điện thoại / ID Đăng nhập
                                </label>
                                <div className="text-surface-900 font-medium px-1 placeholder-input">{profileData.phone}</div>
                                <p className="text-[10px] text-surface-400 ml-1">Liên hệ quản lý để thay đổi.</p>
                            </div>

                            <div className="space-y-1.5">
                                <label className="text-sm font-semibold text-surface-500 flex items-center gap-2">
                                    <User className="w-4 h-4 text-surface-400" /> Số CCCD
                                </label>
                                <div className="text-surface-900 font-medium px-1">{profileData.idCard || <span className="text-surface-400 italic">Chưa cung cấp</span>}</div>
                                <p className="text-[10px] text-surface-400 ml-1">Liên hệ quản lý để thay đổi.</p>
                            </div>

                            {/* Editable Fields */}
                            <div className="space-y-1.5 group">
                                <label className={`text-sm font-semibold flex items-center gap-2 ${isEditing ? 'text-primary-600' : 'text-surface-500'}`}>
                                    <Mail className={`w-4 h-4 ${isEditing ? 'text-primary-500' : 'text-surface-400'}`} /> Địa chỉ Email
                                </label>
                                {isEditing ? (
                                    <input
                                        type="email"
                                        value={editData.email || ''}
                                        onChange={e => handleEditChange('email', e.target.value)}
                                        className="w-full bg-surface-50 border border-surface-200 text-sm rounded-lg focus:ring-primary-500 focus:border-primary-500 block p-2.5 transition-all"
                                        placeholder="your.email@example.com"
                                    />
                                ) : (
                                    <div className="text-surface-900 font-medium px-1">{profileData.email || <span className="text-surface-400 italic">Chưa cung cấp</span>}</div>
                                )}
                            </div>

                        </div>

                        {/* Column 2 */}
                        <div className="space-y-6">
                            <div className="space-y-1.5 group">
                                <label className={`text-sm font-semibold flex items-center gap-2 ${isEditing ? 'text-primary-600' : 'text-surface-500'}`}>
                                    <Calendar className={`w-4 h-4 ${isEditing ? 'text-primary-500' : 'text-surface-400'}`} /> Ngày sinh
                                </label>
                                {isEditing ? (
                                    <input
                                        type="date"
                                        value={editData.dob || ''}
                                        onChange={e => handleEditChange('dob', e.target.value)}
                                        className="w-full bg-surface-50 border border-surface-200 text-sm rounded-lg focus:ring-primary-500 focus:border-primary-500 block p-2.5 transition-all"
                                    />
                                ) : (
                                    <div className="text-surface-900 font-medium px-1">{profileData.dob || <span className="text-surface-400 italic">Chưa cung cấp</span>}</div>
                                )}
                            </div>

                            <div className="space-y-1.5 group">
                                <label className={`text-sm font-semibold flex items-center gap-2 ${isEditing ? 'text-primary-600' : 'text-surface-500'}`}>
                                    <CreditCard className={`w-4 h-4 ${isEditing ? 'text-primary-500' : 'text-surface-400'}`} /> Tài khoản ngân hàng
                                </label>
                                {isEditing ? (
                                    <>
                                        <input
                                            type="text"
                                            inputMode="numeric"
                                            pattern="[0-9]*"
                                            value={editData.bankAccount || ''}
                                            onChange={e => {
                                                const val = e.target.value.replace(/\D/g, '');
                                                handleEditChange('bankAccount', val);
                                            }}
                                            className="w-full bg-surface-50 border border-surface-200 text-sm rounded-lg focus:ring-primary-500 focus:border-primary-500 block p-2.5 transition-all"
                                            placeholder="Nhập số tài khoản Techcombank"
                                        />
                                        <p className="text-xs text-amber-600 font-medium mt-1 flex items-center gap-1.5">
                                            <CreditCard className="w-3.5 h-3.5 shrink-0" />
                                            Chỉ chấp nhận số tài khoản ngân hàng Techcombank
                                        </p>
                                    </>
                                ) : (
                                    <div className="text-surface-900 font-medium px-1">{profileData.bankAccount || <span className="text-surface-400 italic">Chưa cung cấp</span>}</div>
                                )}
                            </div>

                            <div className="space-y-1.5 group">
                                <label className={`text-sm font-semibold flex items-center gap-2 ${isEditing ? 'text-primary-600' : 'text-surface-500'}`}>
                                    <GraduationCap className={`w-4 h-4 ${isEditing ? 'text-primary-500' : 'text-surface-400'}`} /> Trình độ học vấn
                                </label>
                                {isEditing ? (
                                    <input
                                        type="text"
                                        value={editData.education || ''}
                                        onChange={e => handleEditChange('education', e.target.value)}
                                        className="w-full bg-surface-50 border border-surface-200 text-sm rounded-lg focus:ring-primary-500 focus:border-primary-500 block p-2.5 transition-all"
                                        placeholder="VD: Cử nhân CNTT"
                                    />
                                ) : (
                                    <div className="text-surface-900 font-medium px-1">{profileData.education || <span className="text-surface-400 italic">Chưa cung cấp</span>}</div>
                                )}
                            </div>
                        </div>

                        {/* Action Buttons */}
                        {isEditing && (
                            <div className="md:col-span-2 pt-6 border-t border-surface-100 flex items-center justify-end gap-3 mt-4">
                                <button
                                    type="button"
                                    onClick={() => setIsEditing(false)}
                                    className="px-5 py-2.5 text-sm font-semibold text-surface-600 bg-white border border-surface-300 rounded-xl hover:bg-surface-50 transition-colors"
                                >
                                    Hủy
                                </button>
                                <button
                                    type="submit"
                                    disabled={saving}
                                    className="px-6 py-2.5 text-sm font-semibold text-white bg-primary-600 rounded-xl hover:bg-primary-700 shadow-md shadow-primary-500/20 transition-all disabled:opacity-50 flex items-center gap-2"
                                >
                                    {saving && <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>}
                                    Lưu thay đổi
                                </button>
                            </div>
                        )}
                    </form>
                </div>
            </div>

            {/* ═══ Security & 2FA Section ═══ */}
            <div className="bg-white rounded-2xl border border-surface-200 shadow-sm overflow-hidden">
                <div className="px-6 sm:px-8 py-5 border-b border-surface-100">
                    <h3 className="text-base font-bold text-surface-800 flex items-center gap-2">
                        <Shield className="w-4.5 h-4.5 text-violet-500" />
                        Bảo mật & Đăng nhập
                    </h3>
                    <p className="text-xs text-surface-400 mt-0.5">Quản lý cài đặt bảo mật tài khoản của bạn.</p>
                </div>
                <div className="px-6 sm:px-8 py-4">
                    <div className="flex items-center gap-4 py-3">
                        <div className={`w-11 h-11 rounded-xl flex items-center justify-center ${profileData.isTwoFactorEnabled ? 'bg-emerald-50' : 'bg-violet-50'}`}>
                            {profileData.isTwoFactorEnabled
                                ? <ShieldCheck className="w-5 h-5 text-emerald-600" />
                                : <Shield className="w-5 h-5 text-violet-600" />}
                        </div>
                        <div className="flex-1 min-w-0">
                            <p className="text-sm font-bold text-surface-800">Xác thực 2 bước (2FA)</p>
                            <p className="text-xs text-surface-400 mt-0.5">Sử dụng Google Authenticator để bảo vệ tài khoản mỗi lần đăng nhập.</p>
                        </div>
                        {profileData.isTwoFactorEnabled ? (
                            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                                <CheckCircle2 className="w-3.5 h-3.5" />Đang bật
                            </span>
                        ) : (
                            <button
                                onClick={() => setIs2FAModalOpen(true)}
                                className="inline-flex items-center gap-1.5 px-5 py-2 rounded-xl text-sm font-bold bg-gradient-to-r from-violet-600 to-indigo-600 text-white shadow-md shadow-violet-500/20 hover:shadow-violet-500/35 active:scale-[0.97] transition-all"
                            >
                                <Smartphone className="w-4 h-4" />Thiết lập 2FA
                            </button>
                        )}
                    </div>
                </div>
            </div>

            {/* ═══ CAMERA FULLSCREEN ═══ */}
            {isCameraOpen && (
                <SmartPortraitCamera
                    onCapture={handleCapture}
                    onClose={() => setIsCameraOpen(false)}
                />
            )}

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
        </div>
    );
}
