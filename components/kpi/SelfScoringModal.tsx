'use client';

import { useState, useEffect } from 'react';
import { KpiTemplateDoc, KpiGroup, KpiCriteriaScore } from '@/types';
import { useAuth } from '@/contexts/AuthContext';
import { X, ClipboardCheck, Layers, Send, AlertCircle } from 'lucide-react';
import { cn } from '@/lib/utils';

interface Props {
    isOpen: boolean;
    onClose: () => void;
    template: KpiTemplateDoc;
    shiftId: string;
    date: string;
    counterId: string;
    storeId: string;
    onSuccess: () => void;
}

export default function SelfScoringModal({
    isOpen, onClose, template, shiftId, date, counterId, storeId, onSuccess,
}: Props) {
    const { getToken } = useAuth();
    const [scores, setScores] = useState<Record<string, number>>({});
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');

    useEffect(() => {
        if (isOpen && template) {
            const init: Record<string, number> = {};
            template.groups.forEach(g => g.criteria.forEach(c => { init[c.name] = 0; }));
            setScores(init);
            setError('');
        }
    }, [isOpen, template]);

    if (!isOpen || !template) return null;

    const allCriteria = template.groups.flatMap(g => g.criteria);
    const selfTotal = Object.values(scores).reduce((s, v) => s + v, 0);

    const handleSubmit = async () => {
        setSaving(true); setError('');
        try {
            const token = await getToken();
            const details: Omit<KpiCriteriaScore, 'officialScore'>[] = allCriteria.map(c => ({
                criteriaName: c.name,
                maxScore: c.maxScore,
                selfScore: scores[c.name] || 0,
            }));

            const res = await fetch('/api/kpi-records', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
                body: JSON.stringify({ storeId, shiftId, date, counterId, templateId: template.id, details }),
            });
            if (!res.ok) { const d = await res.json(); throw new Error(d.error); }
            onSuccess();
            onClose();
        } catch (err) { setError(err instanceof Error ? err.message : 'Lỗi gửi đánh giá'); } finally { setSaving(false); }
    };

    const updateScore = (name: string, val: number, max: number) => {
        setScores(prev => ({ ...prev, [name]: Math.min(Math.max(0, val), max) }));
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] flex flex-col overflow-hidden">
                {/* Header */}
                <div className="p-5 border-b border-slate-100 flex items-center justify-between shrink-0">
                    <div>
                        <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                            <ClipboardCheck className="w-5 h-5 text-teal-500" />
                            Tự đánh giá KPI
                        </h2>
                        <p className="text-xs text-slate-400 mt-0.5">{template.name}</p>
                    </div>
                    <button onClick={onClose} className="p-2 rounded-lg hover:bg-slate-100 text-slate-400"><X className="w-5 h-5" /></button>
                </div>

                {/* Body */}
                <div className="flex-1 overflow-y-auto p-5 space-y-4">
                    {error && (
                        <div className="bg-red-50 text-red-600 p-2.5 rounded-lg flex items-center gap-2 text-sm border border-red-100">
                            <AlertCircle className="w-4 h-4 shrink-0" />{error}
                        </div>
                    )}

                    {template.groups.map((group, gi) => (
                        <div key={gi} className="border border-slate-200 rounded-xl p-3 bg-slate-50/50">
                            <p className="text-xs font-bold text-teal-700 mb-2 flex items-center gap-1.5">
                                <Layers className="w-3.5 h-3.5" />
                                {group.name}
                            </p>
                            <div className="space-y-2">
                                {group.criteria.map((c, ci) => (
                                    <div key={ci} className="flex items-center gap-3 bg-white rounded-lg p-2 border border-slate-100">
                                        <div className="flex-1 min-w-0">
                                            <p className="text-sm font-medium text-slate-700 truncate">{c.name}</p>
                                            <p className="text-[10px] text-slate-400">Tối đa: {c.maxScore}đ</p>
                                        </div>
                                        <div className="flex items-center gap-1 shrink-0">
                                            <button onClick={() => updateScore(c.name, (scores[c.name] || 0) - 1, c.maxScore)}
                                                className="w-7 h-7 rounded-lg bg-slate-100 hover:bg-slate-200  text-slate-600 font-bold text-sm flex items-center justify-center transition-colors">−</button>
                                            <input type="number" min={0} max={c.maxScore}
                                                value={scores[c.name] ?? 0}
                                                onChange={e => updateScore(c.name, parseInt(e.target.value) || 0, c.maxScore)}
                                                className="w-12 text-center text-sm font-bold border border-slate-200 rounded-lg py-1 outline-none focus:ring-2 focus:ring-teal-500/20" />
                                            <button onClick={() => updateScore(c.name, (scores[c.name] || 0) + 1, c.maxScore)}
                                                className="w-7 h-7 rounded-lg bg-slate-100 hover:bg-slate-200  text-slate-600 font-bold text-sm flex items-center justify-center transition-colors">+</button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    ))}
                </div>

                {/* Footer */}
                <div className="p-5 border-t border-slate-100 shrink-0">
                    <div className="flex items-center justify-between mb-3">
                        <span className="text-sm font-semibold text-slate-600">Tổng điểm tự đánh giá</span>
                        <span className={cn('text-xl font-black', selfTotal >= 80 ? 'text-emerald-600' : selfTotal >= 50 ? 'text-amber-600' : 'text-red-600')}>
                            {selfTotal}<span className="text-sm font-bold text-slate-400">/100</span>
                        </span>
                    </div>
                    <button onClick={handleSubmit} disabled={saving}
                        className="w-full bg-teal-600 hover:bg-teal-700 disabled:opacity-50 text-white py-2.5 rounded-xl font-semibold text-sm flex items-center justify-center gap-2 transition-colors">
                        {saving ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> : <Send className="w-4 h-4" />}
                        Gửi đánh giá
                    </button>
                </div>
            </div>
        </div>
    );
}
