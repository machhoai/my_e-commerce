'use client';

import { useState, useEffect, useCallback, Suspense, useMemo } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { db } from '@/lib/firebase';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { UserDoc, StoreDoc, OfficeDoc, WarehouseDoc, CustomRoleDoc, EmployeeType, UserRole } from '@/types';
import {
    Users, Search, ShieldAlert, UserCheck, UserX, Phone,
    Award, Briefcase, ChevronRight, SlidersHorizontal, Building2, ChevronDown,
    Plus, UserPlus, X, Check, Loader2,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import MobilePageShell from '@/components/mobile/MobilePageShell';
import BottomSheet from '@/components/shared/BottomSheet';
import EmployeeProfilePopup from '@/components/shared/EmployeeProfilePopup';

// ── Role color map ──────────────────────────────────────────────────────────
const ROLE_COLOR: Record<string, string> = {
    red: 'bg-red-100 text-red-700',
    purple: 'bg-purple-100 text-purple-700',
    amber: 'bg-amber-100 text-amber-700',
    blue: 'bg-blue-100 text-blue-700',
    emerald: 'bg-emerald-100 text-emerald-700',
    indigo: 'bg-indigo-100 text-indigo-700',
    pink: 'bg-pink-100 text-pink-700',
    slate: 'bg-gray-100 text-gray-600',
};

// ── Stat pill ───────────────────────────────────────────────────────────────
function StatPill({ icon: Icon, value, label, color }: {
    icon: React.ElementType; value: number; label: string;
    color: 'green' | 'amber' | 'blue';
}) {
    const colors = {
        green: 'bg-emerald-50 border-emerald-200 text-emerald-700',
        amber: 'bg-amber-50 border-amber-200 text-amber-700',
        blue: 'bg-blue-50 border-blue-200 text-blue-700',
    };
    return (
        <div className={cn('rounded-2xl border px-3 py-2.5 flex items-center gap-2.5', colors[color])}>
            <Icon className="w-5 h-5 shrink-0" strokeWidth={1.75} />
            <div>
                <p className="text-lg font-black leading-none">{value}</p>
                <p className="text-[10px] font-semibold uppercase tracking-wide mt-0.5 opacity-70">{label}</p>
            </div>
        </div>
    );
}

// ── Employee Card ───────────────────────────────────────────────────────────
function EmployeeCard({ emp, customRoles, kpiAvg, onTap }: {
    emp: UserDoc;
    customRoles: CustomRoleDoc[];
    kpiAvg?: { avgOfficial: number; count: number };
    onTap: () => void;
}) {
    const isActive = emp.isActive !== false;
    const initial = emp.name.split(' ').slice(-1)[0]?.[0]?.toUpperCase() || '?';

    // Resolve role label + color
    let roleName = emp.role === 'store_manager' ? 'CH Trưởng' : emp.role === 'manager' ? 'Quản lý' : 'Nhân viên';
    let roleColor = 'bg-gray-100 text-gray-600';
    if (emp.customRoleId) {
        const cr = customRoles.find(r => r.id === emp.customRoleId);
        if (cr) {
            roleName = cr.name;
            roleColor = ROLE_COLOR[cr.color || 'slate'] || ROLE_COLOR.slate;
        }
    } else {
        const sys = customRoles.find(r => r.isSystem && r.id === emp.role);
        if (sys) {
            roleName = sys.name;
            roleColor = ROLE_COLOR[sys.color || 'slate'] || ROLE_COLOR.slate;
        }
    }

    return (
        <button
            onClick={onTap}
            className={cn(
                'w-full text-left rounded-2xl border shadow-sm overflow-hidden transition-all active:scale-[0.98]',
                isActive ? 'bg-white border-gray-100' : 'bg-gray-50 border-gray-200 opacity-70',
            )}
        >
            <div className="p-4 flex items-center gap-3">
                {/* Avatar */}
                <div className={cn(
                    'w-11 h-11 rounded-full flex items-center justify-center text-sm font-bold shrink-0 overflow-hidden',
                    !emp.avatar && (isActive
                        ? 'bg-gradient-to-br from-primary-400 to-accent-500 text-white shadow-sm'
                        : 'bg-gray-200 text-gray-500'),
                )}>
                    {emp.avatar ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={emp.avatar} alt={emp.name} className="w-full h-full object-cover" />
                    ) : (
                        initial
                    )}
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                        <p className={cn('font-bold text-sm truncate', isActive ? 'text-gray-900' : 'text-gray-500')}>
                            {emp.name}
                        </p>
                        {!isActive && (
                            <span className="text-[9px] font-bold uppercase px-1.5 py-0.5 rounded bg-gray-200 text-gray-500 shrink-0">
                                Nghỉ
                            </span>
                        )}
                    </div>
                    <div className="flex items-center gap-2 mt-1">
                        <span className={cn('text-[10px] font-bold uppercase px-2 py-0.5 rounded-md', roleColor)}>
                            {roleName}
                        </span>
                        <span className="text-[10px] font-semibold text-gray-400">
                            {emp.type === 'FT' ? 'Toàn thời gian' : 'Bán thời gian'}
                        </span>
                    </div>
                    <div className="flex items-center gap-3 mt-1.5">
                        <span className="flex items-center gap-1 text-[11px] text-gray-400">
                            <Phone className="w-3 h-3" />{emp.phone}
                        </span>
                        {emp.jobTitle && (
                            <span className="flex items-center gap-1 text-[11px] text-gray-400 truncate">
                                <Briefcase className="w-3 h-3" />{emp.jobTitle}
                            </span>
                        )}
                    </div>
                </div>

                {/* KPI + Chevron */}
                <div className="flex items-center gap-2 shrink-0">
                    {kpiAvg && kpiAvg.count > 0 && (() => {
                        const s = kpiAvg.avgOfficial;
                        const c = s >= 80 ? 'bg-emerald-50 text-emerald-700 border-emerald-200' :
                            s >= 50 ? 'bg-amber-50 text-amber-700 border-amber-200' :
                                'bg-red-50 text-red-700 border-red-200';
                        return (
                            <span className={cn('inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] font-bold border', c)}>
                                <Award className="w-3 h-3" />{s}
                            </span>
                        );
                    })()}
                    <ChevronRight className="w-4 h-4 text-gray-300" />
                </div>
            </div>
        </button>
    );
}

