'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { db } from '@/lib/firebase';
import { doc, getDoc } from 'firebase/firestore';
import { UserDoc } from '@/types';
import { User, Mail, Phone, Calendar, Briefcase, CreditCard, GraduationCap, ShieldCheck } from 'lucide-react';

export default function ProfilePage() {
    const { user } = useAuth();
    const [profileData, setProfileData] = useState<UserDoc | null>(null);
    const [loading, setLoading] = useState(true);

    // Edit states
    const [isEditing, setIsEditing] = useState(false);
    const [editData, setEditData] = useState<Partial<UserDoc>>({});
    const [saving, setSaving] = useState(false);
    const [message, setMessage] = useState({ type: '', text: '' });

    useEffect(() => {
        const fetchProfile = async () => {
            if (!user) return;
            try {
                const docRef = doc(db, 'users', user.uid);
                const docSnap = await getDoc(docRef);
                if (docSnap.exists()) {
                    setProfileData(docSnap.data() as UserDoc);
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
        setMessage({ type: '', text: '' });

        try {
            const token = await user.getIdToken();
            const res = await fetch('/api/auth/update-user', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify(editData) // employee can only update themselves
            });

            const data = await res.json();
            if (!res.ok) throw new Error(data.error || 'Không thể cập nhật hồ sơ');

            setMessage({ type: 'success', text: 'Cập nhật hồ sơ thành công!' });
            setProfileData(prev => prev ? { ...prev, ...editData } : null);
            setIsEditing(false);
        } catch (err: any) {
            setMessage({ type: 'error', text: err.message || 'Đã xảy ra lỗi' });
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

    if (loading) {
        return (
            <div className="flex justify-center items-center h-full">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
                <p className="ml-3 text-slate-600">Đang tải hồ sơ...</p>
            </div>
        );
    }

    if (!profileData) {
        return <div className="p-6 text-center text-red-500">Không tìm thấy dữ liệu hồ sơ.</div>;
    }

    return (
        <div className="max-w-4xl mx-auto space-y-6 animate-in fade-in duration-500">
            {/* Header */}
            <div>
                <h1 className="text-2xl font-bold tracking-tight text-slate-900 border-l-4 border-blue-600 pl-3">Hồ sơ của tôi</h1>
                <p className="text-slate-500 mt-2 text-sm">Xem và quản lý thông tin cá nhân của bạn.</p>
            </div>

            {/* Messages */}
            {message.text && (
                <div className={`p-4 rounded-xl text-sm border ${message.type === 'error' ? 'bg-red-50 text-red-600 border-red-200' : 'bg-emerald-50 text-emerald-600 border-emerald-200'} flex items-start gap-3`}>
                    <ShieldCheck className="w-5 h-5 shrink-0 mt-0.5" />
                    <p>{message.text}</p>
                </div>
            )}

            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                <div className="p-6 sm:p-8">
                    {/* Basic Info Read-Only Header */}
                    <div className="flex flex-col sm:flex-row items-start sm:items-center gap-6 mb-8 pb-8 border-b border-slate-100">
                        <div className="w-24 h-24 bg-gradient-to-br from-blue-100 to-indigo-100 text-blue-600 rounded-full flex justify-center items-center shrink-0">
                            <span className="text-3xl font-bold uppercase">{profileData.name?.charAt(0) || 'U'}</span>
                        </div>
                        <div className="flex-1 space-y-2">
                            <h2 className="text-2xl font-bold text-slate-900">{profileData.name}</h2>
                            <div className="flex flex-wrap gap-3">
                                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-blue-50 text-blue-700 border border-blue-100">
                                    <Briefcase className="w-3.5 h-3.5" /> {profileData.jobTitle || 'Nhân viên'}
                                </span>
                                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-100">
                                    <ShieldCheck className="w-3.5 h-3.5" /> {profileData.role === 'admin' ? 'Quản trị viên' : profileData.role === 'manager' ? 'Quản lý' : 'Nhân viên'}
                                </span>
                                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-purple-50 text-purple-700 border border-purple-100">
                                    {profileData.type === 'FT' ? 'Toàn thời gian' : 'Bán thời gian'}
                                </span>
                            </div>
                        </div>
                        {!isEditing && (
                            <button
                                onClick={startEditing}
                                className="px-5 py-2 bg-slate-900 hover:bg-slate-800 text-white text-sm font-medium rounded-xl transition-all shadow-sm focus:ring-4 focus:ring-slate-200"
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
                                <label className="text-sm font-semibold text-slate-500 flex items-center gap-2">
                                    <Phone className="w-4 h-4 text-slate-400" /> Số điện thoại / ID Đăng nhập
                                </label>
                                <div className="text-slate-900 font-medium px-1 placeholder-input">{profileData.phone}</div>
                                <p className="text-[10px] text-slate-400 ml-1">Liên hệ quản lý để thay đổi.</p>
                            </div>

                            <div className="space-y-1.5">
                                <label className="text-sm font-semibold text-slate-500 flex items-center gap-2">
                                    <User className="w-4 h-4 text-slate-400" /> Số CCCD
                                </label>
                                <div className="text-slate-900 font-medium px-1">{profileData.idCard || <span className="text-slate-400 italic">Chưa cung cấp</span>}</div>
                                <p className="text-[10px] text-slate-400 ml-1">Liên hệ quản lý để thay đổi.</p>
                            </div>

                            {/* Editable Fields */}
                            <div className="space-y-1.5 group">
                                <label className={`text-sm font-semibold flex items-center gap-2 ${isEditing ? 'text-blue-600' : 'text-slate-500'}`}>
                                    <Mail className={`w-4 h-4 ${isEditing ? 'text-blue-500' : 'text-slate-400'}`} /> Địa chỉ Email
                                </label>
                                {isEditing ? (
                                    <input
                                        type="email"
                                        value={editData.email || ''}
                                        onChange={e => handleEditChange('email', e.target.value)}
                                        className="w-full bg-slate-50 border border-slate-200 text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 block p-2.5 transition-all"
                                        placeholder="your.email@example.com"
                                    />
                                ) : (
                                    <div className="text-slate-900 font-medium px-1">{profileData.email || <span className="text-slate-400 italic">Chưa cung cấp</span>}</div>
                                )}
                            </div>
                        </div>

                        {/* Column 2 */}
                        <div className="space-y-6">
                            <div className="space-y-1.5 group">
                                <label className={`text-sm font-semibold flex items-center gap-2 ${isEditing ? 'text-blue-600' : 'text-slate-500'}`}>
                                    <Calendar className={`w-4 h-4 ${isEditing ? 'text-blue-500' : 'text-slate-400'}`} /> Ngày sinh
                                </label>
                                {isEditing ? (
                                    <input
                                        type="date"
                                        value={editData.dob || ''}
                                        onChange={e => handleEditChange('dob', e.target.value)}
                                        className="w-full bg-slate-50 border border-slate-200 text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 block p-2.5 transition-all"
                                    />
                                ) : (
                                    <div className="text-slate-900 font-medium px-1">{profileData.dob || <span className="text-slate-400 italic">Chưa cung cấp</span>}</div>
                                )}
                            </div>

                            <div className="space-y-1.5 group">
                                <label className={`text-sm font-semibold flex items-center gap-2 ${isEditing ? 'text-blue-600' : 'text-slate-500'}`}>
                                    <CreditCard className={`w-4 h-4 ${isEditing ? 'text-blue-500' : 'text-slate-400'}`} /> Tài khoản ngân hàng
                                </label>
                                {isEditing ? (
                                    <input
                                        type="text"
                                        value={editData.bankAccount || ''}
                                        onChange={e => handleEditChange('bankAccount', e.target.value)}
                                        className="w-full bg-slate-50 border border-slate-200 text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 block p-2.5 transition-all"
                                        placeholder="Tên Ngân hàng - Số tài khoản"
                                    />
                                ) : (
                                    <div className="text-slate-900 font-medium px-1">{profileData.bankAccount || <span className="text-slate-400 italic">Chưa cung cấp</span>}</div>
                                )}
                            </div>

                            <div className="space-y-1.5 group">
                                <label className={`text-sm font-semibold flex items-center gap-2 ${isEditing ? 'text-blue-600' : 'text-slate-500'}`}>
                                    <GraduationCap className={`w-4 h-4 ${isEditing ? 'text-blue-500' : 'text-slate-400'}`} /> Trình độ học vấn
                                </label>
                                {isEditing ? (
                                    <input
                                        type="text"
                                        value={editData.education || ''}
                                        onChange={e => handleEditChange('education', e.target.value)}
                                        className="w-full bg-slate-50 border border-slate-200 text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 block p-2.5 transition-all"
                                        placeholder="VD: Cử nhân CNTT"
                                    />
                                ) : (
                                    <div className="text-slate-900 font-medium px-1">{profileData.education || <span className="text-slate-400 italic">Chưa cung cấp</span>}</div>
                                )}
                            </div>
                        </div>

                        {/* Action Buttons */}
                        {isEditing && (
                            <div className="md:col-span-2 pt-6 border-t border-slate-100 flex items-center justify-end gap-3 mt-4">
                                <button
                                    type="button"
                                    onClick={() => setIsEditing(false)}
                                    className="px-5 py-2.5 text-sm font-semibold text-slate-600 bg-white border border-slate-300 rounded-xl hover:bg-slate-50 transition-colors"
                                >
                                    Hủy
                                </button>
                                <button
                                    type="submit"
                                    disabled={saving}
                                    className="px-6 py-2.5 text-sm font-semibold text-white bg-blue-600 rounded-xl hover:bg-blue-700 shadow-md shadow-blue-500/20 transition-all disabled:opacity-50 flex items-center gap-2"
                                >
                                    {saving && <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>}
                                    Lưu thay đổi
                                </button>
                            </div>
                        )}
                    </form>
                </div>
            </div>
        </div>
    );
}
