'use client';

import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import imageCompression from 'browser-image-compression';
import { storage } from '@/lib/firebase';
import { ref as storageRef, uploadBytesResumable, getDownloadURL } from 'firebase/storage';
import { useAuth } from '@/contexts/AuthContext';
import TicketDesigner from '@/components/vouchers/TicketDesigner';
import BulkEmailModal from '@/components/vouchers/BulkEmailModal';
import {
    BarChart3, PieChart as PieChartIcon, Ticket, Plus, Hash, Search,
    ShieldX, Loader2, CheckCircle2, AlertCircle, LayoutDashboard,
    Megaphone, Archive, Sparkles, CalendarDays, Tag, Gift,
    EyeOff, ArchiveRestore, X as XIcon, CheckSquare, Square,
    ImagePlus, Upload, Pause, Play, PlusCircle, FileDown, Printer, Dices,
    ArrowUpDown, ArrowUp, ArrowDown, Pencil, Save, Palette, Send,
    Mail, MailCheck,
} from 'lucide-react';
import { cn, generateSecureCode } from '@/lib/utils';
import { useBatchProcessor } from '@/hooks/useBatchProcessor';
import BatchProgressModal from '@/components/shared/BatchProgressModal';
import {
    BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell,
    PieChart, Pie, Legend,
} from 'recharts';
import type {
    VoucherCampaign, VoucherCode, VoucherRewardType, VoucherCampaignPurpose,
    TicketTemplateConfig,
} from '@/types';

// ─── Constants ──────────────────────────────────────────────────
const TABS = [
    { key: 'dashboard', label: 'Tổng quan', icon: LayoutDashboard },
    { key: 'campaigns', label: 'Chiến dịch', icon: Megaphone },
    { key: 'codes', label: 'Kho Voucher', icon: Archive },
] as const;

type TabKey = typeof TABS[number]['key'];

const REWARD_LABELS: Record<VoucherRewardType, string> = {
    discount_percent: 'Giảm %',
    discount_fixed: 'Giảm tiền',
    free_ticket: 'Vé miễn phí',
    free_item: 'Tặng sản phẩm',
};

const STATUS_BADGE: Record<string, string> = {
    available: 'bg-surface-100 text-surface-600 border-surface-200',
    distributed: 'bg-primary-50 text-primary-700 border-primary-200',
    used: 'bg-success-50 text-success-700 border-success-200',
    revoked: 'bg-danger-50 text-danger-700 border-danger-200',
    expired: 'bg-warning-50 text-warning-700 border-warning-200',
};

const STATUS_LABELS: Record<string, string> = {
    available: 'Có sẵn',
    distributed: 'Đã phát',
    used: 'Đã dùng',
    revoked: 'Vô hiệu',
    expired: 'Hết hạn',
};

type InventoryView = 'active' | 'archived';

const BAR_COLORS = ['#94a3b8', '#3b82f6', '#22c55e', '#ef4444'];
const PIE_COLORS = ['#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4'];

// ─── Stats type from server ─────────────────────────────────────
interface VoucherStats {
    total: number;
    available: number;
    distributed: number;
    used: number;
    revoked: number;
}

// ─── Main Page ──────────────────────────────────────────────────
export default function VouchersPage() {
    const { user, userDoc, loading: authLoading, hasPermission } = useAuth();
    const [tab, setTab] = useState<TabKey>('dashboard');

    // Data — no more global codes array!
    const [campaigns, setCampaigns] = useState<VoucherCampaign[]>([]);
    const [campaignStats, setCampaignStats] = useState<Record<string, VoucherStats>>({});
    const [globalStats, setGlobalStats] = useState<VoucherStats>({ total: 0, available: 0, distributed: 0, used: 0, revoked: 0 });
    const [loading, setLoading] = useState(true);

    // Messages
    const [msg, setMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
    const showMsg = (type: 'success' | 'error', text: string) => {
        setMsg({ type, text });
        setTimeout(() => setMsg(null), 5000);
    };

    // ── Designer & Email modal state ─────────────────────────────
    const [designingCampaign, setDesigningCampaign] = useState<VoucherCampaign | null>(null);
    const [bulkEmailState, setBulkEmailState] = useState<{
        campaign: VoucherCampaign;
        templateConfig: TicketTemplateConfig;
    } | null>(null);

    const getToken = useCallback(async () => user ? await user.getIdToken() : undefined, [user]);

    // Fetch campaigns + aggregate stats (zero doc reads)
    const fetchStats = useCallback(async () => {
        try {
            setLoading(true);
            const token = await getToken();
            const res = await fetch('/api/vouchers?mode=stats', {
                headers: { Authorization: `Bearer ${token}` },
            });
            if (!res.ok) throw new Error('Không thể tải dữ liệu');
            const data = await res.json();
            setCampaigns(data.campaigns || []);
            setCampaignStats(data.campaignStats || {});
            setGlobalStats(data.globalStats || { total: 0, available: 0, distributed: 0, used: 0, revoked: 0 });
        } catch {
            showMsg('error', 'Không thể tải dữ liệu voucher');
        } finally {
            setLoading(false);
        }
    }, [getToken]);

    useEffect(() => {
        if (user && (userDoc?.role === 'admin' || userDoc?.role === 'super_admin' || hasPermission('page.admin.vouchers'))) {
            fetchStats();
        }
    }, [user, userDoc, hasPermission, fetchStats]);

    // Auth guards
    if (authLoading) return <div className="p-8 text-center">Đang tải...</div>;
    if (userDoc?.role !== 'admin' && userDoc?.role !== 'super_admin' && !hasPermission('page.admin.vouchers')) {
        return <div className="p-8 text-center text-danger-500">Bạn không có quyền truy cập trang này.</div>;
    }

    return (
        <div className="space-y-6 mx-auto">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-surface-800 flex items-center gap-2">
                        <Ticket className="w-7 h-7 text-accent-500" />
                        Quản lý Voucher
                    </h1>
                    <p className="text-surface-500 mt-1">Tạo chiến dịch, phát hành mã, theo dõi phân tích.</p>
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
                    {tab === 'dashboard' && <DashboardTab campaigns={campaigns} globalStats={globalStats} campaignStats={campaignStats} />}
                    {tab === 'campaigns' && (
                        <CampaignTab
                            campaigns={campaigns}
                            campaignStats={campaignStats}
                            getToken={getToken}
                            fetchData={fetchStats}
                            onSuccess={(m) => { fetchStats(); showMsg('success', m || 'Thao tác thành công!'); }}
                            onError={(e) => showMsg('error', e)}
                            onDesign={(camp) => setDesigningCampaign(camp)}
                        />
                    )}
                    {tab === 'codes' && (
                        <CodeInventoryTab
                            campaigns={campaigns}
                            getToken={getToken}
                            onRevoke={() => { fetchStats(); showMsg('success', 'Đã vô hiệu hóa mã voucher'); }}
                            onError={(e) => showMsg('error', e)}
                            onBulkEmail={(camp, tpl) => setBulkEmailState({ campaign: camp, templateConfig: tpl })}
                        />
                    )}
                </>
            )}

            {/* ── Ticket Designer Modal */}
            {designingCampaign && (
                <TicketDesigner
                    campaign={designingCampaign}
                    getToken={getToken}
                    onClose={() => setDesigningCampaign(null)}
                    onOpenBulkEmail={(tpl) => {
                        setBulkEmailState({ campaign: designingCampaign, templateConfig: tpl });
                        setDesigningCampaign(null);
                    }}
                />
            )}

            {/* ── Bulk Email Modal */}
            {bulkEmailState && (
                <BulkEmailModal
                    campaign={bulkEmailState.campaign}
                    templateConfig={bulkEmailState.templateConfig}
                    getToken={getToken}
                    onClose={() => setBulkEmailState(null)}
                    onAddCodes={async (qty) => {
                        const token = await getToken();
                        await fetch('/api/vouchers', {
                            method: 'PATCH',
                            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
                            body: JSON.stringify({ action: 'add_codes', campaignId: bulkEmailState.campaign.id, quantity: qty }),
                        });
                        await fetchStats();
                    }}
                />
            )}
        </div>
    );
}