// ── Location type ───────────────────────────────────────────────────────────
interface LocationItem {
    id: string;
    name: string;
    icon: string;
    group: 'store' | 'office' | 'warehouse';
}

// ── Main Content ────────────────────────────────────────────────────────────
// ── Styled form input ───────────────────────────────────────────────────────
function FormInput({ label, required, ...props }: { label: string; required?: boolean } & React.InputHTMLAttributes<HTMLInputElement>) {
    return (
        <div className="space-y-1.5">
            <label className="text-[11px] font-bold text-gray-500 uppercase tracking-wide">
                {label} {required && <span className="text-red-500">*</span>}
            </label>
            <input
                {...props}
                className={cn(
                    'w-full px-3.5 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm text-gray-800',
                    'outline-none focus:ring-2 focus:ring-primary-200 focus:border-primary-400 focus:bg-white',
                    'transition-all duration-200 placeholder:text-gray-400',
                    props.className,
                )}
            />
        </div>
    );
}

// ── Chip selector ───────────────────────────────────────────────────────────
function ChipSelector<T extends string>({ options, value, onChange }: {
    options: { value: T; label: string; color?: string }[];
    value: T;
    onChange: (v: T) => void;
}) {
    return (
        <div className="flex flex-wrap gap-2">
            {options.map(o => (
                <button
                    key={o.value}
                    type="button"
                    onClick={() => onChange(o.value)}
                    className={cn(
                        'px-3.5 py-2 rounded-xl text-xs font-semibold border transition-all active:scale-95',
                        value === o.value
                            ? 'bg-primary-600 text-white border-primary-600 shadow-sm shadow-primary-200'
                            : 'bg-white text-gray-600 border-gray-200 hover:border-gray-300',
                    )}
                >
                    {value === o.value && <Check className="w-3 h-3 inline mr-1 -ml-0.5" />}
                    {o.label}
                </button>
            ))}
        </div>
    );
}

