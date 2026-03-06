'use client';

import { useState, useEffect } from 'react';
import { KpiCriteriaScore } from '@/types';
import { useAuth } from '@/contexts/AuthContext';
import { X, ClipboardCheck, Layers, Save, AlertCircle, Minus, Plus } from 'lucide-react';
import { cn } from '@/lib/utils';
import Portal from '@/components/Portal';

interface GroupedCriteria {
    groupName: string;
    criteria: KpiCriteriaScore[];
}

interface Props {
    isOpen: boolean;
    onClose: () => void;
    recordId: string;
    employeeName: string;
    selfTotal: number;
    details: KpiCriteriaScore[];
    templateGroups: { name: string; criteria: { name: string; maxScore: number }[] }[];
    onSuccess: () => void;
}

export default function OfficialScoringModal({
    isOpen, onClose, recordId, employeeName, selfTotal, details, templateGroups, onSuccess,
}: Props) {
    const { getToken } = useAuth();
    const [scores, setScores] = useState<KpiCriteriaScore[]>([]);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');

    useEffect(() => {
        if (isOpen && details) {
            // Pre-fill officialScore with selfScore (or maxScore if self=0)
            setScores(details.map(d => ({
                ...d,
                officialScore: d.selfScore > 0 ? d.selfScore : d.maxScore,
            })));
            setError('');
        }
    }, [isOpen, details]);

    if (!isOpen) return null;

    const officialTotal = scores.reduce((s, d) => s + (d.officialScore || 0), 0);

    const updateScore = (idx: number, val: number) => {
        const next = [...scores];
        next[idx] = { ...next[idx], officialScore: Math.min(Math.max(0, val), next[idx].maxScore) };
        setScores(next);
    };

    const updateNote = (idx: number, note: string) => {
        const next = [...scores];
        next[idx] = { ...next[idx], note };
        setScores(next);
    };

    // Group criteria back to template groups for structured display
    const grouped: GroupedCriteria[] = templateGroups.map(g => ({
        groupName: g.name,
        criteria: g.criteria.map(c => scores.find(s => s.criteriaName === c.name) || {
            criteriaName: c.name, maxScore: c.maxScore, selfScore: 0, officialScore: c.maxScore,
        }),
    }));

    const handleSubmit = async () => {
        setSaving(true); setError('');
        try {
            const token = await getToken();
            const res = await fetch(`/api/kpi-records/${recordId}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
                body: JSON.stringify({ details: scores, status: 'OFFICIAL' }),
            });
            if (!res.ok) { const d = await res.json(); throw new Error(d.error); }
            onSuccess();
            onClose();
        } catch (err) { setError(err instanceof Error ? err.message : 'Lỗi chấm điểm'); } finally { setSaving(false); }
    };

    return (
        <Portal>
            <div className="fixed inset-0 z-[110] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
                <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden">
                    {/* Header */}
                    <div className="p-5 border-b border-slate-100 shrink-0">
                        <div className="flex items-center justify-between">
                            <div>
                                <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                                    <ClipboardCheck className="w-5 h-5 text-indigo-500" />
                                    Chấm điểm chính thức
                                </h2>
                                <p className="text-sm text-slate-500 mt-0.5">Nhân viên: <span className="font-semibold text-slate-700">{employeeName}</span></p>
                            </div>
                            <button onClick={onClose} className="p-2 rounded-lg hover:bg-slate-100 text-slate-400"><X className="w-5 h-5" /></button>
                        </div>
                        {/* Self-score badge */}
                        <div className="mt-3 flex items-center gap-3 text-xs">
                            <span className="px-2.5 py-1 rounded-lg bg-blue-50 text-blue-700 font-bold border border-blue-200">
                                NV tự chấm: {selfTotal}/100
                            </span>
                            <span className={cn('px-2.5 py-1 rounded-lg font-bold border',
                                officialTotal >= 80 ? 'bg-emerald-50 text-emerald-700 border-emerald-200' :
                                    officialTotal >= 50 ? 'bg-amber-50 text-amber-700 border-amber-200' :
                                        'bg-red-50 text-red-700 border-red-200'
                            )}>
                                Điểm chính thức: {officialTotal}/100
                            </span>
                        </div>
                    </div>

                    {/* Body */}
                    <div className="flex-1 overflow-y-auto p-5 space-y-4">
                        {error && (
                            <div className="bg-red-50 text-red-600 p-2.5 rounded-lg flex items-center gap-2 text-sm border border-red-100">
                                <AlertCircle className="w-4 h-4 shrink-0" />{error}
                            </div>
                        )}

                        {grouped.map((group, gi) => (
                            <div key={gi} className="border border-slate-200 rounded-xl p-3 bg-slate-50/50">
                                <p className="text-xs font-bold text-indigo-700 mb-2 flex items-center gap-1.5">
                                    <Layers className="w-3.5 h-3.5" />
                                    {group.groupName}
                                </p>
                                <div className="space-y-2">
                                    {group.criteria.map((c) => {
                                        const idx = scores.findIndex(s => s.criteriaName === c.criteriaName);
                                        if (idx === -1) return null;
                                        const s = scores[idx];
                                        return (
                                            <div key={c.criteriaName} className="bg-white rounded-lg p-3 border border-slate-100 space-y-2">
                                                <div className="flex items-center gap-3">
                                                    <div className="flex-1 min-w-0">
                                                        <p className="text-sm font-medium text-slate-700 truncate">{c.criteriaName}</p>
                                                        <div className="flex items-center gap-2 mt-0.5">
                                                            <span className="text-[10px] text-slate-400">Tối đa: {c.maxScore}đ</span>
                                                            {s.selfScore > 0 && <span className="text-[10px] text-blue-500 font-semibold">NV: {s.selfScore}đ</span>}
                                                        </div>
                                                    </div>
                                                    <div className="flex items-center gap-1 shrink-0">
                                                        <button onClick={() => updateScore(idx, s.officialScore - 1)}
                                                            className="w-8 h-8 rounded-lg bg-slate-100 hover:bg-red-100 hover:text-red-600 text-slate-600 font-bold flex items-center justify-center transition-colors">
                                                            <Minus className="w-3.5 h-3.5" />
                                                        </button>
                                                        <input type="number" min={0} max={c.maxScore}
                                                            value={s.officialScore}
                                                            onChange={e => updateScore(idx, parseInt(e.target.value) || 0)}
                                                            className="w-14 text-center text-sm font-bold border border-slate-200 rounded-lg py-1.5 outline-none focus:ring-2 focus:ring-indigo-500/20" />
                                                        <button onClick={() => updateScore(idx, s.officialScore + 1)}
                                                            className="w-8 h-8 rounded-lg bg-slate-100 hover:bg-emerald-100 hover:text-emerald-600 text-slate-600 font-bold flex items-center justify-center transition-colors">
                                                            <Plus className="w-3.5 h-3.5" />
                                                        </button>
                                                    </div>
                                                </div>
                                                {/* Note field */}
                                                <input value={s.note || ''} onChange={e => updateNote(idx, e.target.value)} placeholder="Ghi chú (tùy chọn)..."
                                                    className="w-full text-xs border border-slate-100 rounded-lg px-2.5 py-1.5 outline-none focus:ring-1 focus:ring-indigo-500/20 text-slate-500" />
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        ))}
                    </div>

                    {/* Footer */}
                    <div className="p-5 border-t border-slate-100 shrink-0">
                        <button onClick={handleSubmit} disabled={saving}
                            className="w-full bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white py-2.5 rounded-xl font-semibold text-sm flex items-center justify-center gap-2 transition-colors">
                            {saving ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> : <Save className="w-4 h-4" />}
                            Lưu điểm chính thức
                        </button>
                    </div>
                </div>
            </div>
        </Portal>
    );
}
