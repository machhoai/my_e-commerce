'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Building2, Loader2, MapPin, Plus, Star, Store, Warehouse, XCircle } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import type { OfficeDoc, StoreDoc, UserWorkplace, WarehouseDoc, WorkplaceType } from '@/types';
import { showToast } from '@/lib/utils/toast';

const labels = { STORE: 'Cửa hàng', OFFICE: 'Văn phòng', CENTRAL: 'Kho trung tâm' } as const;
const icons = { STORE: Store, OFFICE: Building2, CENTRAL: Warehouse } as const;

export default function WorkplaceMembershipEditor({ userId, onUpdated }: { userId: string; onUpdated?: () => void }) {
    const { user, userDoc, hasPermission } = useAuth();
    const isAdmin = userDoc?.role === 'admin' || userDoc?.role === 'super_admin';
    const canAssign = isAdmin || hasPermission('action.hr.workplaces.assign');
    const canEnd = isAdmin || hasPermission('action.hr.workplaces.end');
    const canSetPrimary = isAdmin || hasPermission('action.hr.workplaces.set_primary');
    const [memberships, setMemberships] = useState<UserWorkplace[]>([]);
    const [stores, setStores] = useState<StoreDoc[]>([]);
    const [offices, setOffices] = useState<OfficeDoc[]>([]);
    const [warehouses, setWarehouses] = useState<WarehouseDoc[]>([]);
    const [type, setType] = useState<WorkplaceType>('STORE');
    const [locationId, setLocationId] = useState('');
    const [busy, setBusy] = useState(false);

    const load = useCallback(async () => {
        if (!user) return;
        setBusy(true);
        try {
            const token = await user.getIdToken(); const headers = { Authorization: `Bearer ${token}` };
            const [membershipResponse, storesResponse, officesResponse, warehousesResponse] = await Promise.all([
                fetch(`/api/users/${encodeURIComponent(userId)}/workplaces`, { headers, cache: 'no-store' }),
                fetch('/api/stores', { headers }), fetch('/api/offices', { headers }), fetch('/api/warehouses', { headers }),
            ]);
            if (!membershipResponse.ok) throw new Error((await membershipResponse.json()).error || 'Không thể tải nơi làm việc.');
            setMemberships(await membershipResponse.json());
            const [storeData, officeData, warehouseData] = await Promise.all([
                storesResponse.json(), officesResponse.json(), warehousesResponse.json(),
            ]);
            setStores(Array.isArray(storeData) ? storeData : []); setOffices(Array.isArray(officeData) ? officeData : []); setWarehouses(Array.isArray(warehouseData) ? warehouseData : []);
        } catch (error) {
            showToast.error('Không thể tải nơi làm việc', error instanceof Error ? error.message : 'Vui lòng thử lại.');
        } finally { setBusy(false); }
    }, [user, userId]);

    useEffect(() => { void load(); }, [load]);
    const options = useMemo(() => type === 'STORE' ? stores : type === 'OFFICE' ? offices : warehouses, [type, stores, offices, warehouses]);

    const assign = async () => {
        if (!user || !locationId) return; setBusy(true);
        try {
            const token = await user.getIdToken(); const response = await fetch(`/api/users/${encodeURIComponent(userId)}/workplaces`, {
                method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
                body: JSON.stringify({ type, workplaceId: locationId }),
            });
            const data = await response.json(); if (!response.ok) throw new Error(data.error || 'Không thể gán nơi làm việc.');
            setLocationId(''); await load(); onUpdated?.(); showToast.success('Đã gán nơi làm việc', 'Tài khoản có thể sử dụng địa điểm mới theo quyền hiện có.');
        } catch (error) { showToast.error('Không thể gán', error instanceof Error ? error.message : 'Vui lòng thử lại.'); }
        finally { setBusy(false); }
    };

    const update = async (membershipId: string, action: 'END' | 'SET_PRIMARY') => {
        if (!user) return; setBusy(true);
        try {
            const token = await user.getIdToken(); const response = await fetch(`/api/users/${encodeURIComponent(userId)}/workplaces`, {
                method: 'PATCH', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
                body: JSON.stringify({ membershipId, action }),
            });
            const data = await response.json(); if (!response.ok) throw new Error(data.error || 'Không thể cập nhật nơi làm việc.');
            await load(); onUpdated?.(); showToast.success('Đã cập nhật', action === 'END' ? 'Đã ngừng quan hệ tại địa điểm này.' : 'Đã đặt làm nơi chính.');
        } catch (error) { showToast.error('Không thể cập nhật', error instanceof Error ? error.message : 'Vui lòng thử lại.'); }
        finally { setBusy(false); }
    };

    return (
        <section className="space-y-3 border-t border-gray-100 pt-4">
            <div className="flex items-center justify-between">
                <h3 className="flex items-center gap-2 text-sm font-bold text-gray-700"><MapPin className="size-4 text-primary-500" /> Nơi làm việc</h3>
                {busy && <Loader2 className="size-4 animate-spin text-primary-500" />}
            </div>
            <div className="space-y-2">
                {memberships.map(item => { const Icon = icons[item.workplace.type]; return (
                    <div key={item.id} className="flex items-center gap-3 rounded-xl border border-gray-200 bg-white p-3">
                        <Icon className="size-4 shrink-0 text-gray-500" />
                        <div className="min-w-0 flex-1"><p className="truncate text-sm font-semibold text-gray-800">{item.name}</p><p className="text-[11px] text-gray-400">{labels[item.workplace.type]} · {item.status === 'ACTIVE' ? (item.isEffective ? 'Đang làm việc' : 'Chưa đến ngày hiệu lực') : item.status === 'SUSPENDED' ? 'Tạm ngưng' : 'Đã kết thúc'}</p></div>
                        {item.status === 'ACTIVE' && item.isPrimary && <Star className="size-4 fill-amber-400 text-amber-400" aria-label="Nơi làm việc chính" />}
                        {item.status === 'ACTIVE' && canSetPrimary && !item.isPrimary && <button disabled={busy} onClick={() => update(item.id, 'SET_PRIMARY')} className="rounded-lg p-2 text-amber-500 hover:bg-amber-50" title="Đặt làm nơi chính"><Star className="size-4" /></button>}
                        {item.status === 'ACTIVE' && canEnd && <button disabled={busy} onClick={() => update(item.id, 'END')} className="rounded-lg p-2 text-danger-500 hover:bg-danger-50" title="Ngừng làm việc tại nơi này"><XCircle className="size-4" /></button>}
                    </div>
                ); })}
                {!memberships.length && !busy && <p className="rounded-xl bg-gray-50 p-3 text-sm text-gray-500">Tài khoản chưa có nơi làm việc.</p>}
            </div>
            {canAssign && <div className="grid grid-cols-1 gap-2 rounded-xl bg-gray-50 p-3 sm:grid-cols-[140px_1fr_auto]">
                <select value={type} onChange={event => { setType(event.target.value as WorkplaceType); setLocationId(''); }} className="rounded-lg border border-gray-200 bg-white px-2 py-2 text-sm">
                    <option value="STORE">Cửa hàng</option><option value="OFFICE">Văn phòng</option><option value="CENTRAL">Kho trung tâm</option>
                </select>
                <select value={locationId} onChange={event => setLocationId(event.target.value)} className="min-w-0 rounded-lg border border-gray-200 bg-white px-2 py-2 text-sm">
                    <option value="">Chọn địa điểm…</option>{options.filter(item => item.isActive !== false).map(item => <option key={item.id} value={item.id}>{item.name}</option>)}
                </select>
                <button disabled={busy || !locationId} onClick={assign} className="flex items-center justify-center gap-1 rounded-lg bg-primary-600 px-3 py-2 text-sm font-semibold text-white disabled:opacity-50"><Plus className="size-4" /> Gán</button>
            </div>}
        </section>
    );
}
