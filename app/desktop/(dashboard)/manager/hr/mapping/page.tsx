'use client';

/**
 * /manager/hr/mapping
 *
 * Mapping Hub — resolves ZKTeco device users to ERP system users.
 *
 * Features:
 * - Sync button (POST /api/hr/sync-users)
 * - Auto-Match (Vietnamese-accent-normalized fuzzy match)
 * - Manual searchable dropdown per row
 * - Ignore/Archive action
 * - Filter: show/hide ignored rows
 */

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { db } from '@/lib/firebase';
import { collection, onSnapshot } from 'firebase/firestore';
import { ZkUserDoc, UserDoc } from '@/types';
import {
    Link2, RefreshCw, Zap, Eye, EyeOff, CheckCircle2,
    XCircle, AlertCircle, Search, ChevronDown, UserCheck, X,
} from 'lucide-react';
import { cn } from '@/lib/utils';

// ─────────────────────────────────────────────────────────────────────────────
// Vietnamese accent normalization fuzzy matcher
// ─────────────────────────────────────────────────────────────────────────────

const VI_MAP: Record<string, string> = {
    à: 'a', á: 'a', ả: 'a', ã: 'a', ạ: 'a',
    ă: 'a', ằ: 'a', ắ: 'a', ẳ: 'a', ẵ: 'a', ặ: 'a',
    â: 'a', ầ: 'a', ấ: 'a', ẩ: 'a', ẫ: 'a', ậ: 'a',
    è: 'e', é: 'e', ẻ: 'e', ẽ: 'e', ẹ: 'e',
    ê: 'e', ề: 'e', ế: 'e', ể: 'e', ễ: 'e', ệ: 'e',
    ì: 'i', í: 'i', ỉ: 'i', ĩ: 'i', ị: 'i',
    ò: 'o', ó: 'o', ỏ: 'o', õ: 'o', ọ: 'o',
    ô: 'o', ồ: 'o', ố: 'o', ổ: 'o', ỗ: 'o', ộ: 'o',
    ơ: 'o', ờ: 'o', ớ: 'o', ở: 'o', ỡ: 'o', ợ: 'o',
    ù: 'u', ú: 'u', ủ: 'u', ũ: 'u', ụ: 'u',
    ư: 'u', ừ: 'u', ứ: 'u', ử: 'u', ữ: 'u', ự: 'u',
    ỳ: 'y', ý: 'y', ỷ: 'y', ỹ: 'y', ỵ: 'y',
    đ: 'd',
    // Uppercase (handled after toLower below, but just in case)
    À: 'a', Á: 'a', Ả: 'a', Ã: 'a', Ạ: 'a',
    Đ: 'd',
};

function normalize(s: string): string {
    return s
        .toLowerCase()
        .split('')
        .map((c) => VI_MAP[c] ?? c)
        .join('')
        .replace(/\s+/g, ' ')
        .trim();
}

/** Returns a 0-1 similarity score between two normalized strings */
function similarity(a: string, b: string): number {
    if (a === b) return 1;
    const na = normalize(a);
    const nb = normalize(b);
    if (na === nb) return 1;
    if (!na || !nb) return 0;

    // Use token overlap: split into words and compute Jaccard similarity
    const setA = new Set(na.split(' '));
    const setB = new Set(nb.split(' '));
    const intersection = [...setA].filter((w) => setB.has(w)).length;
    const union = setB.size + setA.size - intersection;
    return union === 0 ? 0 : intersection / union;
}

const CONFIDENCE_THRESHOLD = 0.6;

// ─────────────────────────────────────────────────────────────────────────────
// Toast helper
// ─────────────────────────────────────────────────────────────────────────────

interface Toast { id: number; type: 'success' | 'error' | 'info'; text: string }

// ─────────────────────────────────────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────────────────────────────────────

