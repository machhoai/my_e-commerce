'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import {
    BarChart3, CalendarDays, Plus, Loader2, CheckCircle2, AlertCircle,
    LayoutDashboard, FileText, Ticket, X, Code2, Users, Download, FileDown, Search,
    TrendingUp, Ban, Play, Hash, Gift, ChevronDown, ChevronRight, Dices, Trophy, Eye,
    Pencil, PlusCircle, Sparkles, Zap, Activity, MapPin, Globe, Target, Percent,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import EventIntegrationGuide from '@/components/admin/EventIntegrationGuide';
import {
    ChartCard, ChartTitle, EmptyChart,
    TrendAreaChart, DonutPieChart, FunnelChart, HorizontalBarChart,
    CHART_PALETTE,
} from '@/components/admin/MarketingCharts';
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

    // Stats for header badges
    const activeCount = events.filter(e => e.status === 'active').length;
    const totalCustomers = Object.values(participations).reduce((s, arr) => s + arr.length, 0);

    return (
        <div className="space-y-6 mx-auto">
            {/* ── Premium Header ── */}
            <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-surface-800 via-surface-900 to-surface-800 px-6 py-6 shadow-xl">
                {/* Decorative pattern */}
                <div className="absolute inset-0 opacity-[0.04]" style={{ backgroundImage: 'radial-gradient(circle at 1px 1px, white 1px, transparent 0)', backgroundSize: '24px 24px' }} />
                <div className="absolute -top-20 -right-20 w-64 h-64 bg-accent-500/10 rounded-full blur-3xl" />
                <div className="absolute -bottom-16 -left-16 w-48 h-48 bg-primary-500/10 rounded-full blur-3xl" />

                <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div>
                        <div className="flex items-center gap-3 mb-2">
                            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-accent-400 to-accent-600 flex items-center justify-center shadow-lg shadow-accent-500/25">
                                <CalendarDays className="w-5 h-5 text-white" />
                            </div>
                            <div>
                                <h1 className="text-xl font-bold text-white tracking-tight">Quản lý Sự kiện</h1>
                                <p className="text-surface-400 text-sm">Thiết lập prize pool, theo dõi phân phối và quản lý chiến dịch</p>
                            </div>
                        </div>
                    </div>
                    <div className="flex items-center gap-3">
                        <div className="flex items-center gap-2 bg-white/10 backdrop-blur-sm rounded-xl px-3 py-2 border border-white/10">
                            <CalendarDays className="w-3.5 h-3.5 text-accent-400" />
                            <span className="text-xs font-bold text-white">{events.length}</span>
                            <span className="text-xs text-surface-400">sự kiện</span>
                        </div>
                        {activeCount > 0 && (
                            <div className="flex items-center gap-2 bg-success-500/15 backdrop-blur-sm rounded-xl px-3 py-2 border border-success-500/20">
                                <Activity className="w-3.5 h-3.5 text-success-400 animate-pulse" />
                                <span className="text-xs font-bold text-success-300">{activeCount}</span>
                                <span className="text-xs text-success-400/80">đang chạy</span>
                            </div>
                        )}
                        {totalCustomers > 0 && (
                            <div className="flex items-center gap-2 bg-primary-500/15 backdrop-blur-sm rounded-xl px-3 py-2 border border-primary-500/20">
                                <Users className="w-3.5 h-3.5 text-primary-400" />
                                <span className="text-xs font-bold text-primary-300">{totalCustomers}</span>
                                <span className="text-xs text-primary-400/80">khách</span>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* ── Premium Tabs ── */}
            <div className="flex gap-1 bg-surface-100/80 backdrop-blur-sm p-1.5 rounded-2xl w-fit shadow-sm border border-surface-200/50">
                {TABS.map(t => {
                    const isActive = tab === t.key;
                    const counts: Record<string, number> = {
                        events: events.length,
                        audit: auditLogs.length,
                        customers: totalCustomers,
                    };
                    const count = counts[t.key];
                    return (
                        <button
                            key={t.key}
                            onClick={() => setTab(t.key)}
                            className={cn(
                                'relative flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold transition-all duration-200',
                                isActive
                                    ? 'bg-white text-surface-800 shadow-md shadow-surface-200/50'
                                    : 'text-surface-500 hover:text-surface-700 hover:bg-white/50'
                            )}
                        >
                            <t.icon className={cn('w-4 h-4 transition-colors', isActive ? 'text-accent-500' : '')} />
                            {t.label}
                            {count != null && count > 0 && (
                                <span className={cn(
                                    'text-[10px] font-bold px-1.5 py-0.5 rounded-full min-w-[20px] text-center transition-colors',
                                    isActive ? 'bg-accent-100 text-accent-700' : 'bg-surface-200 text-surface-500'
                                )}>
                                    {count}
                                </span>
                            )}
                        </button>
                    );
                })}
            </div>

            {/* Messages */}
            {msg && (
                <div className={cn(
                    'p-4 rounded-xl flex items-center gap-3 text-sm font-medium animate-in fade-in slide-in-from-top-2 duration-300',
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
                <div className="flex flex-col items-center justify-center py-20">
                    <div className="relative">
                        <div className="w-12 h-12 rounded-full border-4 border-surface-200" />
                        <div className="w-12 h-12 rounded-full border-4 border-accent-500 border-t-transparent animate-spin absolute inset-0" />
                    </div>
                    <p className="text-sm font-medium text-surface-400 mt-4">Đang tải dữ liệu...</p>
                </div>
            ) : (
                <>
                    {tab === 'dashboard' && <DashboardTab events={events} participations={participations} recentPlays={recentPlays} getToken={getToken} />}
                    {tab === 'events' && (
                        <EventListTab
                            events={events}
                            campaigns={campaigns}
                            getToken={getToken}
                            onSuccess={(msg) => { fetchData(); showMsg('success', msg); }}
                            showMsg={showMsg}
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
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {[
                    { label: 'Tổng mã', value: event.totalStock, icon: Hash, gradient: 'from-primary-500 to-primary-600' },
                    { label: 'Đã phát', value: totalIssued, icon: Gift, gradient: 'from-accent-500 to-accent-600' },
                    { label: 'Còn lại', value: event.codesAvailable, icon: Ticket, gradient: 'from-warning-500 to-warning-600' },
                    { label: 'Đã dùng', value: event.codesUsed, icon: CheckCircle2, gradient: 'from-success-500 to-success-600' },
                ].map(k => (
                    <div key={k.label} className={cn(
                        'rounded-xl border p-3.5 hover:shadow-sm transition-all duration-200',
                        isClosed ? 'bg-surface-50 border-surface-100' : 'bg-white border-surface-200'
                    )}>
                        <div className="flex items-center gap-2 mb-2">
                            <div className={cn('w-7 h-7 rounded-lg bg-gradient-to-br flex items-center justify-center', k.gradient)}>
                                <k.icon className="w-3.5 h-3.5 text-white" />
                            </div>
                            <span className="text-[11px] font-medium text-surface-500">{k.label}</span>
                        </div>
                        <p className="text-xl font-black text-surface-800">{k.value.toLocaleString()}</p>
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
// SHARED: PAGINATED VOUCHER TABLE
// ═════════════════════════════════════════════════════════════════
interface VoucherRow {
    id: string;
    campaignId: string;
    campaignName?: string;
    rewardType: string;
    rewardValue: number;
    status: string;
    distributedToPhone: string | null;
    distributedAt: string | null;
    usedAt: string | null;
    usedByStaffId: string | null;
    usedByStaffName?: string;
    validTo: string;
}

function EventVouchersTable({ eventId, campaignStocks, getToken }: {
    eventId: string;
    campaignStocks: CampaignStock[];
    getToken: () => Promise<string | undefined>;
}) {
    const [vouchers, setVouchers] = useState<VoucherRow[]>([]);
    const [lastDocId, setLastDocId] = useState<string | null>(null);
    const [hasMore, setHasMore] = useState(false);
    const [loading, setLoading] = useState(false);
    const [initialLoading, setInitialLoading] = useState(true);
    const [filterCampaign, setFilterCampaign] = useState('');
    const [filterStatus, setFilterStatus] = useState('');

    const STATUS_COLORS: Record<string, string> = {
        available: 'bg-primary-50 text-primary-700 border-primary-200',
        distributed: 'bg-accent-50 text-accent-700 border-accent-200',
        used: 'bg-success-50 text-success-700 border-success-200',
        revoked: 'bg-danger-50 text-danger-700 border-danger-200',
    };

    const STATUS_LABELS: Record<string, string> = {
        available: 'Chưa phát',
        distributed: 'Đã phát',
        used: 'Đã dùng',
        revoked: 'Vô hiệu',
    };

    const fetchVouchers = useCallback(async (cursor: string | null = null, reset = false) => {
        if (reset) {
            setInitialLoading(true);
        } else {
            setLoading(true);
        }
        try {
            const token = await getToken();
            const params = new URLSearchParams({ eventId, pageSize: '20' });
            if (cursor) params.set('lastDocId', cursor);
            if (filterCampaign) params.set('campaignId', filterCampaign);
            if (filterStatus) params.set('status', filterStatus);

            const res = await fetch(`/api/events/vouchers?${params}`, {
                headers: { Authorization: `Bearer ${token}` },
            });
            if (!res.ok) throw new Error('Không thể tải danh sách voucher');
            const data = await res.json();

            if (reset || !cursor) {
                setVouchers(data.vouchers || []);
            } else {
                setVouchers(prev => [...prev, ...(data.vouchers || [])]);
            }
            setLastDocId(data.lastDocId);
            setHasMore(data.hasMore);
        } catch {
            // Silently handle — the main page already has error handling
        } finally {
            setLoading(false);
            setInitialLoading(false);
        }
    }, [eventId, filterCampaign, filterStatus, getToken]);

    // Reset and fetch when filters change
    useEffect(() => {
        setVouchers([]);
        setLastDocId(null);
        setHasMore(false);
        fetchVouchers(null, true);
    }, [fetchVouchers]);

    return (
        <div className="rounded-xl border border-surface-200 overflow-hidden">
            <div className="px-4 py-2.5 bg-surface-50 border-b border-surface-100 flex items-center justify-between gap-2 flex-wrap">
                <div className="flex items-center gap-2">
                    <Ticket className="w-3.5 h-3.5 text-primary-500" />
                    <span className="text-xs font-bold text-surface-700">Danh sách Voucher</span>
                    {vouchers.length > 0 && (
                        <span className="text-[10px] font-semibold text-surface-400">
                            ({vouchers.length}{hasMore ? '+' : ''})
                        </span>
                    )}
                </div>
                <div className="flex items-center gap-2">
                    <select
                        value={filterCampaign}
                        onChange={e => setFilterCampaign(e.target.value)}
                        className="text-[11px] bg-white border border-surface-200 rounded-lg px-2 py-1 focus:ring-accent-500 focus:border-accent-400"
                    >
                        <option value="">Tất cả chiến dịch</option>
                        {campaignStocks.map(cs => (
                            <option key={cs.campaignId} value={cs.campaignId}>{cs.campaignName}</option>
                        ))}
                    </select>
                    <select
                        value={filterStatus}
                        onChange={e => setFilterStatus(e.target.value)}
                        className="text-[11px] bg-white border border-surface-200 rounded-lg px-2 py-1 focus:ring-accent-500 focus:border-accent-400"
                    >
                        <option value="">Tất cả trạng thái</option>
                        <option value="available">Chưa phát</option>
                        <option value="distributed">Đã phát</option>
                        <option value="used">Đã dùng</option>
                        <option value="revoked">Vô hiệu</option>
                    </select>
                </div>
            </div>

            {initialLoading ? (
                <div className="flex items-center justify-center py-10">
                    <div className="relative">
                        <div className="w-8 h-8 rounded-full border-3 border-surface-200" />
                        <div className="w-8 h-8 rounded-full border-3 border-accent-500 border-t-transparent animate-spin absolute inset-0" />
                    </div>
                    <p className="text-xs text-surface-400 ml-3">Đang tải voucher...</p>
                </div>
            ) : vouchers.length === 0 ? (
                <div className="p-8 text-center text-surface-400">
                    <Ticket className="w-8 h-8 mx-auto mb-2 opacity-30" />
                    <p className="text-xs font-medium">Không có voucher nào</p>
                </div>
            ) : (
                <>
                    <div className="overflow-x-auto">
                        <table className="w-full text-xs">
                            <thead className="bg-surface-50/50 border-b border-surface-100">
                                <tr>
                                    <th className="px-3 py-2 text-left font-semibold text-surface-500">Mã voucher</th>
                                    <th className="px-3 py-2 text-left font-semibold text-surface-500">Chiến dịch</th>
                                    <th className="px-3 py-2 text-center font-semibold text-surface-500">Trạng thái</th>
                                    <th className="px-3 py-2 text-left font-semibold text-surface-500">SĐT nhận</th>
                                    <th className="px-3 py-2 text-left font-semibold text-surface-500">Ngày phát</th>
                                    <th className="px-3 py-2 text-left font-semibold text-surface-500">Ngày dùng</th>
                                    <th className="px-3 py-2 text-left font-semibold text-surface-500">Nhân viên dùng</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-surface-50">
                                {vouchers.map(v => (
                                    <tr key={v.id} className="hover:bg-surface-50/40">
                                        <td className="px-3 py-2 font-mono font-semibold text-surface-700">{v.id}</td>
                                        <td className="px-3 py-2 text-surface-600">{v.campaignName || v.campaignId}</td>
                                        <td className="px-3 py-2 text-center">
                                            <span className={cn('text-[10px] font-bold px-1.5 py-0.5 rounded-lg border', STATUS_COLORS[v.status] || 'bg-surface-100 text-surface-500')}>
                                                {STATUS_LABELS[v.status] || v.status}
                                            </span>
                                        </td>
                                        <td className="px-3 py-2 text-surface-500 font-mono">{v.distributedToPhone || '—'}</td>
                                        <td className="px-3 py-2 text-surface-500">
                                            {v.distributedAt ? new Date(v.distributedAt).toLocaleString('vi-VN', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) : '—'}
                                        </td>
                                        <td className="px-3 py-2 text-surface-500">
                                            {v.usedAt ? new Date(v.usedAt).toLocaleString('vi-VN', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) : '—'}
                                        </td>
                                        <td className="px-3 py-2 text-surface-500">{v.usedByStaffName || v.usedByStaffId || '—'}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                    {hasMore && (
                        <div className="px-4 py-3 border-t border-surface-100 bg-surface-50/50 text-center">
                            <button
                                onClick={() => fetchVouchers(lastDocId)}
                                disabled={loading}
                                className="inline-flex items-center gap-2 px-5 py-2 rounded-xl text-xs font-semibold bg-white border border-surface-200 hover:border-accent-300 hover:bg-accent-50 text-surface-700 hover:text-accent-700 transition-all disabled:opacity-50"
                            >
                                {loading ? (
                                    <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Đang tải...</>
                                ) : (
                                    <><ChevronDown className="w-3.5 h-3.5" /> Tải thêm</>
                                )}
                            </button>
                        </div>
                    )}
                </>
            )}
        </div>
    );
}

function DashboardTab({ events, participations, recentPlays, getToken }: {
    events: EventWithStats[];
    participations: Record<string, EventParticipation[]>;
    recentPlays: AuditLogDoc[];
    getToken: () => Promise<string | undefined>;
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

    // ── Marketing Analytics: computed data ──────────────────────────
    const voucherTrendData = useMemo(() => {
        if (!selected?.dailyStats) return [];
        return Object.entries(selected.dailyStats)
            .sort(([a], [b]) => a.localeCompare(b))
            .map(([date, stats]) => {
                const row: { date: string;[key: string]: string | number } = { date };
                let total = 0;
                (selected.campaignStocks || []).forEach(cs => {
                    const v = stats[cs.campaignId] || 0;
                    row[cs.campaignName] = v;
                    total += v;
                });
                row['Tổng'] = total;
                return row;
            });
    }, [selected]);

    const voucherTrendKeys = useMemo(() => {
        if (!selected?.campaignStocks?.length) return [];
        const keys = selected.campaignStocks.map((cs, i) => ({
            key: cs.campaignName,
            color: CHART_PALETTE[i % CHART_PALETTE.length],
            name: cs.campaignName,
        }));
        return keys;
    }, [selected]);

    const funnelData = useMemo(() => {
        if (!selected) return [];
        return [
            { name: 'Tổng mã voucher', value: selected.totalStock, color: '#6366f1' },
            { name: 'Đã phát', value: selected.codesDistributed + selected.codesUsed, color: '#22d3ee' },
            { name: 'Khách tham gia', value: pStats.totalPlayers, color: '#f59e0b' },
            { name: 'Giải trúng', value: pStats.totalPrizesWon, color: '#10b981' },
            { name: 'Đã sử dụng', value: selected.codesUsed, color: '#ec4899' },
        ].filter(d => d.value > 0);
    }, [selected, pStats]);

    const prizePoolPieData = useMemo(() => {
        if (!selected?.campaignStocks?.length) return [];
        return selected.campaignStocks.map(cs => ({
            name: cs.campaignName,
            value: cs.totalStock,
        })).filter(d => d.value > 0);
    }, [selected]);

    const sourceData = useMemo(() => {
        const map: Record<string, number> = {};
        selectedParticipations.forEach(p => {
            const src = p.source || 'Không rõ';
            map[src] = (map[src] || 0) + 1;
        });
        return Object.entries(map)
            .map(([name, value]) => ({ name, value }))
            .sort((a, b) => b.value - a.value);
    }, [selectedParticipations]);

    const locationData = useMemo(() => {
        const map: Record<string, number> = {};
        selectedParticipations.forEach(p => {
            if (p.location) map[p.location] = (map[p.location] || 0) + 1;
        });
        return Object.entries(map)
            .map(([name, value]) => ({ name, value }))
            .sort((a, b) => b.value - a.value);
    }, [selectedParticipations]);

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
        const stockPct = evt.totalStock > 0 ? Math.round((evt.codesAvailable / evt.totalStock) * 100) : 0;
        return (
            <button
                onClick={() => setSelectedId(evt.id)}
                className={cn(
                    'w-full text-left px-3.5 py-3 rounded-xl transition-all duration-200 border group',
                    isSelected
                        ? 'bg-gradient-to-r from-accent-50 to-white border-accent-200 shadow-md shadow-accent-100/50 scale-[1.02]'
                        : 'bg-white border-surface-100 hover:border-accent-200 hover:shadow-sm hover:scale-[1.01]',
                    isClosed && 'opacity-50'
                )}
            >
                <div className="flex items-start justify-between gap-2">
                    <p className={cn('text-sm font-bold leading-tight truncate', isSelected ? 'text-accent-700' : 'text-surface-800')}>{evt.name}</p>
                    <span className={cn('text-[10px] font-bold px-1.5 py-0.5 rounded-lg border shrink-0', EVENT_STATUS_BADGE[evt.status])}>
                        {EVENT_STATUS_LABELS[evt.status]}
                    </span>
                </div>
                <div className="flex items-center justify-between gap-2 mt-2">
                    <p className="text-[10px] text-surface-400">{evt.startDate} → {evt.endDate}</p>
                    <div className="flex items-center gap-2">
                        {evtParts.length > 0 && (
                            <span className="text-[10px] font-semibold text-primary-600 bg-primary-50 px-1.5 py-0.5 rounded-lg">
                                {evtParts.length} KH
                            </span>
                        )}
                    </div>
                </div>
                {/* Mini stock bar */}
                <div className="mt-2 h-1 bg-surface-100 rounded-full overflow-hidden">
                    <div
                        className={cn('h-full rounded-full transition-all', stockPct > 50 ? 'bg-success-400' : stockPct > 20 ? 'bg-warning-400' : 'bg-danger-400')}
                        style={{ width: `${stockPct}%` }}
                    />
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
                        <div className="flex items-center gap-2 mb-3 px-1">
                            <div className="w-2 h-2 rounded-full bg-success-500 animate-pulse" />
                            <span className="text-[11px] font-bold text-surface-600 uppercase tracking-wider">Đang hoạt động</span>
                            <span className="text-[10px] text-surface-400 ml-auto">{activeGroup.length}</span>
                        </div>
                        <div className="space-y-2">
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
                        <div className={cn(
                            'px-6 py-5 border-b relative overflow-hidden',
                            selected.status === 'active' ? 'bg-gradient-to-br from-success-50 via-success-50/50 to-white border-success-100'
                                : selected.status === 'upcoming' ? 'bg-gradient-to-br from-primary-50 via-primary-50/50 to-white border-primary-100'
                                    : 'bg-gradient-to-br from-surface-50 to-white border-surface-100'
                        )}>
                            {(selected.status === 'active') && (
                                <div className="absolute -top-10 -right-10 w-32 h-32 bg-success-200/20 rounded-full blur-2xl" />
                            )}
                            <div className="relative z-10 flex items-start justify-between gap-3">
                                <div>
                                    <h3 className="text-lg font-bold text-surface-800">{selected.name}</h3>
                                    <div className="flex items-center gap-3 mt-1">
                                        <p className="text-xs text-surface-500 flex items-center gap-1">
                                            <CalendarDays className="w-3 h-3" />
                                            {selected.startDate} → {selected.endDate}
                                        </p>
                                    </div>
                                </div>
                                <span className={cn('text-xs font-bold px-3 py-1.5 rounded-xl border shrink-0', EVENT_STATUS_BADGE[selected.status])}>
                                    {EVENT_STATUS_LABELS[selected.status]}
                                </span>
                            </div>
                        </div>

                        <div className="p-5 space-y-5">
                            <EventDetailPanel event={selected} />

                            {/* ═════════ MARKETING ANALYTICS ═════════ */}
                            <div className="pt-2">
                                <div className="flex items-center gap-3 mb-4">
                                    <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-accent-500 to-accent-600 flex items-center justify-center shadow-sm">
                                        <BarChart3 className="w-4 h-4 text-white" />
                                    </div>
                                    <div>
                                        <h3 className="text-sm font-bold text-surface-700">Phân tích Marketing</h3>
                                        <p className="text-[10px] text-surface-400">Biểu đồ conversion, phân phối voucher & nguồn khách</p>
                                    </div>
                                    <div className="flex-1 h-px bg-gradient-to-r from-surface-200 to-transparent ml-2" />
                                </div>

                                {/* Row 1: Voucher Trend + Conversion Funnel */}
                                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-4">
                                    {/* Voucher Distribution Trend */}
                                    <ChartCard>
                                        <ChartTitle
                                            icon={<TrendingUp className="w-4 h-4 text-indigo-500" />}
                                            title="Phát voucher theo ngày"
                                            subtitle="Xu hướng phân phối voucher qua từng ngày"
                                        />
                                        {voucherTrendData.length >= 2 ? (
                                            <TrendAreaChart
                                                data={voucherTrendData}
                                                dataKeys={voucherTrendKeys}
                                                gradientPrefix="evt"
                                                height={240}
                                            />
                                        ) : (
                                            <EmptyChart
                                                icon={<TrendingUp className="w-5 h-5 text-surface-300" />}
                                                message="Cần ít nhất 2 ngày dữ liệu để hiển thị xu hướng"
                                            />
                                        )}
                                    </ChartCard>

                                    {/* Conversion Funnel */}
                                    <ChartCard>
                                        <ChartTitle
                                            icon={<Target className="w-4 h-4 text-cyan-500" />}
                                            title="Phễu chuyển đổi"
                                            subtitle="Từ tổng mã → phát → tham gia → trúng → sử dụng"
                                        />
                                        {funnelData.length > 0 ? (
                                            <FunnelChart data={funnelData} height={240} />
                                        ) : (
                                            <EmptyChart
                                                icon={<Target className="w-5 h-5 text-surface-300" />}
                                                message="Chưa có dữ liệu chuyển đổi"
                                            />
                                        )}
                                    </ChartCard>
                                </div>

                                {/* Row 2: Prize Pool + Source + Location */}
                                <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                                    {/* Prize Pool Distribution */}
                                    <ChartCard>
                                        <ChartTitle
                                            icon={<Gift className="w-4 h-4 text-amber-500" />}
                                            title="Phân bổ Prize Pool"
                                            subtitle="Tỉ lệ mã theo chiến dịch"
                                        />
                                        {prizePoolPieData.length > 0 ? (
                                            <DonutPieChart data={prizePoolPieData} height={180} />
                                        ) : (
                                            <EmptyChart
                                                icon={<Gift className="w-5 h-5 text-surface-300" />}
                                                message="Chưa có chiến dịch nào"
                                            />
                                        )}
                                    </ChartCard>

                                    {/* Source Attribution */}
                                    <ChartCard>
                                        <ChartTitle
                                            icon={<Globe className="w-4 h-4 text-blue-500" />}
                                            title="Nguồn khách hàng"
                                            subtitle="Kênh thu hút khách tham gia"
                                        />
                                        {sourceData.length > 0 ? (
                                            <DonutPieChart data={sourceData} height={180} />
                                        ) : (
                                            <EmptyChart
                                                icon={<Globe className="w-5 h-5 text-surface-300" />}
                                                message="Chưa có dữ liệu nguồn"
                                            />
                                        )}
                                    </ChartCard>

                                    {/* Location Distribution */}
                                    <ChartCard>
                                        <ChartTitle
                                            icon={<MapPin className="w-4 h-4 text-rose-500" />}
                                            title="Phân bổ địa điểm"
                                            subtitle="Top khu vực tham gia"
                                        />
                                        {locationData.length > 0 ? (
                                            <HorizontalBarChart data={locationData} color="#ec4899" height={200} barSize={16} />
                                        ) : (
                                            <EmptyChart
                                                icon={<MapPin className="w-5 h-5 text-surface-300" />}
                                                message="Chưa có dữ liệu địa điểm"
                                            />
                                        )}
                                    </ChartCard>
                                </div>
                            </div>

                            {/* ── Player KPIs ── */}
                            <div className="grid grid-cols-3 gap-3">
                                {[
                                    { label: 'Khách tham gia', value: pStats.totalPlayers, icon: Users, gradient: 'from-primary-500 to-primary-600', bgLight: 'bg-primary-50' },
                                    { label: 'Lượt quay đã dùng', value: pStats.totalSpinsUsed, icon: Dices, gradient: 'from-accent-500 to-accent-600', bgLight: 'bg-accent-50' },
                                    { label: 'Giải đã trúng', value: pStats.totalPrizesWon, icon: Trophy, gradient: 'from-warning-500 to-warning-600', bgLight: 'bg-warning-50' },
                                ].map(k => (
                                    <div key={k.label} className="rounded-xl border border-surface-200 bg-white p-4 hover:shadow-md hover:border-surface-300 transition-all duration-200">
                                        <div className="flex items-center gap-2.5 mb-3">
                                            <div className={cn('w-8 h-8 rounded-lg bg-gradient-to-br flex items-center justify-center shadow-sm', k.gradient)}>
                                                <k.icon className="w-4 h-4 text-white" />
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

                            {/* ── Paginated Voucher List ── */}
                            <EventVouchersTable
                                eventId={selected.id}
                                campaignStocks={selected.campaignStocks || []}
                                getToken={getToken}
                            />
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
    showMsg,
}: {
    events: EventWithStats[];
    campaigns: VoucherCampaign[];
    getToken: () => Promise<string | undefined>;
    onSuccess: (msg: string) => void;
    onError: (msg: string) => void;
    showMsg: (type: 'success' | 'error', text: string) => void;
}) {
    // Local campaigns state — allows updating totalIssued after adding stock without full reload
    const [localCampaigns, setLocalCampaigns] = useState(campaigns);
    useEffect(() => setLocalCampaigns(campaigns), [campaigns]);
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

    // ── Edit mode ────────────────────────────────────────────────
    const [editingEvent, setEditingEvent] = useState<EventWithStats | null>(null);
    const [addingStock, setAddingStock] = useState<string | null>(null);
    const [addStockQty, setAddStockQty] = useState(100);
    const [addStockLoading, setAddStockLoading] = useState(false);
    const [renewingCampaign, setRenewingCampaign] = useState<string | null>(null);
    const [renewDate, setRenewDate] = useState('');
    const [renewLoading, setRenewLoading] = useState(false);

    const startEditEvent = (evt: EventWithStats) => {
        setEditingEvent(evt);
        setName(evt.name);
        setStartDate(evt.startDate);
        setEndDate(evt.endDate);
        setPrizePool((evt.prizePool || []).map(p => ({ ...p })));
        setShowCreate(true);
    };

    const cancelEdit = () => {
        setEditingEvent(null);
        setName(''); setStartDate(''); setEndDate('');
        setPrizePool([]); setShowCreate(false);
    };

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
            const camp = localCampaigns.find(c => c.id === entry.campaignId);
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
    }, [prizePool, localCampaigns, totalDays]);

    const allStockValid = stockValidations.every(v => v.valid);
    const formValid = name.trim() && startDate && endDate && startDate <= endDate
        && prizePool.length > 0 && rateValid && allStockValid
        && prizePool.every(p => p.rate > 0 && p.dailyLimit > 0);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!formValid) return;
        setSubmitting(true);
        try {
            const token = await getToken();
            if (editingEvent) {
                // PATCH — edit existing event
                const res = await fetch('/api/events', {
                    method: 'PATCH',
                    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
                    body: JSON.stringify({ eventId: editingEvent.id, name, startDate, endDate, prizePool }),
                });
                const data = await res.json();
                if (!res.ok) throw new Error(data.error || 'Thao tác thất bại');
                cancelEdit();
                onSuccess(data.message || 'Cập nhật sự kiện thành công!');
            } else {
                // POST — create new
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
            }
        } catch (err: unknown) {
            onError(err instanceof Error ? err.message : 'Đã xảy ra lỗi');
        } finally {
            setSubmitting(false);
        }
    };

    // ── Voucher suggestion: add stock to a campaign ──────────────
    // Updates totalIssued locally so the form is NOT reset by a full reload
    const handleAddStock = async (campaignId: string) => {
        if (addStockQty < 1 || addStockQty > 1000000) { onError('Số lượng phải từ 1 đến 1.000.000'); return; }
        setAddStockLoading(true);
        try {
            const token = await getToken();
            const res = await fetch('/api/vouchers', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
                body: JSON.stringify({ action: 'add_codes', campaignId, quantity: addStockQty }),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || 'Thất bại');
            // Update local campaigns totalIssued — no full reload needed
            setLocalCampaigns(prev => prev.map(c =>
                c.id === campaignId ? { ...c, totalIssued: c.totalIssued + addStockQty } : c
            ));
            setAddingStock(null);
            showMsg('success', data.message || 'Tạo thêm mã thành công!');
        } catch (err: unknown) {
            onError(err instanceof Error ? err.message : 'Lỗi');
        } finally {
            setAddStockLoading(false);
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
            <div className="flex justify-end gap-2">
                {editingEvent && (
                    <button
                        onClick={cancelEdit}
                        className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold bg-surface-200 text-surface-700 transition-all"
                    >
                        <X className="w-4 h-4" />
                        Hủy chỉnh sửa
                    </button>
                )}
                <button
                    onClick={() => { if (editingEvent) { cancelEdit(); } else { setShowCreate(!showCreate); } }}
                    className={cn(
                        'flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold transition-all',
                        showCreate && !editingEvent
                            ? 'bg-surface-200 text-surface-700'
                            : 'bg-surface-800 hover:bg-surface-900 text-white shadow-sm'
                    )}
                >
                    <Plus className="w-4 h-4" />
                    {showCreate && !editingEvent ? 'Ẩn Form' : 'Tạo sự kiện mới'}
                </button>
            </div>

            {/* ── CREATE FORM ──────────────────────────────────── */}
            {showCreate && (
                <div className="bg-white rounded-2xl border border-surface-200 shadow-sm overflow-hidden animate-in slide-in-from-top-2 duration-300">
                    <div className="px-6 py-5 border-b border-surface-100">
                        <h2 className="text-lg font-bold text-surface-800 flex items-center gap-2">
                            {editingEvent ? <Pencil className="w-5 h-5 text-accent-500" /> : <Plus className="w-5 h-5 text-accent-500" />}
                            {editingEvent ? `Chỉnh sửa: ${editingEvent.name}` : 'Tạo sự kiện mới'}
                        </h2>
                    </div>
                    <form onSubmit={handleSubmit} className="p-6 space-y-6">
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
                                            {(() => {
                                                const eventCampaigns = localCampaigns.filter(c => !c.purpose || c.purpose === 'event');
                                                if (eventCampaigns.length === 0) return (
                                                    <p className="p-4 text-sm text-surface-400 text-center">Không có chiến dịch nào (chỉ hiển thị chiến dịch &quot;Sự kiện&quot;)</p>
                                                );
                                                return eventCampaigns.map(c => {
                                                    const isPaused = c.status === 'paused';
                                                    return (
                                                        <label
                                                            key={c.id}
                                                            className={cn(
                                                                'flex items-center gap-3 px-4 py-3 border-b z-50 border-surface-50 last:border-0 transition-colors',
                                                                isPaused
                                                                    ? 'opacity-50 cursor-not-allowed bg-surface-50'
                                                                    : 'hover:bg-surface-50 cursor-pointer',
                                                                selectedCampIds.has(c.id) && 'bg-accent-50/50'
                                                            )}
                                                        >
                                                            <input
                                                                type="checkbox"
                                                                checked={selectedCampIds.has(c.id)}
                                                                onChange={() => !isPaused && toggleCampaign(c)}
                                                                disabled={isPaused}
                                                                className="w-4 h-4 rounded border-surface-300 text-accent-500 focus:ring-accent-400 disabled:opacity-50"
                                                            />
                                                            <div className="flex-1 min-w-0">
                                                                <p className="text-sm font-semibold text-surface-800 truncate">
                                                                    {c.name}
                                                                    {isPaused && <span className="ml-1.5 text-[10px] font-bold text-warning-600 bg-warning-50 px-1 py-0.5 rounded border border-warning-200">Tạm dừng</span>}
                                                                </p>
                                                                <p className="text-xs text-surface-400">
                                                                    {REWARD_LABELS[c.rewardType]} • {c.totalIssued} mã
                                                                </p>
                                                            </div>
                                                        </label>
                                                    );
                                                });
                                            })()}
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

                        {/* Voucher Suggestion Banner */}
                        {stockValidations.some(v => !v.valid) && (
                            <div className="bg-warning-50 border border-warning-200 rounded-xl p-4 space-y-3">
                                <div className="flex items-center gap-2">
                                    <AlertCircle className="w-4 h-4 text-warning-600" />
                                    <p className="text-sm font-bold text-warning-700">Kho mã không đủ</p>
                                </div>
                                <div className="space-y-2">
                                    {stockValidations.filter(v => !v.valid).map(v => {
                                        const entry = prizePool.find(p => p.campaignId === v.campaignId);
                                        const shortfall = v.maxIssuance - v.stock;
                                        const isAddingThis = addingStock === v.campaignId;
                                        return (
                                            <div key={v.campaignId} className="flex flex-col sm:flex-row sm:items-center gap-2 bg-white rounded-lg border border-warning-100 p-3">
                                                <div className="flex-1">
                                                    <p className="text-xs font-semibold text-warning-800">
                                                        {entry?.campaignName}: thiếu <span className="text-danger-600">{shortfall}</span> mã
                                                    </p>
                                                    <p className="text-[10px] text-warning-600">{v.message}</p>
                                                </div>
                                                {isAddingThis ? (
                                                    <div className="flex items-center gap-2">
                                                        <input
                                                            type="number" min={1} max={1000000}
                                                            value={addStockQty}
                                                            onChange={e => setAddStockQty(Number(e.target.value))}
                                                            className="w-24 bg-white border border-warning-200 text-sm rounded-lg p-1.5 focus:ring-warning-400 focus:border-warning-400"
                                                        />
                                                        <button
                                                            type="button"
                                                            onClick={() => handleAddStock(v.campaignId)}
                                                            disabled={addStockLoading}
                                                            className="flex items-center gap-1 px-3 py-1.5 bg-surface-800 hover:bg-surface-900 disabled:bg-surface-300 text-white text-xs font-semibold rounded-lg transition-colors"
                                                        >
                                                            {addStockLoading ? <Loader2 className="w-3 h-3 animate-spin" /> : <Plus className="w-3 h-3" />}
                                                            Tạo
                                                        </button>
                                                        <button type="button" onClick={() => setAddingStock(null)} className="text-xs text-surface-400 hover:text-surface-600">Hủy</button>
                                                    </div>
                                                ) : (
                                                    <button
                                                        type="button"
                                                        onClick={() => { setAddingStock(v.campaignId); setAddStockQty(shortfall > 0 ? shortfall : 100); }}
                                                        className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-warning-100 text-warning-700 hover:bg-warning-200 border border-warning-200 transition-colors"
                                                    >
                                                        <PlusCircle className="w-3.5 h-3.5" />
                                                        Tạo thêm mã
                                                    </button>
                                                )}
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        )}

                        {/* ── Campaign Expiry Renewal Suggestion ── */}
                        {prizePool.length > 0 && endDate && (
                            <div className="bg-primary-50 border border-primary-200 rounded-xl p-4 space-y-3">
                                <div className="flex items-center gap-2">
                                    <CalendarDays className="w-4 h-4 text-primary-600" />
                                    <p className="text-sm font-bold text-primary-700">Gia hạn chiến dịch voucher</p>
                                </div>
                                <p className="text-xs text-primary-600">Cập nhật ngày hết hạn của chiến dịch voucher cho phù hợp với sự kiện.</p>
                                <div className="space-y-2">
                                    {prizePool.map(entry => {
                                        const camp = localCampaigns.find(c => c.id === entry.campaignId);
                                        if (!camp) return null;
                                        const isExpired = camp.validTo < endDate;
                                        const isRenewing = renewingCampaign === camp.id;
                                        return (
                                            <div key={camp.id} className="flex flex-col sm:flex-row sm:items-center gap-2 bg-white rounded-lg border border-primary-100 p-3">
                                                <div className="flex-1">
                                                    <p className="text-xs font-semibold text-primary-800">
                                                        {camp.name}
                                                    </p>
                                                    <p className="text-[10px] text-primary-600">
                                                        Hiện tại: {camp.validTo}
                                                        {isExpired && (
                                                            <span className="text-danger-600 font-bold ml-1">• Hết hạn trước ngày kết thúc sự kiện ({endDate})</span>
                                                        )}
                                                    </p>
                                                </div>
                                                {isRenewing ? (
                                                    <div className="flex items-center gap-2">
                                                        <input
                                                            type="date"
                                                            value={renewDate}
                                                            onChange={e => setRenewDate(e.target.value)}
                                                            className="w-36 bg-white border border-primary-200 text-sm rounded-lg p-1.5 focus:ring-primary-400 focus:border-primary-400"
                                                        />
                                                        <button
                                                            type="button"
                                                            onClick={async () => {
                                                                if (!renewDate) { onError('Chọn ngày hết hạn mới'); return; }
                                                                setRenewLoading(true);
                                                                try {
                                                                    const token = await getToken();
                                                                    const res = await fetch('/api/vouchers', {
                                                                        method: 'PATCH',
                                                                        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
                                                                        body: JSON.stringify({ action: 'update_expiry', campaignId: camp.id, validTo: renewDate }),
                                                                    });
                                                                    const data = await res.json();
                                                                    if (!res.ok) throw new Error(data.error || 'Thất bại');
                                                                    setRenewingCampaign(null);
                                                                    onSuccess(data.message || 'Gia hạn thành công');
                                                                } catch (err: unknown) {
                                                                    onError(err instanceof Error ? err.message : 'Lỗi');
                                                                } finally {
                                                                    setRenewLoading(false);
                                                                }
                                                            }}
                                                            disabled={renewLoading}
                                                            className="flex items-center gap-1 px-3 py-1.5 bg-primary-600 hover:bg-primary-700 disabled:bg-surface-300 text-white text-xs font-semibold rounded-lg transition-colors"
                                                        >
                                                            {renewLoading ? <Loader2 className="w-3 h-3 animate-spin" /> : <CalendarDays className="w-3 h-3" />}
                                                            Cập nhật
                                                        </button>
                                                        <button type="button" onClick={() => setRenewingCampaign(null)} className="text-xs text-surface-400 hover:text-surface-600">Hủy</button>
                                                    </div>
                                                ) : (
                                                    <button
                                                        type="button"
                                                        onClick={() => { setRenewingCampaign(camp.id); setRenewDate(endDate); }}
                                                        className={cn(
                                                            'flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg border transition-colors',
                                                            isExpired
                                                                ? 'bg-danger-50 text-danger-700 border-danger-200 hover:bg-danger-100'
                                                                : 'bg-primary-100 text-primary-700 border-primary-200 hover:bg-primary-200'
                                                        )}
                                                    >
                                                        <CalendarDays className="w-3.5 h-3.5" />
                                                        {isExpired ? 'Gia hạn ngay' : 'Gia hạn'}
                                                    </button>
                                                )}
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        )}

                        {/* Submit */}
                        <div className="flex items-center justify-between pt-5 border-t border-surface-100">
                            {editingEvent && (
                                <button type="button" onClick={cancelEdit} className="text-sm text-surface-500 hover:text-surface-700 transition-colors">
                                    Hủy chỉnh sửa
                                </button>
                            )}
                            <button
                                type="submit"
                                disabled={submitting || !formValid}
                                className={cn(
                                    'flex items-center gap-2 px-7 py-3 rounded-xl font-bold text-white shadow-lg transition-all duration-200',
                                    'disabled:opacity-50 disabled:cursor-not-allowed disabled:shadow-none',
                                    editingEvent
                                        ? 'bg-gradient-to-r from-accent-500 to-accent-600 hover:from-accent-600 hover:to-accent-700 shadow-accent-500/25'
                                        : 'bg-gradient-to-r from-surface-800 to-surface-900 hover:from-surface-900 hover:to-black shadow-surface-800/25'
                                )}
                            >
                                {submitting ? (
                                    <><Loader2 className="w-4 h-4 animate-spin" /> {editingEvent ? 'Đang lưu...' : 'Đang tạo...'}</>
                                ) : (
                                    <>{editingEvent ? <Pencil className="w-4 h-4" /> : <Plus className="w-4 h-4" />} {editingEvent ? 'Lưu thay đổi' : 'Tạo sự kiện'}</>
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
                                'cursor-pointer transition-all duration-200',
                                selectedEventId === evt.id ? 'bg-accent-50/60' : muted ? 'hover:bg-surface-50/40' : 'hover:bg-surface-50/60',
                                muted && 'opacity-50'
                            )}
                        >
                            <td className="px-5 py-4">
                                <div className="flex items-center gap-2.5">
                                    <ChevronRight className={cn('w-4 h-4 text-surface-400 shrink-0 transition-transform duration-200', selectedEventId === evt.id && 'rotate-90 text-accent-500')} />
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
                            <td className="px-5 py-4">
                                <span className={cn('text-[11px] font-bold px-2.5 py-1 rounded-lg border', EVENT_STATUS_BADGE[evt.status])}>
                                    {EVENT_STATUS_LABELS[evt.status]}
                                </span>
                            </td>
                            <td className="px-5 py-4 text-center">
                                <div className="flex flex-col items-center gap-1">
                                    <div className="flex items-center gap-1.5 text-xs">
                                        <span className="text-success-600 font-bold">{evt.codesAvailable}</span>
                                        <span className="text-surface-300">/</span>
                                        <span className="text-surface-500">{evt.totalStock}</span>
                                    </div>
                                    {evt.totalStock > 0 && (
                                        <div className="w-16 h-1 bg-surface-100 rounded-full overflow-hidden">
                                            <div
                                                className={cn('h-full rounded-full', evt.codesAvailable / evt.totalStock > 0.5 ? 'bg-success-400' : evt.codesAvailable / evt.totalStock > 0.2 ? 'bg-warning-400' : 'bg-danger-400')}
                                                style={{ width: `${Math.round((evt.codesAvailable / evt.totalStock) * 100)}%` }}
                                            />
                                        </div>
                                    )}
                                </div>
                            </td>
                            <td className="px-5 py-4 text-right" onClick={e => e.stopPropagation()}>
                                <div className="flex items-center justify-end gap-2">
                                    {(evt.status === 'active' || evt.status === 'upcoming') && (
                                        <button
                                            onClick={() => startEditEvent(evt)}
                                            className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-semibold rounded-lg bg-surface-50 text-surface-600 hover:bg-accent-50 hover:text-accent-700 border border-surface-200 hover:border-accent-200 transition-colors"
                                        >
                                            <Pencil className="w-3.5 h-3.5" /> Chỉnh sửa
                                        </button>
                                    )}
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
    { key: 'location', label: 'Địa điểm' },
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
            (p.email && p.email.toLowerCase().includes(q)) ||
            (p.location && p.location.toLowerCase().includes(q))
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
            location: p.location || '',
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
                <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
                    {[
                        { l: 'Tổng KH', v: allParticipations.length.toLocaleString(), c: 'text-primary-700 font-bold' },
                        { l: 'Tổng lượt quay', v: allParticipations.reduce((s, p) => s + p.usedSpins, 0).toLocaleString(), c: 'text-accent-700' },
                        { l: 'Giải trúng', v: allParticipations.reduce((s, p) => s + p.prizes.length, 0).toLocaleString(), c: 'text-warning-700' },
                        { l: 'Có địa điểm', v: allParticipations.filter(p => p.location).length.toLocaleString(), c: 'text-info-700' },
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
                                    <th className="px-4 py-3 font-semibold">Địa điểm</th>
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
                                        <td className="px-4 py-3">
                                            {p.location ? (
                                                <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-info-50 text-info-700 border border-info-200 inline-flex items-center gap-1">
                                                    <MapPin className="w-3 h-3" />{p.location}
                                                </span>
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
