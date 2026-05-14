'use client';

/**
 * UserInfoEditor.tsx
 * ─────────────────────────────────────────────────────────────
 * Component chỉnh sửa thông tin nhân viên dùng chung trên toàn hệ thống.
 * 
 * Tính năng:
 * - Hiển thị + chỉnh sửa các trường trong UserDoc
 * - Phân quyền: ẩn/hiện nút sửa theo role + custom permissions
 * - Tích hợp ContractSection cho hợp đồng
 * - Dùng được ở desktop lẫn mobile
 * 
 * KHÔNG thay thế profile popup — dùng song song.
 */

import { useState, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { UserDoc } from '@/types';
import { showToast } from '@/lib/utils/toast';
import {
    User, Phone, Mail, Calendar, CreditCard, GraduationCap,
    Briefcase, IdCard, MapPin, Pencil, X, Check, Loader2,
    Shield, Building2,
} from 'lucide-react';
import ContractSection from '@/components/shared/ContractSection';

// ── Field config ────────────────────────────────────────────
interface FieldDef {
    key: keyof UserDoc;
    label: string;
    icon: React.ReactNode;
    type: 'text' | 'date' | 'select' | 'readonly';
    placeholder?: string;
    /** Ai được sửa: 'self' = bản thân, 'manager' = quản lý trở lên, 'admin' = chỉ admin */
    editableBy: 'self' | 'manager' | 'admin';
    /** Custom permission key nếu có */
    permissionKey?: string;
    options?: { value: string; label: string }[];
    group: 'personal' | 'work' | 'account';
}

const FIELD_DEFS: FieldDef[] = [
    // ── Thông tin cá nhân ──
    { key: 'name', label: 'Họ và tên', icon: <User className="w-4 h-4" />, type: 'text', placeholder: 'Nguyễn Văn A', editableBy: 'manager', group: 'personal' },
    { key: 'phone', label: 'Số điện thoại', icon: <Phone className="w-4 h-4" />, type: 'text', placeholder: '0912345678', editableBy: 'admin', group: 'personal' },
    { key: 'dob', label: 'Ngày sinh', icon: <Calendar className="w-4 h-4" />, type: 'date', editableBy: 'self', group: 'personal' },
    { key: 'gender', label: 'Giới tính', icon: <User className="w-4 h-4" />, type: 'select', editableBy: 'manager', group: 'personal', options: [
        { value: '', label: 'Chưa xác định' },
        { value: 'Nam', label: 'Nam' },
        { value: 'Nữ', label: 'Nữ' },
    ]},
    { key: 'email', label: 'Email', icon: <Mail className="w-4 h-4" />, type: 'text', placeholder: 'email@example.com', editableBy: 'self', group: 'personal' },
    { key: 'permanentAddress', label: 'Địa chỉ thường trú', icon: <MapPin className="w-4 h-4" />, type: 'text', placeholder: 'Số nhà, đường, quận/huyện...', editableBy: 'manager', group: 'personal' },
    { key: 'idCard', label: 'Số CCCD/CMND', icon: <IdCard className="w-4 h-4" />, type: 'text', placeholder: '001234567890', editableBy: 'manager', group: 'personal' },

    // ── Thông tin công việc ──
    { key: 'jobTitle', label: 'Chức danh', icon: <Briefcase className="w-4 h-4" />, type: 'text', placeholder: 'Nhân viên bán hàng', editableBy: 'manager', group: 'work' },
    { key: 'type', label: 'Loại nhân viên', icon: <Shield className="w-4 h-4" />, type: 'select', editableBy: 'manager', group: 'work', options: [
        { value: 'FT', label: 'Toàn thời gian (FT)' },
        { value: 'PT', label: 'Bán thời gian (PT)' },
    ]},
    { key: 'education', label: 'Trình độ học vấn', icon: <GraduationCap className="w-4 h-4" />, type: 'text', placeholder: 'Cử nhân, Kỹ sư...', editableBy: 'manager', group: 'work' },

    // ── Tài khoản ──
    { key: 'bankAccount', label: 'Tài khoản ngân hàng', icon: <CreditCard className="w-4 h-4" />, type: 'text', placeholder: 'STK - Tên ngân hàng', editableBy: 'self', group: 'account' },
];

const GROUP_LABELS: Record<string, { label: string; icon: React.ReactNode }> = {
    personal: { label: 'Thông tin cá nhân', icon: <User className="w-3.5 h-3.5" /> },
    work: { label: 'Công việc', icon: <Building2 className="w-3.5 h-3.5" /> },
    account: { label: 'Tài khoản', icon: <CreditCard className="w-3.5 h-3.5" /> },
};

// ── Props ────────────────────────────────────────────────────
interface UserInfoEditorProps {
    /** Nhân viên cần chỉnh sửa */
    employee: UserDoc;
    /** Callback sau khi update thành công */
    onUpdated: () => void;
    /** Ẩn phần hợp đồng (nếu ContractSection đã hiện ở chỗ khác) */
    hideContract?: boolean;
    /** Layout compact (mobile) hoặc full (desktop) */
    variant?: 'compact' | 'full';
}

export default function UserInfoEditor({
    employee,
    onUpdated,
    hideContract = false,
    variant = 'full',
}: UserInfoEditorProps) {
    const { user, userDoc, hasPermission } = useAuth();

    const [editing, setEditing] = useState(false);
    const [saving, setSaving] = useState(false);
    const [editData, setEditData] = useState<Record<string, string>>({});

    // ── Permission check ─────────────────────────────────────
    const isSelf = user?.uid === employee.uid;
    const isAdmin = userDoc?.role === 'admin' || userDoc?.role === 'super_admin';
    const isManager = userDoc?.role === 'store_manager' || userDoc?.canManageHR === true;

    function canEditField(field: FieldDef): boolean {
        // Nếu có permission key riêng, kiểm tra
        if (field.permissionKey && !hasPermission(field.permissionKey)) return false;
        
        switch (field.editableBy) {
            case 'admin': return isAdmin;
            case 'manager': return isAdmin || isManager;
            case 'self': return isAdmin || isManager || isSelf;
            default: return false;
        }
    }

    const editableFields = FIELD_DEFS.filter(f => canEditField(f));
    const hasAnyEditable = editableFields.length > 0;

    // ── Start editing ────────────────────────────────────────
    const startEdit = () => {
        const data: Record<string, string> = {};
        for (const f of editableFields) {
            data[f.key] = String((employee as unknown as Record<string, unknown>)[f.key] || '');
        }
        setEditData(data);
        setEditing(true);
    };

    const cancelEdit = () => setEditing(false);

    const handleChange = (key: string, value: string) => {
        setEditData(prev => ({ ...prev, [key]: value }));
    };

    // ── Save ─────────────────────────────────────────────────
    const handleSave = useCallback(async () => {
        if (!user) return;
        setSaving(true);

        try {
            const token = await user.getIdToken();
            const payload: Record<string, unknown> = {};

            // Chỉ gửi các field đã thay đổi
            for (const f of editableFields) {
                const newVal = editData[f.key] ?? '';
                const oldVal = String((employee as unknown as Record<string, unknown>)[f.key] || '');
                if (newVal !== oldVal) {
                    payload[f.key] = newVal;
                }
            }

            if (Object.keys(payload).length === 0) {
                showToast.info('Không có thay đổi', 'Dữ liệu chưa được chỉnh sửa.');
                setEditing(false);
                setSaving(false);
                return;
            }

            // Xác định target
            if (!isSelf) {
                payload.targetUid = employee.uid;
            }

            const res = await fetch('/api/auth/update-user', {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${token}`,
                },
                body: JSON.stringify(payload),
            });

            if (!res.ok) {
                const data = await res.json().catch(() => ({}));
                throw new Error(data.error || 'Lỗi cập nhật');
            }

            showToast.success('Đã cập nhật', 'Thông tin nhân viên đã được lưu.');
            setEditing(false);
            onUpdated();
        } catch (err) {
            console.error('[UserInfoEditor] Save error:', err);
            showToast.error('Lỗi cập nhật', err instanceof Error ? err.message : 'Vui lòng thử lại.');
        } finally {
            setSaving(false);
        }
    }, [user, employee, editData, editableFields, isSelf, onUpdated]);

    // ── Render helpers ───────────────────────────────────────
    const isCompact = variant === 'compact';
    const gridCols = isCompact ? 'grid-cols-1' : 'grid-cols-1 md:grid-cols-2';

    function renderField(field: FieldDef) {
        const editable = editing && canEditField(field);
        const value = editable
            ? (editData[field.key] ?? '')
            : String((employee as unknown as Record<string, unknown>)[field.key] || '');

        return (
            <div key={field.key} className="space-y-1">
                <label className={`text-[10px] font-bold uppercase tracking-wider flex items-center gap-1.5 ${
                    editable ? 'text-primary-600' : 'text-gray-400'
                }`}>
                    <span className={editable ? 'text-primary-500' : 'text-gray-400'}>{field.icon}</span>
                    {field.label}
                </label>

                {editable ? (
                    field.type === 'select' ? (
                        <select
                            value={value}
                            onChange={e => handleChange(field.key, e.target.value)}
                            className="w-full bg-white border border-gray-200 text-sm rounded-xl px-3 py-2.5 outline-none focus:ring-2 focus:ring-primary-500/30 focus:border-primary-400 transition-all"
                        >
                            {field.options?.map(opt => (
                                <option key={opt.value} value={opt.value}>{opt.label}</option>
                            ))}
                        </select>
                    ) : (
                        <input
                            type={field.type === 'date' ? 'date' : 'text'}
                            value={value}
                            onChange={e => handleChange(field.key, e.target.value)}
                            placeholder={field.placeholder}
                            className="w-full bg-white border border-gray-200 text-sm rounded-xl px-3 py-2.5 outline-none focus:ring-2 focus:ring-primary-500/30 focus:border-primary-400 transition-all"
                        />
                    )
                ) : (
                    <div className="text-sm font-medium text-gray-800 px-1 py-1">
                        {field.type === 'select' && field.options
                            ? (field.options.find(o => o.value === value)?.label || value || <span className="text-gray-400 italic">Chưa cung cấp</span>)
                            : (value || <span className="text-gray-400 italic">Chưa cung cấp</span>)
                        }
                    </div>
                )}
            </div>
        );
    }

    // ── Group fields ─────────────────────────────────────────
    const groups = ['personal', 'work', 'account'] as const;

    return (
        <div className="space-y-5">
            {/* ── Header + Edit button ── */}
            <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold text-gray-700 flex items-center gap-2">
                    <User className="w-4 h-4 text-primary-500" />
                    Thông tin nhân viên
                </h3>
                {hasAnyEditable && !editing && (
                    <button
                        onClick={startEdit}
                        className="flex items-center gap-1.5 text-[12px] font-bold text-primary-600 hover:text-primary-700 transition-colors px-3 py-1.5 rounded-lg hover:bg-primary-50"
                    >
                        <Pencil className="w-3.5 h-3.5" /> Chỉnh sửa
                    </button>
                )}
                {editing && (
                    <div className="flex items-center gap-2">
                        <button
                            onClick={cancelEdit}
                            disabled={saving}
                            className="flex items-center gap-1 text-[12px] font-bold text-gray-500 hover:text-gray-700 transition-colors px-2.5 py-1.5 rounded-lg hover:bg-gray-100"
                        >
                            <X className="w-3.5 h-3.5" /> Hủy
                        </button>
                        <button
                            onClick={handleSave}
                            disabled={saving}
                            className="flex items-center gap-1 text-[12px] font-bold text-white bg-primary-600 hover:bg-primary-700 transition-colors px-3 py-1.5 rounded-lg disabled:opacity-50"
                        >
                            {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                            Lưu
                        </button>
                    </div>
                )}
            </div>

            {/* ── Field groups ── */}
            {groups.map(groupKey => {
                const groupFields = FIELD_DEFS.filter(f => f.group === groupKey);
                if (groupFields.length === 0) return null;
                const groupMeta = GROUP_LABELS[groupKey];

                return (
                    <div key={groupKey} className="space-y-3">
                        <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider flex items-center gap-1.5 px-1">
                            {groupMeta.icon} {groupMeta.label}
                        </p>
                        <div className={`grid ${gridCols} gap-x-6 gap-y-3 px-1`}>
                            {groupFields.map(f => renderField(f))}
                        </div>
                    </div>
                );
            })}

            {/* ── Contract Section (nếu không ẩn) ── */}
            {!hideContract && (
                <div className="pt-2 border-t border-gray-100">
                    <ContractSection employee={employee} onUpdated={onUpdated} />
                </div>
            )}
        </div>
    );
}