export default function MappingPage() {
    const { user, userDoc } = useAuth();

    // ── Admin-only RBAC guard ──────────────────────────────────────────────────
    const isAdmin = userDoc?.role === 'admin' || userDoc?.role === 'super_admin';

    if (userDoc && !isAdmin) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[60vh] text-center gap-3">
                <div className="w-16 h-16 rounded-2xl bg-red-50 flex items-center justify-center">
                    <Link2 className="w-8 h-8 text-red-400" />
                </div>
                <h2 className="text-lg font-bold text-gray-800">Chỉ dành cho Admin</h2>
                <p className="text-sm text-gray-500 max-w-xs">
                    Trang mapping ZKTeco chỉ dành cho quản trị viên hệ thống.
                </p>
            </div>
        );
    }


    const [zkUsers, setZkUsers] = useState<ZkUserDoc[]>([]);
    const [systemUsers, setSystemUsers] = useState<UserDoc[]>([]);
    const [loading, setLoading] = useState(true);
    const [syncing, setSyncing] = useState(false);
    const [showIgnored, setShowIgnored] = useState(false);
    const [toasts, setToasts] = useState<Toast[]>([]);
    const [searchQuery, setSearchQuery] = useState('');

    // Auto-match preview modal state
    const [autoMatchProposals, setAutoMatchProposals] = useState<
        { zkUser: ZkUserDoc; systemUser: UserDoc; score: number }[]
    >([]);
    const [showAutoMatchModal, setShowAutoMatchModal] = useState(false);
    const [applyingAutoMatch, setApplyingAutoMatch] = useState(false);

    // Per-row manual select state: Map<zkUserId, selectedSystemUid>
    const [pendingMap, setPendingMap] = useState<Record<string, string>>({});
    const [rowSearch, setRowSearch] = useState<Record<string, string>>({});
    const [savingRow, setSavingRow] = useState<string | null>(null);

    // ── Helpers ────────────────────────────────────────────────────────────────

    const addToast = useCallback((type: Toast['type'], text: string) => {
        const id = Date.now();
        setToasts((t) => [...t, { id, type, text }]);
        setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 4000);
    }, []);

    const getToken = useCallback(async () => user?.getIdToken() ?? '', [user]);

    // ── Real-time listeners ───────────────────────────────────────────────────

    useEffect(() => {
        const unsub = onSnapshot(collection(db, 'zkteco_users'), (snap) => {
            const docs = snap.docs.map((d) => ({ id: d.id, ...d.data() } as ZkUserDoc));
            docs.sort((a, b) => a.zk_name.localeCompare(b.zk_name));
            setZkUsers(docs);
            setLoading(false);
        });
        return () => unsub();
    }, []);

    useEffect(() => {
        const unsub = onSnapshot(collection(db, 'users'), (snap) => {
            const docs = snap.docs
                .map((d) => d.data() as UserDoc)
                .filter((u) => u.isActive !== false && u.role !== 'admin');
            docs.sort((a, b) => a.name.localeCompare(b.name));
            setSystemUsers(docs);
        });
        return () => unsub();
    }, []);

    // ── Sync users ─────────────────────────────────────────────────────────────

    const handleSync = useCallback(async () => {
        setSyncing(true);
        try {
            const token = await getToken();
            const res = await fetch('/api/hr/sync-users', {
                method: 'POST',
                headers: { Authorization: `Bearer ${token}` },
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error);
            addToast('success', `Đồng bộ xong: +${data.inserted} mới, cập nhật ${data.updated}.`);
        } catch (e: unknown) {
            addToast('error', e instanceof Error ? e.message : 'Lỗi đồng bộ');
        } finally {
            setSyncing(false);
        }
    }, [getToken, addToast]);

    // ── PATCH mapping ──────────────────────────────────────────────────────────

    const patchMapping = useCallback(
        async (
            zkUserId: string,
            status: ZkUserDoc['status'],
            systemUid: string | null,
            systemName: string | null
        ) => {
            const token = await getToken();
            const res = await fetch('/api/hr/zkteco-users', {
                method: 'PATCH',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${token}`,
                },
                body: JSON.stringify({
                    id: zkUserId,
                    status,
                    mapped_system_uid: systemUid,
                    mapped_system_name: systemName,
                }),
            });
            if (!res.ok) {
                const data = await res.json().catch(() => ({}));
                throw new Error(data.error ?? 'Lỗi cập nhật');
            }
        },
        [getToken]
    );

    // ── Manual map a row ───────────────────────────────────────────────────────

    const handleMapRow = useCallback(
        async (zkUserId: string) => {
            const selectedUid = pendingMap[zkUserId];
            if (!selectedUid) return;
            const sysUser = systemUsers.find((u) => u.uid === selectedUid);
            if (!sysUser) return;
            setSavingRow(zkUserId);
            try {
                await patchMapping(zkUserId, 'mapped', sysUser.uid, sysUser.name);
                setPendingMap((p) => { const n = { ...p }; delete n[zkUserId]; return n; });
                addToast('success', `Đã map "${sysUser.name}" thành công.`);
            } catch (e: unknown) {
                addToast('error', e instanceof Error ? e.message : 'Lỗi');
            } finally {
                setSavingRow(null);
            }
        },
        [pendingMap, systemUsers, patchMapping, addToast]
    );

    const handleIgnore = useCallback(
        async (zkUserId: string) => {
            try {
                await patchMapping(zkUserId, 'ignored', null, null);
                addToast('info', `Đã ẩn người dùng ZK.`);
            } catch (e: unknown) {
                addToast('error', e instanceof Error ? e.message : 'Lỗi');
            }
        },
        [patchMapping, addToast]
    );

    const handleUnmap = useCallback(
        async (zkUserId: string) => {
            try {
                await patchMapping(zkUserId, 'unmapped', null, null);
                addToast('info', 'Đã bỏ mapping.');
            } catch (e: unknown) {
                addToast('error', e instanceof Error ? e.message : 'Lỗi');
            }
        },
        [patchMapping, addToast]
    );

    // ── Auto-Match ─────────────────────────────────────────────────────────────

    const handleAutoMatch = useCallback(() => {
        const unmapped = zkUsers.filter((z) => z.status === 'unmapped');
        const proposals: typeof autoMatchProposals = [];

        for (const zk of unmapped) {
            let best: UserDoc | null = null;
            let bestScore = 0;
            for (const su of systemUsers) {
                const score = similarity(zk.zk_name, su.name);
                if (score > bestScore) {
                    bestScore = score;
                    best = su;
                }
            }
            if (best && bestScore >= CONFIDENCE_THRESHOLD) {
                proposals.push({ zkUser: zk, systemUser: best, score: bestScore });
            }
        }

        if (proposals.length === 0) {
            addToast('info', 'Không tìm thấy kết quả ghép tự động nào đủ tin cậy.');
            return;
        }
        setAutoMatchProposals(proposals);
        setShowAutoMatchModal(true);
    }, [zkUsers, systemUsers, addToast]);

    const applyAutoMatch = useCallback(async () => {
        setApplyingAutoMatch(true);
        let ok = 0;
        for (const { zkUser, systemUser } of autoMatchProposals) {
            try {
                await patchMapping(zkUser.id, 'mapped', systemUser.uid, systemUser.name);
                ok++;
            } catch { /* individual failures are silent */ }
        }
        addToast('success', `Tự động map xong ${ok}/${autoMatchProposals.length} người.`);
        setShowAutoMatchModal(false);
        setApplyingAutoMatch(false);
    }, [autoMatchProposals, patchMapping, addToast]);

    // ── Filtered list ──────────────────────────────────────────────────────────

    const filteredZkUsers = useMemo(() => {
        let list = showIgnored ? zkUsers : zkUsers.filter((z) => z.status !== 'ignored');
        if (searchQuery.trim()) {
            const q = normalize(searchQuery);
            list = list.filter(
                (z) =>
                    normalize(z.zk_name).includes(q) || z.zk_user_id.includes(searchQuery)
            );
        }
        return list;
    }, [zkUsers, showIgnored, searchQuery]);

    const stats = useMemo(() => ({
        total: zkUsers.length,
        mapped: zkUsers.filter((z) => z.status === 'mapped').length,
        unmapped: zkUsers.filter((z) => z.status === 'unmapped').length,
        ignored: zkUsers.filter((z) => z.status === 'ignored').length,
    }), [zkUsers]);

    // ─────────────────────────────────────────────────────────────────────────
    // Render
    // ─────────────────────────────────────────────────────────────────────────

    return (
        <div className="space-y-5">
            {/* Toast stack */}
            <div className="fixed top-4 right-4 z-[200] space-y-2 pointer-events-none">
                {toasts.map((t) => (
                    <div
                        key={t.id}
                        className={cn(
                            'flex items-center gap-2 px-4 py-3 rounded-xl shadow-lg text-sm font-medium animate-in slide-in-from-right-5 fade-in pointer-events-auto',
                            t.type === 'success' && 'bg-success-600 text-white',
                            t.type === 'error' && 'bg-danger-600 text-white',
                            t.type === 'info' && 'bg-surface-700 text-white'
                        )}
                    >
                        {t.type === 'success' && <CheckCircle2 className="w-4 h-4 shrink-0" />}
                        {t.type === 'error' && <XCircle className="w-4 h-4 shrink-0" />}
                        {t.type === 'info' && <AlertCircle className="w-4 h-4 shrink-0" />}
                        {t.text}
                    </div>
                ))}
            </div>

            {/* Header */}
            <div className="bg-white rounded-2xl border border-surface-200 shadow-sm p-5">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div>
                        <h1 className="text-xl font-bold bg-gradient-to-r from-primary-600 to-accent-600 bg-clip-text text-transparent flex items-center gap-2">
                            <Link2 className="w-5 h-5 text-primary-600" />
                            Mapping ZKTeco → Hệ thống
                        </h1>
                        <p className="text-surface-500 text-sm mt-0.5">
                            Ghép người dùng máy chấm công với tài khoản nhân viên ERP.
                        </p>
                    </div>
                    <div className="flex items-center gap-2 flex-wrap">
                        <button
                            onClick={() => setShowIgnored((v) => !v)}
                            className={cn(
                                'flex items-center gap-2 px-3.5 py-2 rounded-xl text-sm font-medium border transition-all',
                                showIgnored
                                    ? 'bg-surface-700 text-white border-surface-700'
                                    : 'bg-white text-surface-600 border-surface-200 hover:bg-surface-50'
                            )}
                        >
                            {showIgnored ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                            {showIgnored ? 'Ẩn đã bỏ qua' : 'Hiện đã bỏ qua'}
                        </button>
                        <button
                            onClick={handleAutoMatch}
                            className="flex items-center gap-2 px-3.5 py-2 rounded-xl text-sm font-medium border bg-accent-50 text-accent-700 border-accent-200 hover:bg-accent-100 transition-all"
                        >
                            <Zap className="w-4 h-4" />
                            Tự động ghép
                        </button>
                        <button
                            onClick={handleSync}
                            disabled={syncing}
                            className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium bg-gradient-to-r from-primary-600 to-accent-600 text-white hover:from-primary-700 hover:to-accent-700 shadow-md shadow-primary-500/20 transition-all disabled:opacity-60"
                        >
                            <RefreshCw className={cn('w-4 h-4', syncing && 'animate-spin')} />
                            {syncing ? 'Đang đồng bộ…' : 'Đồng bộ từ máy'}
                        </button>
                    </div>
                </div>

                {/* Stats */}
                <div className="grid grid-cols-4 gap-3 mt-5 pt-4 border-t border-surface-100">
                    {[
                        { label: 'Tổng ZK', value: stats.total, color: 'text-surface-700' },
                        { label: 'Đã ghép', value: stats.mapped, color: 'text-success-600' },
                        { label: 'Chưa ghép', value: stats.unmapped, color: 'text-warning-600' },
                        { label: 'Đã ẩn', value: stats.ignored, color: 'text-surface-400' },
                    ].map((s) => (
                        <div key={s.label} className="text-center">
                            <p className={cn('text-2xl font-black', s.color)}>{s.value}</p>
                            <p className="text-xs text-surface-500">{s.label}</p>
                        </div>
                    ))}
                </div>
            </div>

            {/* Search bar */}
            <div className="relative">
                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-surface-400" />
                <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Tìm theo tên ZK hoặc mã thẻ..."
                    className="w-full pl-10 pr-4 py-2.5 bg-white border border-surface-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary-300"
                />
            </div>

            {/* Table */}
            <div className="bg-white rounded-2xl border border-surface-200 shadow-sm overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                        <thead className="bg-surface-50 border-b border-surface-200 text-xs uppercase tracking-wider text-surface-500">
                            <tr>
                                <th className="px-5 py-3.5 text-left font-bold">Tên ZKTeco</th>
                                <th className="px-4 py-3.5 text-left font-bold">Mã thẻ</th>
                                <th className="px-4 py-3.5 text-left font-bold">Trạng thái</th>
                                <th className="px-4 py-3.5 text-left font-bold w-64">Ghép với nhân viên</th>
                                <th className="px-4 py-3.5 text-right font-bold">Hành động</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-surface-100">
                            {loading ? (
                                <tr>
                                    <td colSpan={5} className="py-16 text-center">
                                        <div className="w-8 h-8 border-4 border-primary-500 border-t-transparent rounded-full animate-spin mx-auto" />
                                    </td>
                                </tr>
                            ) : filteredZkUsers.length === 0 ? (
                                <tr>
                                    <td colSpan={5} className="py-16 text-center text-surface-400 text-sm">
                                        Không có dữ liệu. Nhấn &ldquo;Đồng bộ từ máy&rdquo; để tải.
                                    </td>
                                </tr>
                            ) : (
                                filteredZkUsers.map((zk) => {
                                    const isMapped = zk.status === 'mapped';
                                    const isIgnored = zk.status === 'ignored';
                                    const isSaving = savingRow === zk.id;
                                    const rowSearchVal = rowSearch[zk.id] ?? '';

                                    // Filtered system user options for this row
                                    const sysOptions = systemUsers.filter((su) => {
                                        if (!rowSearchVal) return true;
                                        return normalize(su.name).includes(normalize(rowSearchVal));
                                    });

                                    return (
                                        <tr
                                            key={zk.id}
                                            className={cn(
                                                'transition-colors hover:bg-surface-50',
                                                isIgnored && 'opacity-40'
                                            )}
                                        >
                                            {/* ZK Name */}
                                            <td className="px-5 py-3">
                                                <div className="flex items-center gap-2">
                                                    <div className="w-8 h-8 rounded-full bg-gradient-to-br from-primary-400 to-accent-500 text-white text-xs font-bold flex items-center justify-center shrink-0">
                                                        {zk.zk_name.charAt(0).toUpperCase()}
                                                    </div>
                                                    <span className="font-medium text-surface-800">{zk.zk_name}</span>
                                                </div>
                                            </td>

                                            {/* Card number */}
                                            <td className="px-4 py-3">
                                                <code className="text-xs bg-surface-100 px-2 py-1 rounded-lg text-surface-600">
                                                    {zk.zk_user_id}
                                                </code>
                                            </td>

                                            {/* Status */}
                                            <td className="px-4 py-3">
                                                {isMapped ? (
                                                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-bold bg-success-50 text-success-700 border border-success-200">
                                                        <CheckCircle2 className="w-3 h-3" />
                                                        {zk.mapped_system_name}
                                                    </span>
                                                ) : isIgnored ? (
                                                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-bold bg-surface-100 text-surface-500 border border-surface-200">
                                                        <EyeOff className="w-3 h-3" />
                                                        Đã ẩn
                                                    </span>
                                                ) : (
                                                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-bold bg-warning-50 text-warning-700 border border-warning-200">
                                                        <AlertCircle className="w-3 h-3" />
                                                        Chưa ghép
                                                    </span>
                                                )}
                                            </td>

                                            {/* Manual select dropdown */}
                                            <td className="px-4 py-3">
                                                {!isMapped && !isIgnored && (
                                                    <div className="relative">
                                                        <div className="flex items-center border border-surface-200 rounded-xl overflow-hidden bg-surface-50 focus-within:ring-2 focus-within:ring-primary-300">
                                                            <Search className="w-3.5 h-3.5 ml-2.5 text-surface-400 shrink-0" />
                                                            <input
                                                                type="text"
                                                                placeholder="Tìm nhân viên..."
                                                                value={rowSearchVal}
                                                                onChange={(e) => {
                                                                    setRowSearch((r) => ({ ...r, [zk.id]: e.target.value }));
                                                                    setPendingMap((p) => { const n = { ...p }; delete n[zk.id]; return n; });
                                                                }}
                                                                className="w-full px-2 py-1.5 text-xs bg-transparent outline-none"
                                                            />
                                                            <ChevronDown className="w-3.5 h-3.5 mr-2 text-surface-400 shrink-0" />
                                                        </div>
                                                        {rowSearchVal && sysOptions.length > 0 && !pendingMap[zk.id] && (
                                                            <div className="absolute z-10 w-full mt-1 bg-white border border-surface-200 rounded-xl shadow-lg max-h-44 overflow-y-auto">
                                                                {sysOptions.slice(0, 8).map((su) => (
                                                                    <button
                                                                        key={su.uid}
                                                                        onClick={() => {
                                                                            setPendingMap((p) => ({ ...p, [zk.id]: su.uid }));
                                                                            setRowSearch((r) => ({ ...r, [zk.id]: su.name }));
                                                                        }}
                                                                        className="w-full text-left px-3 py-2 text-xs hover:bg-primary-50 hover:text-primary-700 transition-colors flex items-center gap-2"
                                                                    >
                                                                        <UserCheck className="w-3 h-3 shrink-0 text-surface-400" />
                                                                        {su.name}
                                                                        <span className="ml-auto text-surface-400">{su.phone}</span>
                                                                    </button>
                                                                ))}
                                                            </div>
                                                        )}
                                                    </div>
                                                )}
                                            </td>

                                            {/* Actions */}
                                            <td className="px-4 py-3">
                                                <div className="flex items-center justify-end gap-1.5">
                                                    {!isMapped && !isIgnored && (
                                                        <>
                                                            <button
                                                                onClick={() => handleMapRow(zk.id)}
                                                                disabled={!pendingMap[zk.id] || isSaving}
                                                                className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl text-xs font-semibold bg-success-50 text-success-700 border border-success-200 hover:bg-success-100 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                                                            >
                                                                {isSaving ? (
                                                                    <div className="w-3 h-3 border-2 border-current border-t-transparent rounded-full animate-spin" />
                                                                ) : (
                                                                    <CheckCircle2 className="w-3 h-3" />
                                                                )}
                                                                Ghép
                                                            </button>
                                                            <button
                                                                onClick={() => handleIgnore(zk.id)}
                                                                className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl text-xs font-semibold bg-surface-100 text-surface-500 border border-surface-200 hover:bg-surface-200 transition-all"
                                                            >
                                                                <EyeOff className="w-3 h-3" />
                                                                Ẩn
                                                            </button>
                                                        </>
                                                    )}
                                                    {isMapped && (
                                                        <button
                                                            onClick={() => handleUnmap(zk.id)}
                                                            className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl text-xs font-semibold bg-warning-50 text-warning-700 border border-warning-200 hover:bg-warning-100 transition-all"
                                                        >
                                                            <X className="w-3 h-3" />
                                                            Bỏ ghép
                                                        </button>
                                                    )}
                                                    {isIgnored && (
                                                        <button
                                                            onClick={() => handleUnmap(zk.id)}
                                                            className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl text-xs font-semibold bg-primary-50 text-primary-700 border border-primary-200 hover:bg-primary-100 transition-all"
                                                        >
                                                            <Eye className="w-3 h-3" />
                                                            Khôi phục
                                                        </button>
                                                    )}
                                                </div>
                                            </td>
                                        </tr>
                                    );
                                })
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Auto-Match Preview Modal */}
            {showAutoMatchModal && (
                <div className="fixed inset-0 z-[150] flex items-center justify-center bg-surface-900/60 backdrop-blur-sm p-4">
                    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden animate-in zoom-in-95 duration-200">
                        <div className="p-5 border-b border-surface-100 flex items-center justify-between">
                            <div>
                                <h3 className="font-bold text-surface-900 flex items-center gap-2">
                                    <Zap className="w-5 h-5 text-accent-600" />
                                    Kết quả tự động ghép
                                </h3>
                                <p className="text-sm text-surface-500 mt-0.5">
                                    {autoMatchProposals.length} cặp được đề xuất (độ tin cậy ≥{' '}
                                    {Math.round(CONFIDENCE_THRESHOLD * 100)}%). Hãy kiểm tra trước khi áp dụng.
                                </p>
                            </div>
                            <button onClick={() => setShowAutoMatchModal(false)} className="p-2 rounded-xl text-surface-400 hover:bg-surface-100">
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        <div className="max-h-80 overflow-y-auto divide-y divide-surface-100">
                            {autoMatchProposals.map(({ zkUser, systemUser, score }) => (
                                <div key={zkUser.id} className="flex items-center gap-4 px-5 py-3">
                                    <div className="flex-1 min-w-0">
                                        <p className="text-sm font-medium text-surface-800 truncate">{zkUser.zk_name}</p>
                                        <p className="text-xs text-surface-400">{zkUser.zk_user_id}</p>
                                    </div>
                                    <span className="text-surface-300 font-light">→</span>
                                    <div className="flex-1 min-w-0">
                                        <p className="text-sm font-medium text-success-700 truncate">{systemUser.name}</p>
                                        <p className="text-xs text-surface-400">{systemUser.phone}</p>
                                    </div>
                                    <span
                                        className={cn(
                                            'px-2 py-1 rounded-lg text-[11px] font-bold',
                                            score >= 0.9 ? 'bg-success-50 text-success-700' : 'bg-warning-50 text-warning-700'
                                        )}
                                    >
                                        {Math.round(score * 100)}%
                                    </span>
                                </div>
                            ))}
                        </div>

                        <div className="p-4 bg-surface-50 border-t border-surface-100 flex justify-end gap-3">
                            <button
                                onClick={() => setShowAutoMatchModal(false)}
                                className="px-4 py-2 rounded-xl text-sm font-medium text-surface-600 border border-surface-200 bg-white hover:bg-surface-100 transition-all"
                            >
                                Hủy
                            </button>
                            <button
                                onClick={applyAutoMatch}
                                disabled={applyingAutoMatch}
                                className="px-5 py-2 rounded-xl text-sm font-medium bg-gradient-to-r from-primary-600 to-accent-600 text-white hover:from-primary-700 hover:to-accent-700 transition-all disabled:opacity-60 flex items-center gap-2"
                            >
                                {applyingAutoMatch && (
                                    <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                                )}
                                Áp dụng tất cả
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
