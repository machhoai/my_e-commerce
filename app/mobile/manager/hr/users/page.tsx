'use client';

import {
    useState, useEffect, useCallback, useMemo, Suspense,
} from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { db } from '@/lib/firebase';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import {
    UserDoc, EmployeeType, UserRole, StoreDoc, OfficeDoc,
    WarehouseDoc, CustomRoleDoc,
} from '@/types';
import {
    Users, Search, Plus, X, ChevronLeft, ChevronRight, UserCheck,
    UserX, FileWarning, Award, CheckCircle2, AlertTriangle,
    Shield, Building2, KeyRound, Filter, SlidersHorizontal,
    MailPlus, Briefcase, RotateCcw, UserMinus, ChevronDown,
    Phone, Mail, CreditCard, GraduationCap, Calendar,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import BottomSheet from '@/components/shared/BottomSheet';
import EmployeeProfilePopup from '@/components/shared/EmployeeProfilePopup';

// ─── Types ───────────────────────────────────────────────────────────────────
interface FormState {
    name: string;
    phone: string;
    type: EmployeeType;
    role: UserRole;
    customRoleId: string;
    dob: string;
    jobTitle: string;
    email: string;
    idCard: string;
    bankAccount: string;
    education: string;
    storeId: string;
    officeId: string;
    warehouseId: string;
    workplaceType: 'STORE' | 'OFFICE' | 'CENTRAL';
}

const EMPTY_FORM: FormState = {
    name: '', phone: '', type: 'PT', role: 'employee', customRoleId: '',
    dob: '', jobTitle: '', email: '', idCard: '', bankAccount: '',
    education: '', storeId: '', officeId: '', warehouseId: '', workplaceType: 'STORE',
};

// ─── Helpers ─────────────────────────────────────────────────────────────────
function initials(name: string) {
    return name.split(' ').slice(-1)[0]?.[0]?.toUpperCase() || '?';
}

function isProfileComplete(e: UserDoc): boolean {
    const hasValidEmail = !!e.email && e.email.includes('@') && !e.email.endsWith('@company.com');
    if (!hasValidEmail) return false;
    const isAdmin = e.role === 'admin' || e.role === 'super_admin';
    if (isAdmin) return true;
    return !!(e.avatar && e.idCard && e.dob && e.gender && e.permanentAddress && e.idCardFrontPhoto && e.idCardBackPhoto);
}

// ─── Sub-components ───────────────────────────────────────────────────────────

/** Sticky top header */
function PageHeader({
    title, onBack, headerRight,
}: { title: string; onBack: () => void; headerRight?: React.ReactNode }) {
    return (
        <header className="sticky top-0 z-40 bg-white/96 backdrop-blur-md border-b border-gray-100">
            <div className="flex items-center gap-3 px-4 py-3">
                <button
                    onClick={onBack}
                    className="w-9 h-9 rounded-xl bg-gray-100 flex items-center justify-center active:scale-95 transition-transform shrink-0"
                >
                    <ChevronLeft className="w-5 h-5 text-gray-600" />
                </button>
                <h1 className="text-base font-bold text-gray-900 truncate flex-1">{title}</h1>
                {headerRight}
            </div>
        </header>
    );
}

/** KPI strip */
function StatsStrip({ active, inactive, incomplete, total }: {
    active: number; inactive: number; incomplete: number; total: number;
}) {
    const items = [
        { label: 'Đang làm', value: active, color: 'text-emerald-600', bg: 'bg-emerald-50' },
        { label: 'Nghỉ việc', value: inactive, color: 'text-rose-500', bg: 'bg-rose-50' },
        { label: 'Thiếu hồ sơ', value: incomplete, color: 'text-amber-600', bg: 'bg-amber-50' },
        { label: 'Tổng', value: total, color: 'text-primary-600', bg: 'bg-primary-50' },
    ];
    return (
        <div className="grid grid-cols-4 gap-2 px-4 py-3">
            {items.map(i => (
                <div key={i.label} className={cn('rounded-2xl p-3 flex flex-col gap-0.5', i.bg)}>
                    <span className={cn('text-xl font-black leading-tight', i.color)}>{i.value}</span>
                    <span className="text-[9px] font-semibold text-gray-400 uppercase tracking-wide leading-tight">{i.label}</span>
                </div>
            ))}
        </div>
    );
}

/** Search + filter bar */
function SearchBar({
    value, onChange, onFilter, activeFilters,
}: {
    value: string; onChange: (v: string) => void; onFilter: () => void; activeFilters: number;
}) {
    return (
        <div className="px-4 pb-3 flex gap-2">
            <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
                <input
                    type="text"
                    value={value}
                    onChange={e => onChange(e.target.value)}
                    placeholder="Tìm theo tên hoặc SĐT..."
                    className="w-full pl-9 pr-4 py-2.5 rounded-xl bg-gray-100 text-sm text-gray-900 placeholder-gray-400 outline-none focus:ring-2 focus:ring-primary-400/50 transition"
                />
                {value && (
                    <button onClick={() => onChange('')} className="absolute right-3 top-1/2 -translate-y-1/2">
                        <X className="w-3.5 h-3.5 text-gray-400" />
                    </button>
                )}
            </div>
            <button
                onClick={onFilter}
                className={cn(
                    'w-10 h-10 rounded-xl flex items-center justify-center relative transition active:scale-95',
                    activeFilters > 0 ? 'bg-primary-600 text-white' : 'bg-gray-100 text-gray-600',
                )}
            >
                <SlidersHorizontal className="w-4 h-4" />
                {activeFilters > 0 && (
                    <span className="absolute -top-1 -right-1 w-4 h-4 bg-rose-500 text-white text-[9px] font-bold rounded-full flex items-center justify-center">
                        {activeFilters}
                    </span>
                )}
            </button>
        </div>
    );
}

/** Employee card */
function EmployeeCard({
    employee, kpiAvg, customRoles, storeMap, onPress, onEdit, onToggle, isLoading,
}: {
    employee: UserDoc;
    kpiAvg?: { avgOfficial: number; count: number };
    customRoles: CustomRoleDoc[];
    storeMap: Map<string, string>;
    onPress: () => void;
    onEdit: () => void;
    onToggle: () => void;
    isLoading: boolean;
}) {
    const isActive = employee.isActive !== false;
    const profileOk = isProfileComplete(employee);

    // Resolve role display
    const colorMap: Record<string, string> = {
        red: 'bg-rose-100 text-rose-700',
        purple: 'bg-violet-100 text-violet-700',
        amber: 'bg-amber-100 text-amber-700',
        blue: 'bg-primary-100 text-primary-700',
        emerald: 'bg-emerald-100 text-emerald-700',
        indigo: 'bg-indigo-100 text-indigo-700',
        pink: 'bg-pink-100 text-pink-700',
        slate: 'bg-gray-100 text-gray-600',
    };

    let roleName = 'Nhân viên';
    let roleColor = 'bg-gray-100 text-gray-600';

    if (employee.customRoleId) {
        const cr = customRoles.find(r => r.id === employee.customRoleId);
        if (cr) { roleName = cr.name; roleColor = colorMap[cr.color || 'slate'] || roleColor; }
    } else {
        const sysRole = customRoles.find(r => r.isSystem && r.id === employee.role);
        roleName = sysRole?.name ?? (
            employee.role === 'store_manager' ? 'CH Trưởng' :
                employee.role === 'manager' ? 'Quản lý' :
                    employee.role === 'admin' ? 'Admin' : 'Nhân viên'
        );
        roleColor = sysRole ? (colorMap[sysRole.color || 'slate'] || roleColor) : roleColor;
    }

    const kpiScore = kpiAvg && kpiAvg.count > 0 ? kpiAvg.avgOfficial : null;
    const kpiColor = kpiScore === null ? '' :
        kpiScore >= 80 ? 'text-emerald-600' :
            kpiScore >= 50 ? 'text-amber-600' : 'text-rose-600';

    const storeName = employee.officeId
        ? storeMap.get(employee.officeId) ?? null
        : employee.warehouseId
            ? storeMap.get(employee.warehouseId) ?? null
            : employee.storeId
                ? storeMap.get(employee.storeId) ?? null
                : null;
    const locationIcon = employee.workplaceType === 'OFFICE' ? '🏢' : employee.workplaceType === 'CENTRAL' ? '🏭' : '🏪';

    return (
        <div
            className={cn(
                'bg-white rounded-2xl border shadow-sm overflow-hidden active:scale-[0.99] transition-transform',
                isActive ? 'border-gray-100' : 'border-gray-100 opacity-70',
            )}
        >
            {/* Main row — tap to view profile */}
            <button
                className="w-full flex items-center gap-3 px-4 py-3.5 text-left"
                onClick={onPress}
            >
                {/* Avatar */}
                <div className={cn(
                    'w-11 h-11 rounded-full flex items-center justify-center text-sm font-bold shrink-0 overflow-hidden',
                    !employee.avatar && (isActive
                        ? 'bg-gradient-to-br from-primary-400 to-violet-500 text-white'
                        : 'bg-gray-200 text-gray-400'),
                )}>
                    {employee.avatar
                        // eslint-disable-next-line @next/next/no-img-element
                        ? <img src={employee.avatar} alt={employee.name} className="w-full h-full object-cover" />
                        : initials(employee.name)}
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                        <p className={cn('font-semibold text-sm truncate', isActive ? 'text-gray-900' : 'text-gray-400')}>
                            {employee.name}
                        </p>
                        {!isActive && (
                            <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-gray-100 text-gray-400 shrink-0">
                                Nghỉ việc
                            </span>
                        )}
                    </div>
                    <p className="text-xs text-gray-400 mt-0.5">{employee.phone}</p>
                    <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
                        <span className={cn('text-[10px] font-bold px-2 py-0.5 rounded-lg', roleColor)}>
                            {roleName}
                        </span>
                        <span className={cn(
                            'text-[10px] font-bold px-2 py-0.5 rounded-lg',
                            employee.type === 'FT' ? 'bg-primary-50 text-primary-700' : 'bg-violet-50 text-violet-700',
                        )}>
                            {employee.type === 'FT' ? 'Toàn thời gian' : 'Bán thời gian'}
                        </span>
                        {storeName && (
                            <span className="text-[10px] font-medium px-2 py-0.5 rounded-lg bg-gray-50 text-gray-500 border border-gray-100 truncate max-w-[100px]">
                                {locationIcon}{storeName}
                            </span>
                        )}
                    </div>
                </div>

                {/* Right side */}
                <div className="flex flex-col items-end gap-1.5 shrink-0">
                    {kpiScore !== null && (
                        <span className={cn('text-sm font-black', kpiColor)}>{kpiScore}</span>
                    )}
                    {profileOk
                        ? <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                        : <AlertTriangle className="w-4 h-4 text-amber-500" />}
                    <ChevronRight className="w-4 h-4 text-gray-300" />
                </div>
            </button>

            {/* Action row */}
            <div className="flex border-t border-gray-50">
                <button
                    onClick={onEdit}
                    disabled={isLoading}
                    className="flex-1 py-2.5 text-xs font-semibold text-primary-600 active:bg-primary-50 transition-colors"
                >
                    Sửa thông tin
                </button>
                <div className="w-px bg-gray-100" />
                <button
                    onClick={onToggle}
                    disabled={isLoading}
                    className={cn(
                        'flex-1 py-2.5 text-xs font-semibold transition-colors flex items-center justify-center gap-1',
                        isActive
                            ? 'text-rose-500 active:bg-rose-50'
                            : 'text-emerald-600 active:bg-emerald-50',
                    )}
                >
                    {isLoading ? (
                        <div className="w-3.5 h-3.5 border-2 border-current border-t-transparent rounded-full animate-spin" />
                    ) : isActive ? (
                        <><UserMinus className="w-3.5 h-3.5" /> Cho nghỉ việc</>
                    ) : (
                        <><RotateCcw className="w-3.5 h-3.5" /> Kích hoạt lại</>
                    )}
                </button>
            </div>
        </div>
    );
}

/** Bottom-sheet form */
function EmployeeFormSheet({
    isOpen, onClose, onSubmit, form, setForm,
    isEdit, isSubmitting, error, customRoles, stores, offices, warehouses, userRole,
}: {
    isOpen: boolean;
    onClose: () => void;
    onSubmit: (e: React.FormEvent) => void;
    form: FormState;
    setForm: React.Dispatch<React.SetStateAction<FormState>>;
    isEdit: boolean;
    isSubmitting: boolean;
    error: string;
    customRoles: CustomRoleDoc[];
    stores: StoreDoc[];
    offices: OfficeDoc[];
    warehouses: WarehouseDoc[];
    userRole: string | undefined;
}) {
    const isManagerOrAdmin = userRole === 'store_manager' || userRole === 'admin';
    const isAdmin = userRole === 'admin';

    // Filter roles by creatorRoles AND applicableTo (must support current workplaceType)
    const eligibleRoles = customRoles.filter(r => {
        if (r.isLocked) return false;
        const canCreate = r.creatorRoles?.includes(userRole ?? '') ||
            r.creatorRoles?.includes(form.customRoleId ?? '');
        if (!canCreate) return false;
        if (r.applicableTo && r.applicableTo.length > 0) {
            return r.applicableTo.includes(form.workplaceType);
        }
        return true;
    });

    const selectValue = form.customRoleId ? `custom:${form.customRoleId}` : form.role;
    const handleRoleChange = (val: string) => {
        if (val.startsWith('custom:')) {
            setForm(f => ({ ...f, role: 'employee', customRoleId: val.slice(7) }));
        } else {
            setForm(f => ({ ...f, role: val as UserRole, customRoleId: '' }));
        }
    };

    return (
        <BottomSheet
            isOpen={isOpen}
            onClose={onClose}
            title={isEdit ? 'Cập nhật nhân viên' : 'Thêm nhân viên mới'}
            maxHeightClass="max-h-[92vh]"
        >
            {/* Scrollable body is handled by BottomSheet internally */}
            <form onSubmit={onSubmit} className="flex flex-col">
                <div className="px-5 py-4 space-y-5">

                        {error && (
                            <div className="bg-rose-50 border border-rose-200 rounded-xl px-4 py-3 flex items-center gap-2">
                                <AlertTriangle className="w-4 h-4 text-rose-500 shrink-0" />
                                <p className="text-xs text-rose-600">{error}</p>
                            </div>
                        )}

                        {/* Section: Thông tin cơ bản */}
                        <div>
                            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-3">Thông tin cơ bản</p>
                            <div className="space-y-3">
                                <FormField
                                    label="Họ và Tên" required
                                    icon={<Users className="w-4 h-4" />}
                                >
                                    <input
                                        type="text" required
                                        value={form.name}
                                        onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                                        placeholder="Nguyễn Văn A"
                                        className={inputCls}
                                    />
                                </FormField>

                                <FormField label="Số điện thoại (ID đăng nhập)" required icon={<Phone className="w-4 h-4" />}>
                                    <input
                                        type="tel" required
                                        value={form.phone}
                                        onChange={e => setForm(f => ({ ...f, phone: e.target.value }))}
                                        placeholder="0912345678"
                                        className={inputCls}
                                    />
                                    <p className="text-[10px] text-gray-400 mt-1 flex items-center gap-1">
                                        <KeyRound className="w-3 h-3" /> Mật khẩu mặc định là 6 số cuối
                                    </p>
                                </FormField>

                                <FormField label="Loại hợp đồng" required icon={<Briefcase className="w-4 h-4" />}>
                                    <select
                                        value={form.type}
                                        onChange={e => setForm(f => ({ ...f, type: e.target.value as EmployeeType }))}
                                        className={selectCls}
                                    >
                                        <option value="PT">Bán thời gian (PT)</option>
                                        <option value="FT">Toàn thời gian (FT)</option>
                                    </select>
                                </FormField>

                                {isManagerOrAdmin && (
                                    <>
                                        {/* Admin: workplace type toggle */}
                                        {isAdmin && (
                                            <>
                                                <FormField label="Loại địa điểm" required icon={<Building2 className="w-4 h-4" />}>
                                                    <div className="flex gap-2">
                                                        {(['STORE', 'OFFICE', 'CENTRAL'] as const).map(wt => (
                                                            <button
                                                                key={wt}
                                                                type="button"
                                                                onClick={() => setForm(f => ({
                                                                    ...f,
                                                                    workplaceType: wt,
                                                                    storeId: '', officeId: '', warehouseId: '',
                                                                    customRoleId: '', // reset role when location type changes
                                                                }))}
                                                                className={cn(
                                                                    'flex-1 py-2.5 rounded-xl text-xs font-bold border transition active:scale-95',
                                                                    form.workplaceType === wt
                                                                        ? 'bg-primary-600 text-white border-primary-600'
                                                                        : 'bg-gray-100 text-gray-500 border-gray-200',
                                                                )}
                                                            >
                                                                {wt === 'STORE' ? '🏪 CH' : wt === 'OFFICE' ? '🏢 VP' : '🏭 Kho'}
                                                            </button>
                                                        ))}
                                                    </div>
                                                </FormField>
                                                <FormField
                                                    label={form.workplaceType === 'STORE' ? 'Cửa hàng' : form.workplaceType === 'OFFICE' ? 'Văn phòng' : 'Kho'}
                                                    icon={<Building2 className="w-4 h-4" />}
                                                >
                                                    {form.workplaceType === 'STORE' && (
                                                        <select value={form.storeId} onChange={e => setForm(f => ({ ...f, storeId: e.target.value }))} className={selectCls}>
                                                            <option value="">-- Chưa gán --</option>
                                                            {stores.map(s => <option key={s.id} value={s.id}>🏪 {s.name}</option>)}
                                                        </select>
                                                    )}
                                                    {form.workplaceType === 'OFFICE' && (
                                                        <select value={form.officeId} onChange={e => setForm(f => ({ ...f, officeId: e.target.value }))} className={selectCls}>
                                                            <option value="">-- Chưa gán --</option>
                                                            {offices.map(o => <option key={o.id} value={o.id}>🏢 {o.name}</option>)}
                                                        </select>
                                                    )}
                                                    {form.workplaceType === 'CENTRAL' && (
                                                        <select value={form.warehouseId} onChange={e => setForm(f => ({ ...f, warehouseId: e.target.value }))} className={selectCls}>
                                                            <option value="">-- Chưa gán --</option>
                                                            {warehouses.map(w => <option key={w.id} value={w.id}>🏭 {w.name}</option>)}
                                                        </select>
                                                    )}
                                                </FormField>
                                            </>
                                        )}
                                        <FormField label="Vai trò" required icon={<Shield className="w-4 h-4" />}>
                                            <select
                                                value={selectValue}
                                                onChange={e => handleRoleChange(e.target.value)}
                                                className={selectCls}
                                            >
                                                {eligibleRoles.map(r => (
                                                    <option key={r.id} value={r.isSystem ? r.id : `custom:${r.id}`}>
                                                        {r.name}{r.isSystem ? '' : ' ✦'}
                                                    </option>
                                                ))}
                                            </select>
                                            {eligibleRoles.length === 0 && (
                                                <p className="text-[10px] text-amber-600 mt-1">Không có vai trò nào khả dụng cho loại địa điểm này.</p>
                                            )}
                                        </FormField>
                                    </>
                                )}

                                <FormField label="Ngày sinh" icon={<Calendar className="w-4 h-4" />}>
                                    <input
                                        type="date"
                                        value={form.dob}
                                        onChange={e => setForm(f => ({ ...f, dob: e.target.value }))}
                                        className={inputCls}
                                    />
                                </FormField>
                            </div>
                        </div>

                        {/* Section: Thông tin chi tiết */}
                        <div>
                            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-3">Thông tin chi tiết</p>
                            <div className="space-y-3">
                                <FormField label="Chức danh / Vị trí" icon={<Briefcase className="w-4 h-4" />}>
                                    <input
                                        type="text"
                                        value={form.jobTitle}
                                        onChange={e => setForm(f => ({ ...f, jobTitle: e.target.value }))}
                                        placeholder="VD: Thu ngân, Kỹ thuật..."
                                        className={inputCls}
                                    />
                                </FormField>

                                <FormField label="Địa chỉ Email" icon={<Mail className="w-4 h-4" />}>
                                    <input
                                        type="email"
                                        value={form.email}
                                        onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                                        placeholder="nhanvien@example.com"
                                        className={inputCls}
                                    />
                                </FormField>

                                <FormField label="Số CCCD" icon={<CreditCard className="w-4 h-4" />}>
                                    <input
                                        type="text"
                                        value={form.idCard}
                                        onChange={e => setForm(f => ({ ...f, idCard: e.target.value }))}
                                        placeholder="012345678910"
                                        className={inputCls}
                                    />
                                </FormField>

                                <FormField label="Tài khoản Ngân hàng" icon={<CreditCard className="w-4 h-4" />}>
                                    <input
                                        type="text"
                                        value={form.bankAccount}
                                        onChange={e => setForm(f => ({ ...f, bankAccount: e.target.value }))}
                                        placeholder="Tên ngân hàng - Số tài khoản"
                                        className={inputCls}
                                    />
                                </FormField>

                                <FormField label="Trình độ học vấn" icon={<GraduationCap className="w-4 h-4" />}>
                                    <input
                                        type="text"
                                        value={form.education}
                                        onChange={e => setForm(f => ({ ...f, education: e.target.value }))}
                                        placeholder="VD: Cử nhân, Kỹ sư..."
                                        className={inputCls}
                                    />
                                </FormField>
                            </div>
                        </div>
                </div>

                {/* Footer — sticky outside the scroll area */}
                <div className="px-5 py-4 border-t border-gray-100 flex gap-3">
                    <button
                        type="button"
                        onClick={onClose}
                        className="flex-1 py-3 rounded-xl border border-gray-200 text-sm font-semibold text-gray-600 active:bg-gray-50 transition"
                    >
                        Hủy
                    </button>
                    <button
                        type="submit"
                        disabled={isSubmitting}
                        className="flex-1 py-3 rounded-xl bg-primary-600 text-white text-sm font-semibold flex items-center justify-center gap-2 active:bg-primary-700 transition disabled:opacity-60"
                    >
                        {isSubmitting
                            ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                            : (isEdit ? 'Lưu thay đổi' : 'Thêm nhân viên')}
                    </button>
                </div>
            </form>
        </BottomSheet>
    );
}

/** Filter bottom sheet */
function FilterSheet({
    isOpen, onClose, filters, setFilters, customRoles,
}: {
    isOpen: boolean;
    onClose: () => void;
    filters: { type: string; role: string; status: string };
    setFilters: (f: { type: string; role: string; status: string }) => void;
    customRoles: CustomRoleDoc[];
}) {
    const [local, setLocal] = useState(filters);

    useEffect(() => { if (isOpen) setLocal(filters); }, [isOpen, filters]);

    const roleOptions = customRoles.length > 0
        ? customRoles.filter(r => !r.isLocked).map(r => ({ value: r.isSystem ? r.id : `custom:${r.id}`, label: r.name }))
        : [
            { value: 'store_manager', label: 'CH Trưởng' },
            { value: 'manager', label: 'Quản lý' },
            { value: 'employee', label: 'Nhân viên' },
        ];

    const Chip = ({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) => (
        <button
            onClick={onClick}
            className={cn(
                'px-3 py-1.5 rounded-xl text-xs font-semibold border transition active:scale-95',
                active
                    ? 'bg-primary-600 text-white border-primary-600'
                    : 'bg-white text-gray-600 border-gray-200',
            )}
        >
            {label}
        </button>
    );

    return (
        <BottomSheet isOpen={isOpen} onClose={onClose} title="Bộ lọc">
            <div className="px-5 py-4 space-y-5">
                {/* Reset action */}
                <div className="flex justify-end -mt-1">
                    <button
                        onClick={() => setLocal({ type: '', role: '', status: 'true' })}
                        className="text-xs text-primary-600 font-semibold"
                    >
                        Đặt lại
                    </button>
                </div>

                <div>
                    <p className="text-xs font-semibold text-gray-400 mb-2">Trạng thái</p>
                    <div className="flex gap-2 flex-wrap">
                        {[{ v: 'true', l: 'Đang làm việc' }, { v: 'false', l: 'Nghỉ việc' }, { v: '', l: 'Tất cả' }].map(o => (
                            <Chip key={o.v} label={o.l} active={local.status === o.v} onClick={() => setLocal(f => ({ ...f, status: o.v }))} />
                        ))}
                    </div>
                </div>

                <div>
                    <p className="text-xs font-semibold text-gray-400 mb-2">Loại hợp đồng</p>
                    <div className="flex gap-2 flex-wrap">
                        {[{ v: '', l: 'Tất cả' }, { v: 'FT', l: 'Toàn thời gian' }, { v: 'PT', l: 'Bán thời gian' }].map(o => (
                            <Chip key={o.v} label={o.l} active={local.type === o.v} onClick={() => setLocal(f => ({ ...f, type: o.v }))} />
                        ))}
                    </div>
                </div>

                <div>
                    <p className="text-xs font-semibold text-gray-400 mb-2">Vai trò</p>
                    <div className="flex gap-2 flex-wrap">
                        <Chip label="Tất cả" active={local.role === ''} onClick={() => setLocal(f => ({ ...f, role: '' }))} />
                        {roleOptions.map(o => (
                            <Chip key={o.value} label={o.label} active={local.role === o.value} onClick={() => setLocal(f => ({ ...f, role: o.value }))} />
                        ))}
                    </div>
                </div>

                <button
                    onClick={() => { setFilters(local); onClose(); }}
                    className="w-full py-3 rounded-xl bg-primary-600 text-white text-sm font-semibold active:bg-primary-700 transition"
                >
                    Áp dụng bộ lọc
                </button>
            </div>
        </BottomSheet>
    );
}

// Shared style constants
const inputCls = 'w-full bg-gray-50 border border-gray-200 text-sm rounded-xl focus:ring-2 focus:ring-primary-400/40 focus:border-primary-400 outline-none px-4 py-3 transition';
const selectCls = 'w-full bg-gray-50 border border-gray-200 text-sm rounded-xl focus:ring-2 focus:ring-primary-400/40 focus:border-primary-400 outline-none px-4 py-3 appearance-none transition';

function FormField({ label, icon, required, children }: {
    label: string; icon?: React.ReactNode; required?: boolean; children: React.ReactNode;
}) {
    return (
        <div>
            <label className="flex items-center gap-1.5 text-xs font-semibold text-gray-600 mb-1.5">
                {icon && <span className="text-gray-400">{icon}</span>}
                {label}
                {required && <span className="text-rose-500">*</span>}
            </label>
            {children}
        </div>
    );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
function MobileHrUsersContent() {
    const router = useRouter();
    const { user, userDoc, loading: authLoading, hasPermission, effectiveStoreId: contextStoreId } = useAuth();

    const [employees, setEmployees] = useState<UserDoc[]>([]);
    const [loading, setLoading] = useState(true);
    const [customRoles, setCustomRoles] = useState<CustomRoleDoc[]>([]);
    const [kpiAverages, setKpiAverages] = useState<Record<string, { avgOfficial: number; count: number }>>({});
    const [stores, setStores] = useState<StoreDoc[]>([]);
    const [offices, setOffices] = useState<OfficeDoc[]>([]);
    const [warehouses, setWarehouses] = useState<WarehouseDoc[]>([]);
    const [selectedAdminStoreId, setSelectedAdminStoreId] = useState<string>(() => {
        if (typeof window !== 'undefined') return localStorage.getItem('globalSelectedStoreId') || '';
        return '';
    });

    // UI state
    const [searchQ, setSearchQ] = useState('');
    const [filters, setFilters] = useState({ type: '', role: '', status: 'true' });
    const [showFilter, setShowFilter] = useState(false);
    const [showForm, setShowForm] = useState(false);
    const [editUid, setEditUid] = useState<string | null>(null);
    const [profileUid, setProfileUid] = useState<string | null>(null);
    const [form, setForm] = useState<FormState>(EMPTY_FORM);
    const [formSubmitting, setFormSubmitting] = useState(false);
    const [formError, setFormError] = useState('');
    const [actionLoading, setActionLoading] = useState<string | null>(null);
    const [toast, setToast] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

    const getToken = useCallback(() => user?.getIdToken(), [user]);

    // Toast auto-dismiss
    useEffect(() => {
        if (!toast) return;
        const t = setTimeout(() => setToast(null), 3000);
        return () => clearTimeout(t);
    }, [toast]);

    // Fetch stores/offices/warehouses for admin
    useEffect(() => {
        if (userDoc?.role !== 'admin' || !user) return;
        (async () => {
            try {
                const token = await getToken();
                const h = { Authorization: `Bearer ${token}` };
                const [sr, or, wr] = await Promise.all([
                    fetch('/api/stores', { headers: h }),
                    fetch('/api/offices', { headers: h }),
                    fetch('/api/warehouses', { headers: h }),
                ]);
                const [sd, od, wd] = await Promise.all([sr.json(), or.json(), wr.json()]);
                setStores(Array.isArray(sd) ? sd : []);
                setOffices(Array.isArray(od) ? od : []);
                setWarehouses(Array.isArray(wd) ? wd : []);
            } catch { /* silent */ }
        })();
    }, [userDoc, user, getToken]);

    // Fetch custom roles
    useEffect(() => {
        if (!user) return;
        (async () => {
            try {
                const token = await getToken();
                const res = await fetch('/api/roles', { headers: { Authorization: `Bearer ${token}` } });
                const data = await res.json();
                setCustomRoles(Array.isArray(data) ? data : []);
            } catch { /* silent */ }
        })();
    }, [user, getToken]);

    // Fetch KPI averages
    useEffect(() => {
        const effectiveStoreId = userDoc?.role === 'admin' ? selectedAdminStoreId : (contextStoreId || userDoc?.storeId);
        if (!effectiveStoreId || !user) { setKpiAverages({}); return; }
        (async () => {
            try {
                const token = await getToken();
                const res = await fetch(`/api/kpi-records/averages?storeId=${effectiveStoreId}`, {
                    headers: { Authorization: `Bearer ${token}` },
                });
                if (res.ok) setKpiAverages(await res.json());
            } catch { /* silent */ }
        })();
    }, [user, userDoc, selectedAdminStoreId, contextStoreId, getToken]);

    // Determine location type
    const selectedLocationType = useMemo(() => {
        if (!selectedAdminStoreId) return null;
        if (stores.some(s => s.id === selectedAdminStoreId)) return 'STORE';
        if (offices.some(o => o.id === selectedAdminStoreId)) return 'OFFICE';
        if (warehouses.some(w => w.id === selectedAdminStoreId)) return 'CENTRAL';
        return null;
    }, [selectedAdminStoreId, stores, offices, warehouses]);

    // Real-time employee listener
    useEffect(() => {
        if (authLoading || !user || !userDoc) return;
        const effectiveStoreId = userDoc.role === 'admin'
            ? selectedAdminStoreId
            : (contextStoreId || userDoc.officeId || userDoc.warehouseId || userDoc.storeId);
        const constraints: ReturnType<typeof where>[] = [];
        if (effectiveStoreId) {
            if (userDoc.role === 'admin' && selectedLocationType) {
                const field = selectedLocationType === 'OFFICE' ? 'officeId' : selectedLocationType === 'CENTRAL' ? 'warehouseId' : 'storeId';
                constraints.push(where(field, '==', effectiveStoreId));
            } else {
                // Non-admin: derive field from their own workplace
                const nonAdminField = userDoc.officeId ? 'officeId' : userDoc.warehouseId ? 'warehouseId' : 'storeId';
                constraints.push(where(nonAdminField, '==', effectiveStoreId));
            }
        }
        const q = (userDoc.role === 'store_manager' || userDoc.role === 'admin')
            ? query(collection(db, 'users'), ...constraints)
            : query(collection(db, 'users'), where('role', '==', 'employee'), ...constraints);

        const unsub = onSnapshot(q, snap => {
            let docs = snap.docs.map(d => d.data() as UserDoc);
            docs = docs.filter(d => d.role !== 'admin' && d.uid !== userDoc.uid);
            docs.sort((a, b) => a.name.localeCompare(b.name));
            setEmployees(docs);
            setLoading(false);
        }, err => { console.error(err); setLoading(false); });

        return () => unsub();
    }, [authLoading, user, userDoc, selectedAdminStoreId, selectedLocationType, contextStoreId]);

    // Save selectedAdminStoreId
    useEffect(() => {
        if (typeof window !== 'undefined' && selectedAdminStoreId) {
            localStorage.setItem('globalSelectedStoreId', selectedAdminStoreId);
        }
    }, [selectedAdminStoreId]);

    // Filtered list
    const filteredEmployees = useMemo(() => {
        let list = employees;
        const q = searchQ.trim().toLowerCase();
        if (q) list = list.filter(e => e.name.toLowerCase().includes(q) || e.phone.includes(q));
        if (filters.status) list = list.filter(e => String(e.isActive !== false) === filters.status);
        if (filters.type) list = list.filter(e => e.type === filters.type);
        if (filters.role) {
            if (filters.role.startsWith('custom:')) {
                const rid = filters.role.slice(7);
                list = list.filter(e => e.customRoleId === rid);
            } else {
                list = list.filter(e => e.role === filters.role);
            }
        }
        return list;
    }, [employees, searchQ, filters]);

    const storeMap = useMemo(() => {
        const m = new Map<string, string>();
        stores.forEach(s => m.set(s.id, s.name));
        offices.forEach(o => m.set(o.id, o.name));
        warehouses.forEach(w => m.set(w.id, w.name));
        return m;
    }, [stores, offices, warehouses]);
    const isAdmin = userDoc?.role === 'admin';
    const activeCount = employees.filter(e => e.isActive !== false).length;
    const inactiveCount = employees.filter(e => e.isActive === false).length;
    const incompleteCount = employees.filter(e => e.isActive !== false && !isProfileComplete(e)).length;
    const activeFilterCount = (filters.status !== 'true' ? 1 : 0) + (filters.type ? 1 : 0) + (filters.role ? 1 : 0);

    // Form open helpers
    const openCreate = useCallback(() => {
        setForm(EMPTY_FORM);
        setEditUid(null);
        setFormError('');
        setShowForm(true);
    }, []);

    const openEdit = useCallback((emp: UserDoc) => {
        const wt: 'STORE' | 'OFFICE' | 'CENTRAL' = emp.officeId ? 'OFFICE' : emp.warehouseId ? 'CENTRAL' : 'STORE';
        setForm({
            name: emp.name, phone: emp.phone, type: emp.type || 'PT', role: emp.role ?? 'employee',
            customRoleId: emp.customRoleId ?? '', dob: emp.dob || '', jobTitle: emp.jobTitle || '',
            email: emp.email || '', idCard: emp.idCard || '', bankAccount: emp.bankAccount || '',
            education: emp.education || '', storeId: emp.storeId || '',
            officeId: emp.officeId || '', warehouseId: emp.warehouseId || '', workplaceType: wt,
        });
        setEditUid(emp.uid);
        setFormError('');
        setShowForm(true);
    }, []);

    const handleSubmitForm = async (e: React.FormEvent) => {
        e.preventDefault();
        setFormSubmitting(true);
        setFormError('');
        try {
            const token = await getToken();
            const endpoint = editUid ? '/api/auth/update-user' : '/api/auth/create-user';
            const body: any = {
                name: form.name, phone: form.phone, type: form.type,
                dob: form.dob, jobTitle: form.jobTitle, email: form.email,
                idCard: form.idCard, bankAccount: form.bankAccount, education: form.education,
            };
            if (editUid) {
                body.targetUid = editUid;
                if (userDoc?.role === 'store_manager' || isAdmin) {
                    body.role = form.role; body.customRoleId = form.customRoleId || null;
                }
                if (isAdmin) {
                    body.workplaceType = form.workplaceType;
                    body.storeId = form.workplaceType === 'STORE' ? (form.storeId || null) : null;
                    body.officeId = form.workplaceType === 'OFFICE' ? (form.officeId || null) : null;
                    body.warehouseId = form.workplaceType === 'CENTRAL' ? (form.warehouseId || null) : null;
                }
            } else {
                body.role = (userDoc?.role === 'store_manager' || isAdmin) ? form.role : 'employee';
                if (userDoc?.role === 'store_manager' || isAdmin) body.customRoleId = form.customRoleId || null;
                if (isAdmin) {
                    body.workplaceType = form.workplaceType;
                    if (form.workplaceType === 'STORE' && form.storeId) body.storeId = form.storeId;
                    if (form.workplaceType === 'OFFICE' && form.officeId) body.officeId = form.officeId;
                    if (form.workplaceType === 'CENTRAL' && form.warehouseId) body.warehouseId = form.warehouseId;
                }
            }

            const res = await fetch(endpoint, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
                body: JSON.stringify(body),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || `Không thể ${editUid ? 'cập nhật' : 'tạo'} nhân viên`);
            setToast({ type: 'success', text: `Nhân viên ${form.name} đã được ${editUid ? 'cập nhật' : 'thêm'} thành công!` });
            setShowForm(false);
        } catch (err: unknown) {
            setFormError(err instanceof Error ? err.message : 'Đã xảy ra lỗi');
        } finally {
            setFormSubmitting(false);
        }
    };

    const handleToggleActive = useCallback(async (uid: string, currentStatus: boolean, name: string) => {
        const action = currentStatus ? 'Cho nghỉ việc' : 'Kích hoạt lại';
        if (!confirm(`Bạn có chắc muốn ${action.toLowerCase()} ${name}?`)) return;
        setActionLoading(uid);
        try {
            const token = await getToken();
            const res = await fetch('/api/auth/toggle-active', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
                body: JSON.stringify({ targetUid: uid, isActive: !currentStatus }),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error);
            setToast({ type: 'success', text: `Đã ${action.toLowerCase()} ${name}.` });
        } catch (err: unknown) {
            setToast({ type: 'error', text: err instanceof Error ? err.message : 'Đã xảy ra lỗi' });
        } finally {
            setActionLoading(null);
        }
    }, [getToken]);

    // Permission check
    if (!authLoading && user && userDoc &&
        userDoc.role !== 'admin' &&
        userDoc.role !== 'store_manager' &&
        userDoc.role !== 'manager' &&
        !hasPermission('page.hr.users')
    ) {
        return (
            <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center gap-4 p-8">
                <div className="w-16 h-16 rounded-2xl bg-rose-100 flex items-center justify-center">
                    <Shield className="w-8 h-8 text-rose-500" />
                </div>
                <p className="text-base font-bold text-gray-800 text-center">Không có quyền truy cập</p>
                <p className="text-sm text-gray-500 text-center">Bạn chưa được cấp quyền xem danh sách nhân viên.</p>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gray-50 pb-safe">
            {/* Header */}
            <PageHeader
                title="Quản lý Nhân viên"
                onBack={() => router.back()}
                headerRight={
                    <button
                        onClick={openCreate}
                        className="w-9 h-9 rounded-xl bg-primary-600 flex items-center justify-center active:scale-95 transition shadow-md shadow-primary-600/30"
                    >
                        <Plus className="w-5 h-5 text-white" />
                    </button>
                }
            />

            {/* Admin location selector — grouped by type */}
            {isAdmin && (
                <div className="px-4 pt-3">
                    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm px-4 py-2.5 flex items-center gap-2">
                        <Building2 className="w-4 h-4 text-primary-500 shrink-0" />
                        <select
                            value={selectedAdminStoreId}
                            onChange={e => setSelectedAdminStoreId(e.target.value)}
                            className="flex-1 text-sm font-medium text-gray-700 outline-none bg-transparent appearance-none"
                        >
                            <option value="">— Tất cả địa điểm —</option>
                            {stores.length > 0 && (
                                <optgroup label="🏪 Cửa hàng">
                                    {stores.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                                </optgroup>
                            )}
                            {offices.length > 0 && (
                                <optgroup label="🏢 Văn phòng">
                                    {offices.map(o => <option key={o.id} value={o.id}>{o.name}</option>)}
                                </optgroup>
                            )}
                            {warehouses.length > 0 && (
                                <optgroup label="🏭 Kho">
                                    {warehouses.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
                                </optgroup>
                            )}
                        </select>
                        <ChevronDown className="w-4 h-4 text-gray-400 shrink-0 pointer-events-none" />
                    </div>
                </div>
            )}

            {/* Stats strip */}
            <StatsStrip active={activeCount} inactive={inactiveCount} incomplete={incompleteCount} total={employees.length} />

            {/* Search + filter */}
            <SearchBar
                value={searchQ}
                onChange={setSearchQ}
                onFilter={() => setShowFilter(true)}
                activeFilters={activeFilterCount}
            />

            {/* Employee list */}
            <div className="px-4 pb-6 space-y-3">
                {loading ? (
                    Array.from({ length: 5 }).map((_, i) => (
                        <div key={i} className="h-24 rounded-2xl bg-gray-100 animate-pulse" />
                    ))
                ) : filteredEmployees.length === 0 ? (
                    <div className="flex flex-col items-center gap-3 py-16">
                        <div className="w-16 h-16 rounded-full bg-gray-100 flex items-center justify-center">
                            <Users className="w-7 h-7 text-gray-300" />
                        </div>
                        <p className="text-sm font-semibold text-gray-500">Không tìm thấy nhân viên</p>
                        <p className="text-xs text-gray-400">Thử thay đổi bộ lọc hoặc từ khóa tìm kiếm</p>
                    </div>
                ) : (
                    filteredEmployees.map(emp => (
                        <EmployeeCard
                            key={emp.uid}
                            employee={emp}
                            kpiAvg={kpiAverages[emp.uid]}
                            customRoles={customRoles}
                            storeMap={storeMap}
                            onPress={() => {
                                if (hasPermission('action.hr.view_employee_profile')) setProfileUid(emp.uid);
                            }}
                            onEdit={() => openEdit(emp)}
                            onToggle={() => handleToggleActive(emp.uid, emp.isActive !== false, emp.name)}
                            isLoading={actionLoading === emp.uid}
                        />
                    ))
                )}
            </div>

            {/* Toast */}
            {toast && (
                <div className={cn(
                    'fixed bottom-6 left-4 right-4 z-[300] rounded-2xl shadow-lg px-4 py-3.5 flex items-center gap-3',
                    toast.type === 'success' ? 'bg-emerald-600' : 'bg-rose-600',
                )}>
                    {toast.type === 'success'
                        ? <CheckCircle2 className="w-5 h-5 text-white shrink-0" />
                        : <AlertTriangle className="w-5 h-5 text-white shrink-0" />}
                    <p className="text-sm font-medium text-white flex-1">{toast.text}</p>
                    <button onClick={() => setToast(null)}>
                        <X className="w-4 h-4 text-white/70" />
                    </button>
                </div>
            )}

            {/* Form Bottom Sheet */}
            <EmployeeFormSheet
                isOpen={showForm}
                onClose={() => setShowForm(false)}
                onSubmit={handleSubmitForm}
                form={form}
                setForm={setForm}
                isEdit={!!editUid}
                isSubmitting={formSubmitting}
                error={formError}
                customRoles={customRoles}
                stores={stores}
                offices={offices}
                warehouses={warehouses}
                userRole={userDoc?.role}
            />

            {/* Filter Sheet */}
            <FilterSheet
                isOpen={showFilter}
                onClose={() => setShowFilter(false)}
                filters={filters}
                setFilters={setFilters}
                customRoles={customRoles}
            />

            {/* Employee Profile Popup */}
            {profileUid && (
                <EmployeeProfilePopup
                    employeeUid={profileUid}
                    storeId={contextStoreId || userDoc?.storeId}
                    onClose={() => setProfileUid(null)}
                />
            )}
        </div>
    );
}

export default function MobileHrUsersPage() {
    return (
        <Suspense fallback={
            <div className="min-h-screen bg-gray-50 flex items-center justify-center">
                <div className="w-8 h-8 border-4 border-primary-500 border-t-transparent rounded-full animate-spin" />
            </div>
        }>
            <MobileHrUsersContent />
        </Suspense>
    );
}