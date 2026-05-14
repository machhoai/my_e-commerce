'use client';

/**
 * ContractSection.tsx
 * ─────────────────────────────────────────────────────────────
 * Section hiển thị + chỉnh sửa thông tin hợp đồng & ngày nhận việc.
 * Chỉ hiện nút chỉnh sửa khi user có quyền action.hr.edit_contract.
 */

import { useState, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { UserDoc, ContractRecord } from '@/types';
import { showToast } from '@/lib/utils/toast';
import {
    FileText, CalendarDays, Plus, Trash2, Pencil, X,
    Check, Loader2, ChevronDown, ChevronUp,
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface ContractSectionProps {
    employee: UserDoc;
    /** Callback sau khi update thành công để refresh data */
    onUpdated: () => void;
}

function fmtDate(s?: string) {
    if (!s) return '—';
    try { const [y, m, d] = s.split('-'); return `${d}/${m}/${y}`; } catch { return s; }
}

export default function ContractSection({ employee, onUpdated }: ContractSectionProps) {
    const { hasPermission, user } = useAuth();
    const canEdit = hasPermission('action.hr.edit_contract');

    // ── Edit state ──
    const [editing, setEditing] = useState(false);
    const [saving, setSaving] = useState(false);
    const [probationStart, setProbationStart] = useState(employee.probationStartDate || '');
    const [officialStart, setOfficialStart] = useState(employee.officialStartDate || '');
    const [contracts, setContracts] = useState<ContractRecord[]>(employee.contracts || []);
    const [expanded, setExpanded] = useState(false);

    const startEdit = () => {
        setProbationStart(employee.probationStartDate || '');
        setOfficialStart(employee.officialStartDate || '');
        setContracts(employee.contracts?.length ? [...employee.contracts] : []);
        setEditing(true);
    };

    const cancelEdit = () => {
        setEditing(false);
    };

    const addContract = () => {
        setContracts(prev => [...prev, { contractNumber: '', startDate: '', endDate: '' }]);
    };

    const removeContract = (idx: number) => {
        setContracts(prev => prev.filter((_, i) => i !== idx));
    };

    const updateContract = (idx: number, field: keyof ContractRecord, value: string) => {
        setContracts(prev => prev.map((c, i) => i === idx ? { ...c, [field]: value } : c));
    };

    const handleSave = useCallback(async () => {
        if (!user) return;

        // Validate contracts
        const validContracts = contracts.filter(c => c.contractNumber.trim());
        for (const c of validContracts) {
            if (!c.startDate || !c.endDate) {
                showToast.error('Lỗi', 'Mỗi hợp đồng phải có ngày bắt đầu và kết thúc.');
                return;
            }
            if (c.endDate < c.startDate) {
                showToast.error('Lỗi', `Hợp đồng ${c.contractNumber}: ngày kết thúc không thể trước ngày bắt đầu.`);
                return;
            }
        }

        setSaving(true);
        try {
            const token = await user.getIdToken();
            const res = await fetch('/api/auth/update-user', {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${token}`,
                },
                body: JSON.stringify({
                    uid: employee.uid,
                    probationStartDate: probationStart || '',
                    officialStartDate: officialStart || '',
                    contracts: validContracts,
                    // Keep legacy field synced with latest contract
                    contractNumber: validContracts.length > 0
                        ? validContracts[validContracts.length - 1].contractNumber
                        : '',
                }),
            });

            if (!res.ok) {
                const data = await res.json().catch(() => ({}));
                throw new Error(data.error || 'Lỗi cập nhật');
            }

            showToast.success('Đã cập nhật', 'Thông tin hợp đồng đã được lưu.');
            setEditing(false);
            onUpdated();
        } catch (err) {
            console.error('[ContractSection] Save error:', err);
            showToast.error('Lỗi cập nhật', err instanceof Error ? err.message : 'Vui lòng thử lại.');
        } finally {
            setSaving(false);
        }
    }, [user, employee.uid, probationStart, officialStart, contracts, onUpdated]);

    // ── Current contracts from employee data ──
    const currentContracts = employee.contracts || [];
    const latestContract = currentContracts.length > 0 ? currentContracts[currentContracts.length - 1] : null;

    return (
        <div className="space-y-2">
            {/* ── Header ── */}
            <div className="flex items-center justify-between px-1">
                <p className="text-[10px] text-gray-400 font-semibold uppercase tracking-wider flex items-center gap-1.5">
                    <FileText className="w-3 h-3" /> Hợp đồng & Ngày nhận việc
                </p>
                {canEdit && !editing && (
                    <button
                        onClick={startEdit}
                        className="flex items-center gap-1 text-[11px] font-bold text-primary-600 hover:text-primary-700 transition-colors"
                    >
                        <Pencil className="w-3 h-3" /> Chỉnh sửa
                    </button>
                )}
                {editing && (
                    <div className="flex items-center gap-1">
                        <button
                            onClick={cancelEdit}
                            disabled={saving}
                            className="flex items-center gap-0.5 text-[11px] font-bold text-gray-500 hover:text-gray-700 transition-colors"
                        >
                            <X className="w-3 h-3" /> Hủy
                        </button>
                        <button
                            onClick={handleSave}
                            disabled={saving}
                            className="flex items-center gap-0.5 text-[11px] font-bold text-emerald-600 hover:text-emerald-700 transition-colors ml-2"
                        >
                            {saving ? <Loader2 className="w-3 h-3 animate-spin" /> : <Check className="w-3 h-3" />}
                            Lưu
                        </button>
                    </div>
                )}
            </div>

            {/* ── Dates Row ── */}
            <div className="grid grid-cols-2 gap-2">
                {/* Ngày thử việc */}
                <div className="px-4 py-3 bg-gray-50 rounded-2xl border border-gray-100">
                    <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-xl bg-amber-50 flex items-center justify-center text-amber-500 border border-amber-100 shrink-0">
                            <CalendarDays className="w-3.5 h-3.5" />
                        </div>
                        <div className="flex-1 min-w-0">
                            <p className="text-[10px] text-gray-400 font-semibold uppercase tracking-wider">Ngày thử việc</p>
                            {editing ? (
                                <input
                                    type="date"
                                    value={probationStart}
                                    onChange={e => setProbationStart(e.target.value)}
                                    className="mt-0.5 w-full text-sm font-bold text-gray-800 bg-white border border-gray-200 rounded-lg px-2 py-1 outline-none focus:ring-2 focus:ring-primary-500/30"
                                />
                            ) : (
                                <p className="text-sm font-bold text-gray-800 mt-0.5">
                                    {fmtDate(employee.probationStartDate)}
                                </p>
                            )}
                        </div>
                    </div>
                </div>

                {/* Ngày chính thức */}
                <div className="px-4 py-3 bg-gray-50 rounded-2xl border border-gray-100">
                    <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-xl bg-emerald-50 flex items-center justify-center text-emerald-500 border border-emerald-100 shrink-0">
                            <CalendarDays className="w-3.5 h-3.5" />
                        </div>
                        <div className="flex-1 min-w-0">
                            <p className="text-[10px] text-gray-400 font-semibold uppercase tracking-wider">Ngày chính thức</p>
                            {editing ? (
                                <input
                                    type="date"
                                    value={officialStart}
                                    onChange={e => setOfficialStart(e.target.value)}
                                    className="mt-0.5 w-full text-sm font-bold text-gray-800 bg-white border border-gray-200 rounded-lg px-2 py-1 outline-none focus:ring-2 focus:ring-primary-500/30"
                                />
                            ) : (
                                <p className="text-sm font-bold text-gray-800 mt-0.5">
                                    {fmtDate(employee.officialStartDate)}
                                </p>
                            )}
                        </div>
                    </div>
                </div>
            </div>

            {/* ── Contract List ── */}
            {editing ? (
                /* ── Edit mode: editable list ── */
                <div className="space-y-2">
                    {contracts.map((c, idx) => (
                        <div key={idx} className="relative px-4 py-3 bg-white rounded-2xl border border-primary-100 space-y-2">
                            <div className="flex items-center justify-between">
                                <span className="text-[10px] font-bold text-primary-600 uppercase">
                                    Hợp đồng #{idx + 1}
                                </span>
                                <button
                                    onClick={() => removeContract(idx)}
                                    className="text-red-400 hover:text-red-600 transition-colors"
                                    title="Xóa hợp đồng"
                                >
                                    <Trash2 className="w-3.5 h-3.5" />
                                </button>
                            </div>
                            <input
                                type="text"
                                placeholder="Số hợp đồng"
                                value={c.contractNumber}
                                onChange={e => updateContract(idx, 'contractNumber', e.target.value)}
                                className="w-full text-sm font-bold text-gray-800 bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-primary-500/30 placeholder-gray-300"
                            />
                            <div className="grid grid-cols-2 gap-2">
                                <div>
                                    <label className="text-[9px] text-gray-400 font-semibold uppercase">Bắt đầu</label>
                                    <input
                                        type="date"
                                        value={c.startDate}
                                        onChange={e => updateContract(idx, 'startDate', e.target.value)}
                                        className="w-full text-sm text-gray-700 bg-gray-50 border border-gray-200 rounded-lg px-2 py-1.5 outline-none focus:ring-2 focus:ring-primary-500/30"
                                    />
                                </div>
                                <div>
                                    <label className="text-[9px] text-gray-400 font-semibold uppercase">Kết thúc</label>
                                    <input
                                        type="date"
                                        value={c.endDate}
                                        onChange={e => updateContract(idx, 'endDate', e.target.value)}
                                        className="w-full text-sm text-gray-700 bg-gray-50 border border-gray-200 rounded-lg px-2 py-1.5 outline-none focus:ring-2 focus:ring-primary-500/30"
                                    />
                                </div>
                            </div>
                        </div>
                    ))}
                    <button
                        onClick={addContract}
                        className="w-full flex items-center justify-center gap-1.5 py-2.5 rounded-2xl border-2 border-dashed border-primary-200 text-primary-600 text-[12px] font-bold hover:bg-primary-50 transition-colors"
                    >
                        <Plus className="w-4 h-4" /> Thêm hợp đồng
                    </button>
                </div>
            ) : (
                /* ── View mode: latest + expandable history ── */
                <div className="space-y-1.5">
                    {latestContract ? (
                        <div className="px-4 py-3 bg-gray-50 rounded-2xl border border-gray-100">
                            <div className="flex items-center gap-2">
                                <div className="w-8 h-8 rounded-xl bg-primary-50 flex items-center justify-center text-primary-500 border border-primary-100 shrink-0">
                                    <FileText className="w-3.5 h-3.5" />
                                </div>
                                <div className="flex-1 min-w-0">
                                    <p className="text-[10px] text-gray-400 font-semibold uppercase tracking-wider">
                                        Hợp đồng hiện tại
                                    </p>
                                    <p className="text-sm font-bold text-gray-800 mt-0.5">
                                        {latestContract.contractNumber}
                                    </p>
                                    <p className="text-[11px] text-gray-500 mt-0.5">
                                        {fmtDate(latestContract.startDate)} → {fmtDate(latestContract.endDate)}
                                    </p>
                                </div>
                            </div>
                        </div>
                    ) : (
                        <div className="px-4 py-3 bg-gray-50 rounded-2xl border border-gray-100">
                            <div className="flex items-center gap-2">
                                <div className="w-8 h-8 rounded-xl bg-gray-100 flex items-center justify-center text-gray-400 shrink-0">
                                    <FileText className="w-3.5 h-3.5" />
                                </div>
                                <div>
                                    <p className="text-[10px] text-gray-400 font-semibold uppercase tracking-wider">Hợp đồng</p>
                                    <p className="text-sm font-bold text-gray-400 mt-0.5">
                                        {employee.contractNumber || 'Chưa có'}
                                    </p>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Expandable history */}
                    {currentContracts.length > 1 && (
                        <>
                            <button
                                onClick={() => setExpanded(v => !v)}
                                className="w-full flex items-center justify-center gap-1 text-[11px] font-bold text-primary-600 hover:text-primary-700 py-1.5 transition-colors"
                            >
                                {expanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                                {expanded ? 'Ẩn lịch sử' : `Xem ${currentContracts.length - 1} hợp đồng trước`}
                            </button>
                            {expanded && (
                                <div className="space-y-1.5">
                                    {currentContracts.slice(0, -1).reverse().map((c, i) => (
                                        <div
                                            key={i}
                                            className={cn(
                                                'px-4 py-2.5 rounded-2xl border',
                                                'bg-gray-50/50 border-gray-100'
                                            )}
                                        >
                                            <div className="flex items-center justify-between">
                                                <span className="text-[12px] font-bold text-gray-700">{c.contractNumber}</span>
                                                <span className="text-[10px] text-gray-400 font-semibold">
                                                    Đã hết hạn
                                                </span>
                                            </div>
                                            <p className="text-[11px] text-gray-500 mt-0.5">
                                                {fmtDate(c.startDate)} → {fmtDate(c.endDate)}
                                            </p>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </>
                    )}
                </div>
            )}
        </div>
    );
}