function MobileHRUsersContent() {
    const { user, userDoc, loading: authLoading, hasPermission, effectiveStoreId: contextStoreId } = useAuth();
    const [employees, setEmployees] = useState<UserDoc[]>([]);
    const [loading, setLoading] = useState(true);
    const [customRoles, setCustomRoles] = useState<CustomRoleDoc[]>([]);
    const [kpiAverages, setKpiAverages] = useState<Record<string, { avgOfficial: number; count: number }>>({});
    const [profileUid, setProfileUid] = useState<string | null>(null);
    const [searchQ, setSearchQ] = useState('');
    const [filters, setFilters] = useState({ type: '', status: 'true', role: '' });
    const [filterSheetOpen, setFilterSheetOpen] = useState(false);
    const [storeSheetOpen, setStoreSheetOpen] = useState(false);
    const [offices, setOffices] = useState<OfficeDoc[]>([]);
    const [warehouses, setWarehouses] = useState<WarehouseDoc[]>([]);

    // ── Create employee states ──────────────────────────────────────────────
    const [createSheetOpen, setCreateSheetOpen] = useState(false);
    const [createLoading, setCreateLoading] = useState(false);
    const [createMsg, setCreateMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
    const [newName, setNewName] = useState('');
    const [newPhone, setNewPhone] = useState('');
    const [newType, setNewType] = useState<EmployeeType>('PT');
    const [newRole, setNewRole] = useState<UserRole>('employee');
    const [newDob, setNewDob] = useState('');
    const [newJobTitle, setNewJobTitle] = useState('');
    const [newEmail, setNewEmail] = useState('');
    const [newCustomRoleId, setNewCustomRoleId] = useState('');

    // Admin store selector
    const [stores, setStores] = useState<StoreDoc[]>([]);
    const [selectedAdminStoreId, setSelectedAdminStoreId] = useState<string>(() => {
        if (typeof window !== 'undefined') {
            return localStorage.getItem('globalSelectedStoreId') || '';
        }
        return '';
    });

    useEffect(() => {
        if (typeof window !== 'undefined' && selectedAdminStoreId) {
            localStorage.setItem('globalSelectedStoreId', selectedAdminStoreId);
        }
    }, [selectedAdminStoreId]);

    const getToken = useCallback(() => user?.getIdToken(), [user]);

    // Effective store ID: admin can pick, others use their assigned store
    const effectiveStoreId = userDoc?.role === 'admin' ? selectedAdminStoreId : (contextStoreId || userDoc?.storeId);

    // Build unified locations list
    const allLocations = useMemo<LocationItem[]>(() => {
        const locs: LocationItem[] = [];
        stores.forEach(s => {
            const t = (s as any).type;
            locs.push({ id: s.id, name: s.name, icon: t === 'CENTRAL' ? '🏭' : '🏪', group: 'store' });
        });
        offices.forEach(o => locs.push({ id: o.id, name: o.name, icon: '🏢', group: 'office' }));
        warehouses.forEach(w => locs.push({ id: w.id, name: w.name, icon: '🏭', group: 'warehouse' }));
        return locs;
    }, [stores, offices, warehouses]);

    const locationMap = useMemo(() => new Map(allLocations.map(l => [l.id, l])), [allLocations]);
    const selectedLocation = selectedAdminStoreId ? locationMap.get(selectedAdminStoreId) : undefined;
    const selectedStoreName = selectedLocation?.name ?? 'Tất cả địa điểm';

    // Determine the workplace type of the currently selected location
    const selectedLocationType: 'STORE' | 'OFFICE' | 'CENTRAL' | null = useMemo(() => {
        if (!selectedLocation) return null;
        if (selectedLocation.group === 'store') return 'STORE';
        if (selectedLocation.group === 'office') return 'OFFICE';
        if (selectedLocation.group === 'warehouse') return 'CENTRAL';
        return null;
    }, [selectedLocation]);

    // Permission checks for location sections
    const isAdmin = userDoc?.role === 'admin';
    const canSeeStores = isAdmin || hasPermission('page.manager.settings') || hasPermission('page.manager.inventory');
    const canSeeOffices = isAdmin || hasPermission('page.office.approvals') || hasPermission('page.office.revenue');
    const canSeeWarehouses = isAdmin || hasPermission('page.admin.inventory') || hasPermission('action.warehouse.write');

    // Fetch stores, offices, warehouses (based on permissions)
    useEffect(() => {
        if (!user || !userDoc) return;
        const isAdm = userDoc.role === 'admin';
        (async () => {
            try {
                const token = await getToken();
                const headers = { Authorization: `Bearer ${token}` };
                const fetches: Promise<void>[] = [];

                if (isAdm || canSeeStores) {
                    fetches.push(
                        fetch('/api/stores', { headers }).then(r => r.json()).then(d => setStores(Array.isArray(d) ? d : []))
                    );
                }
                if (isAdm || canSeeOffices) {
                    fetches.push(
                        fetch('/api/offices', { headers }).then(r => r.json()).then(d => setOffices(Array.isArray(d) ? d : []))
                    );
                }
                if (isAdm || canSeeWarehouses) {
                    fetches.push(
                        fetch('/api/warehouses', { headers }).then(r => r.json()).then(d => setWarehouses(Array.isArray(d) ? d : []))
                    );
                }
                await Promise.all(fetches);
            } catch { /* silent */ }
        })();
    }, [userDoc, user, getToken, canSeeStores, canSeeOffices, canSeeWarehouses]);

    // Fetch custom roles
    useEffect(() => {
        if (!user) return;
        (async () => {
            try {
                const token = await user.getIdToken();
                const res = await fetch('/api/roles', { headers: { Authorization: `Bearer ${token}` } });
                if (res.ok) setCustomRoles(await res.json());
            } catch { /* silent */ }
        })();
    }, [user]);

    // Fetch KPI averages
    useEffect(() => {
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
    }, [user, effectiveStoreId, getToken]);

    // Employees real-time
    useEffect(() => {
        if (authLoading || !user || !userDoc) return;

        // Determine the correct field to filter by based on selected location type
        const constraints: ReturnType<typeof where>[] = [];
        if (effectiveStoreId && selectedLocationType) {
            const fieldName = selectedLocationType === 'OFFICE' ? 'officeId'
                : selectedLocationType === 'CENTRAL' ? 'warehouseId'
                : 'storeId';
            constraints.push(where(fieldName, '==', effectiveStoreId));
        } else if (effectiveStoreId) {
            // Fallback: if no location type known (non-admin), use storeId
            constraints.push(where('storeId', '==', effectiveStoreId));
        }

        const q = userDoc.role === 'store_manager' || userDoc.role === 'admin'
            ? query(collection(db, 'users'), ...constraints)
            : query(collection(db, 'users'), where('role', '==', 'employee'), ...constraints);

        const unsub = onSnapshot(q, snap => {
            let docs = snap.docs.map(d => d.data() as UserDoc);
            docs = docs.filter(d => d.role !== 'admin' && d.uid !== userDoc.uid);
            docs.sort((a, b) => a.name.localeCompare(b.name));
            setEmployees(docs);
            setLoading(false);
        }, () => setLoading(false));
        return () => unsub();
    }, [authLoading, user, userDoc, effectiveStoreId, selectedLocationType]);

    // Build role options for filter — filtered by selected location type
    const roleFilterOptions = useMemo(() => {
        return customRoles
            .filter(r => {
                if (r.isLocked) return false;
                // If a location type is selected, only show roles applicable to that type
                if (selectedLocationType && r.applicableTo && r.applicableTo.length > 0) {
                    return r.applicableTo.includes(selectedLocationType);
                }
                return true; // No location selected or role has no applicableTo restriction
            })
            .map(r => ({
                value: r.isSystem ? r.id : `custom:${r.id}`,
                label: r.name,
                color: r.color || 'slate',
            }));
    }, [customRoles, selectedLocationType]);

    // ── Available roles for create form ──────────────────────────────────────
    const creatableRoles = useMemo(() => {
        const isAdm = userDoc?.role === 'admin';
        const isSM = userDoc?.role === 'store_manager';
        if (isAdm) return [{ value: 'store_manager' as UserRole, label: 'CH Trưởng' }, { value: 'manager' as UserRole, label: 'Quản lý' }, { value: 'employee' as UserRole, label: 'Nhân viên' }];
        if (isSM) return [{ value: 'manager' as UserRole, label: 'Quản lý' }, { value: 'employee' as UserRole, label: 'Nhân viên' }];
        return [{ value: 'employee' as UserRole, label: 'Nhân viên' }];
    }, [userDoc?.role]);

    // Custom roles for assignment (filtered by selected location type)
    const assignableCustomRoles = useMemo(() => {
        return customRoles.filter(r => {
            if (r.isLocked || r.isSystem) return false;
            if (selectedLocationType && r.applicableTo && r.applicableTo.length > 0) {
                return r.applicableTo.includes(selectedLocationType);
            }
            return true;
        });
    }, [customRoles, selectedLocationType]);

    // ── Create employee handlers ────────────────────────────────────────────
    const resetCreateForm = useCallback(() => {
        setNewName(''); setNewPhone(''); setNewType('PT'); setNewRole('employee');
        setNewDob(''); setNewJobTitle(''); setNewEmail(''); setNewCustomRoleId('');
        setCreateMsg(null);
    }, []);

    const openCreateSheet = useCallback(() => {
        resetCreateForm();
        setCreateSheetOpen(true);
    }, [resetCreateForm]);

    const handleCreateEmployee = useCallback(async () => {
        if (!newName.trim() || !newPhone.trim()) {
            setCreateMsg({ type: 'error', text: 'Vui lòng nhập tên và số điện thoại.' });
            return;
        }
        setCreateLoading(true);
        setCreateMsg(null);
        try {
            const token = await user?.getIdToken();
            const body: Record<string, unknown> = {
                name: newName.trim(),
                phone: newPhone.trim(),
                type: newType,
                role: newRole,
                ...(newDob && { dob: newDob }),
                ...(newJobTitle && { jobTitle: newJobTitle }),
                ...(newEmail && { email: newEmail }),
                ...(newCustomRoleId && { customRoleId: newCustomRoleId }),
            };
            const res = await fetch('/api/auth/create-user', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
                body: JSON.stringify(body),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || 'Không thể tạo nhân viên');
            setCreateMsg({ type: 'success', text: `Nhân viên ${newName} đã được tạo thành công!` });
            setTimeout(() => { setCreateSheetOpen(false); resetCreateForm(); }, 1200);
        } catch (err: unknown) {
            setCreateMsg({ type: 'error', text: err instanceof Error ? err.message : 'Đã xảy ra lỗi.' });
        } finally {
            setCreateLoading(false);
        }
    }, [user, newName, newPhone, newType, newRole, newDob, newJobTitle, newEmail, newCustomRoleId, resetCreateForm]);

    // Can this user create employees?
    const canCreate = userDoc?.role === 'admin' || userDoc?.role === 'store_manager'
        || (userDoc?.role === 'manager' && userDoc?.canManageHR === true)
        || hasPermission('action.hr.manage');

    // Permission check
    if (!user || (
        userDoc?.role !== 'admin' &&
        userDoc?.role !== 'store_manager' &&
        userDoc?.role !== 'manager' &&
        !hasPermission('page.hr.users')
    )) {
        return (
            <MobilePageShell title="Nhân viên">
                <div className="flex flex-col items-center justify-center h-64 gap-3">
                    <ShieldAlert className="w-12 h-12 text-red-400" />
                    <p className="text-sm font-semibold text-gray-500">Bạn chưa được cấp quyền xem trang này.</p>
                </div>
            </MobilePageShell>
        );
    }

    // Apply filters
    let filtered = employees;
    if (searchQ) {
        const q = searchQ.toLowerCase();
        filtered = filtered.filter(e => e.name.toLowerCase().includes(q) || e.phone.includes(q));
    }
    if (filters.type) filtered = filtered.filter(e => e.type === filters.type);
    if (filters.status === 'true') filtered = filtered.filter(e => e.isActive !== false);
    else if (filters.status === 'false') filtered = filtered.filter(e => e.isActive === false);
    if (filters.role) {
        if (filters.role.startsWith('custom:')) {
            const customId = filters.role.slice(7);
            filtered = filtered.filter(e => e.customRoleId === customId);
        } else {
            filtered = filtered.filter(e => e.role === filters.role);
        }
    }

    const activeCount = employees.filter(e => e.isActive !== false).length;
    const inactiveCount = employees.filter(e => e.isActive === false).length;
    const activeFilterCount = (filters.type ? 1 : 0) + (filters.status ? 1 : 0) + (filters.role ? 1 : 0);

    return (
        <MobilePageShell title="Nhân viên">
            {/* Admin / permission-based location selector */}
            {(isAdmin || (canSeeStores && canSeeOffices) || (canSeeStores && canSeeWarehouses) || (canSeeOffices && canSeeWarehouses)) && (
                <button
                    onClick={() => setStoreSheetOpen(true)}
                    className="w-full flex items-center gap-3 bg-white rounded-2xl border border-gray-200 shadow-sm p-3.5 mb-4 active:scale-[0.98] transition-all"
                >
                    <div className="w-9 h-9 rounded-xl bg-accent-100 flex items-center justify-center shrink-0">
                        <Building2 className="w-4.5 h-4.5 text-accent-600" />
                    </div>
                    <div className="flex-1 min-w-0 text-left">
                        <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wide">Địa điểm</p>
                        <p className="text-sm font-bold text-gray-800 truncate">{selectedStoreName}</p>
                    </div>
                    <ChevronDown className="w-4 h-4 text-gray-400 shrink-0" />
                </button>
            )}

            {/* Stats row */}
            <div className="grid grid-cols-3 gap-2 mb-4">
                <StatPill icon={UserCheck} value={activeCount} label="Đang làm" color="green" />
                <StatPill icon={UserX} value={inactiveCount} label="Nghỉ việc" color="amber" />
                <StatPill icon={Users} value={employees.length} label="Tổng" color="blue" />
            </div>

            {/* Search + Filter bar */}
            <div className="flex gap-2 mb-4">
                <div className="flex-1 flex relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <input
                        type="text"
                        value={searchQ}
                        onChange={e => setSearchQ(e.target.value)}
                        placeholder="Tìm tên hoặc SĐT..."
                        className="w-full pl-9 pr-3 py-2.5 bg-white border border-gray-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-primary-200 focus:border-primary-400 transition-all"
                    />
                </div>
                <button
                    onClick={() => setFilterSheetOpen(true)}
                    className={cn(
                        'relative w-11 h-11 rounded-xl border flex items-center justify-center shrink-0 transition-all active:scale-95',
                        activeFilterCount > 0
                            ? 'bg-primary-600 text-white border-primary-600'
                            : 'bg-white text-gray-500 border-gray-200',
                    )}
                >
                    <SlidersHorizontal className="w-4.5 h-4.5" />
                    {activeFilterCount > 0 && (
                        <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-red-500 text-white text-[9px] font-bold flex items-center justify-center">
                            {activeFilterCount}
                        </span>
                    )}
                </button>
            </div>

            {/* Employee list */}
            {loading ? (
                <div className="flex flex-col items-center justify-center py-16 gap-3">
                    <div className="w-8 h-8 border-4 border-primary-500 border-t-transparent rounded-full animate-spin" />
                    <p className="text-xs text-gray-400">Đang tải danh sách...</p>
                </div>
            ) : filtered.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 gap-3">
                    <div className="w-16 h-16 rounded-full bg-gray-100 flex items-center justify-center">
                        <Users className="w-7 h-7 text-gray-300" />
                    </div>
                    <p className="text-sm font-semibold text-gray-400">Không tìm thấy nhân viên</p>
                    <p className="text-xs text-gray-400">Thử thay đổi bộ lọc hoặc từ khóa.</p>
                </div>
            ) : (
                <div className="flex flex-col gap-2.5">
                    <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider px-1">
                        {filtered.length} nhân viên
                    </p>
                    {filtered.map(emp => (
                        <EmployeeCard
                            key={emp.uid}
                            emp={emp}
                            customRoles={customRoles}
                            kpiAvg={kpiAverages[emp.uid]}
                            onTap={() => {
                                if (hasPermission('action.hr.view_employee_profile')) {
                                    setProfileUid(emp.uid);
                                }
                            }}
                        />
                    ))}
                </div>
            )}

            {/* ── Filter BottomSheet ─────────────────────────────────────── */}
            <BottomSheet
                isOpen={filterSheetOpen}
                onClose={() => setFilterSheetOpen(false)}
                title="Bộ lọc"
            >
                <div className="flex flex-col gap-5 px-4 pt-4 pb-8">
                    {/* Contract type */}
                    <div>
                        <p className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-2">Loại hợp đồng</p>
                        <div className="flex flex-wrap gap-2">
                            {[{ v: '', l: 'Tất cả' }, { v: 'FT', l: 'Toàn thời gian' }, { v: 'PT', l: 'Bán thời gian' }].map(o => (
                                <button key={o.v} onClick={() => setFilters(prev => ({ ...prev, type: o.v }))}
                                    className={cn('px-4 py-2 rounded-xl text-xs font-semibold border transition-all',
                                        filters.type === o.v ? 'bg-primary-600 text-white border-primary-600' : 'bg-white text-gray-600 border-gray-200',
                                    )}>
                                    {o.l}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Status */}
                    <div>
                        <p className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-2">Trạng thái</p>
                        <div className="flex flex-wrap gap-2">
                            {[{ v: '', l: 'Tất cả' }, { v: 'true', l: 'Đang làm' }, { v: 'false', l: 'Nghỉ việc' }].map(o => (
                                <button key={o.v} onClick={() => setFilters(prev => ({ ...prev, status: o.v }))}
                                    className={cn('px-4 py-2 rounded-xl text-xs font-semibold border transition-all',
                                        filters.status === o.v ? 'bg-primary-600 text-white border-primary-600' : 'bg-white text-gray-600 border-gray-200',
                                    )}>
                                    {o.l}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Role */}
                    {roleFilterOptions.length > 0 && (
                        <div>
                            <p className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-2">Vai trò</p>
                            <div className="flex flex-wrap gap-2">
                                <button
                                    onClick={() => setFilters(prev => ({ ...prev, role: '' }))}
                                    className={cn('px-4 py-2 rounded-xl text-xs font-semibold border transition-all',
                                        filters.role === '' ? 'bg-primary-600 text-white border-primary-600' : 'bg-white text-gray-600 border-gray-200',
                                    )}
                                >
                                    Tất cả
                                </button>
                                {roleFilterOptions.map(r => (
                                    <button
                                        key={r.value}
                                        onClick={() => setFilters(prev => ({ ...prev, role: r.value }))}
                                        className={cn('px-4 py-2 rounded-xl text-xs font-semibold border transition-all',
                                            filters.role === r.value ? 'bg-primary-600 text-white border-primary-600' : 'bg-white text-gray-600 border-gray-200',
                                        )}
                                    >
                                        {r.label}
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Reset all */}
                    {activeFilterCount > 0 && (
                        <button
                            onClick={() => setFilters({ type: '', status: '', role: '' })}
                            className="text-xs font-semibold text-red-500 self-center mt-1 active:scale-95 transition-transform"
                        >
                            Xóa tất cả bộ lọc
                        </button>
                    )}
                </div>
            </BottomSheet>

            {/* ── Store selector BottomSheet (admin only) ────────────────── */}
            <BottomSheet
                isOpen={storeSheetOpen}
                onClose={() => setStoreSheetOpen(false)}
                title="Chọn địa điểm"
            >
                <div className="flex flex-col pb-6">
                    {/* All option */}
                    <button
                        onClick={() => { setSelectedAdminStoreId(''); setFilters(prev => ({ ...prev, role: '' })); setStoreSheetOpen(false); }}
                        className={cn(
                            'flex items-center gap-3 px-5 py-3.5 text-left transition-colors',
                            !selectedAdminStoreId ? 'bg-primary-50' : 'active:bg-gray-50',
                        )}
                    >
                        <span className="text-lg">🌐</span>
                        <span className={cn('text-sm font-semibold flex-1', !selectedAdminStoreId ? 'text-primary-700' : 'text-gray-700')}>
                            Tất cả địa điểm
                        </span>
                        {!selectedAdminStoreId && <span className="w-2 h-2 rounded-full bg-primary-600 shrink-0" />}
                    </button>

                    {/* Stores */}
                    {canSeeStores && stores.length > 0 && (
                        <>
                            <div className="px-5 pt-4 pb-1">
                                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Cửa hàng</p>
                            </div>
                            {stores.map(s => {
                                const t = (s as any).type;
                                const icon = t === 'CENTRAL' ? '🏭' : '🏪';
                                return (
                                    <button key={s.id}
                                        onClick={() => { setSelectedAdminStoreId(s.id); setFilters(prev => ({ ...prev, role: '' })); setStoreSheetOpen(false); }}
                                        className={cn('flex items-center gap-3 px-5 py-3 text-left transition-colors',
                                            selectedAdminStoreId === s.id ? 'bg-primary-50' : 'active:bg-gray-50')}
                                    >
                                        <span className="text-lg">{icon}</span>
                                        <span className={cn('text-sm font-semibold flex-1 truncate', selectedAdminStoreId === s.id ? 'text-primary-700' : 'text-gray-700')}>{s.name}</span>
                                        {selectedAdminStoreId === s.id && <span className="w-2 h-2 rounded-full bg-primary-600 shrink-0" />}
                                    </button>
                                );
                            })}
                        </>
                    )}

                    {/* Offices */}
                    {canSeeOffices && offices.length > 0 && (
                        <>
                            <div className="px-5 pt-4 pb-1">
                                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Văn phòng</p>
                            </div>
                            {offices.map(o => (
                                <button key={o.id}
                                    onClick={() => { setSelectedAdminStoreId(o.id); setFilters(prev => ({ ...prev, role: '' })); setStoreSheetOpen(false); }}
                                    className={cn('flex items-center gap-3 px-5 py-3 text-left transition-colors',
                                        selectedAdminStoreId === o.id ? 'bg-primary-50' : 'active:bg-gray-50')}
                                >
                                    <span className="text-lg">🏢</span>
                                    <span className={cn('text-sm font-semibold flex-1 truncate', selectedAdminStoreId === o.id ? 'text-primary-700' : 'text-gray-700')}>{o.name}</span>
                                    {selectedAdminStoreId === o.id && <span className="w-2 h-2 rounded-full bg-primary-600 shrink-0" />}
                                </button>
                            ))}
                        </>
                    )}

                    {/* Warehouses */}
                    {canSeeWarehouses && warehouses.length > 0 && (
                        <>
                            <div className="px-5 pt-4 pb-1">
                                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Kho</p>
                            </div>
                            {warehouses.map(w => (
                                <button key={w.id}
                                    onClick={() => { setSelectedAdminStoreId(w.id); setFilters(prev => ({ ...prev, role: '' })); setStoreSheetOpen(false); }}
                                    className={cn('flex items-center gap-3 px-5 py-3 text-left transition-colors',
                                        selectedAdminStoreId === w.id ? 'bg-primary-50' : 'active:bg-gray-50')}
                                >
                                    <span className="text-lg">🏭</span>
                                    <span className={cn('text-sm font-semibold flex-1 truncate', selectedAdminStoreId === w.id ? 'text-primary-700' : 'text-gray-700')}>{w.name}</span>
                                    {selectedAdminStoreId === w.id && <span className="w-2 h-2 rounded-full bg-primary-600 shrink-0" />}
                                </button>
                            ))}
                        </>
                    )}
                </div>
            </BottomSheet>

            {/* ── Create Employee BottomSheet ────────────────────────────── */}
            <BottomSheet
                isOpen={createSheetOpen}
                onClose={() => { setCreateSheetOpen(false); resetCreateForm(); }}
                title="Thêm nhân viên mới"
                maxHeightClass="max-h-[92vh]"
            >
                <div className="flex flex-col gap-5 px-4 pt-4 pb-8">
                    {/* Status message */}
                    {createMsg && (
                        <div className={cn(
                            'flex items-center gap-2.5 px-4 py-3 rounded-xl text-sm font-semibold border transition-all animate-in slide-in-from-top-1 duration-200',
                            createMsg.type === 'success'
                                ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                : 'bg-red-50 text-red-700 border-red-200',
                        )}>
                            {createMsg.type === 'success'
                                ? <Check className="w-4 h-4 shrink-0" />
                                : <X className="w-4 h-4 shrink-0" />}
                            <span className="flex-1">{createMsg.text}</span>
                            <button onClick={() => setCreateMsg(null)} className="shrink-0 opacity-50 active:opacity-100">
                                <X className="w-4 h-4" />
                            </button>
                        </div>
                    )}

                    {/* ── Section: Basic info ─────────────────────────────────── */}
                    <div className="space-y-1">
                        <p className="text-xs font-bold text-gray-500 uppercase tracking-wide flex items-center gap-1.5">
                            <UserPlus className="w-3.5 h-3.5" /> Thông tin cơ bản
                        </p>
                        <div className="h-px bg-gray-100" />
                    </div>

                    <FormInput
                        label="Họ và tên"
                        required
                        placeholder="Nguyễn Văn A"
                        value={newName}
                        onChange={e => setNewName(e.target.value)}
                    />
                    <FormInput
                        label="Số điện thoại (ID đăng nhập)"
                        required
                        placeholder="0901234567"
                        inputMode="tel"
                        value={newPhone}
                        onChange={e => setNewPhone(e.target.value)}
                    />

                    {/* Employee type */}
                    <div className="space-y-2">
                        <p className="text-[11px] font-bold text-gray-500 uppercase tracking-wide">Loại hợp đồng <span className="text-red-500">*</span></p>
                        <ChipSelector
                            options={[
                                { value: 'FT' as EmployeeType, label: '⏰ Toàn thời gian' },
                                { value: 'PT' as EmployeeType, label: '🕐 Bán thời gian' },
                            ]}
                            value={newType}
                            onChange={setNewType}
                        />
                    </div>

                    {/* Base role */}
                    {creatableRoles.length > 1 && (
                        <div className="space-y-2">
                            <p className="text-[11px] font-bold text-gray-500 uppercase tracking-wide">Vai trò <span className="text-red-500">*</span></p>
                            <ChipSelector
                                options={creatableRoles}
                                value={newRole}
                                onChange={setNewRole}
                            />
                        </div>
                    )}

                    {/* Custom role assignment */}
                    {assignableCustomRoles.length > 0 && (
                        <div className="space-y-2">
                            <p className="text-[11px] font-bold text-gray-500 uppercase tracking-wide">Nhóm quyền tùy chỉnh</p>
                            <select
                                value={newCustomRoleId}
                                onChange={e => setNewCustomRoleId(e.target.value)}
                                className="w-full px-3.5 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-primary-200 focus:border-primary-400 focus:bg-white transition-all"
                            >
                                <option value="">— Không chọn —</option>
                                {assignableCustomRoles.map(r => (
                                    <option key={r.id} value={r.id}>{r.name}</option>
                                ))}
                            </select>
                        </div>
                    )}

                    {/* ── Section: Extended info ──────────────────────────────── */}
                    <div className="space-y-1 pt-2">
                        <p className="text-xs font-bold text-gray-500 uppercase tracking-wide flex items-center gap-1.5">
                            <Briefcase className="w-3.5 h-3.5" /> Thông tin bổ sung
                        </p>
                        <div className="h-px bg-gray-100" />
                    </div>

                    <FormInput
                        label="Chức danh"
                        placeholder="Nhân viên bán hàng"
                        value={newJobTitle}
                        onChange={e => setNewJobTitle(e.target.value)}
                    />
                    <FormInput
                        label="Ngày sinh"
                        type="date"
                        value={newDob}
                        onChange={e => setNewDob(e.target.value)}
                    />
                    <FormInput
                        label="Email"
                        type="email"
                        placeholder="example@email.com"
                        value={newEmail}
                        onChange={e => setNewEmail(e.target.value)}
                    />

                    {/* Submit button */}
                    <button
                        type="button"
                        onClick={handleCreateEmployee}
                        disabled={createLoading || !newName.trim() || !newPhone.trim()}
                        className={cn(
                            'w-full flex items-center justify-center gap-2.5 py-3.5 rounded-2xl text-sm font-bold',
                            'transition-all duration-200 active:scale-[0.97] shadow-lg',
                            createLoading || !newName.trim() || !newPhone.trim()
                                ? 'bg-gray-200 text-gray-400 shadow-none cursor-not-allowed'
                                : 'bg-gradient-to-r from-primary-500 to-accent-500 text-white shadow-primary-300/40 hover:shadow-primary-400/50',
                        )}
                    >
                        {createLoading ? (
                            <>
                                <Loader2 className="w-4 h-4 animate-spin" />
                                Đang tạo...
                            </>
                        ) : (
                            <>
                                <UserPlus className="w-4 h-4" />
                                Tạo nhân viên
                            </>
                        )}
                    </button>

                    {/* Hint */}
                    <p className="text-[10px] text-gray-400 text-center leading-relaxed">
                        Mật khẩu mặc định sẽ được tạo tự động từ số điện thoại.
                        <br />Nhân viên có thể đổi mật khẩu sau khi đăng nhập.
                    </p>
                </div>
            </BottomSheet>

            {/* ── Floating Action Button ──────────────────────────────────── */}
            {canCreate && (
                <button
                    onClick={openCreateSheet}
                    className={cn(
                        'fixed bottom-6 right-5 z-30',
                        'w-14 h-14 rounded-2xl',
                        'bg-gradient-to-br from-primary-500 to-accent-500',
                        'text-white shadow-xl shadow-primary-500/30',
                        'flex items-center justify-center',
                        'active:scale-90 transition-all duration-200',
                        'hover:shadow-2xl hover:shadow-primary-500/40',
                    )}
                    aria-label="Thêm nhân viên"
                >
                    <Plus className="w-6 h-6" strokeWidth={2.5} />
                    {/* Pulse ring */}
                    <span className="absolute inset-0 rounded-2xl bg-primary-400 animate-ping opacity-20" />
                </button>
            )}

            {/* Employee profile popup */}
            {profileUid && (
                <EmployeeProfilePopup
                    employeeUid={profileUid}
                    storeId={effectiveStoreId}
                    onClose={() => setProfileUid(null)}
                />
            )}
        </MobilePageShell>
    );
}

export default function MobileManagerHRUsersPage() {
    return (
        <Suspense fallback={
            <MobilePageShell title="Nhân viên">
                <div className="flex justify-center py-12">
                    <div className="w-8 h-8 border-4 border-primary-500 border-t-transparent rounded-full animate-spin" />
                </div>
            </MobilePageShell>
        }>
            <MobileHRUsersContent />
        </Suspense>
    );
}
