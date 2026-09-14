'use client';

import { useEffect, useState } from 'react';
import { Loader2, Save, Users } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';

export default function WorkforcePolicyPanel() {
    const { user } = useAuth(); const [value, setValue] = useState({ ftDaysOff: 4, ptMinShifts: 10, ptMaxShifts: 25 });
    const [busy, setBusy] = useState(true); const [message, setMessage] = useState('');
    useEffect(() => { if (!user) return; void user.getIdToken().then(token => fetch('/api/workforce-policy', { headers: { Authorization: `Bearer ${token}` } })).then(response => response.json()).then(data => setValue({ ftDaysOff: data.ftDaysOff ?? 4, ptMinShifts: data.ptMinShifts ?? 10, ptMaxShifts: data.ptMaxShifts ?? 25 })).finally(() => setBusy(false)); }, [user]);
    const save = async () => {
        if (!user) return; setBusy(true); setMessage('');
        try { const token = await user.getIdToken(); const response = await fetch('/api/workforce-policy', { method: 'PUT', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify(value) }); const data = await response.json(); if (!response.ok) throw new Error(data.error); setMessage('Đã lưu định mức chung cho toàn bộ tài khoản.'); }
        catch (error) { setMessage(error instanceof Error ? error.message : 'Không thể lưu định mức.'); } finally { setBusy(false); }
    };
    return <section className="mb-6 rounded-2xl border border-surface-200 bg-white p-5 shadow-sm">
        <div className="mb-4 flex items-center gap-2"><Users className="size-5 text-primary-600" /><div><h2 className="font-bold text-surface-900">Định mức nhân sự toàn hệ thống</h2><p className="text-xs text-surface-500">Tính trên tài khoản, cộng tất cả cửa hàng.</p></div></div>
        <div className="grid gap-3 md:grid-cols-3">
            {[['ftDaysOff', 'Ngày nghỉ FT / tháng'], ['ptMinShifts', 'Ca PT tối thiểu / tháng'], ['ptMaxShifts', 'Ca PT tối đa / tháng']].map(([key, label]) => <label key={key} className="text-xs font-semibold text-surface-600">{label}<input type="number" min={0} value={value[key as keyof typeof value]} onChange={event => setValue(current => ({ ...current, [key]: Number(event.target.value) }))} className="mt-1 w-full rounded-xl border border-surface-200 px-3 py-2 text-sm" /></label>)}
        </div>
        <div className="mt-4 flex items-center gap-3"><button onClick={save} disabled={busy} className="flex items-center gap-2 rounded-xl bg-primary-600 px-4 py-2 text-sm font-bold text-white disabled:opacity-50">{busy ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />} Lưu định mức</button>{message && <p className="text-sm text-surface-600">{message}</p>}</div>
    </section>;
}
