'use client';

import { useEffect, useState } from 'react';
import { Loader2, Save, Settings2, X } from 'lucide-react';
import type { StoreAttendancePolicy } from '@/types';
import { cn } from '@/lib/utils';

interface Props {
    open: boolean;
    storeId: string;
    getToken: () => Promise<string>;
    onClose: () => void;
    onSaved: (policy: StoreAttendancePolicy) => void;
}

interface PolicyForm {
    enabled: boolean;
    sourceMode: 'MACHINE' | 'SOFTWARE';
    verificationMethod: 'GPS' | 'IP';
    requireCheckOut: boolean;
    allowedIpAddresses: string;
    latitude: string;
    longitude: string;
    radiusM: string;
    maxAccuracyM: string;
    maxAgeSeconds: string;
}

const EMPTY_FORM: PolicyForm = {
    enabled: true,
    sourceMode: 'MACHINE',
    verificationMethod: 'GPS',
    requireCheckOut: true,
    allowedIpAddresses: '',
    latitude: '',
    longitude: '',
    radiusM: '100',
    maxAccuracyM: '100',
    maxAgeSeconds: '120',
};

function formFromPolicy(
    policy: StoreAttendancePolicy | null,
    coordinate: { latitude: number; longitude: number } | null,
): PolicyForm {
    if (!policy) {
        return {
            ...EMPTY_FORM,
            latitude: coordinate ? String(coordinate.latitude) : '',
            longitude: coordinate ? String(coordinate.longitude) : '',
        };
    }
    return {
        enabled: policy.enabled,
        sourceMode: policy.sourceMode,
        verificationMethod: policy.verificationMethod ?? 'GPS',
        requireCheckOut: policy.requireCheckOut,
        allowedIpAddresses: policy.allowedIpAddresses.join('\n'),
        latitude: policy.gps ? String(policy.gps.latitude) : coordinate ? String(coordinate.latitude) : '',
        longitude: policy.gps ? String(policy.gps.longitude) : coordinate ? String(coordinate.longitude) : '',
        radiusM: String(policy.gps?.radiusM ?? 100),
        maxAccuracyM: String(policy.gps?.maxAccuracyM ?? 100),
        maxAgeSeconds: String(policy.gps?.maxAgeSeconds ?? 120),
    };
}

