'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useCounterAssignment } from '@/hooks/useCounterAssignment';
import { Handshake, Lock, CheckCircle2, AlertCircle, Package, Send } from 'lucide-react';
import type { ProductDoc, InventoryBalanceDoc, HandoverCountedItem } from '@/types/inventory';
import type { SettingsDoc } from '@/types';
import { DashboardHeader } from '@/components/inventory/overview/DashboardHeader';

interface CountedRow {
    productId: string;
    productName: string;
    unit: string;
    systemQuantity: number;
    actualQuantity: number;
    diff: number;
}

export default function HandoverPage() {
    const { user, userDoc } = useAuth();
    const assignment = useCounterAssignment();

    const [products, setProducts] = useState<ProductDoc[]>([]);
    const [rows, setRows] = useState<CountedRow[]>([]);
    const [shiftTimes, setShiftTimes] = useState<string[]>([]);
    const [incomingShiftId, setIncomingShiftId] = useState('');
    const [incomingUserId, setIncomingUserId] = useState('');
    const [note, setNote] = useState('');
    const [loading, setLoading] = useState(false);
    const [dataLoading, setDataLoading] = useState(true);
    const [message, setMessage] = useState({ type: '', text: '' });

    const getToken = useCallback(() => user?.getIdToken(), [user]);

    // Fetch products + balances for the assigned counter
    useEffect(() => {
        if (!assignment.isAuthorized || !assignment.counterId || !user) return;
        setDataLoading(true);

        (async () => {
            try {
                const token = await getToken();

                // Fetch products
                const prodRes = await fetch('/api/inventory/products', {
                    headers: { Authorization: `Bearer ${token}` },
                });
                const prodData = await prodRes.json();
                const allProducts: ProductDoc[] = Array.isArray(prodData) ? prodData : [];
                setProducts(allProducts);

                // Fetch balances for this counter
                const balRes = await fetch(
                    `/api/inventory/balances?locationType=COUNTER&locationId=${assignment.counterId}`,
                    { headers: { Authorization: `Bearer ${token}` } }
                );
                const balData = await balRes.json();
                const balances: InventoryBalanceDoc[] = Array.isArray(balData) ? balData : [];

                // Build counted rows from balances
                const counted: CountedRow[] = balances.map(b => {
                    const prod = allProducts.find(p => p.id === b.productId);
                    return {
                        productId: b.productId,
                        productName: prod?.name || b.productId,
                        unit: prod?.unit || '',
                        systemQuantity: b.currentStock,
                        actualQuantity: b.currentStock, // default to system value
                        diff: 0,
                    };
                });
                setRows(counted);

                // Fetch shift times for the incoming shift selector
                if (assignment.storeId) {
                    const settingsRes = await fetch(`/api/stores/${assignment.storeId}/settings`, {
                        headers: { Authorization: `Bearer ${token}` },
                    });
                    const settingsData = await settingsRes.json();
                    const times: string[] = settingsData.settings?.shiftTimes || settingsData.shiftTimes || [];
                    setShiftTimes(times);
                    // Set incoming shift to next shift (if available)
                    const currentIdx = times.indexOf(assignment.shiftId);
                    if (currentIdx >= 0 && currentIdx + 1 < times.length) {
                        setIncomingShiftId(times[currentIdx + 1]);
                    } else if (times.length > 0) {
                        setIncomingShiftId(times[0]);
                    }
                }
            } catch {
                setMessage({ type: 'error', text: 'Không thể tải dữ liệu tồn kho.' });
            } finally {
                setDataLoading(false);
            }
        })();
    }, [assignment.isAuthorized, assignment.counterId, assignment.storeId, assignment.shiftId, user, getToken]);

    const updateActualQuantity = (productId: string, value: number) => {
        setRows(prev => prev.map(r =>
            r.productId === productId
                ? { ...r, actualQuantity: value, diff: value - r.systemQuantity }
                : r
        ));
    };

    const handleSubmit = async () => {
        if (!assignment.counterId || !assignment.storeId) return;
        setLoading(true);
        setMessage({ type: '', text: '' });
        try {
            const token = await getToken();
            const countedItems: HandoverCountedItem[] = rows.map(r => ({
                productId: r.productId,
                systemQuantity: r.systemQuantity,
                actualQuantity: r.actualQuantity,
                diff: r.diff,
            }));

            const res = await fetch('/api/inventory/handover', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
                body: JSON.stringify({
                    storeId: assignment.storeId,
                    counterId: assignment.counterId,
                    outgoingShiftId: assignment.shiftId,
                    incomingShiftId: incomingShiftId || assignment.shiftId,
                    incomingUserId,
                    countedItems,
                    note,
                }),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error);
            setMessage({
                type: 'success',
                text: data.message || 'Đã ghi nhận giao ca thành công!',
            });
        } catch (err: any) {
            setMessage({ type: 'error', text: err.message || 'Có lỗi xảy ra' });
        } finally {
            setLoading(false);
        }
    };

    const discrepancyCount = rows.filter(r => r.diff !== 0).length;

    // ── Loading state ──
    if (assignment.loading) {
        return (
            <div className="flex justify-center py-20">
                <div className="w-8 h-8 border-4 border-surface-300 border-t-warning-600 rounded-full animate-spin" />
            </div>
        );
    }

    // ── Locked state ──
    if (!assignment.isAuthorized) {
        return (
            <div className="space-y-6 mx-auto">
                <DashboardHeader
                    showSelect={false}
                    titleChildren={
                        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 w-full">
                            <div>
                                <h1 className="text-2xl font-bold bg-gradient-to-r from-orange-600 to-danger-600 bg-clip-text text-transparent flex items-center gap-2">
                                    <Handshake className="w-7 h-7 text-orange-600" />
                                    Giao ca
                                </h1>
                            </div>
                        </div>
                    }
                />

                <div className="bg-gradient-to-br from-danger-50 to-orange-50 border-2 border-danger-200 rounded-2xl p-8 text-center space-y-4">
                    <div className="w-16 h-16 mx-auto bg-danger-100 rounded-full flex items-center justify-center">
                        <Lock className="w-8 h-8 text-danger-500" />
                    </div>
                    <h2 className="text-xl font-bold text-danger-700">Đã khoá</h2>
                    <p className="text-danger-600 max-w-md mx-auto leading-relaxed">
                        {assignment.error || 'Bạn không được phân công trực tại quầy nào hôm nay. Quét mã vạch và giao ca bị khoá.'}
                    </p>
                    <div className="pt-2">
                        <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-danger-500 bg-danger-100 border border-danger-200 px-3 py-1.5 rounded-full">
                            <Lock className="w-3 h-3" />
                            Chức năng bị khoá
                        </span>
                    </div>
                </div>
            </div>
        );
    }

    // ── Authorized state ──
    return (
        <div className="space-y-6 mx-auto">
            <DashboardHeader
                showSelect={false}
                titleChildren={
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 w-full">
                        <div>
                            <h1 className="text-2xl font-bold bg-gradient-to-r from-warning-600 to-orange-600 bg-clip-text text-transparent flex items-center gap-2">
                                <Handshake className="w-7 h-7 text-warning-600" />
                                Giao ca
                            </h1>
                            <p className="text-surface-500 mt-1 text-sm">
                                Kiểm kê và giao ca tại <strong className="text-warning-600">{assignment.counterName}</strong> — {assignment.shiftId}
                            </p>
                        </div>
                    </div>
                }
            />

            {/* Status indicator */}
            <div className="bg-success-50 border border-success-200 rounded-xl p-3 text-sm text-success-700 flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 shrink-0" />
                <span>Bạn đã được phân công tại <strong>{assignment.counterName}</strong>. Sẵn sàng giao ca.</span>
            </div>

            {/* Incoming shift selector */}
            <div className="bg-white rounded-2xl border border-surface-200 shadow-sm p-6 space-y-4">
                <h3 className="text-sm font-semibold text-surface-700">Thông tin giao ca</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                        <label className="block text-xs text-surface-500 mb-1">Ca nhận</label>
                        <select value={incomingShiftId} onChange={e => setIncomingShiftId(e.target.value)}
                            className="w-full bg-surface-50 border border-surface-200 rounded-xl p-2.5 text-sm outline-none focus:ring-2 focus:ring-warning-300">
                            {shiftTimes.map(s => (
                                <option key={s} value={s}>{s}</option>
                            ))}
                        </select>
                    </div>
                    <div>
                        <label className="block text-xs text-surface-500 mb-1">Người nhận ca (tuỳ chọn)</label>
                        <input type="text" value={incomingUserId} onChange={e => setIncomingUserId(e.target.value)}
                            placeholder="ID người nhận ca"
                            className="w-full bg-surface-50 border border-surface-200 rounded-xl p-2.5 text-sm outline-none focus:ring-2 focus:ring-warning-300" />
                    </div>
                </div>
            </div>

            {/* Inventory Cross-Check Table */}
            <div className="bg-white rounded-2xl border border-surface-200 shadow-sm overflow-hidden">
                <div className="px-6 py-4 border-b border-surface-100 flex items-center justify-between">
                    <h3 className="font-bold text-surface-800">Kiểm kê tồn kho</h3>
                    {discrepancyCount > 0 && (
                        <span className="inline-flex items-center gap-1 text-xs font-bold text-warning-600 bg-warning-50 border border-warning-200 px-2 py-0.5 rounded">
                            <AlertCircle className="w-3 h-3" />
                            {discrepancyCount} chênh lệch
                        </span>
                    )}
                </div>

                {dataLoading ? (
                    <div className="flex justify-center py-12">
                        <div className="w-6 h-6 border-4 border-surface-300 border-t-surface-700 rounded-full animate-spin" />
                    </div>
                ) : rows.length === 0 ? (
                    <div className="text-center py-12 space-y-2">
                        <Package className="w-8 h-8 text-surface-300 mx-auto" />
                        <p className="text-sm text-surface-400">Quầy chưa có hàng tồn kho để kiểm kê</p>
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="text-left text-xs text-surface-500 uppercase bg-surface-50 border-b">
                                    <th className="px-4 py-3">Sản phẩm</th>
                                    <th className="px-4 py-3 text-right">Hệ thống</th>
                                    <th className="px-4 py-3 text-right">Thực tế</th>
                                    <th className="px-4 py-3 text-right">Chênh lệch</th>
                                </tr>
                            </thead>
                            <tbody>
                                {rows.map(row => (
                                    <tr key={row.productId} className={`border-b border-surface-100 ${row.diff !== 0 ? 'bg-warning-50/60' : 'hover:bg-surface-50/50'}`}>
                                        <td className="px-4 py-3">
                                            <div>
                                                <span className="font-medium text-surface-700">{row.productName}</span>
                                                {row.unit && <span className="text-xs text-surface-400 ml-1">({row.unit})</span>}
                                            </div>
                                        </td>
                                        <td className="px-4 py-3 text-right font-semibold text-surface-600">{row.systemQuantity}</td>
                                        <td className="px-4 py-3 text-right">
                                            <input
                                                type="number"
                                                min={0}
                                                value={row.actualQuantity}
                                                onChange={e => updateActualQuantity(row.productId, Number(e.target.value) || 0)}
                                                className="w-20 text-center font-bold bg-white border border-surface-200 rounded-lg p-1.5 text-sm outline-none focus:ring-2 focus:ring-warning-300"
                                            />
                                        </td>
                                        <td className="px-4 py-3 text-right">
                                            <span className={`font-bold ${row.diff > 0 ? 'text-success-600' :
                                                row.diff < 0 ? 'text-danger-600' : 'text-surface-400'
                                                }`}>
                                                {row.diff > 0 ? `+${row.diff}` : row.diff}
                                            </span>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            {/* Note */}
            <div className="bg-white rounded-2xl border border-surface-200 shadow-sm p-6">
                <label className="block text-sm font-semibold text-surface-700 mb-2">Ghi chú giao ca (tuỳ chọn)</label>
                <textarea value={note} onChange={e => setNote(e.target.value)} rows={2} placeholder="VD: Máy tính bàn ca 1 bị lỗi..."
                    className="w-full bg-surface-50 border border-surface-200 rounded-xl p-3 text-sm outline-none focus:ring-2 focus:ring-warning-300 resize-none" />
            </div>

            {/* Submit */}
            <button onClick={handleSubmit} disabled={loading || rows.length === 0}
                className="w-full bg-gradient-to-r from-warning-600 to-orange-600 hover:from-warning-700 hover:to-orange-700 disabled:from-surface-400 disabled:to-surface-400 text-white py-3.5 rounded-xl font-bold text-sm flex items-center justify-center gap-2 transition-all shadow-md">
                {loading ? (
                    <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : (
                    <><Send className="w-4 h-4" /> Xác nhận giao ca</>
                )}
            </button>

            {/* Toast message */}
            {message.text && (
                <div className={`p-4 rounded-xl flex items-center gap-2 border text-sm font-medium ${message.type === 'error'
                    ? 'bg-danger-50 text-danger-700 border-danger-200'
                    : 'bg-success-50 text-success-700 border-success-200'
                    }`}>
                    {message.type === 'error' ? <AlertCircle className="w-4 h-4 shrink-0" /> : <CheckCircle2 className="w-4 h-4 shrink-0" />}
                    {message.text}
                </div>
            )}
        </div>
    );
}
