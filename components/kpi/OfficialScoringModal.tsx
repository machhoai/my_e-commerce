'use client';

import { useState, useEffect, useMemo } from 'react';
import { KpiCriteriaScore } from '@/types';
import { useAuth } from '@/contexts/AuthContext';
import {
    ClipboardCheck, Layers, Save, AlertCircle, ChevronDown,
    ArrowRight, Zap, Copy, MessageSquare,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import Popup from '@/components/ui/Popup';

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
    const [expandedGroups, setExpandedGroups] = useState<Set<number>>(new Set());
    const [activeNoteIdx, setActiveNoteIdx] = useState<number | null>(null);

    useEffect(() => {
        if (isOpen && details) {
            setScores(details.map(d => ({
                ...d,
                officialScore: d.selfScore > 0 ? d.selfScore : d.maxScore,
            })));
            setError('');
            setExpandedGroups(new Set(templateGroups.map((_, i) => i)));
            setActiveNoteIdx(null);
        }
    }, [isOpen, details, templateGroups]);

    const officialTotal = useMemo(() => scores.reduce((s, d) => s + (d.officialScore || 0), 0), [scores]);

    // ── Derived values ─────────────────────────────────────────────────────────
    const scoreColor = (v: number) => v >= 80 ? 'text-success-600' : v >= 50 ? 'text-warning-600' : 'text-danger-600';
    const ringColor = officialTotal >= 80 ? 'stroke-success-500' : officialTotal >= 50 ? 'stroke-warning-500' : 'stroke-danger-500';
    const radius = 28;
    const circumference = 2 * Math.PI * radius;
    const progress = (officialTotal / 100) * circumference;
    const selfProgress = (selfTotal / 100) * circumference;
    const diff = officialTotal - selfTotal;

    // ── Score edit helpers ─────────────────────────────────────────────────────
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

    const copySelfScores = () => {
        setScores(prev => prev.map(s => ({ ...s, officialScore: s.selfScore > 0 ? s.selfScore : s.maxScore })));
    };

    const setAllMax = () => {
        setScores(prev => prev.map(s => ({ ...s, officialScore: s.maxScore })));
    };

    const toggleGroup = (idx: number) => {
        setExpandedGroups(prev => {
            const next = new Set(prev);
            next.has(idx) ? next.delete(idx) : next.add(idx);
            return next;
        });
    };

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
        } catch (err) { setError(err instanceof Error ? err.message : 'Lỗi chấm điểm'); }
        finally { setSaving(false); }
    };

    // ── Group criteria back to template groups ─────────────────────────────────
    const grouped: GroupedCriteria[] = templateGroups.map(g => ({
        groupName: g.name,
        criteria: g.criteria.map(c => scores.find(s => s.criteriaName === c.name) || {
            criteriaName: c.name, maxScore: c.maxScore, selfScore: 0, officialScore: c.maxScore,
        }),
    }));

    // ── Popup sub-components ───────────────────────────────────────────────────
    const popupHeaderLeft = (
        <div className="relative w-[64px] h-[64px] shrink-0">
            <svg className="w-full h-full -rotate-90" viewBox="0 0 64 64">
                <circle cx="32" cy="32" r={radius} fill="none" strokeWidth="4" className="stroke-surface-100" />
                <circle cx="32" cy="32" r={radius} fill="none" strokeWidth="4" strokeLinecap="round"
                    className="stroke-primary-200"
                    strokeDasharray={circumference}
                    strokeDashoffset={circumference - selfProgress} />
                <circle cx="32" cy="32" r={22} fill="none" strokeWidth="5" className="stroke-surface-50" />
                <circle cx="32" cy="32" r={22} fill="none" strokeWidth="5" strokeLinecap="round"
                    className={cn(ringColor, 'transition-all duration-500')}
                    strokeDasharray={2 * Math.PI * 22}
                    strokeDashoffset={(2 * Math.PI * 22) - ((officialTotal / 100) * 2 * Math.PI * 22)} />
            </svg>
            <div className="absolute inset-0 flex items-center justify-center">
                <span className={cn('text-sm font-black', scoreColor(officialTotal))}>{officialTotal}</span>
            </div>
        </div>
    );

    const popupTitle = (
        <div>
            <h2 className="text-base font-bold text-surface-800 flex items-center gap-2">
                <ClipboardCheck className="w-4.5 h-4.5 text-accent-500" />
                Chấm chính thức
            </h2>
            <p className="text-xs text-surface-500 mt-0.5">
                <span className="font-semibold text-surface-700">{employeeName}</span>
            </p>
        </div>
    );

    const popupHeaderExtra = (
        <div className="flex items-center gap-2 flex-wrap">
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-primary-50 border border-primary-200">
                <span className="text-[11px] text-primary-500">NV tự chấm</span>
                <span className="text-xs font-black text-primary-700">{selfTotal}</span>
            </div>
            <ArrowRight className="w-3.5 h-3.5 text-surface-300" />
            <div className={cn('flex items-center gap-1.5 px-2.5 py-1 rounded-lg border',
                officialTotal >= 80 ? 'bg-success-50 border-success-200' :
                    officialTotal >= 50 ? 'bg-warning-50 border-warning-200' :
                        'bg-danger-50 border-danger-200'
            )}>
                <span className="text-[11px] text-surface-500">Chính thức</span>
                <span className={cn('text-xs font-black', scoreColor(officialTotal))}>{officialTotal}</span>
            </div>
            {diff !== 0 && (
                <span className={cn('text-[11px] font-bold px-2 py-0.5 rounded-full',
                    diff > 0 ? 'bg-success-100 text-success-700' : 'bg-danger-100 text-danger-700'
                )}>{diff > 0 ? '+' : ''}{diff}</span>
            )}
            <button onClick={copySelfScores}
                className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-bold bg-primary-50 text-primary-600 border border-primary-200 hover:bg-primary-100 transition-colors active:scale-[0.97]">
                <Copy className="w-3 h-3" /> Lấy điểm NV
            </button>
            <button onClick={setAllMax}
                className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-bold bg-success-50 text-success-600 border border-success-200 hover:bg-success-100 transition-colors active:scale-[0.97]">
                <Zap className="w-3 h-3" /> Tối đa
            </button>
        </div>
    );

    const popupFooter = (
        <div className="p-4">
            <button onClick={handleSubmit} disabled={saving}
                className="w-full bg-gradient-to-r from-accent-600 to-accent-700 hover:from-accent-700 hover:to-accent-800 disabled:opacity-50 text-white py-3 rounded-xl font-bold text-sm flex items-center justify-center gap-2 transition-all duration-200 active:scale-[0.98] shadow-lg shadow-accent-600/25">
                {saving ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> : <Save className="w-4 h-4" />}
                Lưu điểm chính thức · {officialTotal}/100
            </button>
        </div>
    );

    // Avoid unused-var TS warning
    void progress;

    return (
        <Popup
            isOpen={isOpen}
            onClose={onClose}
            title={popupTitle}
            headerLeft={popupHeaderLeft}
            headerExtra={popupHeaderExtra}
            footer={popupFooter}
        >
            {/* ── Body ── */}
            <div className="p-4 space-y-3">
                {error && (
                    <div className="bg-danger-50 text-danger-600 p-2.5 rounded-xl flex items-center gap-2 text-sm border border-danger-100">
                        <AlertCircle className="w-4 h-4 shrink-0" />{error}
                    </div>
                )}

                {grouped.map((group, gi) => {
                    const isExpanded = expandedGroups.has(gi);
                    const groupOfficial = group.criteria.reduce((s, c) => s + (c.officialScore || 0), 0);
                    const groupSelf = group.criteria.reduce((s, c) => s + (c.selfScore || 0), 0);
                    const groupMax = group.criteria.reduce((s, c) => s + c.maxScore, 0);
                    const groupDiff = groupOfficial - groupSelf;

                    return (
                        <div key={gi} className="border border-surface-200 rounded-xl overflow-hidden bg-surface-50/30">
                            {/* Group header */}
                            <button
                                onClick={() => toggleGroup(gi)}
                                className="w-full flex items-center gap-2 px-3.5 py-2.5 hover:bg-surface-50 transition-colors"
                            >
                                <Layers className="w-3.5 h-3.5 text-accent-600 shrink-0" />
                                <span className="text-xs font-bold text-accent-800 flex-1 text-left">{group.groupName}</span>
                                <div className="flex items-center gap-1.5 text-[10px]">
                                    <span className="font-bold text-primary-500">{groupSelf}</span>
                                    <ArrowRight className="w-2.5 h-2.5 text-surface-300" />
                                    <span className={cn('font-black', scoreColor(Math.round((groupOfficial / Math.max(groupMax, 1)) * 100)))}>{groupOfficial}</span>
                                    <span className="text-surface-400">/{groupMax}</span>
                                    {groupDiff !== 0 && (
                                        <span className={cn('font-bold', groupDiff > 0 ? 'text-success-500' : 'text-danger-500')}>
                                            ({groupDiff > 0 ? '+' : ''}{groupDiff})
                                        </span>
                                    )}
                                </div>
                                <ChevronDown className={cn('w-3.5 h-3.5 text-surface-400 transition-transform duration-200', isExpanded && 'rotate-180')} />
                            </button>

                            {/* Criteria */}
                            {isExpanded && (
                                <div className="px-3 pb-3 space-y-1.5">
                                    {group.criteria.map((c) => {
                                        const idx = scores.findIndex(s => s.criteriaName === c.criteriaName);
                                        if (idx === -1) return null;
                                        const s = scores[idx];
                                        const itemDiff = (s.officialScore || 0) - (s.selfScore || 0);
                                        const showNote = activeNoteIdx === idx;
                                        const pct = s.maxScore > 0 ? ((s.officialScore || 0) / s.maxScore) * 100 : 0;

                                        return (
                                            <div key={c.criteriaName} className="bg-white rounded-xl p-3 border border-surface-100 hover:border-accent-200 transition-colors">
                                                <div className="flex items-center justify-between mb-2">
                                                    <div className="flex-1 min-w-0 mr-3">
                                                        <p className="text-sm font-medium text-surface-700">{c.criteriaName}</p>
                                                        <div className="flex items-center gap-2 mt-0.5">
                                                            <span className="text-[10px] text-surface-400">Tối đa: {c.maxScore}</span>
                                                            <span className="text-[10px] text-primary-500 font-semibold">NV: {s.selfScore}</span>
                                                            {itemDiff !== 0 && (
                                                                <span className={cn('text-[10px] font-bold',
                                                                    itemDiff > 0 ? 'text-success-500' : 'text-danger-500'
                                                                )}>
                                                                    {itemDiff > 0 ? '+' : ''}{itemDiff}
                                                                </span>
                                                            )}
                                                        </div>
                                                    </div>
                                                    <div className="flex items-center gap-2 shrink-0">
                                                        <button onClick={() => updateScore(idx, s.officialScore - 1)}
                                                            className="w-10 h-10 rounded-xl bg-surface-50 hover:bg-danger-50 hover:text-danger-600 text-surface-500 text-lg font-bold flex items-center justify-center transition-all duration-150 active:scale-90 border border-surface-100 hover:border-danger-200 select-none">
                                                            −
                                                        </button>
                                                        <input type="number" min={0} max={c.maxScore}
                                                            value={s.officialScore}
                                                            onChange={e => updateScore(idx, parseInt(e.target.value) || 0)}
                                                            className="w-14 text-center text-sm font-black border border-surface-200 rounded-lg py-2 outline-none focus:ring-2 focus:ring-accent-500/30 focus:border-accent-400 transition-all" />
                                                        <button onClick={() => updateScore(idx, s.officialScore + 1)}
                                                            className="w-10 h-10 rounded-xl bg-surface-50 hover:bg-success-50 hover:text-success-600 text-surface-500 text-lg font-bold flex items-center justify-center transition-all duration-150 active:scale-90 border border-surface-100 hover:border-success-200 select-none">
                                                            +
                                                        </button>
                                                    </div>
                                                </div>

                                                {/* Slider */}
                                                <div className="flex items-center gap-3 mt-1">
                                                    <input type="range" min={0} max={c.maxScore} value={s.officialScore || 0}
                                                        onChange={e => updateScore(idx, parseInt(e.target.value))}
                                                        className="flex-1 h-3 rounded-full appearance-none cursor-pointer accent-accent-500
                                                            [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-6 [&::-webkit-slider-thumb]:h-6 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-accent-500 [&::-webkit-slider-thumb]:shadow-lg [&::-webkit-slider-thumb]:cursor-pointer [&::-webkit-slider-thumb]:transition-transform [&::-webkit-slider-thumb]:hover:scale-110 [&::-webkit-slider-thumb]:active:scale-125
                                                            [&::-webkit-slider-runnable-track]:rounded-full [&::-webkit-slider-runnable-track]:h-6 [&::-webkit-slider-runnable-track]:bg-surface-200" />
                                                    <button onClick={() => setActiveNoteIdx(showNote ? null : idx)}
                                                        className={cn('w-9 h-9 rounded-xl flex items-center justify-center transition-colors',
                                                            showNote || s.note ? 'text-accent-500 bg-accent-50' : 'text-surface-300 hover:text-surface-500 hover:bg-surface-50'
                                                        )}>
                                                        <MessageSquare className="w-4 h-4" />
                                                    </button>
                                                </div>

                                                {/* Progress bar */}
                                                <div className="w-full h-1 rounded-full bg-surface-100 mt-2 overflow-hidden">
                                                    <div className={cn('h-full rounded-full transition-all duration-300',
                                                        pct >= 80 ? 'bg-success-400' : pct >= 50 ? 'bg-warning-400' : 'bg-danger-400'
                                                    )} style={{ width: `${pct}%` }} />
                                                </div>

                                                {/* Note field */}
                                                {showNote && (
                                                    <input value={s.note || ''} onChange={e => updateNote(idx, e.target.value)}
                                                        placeholder="Nhận xét (tùy chọn)..."
                                                        autoFocus
                                                        className="w-full text-xs border border-surface-200 rounded-lg px-3 py-2 mt-2 outline-none focus:ring-2 focus:ring-accent-500/20 focus:border-accent-400 text-surface-600 placeholder:text-surface-300 transition-all" />
                                                )}
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>
        </Popup>
    );
}