export default function AttendancePolicyPanel({ open, storeId, getToken, onClose, onSaved }: Props) {
    const [form, setForm] = useState<PolicyForm>(EMPTY_FORM);
    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (!open || !storeId) return;
        const controller = new AbortController();
        setLoading(true);
        setError(null);
        void (async () => {
            try {
                const token = await getToken();
                const response = await fetch(`/api/hr/attendance/policies/${storeId}`, {
                    headers: { Authorization: `Bearer ${token}` },
                    cache: 'no-store',
                    signal: controller.signal,
                });
                const data = await response.json().catch(() => ({}));
                if (!response.ok) throw new Error(data.error ?? 'Không thể tải chính sách chấm công.');
                setForm(formFromPolicy(data.policy ?? null, data.storeCoordinate ?? null));
            } catch (loadError) {
                if (loadError instanceof Error && loadError.name === 'AbortError') return;
                setError(loadError instanceof Error ? loadError.message : 'Không thể tải chính sách chấm công.');
            } finally {
                if (!controller.signal.aborted) setLoading(false);
            }
        })();
        return () => controller.abort();
    }, [getToken, open, storeId]);

    const save = async () => {
        setSaving(true);
        setError(null);
        try {
            const software = form.sourceMode === 'SOFTWARE';
            const gps = software && form.verificationMethod === 'GPS';
            if (gps && (!form.latitude.trim() || !form.longitude.trim())) {
                throw new Error('Vui lòng nhập đầy đủ tọa độ GPS của cửa hàng.');
            }
            const payload = {
                enabled: form.enabled,
                sourceMode: form.sourceMode,
                verificationMethod: software ? form.verificationMethod : null,
                allowedIpAddresses: software && form.verificationMethod === 'IP'
                    ? form.allowedIpAddresses.split(/[\n,]/).map((value) => value.trim()).filter(Boolean)
                    : [],
                gps: gps ? {
                    latitude: Number(form.latitude),
                    longitude: Number(form.longitude),
                    radiusM: Number(form.radiusM),
                    maxAccuracyM: Number(form.maxAccuracyM),
                    maxAgeSeconds: Number(form.maxAgeSeconds),
                } : null,
                requireCheckOut: form.requireCheckOut,
            };
            const token = await getToken();
            const response = await fetch(`/api/hr/attendance/policies/${storeId}`, {
                method: 'PUT',
                headers: {
                    Authorization: `Bearer ${token}`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(payload),
            });
            const data = await response.json().catch(() => ({}));
            if (!response.ok) throw new Error(data.error ?? 'Không thể lưu chính sách chấm công.');
            onSaved(data.policy as StoreAttendancePolicy);
            onClose();
        } catch (saveError) {
            setError(saveError instanceof Error ? saveError.message : 'Không thể lưu chính sách chấm công.');
        } finally {
            setSaving(false);
        }
    };

    if (!open) return null;
    const software = form.sourceMode === 'SOFTWARE';

    return (
        <div className="fixed inset-0 z-[60] flex justify-end bg-black/30 backdrop-blur-sm" role="dialog" aria-modal="true" aria-labelledby="attendance-policy-title">
            <div className="flex h-full w-full max-w-lg flex-col bg-white shadow-2xl">
                <div className="flex items-center justify-between border-b border-surface-200 px-6 py-4">
                    <div className="flex items-center gap-3">
                        <div className="flex size-9 items-center justify-center rounded-xl bg-primary-600 text-white"><Settings2 className="size-5" /></div>
                        <div>
                            <h2 id="attendance-policy-title" className="font-bold text-surface-900">Chính sách chấm công</h2>
                            <p className="text-xs text-surface-500">Cấu hình riêng cho cửa hàng đang chọn</p>
                        </div>
                    </div>
                    <button type="button" onClick={onClose} aria-label="Đóng cấu hình" className="flex size-9 items-center justify-center rounded-xl hover:bg-surface-100"><X className="size-4" /></button>
                </div>

                <div className="flex-1 space-y-5 overflow-y-auto p-6">
                    {loading ? (
                        <div className="flex min-h-48 items-center justify-center"><Loader2 className="size-7 animate-spin text-primary-500" /></div>
                    ) : (
                        <>
                            <label className="flex items-center justify-between rounded-xl border border-surface-200 p-4">
                                <span className="text-sm font-semibold text-surface-800">Bật chấm công</span>
                                <input type="checkbox" checked={form.enabled} onChange={(event) => setForm((current) => ({ ...current, enabled: event.target.checked }))} className="size-4" />
                            </label>

                            <fieldset>
                                <legend className="mb-2 text-xs font-bold uppercase text-surface-500">Nguồn chấm công</legend>
                                <div className="grid grid-cols-2 gap-2">
                                    {(['MACHINE', 'SOFTWARE'] as const).map((mode) => (
                                        <button key={mode} type="button" onClick={() => setForm((current) => ({ ...current, sourceMode: mode }))} className={cn('rounded-xl border px-3 py-3 text-sm font-semibold', form.sourceMode === mode ? 'border-primary-500 bg-primary-50 text-primary-700' : 'border-surface-200 text-surface-600')}>
                                            {mode === 'MACHINE' ? 'Máy chấm công' : 'Phần mềm'}
                                        </button>
                                    ))}
                                </div>
                            </fieldset>

                            {software ? (
                                <>
                                    <fieldset>
                                        <legend className="mb-2 text-xs font-bold uppercase text-surface-500">Phương thức xác minh</legend>
                                        <div className="grid grid-cols-2 gap-2">
                                            {(['GPS', 'IP'] as const).map((method) => (
                                                <button key={method} type="button" onClick={() => setForm((current) => ({ ...current, verificationMethod: method }))} className={cn('rounded-xl border px-3 py-3 text-sm font-semibold', form.verificationMethod === method ? 'border-primary-500 bg-primary-50 text-primary-700' : 'border-surface-200 text-surface-600')}>{method}</button>
                                            ))}
                                        </div>
                                    </fieldset>

                                    {form.verificationMethod === 'IP' ? (
                                        <label className="block text-sm font-semibold text-surface-700">
                                            Public IP được phép
                                            <textarea value={form.allowedIpAddresses} onChange={(event) => setForm((current) => ({ ...current, allowedIpAddresses: event.target.value }))} rows={4} placeholder="Mỗi IP một dòng" className="mt-2 w-full rounded-xl border border-surface-200 px-3 py-2 font-mono text-sm" />
                                        </label>
                                    ) : (
                                        <div className="grid grid-cols-2 gap-3">
                                            {([
                                                ['latitude', 'Vĩ độ'], ['longitude', 'Kinh độ'], ['radiusM', 'Bán kính (m)'],
                                                ['maxAccuracyM', 'Sai số tối đa (m)'], ['maxAgeSeconds', 'Tuổi vị trí tối đa (giây)'],
                                            ] as const).map(([key, label]) => (
                                                <label key={key} className="text-sm font-semibold text-surface-700">
                                                    {label}
                                                    <input type="number" value={form[key]} onChange={(event) => setForm((current) => ({ ...current, [key]: event.target.value }))} className="mt-2 w-full rounded-xl border border-surface-200 px-3 py-2 text-sm" />
                                                </label>
                                            ))}
                                        </div>
                                    )}
                                </>
                            ) : null}

                            <label className="flex items-center justify-between rounded-xl border border-surface-200 p-4">
                                <span className="text-sm font-semibold text-surface-800">Bắt buộc chấm công ra</span>
                                <input type="checkbox" checked={form.requireCheckOut} onChange={(event) => setForm((current) => ({ ...current, requireCheckOut: event.target.checked }))} className="size-4" />
                            </label>
                        </>
                    )}
                    {error ? <p className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700" role="alert">{error}</p> : null}
                </div>

                <div className="border-t border-surface-200 p-4">
                    <button type="button" onClick={() => void save()} disabled={loading || saving} className="flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-primary-600 px-4 text-sm font-bold text-white disabled:opacity-50">
                        {saving ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
                        Lưu chính sách
                    </button>
                </div>
            </div>
        </div>
    );
}
