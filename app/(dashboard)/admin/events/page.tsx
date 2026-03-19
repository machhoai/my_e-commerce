'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import {
    BarChart3, CalendarDays, Plus, Loader2, CheckCircle2, AlertCircle,
    LayoutDashboard, FileText, Ticket, X, Code2, Users, Download, FileDown, Search,
    TrendingUp, Ban, Play, Hash, Gift, ChevronDown, ChevronRight, Dices, Trophy, Eye,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import EventIntegrationGuide from '@/components/admin/EventIntegrationGuide';
import type {
    EventDoc, VoucherCampaign, AuditLogDoc, PrizePoolEntry, EventParticipation,
} from '@/types';

// ─── Constants ──────────────────────────────────────────────────
const TABS = [
    { key: 'dashboard', label: 'Tổng quan', icon: LayoutDashboard },
    { key: 'events', label: 'Danh sách Sự kiện', icon: CalendarDays },
    { key: 'customers', label: 'Dữ liệu Khách hàng', icon: Users },
    { key: 'audit', label: 'Lịch sử hoạt động', icon: FileText },
    { key: 'integration', label: 'Tích hợp API', icon: Code2 },
] as const;

type TabKey = typeof TABS[number]['key'];

const EVENT_STATUS_BADGE: Record<string, string> = {
    upcoming: 'bg-primary-50 text-primary-700 border-primary-200',
    active: 'bg-success-50 text-success-700 border-success-200',
    ended: 'bg-surface-100 text-surface-600 border-surface-200',
    closed: 'bg-danger-50 text-danger-700 border-danger-200',
};

const EVENT_STATUS_LABELS: Record<string, string> = {
    upcoming: 'Sắp diễn ra',
    active: 'Đang diễn ra',
    ended: 'Đã kết thúc',
    closed: 'Đã đóng',
};

const REWARD_LABELS: Record<string, string> = {
    discount_percent: 'Giảm %',
    discount_fixed: 'Giảm tiền',
    free_ticket: 'Vé miễn phí',
    free_item: 'Tặng sản phẩm',
};

const AUDIT_ACTION_LABELS: Record<string, string> = {
    CREATE_EVENT: 'Tạo sự kiện',
    UPDATE_EVENT: 'Cập nhật sự kiện',
    GENERATE_VOUCHERS: 'Tạo voucher',
    ISSUE_VOUCHER: 'Phát voucher',
    REVOKE_VOUCHER: 'Vô hiệu voucher',
};

// ─── Extended event type from API ───────────────────────────────
interface CampaignStock {
    campaignId: string;
    campaignName: string;
    rewardType: string;
    rate: number;
    dailyLimit: number;
    totalStock: number;
    available: number;
    distributed: number;
}

interface EventWithStats extends EventDoc {
    campaignNames: string;
    totalStock: number;
    codesAvailable: number;
    codesDistributed: number;
    codesUsed: number;
    codesRevoked: number;
    campaignStocks: CampaignStock[];
}

