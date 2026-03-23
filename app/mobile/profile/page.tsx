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
    CheckCircle2, AlertTriangle, Lock,
} from 'lucide-react';
import MobilePageShell from '@/components/mobile/MobilePageShell';
import BottomSheet from '@/components/shared/BottomSheet';

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

    useEffect(() => {
        if (!user) return;
        (async () => {
            try {
                const snap = await getDoc(doc(db, 'users', user.uid));
                if (snap.exists()) setProfileData(snap.data() as UserDoc);
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
            ],
        },
        {
            title: 'Thông tin cá nhân',
            items: [
                { icon: <Mail className="w-4 h-4" />, label: 'Email', value: profileData.email || 'Chưa cung cấp' },
                { icon: <Calendar className="w-4 h-4" />, label: 'Ngày sinh', value: profileData.dob || 'Chưa cung cấp' },
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
                <div className="w-20 h-20 bg-gradient-to-br from-primary-400 to-primary-600 rounded-full flex items-center justify-center shadow-lg shadow-primary-200 mb-3">
                    <span className="text-2xl font-black text-white uppercase">{firstName.charAt(0)}</span>
                </div>
                <h2 className="text-lg font-black text-gray-800">{profileData.name}</h2>
                <div className="flex items-center gap-1.5 mt-1.5 flex-wrap justify-center">
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-bold bg-primary-50 text-primary-700 border border-primary-100">
                        <Briefcase className="w-2.5 h-2.5" />{profileData.jobTitle || 'Nhân viên'}
                    </span>
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-100">
                        <ShieldCheck className="w-2.5 h-2.5" />{ROLE_LABELS[profileData.role] || profileData.role}
                    </span>
                    <span className="inline-flex px-2 py-0.5 rounded-full text-[9px] font-bold bg-amber-50 text-amber-700 border border-amber-100">
                        {profileData.type === 'FT' ? 'Toàn thời gian' : 'Bán thời gian'}
                    </span>
                </div>
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

            {/* ── Actions ─────────────────────────────────────────────── */}
            <div className="mt-4 space-y-2">
                <button onClick={startEditing}
                    className="w-full flex items-center gap-3 px-4 py-3 bg-white rounded-xl border border-gray-100 shadow-sm active:scale-[0.99] transition-all">
                    <div className="w-8 h-8 rounded-lg bg-primary-50 flex items-center justify-center"><Edit3 className="w-4 h-4 text-primary-600" /></div>
                    <span className="flex-1 text-left text-xs font-bold text-gray-700">Chỉnh sửa thông tin</span>
                    <ChevronRight className="w-4 h-4 text-gray-400" />
                </button>

                <button onClick={() => setLogoutConfirmOpen(true)}
                    className="w-full flex items-center gap-3 px-4 py-3 bg-white rounded-xl border border-red-100 shadow-sm active:scale-[0.99] transition-all">
                    <div className="w-8 h-8 rounded-lg bg-red-50 flex items-center justify-center"><LogOut className="w-4 h-4 text-red-600" /></div>
                    <span className="flex-1 text-left text-xs font-bold text-red-600">Đăng xuất</span>
                    <ChevronRight className="w-4 h-4 text-red-300" />
                </button>
            </div>

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

                    <div>
                        <label className="text-[10px] font-bold text-gray-500 uppercase mb-1 block">Ngày sinh</label>
                        <input type="date" value={editData.dob || ''} onChange={e => handleEditChange('dob', e.target.value)}
                            className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-xs text-gray-700 bg-gray-50 outline-none focus:border-primary-400" />
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
        </MobilePageShell>
    );
}