// ═════════════════════════════════════════════════════════════════
// TAB 1: DASHBOARD (uses server-side aggregate stats — zero doc reads)
// ═════════════════════════════════════════════════════════════════
function DashboardTab({ campaigns, globalStats, campaignStats }: {
    campaigns: VoucherCampaign[];
    globalStats: VoucherStats;
    campaignStats: Record<string, VoucherStats>;
}) {
    const barData = useMemo(() => [
        { name: 'Có sẵn', value: globalStats.available },
        { name: 'Đã phát', value: globalStats.distributed },
        { name: 'Đã dùng', value: globalStats.used },
        { name: 'Vô hiệu', value: globalStats.revoked },
    ], [globalStats]);

    const pieData = useMemo(() => {
        const map = new Map<string, number>();
        campaigns.forEach(c => {
            const stats = campaignStats[c.id];
            if (stats) {
                map.set(c.rewardType, (map.get(c.rewardType) || 0) + stats.total);
            }
        });
        return Array.from(map.entries()).map(([key, value]) => ({
            name: REWARD_LABELS[key as VoucherRewardType] || key,
            value,
        }));
    }, [campaigns, campaignStats]);

    const kpis = [
        { label: 'Chiến dịch', value: campaigns.length, icon: Megaphone, color: 'text-accent-600 bg-accent-50' },
        { label: 'Mã đã tạo', value: globalStats.total, icon: Hash, color: 'text-primary-600 bg-primary-50' },
        { label: 'Đã phát', value: globalStats.distributed, icon: Gift, color: 'text-warning-600 bg-warning-50' },
        { label: 'Đã sử dụng', value: globalStats.used, icon: CheckCircle2, color: 'text-success-600 bg-success-50' },
    ];

    return (
        <div className="space-y-6">
            {/* KPI Cards */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                {kpis.map(k => (
                    <div key={k.label} className="bg-white rounded-2xl border border-surface-200 shadow-sm p-5">
                        <div className="flex items-center gap-3 mb-3">
                            <div className={cn('w-10 h-10 rounded-xl flex items-center justify-center', k.color)}>
                                <k.icon className="w-5 h-5" />
                            </div>
                            <span className="text-sm font-medium text-surface-500">{k.label}</span>
                        </div>
                        <p className="text-3xl font-black text-surface-800">{k.value.toLocaleString()}</p>
                    </div>
                ))}
            </div>

            {/* Charts */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Bar Chart */}
                <div className="bg-white rounded-2xl border border-surface-200 shadow-sm p-6">
                    <div className="flex items-center gap-2 mb-4">
                        <BarChart3 className="w-5 h-5 text-accent-500" />
                        <h3 className="text-base font-bold text-surface-800">Phân bố trạng thái mã</h3>
                    </div>
                    {globalStats.total === 0 ? (
                        <div className="h-64 flex items-center justify-center text-surface-400 text-sm">Chưa có dữ liệu</div>
                    ) : (
                        <ResponsiveContainer width="100%" height={280}>
                            <BarChart data={barData}>
                                <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                                <YAxis tick={{ fontSize: 12 }} />
                                <Tooltip />
                                <Bar dataKey="value" radius={[6, 6, 0, 0]}>
                                    {barData.map((_, i) => (
                                        <Cell key={i} fill={BAR_COLORS[i]} />
                                    ))}
                                </Bar>
                            </BarChart>
                        </ResponsiveContainer>
                    )}
                </div>

                {/* Pie Chart */}
                <div className="bg-white rounded-2xl border border-surface-200 shadow-sm p-6">
                    <div className="flex items-center gap-2 mb-4">
                        <PieChartIcon className="w-5 h-5 text-accent-500" />
                        <h3 className="text-base font-bold text-surface-800">Phân bố loại thưởng</h3>
                    </div>
                    {pieData.length === 0 ? (
                        <div className="h-64 flex items-center justify-center text-surface-400 text-sm">Chưa có dữ liệu</div>
                    ) : (
                        <ResponsiveContainer width="100%" height={280}>
                            <PieChart>
                                <Pie
                                    data={pieData}
                                    dataKey="value"
                                    nameKey="name"
                                    cx="50%"
                                    cy="50%"
                                    outerRadius={100}
                                    innerRadius={50}
                                    paddingAngle={3}
                                    label={({ name, percent }) => `${name} ${((percent ?? 0) * 100).toFixed(0)}%`}
                                >
                                    {pieData.map((_, i) => (
                                        <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                                    ))}
                                </Pie>
                                <Legend />
                                <Tooltip />
                            </PieChart>
                        </ResponsiveContainer>
                    )}
                </div>
            </div>
        </div>
    );
}

// ═════════════════════════════════════════════════════════════════
// TAB 2: CAMPAIGN CREATION
// ═════════════════════════════════════════════════════════════════
function CampaignTab({
    campaigns,
    campaignStats,
    getToken,
    fetchData,
    onSuccess,
    onError,
    onDesign,
}: {
    campaigns: VoucherCampaign[];
    campaignStats: Record<string, VoucherStats>;
    getToken: () => Promise<string | undefined>;
    fetchData: () => void;
    onSuccess: (msg?: string) => void;
    onError: (msg: string) => void;
    onDesign: (campaign: VoucherCampaign) => void;
}) {
    const [name, setName] = useState('');
    const [description, setDescription] = useState('');
    const [rewardType, setRewardType] = useState<VoucherRewardType>('discount_percent');
    const [rewardValue, setRewardValue] = useState<number>(0);
    const [validFrom, setValidFrom] = useState('');
    const [validTo, setValidTo] = useState('');
    const [prefix, setPrefix] = useState('');
    const [codeLength, setCodeLength] = useState(6);
    const [suffix, setSuffix] = useState('');
    const [quantity, setQuantity] = useState(100);
    const [purpose, setPurpose] = useState<VoucherCampaignPurpose>('event');
    const [submitting, setSubmitting] = useState(false);
    const [batchTitle, setBatchTitle] = useState('');
    const batch = useBatchProcessor();

    // ── Image upload state (deferred: compress on select, upload on submit) ──
    const [pendingImageFile, setPendingImageFile] = useState<File | null>(null);
    const [imagePreview, setImagePreview] = useState<string>('');
    const [imageCompressing, setImageCompressing] = useState(false);
    const [uploadProgress, setUploadProgress] = useState(0);
    const [uploadStatus, setUploadStatus] = useState<'compressing' | 'uploading' | ''>('');
    const [imageMsg, setImageMsg] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    // Live preview
    const previewCode = useMemo(() => {
        const random = generateSecureCode(codeLength);
        const parts = [prefix.toUpperCase(), random, suffix.toUpperCase()].filter(Boolean);
        return parts.join('-');
    }, [prefix, codeLength, suffix]);

    // ── Step 1: File selected → compress to WebP, no Firebase call yet ──────
    const handleImageSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
            setImageMsg({ type: 'err', text: 'Chỉ chấp nhận JPG, PNG hoặc WebP.' });
            return;
        }
        if (file.size > 20 * 1024 * 1024) {
            setImageMsg({ type: 'err', text: 'File quá lớn (tối đa 20 MB).' });
            return;
        }
        setImageCompressing(true);
        setUploadStatus('compressing');
        setImageMsg(null);
        if (imagePreview.startsWith('blob:')) URL.revokeObjectURL(imagePreview);
        try {
            const compressed = await imageCompression(file, {
                maxSizeMB: 0.3,
                maxWidthOrHeight: 1200,
                useWebWorker: true,
                fileType: 'image/webp',
            });
            setPendingImageFile(compressed);
            setImagePreview(URL.createObjectURL(compressed));
            setImageMsg({ type: 'ok', text: `Ảnh đã sẵn sàng (${(compressed.size / 1024).toFixed(0)} KB). Nhấn Tạo để hoàn tất.` });
        } catch {
            setImageMsg({ type: 'err', text: 'Nén ảnh thất bại. Vui lòng chọn lại.' });
        } finally {
            setImageCompressing(false);
            setUploadStatus('');
        }
    };

    // ── Step 2: Upload pending compressed file to Firebase Storage ────────────
    const uploadPendingImage = (): Promise<string> => {
        return new Promise((resolve, reject) => {
            if (!pendingImageFile) { resolve(''); return; }
            setUploadStatus('uploading');
            setUploadProgress(0);
            const sRef = storageRef(storage, `vouchers/${Date.now()}.webp`);
            const task = uploadBytesResumable(sRef, pendingImageFile);
            task.on(
                'state_changed',
                snap => setUploadProgress(Math.round((snap.bytesTransferred / snap.totalBytes) * 100)),
                reject,
                async () => resolve(await getDownloadURL(task.snapshot.ref)),
            );
        });
    };

    const resetImageState = () => {
        if (imagePreview.startsWith('blob:')) URL.revokeObjectURL(imagePreview);
        setPendingImageFile(null);
        setImagePreview('');
        setUploadProgress(0);
        setUploadStatus('');
        setImageMsg(null);
        if (fileInputRef.current) fileInputRef.current.value = '';
    };
    const BATCH_CHUNK = 10000;

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setSubmitting(true);
        try {
            // Upload image first (if pending), then submit campaign
            let imageUrl = '';
            if (pendingImageFile) {
                imageUrl = await uploadPendingImage();
                setUploadStatus('');
            }

            // POST creates campaign + initial codes (capped at BATCH_CHUNK)
            const initialQty = Math.min(quantity, BATCH_CHUNK);
            const token = await getToken();
            const res = await fetch('/api/vouchers', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
                body: JSON.stringify({
                    name, description, rewardType, rewardValue,
                    validFrom, validTo, prefix, codeLength, suffix, quantity: initialQty, purpose,
                    ...(imageUrl ? { imageUrl } : {}),
                }),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || 'Thao tác thất bại');

            // If more codes needed, batch-process the rest with progress bar
            const remaining = quantity - initialQty;
            if (remaining > 0 && data.campaignId) {
                setSubmitting(false);
                setBatchTitle(`Tạo ${quantity.toLocaleString()} mã voucher`);
                await batch.processByQuantity(
                    '/api/vouchers',
                    { action: 'add_codes', campaignId: data.campaignId },
                    remaining,
                    BATCH_CHUNK,
                    getToken,
                );
            }

            // Reset form
            setName(''); setDescription(''); setRewardValue(0);
            setValidFrom(''); setValidTo(''); setPrefix('');
            setCodeLength(6); setSuffix(''); setQuantity(100); setPurpose('event');
            resetImageState();
            onSuccess();
        } catch (err: unknown) {
            onError(err instanceof Error ? err.message : 'Đã xảy ra lỗi');
        } finally {
            setSubmitting(false);
            setUploadStatus('');
        }
    };

    // ── Campaign management actions ──────────────────────────────
    const [addingCodesFor, setAddingCodesFor] = useState<string | null>(null);
    const [addQty, setAddQty] = useState(100);
    const [actionLoading, setActionLoading] = useState<string | null>(null);
    const [updatingExpiryFor, setUpdatingExpiryFor] = useState<string | null>(null);
    const [newValidTo, setNewValidTo] = useState('');

    // ── Campaign edit state ──────────────────────────────────────
    const [editingCampaignId, setEditingCampaignId] = useState<string | null>(null);
    const [editForm, setEditForm] = useState({
        name: '', description: '', rewardType: 'discount_percent' as VoucherRewardType,
        rewardValue: 0, purpose: 'event' as VoucherCampaignPurpose,
        validFrom: '', validTo: '',
    });

    // Edit image state
    const [editPendingImage, setEditPendingImage] = useState<File | null>(null);
    const [editImagePreview, setEditImagePreview] = useState('');
    const [editImageCompressing, setEditImageCompressing] = useState(false);
    const editFileInputRef = useRef<HTMLInputElement>(null);

    const startEditCampaign = (camp: VoucherCampaign) => {
        setEditingCampaignId(camp.id);
        setEditForm({
            name: camp.name,
            description: camp.description || '',
            rewardType: camp.rewardType,
            rewardValue: camp.rewardValue,
            purpose: camp.purpose || 'event',
            validFrom: camp.validFrom,
            validTo: camp.validTo,
        });
        // Init image preview from existing campaign image
        setEditImagePreview(camp.image || '');
        setEditPendingImage(null);
        if (editFileInputRef.current) editFileInputRef.current.value = '';
        // Close other inline forms
        setAddingCodesFor(null);
        setUpdatingExpiryFor(null);
    };

    const handleEditImageSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
            onError('Chỉ chấp nhận JPG, PNG hoặc WebP.');
            return;
        }
        if (file.size > 20 * 1024 * 1024) {
            onError('File quá lớn (tối đa 20 MB).');
            return;
        }
        setEditImageCompressing(true);
        try {
            const compressed = await imageCompression(file, {
                maxSizeMB: 0.3,
                maxWidthOrHeight: 1200,
                useWebWorker: true,
                fileType: 'image/webp',
            });
            if (editImagePreview.startsWith('blob:')) URL.revokeObjectURL(editImagePreview);
            setEditPendingImage(compressed);
            setEditImagePreview(URL.createObjectURL(compressed));
        } catch {
            onError('Nén ảnh thất bại.');
        } finally {
            setEditImageCompressing(false);
        }
    };

    const handleUpdateCampaign = async () => {
        if (!editingCampaignId || !editForm.name.trim()) return;
        setActionLoading(editingCampaignId);
        try {
            // Upload pending image if any
            let imageUrl: string | undefined;
            if (editPendingImage) {
                const sRef = storageRef(storage, `vouchers/${Date.now()}.webp`);
                const task = uploadBytesResumable(sRef, editPendingImage);
                await new Promise<void>((resolve, reject) => {
                    task.on('state_changed', null, reject, () => resolve());
                });
                imageUrl = await getDownloadURL(task.snapshot.ref);
            } else if (editImagePreview === '' || editImagePreview === undefined) {
                // User removed the image
                imageUrl = '';
            }

            const token = await getToken();
            const res = await fetch('/api/vouchers', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
                body: JSON.stringify({
                    action: 'update_campaign',
                    campaignId: editingCampaignId,
                    ...editForm,
                    ...(imageUrl !== undefined ? { imageUrl } : {}),
                }),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || 'Thất bại');
            // Cleanup
            if (editImagePreview.startsWith('blob:')) URL.revokeObjectURL(editImagePreview);
            setEditPendingImage(null);
            setEditImagePreview('');
            setEditingCampaignId(null);
            onSuccess(data.message);
        } catch (err: unknown) {
            onError(err instanceof Error ? err.message : 'Lỗi cập nhật');
        } finally {
            setActionLoading(null);
        }
    };

    const handleAddCodes = async (campaignId: string) => {
        if (addQty < 1 || addQty > 1000000) { onError('Số lượng phải từ 1 đến 1.000.000'); return; }
        const campName = campaigns.find(c => c.id === campaignId)?.name || '';
        setBatchTitle(`Thêm ${addQty.toLocaleString()} mã cho "${campName}"`);
        setAddingCodesFor(null);

        const result = await batch.processByQuantity(
            '/api/vouchers',
            { action: 'add_codes', campaignId },
            addQty,
            BATCH_CHUNK,
            getToken,
        );

        if (result.success) {
            setAddQty(100);
            onSuccess(`Đã tạo thêm ${result.totalProcessed.toLocaleString()} mã.`);
        } else if (result.error) {
            onError(result.error);
        }
    };

    const handleToggleCampaign = async (campaignId: string, currentStatus: string) => {
        const action = currentStatus === 'active' ? 'deactivate_campaign' : 'activate_campaign';
        setActionLoading(campaignId);
        try {
            const token = await getToken();
            const res = await fetch('/api/vouchers', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
                body: JSON.stringify({ action, campaignId }),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || 'Thất bại');
            onSuccess(data.message);
        } catch (err: unknown) {
            onError(err instanceof Error ? err.message : 'Lỗi');
        } finally {
            setActionLoading(null);
        }
    };

    const handleUpdateExpiry = async (campaignId: string) => {
        if (!newValidTo) { onError('Vui lòng chọn ngày hết hạn mới'); return; }
        const campName = campaigns.find(c => c.id === campaignId)?.name || '';
        const stats = campaignStats[campaignId];
        const expectedTotal = stats ? (stats.available + stats.distributed) : 0;
        setBatchTitle(`Gia hạn "${campName}" đến ${newValidTo}`);
        setUpdatingExpiryFor(null);

        const result = await batch.processByCursor(
            '/api/vouchers',
            { action: 'update_expiry', campaignId, validTo: newValidTo },
            expectedTotal,
            getToken,
        );

        if (result.success) {
            setNewValidTo('');
            onSuccess(`Đã cập nhật ${result.totalProcessed.toLocaleString()} mã.`);
        } else if (result.error) {
            onError(result.error);
        }
    };

    return (
        <>
        <div className="bg-white rounded-2xl border border-surface-200 shadow-sm overflow-hidden">
            <div className="px-6 py-5 border-b border-surface-100">
                <h2 className="text-lg font-bold text-surface-800 flex items-center gap-2">
                    <Plus className="w-5 h-5 text-accent-500" />
                    Tạo chiến dịch mới
                </h2>
                <p className="text-sm text-surface-500 mt-1">Điền thông tin và tạo mã voucher hàng loạt</p>
            </div>
            <form onSubmit={handleSubmit} className="p-6 space-y-6">
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    {/* Left Column */}
                    <div className="space-y-5">
                        {/* General Info */}
                        <div>
                            <h3 className="text-sm font-bold text-surface-700 flex items-center gap-2 mb-3 pb-2 border-b border-surface-100">
                                <Tag className="w-4 h-4 text-accent-500" />
                                Thông tin chung
                            </h3>
                            <div className="space-y-4">
                                <div className="space-y-1.5">
                                    <label htmlFor="v-name" className="text-sm font-medium text-surface-700">Tên chiến dịch *</label>
                                    <input
                                        id="v-name" required value={name} onChange={e => setName(e.target.value)}
                                        placeholder="VD: Khai trương Popup Store"
                                        className="w-full bg-surface-50 border border-surface-200 text-sm rounded-lg focus:ring-accent-500 focus:border-accent-400 block p-2.5"
                                    />
                                </div>
                                <div className="space-y-1.5">
                                    <label htmlFor="v-desc" className="text-sm font-medium text-surface-700">Mô tả</label>
                                    <textarea
                                        id="v-desc" value={description} onChange={e => setDescription(e.target.value)}
                                        placeholder="Mô tả ngắn về chiến dịch..."
                                        rows={3}
                                        className="w-full bg-surface-50 border border-surface-200 text-sm rounded-lg focus:ring-accent-500 focus:border-accent-400 block p-2.5 resize-none"
                                    />
                                </div>
                            </div>
                        </div>

                        {/* Purpose */}
                        <div>
                            <h3 className="text-sm font-bold text-surface-700 flex items-center gap-2 mb-3 pb-2 border-b border-surface-100">
                                <Dices className="w-4 h-4 text-accent-500" />
                                Mục đích sử dụng
                            </h3>
                            <div className="grid grid-cols-2 gap-3">
                                {([['event', 'Sự kiện', Dices, 'Dùng cho sự kiện quay thưởng'], ['print', 'In ấn', Printer, 'In voucher trực tiếp, xuất Excel + QR']] as const).map(([val, label, Icon, desc]) => (
                                    <button
                                        key={val}
                                        type="button"
                                        onClick={() => setPurpose(val)}
                                        className={cn(
                                            'flex items-start gap-3 p-3 rounded-xl border-2 text-left transition-all',
                                            purpose === val
                                                ? 'border-accent-500 bg-accent-50/50 shadow-sm'
                                                : 'border-surface-200 bg-surface-50 hover:border-surface-300'
                                        )}
                                    >
                                        <Icon className={cn('w-5 h-5 mt-0.5 shrink-0', purpose === val ? 'text-accent-600' : 'text-surface-400')} />
                                        <div>
                                            <p className={cn('text-sm font-bold', purpose === val ? 'text-accent-700' : 'text-surface-700')}>{label}</p>
                                            <p className="text-[10px] text-surface-400 mt-0.5">{desc}</p>
                                        </div>
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* Image Upload */}
                        <div>
                            <h3 className="text-sm font-bold text-surface-700 flex items-center gap-2 mb-3 pb-2 border-b border-surface-100">
                                <ImagePlus className="w-4 h-4 text-accent-500" />
                                Hình ảnh chiến dịch
                            </h3>
                            {/* Drop / click zone */}
                            <div
                                onClick={() => !imageCompressing && fileInputRef.current?.click()}
                                className={cn(
                                    'relative w-full h-36 rounded-xl border-2 border-dashed overflow-hidden flex items-center justify-center cursor-pointer transition-colors',
                                    imageCompressing
                                        ? 'border-accent-300 bg-accent-50'
                                        : 'border-surface-200 bg-surface-50 hover:border-accent-400 hover:bg-accent-50/40'
                                )}
                            >
                                {imagePreview ? (
                                    <img src={imagePreview} alt="preview" className="w-full h-full object-contain" />
                                ) : (
                                    <div className="flex flex-col items-center gap-2 text-surface-400">
                                        <Upload className="w-7 h-7" />
                                        <p className="text-xs font-medium">Nhấn để chọn ảnh</p>
                                        <p className="text-[10px]">JPG, PNG, WebP — tối đa 20 MB</p>
                                    </div>
                                )}
                                {/* Compression overlay */}
                                {imageCompressing && (
                                    <div className="absolute inset-0 bg-white/85 flex flex-col items-center justify-center gap-2">
                                        <div className="w-5 h-5 border-2 border-accent-500 border-t-transparent rounded-full animate-spin" />
                                        <p className="text-xs font-bold text-accent-700">Đang nén ảnh...</p>
                                    </div>
                                )}
                                {/* Upload overlay */}
                                {!imageCompressing && uploadStatus === 'uploading' && (
                                    <div className="absolute inset-0 bg-white/85 flex flex-col items-center justify-center gap-2">
                                        <div className="w-5 h-5 border-2 border-primary-500 border-t-transparent rounded-full animate-spin" />
                                        <p className="text-xs font-bold text-primary-700">Đang tải lên... {uploadProgress}%</p>
                                        <div className="w-3/4 bg-surface-200 rounded-full h-1.5">
                                            <div className="bg-primary-500 h-1.5 rounded-full transition-all" style={{ width: `${uploadProgress}%` }} />
                                        </div>
                                    </div>
                                )}
                            </div>
                            {/* Hidden input */}
                            <input
                                ref={fileInputRef}
                                type="file"
                                accept="image/jpeg,image/png,image/webp"
                                className="hidden"
                                onChange={handleImageSelect}
                            />
                            {/* Action row */}
                            <div className="flex items-center justify-between mt-2">
                                <button
                                    type="button"
                                    onClick={() => fileInputRef.current?.click()}
                                    disabled={imageCompressing || submitting}
                                    className="text-xs font-medium text-accent-600 hover:text-accent-800 flex items-center gap-1 disabled:opacity-40"
                                >
                                    <ImagePlus className="w-3.5 h-3.5" />
                                    {imagePreview ? 'Đổi ảnh' : 'Chọn ảnh'}
                                </button>
                                {imagePreview && (
                                    <button
                                        type="button"
                                        onClick={resetImageState}
                                        className="text-xs text-danger-400 hover:text-danger-600"
                                    >
                                        Xóa ảnh
                                    </button>
                                )}
                            </div>
                            {/* Feedback message */}
                            {imageMsg && (
                                <p className={cn('text-xs mt-1.5 flex items-center gap-1', imageMsg.type === 'err' ? 'text-danger-600' : 'text-success-600')}>
                                    {imageMsg.type === 'err' ? <AlertCircle className="w-3 h-3" /> : <CheckCircle2 className="w-3 h-3" />}
                                    {imageMsg.text}
                                </p>
                            )}
                        </div>

                        {/* Reward Config */}
                        <div>
                            <h3 className="text-sm font-bold text-surface-700 flex items-center gap-2 mb-3 pb-2 border-b border-surface-100">
                                <Gift className="w-4 h-4 text-accent-500" />
                                Cấu hình thưởng
                            </h3>
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-1.5">
                                    <label htmlFor="v-rtype" className="text-sm font-medium text-surface-700">Loại thưởng *</label>
                                    <select
                                        id="v-rtype" value={rewardType} onChange={e => setRewardType(e.target.value as VoucherRewardType)}
                                        className="w-full bg-surface-50 border border-surface-200 text-sm rounded-lg focus:ring-accent-500 focus:border-accent-400 block p-2.5"
                                    >
                                        {Object.entries(REWARD_LABELS).map(([k, v]) => (
                                            <option key={k} value={k}>{v}</option>
                                        ))}
                                    </select>
                                </div>
                                <div className="space-y-1.5">
                                    <label htmlFor="v-rval" className="text-sm font-medium text-surface-700">Giá trị *</label>
                                    <input
                                        id="v-rval" type="number" min={0} required
                                        value={rewardValue} onChange={e => setRewardValue(Number(e.target.value))}
                                        placeholder={rewardType === 'discount_percent' ? 'VD: 10' : 'VD: 50000'}
                                        className="w-full bg-surface-50 border border-surface-200 text-sm rounded-lg focus:ring-accent-500 focus:border-accent-400 block p-2.5"
                                    />
                                </div>
                            </div>
                        </div>

                        {/* Validity */}
                        <div>
                            <h3 className="text-sm font-bold text-surface-700 flex items-center gap-2 mb-3 pb-2 border-b border-surface-100">
                                <CalendarDays className="w-4 h-4 text-accent-500" />
                                Thời hạn hiệu lực
                            </h3>
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-1.5">
                                    <label htmlFor="v-from" className="text-sm font-medium text-surface-700">Từ ngày *</label>
                                    <input
                                        id="v-from" type="date" required value={validFrom}
                                        onChange={e => setValidFrom(e.target.value)}
                                        className="w-full bg-surface-50 border border-surface-200 text-sm rounded-lg focus:ring-accent-500 focus:border-accent-400 block p-2.5"
                                    />
                                </div>
                                <div className="space-y-1.5">
                                    <label htmlFor="v-to" className="text-sm font-medium text-surface-700">Đến ngày *</label>
                                    <input
                                        id="v-to" type="date" required value={validTo}
                                        onChange={e => setValidTo(e.target.value)}
                                        className="w-full bg-surface-50 border border-surface-200 text-sm rounded-lg focus:ring-accent-500 focus:border-accent-400 block p-2.5"
                                    />
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Right Column */}
                    <div className="space-y-5">
                        {/* Code Structure */}
                        <div>
                            <h3 className="text-sm font-bold text-surface-700 flex items-center gap-2 mb-3 pb-2 border-b border-surface-100">
                                <Sparkles className="w-4 h-4 text-accent-500" />
                                Cấu trúc mã
                            </h3>
                            <div className="space-y-4">
                                <div className="grid grid-cols-3 gap-3">
                                    <div className="space-y-1.5">
                                        <label htmlFor="v-prefix" className="text-sm font-medium text-surface-700">Tiền tố</label>
                                        <input
                                            id="v-prefix" value={prefix} onChange={e => setPrefix(e.target.value)}
                                            placeholder="SUMMER"
                                            className="w-full bg-surface-50 border border-surface-200 text-sm rounded-lg focus:ring-accent-500 focus:border-accent-400 block p-2.5 uppercase"
                                        />
                                    </div>
                                    <div className="space-y-1.5">
                                        <label htmlFor="v-len" className="text-sm font-medium text-surface-700">Độ dài ngẫu nhiên</label>
                                        <input
                                            id="v-len" type="number" min={4} max={12}
                                            value={codeLength} onChange={e => setCodeLength(Number(e.target.value))}
                                            className="w-full bg-surface-50 border border-surface-200 text-sm rounded-lg focus:ring-accent-500 focus:border-accent-400 block p-2.5"
                                        />
                                    </div>
                                    <div className="space-y-1.5">
                                        <label htmlFor="v-suffix" className="text-sm font-medium text-surface-700">Hậu tố</label>
                                        <input
                                            id="v-suffix" value={suffix} onChange={e => setSuffix(e.target.value)}
                                            placeholder="26"
                                            className="w-full bg-surface-50 border border-surface-200 text-sm rounded-lg focus:ring-accent-500 focus:border-accent-400 block p-2.5 uppercase"
                                        />
                                    </div>
                                </div>

                                {/* Live Preview */}
                                <div className="bg-surface-50 border border-dashed border-surface-300 rounded-xl p-4 text-center">
                                    <p className="text-xs text-surface-500 mb-1.5">Xem trước mã</p>
                                    <p className="text-xl font-mono font-black text-accent-600 tracking-wider">{previewCode}</p>
                                    <p className="text-[10px] text-surface-400 mt-1">Phần ngẫu nhiên sẽ khác nhau cho mỗi mã</p>
                                </div>
                            </div>
                        </div>

                        {/* Quantity */}
                        <div>
                            <h3 className="text-sm font-bold text-surface-700 flex items-center gap-2 mb-3 pb-2 border-b border-surface-100">
                                <Hash className="w-4 h-4 text-accent-500" />
                                Số lượng phát hành
                            </h3>
                            <div className="space-y-1.5">
                                <label htmlFor="v-qty" className="text-sm font-medium text-surface-700">Số lượng mã *</label>
                                <input
                                    id="v-qty" type="number" min={1} max={1000000} required
                                    value={quantity} onChange={e => setQuantity(Number(e.target.value))}
                                    className="w-full bg-surface-50 border border-surface-200 text-sm rounded-lg focus:ring-accent-500 focus:border-accent-400 block p-2.5"
                                />
                                <p className="text-xs text-surface-400">Tối đa 1.000.000 mã mỗi lần. Mã được tạo tự động và đảm bảo không trùng lặp.</p>
                            </div>
                        </div>

                        {/* Summary Box */}
                        <div className="bg-accent-50/50 border border-accent-200 rounded-xl p-4 space-y-2">
                            <p className="text-sm font-bold text-accent-700">Tóm tắt</p>
                            <div className="text-xs text-accent-600 space-y-1">
                                <p>• Thưởng: <strong>{REWARD_LABELS[rewardType]}</strong> — giá trị: <strong>{rewardValue}</strong></p>
                                <p>• Số lượng: <strong>{quantity.toLocaleString()}</strong> mã</p>
                                <p>• Hiệu lực: {validFrom || '—'} → {validTo || '—'}</p>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Submit */}
                <div className="flex justify-end pt-4 border-t border-surface-100">
                    <button
                        type="submit"
                        disabled={submitting || imageCompressing}
                        className="flex items-center gap-2 bg-surface-800 hover:bg-surface-900 disabled:bg-surface-300 disabled:cursor-not-allowed text-white px-6 py-3 rounded-xl font-semibold shadow-sm transition-colors"
                    >
                        {submitting ? (
                            <>
                                <Loader2 className="w-4 h-4 animate-spin" />
                                {uploadStatus === 'uploading' ? `Đang tải ảnh... ${uploadProgress}%` : `Đang tạo ${quantity.toLocaleString()} mã...`}
                            </>
                        ) : (
                            <>
                                <Plus className="w-4 h-4" />
                                Tạo chiến dịch & Phát hành mã
                            </>
                        )}
                    </button>
                </div>
            </form>
        </div>
        {/* end create form */}

        {(() => {
            // ── Campaign code counts helper (uses server-side stats) ──────
            const getCampaignCounts = (cid: string) => {
                const stats = campaignStats[cid];
                return stats || { total: 0, available: 0, distributed: 0, used: 0, revoked: 0 };
            };

            const CAMP_STATUS_BADGE: Record<string, string> = {
                active: 'bg-success-50 text-success-700 border-success-200',
                paused: 'bg-warning-50 text-warning-700 border-warning-200',
                ended: 'bg-surface-100 text-surface-600 border-surface-200',
            };
            const CAMP_STATUS_LABELS: Record<string, string> = {
                active: 'Hoạt động',
                paused: 'Tạm dừng',
                ended: 'Kết thúc',
            };
            const PURPOSE_BADGE: Record<string, string> = {
                event: 'bg-primary-50 text-primary-700 border-primary-200',
                print: 'bg-accent-50 text-accent-700 border-accent-200',
            };
            const PURPOSE_LABELS: Record<string, string> = {
                event: 'Sự kiện',
                print: 'In ấn',
            };

            // Excel export handler for print campaigns (with actual QR images)
            const handleExportExcel = async (camp: VoucherCampaign) => {
                try {
                    const qrMod = await import('qrcode');
                    const QRCode = qrMod.default || qrMod;
                    const excelMod = await import('exceljs');
                    const ExcelJS = excelMod.default || excelMod;

                    // Fetch all codes for this campaign via paginated API
                    const token = await getToken();
                    const campCodes: VoucherCode[] = [];
                    let afterCursor: string | null = null;
                    let hasMore = true;
                    while (hasMore) {
                        const params = new URLSearchParams({ mode: 'codes', campaignId: camp.id, pageSize: '100' });
                        if (afterCursor) params.set('after', afterCursor);
                        const res = await fetch(`/api/vouchers?${params}`, {
                            headers: { Authorization: `Bearer ${token}` },
                        });
                        const data = await res.json();
                        campCodes.push(...(data.codes || []));
                        afterCursor = data.lastDocId;
                        hasMore = data.hasMore;
                    }

                    const workbook = new ExcelJS.Workbook();
                    workbook.creator = 'Voucher Manager';
                    const ws = workbook.addWorksheet('Vouchers');

                    // Define columns
                    const headers = ['Mã Voucher', 'Trạng thái', 'Loại thưởng', 'Giá trị', 'Hết hạn', 'SĐT nhận', 'Ngày phát', 'Ngày dùng', 'QR Code'];
                    const headerRow = ws.addRow(headers);
                    headerRow.font = { bold: true, size: 11 };
                    headerRow.alignment = { horizontal: 'center', vertical: 'middle' };
                    headerRow.height = 24;

                    // Column widths
                    ws.columns = [
                        { width: 25 }, { width: 12 }, { width: 16 }, { width: 10 },
                        { width: 14 }, { width: 15 }, { width: 18 }, { width: 18 }, { width: 18 },
                    ];

                    const statusLabels: Record<string, string> = {
                        available: 'Có sẵn', distributed: 'Đã phát', used: 'Đã dùng', revoked: 'Thu hồi', expired: 'Hết hạn',
                    };

                    const QR_SIZE = 100; // pixels
                    const ROW_HEIGHT = 80; // Excel row height in points

                    for (let i = 0; i < campCodes.length; i++) {
                        const code = campCodes[i];
                        const rowNum = i + 2; // 1-indexed, header is row 1

                        const row = ws.addRow([
                            code.id,
                            statusLabels[code.status] || code.status,
                            REWARD_LABELS[code.rewardType] || code.rewardType,
                            code.rewardValue,
                            code.validTo,
                            code.distributedToPhone || '',
                            code.distributedAt || '',
                            code.usedAt || '',
                            '', // QR placeholder
                        ]);
                        row.height = ROW_HEIGHT;
                        row.alignment = { vertical: 'middle' };

                        // Generate QR as base64
                        const qrDataUrl = await QRCode.toDataURL(code.id, {
                            width: QR_SIZE,
                            margin: 1,
                        });
                        const base64Data = qrDataUrl.replace(/^data:image\/png;base64,/, '');

                        // Add image to workbook
                        const imageId = workbook.addImage({
                            base64: base64Data,
                            extension: 'png',
                        });

                        // Place image in column I (index 8)
                        ws.addImage(imageId, {
                            tl: { col: 8, row: rowNum - 1 },
                            ext: { width: QR_SIZE, height: QR_SIZE },
                        });
                    }

                    // Style header cells
                    headerRow.eachCell(cell => {
                        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF2D3436' } };
                        cell.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 11 };
                        cell.border = {
                            bottom: { style: 'thin', color: { argb: 'FFCCCCCC' } },
                        };
                    });

                    // Write to file
                    const buffer = await workbook.xlsx.writeBuffer();
                    const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    const safeName = camp.name.replace(/[^\w\sÀ-ỹ]/g, '').slice(0, 25);
                    a.href = url;
                    a.download = `Voucher_${safeName}_${new Date().toISOString().slice(0, 10)}.xlsx`;
                    a.click();
                    URL.revokeObjectURL(url);
                } catch (err) {
                    onError(err instanceof Error ? err.message : 'Lỗi xuất Excel');
                }
            };

            if (campaigns.length === 0) return null;
            return (
                <div className="bg-white rounded-2xl border border-surface-200 shadow-sm overflow-hidden">
                    <div className="px-6 py-5 border-b border-surface-100">
                        <h2 className="text-lg font-bold text-surface-800 flex items-center gap-2">
                            <Megaphone className="w-5 h-5 text-accent-500" />
                            Danh sách chiến dịch ({campaigns.length})
                        </h2>
                        <p className="text-sm text-surface-500 mt-1">Quản lý, thêm mã, bật/tắt chiến dịch</p>
                    </div>
                    <div className="divide-y divide-surface-100">
                        {campaigns.map(camp => {
                            const counts = getCampaignCounts(camp.id);
                            const isAdding = addingCodesFor === camp.id;
                            const isLoading = actionLoading === camp.id;
                            return (
                                <div key={camp.id} className="px-6 py-4 hover:bg-surface-50/50 transition-colors">
                                    <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                                        {/* Info */}
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-2 mb-1">
                                                <p className="font-bold text-surface-800 truncate">{camp.name}</p>
                                                <span className={cn('text-[11px] font-bold px-2 py-0.5 rounded border', CAMP_STATUS_BADGE[camp.status] || CAMP_STATUS_BADGE.ended)}>
                                                    {CAMP_STATUS_LABELS[camp.status] || camp.status}
                                                </span>
                                                <span className={cn('text-[11px] font-bold px-2 py-0.5 rounded border', PURPOSE_BADGE[camp.purpose || 'event'])}>
                                                    {(camp.purpose || 'event') === 'print' ? <Printer className="w-3 h-3 inline mr-0.5" /> : <Dices className="w-3 h-3 inline mr-0.5" />}
                                                    {PURPOSE_LABELS[camp.purpose || 'event']}
                                                </span>
                                            </div>
                                            <div className="flex items-center gap-4 text-xs text-surface-500">
                                                <span className="flex items-center gap-1">
                                                    <Tag className="w-3 h-3" />
                                                    {REWARD_LABELS[camp.rewardType]} • {camp.rewardValue}
                                                </span>
                                                <span className="flex items-center gap-1">
                                                    <Hash className="w-3 h-3" />
                                                    {counts.total} mã
                                                    <span className="text-success-600">({counts.available} có sẵn)</span>
                                                </span>
                                                <span>
                                                    {camp.validFrom} → {camp.validTo}
                                                </span>
                                            </div>
                                        </div>

                                        {/* Actions */}
                                        <div className="flex items-center gap-2 shrink-0">
                                            <button
                                                onClick={() => {
                                                    if (editingCampaignId === camp.id) { setEditingCampaignId(null); }
                                                    else { startEditCampaign(camp); }
                                                }}
                                                className={cn(
                                                    'flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg border transition-colors',
                                                    editingCampaignId === camp.id
                                                        ? 'bg-violet-100 text-violet-700 border-violet-300'
                                                        : 'bg-surface-50 text-surface-600 border-surface-200 hover:bg-violet-50 hover:text-violet-700 hover:border-violet-200'
                                                )}
                                            >
                                                <Pencil className="w-3.5 h-3.5" />
                                                Sửa
                                            </button>
                                            {(camp.purpose === 'print') && (
                                                <button
                                                    onClick={() => handleExportExcel(camp)}
                                                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg border bg-primary-50 text-primary-700 border-primary-200 hover:bg-primary-100 transition-colors"
                                                >
                                                    <FileDown className="w-3.5 h-3.5" />
                                                    Xuất Excel
                                                </button>
                                            )}
                                            <button
                                                onClick={() => {
                                                    if (isAdding) { setAddingCodesFor(null); }
                                                    else { setAddingCodesFor(camp.id); setAddQty(100); }
                                                }}
                                                className={cn(
                                                    'flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg border transition-colors',
                                                    isAdding
                                                        ? 'bg-accent-100 text-accent-700 border-accent-300'
                                                        : 'bg-surface-50 text-surface-600 border-surface-200 hover:bg-accent-50 hover:text-accent-700 hover:border-accent-200'
                                                )}
                                            >
                                                <PlusCircle className="w-3.5 h-3.5" />
                                                Thêm mã
                                            </button>
                                            <button
                                                onClick={() => {
                                                    if (updatingExpiryFor === camp.id) { setUpdatingExpiryFor(null); }
                                                    else { setUpdatingExpiryFor(camp.id); setNewValidTo(camp.validTo); }
                                                }}
                                                className={cn(
                                                    'flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg border transition-colors',
                                                    updatingExpiryFor === camp.id
                                                        ? 'bg-primary-100 text-primary-700 border-primary-300'
                                                        : 'bg-surface-50 text-surface-600 border-surface-200 hover:bg-primary-50 hover:text-primary-700 hover:border-primary-200'
                                                )}
                                            >
                                                <CalendarDays className="w-3.5 h-3.5" />
                                                Gia hạn
                                            </button>
                                            {/* ── Thiết kế vé (chỉ in ấn) */}
                                            {camp.purpose === 'print' && (
                                                <button
                                                    onClick={() => onDesign(camp)}
                                                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg border transition-colors bg-violet-50 text-violet-700 border-violet-200 hover:bg-violet-100"
                                                >
                                                    <Palette className="w-3.5 h-3.5" />
                                                    Thiết kế vé
                                                </button>
                                            )}
                                            <button
                                                onClick={() => handleToggleCampaign(camp.id, camp.status)}
                                                disabled={isLoading}
                                                className={cn(
                                                    'flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg border transition-colors disabled:opacity-50',
                                                    camp.status === 'active'
                                                        ? 'bg-warning-50 text-warning-700 border-warning-200 hover:bg-warning-100'
                                                        : 'bg-success-50 text-success-700 border-success-200 hover:bg-success-100'
                                                )}
                                            >
                                                {isLoading ? (
                                                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                                ) : camp.status === 'active' ? (
                                                    <Pause className="w-3.5 h-3.5" />
                                                ) : (
                                                    <Play className="w-3.5 h-3.5" />
                                                )}
                                                {camp.status === 'active' ? 'Tạm dừng' : 'Kích hoạt'}
                                            </button>
                                        </div>
                                    </div>

                                    {/* Inline Add Codes Form */}
                                    {isAdding && (
                                        <div className="mt-3 flex items-center gap-3 bg-accent-50/50 border border-accent-200 rounded-xl p-3 animate-in slide-in-from-top-1 duration-200">
                                            <label className="text-xs font-medium text-accent-700 whitespace-nowrap">Số lượng:</label>
                                            <input
                                                type="number" min={1} max={1000000}
                                                value={addQty}
                                                onChange={e => setAddQty(Number(e.target.value))}
                                                className="w-28 bg-white border border-accent-200 text-sm rounded-lg p-2 focus:ring-accent-500 focus:border-accent-400"
                                            />
                                            <button
                                                onClick={() => handleAddCodes(camp.id)}
                                                disabled={isLoading}
                                                className="flex items-center gap-1.5 px-4 py-2 bg-surface-800 hover:bg-surface-900 disabled:bg-surface-300 text-white text-xs font-semibold rounded-lg transition-colors"
                                            >
                                                {isLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
                                                Tạo thêm
                                            </button>
                                            <button
                                                onClick={() => setAddingCodesFor(null)}
                                                className="text-xs text-surface-400 hover:text-surface-600"
                                            >
                                                Hủy
                                            </button>
                                        </div>
                                    )}

                                    {/* Inline Update Expiry Form */}
                                    {updatingExpiryFor === camp.id && (
                                        <div className="mt-3 flex items-center gap-3 bg-primary-50/50 border border-primary-200 rounded-xl p-3 animate-in slide-in-from-top-1 duration-200">
                                            <label className="text-xs font-medium text-primary-700 whitespace-nowrap">Ngày hết hạn mới:</label>
                                            <input
                                                type="date"
                                                value={newValidTo}
                                                onChange={e => setNewValidTo(e.target.value)}
                                                className="w-40 bg-white border border-primary-200 text-sm rounded-lg p-2 focus:ring-primary-500 focus:border-primary-400"
                                            />
                                            <button
                                                onClick={() => handleUpdateExpiry(camp.id)}
                                                disabled={isLoading}
                                                className="flex items-center gap-1.5 px-4 py-2 bg-primary-600 hover:bg-primary-700 disabled:bg-surface-300 text-white text-xs font-semibold rounded-lg transition-colors"
                                            >
                                                {isLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CalendarDays className="w-3.5 h-3.5" />}
                                                Cập nhật
                                            </button>
                                            <button
                                                onClick={() => setUpdatingExpiryFor(null)}
                                                className="text-xs text-surface-400 hover:text-surface-600"
                                            >
                                                Hủy
                                            </button>
                                        </div>
                                    )}

                                    {/* Inline Edit Campaign Form */}
                                    {editingCampaignId === camp.id && (
                                        <div className="mt-3 bg-violet-50/50 border border-violet-200 rounded-xl p-4 animate-in slide-in-from-top-1 duration-200 space-y-4">
                                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                                <div className="space-y-1.5">
                                                    <label className="text-xs font-semibold text-violet-700">Tên chiến dịch</label>
                                                    <input
                                                        value={editForm.name}
                                                        onChange={e => setEditForm(p => ({ ...p, name: e.target.value }))}
                                                        className="w-full bg-white border border-violet-200 text-sm rounded-lg p-2.5 focus:ring-violet-500 focus:border-violet-400"
                                                    />
                                                </div>
                                                <div className="space-y-1.5">
                                                    <label className="text-xs font-semibold text-violet-700">Mục đích</label>
                                                    <select
                                                        value={editForm.purpose}
                                                        onChange={e => setEditForm(p => ({ ...p, purpose: e.target.value as VoucherCampaignPurpose }))}
                                                        className="w-full bg-white border border-violet-200 text-sm rounded-lg p-2.5 focus:ring-violet-500 focus:border-violet-400"
                                                    >
                                                        <option value="event">Sự kiện</option>
                                                        <option value="print">In ấn</option>
                                                    </select>
                                                </div>
                                                <div className="space-y-1.5">
                                                    <label className="text-xs font-semibold text-violet-700">Loại thưởng</label>
                                                    <select
                                                        value={editForm.rewardType}
                                                        onChange={e => setEditForm(p => ({ ...p, rewardType: e.target.value as VoucherRewardType }))}
                                                        className="w-full bg-white border border-violet-200 text-sm rounded-lg p-2.5 focus:ring-violet-500 focus:border-violet-400"
                                                    >
                                                        {Object.entries(REWARD_LABELS).map(([k, v]) => (
                                                            <option key={k} value={k}>{v}</option>
                                                        ))}
                                                    </select>
                                                </div>
                                                <div className="space-y-1.5">
                                                    <label className="text-xs font-semibold text-violet-700">Giá trị thưởng</label>
                                                    <input
                                                        type="number" min={0}
                                                        value={editForm.rewardValue}
                                                        onChange={e => setEditForm(p => ({ ...p, rewardValue: Number(e.target.value) }))}
                                                        className="w-full bg-white border border-violet-200 text-sm rounded-lg p-2.5 focus:ring-violet-500 focus:border-violet-400"
                                                    />
                                                </div>
                                                <div className="space-y-1.5">
                                                    <label className="text-xs font-semibold text-violet-700">Từ ngày</label>
                                                    <input
                                                        type="date"
                                                        value={editForm.validFrom}
                                                        onChange={e => setEditForm(p => ({ ...p, validFrom: e.target.value }))}
                                                        className="w-full bg-white border border-violet-200 text-sm rounded-lg p-2.5 focus:ring-violet-500 focus:border-violet-400"
                                                    />
                                                </div>
                                                <div className="space-y-1.5">
                                                    <label className="text-xs font-semibold text-violet-700">Đến ngày</label>
                                                    <input
                                                        type="date"
                                                        value={editForm.validTo}
                                                        onChange={e => setEditForm(p => ({ ...p, validTo: e.target.value }))}
                                                        className="w-full bg-white border border-violet-200 text-sm rounded-lg p-2.5 focus:ring-violet-500 focus:border-violet-400"
                                                    />
                                                </div>
                                                <div className="sm:col-span-2 space-y-1.5">
                                                    <label className="text-xs font-semibold text-violet-700">Mô tả</label>
                                                    <textarea
                                                        value={editForm.description}
                                                        onChange={e => setEditForm(p => ({ ...p, description: e.target.value }))}
                                                        rows={2}
                                                        className="w-full bg-white border border-violet-200 text-sm rounded-lg p-2.5 focus:ring-violet-500 focus:border-violet-400 resize-none"
                                                    />
                                                </div>
                                            </div>

                                            {/* Image upload zone */}
                                            <div className="space-y-1.5">
                                                <label className="text-xs font-semibold text-violet-700">Hình ảnh chiến dịch</label>
                                                <div className="flex items-center gap-4">
                                                    <div
                                                        onClick={() => !editImageCompressing && editFileInputRef.current?.click()}
                                                        className={cn(
                                                            'relative w-28 h-20 rounded-lg border-2 border-dashed overflow-hidden flex items-center justify-center cursor-pointer transition-colors shrink-0',
                                                            editImageCompressing
                                                                ? 'border-violet-300 bg-violet-50'
                                                                : 'border-violet-200 bg-white hover:border-violet-400'
                                                        )}
                                                    >
                                                        {editImagePreview ? (
                                                            <img src={editImagePreview} alt="preview" className="w-full h-full object-contain" />
                                                        ) : (
                                                            <div className="flex flex-col items-center gap-1 text-surface-400">
                                                                <ImagePlus className="w-5 h-5" />
                                                                <p className="text-[9px] font-medium">Chọn ảnh</p>
                                                            </div>
                                                        )}
                                                        {editImageCompressing && (
                                                            <div className="absolute inset-0 bg-white/85 flex items-center justify-center">
                                                                <div className="w-4 h-4 border-2 border-violet-500 border-t-transparent rounded-full animate-spin" />
                                                            </div>
                                                        )}
                                                    </div>
                                                    <div className="flex flex-col gap-1.5">
                                                        <button
                                                            type="button"
                                                            onClick={() => editFileInputRef.current?.click()}
                                                            disabled={editImageCompressing}
                                                            className="text-xs font-medium text-violet-600 hover:text-violet-800 flex items-center gap-1 disabled:opacity-40"
                                                        >
                                                            <Upload className="w-3 h-3" />
                                                            {editImagePreview ? 'Đổi ảnh' : 'Tải ảnh lên'}
                                                        </button>
                                                        {editImagePreview && (
                                                            <button
                                                                type="button"
                                                                onClick={() => {
                                                                    if (editImagePreview.startsWith('blob:')) URL.revokeObjectURL(editImagePreview);
                                                                    setEditPendingImage(null);
                                                                    setEditImagePreview('');
                                                                    if (editFileInputRef.current) editFileInputRef.current.value = '';
                                                                }}
                                                                className="text-xs text-danger-400 hover:text-danger-600 flex items-center gap-1"
                                                            >
                                                                <XIcon className="w-3 h-3" />
                                                                Xóa ảnh
                                                            </button>
                                                        )}
                                                    </div>
                                                </div>
                                                <input
                                                    ref={editFileInputRef}
                                                    type="file"
                                                    accept="image/jpeg,image/png,image/webp"
                                                    className="hidden"
                                                    onChange={handleEditImageSelect}
                                                />
                                            </div>

                                            <div className="flex items-center gap-3 pt-1">
                                                <button
                                                    onClick={handleUpdateCampaign}
                                                    disabled={actionLoading === camp.id || !editForm.name.trim()}
                                                    className="flex items-center gap-1.5 px-4 py-2 bg-violet-600 hover:bg-violet-700 disabled:bg-surface-300 text-white text-xs font-semibold rounded-lg transition-colors"
                                                >
                                                    {actionLoading === camp.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                                                    Lưu thay đổi
                                                </button>
                                                <button
                                                    onClick={() => setEditingCampaignId(null)}
                                                    className="text-xs text-surface-400 hover:text-surface-600"
                                                >
                                                    Hủy
                                                </button>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                </div>
            );
        })()}
        {/* Batch Progress Modal */}
        <BatchProgressModal
            state={batch}
            onClose={() => { batch.reset(); fetchData(); }}
            title={batchTitle}
        />
        </>
    );
}

// ═════════════════════════════════════════════════════════════════
// TAB 3: CODE INVENTORY (cursor-paginated, server-side filtered)
// ═════════════════════════════════════════════════════════════════
function CodeInventoryTab({
    campaigns,
    getToken,
    onRevoke,
    onError,
    onBulkEmail,
}: {
    campaigns: VoucherCampaign[];
    getToken: () => Promise<string | undefined>;
    onRevoke: () => void;
    onError: (msg: string) => void;
    onBulkEmail: (campaign: VoucherCampaign, tpl: TicketTemplateConfig) => void;
}) {
    const [debouncedSearch, setDebouncedSearch] = useState('');
    const [filterCampaign, setFilterCampaign] = useState('');
    const [filterStatus, setFilterStatus] = useState('');
    const [filterRewardType, setFilterRewardType] = useState('');
    const [revoking, setRevoking] = useState(false);
    const [selected, setSelected] = useState<Set<string>>(new Set());

    // Sort state
    type SortKey = 'id' | 'campaignName' | 'reward' | 'status' | 'phone' | 'validTo' | 'usedAt' | 'staff';
    const [sortKey, setSortKey] = useState<SortKey | null>(null);
    const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');

    const handleSort = (key: SortKey) => {
        if (sortKey === key) {
            setSortDir(prev => prev === 'asc' ? 'desc' : 'asc');
        } else {
            setSortKey(key);
            setSortDir('asc');
        }
    };

    const SortIcon = ({ col }: { col: SortKey }) => {
        if (sortKey !== col) return <ArrowUpDown className="w-3 h-3 text-surface-300" />;
        return sortDir === 'asc' ? <ArrowUp className="w-3 h-3 text-accent-500" /> : <ArrowDown className="w-3 h-3 text-accent-500" />;
    };

    // Paginated data
    const [codes, setCodes] = useState<(VoucherCode & { usedByStaffName?: string })[]>([]);
    const [lastDocId, setLastDocId] = useState<string | null>(null);
    const [hasMore, setHasMore] = useState(false);
    const [pageLoading, setPageLoading] = useState(false);
    const [initialLoading, setInitialLoading] = useState(true);

    const PAGE_SIZE = 50;

    // Fetch codes (initial or append)
    const fetchCodes = useCallback(async (opts: {
        append?: boolean;
        campaignId?: string;
        status?: string;
        rewardType?: string;
        search?: string;
        after?: string | null;
    } = {}) => {
        const { append = false, after = null } = opts;
        if (!append) setInitialLoading(true);
        else setPageLoading(true);

        try {
            const token = await getToken();
            const params = new URLSearchParams({ mode: 'codes', pageSize: String(PAGE_SIZE) });
            if (opts.campaignId) params.set('campaignId', opts.campaignId);
            if (opts.status) params.set('status', opts.status);
            if (opts.rewardType) params.set('rewardType', opts.rewardType);
            if (opts.search) params.set('search', opts.search);
            if (after) params.set('after', after);

            const res = await fetch(`/api/vouchers?${params}`, {
                headers: { Authorization: `Bearer ${token}` },
            });
            if (!res.ok) throw new Error('Lỗi tải dữ liệu');
            const data = await res.json();

            if (append) {
                setCodes(prev => [...prev, ...(data.codes || [])]);
            } else {
                setCodes(data.codes || []);
            }
            setLastDocId(data.lastDocId || null);
            setHasMore(data.hasMore || false);
        } catch {
            onError('Không thể tải danh sách voucher');
        } finally {
            setInitialLoading(false);
            setPageLoading(false);
        }
    }, [getToken, onError]);

    // Refetch when filters change
    useEffect(() => {
        setSelected(new Set());
        setSortKey(null);
        fetchCodes({
            campaignId: filterCampaign || undefined,
            status: filterStatus || undefined,
            rewardType: filterRewardType || undefined,
            search: debouncedSearch || undefined,
        });
    }, [filterCampaign, filterStatus, filterRewardType, debouncedSearch, fetchCodes]);

    // Load more handler
    const handleLoadMore = () => {
        fetchCodes({
            append: true,
            campaignId: filterCampaign || undefined,
            status: filterStatus || undefined,
            rewardType: filterRewardType || undefined,
            search: debouncedSearch || undefined,
            after: lastDocId,
        });
    };

    // Debounced search
    const searchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const handleSearchChange = (val: string) => {
        if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
        searchTimerRef.current = setTimeout(() => setDebouncedSearch(val), 400);
    };

    // Select helpers
    const toggleSelect = (id: string) => {
        setSelected(prev => {
            const next = new Set(prev);
            next.has(id) ? next.delete(id) : next.add(id);
            return next;
        });
    };
    const toggleSelectAll = () => {
        if (selected.size === codes.length) setSelected(new Set());
        else setSelected(new Set(codes.map(c => c.id)));
    };
    const clearSelection = () => setSelected(new Set());

    const revocableSelected = useMemo(() => {
        return [...selected].filter(id => {
            const c = codes.find(x => x.id === id);
            return c && c.status !== 'used' && c.status !== 'revoked';
        });
    }, [selected, codes]);

    // Sorted codes
    const sortedCodes = useMemo(() => {
        if (!sortKey) return codes;
        const sorted = [...codes].sort((a, b) => {
            let aVal = '';
            let bVal = '';
            switch (sortKey) {
                case 'id': aVal = a.id; bVal = b.id; break;
                case 'campaignName': aVal = a.campaignName || ''; bVal = b.campaignName || ''; break;
                case 'reward': aVal = `${a.rewardType}-${a.rewardValue}`; bVal = `${b.rewardType}-${b.rewardValue}`; break;
                case 'status': aVal = a.status; bVal = b.status; break;
                case 'phone': aVal = a.distributedToPhone || ''; bVal = b.distributedToPhone || ''; break;
                case 'validTo': aVal = a.validTo || ''; bVal = b.validTo || ''; break;
                case 'usedAt': aVal = a.usedAt || ''; bVal = b.usedAt || ''; break;
                case 'staff': aVal = a.usedByStaffName || a.usedByStaffId || ''; bVal = b.usedByStaffName || b.usedByStaffId || ''; break;
            }
            return sortDir === 'asc' ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal);
        });
        return sorted;
    }, [codes, sortKey, sortDir]);

    const handleBulkRevoke = async () => {
        if (revocableSelected.length === 0) return;
        if (!confirm(`Vô hiệu hóa ${revocableSelected.length} mã đã chọn?`)) return;
        setRevoking(true);
        try {
            const token = await getToken();
            const res = await fetch('/api/vouchers', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
                body: JSON.stringify({ codeIds: revocableSelected, action: 'revoke' }),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || 'Thao tác thất bại');
            clearSelection();
            onRevoke();
            fetchCodes({ campaignId: filterCampaign || undefined, status: filterStatus || undefined, rewardType: filterRewardType || undefined, search: debouncedSearch || undefined });
        } catch (err: unknown) {
            onError(err instanceof Error ? err.message : 'Lỗi');
        } finally {
            setRevoking(false);
        }
    };

    const handleSingleRevoke = async (codeId: string) => {
        if (!confirm(`Vô hiệu hóa mã ${codeId}?`)) return;
        setRevoking(true);
        try {
            const token = await getToken();
            const res = await fetch('/api/vouchers', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
                body: JSON.stringify({ codeId, action: 'revoke' }),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || 'Thao tác thất bại');
            onRevoke();
            fetchCodes({ campaignId: filterCampaign || undefined, status: filterStatus || undefined, rewardType: filterRewardType || undefined, search: debouncedSearch || undefined });
        } catch (err: unknown) {
            onError(err instanceof Error ? err.message : 'Lỗi');
        } finally {
            setRevoking(false);
        }
    };

    return (
        <div className="space-y-4">
            {/* Filters */}
            <div className="bg-white rounded-2xl border border-surface-200 shadow-sm p-4">
                <div className="flex flex-col sm:flex-row gap-3">
                    <div className="relative flex-1 inset-0">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-surface-400" />
                        <input
                            defaultValue=""
                            onChange={e => handleSearchChange(e.target.value)}
                            placeholder="Tìm theo mã hoặc số điện thoại..."
                            className="w-full h-full pl-10 pr-4 py-2.5 bg-surface-50 border border-surface-200 text-sm rounded-lg focus:ring-accent-500 focus:border-accent-400"
                        />
                    </div>
                    <select
                        value={filterCampaign}
                        onChange={e => setFilterCampaign(e.target.value)}
                        className="bg-surface-50 border border-surface-200 text-sm rounded-lg focus:ring-accent-500 focus:border-accent-400 p-2.5 min-w-[180px]"
                    >
                        <option value="">Tất cả chiến dịch</option>
                        {campaigns.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                    </select>
                    <select
                        value={filterStatus}
                        onChange={e => setFilterStatus(e.target.value)}
                        className="bg-surface-50 border border-surface-200 text-sm rounded-lg focus:ring-accent-500 focus:border-accent-400 p-2.5 min-w-[140px]"
                    >
                        <option value="">Tất cả trạng thái</option>
                        {Object.entries(STATUS_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                    </select>
                    <select
                        value={filterRewardType}
                        onChange={e => setFilterRewardType(e.target.value)}
                        className="bg-surface-50 border border-surface-200 text-sm rounded-lg focus:ring-accent-500 focus:border-accent-400 p-2.5 min-w-[140px]"
                    >
                        <option value="">Tất cả loại thưởng</option>
                        {Object.entries(REWARD_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                    </select>
                    {/* ── Send Email button for print campaigns */}
                    {(() => {
                        const camp = filterCampaign ? campaigns.find(c => c.id === filterCampaign) : null;
                        if (!camp || camp.purpose !== 'print') return null;
                        return (
                            <button
                                onClick={() => onBulkEmail(camp, camp.ticketTemplate ?? {
                                    bgColor: '#1e293b', accentColor: '#f59e0b',
                                    logoUrl: camp.image || '', title: camp.name,
                                    showExpiry: true, showDescription: true, showRewardValue: true, qrSize: 'md',
                                })}
                                className="flex items-center gap-1.5 px-4 py-2.5 text-sm font-semibold rounded-lg bg-accent-500 hover:bg-accent-600 text-white transition-colors shrink-0"
                            >
                                <Send className="w-4 h-4" />
                                Gửi Email
                            </button>
                        );
                    })()}
                </div>
                <p className="text-xs text-surface-400 mt-2">
                    Hiển thị {codes.length.toLocaleString()} mã
                    {hasMore && ' (còn nữa — bấm "Tải thêm" để xem tiếp)'}
                </p>
            </div>

            {/* Floating Bulk Action Bar */}
            {selected.size > 0 && (
                <div className="sticky top-2 z-20 bg-surface-800 text-white rounded-2xl shadow-xl p-3 flex items-center justify-between gap-4 animate-in slide-in-from-bottom-3 duration-300">
                    <div className="flex items-center gap-3">
                        <div className="flex items-center gap-2 px-3 py-1.5 bg-white/10 rounded-lg">
                            <CheckSquare className="w-4 h-4" />
                            <span className="text-sm font-bold">{selected.size}</span>
                            <span className="text-xs text-white/70">đã chọn</span>
                        </div>
                        <button onClick={clearSelection} className="flex items-center gap-1 text-xs text-white/60 hover:text-white transition-colors">
                            <XIcon className="w-3.5 h-3.5" />
                            Bỏ chọn
                        </button>
                    </div>
                    {revocableSelected.length > 0 && (
                        <button onClick={handleBulkRevoke} disabled={revoking} className="flex items-center gap-2 px-4 py-2 bg-danger-500 hover:bg-danger-600 disabled:bg-danger-400 rounded-xl text-sm font-semibold transition-colors">
                            {revoking ? <Loader2 className="w-4 h-4 animate-spin" /> : <ShieldX className="w-4 h-4" />}
                            Vô hiệu hóa {revocableSelected.length} mã
                        </button>
                    )}
                </div>
            )}

            {/* Table */}
            <div className="bg-white rounded-2xl border border-surface-200 shadow-sm overflow-hidden">
                {initialLoading ? (
                    <div className="p-12 text-center text-surface-400">
                        <div className="w-6 h-6 border-3 border-accent-500 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
                        Đang tải...
                    </div>
                ) : codes.length === 0 ? (
                    <div className="p-12 text-center text-surface-400">
                        <Archive className="w-12 h-12 mx-auto mb-3 opacity-30" />
                        <p className="font-medium">Không tìm thấy mã voucher nào</p>
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm text-left">
                            <thead className="text-xs text-surface-500 bg-surface-50/80 border-b border-surface-100">
                                <tr>
                                    <th className="pl-4 pr-1 py-3.5 w-10">
                                        <button onClick={toggleSelectAll} className="flex items-center justify-center w-5 h-5 rounded transition-colors hover:bg-surface-200">
                                            {selected.size > 0 && selected.size === codes.length
                                                ? <CheckSquare className="w-4 h-4 text-accent-600" />
                                                : <Square className="w-4 h-4 text-surface-400" />}
                                        </button>
                                    </th>
                                    <th className="px-4 py-3.5 font-semibold">
                                        <button onClick={() => handleSort('id')} className="flex items-center gap-1 hover:text-surface-800 transition-colors">
                                            Mã <SortIcon col="id" />
                                        </button>
                                    </th>
                                    <th className="px-4 py-3.5 font-semibold">
                                        <button onClick={() => handleSort('campaignName')} className="flex items-center gap-1 hover:text-surface-800 transition-colors">
                                            Chiến dịch <SortIcon col="campaignName" />
                                        </button>
                                    </th>
                                    <th className="px-4 py-3.5 font-semibold">
                                        <button onClick={() => handleSort('reward')} className="flex items-center gap-1 hover:text-surface-800 transition-colors">
                                            Thưởng <SortIcon col="reward" />
                                        </button>
                                    </th>
                                    <th className="px-4 py-3.5 font-semibold text-center">
                                        <button onClick={() => handleSort('status')} className="flex items-center gap-1 mx-auto hover:text-surface-800 transition-colors">
                                            Trạng thái <SortIcon col="status" />
                                        </button>
                                    </th>
                                    <th className="px-4 py-3.5 font-semibold">
                                        <button onClick={() => handleSort('phone')} className="flex items-center gap-1 hover:text-surface-800 transition-colors">
                                            SĐT nhận <SortIcon col="phone" />
                                        </button>
                                    </th>
                                    <th className="px-4 py-3.5 font-semibold">
                                        <button onClick={() => handleSort('validTo')} className="flex items-center gap-1 hover:text-surface-800 transition-colors">
                                            Hết hạn <SortIcon col="validTo" />
                                        </button>
                                    </th>
                                    <th className="px-4 py-3.5 font-semibold">
                                        <button onClick={() => handleSort('usedAt')} className="flex items-center gap-1 hover:text-surface-800 transition-colors">
                                            Thời gian dùng <SortIcon col="usedAt" />
                                        </button>
                                    </th>
                                    <th className="px-4 py-3.5 font-semibold">
                                        <button onClick={() => handleSort('staff')} className="flex items-center gap-1 hover:text-surface-800 transition-colors">
                                            Người kích hoạt <SortIcon col="staff" />
                                        </button>
                                    </th>
                                    <th className="px-4 py-3.5 font-semibold">Email</th>
                                    <th className="px-4 py-3.5 font-semibold text-right">Thao tác</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-surface-100">
                                {sortedCodes.map(c => {
                                    const isSelected = selected.has(c.id);
                                    const canRevoke = c.status === 'available' || c.status === 'distributed';
                                    return (
                                        <tr key={c.id} className={cn('transition-colors group', isSelected ? 'bg-accent-50/40' : 'hover:bg-surface-50/60')}>
                                            <td className="pl-4 pr-1 py-3.5">
                                                <button onClick={() => toggleSelect(c.id)} className="flex items-center justify-center w-5 h-5 rounded transition-colors hover:bg-surface-200">
                                                    {isSelected ? <CheckSquare className="w-4 h-4 text-accent-600" /> : <Square className="w-4 h-4 text-surface-300 group-hover:text-surface-500" />}
                                                </button>
                                            </td>
                                            <td className="px-4 py-3.5 font-mono font-bold text-surface-800 text-xs tracking-wide">{c.id}</td>
                                            <td className="px-4 py-3.5 text-surface-600 text-xs">{c.campaignName || c.campaignId}</td>
                                            <td className="px-4 py-3.5">
                                                <span className="text-xs font-semibold text-accent-700">{REWARD_LABELS[c.rewardType]} • {c.rewardValue}</span>
                                            </td>
                                            <td className="px-4 py-3.5 text-center">
                                                <span className={cn('text-[11px] font-bold px-2 py-0.5 rounded border', STATUS_BADGE[c.status])}>{STATUS_LABELS[c.status]}</span>
                                            </td>
                                            <td className="px-4 py-3.5 text-surface-500 font-mono text-xs">{c.distributedToPhone || <span className="text-surface-300">—</span>}</td>
                                            <td className="px-4 py-3.5 text-surface-500 text-xs">{c.validTo}</td>
                                            <td className="px-4 py-3.5 text-surface-500 text-xs">
                                                {c.usedAt ? new Date(c.usedAt).toLocaleString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : <span className="text-surface-300">—</span>}
                                            </td>
                                            <td className="px-4 py-3.5 text-surface-500 text-xs">
                                                {c.usedByStaffName || c.usedByStaffId ? <span className="font-medium text-surface-700">{c.usedByStaffName || c.usedByStaffId}</span> : <span className="text-surface-300">—</span>}
                                            </td>
                                            {/* Email status column */}
                                            <td className="px-4 py-3.5">
                                                {c.emailedAt ? (
                                                    <div className="flex flex-col gap-0.5">
                                                        <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-success-600 bg-success-50 border border-success-200 rounded-full px-2 py-0.5 w-fit">
                                                            <MailCheck className="w-3 h-3" /> Đã gửi
                                                        </span>
                                                        <span className="text-[10px] text-surface-400 truncate max-w-[120px]" title={c.emailedTo || ''}>{c.emailedTo}</span>
                                                    </div>
                                                ) : (
                                                    <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-surface-400 bg-surface-100 rounded-full px-2 py-0.5">
                                                        <Mail className="w-3 h-3" /> Chưa gửi
                                                    </span>
                                                )}
                                            </td>
                                            <td className="px-4 py-3.5 text-right">
                                                {canRevoke && (
                                                    <button onClick={() => handleSingleRevoke(c.id)} disabled={revoking}
                                                        className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-danger-50 text-danger-600 hover:bg-danger-100 border border-danger-200 transition-colors disabled:opacity-50 opacity-0 group-hover:opacity-100">
                                                        <ShieldX className="w-3.5 h-3.5" />
                                                        Vô hiệu hóa
                                                    </button>
                                                )}
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                )}

                {/* Load More */}
                {hasMore && (
                    <div className="flex items-center justify-center px-5 py-4 border-t border-surface-100">
                        <button onClick={handleLoadMore} disabled={pageLoading}
                            className="flex items-center gap-2 px-6 py-2.5 bg-surface-800 hover:bg-surface-900 disabled:bg-surface-300 text-white text-sm font-semibold rounded-xl transition-colors">
                            {pageLoading ? (
                                <><Loader2 className="w-4 h-4 animate-spin" /> Đang tải...</>
                            ) : (
                                <><Plus className="w-4 h-4" /> Tải thêm {PAGE_SIZE} mã</>
                            )}
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
}

