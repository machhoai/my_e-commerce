'use client';

import { useState, useEffect, useMemo } from 'react';
import { KpiTemplateDoc, KpiCriteriaScore } from '@/types';
import { useAuth } from '@/contexts/AuthContext';
import { X, ClipboardCheck, Layers, Send, AlertCircle, Zap, RotateCcw, ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import Portal from '@/components/Portal';

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
    const [expandedGroups, setExpandedGroups] = useState<Set<number>>(new Set());

    useEffect(() => {
        if (isOpen && template) {
            const init: Record<string, number> = {};
            template.groups.forEach(g => g.criteria.forEach(c => { init[c.name] = 0; }));
            setScores(init);
            setError('');
            // Expand all groups by default
            setExpandedGroups(new Set(template.groups.map((_, i) => i)));
        }
    }, [isOpen, template]);

    const allCriteria = useMemo(() => template?.groups.flatMap(g => g.criteria) ?? [], [template]);
    const selfTotal = Object.values(scores).reduce((s, v) => s + v, 0);

    if (!isOpen || !template) return null;

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

    const setAllMax = () => {
        const maxed: Record<string, number> = {};
        allCriteria.forEach(c => { maxed[c.name] = c.maxScore; });
        setScores(maxed);
    };

    const resetAll = () => {
        const init: Record<string, number> = {};
        allCriteria.forEach(c => { init[c.name] = 0; });
        setScores(init);
    };

    const toggleGroup = (idx: number) => {
        setExpandedGroups(prev => {
            const next = new Set(prev);
            next.has(idx) ? next.delete(idx) : next.add(idx);
            return next;
        });
    };

    // Score ratio color
    const totalColor = selfTotal >= 80 ? 'text-success-600' : selfTotal >= 50 ? 'text-warning-600' : 'text-danger-600';
    const ringColor = selfTotal >= 80 ? 'stroke-success-500' : selfTotal >= 50 ? 'stroke-warning-500' : 'stroke-danger-500';

    // Circular progress
    const radius = 28;
    const circumference = 2 * Math.PI * radius;
    const progress = (selfTotal / 100) * circumference;

    return (
        <Portal>
            <div className="fixed inset-0 z-[110] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4"
                 onClick={onClose}>
                <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] flex flex-col overflow-hidden animate-in zoom-in-95 fade-in duration-200"
                     onClick={e => e.stopPropagation()}>
                    {/* ── Header ── */}
                    <div className="px-5 pt-5 pb-4 border-b border-surface-100 shrink-0">
                        <div className="flex items-start justify-between">
                            <div className="flex items-center gap-3">
                                {/* Progress ring */}
                                <div className="relative w-[68px] h-[68px] shrink-0">
                                    <svg className="w-full h-full -rotate-90" viewBox="0 0 64 64">
                                        <circle cx="32" cy="32" r={radius} fill="none" strokeWidth="5"
                                            className="stroke-surface-100" />
                                        <circle cx="32" cy="32" r={radius} fill="none" strokeWidth="5"
                                            strokeLinecap="round"
                                            className={cn(ringColor, 'transition-all duration-500')}
                                            strokeDasharray={circumference}
                                            strokeDashoffset={circumference - progress} />
                                    </svg>
                                    <div className="absolute inset-0 flex items-center justify-center">
                                        <span className={cn('text-base font-black', totalColor)}>{selfTotal}</span>
                                    </div>
                                </div>
                                <div>
                                    <h2 className="text-lg font-bold text-surface-800 flex items-center gap-2">
                                        <ClipboardCheck className="w-5 h-5 text-teal-500" />
                                        Tự đánh giá
                                    </h2>
                                    <p className="text-[11px] text-surface-400 mt-0.5 leading-tight">{template.name}</p>
                                    <p className="text-[11px] text-surface-400 leading-tight">
                                        {date} · {shiftId}
                                    </p>
                                </div>
                            </div>
                            <button onClick={onClose} className="p-2 rounded-lg hover:bg-surface-100 text-surface-400 -mr-1 -mt-1 transition-colors">
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        {/* Quick actions */}
                        <div className="flex items-center gap-2 mt-3">
                            <button onClick={setAllMax}
                                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-bold bg-success-50 text-success-700 border border-success-200 hover:bg-success-100 transition-colors active:scale-[0.97]">
                                <Zap className="w-3 h-3" /> Điểm tối đa
                            </button>
                            <button onClick={resetAll}
                                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-bold bg-surface-50 text-surface-600 border border-surface-200 hover:bg-surface-100 transition-colors active:scale-[0.97]">
                                <RotateCcw className="w-3 h-3" /> Đặt lại
                            </button>
                        </div>
                    </div>

                    {/* ── Body ── */}
                    <div className="flex-1 overflow-y-auto p-4 space-y-3">
                        {error && (
                            <div className="bg-danger-50 text-danger-600 p-2.5 rounded-xl flex items-center gap-2 text-sm border border-danger-100 animate-in shake duration-300">
                                <AlertCircle className="w-4 h-4 shrink-0" />{error}
                            </div>
                        )}

                        {template.groups.map((group, gi) => {
                            const isExpanded = expandedGroups.has(gi);
                            const groupTotal = group.criteria.reduce((s, c) => s + (scores[c.name] || 0), 0);
                            const groupMax = group.criteria.reduce((s, c) => s + c.maxScore, 0);
                            const groupPct = groupMax > 0 ? Math.round((groupTotal / groupMax) * 100) : 0;

                            return (
                                <div key={gi} className="border border-surface-200 rounded-xl overflow-hidden bg-surface-50/30">
                                    {/* Group header — collapsible */}
                                    <button
                                        onClick={() => toggleGroup(gi)}
                                        className="w-full flex items-center gap-2 px-3.5 py-2.5 hover:bg-surface-50 transition-colors"
                                    >
                                        <Layers className="w-3.5 h-3.5 text-teal-600 shrink-0" />
                                        <span className="text-xs font-bold text-teal-800 flex-1 text-left">{group.name}</span>
                                        <span className={cn('text-[10px] font-black px-2 py-0.5 rounded-full',
                                            groupPct >= 80 ? 'bg-success-100 text-success-700' :
                                            groupPct >= 50 ? 'bg-warning-100 text-warning-700' :
                                                            'bg-surface-100 text-surface-600'
                                        )}>
                                            {groupTotal}/{groupMax}
                                        </span>
                                        <ChevronDown className={cn('w-3.5 h-3.5 text-surface-400 transition-transform duration-200', isExpanded && 'rotate-180')} />
                                    </button>

                                    {/* Group criteria */}
                                    {isExpanded && (
                                        <div className="px-3 pb-3 space-y-1.5">
                                            {group.criteria.map((c, ci) => {
                                                const score = scores[c.name] || 0;
                                                const pct = c.maxScore > 0 ? (score / c.maxScore) * 100 : 0;
                                                return (
                                                    <div key={ci} className="bg-white rounded-xl p-3 border border-surface-100 hover:border-teal-200 transition-colors">
                                                        <div className="flex items-center justify-between mb-2">
                                                            <p className="text-sm font-medium text-surface-700 flex-1 mr-3">{c.name}</p>
                                                            <div className="flex items-center gap-1.5 shrink-0">
                                                                <button onClick={() => updateScore(c.name, score - 1, c.maxScore)}
                                                                    className="w-8 h-8 rounded-lg bg-surface-50 hover:bg-danger-50 hover:text-danger-600 text-surface-500 font-bold text-base flex items-center justify-center transition-all duration-150 active:scale-90 border border-surface-100 hover:border-danger-200">
                                                                    −
                                                                </button>
                                                                <input type="number" min={0} max={c.maxScore}
                                                                    value={score}
                                                                    onChange={e => updateScore(c.name, parseInt(e.target.value) || 0, c.maxScore)}
                                                                    className="w-12 text-center text-sm font-black border border-surface-200 rounded-lg py-1.5 outline-none focus:ring-2 focus:ring-teal-500/30 focus:border-teal-400 transition-all" />
                                                                <button onClick={() => updateScore(c.name, score + 1, c.maxScore)}
                                                                    className="w-8 h-8 rounded-lg bg-surface-50 hover:bg-success-50 hover:text-success-600 text-surface-500 font-bold text-base flex items-center justify-center transition-all duration-150 active:scale-90 border border-surface-100 hover:border-success-200">
                                                                    +
                                                                </button>
                                                            </div>
                                                        </div>
                                                        {/* Range slider for fast input */}
                                                        <div className="flex items-center gap-2.5">
                                                            <input type="range" min={0} max={c.maxScore} value={score}
                                                                onChange={e => updateScore(c.name, parseInt(e.target.value), c.maxScore)}
                                                                className="flex-1 h-1.5 rounded-full appearance-none cursor-pointer accent-teal-500
                                                                    [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-teal-500 [&::-webkit-slider-thumb]:shadow-md [&::-webkit-slider-thumb]:cursor-pointer [&::-webkit-slider-thumb]:transition-transform [&::-webkit-slider-thumb]:hover:scale-125
                                                                    [&::-webkit-slider-runnable-track]:rounded-full [&::-webkit-slider-runnable-track]:bg-surface-200" />
                                                            <span className="text-[10px] font-bold text-surface-400 w-6 text-right shrink-0">
                                                                {c.maxScore}
                                                            </span>
                                                        </div>
                                                        {/* Mini progress bar */}
                                                        <div className="w-full h-1 rounded-full bg-surface-100 mt-2 overflow-hidden">
                                                            <div className={cn('h-full rounded-full transition-all duration-300',
                                                                pct >= 80 ? 'bg-success-400' : pct >= 50 ? 'bg-warning-400' : 'bg-danger-400'
                                                            )} style={{ width: `${pct}%` }} />
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>

                    {/* ── Footer ── */}
                    <div className="p-4 border-t border-surface-100 shrink-0 bg-surface-50/50">
                        <button onClick={handleSubmit} disabled={saving}
                            className={cn(
                                'w-full py-3 rounded-xl font-bold text-sm flex items-center justify-center gap-2 transition-all duration-200 active:scale-[0.98] shadow-lg',
                                selfTotal > 0
                                    ? 'bg-gradient-to-r from-teal-500 to-teal-600 hover:from-teal-600 hover:to-teal-700 text-white shadow-teal-500/25'
                                    : 'bg-surface-200 text-surface-500 cursor-not-allowed shadow-none'
                            )}
                            title={selfTotal === 0 ? 'Hãy chấm ít nhất 1 tiêu chí' : ''}>
                            {saving ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> : <Send className="w-4 h-4" />}
                            Gửi đánh giá · {selfTotal}/100
                        </button>
                    </div>
                </div>
            </div>
        </Portal>
    );
}