// ─── Main Page ──────────────────────────────────────────────────
export default function EventsPage() {
    const { user, userDoc, loading: authLoading, hasPermission } = useAuth();
    const [tab, setTab] = useState<TabKey>('dashboard');

    const [events, setEvents] = useState<EventWithStats[]>([]);
    const [campaigns, setCampaigns] = useState<VoucherCampaign[]>([]);
    const [auditLogs, setAuditLogs] = useState<AuditLogDoc[]>([]);
    const [participations, setParticipations] = useState<Record<string, EventParticipation[]>>({});
    const [recentPlays, setRecentPlays] = useState<AuditLogDoc[]>([]);
    const [loading, setLoading] = useState(true);

    const [msg, setMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
    const showMsg = (type: 'success' | 'error', text: string) => {
        setMsg({ type, text });
        setTimeout(() => setMsg(null), 5000);
    };

    const getToken = useCallback(async () => user ? await user.getIdToken() : undefined, [user]);

    const fetchData = useCallback(async () => {
        try {
            setLoading(true);
            const token = await getToken();
            const res = await fetch('/api/events', {
                headers: { Authorization: `Bearer ${token}` },
            });
            if (!res.ok) throw new Error('Không thể tải dữ liệu');
            const data = await res.json();
            setEvents(data.events || []);
            setCampaigns(data.campaigns || []);
            setAuditLogs(data.auditLogs || []);
            setParticipations(data.participations || {});
            setRecentPlays(data.recentPlays || []);
        } catch {
            showMsg('error', 'Không thể tải dữ liệu sự kiện');
        } finally {
            setLoading(false);
        }
    }, [getToken]);

    useEffect(() => {
        if (user && (userDoc?.role === 'admin' || userDoc?.role === 'super_admin' || hasPermission('page.admin.events'))) {
            fetchData();
        }
    }, [user, userDoc, hasPermission, fetchData]);

    if (authLoading) return <div className="p-8 text-center">Đang tải...</div>;
    if (userDoc?.role !== 'admin' && userDoc?.role !== 'super_admin' && !hasPermission('page.admin.events')) {
        return <div className="p-8 text-center text-danger-500">Bạn không có quyền truy cập trang này.</div>;
    }

    return (
        <div className="space-y-6 mx-auto">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-surface-800 flex items-center gap-2">
                        <CalendarDays className="w-7 h-7 text-accent-500" />
                        Quản lý Sự kiện
                    </h1>
                    <p className="text-surface-500 mt-1">Tạo sự kiện, thiết lập prize pool, theo dõi phân phối.</p>
                </div>
            </div>

            {/* Tabs */}
            <div className="flex gap-1 bg-surface-100 p-1 rounded-xl w-fit">
                {TABS.map(t => (
                    <button
                        key={t.key}
                        onClick={() => setTab(t.key)}
                        className={cn(
                            'flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all',
                            tab === t.key
                                ? 'bg-white text-surface-800 shadow-sm'
                                : 'text-surface-500 hover:text-surface-700'
                        )}
                    >
                        <t.icon className="w-4 h-4" />
                        {t.label}
                    </button>
                ))}
            </div>

            {/* Messages */}
            {msg && (
                <div className={cn(
                    'p-4 rounded-xl flex items-center gap-3 text-sm font-medium animate-in fade-in',
                    msg.type === 'success'
                        ? 'bg-success-50 text-success-700 border border-success-200'
                        : 'bg-danger-50 text-danger-600 border border-danger-100'
                )}>
                    {msg.type === 'success' ? <CheckCircle2 className="w-5 h-5 shrink-0" /> : <AlertCircle className="w-5 h-5 shrink-0" />}
                    {msg.text}
                </div>
            )}

            {/* Tab Content */}
            {loading ? (
                <div className="p-16 text-center text-surface-400">
                    <div className="w-8 h-8 border-4 border-accent-500 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
                    Đang tải dữ liệu...
                </div>
            ) : (
                <>
                    {tab === 'dashboard' && <DashboardTab events={events} participations={participations} recentPlays={recentPlays} />}
                    {tab === 'events' && (
                        <EventListTab
                            events={events}
                            campaigns={campaigns}
                            getToken={getToken}
                            onSuccess={(msg) => { fetchData(); showMsg('success', msg); }}
                            onError={(e) => showMsg('error', e)}
                        />
                    )}
                    {tab === 'customers' && <CustomerDataTab events={events} participations={participations} />}
                    {tab === 'audit' && <AuditTab auditLogs={auditLogs} />}
                    {tab === 'integration' && (
                        events.length > 0 ? (
                            <IntegrationTab events={events} />
                        ) : (
                            <div className="p-12 text-center text-surface-400">
                                <Code2 className="w-12 h-12 mx-auto mb-3 opacity-30" />
                                <p className="font-medium">Tạo sự kiện trước để xem tài liệu tích hợp</p>
                            </div>
                        )
                    )}
                </>
            )}
        </div>
    );
}

// ═════════════════════════════════════════════════════════════════
// SHARED: EVENT DETAIL PANEL
// ═════════════════════════════════════════════════════════════════
function EventDetailPanel({ event }: { event: EventWithStats }) {
    const todayStr = new Date().toISOString().slice(0, 10);
    const totalIssued = event.codesDistributed + event.codesUsed;
    const isActive = event.status === 'active';
    const isClosed = event.status === 'closed' || event.status === 'ended';

    return (
        <div className="space-y-4">
            {/* KPI row */}
            <div className="grid grid-cols-2 gap-3">
                {[
                    { label: 'Tổng mã', value: event.totalStock, icon: Hash, color: 'text-primary-600 bg-primary-50' },
                    { label: 'Đã phát', value: totalIssued, icon: Gift, color: 'text-accent-600 bg-accent-50' },
                    { label: 'Còn lại', value: event.codesAvailable, icon: Ticket, color: 'text-warning-600 bg-warning-50' },
                    { label: 'Đã dùng', value: event.codesUsed, icon: CheckCircle2, color: 'text-success-600 bg-success-50' },
                ].map(k => (
                    <div key={k.label} className={cn('rounded-xl border p-4', isClosed ? 'bg-surface-50 border-surface-100' : 'bg-white border-surface-200')}>
                        <div className="flex items-center gap-2 mb-2">
                            <div className={cn('w-7 h-7 rounded-lg flex items-center justify-center', k.color)}>
                                <k.icon className="w-3.5 h-3.5" />
                            </div>
                            <span className="text-xs font-medium text-surface-500">{k.label}</span>
                        </div>
                        <p className="text-2xl font-black text-surface-800">{k.value.toLocaleString()}</p>
                    </div>
                ))}
            </div>

            {/* Prize Pool */}
            {(event.campaignStocks || []).length > 0 && (
                <div className={cn('rounded-xl border overflow-hidden', isClosed ? 'border-surface-100' : 'border-surface-200')}>
                    <div className="px-4 py-2.5 bg-surface-50 border-b border-surface-100 flex items-center gap-2">
                        <Gift className="w-3.5 h-3.5 text-accent-500" />
                        <span className="text-xs font-bold text-surface-700">Prize Pool</span>
                    </div>
                    <div className="divide-y divide-surface-50">
                        {event.campaignStocks.map((cs, i) => {
                            const used = isActive ? (event.dailyStats?.[todayStr]?.[cs.campaignId] || 0) : 0;
                            const pct = cs.dailyLimit > 0 ? Math.min((used / cs.dailyLimit) * 100, 100) : 0;
                            const colors = ['bg-accent-500', 'bg-primary-500', 'bg-warning-500', 'bg-success-500', 'bg-danger-400'];
                            return (
                                <div key={cs.campaignId} className="px-4 py-3">
                                    <div className="flex items-center justify-between mb-1">
                                        <div className="flex items-center gap-2">
                                            <div className={cn('w-2 h-2 rounded-full', colors[i % 5])} />
                                            <span className="text-xs font-semibold text-surface-700">{cs.campaignName}</span>
                                            <span className="text-[10px] px-1.5 py-0.5 rounded bg-surface-100 text-surface-500">{REWARD_LABELS[cs.rewardType] || cs.rewardType} • {cs.rate}%</span>
                                        </div>
                                        <span className="text-xs text-surface-500">{cs.available}/{cs.totalStock}</span>
                                    </div>
                                    {isActive && (
                                        <div className="ml-4">
                                            <div className="h-1.5 bg-surface-100 rounded-full overflow-hidden">
                                                <div className={cn('h-full rounded-full transition-all', pct >= 100 ? 'bg-danger-500' : pct >= 80 ? 'bg-warning-500' : colors[i % 5])} style={{ width: `${pct}%` }} />
                                            </div>
                                            <p className="text-[10px] text-surface-400 mt-0.5">Hôm nay: {used}/{cs.dailyLimit}</p>
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}
        </div>
    );
}

// ═════════════════════════════════════════════════════════════════
// TAB 1: DASHBOARD
// ═════════════════════════════════════════════════════════════════
function DashboardTab({ events, participations, recentPlays }: {
    events: EventWithStats[];
    participations: Record<string, EventParticipation[]>;
    recentPlays: AuditLogDoc[];
}) {
    const activeGroup = events.filter(e => e.status === 'active' || e.status === 'upcoming');
    const closedGroup = events.filter(e => e.status === 'closed' || e.status === 'ended');
    const firstId = (activeGroup[0] || closedGroup[0])?.id || '';
    const [selectedId, setSelectedId] = useState(firstId);
    const [showClosed, setShowClosed] = useState(false);
    const selected = events.find(e => e.id === selectedId);

    // Participation stats for selected event
    const selectedParticipations = participations[selectedId] || [];
    const pStats = useMemo(() => {
        const totalPlayers = selectedParticipations.length;
        const totalSpinsUsed = selectedParticipations.reduce((s, p) => s + p.usedSpins, 0);
        const totalPrizesWon = selectedParticipations.reduce((s, p) => s + p.prizes.length, 0);
        return { totalPlayers, totalSpinsUsed, totalPrizesWon };
    }, [selectedParticipations]);

    // Recent plays for selected event
    const eventRecentPlays = useMemo(() =>
        recentPlays.filter(l => l.targetId === selectedId).slice(0, 10),
        [recentPlays, selectedId]
    );

    if (events.length === 0) {
        return (
            <div className="p-12 text-center text-surface-400">
                <CalendarDays className="w-12 h-12 mx-auto mb-3 opacity-30" />
                <p className="font-medium">Chưa có sự kiện nào</p>
                <p className="text-xs mt-1">Tạo sự kiện ở tab &quot;Danh sách Sự kiện&quot;</p>
            </div>
        );
    }

    const EventSidebarCard = ({ evt }: { evt: EventWithStats }) => {
        const isSelected = evt.id === selectedId;
        const isClosed = evt.status === 'closed' || evt.status === 'ended';
        const evtParts = participations[evt.id] || [];
        return (
            <button
                onClick={() => setSelectedId(evt.id)}
                className={cn(
                    'w-full text-left px-3 py-2.5 rounded-xl transition-all border',
                    isSelected
                        ? 'bg-accent-50 border-accent-200 shadow-sm'
                        : 'bg-white border-surface-100 hover:border-surface-200 hover:bg-surface-50',
                    isClosed && 'opacity-60'
                )}
            >
                <div className="flex items-start justify-between gap-2">
                    <p className={cn('text-sm font-semibold leading-tight truncate', isSelected ? 'text-accent-700' : 'text-surface-800')}>{evt.name}</p>
                    <span className={cn('text-[10px] font-bold px-1.5 py-0.5 rounded border shrink-0', EVENT_STATUS_BADGE[evt.status])}>
                        {EVENT_STATUS_LABELS[evt.status]}
                    </span>
                </div>
                <div className="flex items-center gap-2 mt-1">
                    <p className="text-[10px] text-surface-400">{evt.startDate} → {evt.endDate}</p>
                    {evtParts.length > 0 && (
                        <span className="text-[10px] font-semibold text-primary-600 bg-primary-50 px-1.5 py-0.5 rounded">
                            {evtParts.length} KH
                        </span>
                    )}
                </div>
            </button>
        );
    };

    return (
        <div className="grid grid-cols-1 lg:grid-cols-[280px_1fr] gap-4 items-start">
            {/* ── Sidebar ── */}
            <div className="space-y-3">
                {/* Active / Upcoming */}
                {activeGroup.length > 0 && (
                    <div className="bg-white rounded-2xl border border-surface-200 shadow-sm p-3">
                        <div className="flex items-center gap-2 mb-2 px-1">
                            <div className="w-2 h-2 rounded-full bg-success-500 animate-pulse" />
                            <span className="text-[11px] font-bold text-surface-500 uppercase tracking-wide">Đang hoạt động</span>
                        </div>
                        <div className="space-y-1.5">
                            {activeGroup.map(e => <EventSidebarCard key={e.id} evt={e} />)}
                        </div>
                    </div>
                )}
                {/* Closed / Ended */}
                {closedGroup.length > 0 && (
                    <div className="bg-white rounded-2xl border border-surface-200 shadow-sm p-3">
                        <button
                            onClick={() => setShowClosed(v => !v)}
                            className="w-full flex items-center justify-between gap-2 px-1 mb-1"
                        >
                            <div className="flex items-center gap-2">
                                <div className="w-2 h-2 rounded-full bg-surface-400" />
                                <span className="text-[11px] font-bold text-surface-400 uppercase tracking-wide">Đã đóng ({closedGroup.length})</span>
                            </div>
                            <ChevronDown className={cn('w-3.5 h-3.5 text-surface-400 transition-transform', showClosed && 'rotate-180')} />
                        </button>
                        {showClosed && (
                            <div className="space-y-1.5 mt-2">
                                {closedGroup.map(e => <EventSidebarCard key={e.id} evt={e} />)}
                            </div>
                        )}
                    </div>
                )}
            </div>

            {/* ── Detail Panel ── */}
            <div className="bg-white rounded-2xl border border-surface-200 shadow-sm overflow-hidden">
                {selected ? (
                    <>
                        {/* Header */}
                        <div className={cn(
                            'px-5 py-4 border-b',
                            selected.status === 'active' ? 'bg-gradient-to-br from-success-50 to-white border-success-100'
                                : selected.status === 'upcoming' ? 'bg-gradient-to-br from-primary-50 to-white border-primary-100'
                                    : 'bg-surface-50 border-surface-100'
                        )}>
                            <div className="flex items-start justify-between gap-3">
                                <div>
                                    <h3 className="text-base font-bold text-surface-800">{selected.name}</h3>
                                    <p className="text-xs text-surface-500 mt-0.5">{selected.startDate} → {selected.endDate}</p>
                                </div>
                                <span className={cn('text-xs font-bold px-2.5 py-1 rounded-lg border shrink-0', EVENT_STATUS_BADGE[selected.status])}>
                                    {EVENT_STATUS_LABELS[selected.status]}
                                </span>
                            </div>
                        </div>
                        <div className="p-5 space-y-4">
                            <EventDetailPanel event={selected} />

                            {/* ── Player KPIs ── */}
                            <div className="grid grid-cols-3 gap-3">
                                {[
                                    { label: 'Khách tham gia', value: pStats.totalPlayers, icon: Users, color: 'text-primary-600 bg-primary-50' },
                                    { label: 'Lượt quay đã dùng', value: pStats.totalSpinsUsed, icon: Dices, color: 'text-accent-600 bg-accent-50' },
                                    { label: 'Giải đã trúng', value: pStats.totalPrizesWon, icon: Trophy, color: 'text-warning-600 bg-warning-50' },
                                ].map(k => (
                                    <div key={k.label} className="rounded-xl border border-surface-200 bg-white p-4">
                                        <div className="flex items-center gap-2 mb-2">
                                            <div className={cn('w-7 h-7 rounded-lg flex items-center justify-center', k.color)}>
                                                <k.icon className="w-3.5 h-3.5" />
                                            </div>
                                            <span className="text-xs font-medium text-surface-500">{k.label}</span>
                                        </div>
                                        <p className="text-2xl font-black text-surface-800">{k.value.toLocaleString()}</p>
                                    </div>
                                ))}
                            </div>

                            {/* ── Recent Plays ── */}
                            {eventRecentPlays.length > 0 && (
                                <div className="rounded-xl border border-surface-200 overflow-hidden">
                                    <div className="px-4 py-2.5 bg-surface-50 border-b border-surface-100 flex items-center gap-2">
                                        <Play className="w-3.5 h-3.5 text-accent-500" />
                                        <span className="text-xs font-bold text-surface-700">Lượt chơi gần nhất</span>
                                    </div>
                                    <div className="divide-y divide-surface-50 max-h-64 overflow-y-auto">
                                        {eventRecentPlays.map(log => {
                                            // Parse play details from audit log
                                            const isWin = log.details.includes('won') || log.details.includes('Phát voucher');
                                            const timeStr = new Date(log.timestamp).toLocaleString('vi-VN', {
                                                day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit'
                                            });
                                            return (
                                                <div key={log.id} className="px-4 py-2.5 flex items-center gap-3">
                                                    <div className={cn(
                                                        'w-6 h-6 rounded-full flex items-center justify-center shrink-0',
                                                        isWin ? 'bg-success-50 text-success-600' : 'bg-surface-100 text-surface-400'
                                                    )}>
                                                        {isWin ? <Trophy className="w-3 h-3" /> : <Ban className="w-3 h-3" />}
                                                    </div>
                                                    <div className="flex-1 min-w-0">
                                                        <p className="text-xs font-semibold text-surface-700 truncate">
                                                            {log.actorName || log.actor}
                                                        </p>
                                                        <p className="text-[10px] text-surface-400 truncate">{log.details}</p>
                                                    </div>
                                                    <span className="text-[10px] text-surface-400 shrink-0">{timeStr}</span>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            )}

                            {/* ── Daily Stats Breakdown ── */}
                            {selected.dailyStats && Object.keys(selected.dailyStats).length > 0 && (
                                <div className="rounded-xl border border-surface-200 overflow-hidden">
                                    <div className="px-4 py-2.5 bg-surface-50 border-b border-surface-100 flex items-center gap-2">
                                        <BarChart3 className="w-3.5 h-3.5 text-primary-500" />
                                        <span className="text-xs font-bold text-surface-700">Thống kê theo ngày</span>
                                    </div>
                                    <div className="overflow-x-auto">
                                        <table className="w-full text-xs">
                                            <thead className="bg-surface-50/50 border-b border-surface-100">
                                                <tr>
                                                    <th className="px-3 py-2 text-left font-semibold text-surface-500">Ngày</th>
                                                    {(selected.campaignStocks || []).map(cs => (
                                                        <th key={cs.campaignId} className="px-3 py-2 text-center font-semibold text-surface-500">{cs.campaignName}</th>
                                                    ))}
                                                    <th className="px-3 py-2 text-center font-semibold text-surface-500">Tổng</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-surface-50">
                                                {Object.entries(selected.dailyStats)
                                                    .sort(([a], [b]) => b.localeCompare(a))
                                                    .slice(0, 10)
                                                    .map(([date, stats]) => {
                                                        const total = Object.values(stats).reduce((s, v) => s + v, 0);
                                                        return (
                                                            <tr key={date} className="hover:bg-surface-50/40">
                                                                <td className="px-3 py-2 text-surface-600 font-medium">{date}</td>
                                                                {(selected.campaignStocks || []).map(cs => (
                                                                    <td key={cs.campaignId} className="px-3 py-2 text-center text-surface-700">
                                                                        {stats[cs.campaignId] || 0}
                                                                    </td>
                                                                ))}
                                                                <td className="px-3 py-2 text-center font-bold text-surface-800">{total}</td>
                                                            </tr>
                                                        );
                                                    })}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                            )}
                        </div>
                    </>
                ) : (
                    <div className="p-12 text-center text-surface-400">
                        <ChevronRight className="w-8 h-8 mx-auto mb-2 opacity-30" />
                        <p className="text-sm font-medium">Chọn sự kiện để xem chi tiết</p>
                    </div>
                )}
            </div>
        </div>
    );
}

// ═════════════════════════════════════════════════════════════════
// TAB 2: EVENT LIST + CREATE WITH PRIZE POOL CONFIGURATOR
// ═════════════════════════════════════════════════════════════════
function EventListTab({
    events,
    campaigns,
    getToken,
    onSuccess,
    onError,
}: {
    events: EventWithStats[];
    campaigns: VoucherCampaign[];
    getToken: () => Promise<string | undefined>;
    onSuccess: (msg: string) => void;
    onError: (msg: string) => void;
}) {
    const [showCreate, setShowCreate] = useState(false);
    const [selectedEventId, setSelectedEventId] = useState<string | null>(null);
    const [showClosedSection, setShowClosedSection] = useState(false);
    const [name, setName] = useState('');
    const [startDate, setStartDate] = useState('');
    const [endDate, setEndDate] = useState('');
    const [prizePool, setPrizePool] = useState<PrizePoolEntry[]>([]);
    const [submitting, setSubmitting] = useState(false);
    const [statusUpdating, setStatusUpdating] = useState<string | null>(null);
    const [showCampaignPicker, setShowCampaignPicker] = useState(false);

    // Selected campaign IDs in pool
    const selectedCampIds = new Set(prizePool.map(p => p.campaignId));

    // Toggle campaign in pool
    const toggleCampaign = (camp: VoucherCampaign) => {
        if (selectedCampIds.has(camp.id)) {
            setPrizePool(prev => prev.filter(p => p.campaignId !== camp.id));
        } else {
            setPrizePool(prev => [...prev, {
                campaignId: camp.id,
                campaignName: camp.name,
                rewardType: camp.rewardType,
                dailyLimit: 0,
                rate: 0,
            }]);
        }
    };

    // Update pool entry field
    const updateEntry = (campId: string, field: 'rate' | 'dailyLimit', value: number) => {
        setPrizePool(prev => prev.map(p =>
            p.campaignId === campId ? { ...p, [field]: value } : p
        ));
    };

    // Remove from pool
    const removeFromPool = (campId: string) => {
        setPrizePool(prev => prev.filter(p => p.campaignId !== campId));
    };

    // Total days
    const totalDays = useMemo(() => {
        if (!startDate || !endDate) return 0;
        const s = new Date(startDate).getTime();
        const e = new Date(endDate).getTime();
        if (e < s) return 0;
        return Math.ceil((e - s) / (1000 * 60 * 60 * 24)) + 1;
    }, [startDate, endDate]);

    // Validation 1: rate sum ≤ 100
    const totalRate = prizePool.reduce((s, p) => s + (p.rate || 0), 0);
    const rateValid = totalRate <= 100;
    const luckRate = 100 - totalRate;

    // Validation 2: per-campaign stock check
    const stockValidations = useMemo(() => {
        return prizePool.map(entry => {
            const camp = campaigns.find(c => c.id === entry.campaignId);
            const stock = camp?.totalIssued || 0;
            const maxIssuance = (entry.dailyLimit || 0) * totalDays;
            const valid = totalDays > 0 ? maxIssuance <= stock : true;
            return {
                campaignId: entry.campaignId,
                valid,
                maxIssuance,
                stock,
                message: totalDays > 0
                    ? `${entry.dailyLimit}/ngày × ${totalDays} ngày = ${maxIssuance} ${valid ? '≤' : '>'} ${stock} mã`
                    : 'Chọn ngày để kiểm tra',
            };
        });
    }, [prizePool, campaigns, totalDays]);

    const allStockValid = stockValidations.every(v => v.valid);
    const formValid = name.trim() && startDate && endDate && startDate <= endDate
        && prizePool.length > 0 && rateValid && allStockValid
        && prizePool.every(p => p.rate > 0 && p.dailyLimit > 0);

    const handleCreate = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!formValid) return;
        setSubmitting(true);
        try {
            const token = await getToken();
            const res = await fetch('/api/events', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
                body: JSON.stringify({ name, startDate, endDate, prizePool }),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || 'Thao tác thất bại');
            setName(''); setStartDate(''); setEndDate('');
            setPrizePool([]); setShowCreate(false);
            onSuccess(data.message || 'Tạo sự kiện thành công!');
        } catch (err: unknown) {
            onError(err instanceof Error ? err.message : 'Đã xảy ra lỗi');
        } finally {
            setSubmitting(false);
        }
    };

    const handleStatusUpdate = async (eventId: string, status: string) => {
        if (!confirm(`Chuyển trạng thái sự kiện thành "${EVENT_STATUS_LABELS[status] || status}"?`)) return;
        setStatusUpdating(eventId);
        try {
            const token = await getToken();
            const res = await fetch('/api/events', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
                body: JSON.stringify({ eventId, status }),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || 'Thao tác thất bại');
            onSuccess('Cập nhật trạng thái thành công');
        } catch (err: unknown) {
            onError(err instanceof Error ? err.message : 'Đã xảy ra lỗi');
        } finally {
            setStatusUpdating(null);
        }
    };

    return (
        <div className="space-y-6">
            {/* Actions */}
            <div className="flex justify-end">
                <button
                    onClick={() => setShowCreate(!showCreate)}
                    className={cn(
                        'flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold transition-all',
                        showCreate
                            ? 'bg-surface-200 text-surface-700'
                            : 'bg-surface-800 hover:bg-surface-900 text-white shadow-sm'
                    )}
                >
                    <Plus className="w-4 h-4" />
                    {showCreate ? 'Ẩn Form' : 'Tạo sự kiện mới'}
                </button>
            </div>

            {/* ── CREATE FORM ──────────────────────────────────── */}
            {showCreate && (
                <div className="bg-white rounded-2xl border border-surface-200 shadow-sm overflow-hidden animate-in slide-in-from-top-2 duration-300">
                    <div className="px-6 py-5 border-b border-surface-100">
                        <h2 className="text-lg font-bold text-surface-800 flex items-center gap-2">
                            <Plus className="w-5 h-5 text-accent-500" />
                            Tạo sự kiện mới
                        </h2>
                    </div>
                    <form onSubmit={handleCreate} className="p-6 space-y-6">
                        {/* Event Info */}
                        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                            <div className="space-y-1.5">
                                <label htmlFor="e-name" className="text-sm font-medium text-surface-700">Tên sự kiện *</label>
                                <input
                                    id="e-name" required value={name} onChange={e => setName(e.target.value)}
                                    placeholder="VD: Khai trương B.Duck Popup Store"
                                    className="w-full bg-surface-50 border border-surface-200 text-sm rounded-lg focus:ring-accent-500 focus:border-accent-400 p-2.5"
                                />
                            </div>
                            <div className="space-y-1.5">
                                <label htmlFor="e-start" className="text-sm font-medium text-surface-700">Ngày bắt đầu *</label>
                                <input
                                    id="e-start" type="date" required value={startDate}
                                    onChange={e => setStartDate(e.target.value)}
                                    className="w-full bg-surface-50 border border-surface-200 text-sm rounded-lg focus:ring-accent-500 focus:border-accent-400 p-2.5"
                                />
                            </div>
                            <div className="space-y-1.5">
                                <label htmlFor="e-end" className="text-sm font-medium text-surface-700">Ngày kết thúc *</label>
                                <input
                                    id="e-end" type="date" required value={endDate}
                                    onChange={e => setEndDate(e.target.value)}
                                    className="w-full bg-surface-50 border border-surface-200 text-sm rounded-lg focus:ring-accent-500 focus:border-accent-400 p-2.5"
                                />
                            </div>
                        </div>

                        {/* ── PRIZE POOL CONFIGURATOR ─────────────── */}
                        <div className="border border-surface-200 rounded-xl overflow-visible">
                            <div className="bg-surface-50 px-5 py-3 border-b border-surface-200 flex items-center justify-between">
                                <h3 className="text-sm font-bold text-surface-700 flex items-center gap-2">
                                    <Gift className="w-4 h-4 text-accent-500" />
                                    Prize Pool ({prizePool.length} chiến dịch)
                                </h3>
                                <div className="relative">
                                    <button
                                        type="button"
                                        onClick={() => setShowCampaignPicker(!showCampaignPicker)}
                                        className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-accent-500 text-white hover:bg-accent-600 transition-colors"
                                    >
                                        <Plus className="w-3.5 h-3.5" /> Thêm chiến dịch
                                    </button>

                                    {/* Campaign Picker Dropdown */}
                                    {showCampaignPicker && (
                                        <div className="absolute right-0 top-full mt-1 w-80 bg-white border border-surface-200 rounded-xl shadow-xl z-20 max-h-64 overflow-auto">
                                            {campaigns.length === 0 ? (
                                                <p className="p-4 text-sm text-surface-400 text-center">Không có chiến dịch nào</p>
                                            ) : (
                                                campaigns.map(c => (
                                                    <label
                                                        key={c.id}
                                                        className={cn(
                                                            'flex items-center gap-3 px-4 py-3 hover:bg-surface-50 cursor-pointer border-b z-50 border-surface-50 last:border-0 transition-colors',
                                                            selectedCampIds.has(c.id) && 'bg-accent-50/50'
                                                        )}
                                                    >
                                                        <input
                                                            type="checkbox"
                                                            checked={selectedCampIds.has(c.id)}
                                                            onChange={() => toggleCampaign(c)}
                                                            className="w-4 h-4 rounded border-surface-300 text-accent-500 focus:ring-accent-400"
                                                        />
                                                        <div className="flex-1 min-w-0">
                                                            <p className="text-sm font-semibold text-surface-800 truncate">{c.name}</p>
                                                            <p className="text-xs text-surface-400">
                                                                {REWARD_LABELS[c.rewardType]} • {c.totalIssued} mã
                                                            </p>
                                                        </div>
                                                    </label>
                                                ))
                                            )}
                                            <div className="sticky bottom-0 bg-white px-4 py-2 border-t border-surface-100">
                                                <button
                                                    type="button"
                                                    onClick={() => setShowCampaignPicker(false)}
                                                    className="w-full text-xs font-semibold text-surface-600 hover:text-surface-800 py-1"
                                                >
                                                    Đóng
                                                </button>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* Prize Pool Table */}
                            {prizePool.length === 0 ? (
                                <div className="p-8 text-center text-surface-400">
                                    <Gift className="w-8 h-8 mx-auto mb-2 opacity-30" />
                                    <p className="text-sm font-medium">Chưa chọn chiến dịch nào</p>
                                    <p className="text-xs mt-1">Bấm &quot;Thêm chiến dịch&quot; để bắt đầu</p>
                                </div>
                            ) : (
                                <div className="overflow-x-auto">
                                    <table className="w-full text-sm">
                                        <thead className="text-xs text-surface-500 bg-surface-50/50 border-b border-surface-100">
                                            <tr>
                                                <th className="px-4 py-2.5 text-left font-semibold">Chiến dịch</th>
                                                <th className="px-4 py-2.5 text-left font-semibold">Loại thưởng</th>
                                                <th className="px-4 py-2.5 text-center font-semibold w-28">Tỉ lệ (%)</th>
                                                <th className="px-4 py-2.5 text-center font-semibold w-28">Limit/ngày</th>
                                                <th className="px-4 py-2.5 text-center font-semibold w-40">Kho</th>
                                                <th className="px-4 py-2.5 text-center font-semibold w-12"></th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-surface-100">
                                            {prizePool.map((entry, idx) => {
                                                const sv = stockValidations[idx];
                                                return (
                                                    <tr key={entry.campaignId} className="hover:bg-surface-50/40 transition-colors">
                                                        <td className="px-4 py-3">
                                                            <p className="font-semibold text-surface-800 text-xs">{entry.campaignName}</p>
                                                        </td>
                                                        <td className="px-4 py-3">
                                                            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-accent-50 text-accent-700 border border-accent-200">
                                                                {REWARD_LABELS[entry.rewardType] || entry.rewardType}
                                                            </span>
                                                        </td>
                                                        <td className="px-4 py-3 text-center">
                                                            <input
                                                                type="number" min={0} max={100} step={0.1}
                                                                value={entry.rate || ''}
                                                                onChange={e => updateEntry(entry.campaignId, 'rate', Number(e.target.value))}
                                                                placeholder="0"
                                                                className="w-20 text-center bg-surface-50 border border-surface-200 text-sm rounded-lg focus:ring-accent-500 focus:border-accent-400 p-1.5"
                                                            />
                                                        </td>
                                                        <td className="px-4 py-3 text-center">
                                                            <input
                                                                type="number" min={0}
                                                                value={entry.dailyLimit || ''}
                                                                onChange={e => updateEntry(entry.campaignId, 'dailyLimit', Number(e.target.value))}
                                                                placeholder="0"
                                                                className="w-20 text-center bg-surface-50 border border-surface-200 text-sm rounded-lg focus:ring-accent-500 focus:border-accent-400 p-1.5"
                                                            />
                                                        </td>
                                                        <td className="px-4 py-3 text-center">
                                                            <span className={cn(
                                                                'text-[10px] font-medium',
                                                                sv?.valid ? 'text-success-600' : 'text-danger-600'
                                                            )}>
                                                                {sv?.message}
                                                            </span>
                                                        </td>
                                                        <td className="px-4 py-3 text-center">
                                                            <button
                                                                type="button"
                                                                onClick={() => removeFromPool(entry.campaignId)}
                                                                className="p-1 rounded hover:bg-danger-50 text-surface-400 hover:text-danger-500 transition-colors"
                                                            >
                                                                <X className="w-4 h-4" />
                                                            </button>
                                                        </td>
                                                    </tr>
                                                );
                                            })}
                                        </tbody>
                                    </table>
                                </div>
                            )}

                            {/* Rate Summary Bar */}
                            {prizePool.length > 0 && (
                                <div className="px-5 py-3 bg-surface-50 border-t border-surface-200">
                                    <div className="flex items-center justify-between mb-2">
                                        <div className="flex items-center gap-4 text-xs">
                                            <span className="text-surface-600 font-medium">
                                                Tổng tỉ lệ: <span className={cn('font-bold', rateValid ? 'text-success-600' : 'text-danger-600')}>{totalRate}%</span>
                                            </span>
                                            <span className="text-surface-400">•</span>
                                            <span className="text-surface-600 font-medium">
                                                LUCK_NEXT_TIME: <span className="font-bold text-surface-800">{luckRate > 0 ? `${luckRate}%` : '0%'}</span>
                                            </span>
                                        </div>
                                        {!rateValid && (
                                            <span className="text-[10px] font-bold text-danger-600 flex items-center gap-1">
                                                <AlertCircle className="w-3 h-3" /> Vượt quá 100%
                                            </span>
                                        )}
                                    </div>
                                    {/* Visual rate bar */}
                                    <div className="h-3 bg-surface-200 rounded-full overflow-hidden flex">
                                        {prizePool.map((p, i) => (
                                            <div
                                                key={p.campaignId}
                                                className={cn(
                                                    'h-full transition-all duration-300',
                                                    ['bg-accent-500', 'bg-primary-500', 'bg-warning-500', 'bg-success-500', 'bg-danger-400'][i % 5]
                                                )}
                                                style={{ width: `${Math.min(p.rate, 100)}%` }}
                                                title={`${p.campaignName}: ${p.rate}%`}
                                            />
                                        ))}
                                    </div>
                                    <div className="flex gap-3 mt-1.5 flex-wrap">
                                        {prizePool.map((p, i) => (
                                            <div key={p.campaignId} className="flex items-center gap-1">
                                                <div className={cn(
                                                    'w-2 h-2 rounded-full',
                                                    ['bg-accent-500', 'bg-primary-500', 'bg-warning-500', 'bg-success-500', 'bg-danger-400'][i % 5]
                                                )} />
                                                <span className="text-[10px] text-surface-500">{p.campaignName} ({p.rate}%)</span>
                                            </div>
                                        ))}
                                        {luckRate > 0 && (
                                            <div className="flex items-center gap-1">
                                                <div className="w-2 h-2 rounded-full bg-surface-200" />
                                                <span className="text-[10px] text-surface-400">Không trúng ({luckRate}%)</span>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Submit */}
                        <div className="flex justify-end pt-4 border-t border-surface-100">
                            <button
                                type="submit"
                                disabled={submitting || !formValid}
                                className="flex items-center gap-2 bg-surface-800 hover:bg-surface-900 disabled:bg-surface-300 disabled:cursor-not-allowed text-white px-6 py-3 rounded-xl font-semibold shadow-sm transition-colors"
                            >
                                {submitting ? (
                                    <><Loader2 className="w-4 h-4 animate-spin" /> Đang tạo...</>
                                ) : (
                                    <><Plus className="w-4 h-4" /> Tạo sự kiện</>
                                )}
                            </button>
                        </div>
                    </form>
                </div>
            )}

            {/* ── EVENTS GROUPED ─────────────────────────────────── */}
            {(() => {
                const activeGroup = events.filter(e => e.status === 'active' || e.status === 'upcoming');
                const closedGroup = events.filter(e => e.status === 'closed' || e.status === 'ended');

                const toggleRow = (id: string) =>
                    setSelectedEventId(prev => (prev === id ? null : id));

                const EventRow = ({ evt, muted = false }: { evt: EventWithStats; muted?: boolean }) => (
                    <>
                        <tr
                            onClick={() => toggleRow(evt.id)}
                            className={cn(
                                'cursor-pointer transition-colors',
                                selectedEventId === evt.id ? 'bg-accent-50' : muted ? 'hover:bg-surface-50/40' : 'hover:bg-surface-50/60',
                                muted && 'opacity-60'
                            )}
                        >
                            <td className="px-4 py-3.5">
                                <div className="flex items-center gap-2">
                                    <ChevronRight className={cn('w-3.5 h-3.5 text-surface-400 shrink-0 transition-transform', selectedEventId === evt.id && 'rotate-90')} />
                                    <div>
                                        <p className="font-bold text-surface-800">{evt.name}</p>
                                        <p className="text-[10px] text-surface-400 mt-0.5">{(evt.prizePool || []).length} chiến dịch</p>
                                    </div>
                                </div>
                            </td>
                            <td className="px-4 py-3.5">
                                <div className="flex flex-wrap gap-1">
                                    {(evt.prizePool || []).map(p => (
                                        <span key={p.campaignId} className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-surface-100 text-surface-600">
                                            {p.campaignName || p.campaignId} ({p.rate}%)
                                        </span>
                                    ))}
                                </div>
                            </td>
                            <td className="px-4 py-3.5 text-xs text-surface-500 whitespace-nowrap">{evt.startDate} → {evt.endDate}</td>
                            <td className="px-4 py-3.5 text-center">
                                <span className={cn('text-[11px] font-bold px-2 py-0.5 rounded border', EVENT_STATUS_BADGE[evt.status])}>
                                    {EVENT_STATUS_LABELS[evt.status]}
                                </span>
                            </td>
                            <td className="px-4 py-3.5 text-center">
                                <div className="flex items-center justify-center gap-1.5 text-xs">
                                    <span className="text-success-600 font-bold">{evt.codesAvailable}</span>
                                    <span className="text-surface-300">/</span>
                                    <span className="text-surface-500">{evt.totalStock}</span>
                                </div>
                            </td>
                            <td className="px-4 py-3.5 text-right" onClick={e => e.stopPropagation()}>
                                <div className="flex items-center justify-end gap-2">
                                    {evt.status === 'upcoming' && (
                                        <button
                                            onClick={() => handleStatusUpdate(evt.id, 'active')}
                                            disabled={statusUpdating === evt.id}
                                            className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-semibold rounded-lg bg-success-50 text-success-600 hover:bg-success-100 border border-success-200"
                                        >
                                            <Play className="w-3.5 h-3.5" /> Bắt đầu
                                        </button>
                                    )}
                                    {evt.status === 'active' && (
                                        <button
                                            onClick={() => handleStatusUpdate(evt.id, 'closed')}
                                            disabled={statusUpdating === evt.id}
                                            className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-semibold rounded-lg bg-danger-50 text-danger-600 hover:bg-danger-100 border border-danger-200"
                                        >
                                            <Ban className="w-3.5 h-3.5" /> Đóng
                                        </button>
                                    )}
                                </div>
                            </td>
                        </tr>
                        {selectedEventId === evt.id && (
                            <tr>
                                <td colSpan={6} className="px-6 py-4 bg-accent-50/40 border-t border-accent-100">
                                    <EventDetailPanel event={evt} />
                                </td>
                            </tr>
                        )}
                    </>
                );

                const TableHead = () => (
                    <thead className="text-xs text-surface-500 bg-surface-50/80 border-b border-surface-100">
                        <tr>
                            <th className="px-4 py-3.5 font-semibold">Tên sự kiện</th>
                            <th className="px-4 py-3.5 font-semibold">Chiến dịch</th>
                            <th className="px-4 py-3.5 font-semibold">Thời gian</th>
                            <th className="px-4 py-3.5 font-semibold text-center">Trạng thái</th>
                            <th className="px-4 py-3.5 font-semibold text-center">Kho mã</th>
                            <th className="px-4 py-3.5 font-semibold text-right">Thao tác</th>
                        </tr>
                    </thead>
                );

                if (events.length === 0) {
                    return (
                        <div className="bg-white rounded-2xl border border-surface-200 shadow-sm p-12 text-center text-surface-400">
                            <CalendarDays className="w-12 h-12 mx-auto mb-3 opacity-30" />
                            <p className="font-medium">Chưa có sự kiện nào</p>
                        </div>
                    );
                }

                return (
                    <div className="space-y-4">
                        {/* Active / Upcoming */}
                        {activeGroup.length > 0 && (
                            <div className="bg-white rounded-2xl border border-surface-200 shadow-sm overflow-hidden">
                                <div className="px-5 py-3 border-b border-surface-100 flex items-center gap-2">
                                    <div className="w-2 h-2 rounded-full bg-success-500 animate-pulse" />
                                    <span className="text-sm font-bold text-surface-700">Đang hoạt động</span>
                                    <span className="text-xs text-surface-400">({activeGroup.length} sự kiện)</span>
                                </div>
                                <div className="overflow-x-auto">
                                    <table className="w-full text-sm text-left">
                                        <TableHead />
                                        <tbody className="divide-y divide-surface-100">
                                            {activeGroup.map(evt => <EventRow key={evt.id} evt={evt} />)}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        )}
                        {/* Closed / Ended */}
                        {closedGroup.length > 0 && (
                            <div className="bg-white rounded-2xl border border-surface-200 shadow-sm overflow-hidden">
                                <button
                                    onClick={() => setShowClosedSection(v => !v)}
                                    className="w-full px-5 py-3 border-b border-surface-100 flex items-center gap-2 hover:bg-surface-50 transition-colors"
                                >
                                    <div className="w-2 h-2 rounded-full bg-surface-400" />
                                    <span className="text-sm font-bold text-surface-500">Đã đóng / Kết thúc</span>
                                    <span className="text-xs text-surface-400">({closedGroup.length} sự kiện)</span>
                                    <ChevronDown className={cn('w-4 h-4 text-surface-400 ml-auto transition-transform', showClosedSection && 'rotate-180')} />
                                </button>
                                {showClosedSection && (
                                    <div className="overflow-x-auto">
                                        <table className="w-full text-sm text-left">
                                            <TableHead />
                                            <tbody className="divide-y divide-surface-100">
                                                {closedGroup.map(evt => <EventRow key={evt.id} evt={evt} muted />)}
                                            </tbody>
                                        </table>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                );
            })()}
        </div>
    );
}


// ═════════════════════════════════════════════════════════════════
// TAB 3: AUDIT LOGS
// ═════════════════════════════════════════════════════════════════
function AuditTab({ auditLogs }: { auditLogs: AuditLogDoc[] }) {
    if (auditLogs.length === 0) {
        return (
            <div className="p-12 text-center text-surface-400">
                <FileText className="w-12 h-12 mx-auto mb-3 opacity-30" />
                <p className="font-medium">Chưa có lịch sử thao tác nào</p>
            </div>
        );
    }

    return (
        <div className="bg-white rounded-2xl border border-surface-200 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
                <table className="w-full text-sm text-left">
                    <thead className="text-xs text-surface-500 bg-surface-50/80 border-b border-surface-100">
                        <tr>
                            <th className="px-4 py-3.5 font-semibold">Thời gian</th>
                            <th className="px-4 py-3.5 font-semibold">Hành động</th>
                            <th className="px-4 py-3.5 font-semibold">Người thực hiện</th>
                            <th className="px-4 py-3.5 font-semibold">Chi tiết</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-surface-100">
                        {auditLogs.map(log => (
                            <tr key={log.id} className="hover:bg-surface-50/60 transition-colors">
                                <td className="px-4 py-3 text-xs text-surface-500 whitespace-nowrap">
                                    {new Date(log.timestamp).toLocaleString('vi-VN')}
                                </td>
                                <td className="px-4 py-3">
                                    <span className="text-xs font-bold text-accent-700 bg-accent-50 border border-accent-200 px-2 py-0.5 rounded">
                                        {AUDIT_ACTION_LABELS[log.action] || log.action}
                                    </span>
                                </td>
                                <td className="px-4 py-3 text-surface-600 text-xs">
                                    {log.actorName || log.actor}
                                </td>
                                <td className="px-4 py-3 text-surface-500 text-xs max-w-xs truncate">
                                    {log.details}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
}

// ═════════════════════════════════════════════════════════════════
// TAB 4: INTEGRATION GUIDE
// ═════════════════════════════════════════════════════════════════
function IntegrationTab({ events }: { events: EventWithStats[] }) {
    const activeEvents = events.filter(e => e.status === 'active');
    const [selectedId, setSelectedId] = useState(activeEvents[0]?.id || '');
    const selected = activeEvents.find(e => e.id === selectedId);

    if (activeEvents.length === 0) {
        return (
            <div className="p-12 text-center text-surface-400">
                <Code2 className="w-12 h-12 mx-auto mb-3 opacity-30" />
                <p className="font-medium text-surface-600">Không có sự kiện đang hoạt động</p>
                <p className="text-xs mt-1">Chỉ sự kiện có trạng thái <span className="font-semibold text-success-600">Đang diễn ra</span> mới hiển thị ở đây.<br />Hãy kích hoạt sự kiện ở tab &quot;Danh sách Sự kiện&quot;.</p>
            </div>
        );
    }

    return (
        <div className="space-y-4">
            {/* Event Selector */}
            <div className="bg-white rounded-2xl border border-surface-200 shadow-sm p-4">
                <label className="text-sm font-semibold text-surface-700 mb-2 block">Chọn sự kiện để xem tài liệu</label>
                <select
                    value={selectedId}
                    onChange={e => setSelectedId(e.target.value)}
                    className="w-full md:w-96 bg-surface-50 border border-surface-200 text-sm rounded-lg focus:ring-accent-500 focus:border-accent-400 p-2.5"
                >
                    {activeEvents.map(e => (
                        <option key={e.id} value={e.id}>{e.name}</option>
                    ))}
                </select>
            </div>

            {selected && (
                <EventIntegrationGuide
                    eventId={selected.id}
                    eventName={selected.name}
                />
            )}
        </div>
    );
}

// ═════════════════════════════════════════════════════════════════
// TAB: CUSTOMER DATA
// ═════════════════════════════════════════════════════════════════

const CUSTOMER_EXPORT_COLUMNS = [
    { key: 'stt', label: 'STT' },
    { key: 'name', label: 'Tên khách hàng' },
    { key: 'phone', label: 'Số điện thoại' },
    { key: 'dob', label: 'Ngày sinh' },
    { key: 'email', label: 'Email' },
    { key: 'totalSpins', label: 'Tổng lượt quay' },
    { key: 'usedSpins', label: 'Lượt đã dùng' },
    { key: 'prizesWon', label: 'Số giải trúng' },
    { key: 'prizes', label: 'Mã voucher trúng' },
    { key: 'source', label: 'Nguồn' },
    { key: 'createdAt', label: 'Ngày tham gia' },
];

function CustomerDataTab({ events, participations }: {
    events: EventWithStats[];
    participations: Record<string, EventParticipation[]>;
}) {
    const relevantEvents = events.filter(e => e.status === 'active' || e.status === 'closed' || e.status === 'ended');
    const [selectedEventId, setSelectedEventId] = useState(relevantEvents[0]?.id || '');
    const [search, setSearch] = useState('');
    const [page, setPage] = useState(1);
    const [isExportOpen, setIsExportOpen] = useState(false);
    const pageSize = 20;

    const selectedEvent = events.find(e => e.id === selectedEventId);
    const allParticipations = participations[selectedEventId] || [];

    // Filter by search
    const filtered = useMemo(() => {
        if (!search.trim()) return allParticipations;
        const q = search.trim().toLowerCase();
        return allParticipations.filter(p =>
            p.name.toLowerCase().includes(q) ||
            p.phone.includes(q) ||
            (p.email && p.email.toLowerCase().includes(q))
        );
    }, [allParticipations, search]);

    // Pagination
    const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
    const paginated = useMemo(() =>
        filtered.slice((page - 1) * pageSize, page * pageSize),
        [filtered, page, pageSize]
    );

    useEffect(() => setPage(1), [search, selectedEventId]);

    // Export data builder
    const exportData = useMemo(() =>
        filtered.map((p, i) => ({
            stt: i + 1,
            name: p.name,
            phone: p.phone,
            dob: p.dob || '',
            email: p.email || '',
            totalSpins: p.totalSpins,
            usedSpins: p.usedSpins,
            prizesWon: p.prizes.length,
            prizes: p.prizes.join(', '),
            source: p.source || '',
            createdAt: p.createdAt ? new Date(p.createdAt).toLocaleString('vi-VN') : '',
        })),
        [filtered]
    );

    // Export handler
    const [selectedCols, setSelectedCols] = useState<string[]>(CUSTOMER_EXPORT_COLUMNS.map(c => c.key));
    const toggleCol = (key: string) =>
        setSelectedCols(prev => prev.includes(key) ? prev.filter(k => k !== key) : [...prev, key]);

    const handleExport = async () => {
        const XLSX = await import('xlsx');
        const visibleCols = CUSTOMER_EXPORT_COLUMNS.filter(c => selectedCols.includes(c.key));
        const mapped = exportData.map(row => {
            const r: Record<string, string | number> = {};
            for (const col of visibleCols) {
                const val = row[col.key as keyof typeof row];
                r[col.label] = val != null ? val : '';
            }
            return r;
        });
        const ws = XLSX.utils.json_to_sheet(mapped);
        const wb = XLSX.utils.book_new();
        const eventName = selectedEvent?.name?.replace(/[^\w\sÀ-ỹ]/g, '') || 'Event';
        XLSX.utils.book_append_sheet(wb, ws, 'Khách hàng');
        XLSX.writeFile(wb, `KhachHang_${eventName}_${new Date().toISOString().slice(0, 10)}.xlsx`);
        setIsExportOpen(false);
    };

    if (relevantEvents.length === 0) {
        return (
            <div className="p-12 text-center text-surface-400">
                <Users className="w-12 h-12 mx-auto mb-3 opacity-30" />
                <p className="font-medium">Chưa có sự kiện đang diễn ra hoặc đã đóng</p>
            </div>
        );
    }

    return (
        <div className="space-y-4">
            {/* Event selector + controls */}
            <div className="bg-white rounded-2xl border border-surface-200 shadow-sm p-4">
                <div className="flex flex-wrap items-end gap-3">
                    <div className="flex-1 min-w-[240px]">
                        <label className="block text-[10px] font-semibold uppercase tracking-wider text-surface-400 mb-1">Chọn sự kiện</label>
                        <select
                            value={selectedEventId}
                            onChange={e => setSelectedEventId(e.target.value)}
                            className="w-full bg-surface-50 border border-surface-200 text-sm rounded-xl focus:ring-accent-500 focus:border-accent-400 p-2.5"
                        >
                            {relevantEvents.map(e => (
                                <option key={e.id} value={e.id}>
                                    {e.name} ({EVENT_STATUS_LABELS[e.status]})
                                </option>
                            ))}
                        </select>
                    </div>
                    <div className="relative flex-1 min-w-[200px]">
                        <label className="block text-[10px] font-semibold uppercase tracking-wider text-surface-400 mb-1">Tìm kiếm</label>
                        <Search className="absolute left-2.5 bottom-2.5 w-3.5 h-3.5 text-surface-400 pointer-events-none" />
                        <input
                            value={search}
                            onChange={e => setSearch(e.target.value)}
                            placeholder="Tên, SĐT, email..."
                            className="pl-8 w-full pr-3 py-2.5 text-sm border border-surface-200 rounded-xl bg-surface-50 text-surface-700 outline-none focus:ring-2 focus:ring-accent-200 focus:border-accent-400"
                        />
                    </div>
                    {filtered.length > 0 && (
                        <button
                            onClick={() => setIsExportOpen(true)}
                            className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl border border-success-200 bg-success-50 hover:bg-success-100 text-success-700 text-sm font-semibold transition-colors"
                        >
                            <FileDown className="w-4 h-4" />
                            Xuất Excel ({filtered.length})
                        </button>
                    )}
                </div>
            </div>

            {/* KPI Summary */}
            {allParticipations.length > 0 && (
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    {[
                        { l: 'Tổng KH', v: allParticipations.length.toLocaleString(), c: 'text-primary-700 font-bold' },
                        { l: 'Tổng lượt quay', v: allParticipations.reduce((s, p) => s + p.usedSpins, 0).toLocaleString(), c: 'text-accent-700' },
                        { l: 'Giải trúng', v: allParticipations.reduce((s, p) => s + p.prizes.length, 0).toLocaleString(), c: 'text-warning-700' },
                        { l: 'Có email', v: allParticipations.filter(p => p.email).length.toLocaleString(), c: 'text-success-700' },
                    ].map(({ l, v, c }) => (
                        <div key={l} className="bg-white rounded-2xl border border-surface-100 shadow-sm p-3">
                            <p className="text-[10px] font-semibold uppercase tracking-widest text-surface-400">{l}</p>
                            <p className={`text-xs mt-0.5 ${c}`}>{v}</p>
                        </div>
                    ))}
                </div>
            )}

            {/* Data Table */}
            {allParticipations.length === 0 ? (
                <div className="bg-white rounded-2xl border border-surface-200 shadow-sm p-12 text-center text-surface-400">
                    <Users className="w-10 h-10 mx-auto mb-2 opacity-30" />
                    <p className="font-medium">Chưa có khách hàng tham gia sự kiện này</p>
                </div>
            ) : filtered.length === 0 ? (
                <div className="bg-white rounded-2xl border border-surface-200 shadow-sm p-8 text-center text-surface-400">
                    <p className="text-sm">Không tìm thấy khách hàng phù hợp</p>
                    <button onClick={() => setSearch('')} className="text-xs text-accent-600 hover:underline font-semibold mt-1">Xóa bộ lọc</button>
                </div>
            ) : (
                <div className="bg-white rounded-2xl border border-surface-200 shadow-sm overflow-hidden">
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm text-left">
                            <thead className="text-xs text-surface-500 bg-surface-50/80 border-b border-surface-100">
                                <tr>
                                    <th className="px-4 py-3 font-semibold w-12 text-center">#</th>
                                    <th className="px-4 py-3 font-semibold">Tên</th>
                                    <th className="px-4 py-3 font-semibold">SĐT</th>
                                    <th className="px-4 py-3 font-semibold">Ngày sinh</th>
                                    <th className="px-4 py-3 font-semibold">Email</th>
                                    <th className="px-4 py-3 font-semibold text-center">Lượt quay</th>
                                    <th className="px-4 py-3 font-semibold text-center">Giải</th>
                                    <th className="px-4 py-3 font-semibold">Nguồn</th>
                                    <th className="px-4 py-3 font-semibold">Ngày tham gia</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-surface-100">
                                {paginated.map((p, i) => (
                                    <tr key={`${p.eventId}_${p.phone}`} className="hover:bg-surface-50/60 transition-colors">
                                        <td className="px-4 py-3 text-center text-xs text-surface-400">{(page - 1) * pageSize + i + 1}</td>
                                        <td className="px-4 py-3 font-semibold text-surface-800">{p.name}</td>
                                        <td className="px-4 py-3 text-surface-600 font-mono text-xs">{p.phone}</td>
                                        <td className="px-4 py-3 text-surface-500 text-xs">{p.dob || '—'}</td>
                                        <td className="px-4 py-3 text-surface-500 text-xs max-w-[160px] truncate">{p.email || '—'}</td>
                                        <td className="px-4 py-3 text-center">
                                            <span className="text-xs font-bold text-accent-700">{p.usedSpins}</span>
                                            <span className="text-surface-300 mx-0.5">/</span>
                                            <span className="text-xs text-surface-500">{p.totalSpins}</span>
                                        </td>
                                        <td className="px-4 py-3 text-center">
                                            {p.prizes.length > 0 ? (
                                                <span className="text-xs font-bold text-success-600 bg-success-50 px-2 py-0.5 rounded-full border border-success-200">
                                                    {p.prizes.length} giải
                                                </span>
                                            ) : (
                                                <span className="text-xs text-surface-400">0</span>
                                            )}
                                        </td>
                                        <td className="px-4 py-3">
                                            {p.source ? (
                                                <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-surface-100 text-surface-600">{p.source}</span>
                                            ) : (
                                                <span className="text-xs text-surface-400">—</span>
                                            )}
                                        </td>
                                        <td className="px-4 py-3 text-xs text-surface-500 whitespace-nowrap">
                                            {p.createdAt ? new Date(p.createdAt).toLocaleString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—'}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                    {/* Pagination */}
                    {totalPages > 1 && (
                        <div className="flex items-center justify-between px-4 py-3 border-t border-surface-100 bg-surface-50/50">
                            <p className="text-xs text-surface-400">
                                Hiển thị {(page - 1) * pageSize + 1}–{Math.min(page * pageSize, filtered.length)} / {filtered.length}
                            </p>
                            <div className="flex items-center gap-1">
                                <button
                                    onClick={() => setPage(p => Math.max(1, p - 1))}
                                    disabled={page <= 1}
                                    className="p-1.5 rounded-lg border border-surface-200 hover:bg-surface-100 disabled:opacity-40 transition-colors"
                                >
                                    <ChevronDown className="w-3.5 h-3.5 rotate-90 text-surface-500" />
                                </button>
                                <span className="text-xs font-semibold text-surface-600 px-2">{page}/{totalPages}</span>
                                <button
                                    onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                                    disabled={page >= totalPages}
                                    className="p-1.5 rounded-lg border border-surface-200 hover:bg-surface-100 disabled:opacity-40 transition-colors"
                                >
                                    <ChevronDown className="w-3.5 h-3.5 -rotate-90 text-surface-500" />
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            )}

            {/* ── Export Modal ── */}
            {isExportOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                    <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setIsExportOpen(false)} />
                    <div className="relative bg-white rounded-3xl shadow-2xl w-full max-w-3xl max-h-[90vh] flex flex-col overflow-hidden">
                        {/* Header */}
                        <div className="flex items-center justify-between px-6 py-4 border-b border-surface-100 shrink-0">
                            <div className="flex items-center gap-3">
                                <div className="w-9 h-9 rounded-xl bg-success-50 flex items-center justify-center">
                                    <FileDown className="w-5 h-5 text-success-600" />
                                </div>
                                <div>
                                    <h2 className="text-base font-bold text-surface-800">Xuất dữ liệu khách hàng</h2>
                                    <p className="text-xs text-surface-400 mt-0.5">{selectedEvent?.name} • {filtered.length} khách hàng</p>
                                </div>
                            </div>
                            <button onClick={() => setIsExportOpen(false)} className="p-1.5 rounded-lg hover:bg-surface-100 text-surface-400 transition-colors">
                                <X className="w-4 h-4" />
                            </button>
                        </div>

                        <div className="flex-1 overflow-y-auto p-6 space-y-5">
                            {/* Column selector */}
                            <div>
                                <div className="flex items-center justify-between mb-3">
                                    <p className="text-xs font-bold text-surface-600 uppercase tracking-wider">Chọn cột xuất</p>
                                    <div className="flex gap-2">
                                        <button onClick={() => setSelectedCols(CUSTOMER_EXPORT_COLUMNS.map(c => c.key))}
                                            className="text-[11px] text-accent-600 hover:text-accent-800 font-semibold">Chọn tất cả</button>
                                        <span className="text-surface-300">·</span>
                                        <button onClick={() => setSelectedCols([])}
                                            className="text-[11px] text-surface-400 hover:text-surface-600 font-semibold">Bỏ chọn</button>
                                    </div>
                                </div>
                                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                                    {CUSTOMER_EXPORT_COLUMNS.map(col => {
                                        const checked = selectedCols.includes(col.key);
                                        return (
                                            <label key={col.key}
                                                className={cn(
                                                    'flex items-center gap-2.5 px-3 py-2.5 rounded-xl border cursor-pointer transition-all select-none',
                                                    checked
                                                        ? 'bg-accent-50 border-accent-200 text-accent-700'
                                                        : 'bg-surface-50 border-surface-200 text-surface-500 hover:border-surface-300'
                                                )}>
                                                <input type="checkbox" checked={checked} onChange={() => toggleCol(col.key)}
                                                    className="w-3.5 h-3.5 rounded accent-accent-600" />
                                                <span className="text-xs font-medium leading-tight">{col.label}</span>
                                            </label>
                                        );
                                    })}
                                </div>
                            </div>

                            {/* Preview */}
                            {selectedCols.length > 0 && exportData.length > 0 && (
                                <div>
                                    <p className="text-xs font-bold text-surface-600 uppercase tracking-wider mb-3">Xem trước (5 dòng đầu)</p>
                                    <div className="overflow-x-auto rounded-2xl border border-surface-100">
                                        <table className="w-full text-xs border-collapse">
                                            <thead>
                                                <tr className="bg-surface-50 border-b border-surface-100">
                                                    {CUSTOMER_EXPORT_COLUMNS
                                                        .filter(c => selectedCols.includes(c.key))
                                                        .map(col => (
                                                            <th key={col.key} className="px-3 py-2 text-left font-semibold text-surface-500 whitespace-nowrap">{col.label}</th>
                                                        ))}
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {exportData.slice(0, 5).map((row, i) => (
                                                    <tr key={i} className={`border-b border-surface-50 ${i % 2 ? 'bg-surface-50/40' : ''}`}>
                                                        {CUSTOMER_EXPORT_COLUMNS
                                                            .filter(c => selectedCols.includes(c.key))
                                                            .map(col => (
                                                                <td key={col.key} className="px-3 py-2 text-surface-700 whitespace-nowrap max-w-[160px] truncate">
                                                                    {row[col.key as keyof typeof row] != null ? String(row[col.key as keyof typeof row]) : '—'}
                                                                </td>
                                                            ))}
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Footer */}
                        <div className="flex items-center justify-between gap-3 px-6 py-4 border-t border-surface-100 bg-surface-50/50 shrink-0">
                            <p className="text-xs text-surface-400">
                                <span className="font-semibold text-surface-600">{selectedCols.length}</span> / {CUSTOMER_EXPORT_COLUMNS.length} cột
                            </p>
                            <div className="flex gap-2">
                                <button onClick={() => setIsExportOpen(false)}
                                    className="px-4 py-2 rounded-xl text-sm font-semibold border border-surface-200 hover:bg-surface-100 text-surface-600 transition-colors">
                                    Huỷ
                                </button>
                                <button onClick={handleExport} disabled={selectedCols.length === 0}
                                    className="flex items-center gap-2 px-5 py-2 rounded-xl text-sm font-semibold bg-success-600 text-white hover:bg-success-700 disabled:opacity-50 shadow-sm transition-all">
                                    <Download className="w-4 h-4" />
                                    Tải xuống ({filtered.length} KH)
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
